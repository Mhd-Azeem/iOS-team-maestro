package com.azeem.maestroattendance

object ReportFilePolicy {
  const val MAX_BYTES = 12 * 1024 * 1024
  const val MAX_BASE64_CHARS = 16 * 1024 * 1024
  fun validate(fileName: String, mimeType: String, byteCount: Int) {
    require(fileName.length <= 120 && Regex("^[A-Za-z0-9._-]+\\.(pdf|docx)$", RegexOption.IGNORE_CASE).matches(fileName)) { "Invalid report filename" }
    val expectedMime = if (fileName.endsWith(".pdf", true)) "application/pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    require(mimeType == expectedMime) { "Unsupported or mismatched report format" }
    require(byteCount > 0 && byteCount <= MAX_BYTES) { "Report must contain data and be at most 12 MB" }
  }
}
