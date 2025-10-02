# Stream Deck Scripts for Discord Stream Switcher

Server endpoint default: http://localhost:3333

## Files

- switch_1.bat .. switch_9.bat → POST /api/streams/switch-by-index/0..8
- swap_1.bat .. swap_9.bat → POST /api/streams/swap-by-index/0..8
- next.bat / previous.bat / refresh.bat
- focus_grid.ps1 + focus_grid.bat → focus the GRID tile (always last) by discovering its index dynamically
- swap_current.ps1 + swap_current.bat → swap main ↔ webcam for the currently focused tile

## How to use with Elgato Stream Deck

1. Add an **Open** action (System → Open).
2. Set **Application** to the desired `.bat`, e.g. `switch_1.bat` (maps to Alt+F1 behavior).
3. Repeat for other buttons.
4. For dynamic actions, use `focus_grid.bat` or `swap_current.bat`.

Notes:
- Windows 10+ has `curl` built-in. If not, install curl or replace with PowerShell `Invoke-RestMethod` in the BAT.
- Ensure the local controller is running at http://localhost:3333.
