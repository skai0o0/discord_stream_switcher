# 📖 Discord Stream Switcher Dashboard

## Introduction

**Discord Stream Switcher Dashboard** is a tool for managing and switching between multiple streams (multistream) in Discord voice channels. This application helps you:

- Fetch the list of all active streams.
- Ensure the **Grid stream** is always placed at the end of the list with a distinct badge.
- Quickly switch between streams using **hotkeys Alt + F1..F9** or via the web interface.
- Support **swap** (quick switch between main screen ↔ PiP webcam).
- Connect to **Stream Deck** (physical or virtual) through `.bat` scripts.

---

## System Requirements

- Windows 10/11
- [Node.js LTS (>=18)](https://nodejs.org/en/download)
- **Chromium-based browser** (Chrome or Edge)
- Discord Desktop App

---

## Installation Guide

### Step 1. Clone the project

```bash
git clone (https://github.com/skai0o0/discord_stream_switcher.git)
cd discord-web-app
```

### Step 2. One-click Setup

The project includes a ready-to-use script:

- `setup_oneclick_v3.bat` (one-click run on Windows)

The script will:

1. Launch Discord in **debug mode** on port `9222`.
2. Check Node.js/npm (suggest installation if not found).
3. Install dependencies (only on the first run; subsequent runs will **skip** if `node_modules` already exists).
4. Open `http://localhost:3333` in the default browser.
5. Print detailed instructions in the terminal.
6. Start the Node server (`npm start` or `node server.js`).

---

## Usage Guide

### 1. Preparation

- Launch Discord in debug mode:

```powershell
%LocalAppData%\Discord\Update.exe --processStart Discord.exe --process-start-args="--remote-debugging-port=9222"
```

### 2. Remote Inspect

- Open **Chrome**: `chrome://inspect/#devices`
- Or **Edge**: `edge://inspect/#devices`
- Click **Configure…** → add `localhost:9222`
- Wait ~1 minute → Discord tabs will appear → choose **Inspect** for the tab that has joined the voice channel

### 3. Inject Script

- In the DevTools tab (Discord): go to **Console**
- Visit `http://localhost:3333` → section **Copy Script** → click **Copy Main Script**
- Paste into Console → press Enter

### 4. Stream Management

- The web interface displays the list of streams:
  - **GRID badge**: always at the bottom.
  - `F1..F9` badges: hotkeys.
  - Actions: **Focus** (switch), **Swap** (local only).
- Logs show stream switching status.

### 5. Hotkeys

- `Alt + F1..F9` → Switch directly to stream
- `Alt + ← / →` → Next / Previous
- `Alt + S` → Swap between main ↔ PiP (if available)

### 6. Stream Deck (optional)

- The `stream_deck_scripts` folder contains `.bat` & `.ps1` files
- Assign them to Stream Deck buttons for direct control (switch, next, prev, swap, focus grid).

---

## Notes

- If no Chromium browser is detected → install Chrome or Edge.
- If Node.js is not installed → the script will suggest installing via `winget` or open the Node.js website.
- To reset dependencies → delete the `node_modules` folder and rerun the script.

---

## License

MIT © 2025
