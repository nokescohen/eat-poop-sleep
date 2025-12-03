# Email Setup Guide

Daily summary emails are sent automatically at 23:59 each day via GitHub Actions.

## Quick Test

Click the **"Send Test Email"** button in the app to see what the email will look like. It will copy the summary to your clipboard.

## Automated Daily Emails

Emails are sent automatically via GitHub Actions workflow. To set this up:

### Step 1: Get Firebase Service Account Key

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `eat-poop-sleep`
3. Click the gear icon → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file

### Step 2: Set Up Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Go to **Security** → **2-Step Verification** (enable if not already)
3. Go to **App passwords**
4. Create a new app password for "Mail"
5. Copy the 16-character password

### Step 3: Add GitHub Secrets

1. Go to your repository: https://github.com/nokescohen/eat-poop-sleep/settings/secrets/actions
2. Click **New repository secret**
3. Add these secrets:

   - **FIREBASE_PROJECT_ID**: `eat-poop-sleep`
   - **FIREBASE_PRIVATE_KEY**: From the JSON file, copy the `private_key` value (keep the `\n` characters)
   - **FIREBASE_CLIENT_EMAIL**: From the JSON file, copy the `client_email` value
   - **SENDER_EMAIL**: Your Gmail address (e.g., `your-email@gmail.com`)
   - **SENDER_PASSWORD**: The 16-character app password from Step 2

### Step 4: Test the Workflow

1. Go to **Actions** tab in your GitHub repo
2. Click **Send Daily Summary Email** workflow
3. Click **Run workflow** → **Run workflow** (manual trigger)
4. Check if it runs successfully

### Step 5: Verify Schedule

The workflow runs daily at **23:59 UTC**. To adjust the timezone:
- Edit `.github/workflows/daily-email.yml`
- Change the cron schedule (e.g., `'59 23 * * *'` for 23:59 UTC)
- For EST: `'59 3 * * *'` (23:59 EST = 03:59 UTC next day)
- For EDT: `'59 2 * * *'` (23:59 EDT = 02:59 UTC next day)

## Email Recipients

Emails are sent to:
- anokheecohen@gmail.com
- ben@cohen-family.org

To change recipients, edit `.github/scripts/send_daily_email.py` or the `RECIPIENT_EMAILS` environment variable in the workflow.

## Troubleshooting

**Workflow fails?**
- Check the Actions tab for error messages
- Verify all secrets are set correctly
- Make sure Firebase service account has Firestore read permissions

**No emails received?**
- Check spam folder
- Verify sender email and password are correct
- Check workflow logs in Actions tab

**Want to test immediately?**
- Use the "Send Test Email" button in the app
- Or manually trigger the workflow in Actions tab

