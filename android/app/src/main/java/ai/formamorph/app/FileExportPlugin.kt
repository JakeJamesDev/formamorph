package ai.formamorph.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "FormamorphFileExport")
class FileExportPlugin : Plugin() {
    private val saving = AtomicBoolean(false)
    private val writer = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun save(call: PluginCall) {
        if (!saving.compareAndSet(false, true)) {
            call.reject("Finish the current file export first")
            return
        }
        try {
            source(call)
            val filename = call.getString("filename")?.takeIf { it.isNotBlank() }
                ?: throw IllegalArgumentException("Missing export filename")
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = call.getString("mimeType") ?: "application/octet-stream"
                putExtra(Intent.EXTRA_TITLE, filename)
            }
            startActivityForResult(call, intent, "fileSelected")
        } catch (error: Exception) {
            saving.set(false)
            call.reject("Could not open the file picker", error)
        }
    }

    private fun source(call: PluginCall): java.io.File {
        val uri = Uri.parse(call.getString("uri") ?: "")
        require(uri.scheme == "file") { "Invalid export source" }
        return ExportFiles.source(context.cacheDir, requireNotNull(uri.path))
    }

    @ActivityCallback
    private fun fileSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) {
            saving.set(false)
            return
        }
        if (result.resultCode != Activity.RESULT_OK) {
            saving.set(false)
            call.resolve()
            return
        }
        try {
            writer.execute {
                try {
                    val uri = requireNotNull(result.data?.data) { "Missing export destination" }
                    val file = source(call)
                    val output = context.contentResolver.openOutputStream(uri, "wt")
                        ?: throw java.io.IOException("Could not open export destination")
                    output.use { ExportFiles.copy(file, it) }
                    call.resolve()
                } catch (error: Exception) {
                    call.reject("Could not save the file", error)
                } finally {
                    saving.set(false)
                }
            }
        } catch (error: Exception) {
            saving.set(false)
            call.reject("Could not start the file export", error)
        }
    }

    override fun handleOnDestroy() {
        writer.shutdown()
    }
}
