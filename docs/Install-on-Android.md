# 📱 Install on Android

The Android app is the whole of Formamorph — play, the [World Editor](WorldEditor), Community Creations — on your phone, with no browser chrome around it.

> 📦 **It is not on the Play Store.** You install the app file yourself, and Android asks you to confirm that once. After the first install, Formamorph updates itself from the main menu.

**You need:** Android 7.0 or newer, and about **90 MB** free for the download.

---

## 📥 Where to get it

| Source | What you get |
|---|---|
| **[formamorph.ai](https://formamorph.ai)** | The **Android** button at the bottom of the page always points at the newest release |
| **[GitHub Releases](https://github.com/JakeJamesDev/formamorph/releases/latest)** | `Formamorph-android.apk` on any release, so you can install a specific version |
| **[itch.io](https://fierylion.itch.io/formamorph)** | The **Android** channel, updated on every major and minor release |

> 💡 Pre-release (beta) builds go to GitHub only. itch.io always carries the latest stable build.

Every release also publishes `Formamorph-android.apk.sha512`, the checksum of the file beside it. You never need it — the in-app updater checks its own downloads — but it is there if you want to verify a manual download yourself.

---

## ✅ The two prompts Android shows you

Android asks permission twice over the life of the app, and the two prompts are for different things. Both are the same setting — **install unknown apps** — granted to a different app.

| Prompt | When it appears | What to do |
|---|---|---|
| 1️⃣ Allow **your browser** to install apps | The first time you open the downloaded file | Grant it to the browser you downloaded with, go back, and tap **Install** again |
| 2️⃣ Allow **Formamorph** to install apps | The first time you install an update from inside the app | Formamorph sends you straight to that setting. Turn it on, come back, and tap **Install** again — the update is still waiting |

Phone makers word the setting differently: *Install unknown apps*, *Allow from this source*, or *Install from unknown sources*. It is the same switch, and it is granted per app, not once for the whole phone.

> ℹ️ Prompt 2 never appears on the first install, because the browser did that one. It waits until your first in-app update.

---

## 🛡️ The Play Protect warning

On the first install, Google Play Protect may warn you that the app comes from a developer it does not recognize, and offer to block it. Continuing is usually behind a **More details** link.

What the warning actually means: Google has not seen this signing key on many devices yet. It is a reputation signal, not a scan result — it is not saying the app is malicious.

Every Formamorph release is signed with the same key, so as the app spreads the warning gets quieter. Updates installed from inside the app are signed with that same key, which is also why Android accepts them as updates instead of demanding you uninstall first.

---

## 🔄 How updates work

Updating on Android works exactly like the desktop app, with one extra tap at the end for Android's own installer.

1. The version number at the bottom of the main menu tags itself **— Update Available!** when a newer release exists. Formamorph checks a few times a day on its own.
2. **Tap the version number** to see what changed, then **Download**. Nothing downloads until you press it, so a 90 MB file never starts on mobile data behind your back. When there is nothing new, that same dialog offers **Check for updates** instead.
3. Progress appears under the version line.
4. When it finishes, an **Install** button replaces the progress bar. Tap it and Android shows its own install sheet to confirm.

**What the app guarantees along the way:**

- 🔐 The download is checked against the checksum published with the release. A file that does not match is thrown away and never reaches the installer.
- 💾 A finished download survives closing the app. Reopen it and you get **Install**, not a second 90 MB download.
- 📴 An update check with no connection fails quietly. It never becomes an error wall.
- 🗂️ Your saves, worlds, and settings survive updates untouched.

### Beta builds

The update dialog has a **Release channel** selector. Set it to **Pre-release** to be offered beta APKs as they are tagged, or leave it on **Stable** for finished releases only.

---

## 📤 Exports open the share sheet

An Android WebView has no download manager, so exporting on the phone opens Android's **share sheet** instead of dropping a file in a Downloads folder. That covers worlds, saves, backups, dictionaries, presets, stat-code packs, character cards, avatars, stories, and AI-context dumps.

Pick where the file goes — Files, Drive, a chat app, anywhere that accepts a file. Dismissing the sheet cancels the export quietly, with no error to clear.

**Importing needs no new steps.** A world, save, character card, or VRM comes in through the normal file picker, the same as on desktop.

---

## 🏠 Pointing the app at a model on your own network

You can play against LM Studio or Ollama running on your own PC, over plain `http://192.168.…`, with no internet at all. Put that address in **Settings → AI Endpoints → Endpoint URL** as you would anywhere else.

This is one thing the app does that the browser will not. Chrome now asks a public web page's permission before it may reach an address on your own network, so the browser build of Formamorph often cannot reach your PC at all. The installed app is not a public web page and meets no such gate.

> 🔒 Community Creations is always reached over https, whatever an endpoint setting says. The app refuses to talk to it in the clear.

---

## 🧭 Also worth knowing

- The **hardware back button** closes whatever is on top — a dialog, then a menu, then a full-screen editor — one layer at a time. With nothing open it asks before leaving a game or closing the app.
- The **local engine and its model catalog** do not appear. Running a model inside the app is a desktop feature, and a phone cannot run one anyway.
- Everything else — the cloud endpoint, Community Creations, the editor — behaves exactly as it does in the browser.
