```markdown
# Eat • Poop • Sleep — Minimal Tracker (Prototype)

This is a small, mobile-friendly prototype to track pee, poop, feeds (ounces), and sleep events by tapping buttons.

Changes in this version
- Split the diaper button into two buttons: Pee and Poop.
- Feed button now logs 1 ounce per tap (each tap creates a feed event with amount: 1 and a timestamp).
- Sleep button toggles start/stop; pressing once logs sleep_start, pressing again logs sleep_end. The app initializes the sleep state based on the most recent sleep events when it loads.
- 24h stats now show counts for Pee and Poop, total feed ounces, and number of completed sleep sessions.

Files
- index.html — UI
- app.css — styles
- app.js — behavior and event storage (localStorage)
- README.md — this file

How to use
1. Save the files (index.html, app.css, app.js) in a folder.
2. Open index.html in a browser (phone or desktop).
3. Tap:
   - Pee or Poop to log those changes.
   - Feed to log 1 oz (tap multiple times to log multiple ounces).
   - Sleep to start and end a sleep session.
4. Use Undo, Export CSV, and Clear all as needed.

Next ideas
- Aggregate consecutive feed taps into one feeding session with a running total (optional).
- Add an edit screen to change amounts (e.g., combine taps into 4 oz) or to label caregivers.
- Add syncing backend (Supabase/Firebase) for multi-device use.

If you'd like, I can:
- Implement automatic grouping of feed taps into single sessions (e.g., taps within N minutes collapse into one feed with summed ounces).
- Push these changes to your repository and open a PR.
- Convert to a PWA / React or Expo app.

Which would you like next?
```