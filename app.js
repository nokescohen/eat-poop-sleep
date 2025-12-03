// Eat-Poop-Sleep tracker (Firebase Firestore for cloud sync)
// Updated: Cloud storage with real-time sync across devices
const KEY = 'eps_events_v1';
const EVENTS_COLLECTION = 'events';

const elements = {
  btnSleep: document.getElementById('btn-sleep'),
  btnFeed: document.getElementById('btn-feed'),
  btnPoop: document.getElementById('btn-poop'),
  btnPee: document.getElementById('btn-pee'),
  btnAntibiotic: document.getElementById('btn-antibiotic'),
  btnWoundClean: document.getElementById('btn-wound-clean'),
  btnVitD: document.getElementById('btn-vit-d'),
  btnPump: document.getElementById('btn-pump'),
  btnFreeze: document.getElementById('btn-freeze'),
  btnH2O: document.getElementById('btn-h2o'),
  history: document.getElementById('history'),
  statsBaby: document.getElementById('stats-baby'),
  statsMama: document.getElementById('stats-mama'),
  sleepStatus: document.getElementById('sleep-status'),
  datePicker: document.getElementById('date-picker'),
  btnUndo: document.getElementById('btn-undo'),
  btnExport: document.getElementById('btn-export'),
  btnExportSummary: document.getElementById('btn-export-summary'),
  chartStatBaby: document.getElementById('chart-stat-baby'),
  chartIntervalBaby: document.getElementById('chart-interval-baby'),
  chartTimeframeBaby: document.getElementById('chart-timeframe-baby'),
  trendChartBaby: document.getElementById('trend-chart-baby'),
  chartStatMama: document.getElementById('chart-stat-mama'),
  chartIntervalMama: document.getElementById('chart-interval-mama'),
  chartTimeframeMama: document.getElementById('chart-timeframe-mama'),
  trendChartMama: document.getElementById('trend-chart-mama'),
};

let events = [];
let sleeping = false;
let firestoreReady = false;
let unsubscribeFirestore = null;
let selectedDate = new Date(); // Default to today
let trendChartInstanceBaby = null; // Chart.js instance for Baby
let trendChartInstanceMama = null; // Chart.js instance for Mama

// Check if Firebase is available
function isFirebaseAvailable(){
  return typeof window.db !== 'undefined' && typeof window.firestoreFunctions !== 'undefined';
}

// Initialize Firebase connection
async function initFirebase(){
  if(!isFirebaseAvailable()){
    console.warn('Firebase not available, falling back to localStorage');
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    render();
    return;
  }
  
  try{
    const { collection, getDocs, query, orderBy, onSnapshot } = window.firestoreFunctions;
    
    // Load initial data
    const eventsRef = collection(window.db, EVENTS_COLLECTION);
    const q = query(eventsRef, orderBy('ts', 'desc'));
    const snapshot = await getDocs(q);
    
    events = [];
    snapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    // Check if there's localStorage data to migrate
    const localData = loadFromLocalStorage();
    if(localData.length > 0 && events.length === 0){
      const migrate = confirm(`Found ${localData.length} events in local storage.\n\nWould you like to migrate them to Firebase?\n\nClick OK to migrate, Cancel to start fresh.`);
      if(migrate){
        // Migrate localStorage to Firebase
        await migrateLocalStorageToFirebase(localData);
        events = localData;
        localStorage.removeItem(KEY); // Clear after migration
      }
    }
    
    sleeping = calcSleepingFromEvents();
    render();
    
    // Set up real-time listener for sync across devices
    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      events = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() });
      });
      sleeping = calcSleepingFromEvents();
      render();
    });
    
    firestoreReady = true;
    console.log('Firebase connected, real-time sync enabled');
  } catch(error){
    console.error('Firebase initialization error:', error);
    // Fallback to localStorage
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    render();
  }
}

// Migrate localStorage data to Firebase
async function migrateLocalStorageToFirebase(localData){
  if(!isFirebaseAvailable()) return;
  
  try{
    const { collection, doc, setDoc } = window.firestoreFunctions;
    const eventsRef = collection(window.db, EVENTS_COLLECTION);
    
    // Upload all events to Firestore
    const savePromises = localData.map(ev => {
      const eventDoc = doc(eventsRef, ev.id);
      return setDoc(eventDoc, {
        type: ev.type,
        ts: ev.ts,
        data: ev.data || {}
      });
    });
    
    await Promise.all(savePromises);
    console.log(`Migrated ${localData.length} events to Firebase`);
  } catch(error){
    console.error('Migration error:', error);
    throw error;
  }
}

function nowISO(){ return new Date().toISOString(); }
function fmtTime(iso){
  const d = new Date(iso);
  return d.toLocaleString([], {hour:'2-digit', minute:'2-digit', month:'short', day:'numeric', hour12: false});
}

