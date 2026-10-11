package com.azeem.maestroattendance

import org.junit.Assert.assertThrows
import org.junit.Test

class ReportFilePolicyTest {
  @Test fun acceptsSupportedReports() {
    ReportFilePolicy.validate("maestro-attendance.pdf", "application/pdf", 100)
    ReportFilePolicy.validate("maestro-students.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ReportFilePolicy.MAX_BYTES)
  }
  @Test fun rejectsTraversalAndOtherExtensions() {
    for (name in listOf("../report.pdf", "report.html", "folder/report.pdf", "report.pdf.exe", "")) {
      assertThrows(IllegalArgumentException::class.java) { ReportFilePolicy.validate(name, "application/pdf", 100) }
    }
  }
  @Test fun rejectsWrongMimeAndEmptyOrOversizedReports() {
    assertThrows(IllegalArgumentException::class.java) { ReportFilePolicy.validate("report.docx", "application/pdf", 100) }
    for (size in listOf(0, -1, ReportFilePolicy.MAX_BYTES + 1)) {
      assertThrows(IllegalArgumentException::class.java) { ReportFilePolicy.validate("report.pdf", "application/pdf", size) }
    }
  }
}
