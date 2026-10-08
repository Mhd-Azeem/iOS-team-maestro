package com.azeem.maestroattendance

import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class UpdateManager(private val context: Context) {
  private val downloads = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private var updateDownloadId: Long = -1L
  private var pendingUrl: String? = null
  private var pendingVersion: String? = null
  private var updatePromptShowing = false

  fun checkForUpdate() {
    thread {
      try {
        val endpoint = "https://api.github.com/repos/${BuildConfig.GITHUB_REPO}/releases/latest"
        val connection = URL(endpoint).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "SchoolAttendanceUpdater/${BuildConfig.VERSION_NAME}")

        if (connection.responseCode != 200) return@thread

        val payload = connection.inputStream.bufferedReader().use { it.readText() }
        val release = JSONObject(payload)
        val latestTag = release.optString("tag_name").removePrefix("v")
        if (!isNewer(latestTag, BuildConfig.VERSION_NAME)) return@thread

        val assets = release.optJSONArray("assets") ?: return@thread
        var apkUrl: String? = null
        for (i in 0 until assets.length()) {
          val asset = assets.getJSONObject(i)
          val name = asset.optString("name")
          if (name.endsWith(".apk", ignoreCase = true)) {
            apkUrl = asset.optString("browser_download_url")
            break
          }
        }
        if (apkUrl.isNullOrBlank() || !apkUrl.startsWith("https://github.com/${BuildConfig.GITHUB_REPO}/releases/download/")) return@thread

        (context as? MainActivity)?.runOnUiThread {
          if (updatePromptShowing || (context as MainActivity).isFinishing) return@runOnUiThread
          updatePromptShowing = true
          AlertDialog.Builder(context)
            .setTitle("Update available")
            .setMessage("Version $latestTag is available. Download and install it now?")
            .setNegativeButton("Later") { _, _ -> updatePromptShowing = false }
            .setPositiveButton("Update") { _, _ -> updatePromptShowing = false; startDownload(apkUrl, latestTag) }
            .setOnCancelListener { updatePromptShowing = false }
            .show()
        }
      } catch (_: Exception) {
        // Update checks must never block normal app use.
      }
    }
  }

  private fun startDownload(url: String, version: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !context.packageManager.canRequestPackageInstalls()
    ) {
      pendingUrl = url
      pendingVersion = version
      Toast.makeText(context, "Allow installs from this app to continue the update.", Toast.LENGTH_LONG).show()
      val intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context.packageName}")
      )
      context.startActivity(intent)
      return
    }

    pendingUrl = null
    pendingVersion = null
    val fileName = "SchoolAttendance-$version.apk"
    val request = DownloadManager.Request(Uri.parse(url))
      .setTitle("School Attendance update")
      .setDescription("Downloading version $version")
      .setMimeType("application/vnd.android.package-archive")
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

    try { updateDownloadId = downloads.enqueue(request) } catch (_: Exception) {
      Toast.makeText(context, "Could not start update download.", Toast.LENGTH_LONG).show()
      return
    }
    registerCompletionReceiver()
    Toast.makeText(context, "Update download started.", Toast.LENGTH_SHORT).show()
  }

  fun resumePendingUpdate() {
    val url = pendingUrl ?: return
    val version = pendingVersion ?: return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
      context.packageManager.canRequestPackageInstalls()
    ) {
      startDownload(url, version)
    }
  }

  private fun registerCompletionReceiver() {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context?, intent: Intent?) {
        if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) != updateDownloadId) return

        try {
          context.unregisterReceiver(this)
        } catch (_: Exception) {}

        val query = DownloadManager.Query().setFilterById(updateDownloadId)
        downloads.query(query)?.use { cursor ->
          if (!cursor.moveToFirst()) return
          val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
          if (status != DownloadManager.STATUS_SUCCESSFUL) {
            Toast.makeText(context, "Update download failed.", Toast.LENGTH_LONG).show()
            return
          }
        }

        val apkUri = downloads.getUriForDownloadedFile(updateDownloadId) ?: return
        val install = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(apkUri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(install)
      }
    }

    val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }
  }

  private fun isNewer(latest: String, current: String): Boolean {
    val a = latest.split(".", "-", "_").mapNotNull { it.toIntOrNull() }
    val b = current.split(".", "-", "_").mapNotNull { it.toIntOrNull() }
    val count = maxOf(a.size, b.size)
    for (i in 0 until count) {
      val av = a.getOrElse(i) { 0 }
      val bv = b.getOrElse(i) { 0 }
      if (av != bv) return av > bv
    }
    return false
  }
}
