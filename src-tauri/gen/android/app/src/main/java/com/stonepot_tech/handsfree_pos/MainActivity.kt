package com.stonepot_tech.handsfree_pos

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.os.Build
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import java.io.ByteArrayOutputStream

class MainActivity : TauriActivity() {
    companion object {
        private const val TAG = "DocumentScanner"
    }

    private lateinit var webView: WebView
    private var scanCallbackId: String? = null

    // Document scanner launcher
    private val scannerLauncher: ActivityResultLauncher<IntentSenderRequest> =
        registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
            handleScanResult(result.resultCode, result.data)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        this.webView = webView

        // SECURITY: Disable WebView debugging in release builds
        // This prevents access to DevTools via chrome://inspect
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false)
            Log.d(TAG, "WebView debugging disabled for release build")
        }

        // Add JavaScript interface for native document scanning
        webView.addJavascriptInterface(DocumentScannerInterface(), "NativeDocumentScanner")

        Log.d(TAG, "WebView created, NativeDocumentScanner interface added")
    }

    /**
     * JavaScript interface for document scanning
     * Call from JS: window.NativeDocumentScanner.scanDocument(callbackId)
     */
    inner class DocumentScannerInterface {
        @JavascriptInterface
        fun scanDocument(callbackId: String) {
            Log.d(TAG, "scanDocument called with callbackId: $callbackId")
            scanCallbackId = callbackId

            runOnUiThread {
                startDocumentScanner()
            }
        }

        @JavascriptInterface
        fun isAvailable(): Boolean {
            // ML Kit Document Scanner is available on devices with Google Play Services
            return true
        }
    }

    private fun startDocumentScanner() {
        val options = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)  // Allow importing from gallery
            .setPageLimit(5)                 // Max 5 pages per scan
            .setResultFormats(
                GmsDocumentScannerOptions.RESULT_FORMAT_JPEG,
                GmsDocumentScannerOptions.RESULT_FORMAT_PDF
            )
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)  // Full UI with crop/edit
            .build()

        val scanner = GmsDocumentScanning.getClient(options)

        scanner.getStartScanIntent(this)
            .addOnSuccessListener { intentSender ->
                Log.d(TAG, "Scanner intent ready, launching...")
                scannerLauncher.launch(IntentSenderRequest.Builder(intentSender).build())
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to start scanner", e)
                sendErrorToWebView("Failed to start document scanner: ${e.message}")
            }
    }

    private fun handleScanResult(resultCode: Int, data: Intent?) {
        if (resultCode == Activity.RESULT_OK && data != null) {
            val result = GmsDocumentScanningResult.fromActivityResultIntent(data)

            if (result != null) {
                val pages = result.pages
                if (pages != null && pages.isNotEmpty()) {
                    Log.d(TAG, "Scanned ${pages.size} page(s)")

                    // Get the first page as base64 for OCR processing
                    val firstPageUri = pages[0].imageUri
                    val base64Image = uriToBase64(firstPageUri)

                    if (base64Image != null) {
                        // Also get PDF if available
                        val pdfUri = result.pdf?.uri?.toString()

                        sendSuccessToWebView(base64Image, pages.size, pdfUri)
                    } else {
                        sendErrorToWebView("Failed to process scanned image")
                    }
                } else {
                    sendErrorToWebView("No pages scanned")
                }
            } else {
                sendErrorToWebView("Invalid scan result")
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            sendCancelledToWebView()
        } else {
            sendErrorToWebView("Scan failed with code: $resultCode")
        }
    }

    private fun uriToBase64(uri: Uri): String? {
        return try {
            contentResolver.openInputStream(uri)?.use { inputStream ->
                val bitmap = BitmapFactory.decodeStream(inputStream)
                val outputStream = ByteArrayOutputStream()

                // Compress to JPEG with 85% quality for good balance of size/quality
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)

                val bytes = outputStream.toByteArray()
                Base64.encodeToString(bytes, Base64.NO_WRAP)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to convert URI to base64", e)
            null
        }
    }

    private fun sendSuccessToWebView(base64Image: String, pageCount: Int, pdfUri: String?) {
        val callbackId = scanCallbackId ?: return
        val pdfUriJson = if (pdfUri != null) "\"$pdfUri\"" else "null"

        val js = """
            (function() {
                if (window.__documentScanCallbacks && window.__documentScanCallbacks['$callbackId']) {
                    window.__documentScanCallbacks['$callbackId']({
                        success: true,
                        image: '$base64Image',
                        pageCount: $pageCount,
                        pdfUri: $pdfUriJson
                    });
                    delete window.__documentScanCallbacks['$callbackId'];
                }
            })();
        """.trimIndent()

        runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
        scanCallbackId = null
    }

    private fun sendErrorToWebView(error: String) {
        val callbackId = scanCallbackId ?: return

        val js = """
            (function() {
                if (window.__documentScanCallbacks && window.__documentScanCallbacks['$callbackId']) {
                    window.__documentScanCallbacks['$callbackId']({
                        success: false,
                        error: '$error'
                    });
                    delete window.__documentScanCallbacks['$callbackId'];
                }
            })();
        """.trimIndent()

        runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
        scanCallbackId = null
    }

    private fun sendCancelledToWebView() {
        val callbackId = scanCallbackId ?: return

        val js = """
            (function() {
                if (window.__documentScanCallbacks && window.__documentScanCallbacks['$callbackId']) {
                    window.__documentScanCallbacks['$callbackId']({
                        success: false,
                        cancelled: true
                    });
                    delete window.__documentScanCallbacks['$callbackId'];
                }
            })();
        """.trimIndent()

        runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
        scanCallbackId = null
    }
}
