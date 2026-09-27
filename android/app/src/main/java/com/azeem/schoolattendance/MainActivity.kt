package com.azeem.schoolattendance
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
class MainActivity:AppCompatActivity(){
  private lateinit var web:WebView
  override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);web=WebView(this);setContentView(web);web.settings.javaScriptEnabled=true;web.settings.domStorageEnabled=true;CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);web.webChromeClient=WebChromeClient();web.webViewClient=object:WebViewClient(){override fun shouldOverrideUrlLoading(view:WebView?,request:WebResourceRequest?):Boolean{val uri=request?.url?:return false;if(uri.host==Uri.parse(BuildConfig.APP_URL).host)return false;startActivity(Intent(Intent.ACTION_VIEW,uri));return true}};web.setDownloadListener(DownloadListener{url,ua,cd,mime,_->val name=URLUtil.guessFileName(url,cd,mime);val r=DownloadManager.Request(Uri.parse(url));r.setMimeType(mime);r.addRequestHeader("User-Agent",ua);r.addRequestHeader("Cookie",CookieManager.getInstance().getCookie(url));r.setTitle(name);r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);(getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(r)});if(online())web.loadUrl(BuildConfig.APP_URL)else web.loadData("<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>No internet connection</h2></body></html>","text/html","UTF-8")}
  private fun online():Boolean{val c=getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager;val n=c.activeNetwork?:return false;return c.getNetworkCapabilities(n)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)==true}
  @Deprecated("Deprecated in Java") override fun onBackPressed(){if(web.canGoBack())web.goBack()else super.onBackPressed()}
}
