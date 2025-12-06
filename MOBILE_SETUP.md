# Mobile Access Setup

This app is now a Progressive Web App (PWA) that can be installed on your phone and iPad!

## Quick Setup

### Step 1: Create Icons (if not already created)

Open `create-icons.html` in your browser and download both icon files:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

Save them in the same folder as `index.html`.

### Step 2: Access on Your Devices

#### On iPhone/iPad (Safari):

1. Open Safari on your device
2. Navigate to: `http://YOUR_MAC_IP:8000` (e.g., `http://192.168.0.12:8000`)
3. Tap the **Share** button (square with arrow)
4. Scroll down and tap **"Add to Home Screen"**
5. Name it "EPS Tracker" (or whatever you prefer)
6. Tap **"Add"**

The app will now appear on your home screen like a native app!

#### On Android (Chrome):

1. Open Chrome on your device
2. Navigate to: `http://YOUR_MAC_IP:8000`
3. Tap the **menu** (three dots)
4. Tap **"Add to Home screen"** or **"Install app"**
5. Tap **"Install"**

### Step 3: Features

Once installed:
- ✅ Works offline (cached for offline use)
- ✅ Appears as a standalone app (no browser UI)
- ✅ Fast loading (cached resources)
- ✅ Full screen experience
- ✅ All data stored locally on your device

## Finding Your Mac's IP Address

If you need to find your Mac's IP address again:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Or check System Preferences > Network

## Troubleshooting

**Icons not showing?**
- Make sure `icon-192.png` and `icon-512.png` exist in the same folder
- Clear browser cache and try again

**App not installing?**
- Make sure you're accessing via `http://` (not `file://`)
- The server must be running on your Mac
- Try accessing from the same Wi-Fi network

**Service worker not working?**
- Check browser console for errors
- Make sure you're using HTTPS or localhost (some browsers require this)
- Try clearing site data and reloading

## Keeping the Server Running

To keep the app accessible, the server needs to stay running. Options:

1. **Keep terminal open** - Simplest, but stops if you close terminal
2. **Use screen/tmux** - Run in background session
3. **Create a launchd service** - Runs automatically on Mac startup

For production, consider deploying to a cloud service like:
- Netlify (free)
- Vercel (free)
- GitHub Pages (free)



