package com.azeem.maestroattendance

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ValueCallback
import android.webkit.WebView
import android.webkit.JavascriptInterface
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
  private lateinit var web: WebView
  private lateinit var updater: UpdateManager
  private var filePathCallback: ValueCallback<Array<Uri>>? = null
  private var lastUpdateCheckAt = 0L
  private var pendingReportBytes: ByteArray? = null

  inner class NativeBridge {
    @JavascriptInterface fun checkForUpdates() {
      runOnUiThread {
        if (::updater.isInitialized && isOnline()) updater.checkForUpdate(true)
        else android.widget.Toast.makeText(this@MainActivity, "Connect to the internet to check for updates.", android.widget.Toast.LENGTH_LONG).show()
      }
    }
    @JavascriptInterface fun getBuildNumber(): Int = BuildConfig.VERSION_CODE
    @JavascriptInterface fun saveReportFile(fileName: String, mimeType: String, encodedData: String) {
      try {
        if (fileName.length > 120 || !Regex("^[A-Za-z0-9._-]+\\.(pdf|docx)$", RegexOption.IGNORE_CASE).matches(fileName)) throw IllegalArgumentException("Invalid report filename")
        if (mimeType !in listOf("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) throw IllegalArgumentException("Unsupported report format")
        if (encodedData.length > 16 * 1024 * 1024) throw IllegalArgumentException("Report exceeds 12 MB limit")
        val bytes = Base64.decode(encodedData, Base64.DEFAULT)
        runOnUiThread {
          if (pendingReportBytes != null) {
            Toast.makeText(this@MainActivity, "Finish saving the previous report first.", Toast.LENGTH_LONG).show()
            return@runOnUiThread
          }
          pendingReportBytes = bytes
          val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType
            putExtra(Intent.EXTRA_TITLE, fileName)
          }
          try { reportSaveLauncher.launch(intent) }
          catch (e: Exception) {
            pendingReportBytes = null
            Toast.makeText(this@MainActivity, "Could not open document picker.", Toast.LENGTH_LONG).show()
          }
        }
      } catch (e: Exception) {
        runOnUiThread { Toast.makeText(this@MainActivity, e.message ?: "Invalid report file.", Toast.LENGTH_LONG).show() }
      }
    }
  }

  private val reportSaveLauncher =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      val bytes = pendingReportBytes
      pendingReportBytes = null
      val uri = result.data?.data
      if (result.resultCode == RESULT_OK && uri != null && bytes != null) {
        try {
          contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            ?: throw IllegalStateException("Unable to open destination")
          Toast.makeText(this, "Report saved successfully.", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
          Toast.makeText(this, "Failed to save report: ${e.message}", Toast.LENGTH_LONG).show()
        }
      }
    }

  private val fileChooserLauncher =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      val callback = filePathCallback ?: return@registerForActivityResult
      val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
      callback.onReceiveValue(uris)
      filePathCallback = null
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }

    val root = FrameLayout(this)
    web = WebView(this)

    root.addView(
      web,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    )
    setContentView(root)

    ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.statusBars() or
          WindowInsetsCompat.Type.navigationBars() or
          WindowInsetsCompat.Type.displayCutout()
      )
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      insets
    }
    ViewCompat.requestApplyInsets(root)

    val assetLoader = WebViewAssetLoader.Builder()
      .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
      .build()

    web.settings.javaScriptEnabled = true
    web.addJavascriptInterface(NativeBridge(), "MaestroAndroid")
    web.settings.domStorageEnabled = true
    web.settings.databaseEnabled = true
    web.settings.setSupportZoom(false)
    web.settings.builtInZoomControls = false
    web.settings.displayZoomControls = false
    web.settings.useWideViewPort = false
    web.settings.loadWithOverviewMode = false

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

    web.webChromeClient = object : WebChromeClient() {
      override fun onShowFileChooser(
        webView: WebView?,
        callback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
      ): Boolean {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = callback

        return try {
          val intent = fileChooserParams?.createIntent()
            ?: Intent(Intent.ACTION_GET_CONTENT).apply {
              addCategory(Intent.CATEGORY_OPENABLE)
              type = "image/*"
            }
          fileChooserLauncher.launch(intent)
          true
        } catch (_: Exception) {
          filePathCallback?.onReceiveValue(null)
          filePathCallback = null
          false
        }
      }
    }
    web.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
      }

      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        if (uri.host == "appassets.androidplatform.net") return false
        startActivity(Intent(Intent.ACTION_VIEW, uri))
        return true
      }
    }

    web.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
      val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
      val request = DownloadManager.Request(Uri.parse(url))
        .setMimeType(mimeType)
        .addRequestHeader("User-Agent", userAgent)
        .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
        .setTitle(fileName)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

      (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
    })

    web.loadUrl(BuildConfig.APP_URL)

    updater = UpdateManager(this)
    // The first check runs in onResume, after the activity becomes visible.
  }

  override fun onResume() {
    super.onResume()
    if (::updater.isInitialized) {
      updater.resumePendingUpdate()
      val now = android.os.SystemClock.elapsedRealtime()
      if (isOnline() && (lastUpdateCheckAt == 0L || now - lastUpdateCheckAt > 5 * 60 * 1000L)) {
        lastUpdateCheckAt = now
        updater.checkForUpdate()
      }
    }
  }

  private fun isOnline(): Boolean {
    val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = manager.activeNetwork ?: return false
    val capabilities = manager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (web.canGoBack()) web.goBack() else super.onBackPressed()
  }
}
