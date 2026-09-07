package ai.formamorph.app

import java.io.File
import java.io.OutputStream

internal object ExportFiles {
    fun source(cacheDir: File, path: String): File {
        val root = File(cacheDir, "exports").canonicalFile
        val source = File(path).canonicalFile
        require(source.path.startsWith(root.path + File.separator) && source.isFile) {
            "Export file is unavailable"
        }
        return source
    }

    fun copy(source: File, destination: OutputStream) {
        source.inputStream().use { it.copyTo(destination) }
    }
}
