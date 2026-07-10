# Team Maestro Exam

A full-screen iOS WKWebView wrapper for [https://exam.riyasict.com](https://exam.riyasict.com).

| | |
|---|---|
| **Bundle ID** | `com.teammaestro.exam` |
| **Minimum iOS** | 14.0 |
| **Language** | Swift 5 |

## Features

- Full-screen `WKWebView` with no navigation bar or UI chrome
- Persistent login session via `WKWebsiteDataStore.default()` + `WKHTTPCookieStore` cookie flush on background
- JavaScript, DOM storage, and inline media enabled
- Swipe-back / forward navigation within the web view
- Last-visited URL restored on relaunch (within the same domain)
- Retry on network failure
- JavaScript alert/confirm/prompt dialogs forwarded to native UI
- `mailto:`, `tel:`, and `facetime:` links open the system app

---

## Building locally

```bash
xcodebuild build \
  -project TeamMaestroExam.xcodeproj \
  -scheme TeamMaestroExam \
  -sdk iphonesimulator \
  -configuration Debug
```

---

## CI/CD — GitHub Actions

The workflow lives at `.github/workflows/release.yml`.

### Triggers

| Trigger | Behavior |
|---|---|
| `push` to tag `v*.*.*` | Build → create GitHub Release with IPA |
| `workflow_dispatch` | Manual run; optionally create a release |

### Manual dispatch inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `release` | boolean | `false` | Publish a GitHub Release |
| `version` | string | `v1.0.0` | Tag name for the release |

### Build modes

The workflow detects signing secrets at runtime:

- **Signed build** — used when all four secrets are present. Produces an ad-hoc IPA installable via TestFlight, Diawi, etc.
- **Unsigned build** — fallback when secrets are absent. Produces a structurally valid IPA useful for testing the CI pipeline or sideloading with tools that re-sign (e.g. AltStore).

---

## Setting up signing secrets (for signed builds)

You need four repository secrets. Go to  
**Settings → Secrets and variables → Actions → New repository secret**  
and add each one below.

---

### 1. `CERTIFICATE_P12_BASE64`

Export your **iOS Distribution** (or **Apple Development**) certificate from Xcode or Keychain Access as a `.p12` file, then base64-encode it:

```bash
# Export from Keychain Access → File → Export Items → save as certificate.p12
base64 -i certificate.p12 | pbcopy   # macOS — paste the result as the secret
```

---

### 2. `CERTIFICATE_PASSWORD`

The password you chose when exporting the `.p12` file. If you left it blank, add an empty secret or the step will still succeed with an empty string.

---

### 3. `PROVISIONING_PROFILE_BASE64`

1. Go to [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles → Profiles.
2. Create an **Ad Hoc** (or **Development**) provisioning profile for Bundle ID `com.teammaestro.exam`.
3. Download the `.mobileprovision` file, then base64-encode it:

```bash
base64 -i TeamMaestroExam_AdHoc.mobileprovision | pbcopy
```

Paste the result as the secret value.

---

### 4. `APPLE_TEAM_ID`

Your 10-character Apple Developer Team ID. Find it at  
[developer.apple.com → Account → Membership details](https://developer.apple.com/account).  
It looks like `ABCDE12345`.

---

### Verifying secrets are working

After adding all four secrets, push a tag to trigger a signed build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Check the Actions tab — the workflow log will print `==> Signed build` if secrets were detected, or `==> Unsigned build` if they were not.

---

## Project structure

```
TeamMaestroExam.xcodeproj/
├── project.pbxproj
└── xcshareddata/xcschemes/TeamMaestroExam.xcscheme

TeamMaestroExam/
├── AppDelegate.swift        — app entry point, scene configuration
├── SceneDelegate.swift      — window setup, resign-active forwarding
├── ViewController.swift     — WKWebView, cookie persistence, navigation
├── Info.plist
├── LaunchScreen.storyboard  — black splash screen
└── Assets.xcassets/
    ├── AppIcon.appiconset/
    └── AccentColor.colorset/

.github/workflows/
└── release.yml              — build & release pipeline
```
