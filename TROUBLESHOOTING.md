# Troubleshooting "Site Not Found"

## Step 1: Enable GitHub Pages

1. Go to: **https://github.com/nokescohen/eat-poop-sleep/settings/pages**
2. Under **"Source"**:
   - Select **Branch: `main`**
   - Select **Folder: `/ (root)`**
3. Click **"Save"**
4. Wait 1-2 minutes for GitHub to build your site

## Step 2: Check Your URL

Your site should be available at:
**https://nokescohen.github.io/eat-poop-sleep/**

**Important:** 
- The URL is case-sensitive
- Make sure you're using `https://` (not `http://`)
- Include the trailing `/` at the end

## Step 3: Verify Files Are Pushed

Make sure all files are committed and pushed:

```bash
git status
git push origin main
```

## Step 4: Check GitHub Pages Status

1. Go to: **https://github.com/nokescohen/eat-poop-sleep/actions**
2. Look for any failed builds or errors

## Step 5: Common Issues

### "404 - File not found"
- **Solution:** Make sure `index.html` is in the root of your repository
- **Check:** Go to https://github.com/nokescohen/eat-poop-sleep and verify `index.html` is visible

### "Page build failed"
- **Solution:** Check the Actions tab for error messages
- **Common cause:** Missing files or syntax errors

### "Site not found" after enabling
- **Solution:** Wait 2-5 minutes for GitHub to build
- **Check:** Refresh the page after a few minutes

### Repository is private
- **Solution:** GitHub Pages only works with public repositories (free tier)
- **Option:** Make repo public, or upgrade to GitHub Pro

## Step 6: Test Locally First

Before deploying, test locally:

```bash
python3 -m http.server 8000
```

Then visit: http://localhost:8000

If it works locally but not on GitHub Pages, there's likely a configuration issue.

## Still Not Working?

1. Check the repository settings: https://github.com/nokescohen/eat-poop-sleep/settings
2. Verify the repository is public (or you have GitHub Pro)
3. Check GitHub status: https://www.githubstatus.com/
4. Try accessing: https://nokescohen.github.io/eat-poop-sleep/index.html (with explicit filename)

