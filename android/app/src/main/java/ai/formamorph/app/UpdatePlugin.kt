package ai.formamorph.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * The Android half of the update flow: download the release APK, prove it is the file the release
 * published, and hand it to the system installer.
 *
 * The renderer already knows which release is newest and where its files are, so nothing here reads
 * GitHub. That is the one place this differs from the desktop shell, whose main process does its own
 * detection.
 */
@CapacitorPlugin(name = "FormamorphUpdate")
class UpdatePlugin : Plugin() {

    // Capacitor runs plugin methods on one shared background thread. A 90 MB download would hold it for
    // minutes and stall every other plugin call, so the download gets a thread of its own.
    private val downloads = Executors.newSingleThreadExecutor()

    private val staged: File
        get() = File(context.cacheDir, "updates/$ASSET_NAME")

    private val record
        get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** What the installer reports back after a commit. */
    private val installResults = object : BroadcastReceiver() {
        override fun onReceive(received: Context, intent: Intent) {
            when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
                PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                    // Android never installs on an app's say-so. This is its own sheet, which the player
                    // confirms; the intent to raise it comes back with the status.
                    val sheet = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)
                    sheet?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    sheet?.let { received.startActivity(it) }
                }
                // The install replaces this process, so this only lands when it did not. Either way the
                // 90 MB in the cache has done its job.
                PackageInstaller.STATUS_SUCCESS -> discard()
            }
        }
    }

    override fun load() {
        ContextCompat.registerReceiver(
            context,
            installResults,
            IntentFilter(INSTALL_STATUS_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun handleOnDestroy() {
        context.unregisterReceiver(installResults)
        downloads.shutdownNow()
    }

    /** The version waiting in the cache, so a restart offers Install rather than a second download. */
    @PluginMethod
    fun pending(call: PluginCall) {
        val version = record.getString(KEY_VERSION, null)
        val waiting = if (!version.isNullOrEmpty() && staged.exists()) version else null
        // A record with no file behind it is a cache Android cleared under us; forget it rather than
        // offering an install of nothing.
        if (waiting == null) discard()
        call.resolve(JSObject().put("version", waiting ?: JSONObject.NULL))
    }

    /**
     * Stream the release APK into the cache and verify it against the release's own checksum.
     *
     * The call stays open for the whole download, so a failure — a dropped connection, a checksum that
     * does not match — reaches the footer as an error instead of a progress bar that never finishes.
     */
    @PluginMethod
    fun download(call: PluginCall) {
        val url = call.getString("url")
        val sha512Url = call.getString("sha512Url")
        val version = call.getString("version").orEmpty()
        if (url.isNullOrEmpty() || sha512Url.isNullOrEmpty()) {
            call.reject("This release has no Android download.")
            return
        }

        downloads.execute {
            try {
                discard()
                staged.parentFile?.mkdirs()
                streamTo(url, staged)

                val expected = readChecksum(sha512Url)
                val actual = sha512Of(staged)
                if (!expected.equals(actual, ignoreCase = true)) {
                    discard()
                    call.reject("The download did not match the checksum published with it, so it was discarded.")
                    return@execute
                }

                record.edit().putString(KEY_VERSION, version).apply()
                notifyListeners("downloaded", JSObject())
                call.resolve()
            } catch (error: Exception) {
                discard()
                call.reject(error.localizedMessage ?: "The update download failed.", error)
            }
        }
    }

    /**
     * Hand the downloaded APK to the system installer.
     *
     * Installing needs the player's standing permission for this app, which is a setting only they can
     * change. When it is missing this opens that setting and says so, leaving the offer standing for the
     * tap that follows.
     */
    @PluginMethod
    fun apply(call: PluginCall) {
        if (!staged.exists()) {
            call.reject("There is no downloaded update to install.")
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val allow = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(allow)
            call.resolve(JSObject().put("needsPermission", true))
            return
        }

        try {
            install(staged)
            call.resolve(JSObject().put("needsPermission", false))
        } catch (error: Exception) {
            call.reject(error.localizedMessage ?: "The update could not be handed to the installer.", error)
        }
    }

    private fun install(apk: File) {
        val installer = context.packageManager.packageInstaller
        val session = installer.openSession(
            installer.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)),
        )
        session.use {
            it.openWrite(SESSION_ENTRY, 0, apk.length()).use { sink ->
                apk.inputStream().use { source -> source.copyTo(sink) }
                it.fsync(sink)
            }
            it.commit(statusCallback().intentSender)
        }
    }

    private fun statusCallback(): PendingIntent {
        // The installer fills the status in, so the intent has to stay mutable where that became a choice.
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val status = Intent(INSTALL_STATUS_ACTION).setPackage(context.packageName)
        return PendingIntent.getBroadcast(context, 0, status, flags)
    }

    private fun streamTo(from: String, into: File) {
        val connection = (URL(from).openConnection() as HttpURLConnection).apply {
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            instanceFollowRedirects = true
        }
        try {
            if (connection.responseCode !in 200..299) {
                throw IOException("The download server answered ${connection.responseCode}.")
            }
            // A chunked response reports -1. Zero is the renderer's word for "no total", and -1 would
            // reach the footer as a size.
            val total = connection.contentLengthLong.coerceAtLeast(0)
            var received = 0L
            var announced = 0L
            connection.inputStream.use { source ->
                into.outputStream().use { sink ->
                    val buffer = ByteArray(BUFFER_BYTES)
                    while (true) {
                        val read = source.read(buffer)
                        if (read < 0) break
                        sink.write(buffer, 0, read)
                        received += read
                        // One event per megabyte: smooth enough for the bar, quiet enough to leave the
                        // bridge alone on a 90 MB file.
                        if (received - announced >= PROGRESS_STEP_BYTES || received == total) {
                            announced = received
                            notifyListeners(
                                "downloadProgress",
                                JSObject().put("received", received).put("total", total),
                            )
                        }
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readChecksum(from: String): String {
        val connection = (URL(from).openConnection() as HttpURLConnection).apply {
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            instanceFollowRedirects = true
        }
        try {
            if (connection.responseCode !in 200..299) {
                throw IOException("The checksum server answered ${connection.responseCode}.")
            }
            val text = connection.inputStream.bufferedReader().use { it.readText() }
            // `sha512sum` writes the digest, two spaces, then the file name. A bare digest reads the same.
            return text.trim().substringBefore(' ').trim()
        } finally {
            connection.disconnect()
        }
    }

    private fun sha512Of(file: File): String {
        val digest = MessageDigest.getInstance("SHA-512")
        file.inputStream().use { source ->
            val buffer = ByteArray(BUFFER_BYTES)
            while (true) {
                val read = source.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun discard() {
        staged.delete()
        record.edit().remove(KEY_VERSION).apply()
    }

    private companion object {
        const val ASSET_NAME = "Formamorph-android.apk"
        const val PREFS = "formamorph.update"
        const val KEY_VERSION = "pendingVersion"
        const val SESSION_ENTRY = "formamorph"
        const val INSTALL_STATUS_ACTION = "ai.formamorph.app.INSTALL_STATUS"
        const val TIMEOUT_MS = 30_000
        const val BUFFER_BYTES = 64 * 1024
        const val PROGRESS_STEP_BYTES = 1024L * 1024L
    }
}
