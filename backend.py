#!/usr/bin/env python3
"""
Backend service for Eat-Poop-Sleep tracker
Handles automated daily email summaries
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import os
import json
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the frontend

# Email configuration - set these as environment variables or update here
EMAIL_CONFIG = {
    'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
    'smtp_port': int(os.getenv('SMTP_PORT', '587')),
    'sender_email': os.getenv('SENDER_EMAIL', ''),
    'sender_password': os.getenv('SENDER_PASSWORD', ''),  # Use app-specific password for Gmail
    'recipients': ['ben@cohen-family.org', 'anokheecohen@gmail.com']
}

# Path to events file (shared with frontend via localStorage export or API)
EVENTS_FILE = os.path.join(os.path.dirname(__file__), 'events_data.json')

def send_email(subject, body, recipients=None):
    """Send email via SMTP"""
    if recipients is None:
        recipients = EMAIL_CONFIG['recipients']
    
    if not EMAIL_CONFIG['sender_email'] or not EMAIL_CONFIG['sender_password']:
        print("ERROR: Email credentials not configured!")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = ', '.join(recipients)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        text = msg.as_string()
        server.sendmail(EMAIL_CONFIG['sender_email'], recipients, text)
        server.quit()
        
        print(f"Email sent successfully to {recipients}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def load_events():
    """Load events from file"""
    try:
        if os.path.exists(EVENTS_FILE):
            with open(EVENTS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading events: {e}")
    return []

def generate_daily_summary(events, target_date=None):
    """Generate daily summary text from events"""
    if not events:
        return "No events for this day."
    
    if target_date is None:
        target_date = datetime.now().date()
    else:
        if isinstance(target_date, str):
            target_date = datetime.fromisoformat(target_date).date()
    
    date_key = target_date.isoformat()
    
    # Filter events for the target date
    day_events = []
    for ev in events:
        ev_date = datetime.fromisoformat(ev['ts']).date()
        if ev_date.isoformat() == date_key:
            day_events.append(ev)
    
    if not day_events:
        return f"No events for {target_date.strftime('%B %d, %Y')}."
    
    # Sort events chronologically
    day_events.sort(key=lambda x: x['ts'])
    
    # Calculate stats
    sleep_hours = 0
    feed_ounces = 0
    poop_count = 0
    pee_count = 0
    pump_ounces = 0
    freeze_ounces = 0
    h2o_ounces = 0
    wake_windows = []
    
    sleep_sessions = []
    current_sleep_start = None
    last_sleep_end = None
    
    for ev in day_events:
        ev_type = ev.get('type')
        ev_time = datetime.fromisoformat(ev['ts'])
        
        if ev_type == 'sleep_start':
            if last_sleep_end:
                wake_start = last_sleep_end
                wake_end = ev_time
                day_start = datetime.combine(target_date, datetime.min.time())
                day_end = datetime.combine(target_date, datetime.max.time().replace(microsecond=999999))
                
                wake_start_on_day = max(wake_start, day_start)
                wake_end_on_day = min(wake_end, day_end)
                
                if wake_end_on_day > wake_start_on_day:
                    wake_duration = (wake_end_on_day - wake_start_on_day).total_seconds() / 3600
                    wake_windows.append(wake_duration)
            
            current_sleep_start = ev_time
            last_sleep_end = None
        elif ev_type == 'sleep_end' and current_sleep_start:
            sleep_end = ev_time
            sleep_sessions.append({'start': current_sleep_start, 'end': sleep_end})
            last_sleep_end = sleep_end
            current_sleep_start = None
        
        # Count other events
        data = ev.get('data', {})
        amount = data.get('amount', 0)
        
        if ev_type == 'feed':
            feed_ounces += float(amount)
        elif ev_type == 'poop':
            poop_count += 1
        elif ev_type == 'pee':
            pee_count += 1
        elif ev_type == 'pump':
            pump_ounces += float(amount)
        elif ev_type == 'freeze':
            freeze_ounces += float(amount)
        elif ev_type == 'h2o':
            h2o_ounces += float(amount)
    
    # Calculate sleep hours
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date, datetime.max.time().replace(microsecond=999999))
    
    for session in sleep_sessions:
        session_start = max(session['start'], day_start)
        session_end = min(session['end'], day_end)
        
        if session_end > session_start:
            duration = (session_end - session_start).total_seconds() / 3600
            sleep_hours += duration
    
    # Calculate average wake window
    avg_wake_window = sum(wake_windows) / len(wake_windows) if wake_windows else 0
    
    # Format summary
    date_str = target_date.strftime('%B %d, %Y')
    sleep_str = f"{sleep_hours:.1f} hours" if sleep_hours > 0 else "0 hours"
    wake_str = f", Avg wake window: {avg_wake_window:.1f} hours" if avg_wake_window > 0 else ""
    
    summary = f"""{date_str}
