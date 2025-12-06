# GitHub Storage Setup

This app can use GitHub Gists to store your data in the cloud, syncing across all devices!

## Why GitHub Gists?

✅ **Free** - No cost
✅ **Private by default** - Your data is private
✅ **Simple API** - Easy to use
✅ **Version history** - GitHub tracks all changes
✅ **No external services** - Everything in GitHub

## Step 1: Create a GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `EPS Tracker`
4. Select scopes:
   - ✅ `gist` (full control)
5. Click **"Generate token"**
6. **Copy the token immediately** - you won't see it again!

## Step 2: Configure the App

1. Open `index.html`
2. Find the GitHub configuration section
3. Enter your GitHub username and the token you just created

## Step 3: Create Your First Gist

The app will automatically create a Gist on first use. You can also create it manually:

1. Go to: https://gist.github.com/
2. Create a new secret gist
3. Name the file: `eps-events.json`
4. Add empty content: `[]`
5. Click **"Create secret gist"**
6. Copy the Gist ID from the URL (the long hash)

## How It Works

- Data is stored in a GitHub Gist (private by default)
- The app polls for updates every few seconds
- Changes sync across all devices
- All data is versioned by GitHub

## Security

- Your token is stored in localStorage (only on your device)
- The Gist is private (only you can access it)
- Consider using a token with limited scope

## Limitations

- Not real-time (polls every 3-5 seconds)
- GitHub API rate limits: 5,000 requests/hour (plenty for this app)
- Requires internet connection



