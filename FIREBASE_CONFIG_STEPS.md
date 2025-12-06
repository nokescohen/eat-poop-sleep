# How to Find Your Firebase Config

## Step-by-Step Instructions

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/
2. Sign in with your Google account

### Step 2: Select or Create Your Project
- If you already have a project, click on it
- If not, click "Add project" or "Create a project"
  - Enter project name: `eat-poop-sleep` (or any name)
  - Click "Continue"
  - Disable Google Analytics (optional)
  - Click "Create project"

### Step 3: Add a Web App
1. Once in your project, look for the **gear icon (⚙️)** next to "Project Overview" at the top left
2. Click the gear icon → **"Project settings"**
3. Scroll down to the section called **"Your apps"**
4. You should see icons for different platforms:
   - iOS (Apple icon)
   - Android (Android icon)
   - **Web (`</>` icon)** ← Click this one!
5. If you don't see a web app yet:
   - Click the **Web icon (`</>`)** 
   - Register your app with nickname: `EPS Tracker`
   - Click "Register app"

### Step 4: Copy the Config
After registering, you'll see a code block that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**Copy this entire object** - you'll paste it into `index.html`

## Alternative: If You Still Can't Find It

If you're having trouble, try this:

1. In Firebase Console, click on **"Project Overview"** (left sidebar)
2. Look for **"Add an app"** button or the **Web icon (`</>`)** 
3. Click it to add a web app
4. The config will appear after you register

## Still Stuck?

Take a screenshot of what you see in the Firebase console and I can help guide you!



