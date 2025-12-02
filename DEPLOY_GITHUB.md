# Deploy to GitHub Pages (Free)

This guide will help you deploy your app to GitHub Pages so it's accessible 24/7, even when your Mac is closed.

## Step 1: Prepare Your Files

Make sure you have the icon files:
1. Open `create-icons.html` in your browser
2. Download both `icon-192.png` and `icon-512.png`
3. Save them in the project folder

## Step 2: Push to GitHub

If you haven't already, commit and push all your files:

```bash
# Add all files
git add .

# Commit changes
git commit -m "Add PWA support and prepare for GitHub Pages"

# Push to GitHub
git push origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/ (root)` or `/docs` if you want to use a docs folder
5. Click **Save**

## Step 4: Access Your Site

GitHub will provide you with a URL like:
- `https://YOUR_USERNAME.github.io/eat-poop-sleep/`

**Note:** If your repo is named `eat-poop-sleep`, the URL will be:
- `https://YOUR_USERNAME.github.io/eat-poop-sleep/`

It may take a few minutes for the site to be available after enabling Pages.

## Step 5: Update Service Worker (if needed)

The service worker should work automatically, but if your repo name is not the root, you may need to update paths. The current setup should work for most cases.

## Step 6: Custom Domain (Optional)

1. In your repo Settings > Pages
2. Enter your custom domain
3. Follow GitHub's instructions to configure DNS

## Updating Your App

Just push changes to GitHub:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

GitHub Pages will automatically rebuild (usually within 1-2 minutes).

## Update Mobile Devices

1. Uninstall the old version (if installed)
2. Visit your new GitHub Pages URL
3. Re-add to home screen

## Troubleshooting

**404 Error?**
- Make sure GitHub Pages is enabled in Settings
- Wait a few minutes for the first deployment
- Check that `index.html` is in the root of your repo

**Service Worker not working?**
- GitHub Pages uses HTTPS, so service workers work fine
- Clear browser cache if needed

**Icons not showing?**
- Make sure `icon-192.png` and `icon-512.png` are committed to the repo
- Check that they're in the root folder

**App not updating?**
- GitHub Pages can take 1-2 minutes to rebuild
- Clear browser cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

## Benefits of GitHub Pages

✅ **Free** - No cost
✅ **HTTPS** - Secure by default
✅ **Automatic** - Updates when you push to GitHub
✅ **Reliable** - Hosted by GitHub
✅ **Custom Domain** - Support for your own domain

## Backend Service (Email)

The backend service (`backend.py`) for sending emails still needs to run separately. Options:

1. **Run on a VPS** (DigitalOcean, Linode, etc.) - ~$5/month
2. **Use GitHub Actions** - Free scheduled tasks (can trigger email sending)
3. **Use a serverless function** - AWS Lambda, Vercel Functions, etc.
4. **Use a scheduled service** - cron-job.org, etc.

Would you like me to help set up the email backend using GitHub Actions or another service?

