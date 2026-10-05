# 📱 Install on Android
<!-- keywords: system requirements, minimum os version, storage space needed, google play listing, megabytes, handheld -->

The Android app is the whole of Formamorph on your device: play, the [World Editor](WorldEditor), Community Creations. No browser bar sits around it.

> 📦 **It is not on the Play Store.** You install the app file yourself, and Android asks you to confirm that once. After the first install, Formamorph updates itself from the main menu.

**You need:** Android 7.0 or newer, and about **90 MB** free for the download.

## How to Install on Android
<!-- keywords: phone, mobile, apk, download, app, tablet, sideload, play store, smartphone, samsung, installer file, unknown sources, first time setup, google pixel, get the game -->

1. On your device, open [formamorph.ai](https://formamorph.ai) and tap the **Android** button at the bottom of the page.
2. Open the downloaded file.
3. If Android asks, allow **your browser** to install apps.
4. Go back and tap **Install** again.
5. If Google Play Protect warns you, open **More details**. See [The Play Protect Warning](#%EF%B8%8F-the-play-protect-warning).
6. Continue the install from there.
7. Open Formamorph.

## How to Update the App
<!-- keywords: new version, upgrade, latest, phone, apk, mobile, out of date, outdated, patch, auto update, newer release, get newest build -->
<!-- route: mainMenu#app-version -->

1. On the main menu, look at the version number at the bottom. It reads **— Update Available!** when a newer release exists.
2. Tap the version number. The update dialog opens.
3. Tap **Download**. Progress shows under the version line.
4. When it finishes, tap **Install**.
5. The first time, Android asks you to allow **Formamorph** to install apps. Turn it on.
6. Come back to Formamorph.
7. Tap **Install** again.
8. Confirm in Android's install sheet.

## How to Get Beta Builds
<!-- keywords: pre-release, prerelease, test version, early access, channel, nightly, preview version, experimental, unstable, opt in, insider, upcoming features, back to stable -->
<!-- route: mainMenu#app-version -->

1. Tap the version number on the main menu.
2. Set **Release channel** to **Pre-release**.

Set it back to **Stable** for finished releases only.

## How to Save an Export to a Folder
<!-- keywords: downloads, file, phone, storage, location, where did it go, missing exported world, choose directory, sd card, files app, save as picker, destination -->

1. Export as you would on desktop. Android's **Save As** picker opens.
2. Choose a folder, such as **Downloads**.
3. Check the filename.
4. Tap **Save**.

## How to Use a Model on Your PC
<!-- keywords: phone, mobile, local, network, wifi, lm studio, ollama, computer, connect, desktop gpu, home rig, 192.168, self hosted, lan address, stream from desktop -->
<!-- route: settingsEndpoints.text#endpoint-url -->

1. On your PC, make LM Studio or Ollama accept connections from your network. See [Connect Your Own AI](Connect-Your-Own-AI#how-to-play-against-your-pc-from-another-device).
2. In the app, open Settings → **Endpoints** → **Text**.
3. Type your PC's address into **Endpoint URL**, such as `http://192.168.…:1234`.

---

## 📥 Where to Get It
<!-- keywords: download link, official source, older version, verify file, hash, mirror, direct apk -->

| Source | What you get |
|---|---|
| **[formamorph.ai](https://formamorph.ai)** | The **Android** button at the bottom of the page always links the newest release |
| **[GitHub Releases](https://github.com/JakeJamesDev/formamorph/releases/latest)** | `Formamorph-android.apk` on any release, so you can install a specific version |
| **[itch.io](https://fierylion.itch.io/formamorph)** | The **Android** channel, updated on every major and minor release |

> 💡 Pre-release (beta) builds go to GitHub only. itch.io always has the latest stable build.

Every release also publishes `Formamorph-android.apk.sha512`, the checksum of the file beside it. The in-app updater checks its own downloads, so you never need it. Use it to check a manual download yourself.

## ✅ The Two Prompts Android Shows You
<!-- keywords: permission popup, blocked install, security setting, not allowed, grant access, untrusted source, chrome permission -->

Android asks permission twice over the life of the app, for two different apps. Both are the same setting, **install unknown apps**.

| Prompt | When it appears | What to do |
|---|---|---|
| 1️⃣ Allow **your browser** to install apps | The first time you open the downloaded file | Grant it to the browser you downloaded with, go back, and tap **Install** again |
| 2️⃣ Allow **Formamorph** to install apps | The first time you install an update from inside the app | Formamorph opens that setting. Turn it on, come back, and tap **Install** again. The update is still waiting. |

Device makers word the setting differently: *Install unknown apps*, *Allow from this source*, or *Install from unknown sources*. It is the same switch, and you grant it per app, not once for the whole device.

> ℹ️ Prompt 2 never appears on the first install, because the browser did that one. It waits until your first in-app update.

## 🛡️ The Play Protect Warning
<!-- keywords: virus, malware, is it safe, harmful app, blocked by google, unknown developer, security alert -->

On the first install, Google Play Protect may warn you that the app comes from a developer it does not recognize, and offer to block it. To continue, open **More details**.

The warning means Google has not seen this signing key on many devices yet. It is a reputation signal, not a scan result. It does not say the app is malicious.

Every Formamorph release is signed with the same key, so the warning gets quieter as the app spreads. Updates from inside the app use that same key, so Android accepts them as updates and does not ask you to uninstall first.

## 🔄 How Updates Work
<!-- keywords: automatic check, mobile data usage, cellular, lose progress, corrupt download, resume download, how often -->

Updating on Android works like the desktop app, with one extra tap at the end for Android's own installer.

| Step | What happens |
|---|---|
| Check | Formamorph checks a few times a day on its own. The version line tags itself **— Update Available!** |
| Dialog | Tap the version number to see what changed. With nothing new, the dialog offers **Check for updates** instead of **Download**. |
| Download | Nothing downloads until you tap **Download**, so a 90 MB file never starts on mobile data without you. |
| Install | An **Install** button replaces the progress bar. Android shows its own install sheet. |

**What the app makes sure of:**

- 🔐 The download is checked against the checksum published with the release. A file that does not match is erased and never reaches the installer.
- 💾 A finished download survives closing the app. Reopen it and you get **Install**, not a second 90 MB download.
- 📴 An update check with no connection fails quietly. It never shows an error.
- 🗂️ Your saves, worlds, and settings survive updates.

### Beta Builds

The update dialog has a **Release channel** selector. Set it to **Pre-release** to get beta APKs as they come out, or leave it on **Stable** for finished releases only.

## 📤 Save Exports to a Folder
<!-- keywords: file picker, canceled export, nothing happened, documents directory, internal memory -->

Exporting on Android opens Android's **Save As** picker. That covers worlds, saves, backups, dictionaries, presets, stat-code packs, entity cards, avatars, stories, and AI-context dumps.

The file stays in the folder you choose. Canceling the picker leaves without saving or showing an error.

**Importing needs no new steps.** A world, save, entity card, or VRM comes in through the normal file picker, the same as on desktop.

## 🏠 A Model on Your Own Network
<!-- keywords: private network access, mixed content, plain http, chrome blocks, browser fails to reach, airplane mode, insecure connection -->

You can play against LM Studio or Ollama on your own PC, over plain `http://192.168.…`, with no internet at all. Put that address in Settings → **Endpoints** → **Text** → **Endpoint URL**, as you would anywhere else.

The browser often can't do this. Chrome asks a public web page's permission before it reaches an address on your own network, so the browser build of Formamorph often cannot reach your PC. The installed app is not a public web page, so no such check applies.

> 🔒 Community Creations always uses https, whatever an endpoint setting says. The app refuses to send to it unencrypted.

## ⬅️ The Back Button
<!-- keywords: swipe gesture, exit app, quit, navigation key, accidentally closed, hardware key, close popup -->
<!-- route: exitApp -->

The hardware **back** button closes what is on top, one layer at a time: a dialog, then a menu, then a full-screen editor.

| With nothing open | What back does |
|---|---|
| During a game | Asks **Exit to Main Menu**. Unsaved progress is lost. |
| On the main menu | Opens **Close Formamorph**. **Confirm** closes the app, and **Cancel** keeps it open. Unsaved progress is lost. |

## 🧭 Also Worth Knowing
<!-- keywords: missing features, differences from desktop, on-device llm, limitations, run model on handset, what is unsupported -->

- The **Built-In Engine** and its model list do not appear. Running a model inside the app is a desktop feature.
- Everything else, including the Demo AI, Community Creations and the editor, works as it does in the browser.
