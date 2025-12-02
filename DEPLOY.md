# Deploy to Netlify (Free Cloud Hosting)

This guide will help you deploy your app to Netlify so it's accessible 24/7, even when your Mac is closed.

## Option 1: Deploy via Netlify Website (Easiest)

### Step 1: Prepare Your Files

First, make sure you have the icon files. If you don't have them yet:
1. Open `create-icons.html` in your browser
2. Download both `icon-192.png` and `icon-512.png`
3. Save them in the project folder

### Step 2: Create a Netlify Account

1. Go to https://www.netlify.com/
2. Click "Sign up" (it's free!)
3. Sign up with GitHub, Email, or Google

### Step 3: Deploy Your Site

**Method A: Drag and Drop (Fastest)**
1. Log into Netlify
2. Go to your dashboard
3. Drag and drop your entire project folder onto the Netlify dashboard
4. Wait for deployment (usually 30 seconds)
5. Your site will be live at a URL like: `https://random-name-12345.netlify.app`

**Method B: Connect to GitHub (Recommended for updates)**
1. Push your code to GitHub (if not already there):
   ```bash
   git add .
   git commit -m "Add PWA support and Netlify config"
   git push origin main
   ```

2. In Netlify dashboard:
   - Click "Add new site" > "Import an existing project"
   - Choose "GitHub"
   - Authorize Netlify to access your GitHub
   - Select your repository
   - Click "Deploy site"

3. Netlify will automatically deploy and give you a URL

### Step 4: Customize Your Domain (Optional)

1. In Netlify dashboard, go to your site
2. Click "Domain settings"
3. Click "Add custom domain"
4. You can use a free subdomain like: `your-app-name.netlify.app`
5. Or connect your own domain if you have one

## Option 2: Deploy via Netlify CLI

If you prefer command line:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

## After Deployment

1. **Update your mobile devices:**
   - Uninstall the old version (if installed)
   - Visit your new Netlify URL
   - Re-add to home screen

2. **Your app is now:**
   - ✅ Accessible 24/7 from anywhere
   - ✅ Works even when your Mac is closed
   - ✅ Has a permanent URL
   - ✅ Automatically updates when you push to GitHub (if using GitHub method)

## Updating Your App

**If using GitHub:**
- Just push changes: `git push origin main`
- Netlify automatically redeploys

**If using drag-and-drop:**
- Drag and drop the updated folder again
- Or use Netlify CLI: `netlify deploy --prod`

## Backend Service (Email)

The backend service (`backend.py`) for sending emails still needs to run separately. Options:

1. **Run on a VPS** (DigitalOcean, Linode, etc.) - ~$5/month
2. **Use a serverless function** - Netlify Functions (free tier available)
3. **Use a scheduled service** - GitHub Actions, cron-job.org, etc.

Would you like me to help set up the email backend as a Netlify Function?

## Troubleshooting

**Service worker not working?**
- Make sure you're accessing via HTTPS (Netlify provides this automatically)
- Clear browser cache

**Icons not showing?**
- Make sure `icon-192.png` and `icon-512.png` are in the root folder
- Check browser console for 404 errors

**App not updating?**
- Clear browser cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

