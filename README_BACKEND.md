# Backend Service Setup

This backend service automatically sends daily email summaries at 23:59 each day.

## Setup Instructions

### 1. Install Dependencies

```bash
pip3 install -r requirements.txt
```

### 2. Configure Email

You need to set up email credentials. For Gmail:

1. Enable 2-factor authentication on your Gmail account
2. Generate an "App Password": https://myaccount.google.com/apppasswords
3. Set environment variables:

```bash
export SENDER_EMAIL="your-email@gmail.com"
export SENDER_PASSWORD="your-app-password"
```

Or edit `backend.py` and update the `EMAIL_CONFIG` dictionary directly.

### 3. Run the Backend

```bash
python3 backend.py
```

The service will:
- Start on http://localhost:5000
- Automatically send daily summaries at 23:59
- Provide endpoints for testing and manual sending

### 4. Test Email

Send a test email immediately:

```bash
curl -X POST http://localhost:5000/test-email
```

Or use the frontend to call this endpoint.

### 5. Keep Running (Production)

For production, you'll want to run this as a service. Options:

**Option A: Using systemd (Linux/Mac with launchd)**
- Create a systemd service file or launchd plist
- Run in background

**Option B: Using screen/tmux**
```bash
screen -S eps-backend
python3 backend.py
# Press Ctrl+A then D to detach
```

**Option C: Using nohup**
```bash
nohup python3 backend.py > backend.log 2>&1 &
```

## Endpoints

- `POST /test-email` - Send a test email immediately
- `POST /send-summary` - Manually send today's summary
- `POST /save-events` - Save events from frontend (for syncing)
- `GET /health` - Health check

## Frontend Integration

The frontend can optionally sync events to the backend by calling `/save-events` with the events data. This allows the backend to access events even when the browser is closed.



