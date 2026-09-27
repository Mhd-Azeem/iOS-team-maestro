plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
  namespace = "com.azeem.schoolattendance"
  compileSdk = 35
  defaultConfig {
    applicationId = "com.azeem.schoolattendance"
    minSdk = 24
    targetSdk = 35
    versionCode = 1
    versionName = "1.0.0"
    buildConfigField("String","APP_URL","\"\${project.findProperty("APP_URL") ?: "https://attendance.example.com"}\"")
    buildConfigField("String","GITHUB_REPO","\"Mhd-Azeem/iOS-team-maestro\"")
  }
  buildFeatures { buildConfig = true }
  buildTypes {
    release {
      isMinifyEnabled = false
      val p = System.getenv("KEYSTORE_FILE")
      if (!p.isNullOrBlank()) signingConfig = signingConfigs.create("release") {
        storeFile = file(p); storePassword = System.getenv("KEYSTORE_PASSWORD"); keyAlias = System.getenv("KEY_ALIAS"); keyPassword = System.getenv("KEY_PASSWORD")
      }
    }
  }
}
dependencies { implementation("androidx.core:core-ktx:1.15.0"); implementation("androidx.appcompat:appcompat:1.7.0"); implementation("com.google.android.material:material:1.12.0"); implementation("androidx.webkit:webkit:1.12.1") }
