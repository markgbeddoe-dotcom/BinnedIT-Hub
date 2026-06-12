# SkipSync Android APK (Trusted Web Activity)

SkipSync is a web app; the Android app is a thin **TWA** wrapper around the live
PWA at `https://binnedit-hub.vercel.app`. It shows the real app full-screen, with
its own icon, and auto-updates whenever the web app deploys (no app-store
resubmission needed for content changes).

## Fastest way to test on your phone TODAY (no build, no sideload)
1. Open **Chrome on Android** → `https://binnedit-hub.vercel.app`
2. Menu (⋮) → **Add to Home screen** → **Install**
3. It installs as a standalone full-screen app — identical to what the APK wraps.
   (Drivers can install the driver-scoped version the same way from `/driver`.)

This is the recommended test path. The signed APK below is only needed for
sideloading to non-Chrome devices or eventual Play Store distribution.

## Build a signed APK (run in a REAL terminal — bubblewrap's prompts need a TTY)
Prereqs: Node 18+, and a JDK (bubblewrap installs its own if you let it).

```bash
cd android-apk
npm install -g @bubblewrap/cli

# 1. Scaffold the Android project from the live PWA manifest (interactive —
#    accept defaults; package id au.com.binnedit.skipsync; create a signing key
#    when asked, or point it at an existing keystore).
bubblewrap init --manifest https://binnedit-hub.vercel.app/manifest.json

# 2. Build + sign
bubblewrap build

# Output: app-release-signed.apk  → copy to phone, enable "install unknown apps",
# tap to install.
```

`twa-manifest.json` in this folder is a ready-made config (package id, brand
colours #EFDF0F / #000006, portrait, icon URLs) — if `init` asks, point it at
this file or copy the values.

## Play Store (later)
- Build an **.aab** instead: `bubblewrap build` produces `app-release-bundle.aab`.
- Add **Digital Asset Links** so the URL bar is hidden: host
  `/.well-known/assetlinks.json` with the APK's SHA-256 signing fingerprint
  (bubblewrap prints it; `keytool -list -v -keystore <ks>` also shows it).
  Without this the app works but shows a Chrome address bar.

## Notes
- The signing keystore is a **secret** — it is NOT committed. Keep it safe;
  losing it means you can't ship updates under the same app identity.
- Brand/version live in `twa-manifest.json` (`appVersionCode`/`appVersionName`).
