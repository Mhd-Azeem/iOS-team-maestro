package com.azeem.maestroattendance

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ValueCallback
import android.webkit.WebView
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