// Fallback to localStorage if Firebase not available
function loadFromLocalStorage(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

// Save to localStorage as backup
function saveToLocalStorage(){
  try{
    localStorage.setItem(KEY, JSON.stringify(events));
  }catch(e){ console.error('LocalStorage save error:', e); }
}

// Determine sleeping state from most recent sleep event: if most recent sleep event is sleep_start -> sleeping = true
function calcSleepingFromEvents(){
  for(const ev of events){
    if(ev.type === 'sleep_start') return true;
    if(ev.type === 'sleep_end') return false;
  }
  return false;
}

async function save(){
  if(firestoreReady && isFirebaseAvailable()){
    try{
      const { collection, doc, setDoc } = window.firestoreFunctions;
      const eventsRef = collection(window.db, EVENTS_COLLECTION);
      
      // Save all events to Firestore
      const savePromises = events.map(ev => {
        const eventDoc = doc(eventsRef, ev.id);
        return setDoc(eventDoc, {
          type: ev.type,
          ts: ev.ts,
          data: ev.data || {}
        });
      });
      
      await Promise.all(savePromises);
      // Also save to localStorage as backup
      saveToLocalStorage();
      // Don't call render() - real-time listener will update UI
    } catch(error){
      console.error('Firestore save error:', error);
      // Fallback to localStorage
      saveToLocalStorage();
      render();
    }
  } else {
    // Fallback to localStorage
    saveToLocalStorage();
  render();
  }
}

function addEvent(type, data = {}){
  // Check if there's a recent event of the same type within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentSameType = events.find(ev => {
    if(ev.type !== type) return false;
    const evTime = new Date(ev.ts);
    return evTime >= oneMinuteAgo;
  });
  
  // If found and it has an amount, aggregate it
  if(recentSameType && recentSameType.data && recentSameType.data.amount && data.amount){
    const currentAmount = Number(recentSameType.data.amount) || 0;
    const newAmount = Number(data.amount) || 0;
    recentSameType.data.amount = currentAmount + newAmount;
    save();
    return;
  }
  
  // Otherwise create a new event
  const ev = { id: Date.now().toString() + Math.random().toString(36).slice(2,6), type, ts: nowISO(), data };
  events.unshift(ev); // newest first
  save();
}

async function undoLast(){
  if(events.length===0) return;
  const eventToDelete = events[0];
  events.shift();
  
  if(firestoreReady && isFirebaseAvailable()){
    try{
      const { collection, doc, deleteDoc } = window.firestoreFunctions;
      const eventDoc = doc(collection(window.db, EVENTS_COLLECTION), eventToDelete.id);
      await deleteDoc(eventDoc);
      // Real-time listener will update UI
    } catch(error){
      console.error('Firestore delete error:', error);
      save();
    }
  } else {
  save();
  }
}

async function clearAll(){
  if(!confirm('Clear all events?')) return;
  
  if(firestoreReady && isFirebaseAvailable()){
    try{
      const { collection, getDocs, doc, deleteDoc } = window.firestoreFunctions;
      const eventsRef = collection(window.db, EVENTS_COLLECTION);
      const snapshot = await getDocs(eventsRef);
      
      const deletePromises = [];
      snapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(eventsRef, docSnap.id)));
      });
      
      await Promise.all(deletePromises);
      events = [];
      sleeping = false;
      // Real-time listener will update UI
    } catch(error){
      console.error('Firestore clear error:', error);
      events = [];
      save();
    }
  } else {
  events = [];
  save();
  }
}

