# Firebase Setup Guide

This app now uses Firebase Firestore for cloud storage, so your data syncs across all devices (iPhone, iPad, Mac, etc.) in real-time!

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `eat-poop-sleep` (or any name you prefer)
4. Disable Google Analytics (optional, not needed)
5. Click **"Create project"**

## Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Select **"Start in test mode"** (for now - we'll secure it later)
4. Choose a location (closest to you)
5. Click **"Enable"**

## Step 3: Get Your Firebase Config

1. In Firebase console, click the gear icon ⚙️ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>`
5. Register app with nickname: `EPS Tracker`
6. Copy the `firebaseConfig` object

## Step 4: Add Config to Your App

1. Open `index.html`
2. Find the `firebaseConfig` object (around line 30)
3. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...", // Your actual API key
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 5: Set Up Firestore Security Rules

1. In Firebase console, go to **Firestore Database** → **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      // Allow read/write for now (we'll secure this later)
      allow read, write: if true;
    }
  }
}
```

3. Click **"Publish"**

**Note:** For production, you should add authentication. For now, this allows anyone with your config to read/write. Since your config is in the frontend code, consider adding authentication later.

## Step 6: Test It!

1. Save your changes
2. Push to GitHub: `git push origin main`
3. Visit your GitHub Pages site
4. Add an event - it should save to Firebase
5. Open the app on another device - you should see the same data!

## Step 7: (Optional) Add Authentication

For better security, you can add Firebase Authentication:

1. In Firebase console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** or **Anonymous**
3. Update the app to require authentication before accessing data

## Troubleshooting

**"Firebase not available" error?**
- Check that you've added your Firebase config to `index.html`
- Make sure Firestore is enabled in your Firebase project
- Check browser console for specific errors

**Data not syncing?**
- Check Firestore rules allow read/write
- Verify your Firebase config is correct
- Check browser console for errors

**Still using localStorage?**
- The app falls back to localStorage if Firebase isn't configured
- Check browser console - it will warn if Firebase isn't available

## Benefits

✅ **Real-time sync** - Changes appear instantly on all devices
✅ **Cloud storage** - Data stored in Firebase, not just on device
✅ **Works offline** - Firebase caches data locally
✅ **No backend needed** - Everything runs client-side
✅ **Free tier** - Generous free limits (50K reads/day, 20K writes/day)

## Migration from localStorage

If you have existing data in localStorage:
1. Use the **"Export Data"** button to download your data
2. After setting up Firebase, use **"Import Data"** to upload it
3. Your data will now sync across all devices!

