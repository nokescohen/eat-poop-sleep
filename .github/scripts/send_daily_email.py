#!/usr/bin/env python3
"""
GitHub Actions script to send daily summary email
Fetches data from Firebase and sends email
"""

import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
if not firebase_admin._apps:
    project_id = os.getenv('FIREBASE_PROJECT_ID')
    private_key = os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n')
    client_email = os.getenv('FIREBASE_CLIENT_EMAIL')
    
    if not project_id or not private_key or not client_email:
        print("ERROR: Firebase credentials not configured!")
        exit(1)
    
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": project_id,
        "private_key": private_key,
        "client_email": client_email,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    firebase_admin.initialize_app(cred)

db = firestore.client()

def generate_daily_summary(events, target_date):
    """Generate daily summary text from events"""
    if not events:
        return f"No events for {target_date.strftime('%B %d, %Y')}."
    
    date_key = target_date.isoformat()
    day_events = [ev for ev in events if ev.get('ts', '').startswith(date_key)]
    
    if not day_events:
        return f"No events for {target_date.strftime('%B %d, %Y')}."
    
    day_events.sort(key=lambda x: x.get('ts', ''))
    
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
        ev_time = datetime.fromisoformat(ev.get('ts', ''))
        
        if ev_type == 'sleep_start':
            if last_sleep_end:
                wake_duration = (ev_time - last_sleep_end).total_seconds() / 3600
                wake_windows.append(wake_duration)
            current_sleep_start = ev_time
            last_sleep_end = None
        elif ev_type == 'sleep_end' and current_sleep_start:
            sleep_end = ev_time
            sleep_sessions.append({'start': current_sleep_start, 'end': sleep_end})
            last_sleep_end = sleep_end
            current_sleep_start = None
        
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

def send_email(subject, body, recipients):
    """Send email via SMTP"""
    sender_email = os.getenv('SENDER_EMAIL')
    sender_password = os.getenv('SENDER_PASSWORD')
    
    if not sender_email or not sender_password:
        print("ERROR: Email credentials not configured!")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = ', '.join(recipients.split(','))
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipients.split(','), msg.as_string())
        server.quit()
        
        print(f"Email sent successfully to {recipients}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def main():
    # Get today's date
    today = datetime.now().date()
    
    # Fetch events from Firebase
    events_ref = db.collection('events')
    docs = events_ref.stream()
    
    events = []
    for doc in docs:
        event_data = doc.to_dict()
        event_data['id'] = doc.id
        events.append(event_data)
    
    # Generate summary for today
    summary = generate_daily_summary(events, today)
    
    # Send email
    subject = f"Daily Summary - {today.strftime('%B %d, %Y')}"
    recipients = os.getenv('RECIPIENT_EMAILS', 'anokheecohen@gmail.com,ben@cohen-family.org')
    
    if summary and "No events" not in summary:
        send_email(subject, summary, recipients)
    else:
        print(f"No events to send for {today}")

if __name__ == '__main__':
    main()

