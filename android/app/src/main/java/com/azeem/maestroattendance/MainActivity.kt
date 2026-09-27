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
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
  private lateinit var web: WebView
  private lateinit var updater: UpdateManager

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    web = WebView(this)
    setContentView(web)

    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.settings.databaseEnabled = true
    web.settings.setSupportZoom(false)

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

    web.webChromeClient = WebChromeClient()
    web.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        val appUri = Uri.parse(BuildConfig.APP_URL)
        if (uri.host == appUri.host && uri.path?.startsWith("/iOS-team-maestro") == true) return false
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

    if (isOnline()) {
      web.loadUrl(BuildConfig.APP_URL)
    } else {
      web.loadData(
        "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>No internet connection</h2><p>Please reconnect and reopen the app.</p></body></html>",
        "text/html",
        "UTF-8"
      )
    }

    updater = UpdateManager(this)
    updater.checkForUpdate()
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