function exportCSV(){
  if(events.length===0){ alert('No events to export'); return; }
  const rows = [['type','timestamp','data']];
  for(const ev of events){
    rows.push([ev.type, ev.ts, JSON.stringify(ev.data)]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eps_events.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportData(){
  if(events.length===0){ alert('No data to export'); return; }
  const data = {
    version: '1.0',
    exported: new Date().toISOString(),
    events: events
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eps_data_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try{
        const data = JSON.parse(e.target.result);
        let importedEvents = [];
        
        // Handle different export formats
        if(data.events && Array.isArray(data.events)){
          importedEvents = data.events;
        } else if(Array.isArray(data)){
          importedEvents = data;
        } else{
          throw new Error('Invalid file format');
        }
        
        if(importedEvents.length === 0){
          alert('No events found in file');
          return;
        }
        
        // Ask user if they want to merge or replace
        const action = confirm(`Found ${importedEvents.length} events.\n\nClick OK to REPLACE all current data.\nClick Cancel to MERGE with existing data.`);
        
        async function doImport(){
          if(action){
            // Replace - clear all first if using Firebase
            if(firestoreReady && isFirebaseAvailable()){
              try{
                const { collection, getDocs, doc, deleteDoc } = window.firestoreFunctions;
                const eventsRef = collection(window.db, EVENTS_COLLECTION);
                const snapshot = await getDocs(eventsRef);
                
                const deletePromises = [];
                snapshot.forEach((docSnap) => {
                  deletePromises.push(deleteDoc(doc(eventsRef, docSnap.id)));
                });
                await Promise.all(deletePromises);
              } catch(error){
                console.error('Error clearing Firestore:', error);
              }
            }
            events = importedEvents;
          } else{
            // Merge - combine and sort by timestamp
            const merged = [...events, ...importedEvents];
            merged.sort((a, b) => new Date(b.ts) - new Date(a.ts));
            // Remove duplicates based on ID if they exist
            const seen = new Set();
            events = merged.filter(ev => {
              if(ev.id && seen.has(ev.id)) return false;
              if(ev.id) seen.add(ev.id);
              return true;
            });
          }
          
          // Recalculate sleep state
          sleeping = calcSleepingFromEvents();
          
          // Save to Firestore or localStorage
          await save();
          alert(`Successfully imported ${importedEvents.length} events!`);
        }
        
        doImport();
      } catch(error){
        alert('Error importing data: ' + error.message);
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function generateDailySummaryText(eventsToUse = events){
  if(eventsToUse.length===0) return '';
  
  // Group events by date (24-hour periods starting at midnight)
  const eventsByDate = {};
  for(const ev of eventsToUse){
    const d = new Date(ev.ts);
    const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
    if(!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(ev);
  }
  
  // Calculate stats for each day
  const summaries = [];
  const sortedDates = Object.keys(eventsByDate).sort();
  
  for(const dateKey of sortedDates){
    const dayEvents = eventsByDate[dateKey].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    
    // Baby stats
    let sleepHours = 0;
    let feedOunces = 0;
    let poopCount = 0;
    let peeCount = 0;
    let antibioticCount = 0;
    let woundCleanCount = 0;
    let vitDCount = 0;
    const wakeWindows = [];
    
    // Mama stats
    let pumpOunces = 0;
    let freezeOunces = 0;
    let h2oOunces = 0;
    
    // Calculate sleep hours and wake windows by pairing sleep_start and sleep_end
    // Process events chronologically to pair them correctly
    const sleepSessions = [];
    let currentSleepStart = null;
    let lastSleepEnd = null;
    
    for(const ev of dayEvents){
      if(ev.type === 'sleep_start'){
        // If there was a previous sleep_end, calculate wake window
        if(lastSleepEnd){
          const wakeStart = lastSleepEnd;
          const wakeEnd = new Date(ev.ts);
          const dayStart = new Date(dateKey + 'T00:00:00');
          const dayEnd = new Date(dateKey + 'T23:59:59.999');
          
          // Calculate the portion of wake window that occurred on this day
          const wakeStartOnDay = wakeStart < dayStart ? dayStart : wakeStart;
          const wakeEndOnDay = wakeEnd > dayEnd ? dayEnd : wakeEnd;
          
          if(wakeEndOnDay > wakeStartOnDay){
            const wakeDurationMs = wakeEndOnDay - wakeStartOnDay;
            const wakeHours = wakeDurationMs / (1000 * 60 * 60);
            wakeWindows.push(wakeHours);
          }
        }
        currentSleepStart = new Date(ev.ts);
        lastSleepEnd = null;
      } else if(ev.type === 'sleep_end' && currentSleepStart){
        const sleepEnd = new Date(ev.ts);
        sleepSessions.push({ start: currentSleepStart, end: sleepEnd });
        lastSleepEnd = sleepEnd;
        currentSleepStart = null;
      }
    }
    
    // Calculate total sleep hours for completed sessions on this day
    for(const session of sleepSessions){
      const dayStart = new Date(dateKey + 'T00:00:00');
      const dayEnd = new Date(dateKey + 'T23:59:59.999');
      
      // Calculate the portion of sleep that occurred on this day
      const sessionStart = session.start < dayStart ? dayStart : session.start;
      const sessionEnd = session.end > dayEnd ? dayEnd : session.end;
      
      if(sessionEnd > sessionStart){
        const durationMs = sessionEnd - sessionStart;
        sleepHours += durationMs / (1000 * 60 * 60);
      }
    }
    
    // Count other events
    for(const ev of dayEvents){
      if(ev.type === 'feed') feedOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
      if(ev.type === 'poop') poopCount++;
      if(ev.type === 'pee') peeCount++;
      if(ev.type === 'antibiotic') antibioticCount++;
      if(ev.type === 'wound_clean') woundCleanCount++;
      if(ev.type === 'vit_d') vitDCount++;
      if(ev.type === 'pump') pumpOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
      if(ev.type === 'freeze') freezeOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
      if(ev.type === 'h2o') h2oOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    }
    
    // Calculate average wake window
    let avgWakeWindow = 0;
    if(wakeWindows.length > 0){
      const totalWake = wakeWindows.reduce((sum, w) => sum + w, 0);
      avgWakeWindow = totalWake / wakeWindows.length;
    }
    
    // Format date nicely
    const dateObj = new Date(dateKey + 'T00:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Format sleep hours
    const sleepHoursStr = sleepHours > 0 ? `${sleepHours.toFixed(1)} hours` : '0 hours';
    
    // Format average wake window
    const wakeWindowStr = avgWakeWindow > 0 ? `, Avg wake window: ${avgWakeWindow.toFixed(1)} hours` : '';
    
    // Build summary line
    const summary = `${dateStr}\nBaby Stats - Slept ${sleepHoursStr}${wakeWindowStr}, Fed ${feedOunces} oz, ${poopCount} ${poopCount === 1 ? 'poop' : 'poops'}, ${peeCount} ${peeCount === 1 ? 'pee' : 'pees'}, Antibiotic: ${antibioticCount}, Wound Clean: ${woundCleanCount}, Vit D: ${vitDCount}\nMama Stats - Pumped ${pumpOunces} oz, Froze ${freezeOunces} oz, Drank ${h2oOunces} oz\n`;
    summaries.push(summary);
  }
  
  return summaries.join('\n');
}

function exportDailySummary(){
  if(events.length===0){ alert('No events to export'); return; }
  
  const summaryText = generateDailySummaryText();
  const blob = new Blob([summaryText], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eps_daily_summary.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// Email configuration - NOTE: You need to set up EmailJS account and add your keys here
const EMAILJS_CONFIG = {
  serviceId: 'YOUR_SERVICE_ID', // Replace with your EmailJS service ID
  templateId: 'YOUR_TEMPLATE_ID', // Replace with your EmailJS template ID
  publicKey: 'YOUR_PUBLIC_KEY' // Replace with your EmailJS public key
};

const LAST_EMAIL_SENT_KEY = 'eps_last_email_sent';

function getTodayDateKey(){
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function shouldSendDailyEmail(){
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Check if it's 23:59 or later (past the send time)
  const isPastSendTime = hour === 23 && minute >= 59;
  
  // Check if we've already sent today
  const lastSentDate = localStorage.getItem(LAST_EMAIL_SENT_KEY);
  const todayKey = getTodayDateKey();
  
  return isPastSendTime && lastSentDate !== todayKey;
}

// Send test email (for immediate testing)
async function sendTestEmail(){
  if(events.length === 0){
    alert('No events to send. Add some events first!');
    return;
  }
  
  // Get today's summary
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  
  // Filter events from today
  const todayEvents = events.filter(ev => {
    const evDate = new Date(ev.ts).toISOString().split('T')[0];
    return evDate === todayKey;
  });
  
  if(todayEvents.length === 0){
    alert('No events for today. The summary will be empty.');
  }
  
  const summaryText = generateDailySummaryText(todayEvents.length > 0 ? todayEvents : events.slice(0, 10)); // Use today's or last 10 events
  
  // For now, show the summary and allow copying
  // In production, this would call an API endpoint
  const emailBody = `Daily Summary - ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n${summaryText}`;
  
  // Copy to clipboard and show
  navigator.clipboard.writeText(emailBody).then(() => {
    alert(`Test email summary copied to clipboard!\n\nTo: anokheecohen@gmail.com, ben@cohen-family.org\n\nYou can paste it into an email. The automated daily emails will be sent via GitHub Actions at 23:59 each day.`);
  }).catch(() => {
    // Fallback: show in alert
    alert(`Test Email Summary:\n\n${emailBody}\n\n(Note: Automated emails will be sent daily at 23:59 via GitHub Actions)`);
  });
  
  // Also log to console for debugging
  console.log('Test email summary:', emailBody);
}

// Set up daily email check - runs every minute
// Note: Actual emails are sent via GitHub Actions at 23:59 daily
function setupDailyEmailCheck(){
  // This function is kept for compatibility but emails are now sent via GitHub Actions
  console.log('Daily emails are configured to send via GitHub Actions at 23:59 daily');
}

function toggleSleep(){
  if(!sleeping){
    addEvent('sleep_start', {});
    sleeping = true;
  }else{
    addEvent('sleep_end', {});
    sleeping = false;
  }
  render();
}

function editTimestamp(ev){
  // Convert ISO timestamp to datetime-local format (YYYY-MM-DDTHH:mm)
  const d = new Date(ev.ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const datetimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  const newDateTime = prompt('Edit time (YYYY-MM-DD HH:MM):', datetimeLocal.replace('T', ' '));
  if(newDateTime === null) return; // User cancelled
  
  // Parse the input - handle both "YYYY-MM-DD HH:MM" and "YYYY-MM-DDTHH:MM" formats
  const dateTimeStr = newDateTime.replace(' ', 'T');
  const newDate = new Date(dateTimeStr);
  
  if(isNaN(newDate.getTime())){
    alert('Invalid date/time format. Please use YYYY-MM-DD HH:MM');
    return;
  }
  
  // Update the event timestamp
  ev.ts = newDate.toISOString();
  
  // If this is a sleep event, recalculate sleeping state
  if(ev.type === 'sleep_start' || ev.type === 'sleep_end'){
    sleeping = calcSleepingFromEvents();
  }
  
  // Re-sort events by timestamp (newest first)
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  
  save();
}

function editQuantity(ev){
  const currentAmount = ev.data && ev.data.amount ? ev.data.amount : 0;
  const newAmountStr = prompt('Edit amount (oz):', currentAmount);
  if(newAmountStr === null) return; // User cancelled
  
  const newAmount = parseFloat(newAmountStr);
  if(isNaN(newAmount) || newAmount < 0){
    alert('Invalid amount. Please enter a positive number.');
    return;
  }
  
  if(!ev.data) ev.data = {};
  ev.data.amount = newAmount;
  save();
}

function render(){
  // sleep status
  elements.sleepStatus.textContent = sleeping ? 'Sleeping' : 'Awake';
  // update sleep button text
  elements.btnSleep.textContent = sleeping ? 'Wake' : 'Sleep';

  // stats: counts for selected date (from 00:00:00 to 23:59:59.999 in local timezone)
  // Use local timezone to avoid timezone conversion issues
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();
  const dateStart = new Date(year, month, day, 0, 0, 0, 0);
  const dateEnd = new Date(year, month, day, 23, 59, 59, 999);
  const counts = { pee:0, poop:0, feedOunces:0, sleepHours:0, wakeWindows:[], pumpOunces:0, freezeOunces:0, h2oOunces:0, antibiotic:0, woundClean:0, vitD:0 };
  
  // Get all events from selected date, sorted chronologically
  const recentEvents = events.filter(ev => {
    const evDate = new Date(ev.ts);
    return evDate >= dateStart && evDate <= dateEnd;
  }).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  // Calculate sleep hours and wake windows
  let currentSleepStart = null;
  let lastSleepEnd = null;
  
  for(const ev of recentEvents){
    const t = new Date(ev.ts);
    
    if(ev.type === 'sleep_start'){
      // If there was a previous sleep_end, calculate wake window
      if(lastSleepEnd){
        const wakeDuration = t - lastSleepEnd;
        const wakeHours = wakeDuration / (1000 * 60 * 60);
        counts.wakeWindows.push(wakeHours);
      }
      currentSleepStart = t;
      lastSleepEnd = null;
    } else if(ev.type === 'sleep_end' && currentSleepStart){
      const sleepDuration = t - currentSleepStart;
      const sleepHours = sleepDuration / (1000 * 60 * 60);
      counts.sleepHours += sleepHours;
      lastSleepEnd = t;
      currentSleepStart = null;
    }
    
    // Count other events
    if(ev.type === 'pee') counts.pee++;
    if(ev.type === 'poop') counts.poop++;
    if(ev.type === 'feed') counts.feedOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'antibiotic') counts.antibiotic++;
    if(ev.type === 'wound_clean') counts.woundClean++;
    if(ev.type === 'vit_d') counts.vitD++;
    if(ev.type === 'pump') counts.pumpOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'freeze') counts.freezeOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'h2o') counts.h2oOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
  }
  
  // Handle ongoing sleep session (sleep_start without matching sleep_end)
  // Only count if the selected date is today
  const now = new Date();
  const isToday = selectedDate.getFullYear() === now.getFullYear() && 
                  selectedDate.getMonth() === now.getMonth() && 
                  selectedDate.getDate() === now.getDate();
  if(currentSleepStart && isToday){
    const sleepDuration = now - currentSleepStart;
    const sleepHours = sleepDuration / (1000 * 60 * 60);
    counts.sleepHours += sleepHours;
  }
  
  // Calculate average wake window
  let avgWakeWindow = 0;
  if(counts.wakeWindows.length > 0){
    const totalWake = counts.wakeWindows.reduce((sum, w) => sum + w, 0);
    avgWakeWindow = totalWake / counts.wakeWindows.length;
  }
  
  const sleepHoursStr = counts.sleepHours > 0 ? `${counts.sleepHours.toFixed(1)}h` : '0h';
  const wakeWindowStr = avgWakeWindow > 0 ? `Avg wake: ${avgWakeWindow.toFixed(1)}h` : 'No wake windows';
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const babyStatText = `${dateStr} — Pee: ${counts.pee}, Poop: ${counts.poop}, Feeds: ${counts.feedOunces}oz, Sleep: ${sleepHoursStr}, ${wakeWindowStr}, Antibiotic: ${counts.antibiotic}, Wound Clean: ${counts.woundClean}, Vit D: ${counts.vitD}`;
  const mamaStatText = `${dateStr} — Pump: ${counts.pumpOunces}oz, Freeze: ${counts.freezeOunces}oz, H2O: ${counts.h2oOunces}oz`;
  elements.statsBaby.textContent = babyStatText;
  elements.statsMama.textContent = mamaStatText;

  // Daily Log - show only events from selected date
  elements.history.innerHTML = '';
  const logEvents = events.filter(ev => {
    const evDate = new Date(ev.ts);
    return evDate >= dateStart && evDate <= dateEnd;
  }).sort((a, b) => new Date(b.ts) - new Date(a.ts)); // Most recent first
  for(const ev of logEvents){
    const li = document.createElement('li');
    const left = document.createElement('div');
    const right = document.createElement('div');
    
    // Create label with editable amount
    const label = document.createElement('div');
    label.className = 'event-label';
    
    // Check if this event type has an amount
    const hasAmount = (ev.type === 'feed' || ev.type === 'pump' || ev.type === 'freeze' || ev.type === 'h2o') && ev.data && ev.data.amount;
    
    if(hasAmount){
      // Split label into text and amount parts
      const labelText = document.createElement('span');
      labelText.textContent = prettyLabel(ev).split(' • ')[0] + ' • ';
      
      const amountSpan = document.createElement('span');
      amountSpan.textContent = `${ev.data.amount} oz`;
      amountSpan.style.cursor = 'pointer';
      amountSpan.style.textDecoration = 'underline';
      amountSpan.style.color = 'var(--accent)';
      amountSpan.title = 'Click to edit amount';
      amountSpan.onclick = () => editQuantity(ev);
      
      label.appendChild(labelText);
      label.appendChild(amountSpan);
    } else {
    label.textContent = prettyLabel(ev);
    }
    
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.textContent = fmtTime(ev.ts);
    meta.style.cursor = 'pointer';
    meta.style.textDecoration = 'underline';
    meta.title = 'Click to edit time';
    meta.onclick = () => editTimestamp(ev);
    left.appendChild(label);
    left.appendChild(meta);

    const del = document.createElement('button');
    del.textContent = '⋯';
    del.title = 'Delete';
    del.onclick = async () => { 
      if(confirm('Delete this event?')){
        if(firestoreReady && isFirebaseAvailable()){
          try{
            const { collection, doc, deleteDoc } = window.firestoreFunctions;
            const eventDoc = doc(collection(window.db, EVENTS_COLLECTION), ev.id);
            await deleteDoc(eventDoc);
            // Real-time listener will update UI
          } catch(error){
            console.error('Firestore delete error:', error);
            events = events.filter(x=>x.id!==ev.id);
            save();
          }
        } else {
          events = events.filter(x=>x.id!==ev.id);
          save();
        }
      }
    };

    li.appendChild(left);
    li.appendChild(del);
    elements.history.appendChild(li);
  }
}

function prettyLabel(ev){
  if(ev.type === 'pee') return 'Baby - Pee';
  if(ev.type === 'poop') return 'Baby - Poop';
  if(ev.type === 'antibiotic') return 'Baby - Antibiotic';
  if(ev.type === 'wound_clean') return 'Baby - Wound Clean';
  if(ev.type === 'vit_d') return 'Baby - Vit D Drop';
  if(ev.type === 'feed'){
    const amt = ev.data && ev.data.amount ? ` ${ev.data.amount}oz` : '';
    return `Baby - Feed${amt}`;
  }
  if(ev.type === 'pump'){
    const amt = ev.data && ev.data.amount ? ` ${ev.data.amount}oz` : '';
    return `Mama - Pump${amt}`;
  }
  if(ev.type === 'freeze'){
    const amt = ev.data && ev.data.amount ? ` ${ev.data.amount}oz` : '';
    return `Mama - Freeze${amt}`;
  }
  if(ev.type === 'h2o'){
    const amt = ev.data && ev.data.amount ? ` ${ev.data.amount}oz` : '';
    return `Mama - H2O${amt}`;
  }
  if(ev.type==='sleep_start') return 'Baby - Sleep — start';
  if(ev.type==='sleep_end') return 'Baby - Sleep — end';
  return ev.type;
}

// Button handlers
elements.btnPee.addEventListener('click', () => {
  addEvent('pee', {});
});

elements.btnPoop.addEventListener('click', () => {
  addEvent('poop', {});
});

elements.btnAntibiotic.addEventListener('click', () => {
  addEvent('antibiotic', {});
});

elements.btnWoundClean.addEventListener('click', () => {
  addEvent('wound_clean', {});
});

elements.btnVitD.addEventListener('click', () => {
  addEvent('vit_d', {});
});

elements.btnFeed.addEventListener('click', () => {
  // Each press = 0.5 ounce
  addEvent('feed', { amount: 0.5 });
});

elements.btnSleep.addEventListener('click', toggleSleep);

elements.btnPump.addEventListener('click', () => {
  // Each press = 0.5 ounce
  addEvent('pump', { amount: 0.5 });
});

elements.btnFreeze.addEventListener('click', () => {
  // Each press = 1 ounce
  addEvent('freeze', { amount: 1 });
});

elements.btnH2O.addEventListener('click', () => {
  // Each press = 40 ounces
  addEvent('h2o', { amount: 40 });
});

elements.btnUndo.addEventListener('click', () => {
  if(confirm('Undo last event?')) undoLast();
});

elements.btnExport.addEventListener('click', exportCSV);
elements.btnExportSummary.addEventListener('click', exportDailySummary);

// Chart functions
function aggregateDataForChart(stat, interval, timeframeDays) {
  const now = new Date();
  let startDate = null;
  let relevantEvents = events;
  
  if (timeframeDays !== null) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - timeframeDays);
    startDate.setHours(0, 0, 0, 0);
    
    // Filter events within timeframe
    relevantEvents = events.filter(ev => {
      const evDate = new Date(ev.ts);
      return evDate >= startDate;
    });
  } else {
    // All time - use earliest event date
    if (events.length > 0) {
      const earliestEvent = events.reduce((earliest, ev) => {
        const evDate = new Date(ev.ts);
        return evDate < earliest ? evDate : earliest;
      }, new Date(events[0].ts));
      startDate = new Date(earliestEvent);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 14); // Default to 2 weeks if no events
    }
  }
  
  const dataMap = new Map();
  
  // Initialize all periods in the timeframe
  const periods = [];
  if (timeframeDays === null) {
    // All time - create periods from earliest event to now
    const daysDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    if (interval === 'daily') {
      for (let i = daysDiff - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().split('T')[0];
        periods.push({ key, date, value: 0 });
        dataMap.set(key, 0);
      }
    } else if (interval === 'weekly') {
      const weeks = Math.ceil(daysDiff / 7);
      for (let i = weeks - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7));
        date.setHours(0, 0, 0, 0);
        // Get start of week (Sunday)
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() - dayOfWeek);
        const key = date.toISOString().split('T')[0];
        periods.push({ key, date, value: 0 });
        dataMap.set(key, 0);
      }
    }
  } else {
    if (interval === 'daily') {
      for (let i = timeframeDays - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().split('T')[0];
        periods.push({ key, date, value: 0 });
        dataMap.set(key, 0);
      }
    } else if (interval === 'weekly') {
      const weeks = Math.ceil(timeframeDays / 7);
      for (let i = weeks - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7));
        date.setHours(0, 0, 0, 0);
        // Get start of week (Sunday)
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() - dayOfWeek);
        const key = date.toISOString().split('T')[0];
        periods.push({ key, date, value: 0 });
        dataMap.set(key, 0);
      }
    }
  }
  
  // Aggregate events by period
  for (const ev of relevantEvents) {
    const evDate = new Date(ev.ts);
    let periodKey;
    
    if (interval === 'daily') {
      const dayStart = new Date(evDate);
      dayStart.setHours(0, 0, 0, 0);
      periodKey = dayStart.toISOString().split('T')[0];
    } else if (interval === 'weekly') {
      const weekStart = new Date(evDate);
      weekStart.setHours(0, 0, 0, 0);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      periodKey = weekStart.toISOString().split('T')[0];
    }
    
    if (!periodKey || !dataMap.has(periodKey)) continue;
    
    let value = 0;
    
    if (stat === 'feed' && ev.type === 'feed') {
      value = (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    } else if (stat === 'sleep' && (ev.type === 'sleep_start' || ev.type === 'sleep_end')) {
      // Sleep requires special handling - we'll calculate hours between sleep_start and sleep_end
      // For now, we'll track this separately
      continue; // Skip for now, will handle below
    } else if (stat === 'poop' && ev.type === 'poop') {
      value = 1;
    } else if (stat === 'pee' && ev.type === 'pee') {
      value = 1;
    } else if (stat === 'pump' && ev.type === 'pump') {
      value = (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    } else if (stat === 'freeze' && ev.type === 'freeze') {
      value = (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    } else if (stat === 'h2o' && ev.type === 'h2o') {
      value = (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    } else if (stat === 'antibiotic' && ev.type === 'antibiotic') {
      value = 1;
    } else if (stat === 'wound_clean' && ev.type === 'wound_clean') {
      value = 1;
    } else if (stat === 'vit_d' && ev.type === 'vit_d') {
      value = 1;
    } else {
      continue;
    }
    
    dataMap.set(periodKey, dataMap.get(periodKey) + value);
  }
  
  // Handle sleep hours calculation
  if (stat === 'sleep') {
    const sleepSessions = [];
    let currentSleepStart = null;
    
    for (const ev of relevantEvents.sort((a, b) => new Date(a.ts) - new Date(b.ts))) {
      if (ev.type === 'sleep_start') {
        currentSleepStart = new Date(ev.ts);
      } else if (ev.type === 'sleep_end' && currentSleepStart) {
        const sleepEnd = new Date(ev.ts);
        const sleepHours = (sleepEnd - currentSleepStart) / (1000 * 60 * 60);
        
        // Determine which period this sleep session belongs to
        let periodKey;
        if (interval === 'daily') {
          const dayStart = new Date(currentSleepStart);
          dayStart.setHours(0, 0, 0, 0);
          periodKey = dayStart.toISOString().split('T')[0];
        } else {
          const weekStart = new Date(currentSleepStart);
          weekStart.setHours(0, 0, 0, 0);
          const dayOfWeek = weekStart.getDay();
          weekStart.setDate(weekStart.getDate() - dayOfWeek);
          periodKey = weekStart.toISOString().split('T')[0];
        }
        
        if (periodKey && dataMap.has(periodKey)) {
          dataMap.set(periodKey, dataMap.get(periodKey) + sleepHours);
        }
        
        currentSleepStart = null;
      }
    }
    
    // Handle ongoing sleep (if today or within timeframe)
    if (currentSleepStart && (startDate === null || currentSleepStart >= startDate)) {
      const now = new Date();
      const sleepHours = (now - currentSleepStart) / (1000 * 60 * 60);
      let periodKey;
      if (interval === 'daily') {
        const dayStart = new Date(currentSleepStart);
        dayStart.setHours(0, 0, 0, 0);
        periodKey = dayStart.toISOString().split('T')[0];
      } else {
        const weekStart = new Date(currentSleepStart);
        weekStart.setHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        periodKey = weekStart.toISOString().split('T')[0];
      }
      if (periodKey && dataMap.has(periodKey)) {
        dataMap.set(periodKey, dataMap.get(periodKey) + sleepHours);
      }
    }
  }
  
  // Update periods with actual values
  for (const period of periods) {
    period.value = dataMap.get(period.key) || 0;
  }
  
  return periods;
}

function updateChartBaby() {
  if (!elements.trendChartBaby || typeof Chart === 'undefined') return;
  
  const stat = elements.chartStatBaby.value;
  const interval = elements.chartIntervalBaby.value;
  const timeframe = elements.chartTimeframeBaby.value === 'all' ? null : parseInt(elements.chartTimeframeBaby.value);
  
  const data = aggregateDataForChart(stat, interval, timeframe);
  
  const labels = data.map(d => {
    const date = new Date(d.key);
    if (interval === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  });
  
  const values = data.map(d => d.value);
  
  const statLabels = {
    feed: 'Feed (oz)',
    sleep: 'Sleep (hours)',
    poop: 'Poop',
    pee: 'Pee',
    antibiotic: 'Antibiotic',
    wound_clean: 'Wound Clean',
    vit_d: 'Vit D Drop'
  };
  
  if (trendChartInstanceBaby) {
    trendChartInstanceBaby.destroy();
  }
  
  trendChartInstanceBaby = new Chart(elements.trendChartBaby, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: statLabels[stat] || stat,
        data: values,
        borderColor: '#0b84ff',
        backgroundColor: 'rgba(11, 132, 255, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function updateChartMama() {
  if (!elements.trendChartMama || typeof Chart === 'undefined') return;
  
  const stat = elements.chartStatMama.value;
  const interval = elements.chartIntervalMama.value;
  const timeframe = elements.chartTimeframeMama.value === 'all' ? null : parseInt(elements.chartTimeframeMama.value);
  
  const data = aggregateDataForChart(stat, interval, timeframe);
  
  const labels = data.map(d => {
    const date = new Date(d.key);
    if (interval === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  });
  
  const values = data.map(d => d.value);
  
  const statLabels = {
    pump: 'Pump (oz)',
    freeze: 'Freeze (oz)',
    h2o: 'H2O (oz)'
  };
  
  if (trendChartInstanceMama) {
    trendChartInstanceMama.destroy();
  }
  
  trendChartInstanceMama = new Chart(elements.trendChartMama, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: statLabels[stat] || stat,
        data: values,
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Chart control event listeners
elements.chartStatBaby.addEventListener('change', updateChartBaby);
elements.chartIntervalBaby.addEventListener('change', updateChartBaby);
elements.chartTimeframeBaby.addEventListener('change', updateChartBaby);

elements.chartStatMama.addEventListener('change', updateChartMama);
elements.chartIntervalMama.addEventListener('change', updateChartMama);
elements.chartTimeframeMama.addEventListener('change', updateChartMama);

// Initialize date picker to today
const today = new Date();
const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
elements.datePicker.value = todayStr;
elements.datePicker.addEventListener('change', (e) => {
  // Parse the date string in local timezone to avoid timezone issues
  const dateStr = e.target.value; // Format: YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  selectedDate = new Date(year, month - 1, day); // month is 0-indexed
  render();
});

// Initialize Firebase and start app
initFirebase().then(() => {
  // Set up daily email check
  setupDailyEmailCheck();
  // Initialize date picker after Firebase loads
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  elements.datePicker.value = todayStr;
  selectedDate = new Date();
  render();
  // Initialize charts after render
  setTimeout(() => {
    if (typeof Chart !== 'undefined') {
      updateChartBaby();
      updateChartMama();
    }
  }, 100);
}).catch(error => {
  console.error('Failed to initialize:', error);
  // Fallback: render with localStorage data
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  elements.datePicker.value = todayStr;
  selectedDate = new Date();
  render();
  // Initialize charts after render
  setTimeout(() => {
    if (typeof Chart !== 'undefined') {
      updateChartBaby();
      updateChartMama();
    }
  }, 100);
});

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Automatically detect the correct path for service worker
    // Works for both root domain and GitHub Pages subdirectory
    const path = window.location.pathname;
    const basePath = path.split('/').slice(0, -1).join('/') || '';
    const swPath = basePath + '/service-worker.js';
    
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}