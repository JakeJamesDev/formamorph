package ai.formamorph.app

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.OutputStream
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ExportFilesTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun copiesBinaryExportWithoutChangingBytes() {
        val exports = temporary.newFolder("exports")
        val bytes = ByteArray(200000) { (it % 256).toByte() }
        val file = File(exports, "card").apply { writeBytes(bytes) }
        val output = ByteArrayOutputStream()
        ExportFiles.copy(ExportFiles.source(temporary.root, file.path), output)
        assertArrayEquals(bytes, output.toByteArray())
    }

    @Test fun rejectsFilesOutsideExportCache() {
        temporary.newFolder("exports")
        val privateFile = temporary.newFile("private").apply { writeText("private") }
        for (path in listOf(privateFile.path, File(temporary.root, "exports/../private").path)) {
            assertThrows(IllegalArgumentException::class.java) { ExportFiles.source(temporary.root, path) }
        }
        val sibling = temporary.newFolder("exports-other")
        val siblingFile = File(sibling, "file").apply { writeText("private") }
        assertThrows(IllegalArgumentException::class.java) { ExportFiles.source(temporary.root, siblingFile.path) }
    }

    @Test fun rejectsMissingFilesAndDirectories() {
        val exports = temporary.newFolder("exports")
        for (file in listOf(exports, File(exports, "missing"))) {
            assertThrows(IllegalArgumentException::class.java) { ExportFiles.source(temporary.root, file.path) }
        }
    }

    @Test fun propagatesDestinationFailures() {
        val file = temporary.newFile("source").apply { writeText("export") }
        val output = object : OutputStream() {
            override fun write(value: Int) { throw IOException("Storage full") }
        }
        assertThrows(IOException::class.java) { ExportFiles.copy(file, output) }
    }
}