Baby Stats - Slept {sleep_str}{wake_str}, Fed {feed_ounces} oz, {poop_count} {'poop' if poop_count == 1 else 'poops'}, {pee_count} {'pee' if pee_count == 1 else 'pees'}
Mama Stats - Pumped {pump_ounces} oz, Froze {freeze_ounces} oz, Drank {h2o_ounces} oz
"""
    
    return summary

def send_daily_summary():
    """Send daily summary for today"""
    events = load_events()
    today = datetime.now().date()
    summary = generate_daily_summary(events, today)
    
    subject = f"Daily Summary - {today.strftime('%B %d, %Y')}"
    
    if summary and "No events" not in summary:
        send_email(subject, summary)
        print(f"Daily summary sent for {today}")
    else:
        print(f"No events to send for {today}")

@app.route('/test-email', methods=['POST'])
def test_email():
    """Send a test email immediately"""
    test_body = """This is a test email from the Eat-Poop-Sleep tracker backend service.

If you're receiving this, the email configuration is working correctly!

The daily summary emails will be sent automatically at 23:59 each day.
"""
    subject = "Test Email - Eat-Poop-Sleep Tracker"
    
    success = send_email(subject, test_body)
    
    if success:
        return jsonify({'status': 'success', 'message': 'Test email sent successfully'})
    else:
        return jsonify({'status': 'error', 'message': 'Failed to send test email. Check server logs.'}), 500

@app.route('/send-summary', methods=['POST'])
def send_summary_endpoint():
    """Manually trigger sending today's summary"""
    data = request.get_json() or {}
    target_date = data.get('date')  # Optional: YYYY-MM-DD format
    
    events = load_events()
    
    if target_date:
        summary = generate_daily_summary(events, target_date)
        date_obj = datetime.fromisoformat(target_date).date()
        subject = f"Daily Summary - {date_obj.strftime('%B %d, %Y')}"
    else:
        summary = generate_daily_summary(events)
        today = datetime.now().date()
        subject = f"Daily Summary - {today.strftime('%B %d, %Y')}"
    
    success = send_email(subject, summary)
    
    if success:
        return jsonify({'status': 'success', 'message': 'Summary sent successfully'})
    else:
        return jsonify({'status': 'error', 'message': 'Failed to send summary'}), 500

@app.route('/save-events', methods=['POST'])
def save_events():
    """Save events from frontend"""
    data = request.get_json()
    events = data.get('events', [])
    
    try:
        with open(EVENTS_FILE, 'w') as f:
            json.dump(events, f, indent=2)
        return jsonify({'status': 'success', 'message': 'Events saved'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

# Schedule daily email at 23:59
scheduler = BackgroundScheduler()
scheduler.add_job(func=send_daily_summary, trigger="cron", hour=23, minute=59)
scheduler.start()

# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())

if __name__ == '__main__':
    print("Starting Eat-Poop-Sleep backend service...")
    print(f"Email will be sent daily at 23:59 to: {', '.join(EMAIL_CONFIG['recipients'])}")
    print("Make sure to set SENDER_EMAIL and SENDER_PASSWORD environment variables")
    print("\nEndpoints:")
    print("  POST /test-email - Send a test email")
    print("  POST /send-summary - Manually send today's summary")
    print("  POST /save-events - Save events from frontend")
    print("  GET /health - Health check")
    print("\nStarting server on http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)

