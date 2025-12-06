// Eat-Poop-Sleep tracker (Firebase Firestore for cloud sync)
// Updated: Cloud storage with real-time sync across devices
const KEY = 'eps_events_v1';
const EVENTS_COLLECTION = 'events';

const elements = {
  btnSleep: document.getElementById('btn-sleep'),
  btnBreast: document.getElementById('btn-breast'),
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
  categoryFilter: document.getElementById('category-filter'),
  activityFilter: document.getElementById('activity-filter'),
  btnUndo: document.getElementById('btn-undo'),
  btnBulkImport: document.getElementById('btn-bulk-import'),
  btnExport: document.getElementById('btn-export'),
  btnExportSummary: document.getElementById('btn-export-summary'),
  btnClearCache: document.getElementById('btn-clear-cache'),
  btnRefreshSync: document.getElementById('btn-refresh-sync'),
  btnRefreshSync: document.getElementById('btn-refresh-sync'),
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
let breastfeeding = false;
let firestoreReady = false;
let unsubscribeFirestore = null;
let selectedDate = new Date(); // Default to today
let selectedCategory = 'all'; // Default to 'all' (Baby/Mama/All filter)
let selectedActivity = 'all'; // Default to 'all' (Activity type filter)
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
    breastfeeding = calcBreastfeedingFromEvents();
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
    breastfeeding = calcBreastfeedingFromEvents();
    render();
    
    // Set up real-time listener for sync across devices
    unsubscribeFirestore = onSnapshot(q, 
      (snapshot) => {
        console.log('Firebase snapshot received, document count:', snapshot.size);
        events = [];
        snapshot.forEach((doc) => {
          events.push({ id: doc.id, ...doc.data() });
        });
        // Ensure events are sorted by timestamp (newest first) after loading from Firebase
        events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        console.log('Events loaded from Firebase:', events.length);
        sleeping = calcSleepingFromEvents();
        breastfeeding = calcBreastfeedingFromEvents();
        render();
      },
      (error) => {
        console.error('Firebase real-time listener error:', error);
        alert('Error syncing data: ' + error.message + '\n\nPlease refresh the page to reconnect.');
      }
    );
    
    firestoreReady = true;
    console.log('Firebase connected, real-time sync enabled');
  } catch(error){
    console.error('Firebase initialization error:', error);
    // Fallback to localStorage
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    breastfeeding = calcBreastfeedingFromEvents();
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
  if(events.length === 0) return false;
  
  const now = new Date();
  
  // Get all sleep events and filter out future-dated events (they shouldn't exist, but just in case)
  const sleepEvents = events.filter(ev => {
    if(ev.type !== 'sleep_start' && ev.type !== 'sleep_end') return false;
    const evTime = new Date(ev.ts);
    // Only include events that are not in the future
    return evTime <= now;
  });
  
  if(sleepEvents.length === 0) return false;
  
  // Sort by timestamp, newest first
  sleepEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  
  // Find the most recent sleep_start and most recent sleep_end (from valid, non-future events)
  let mostRecentStart = null;
  let mostRecentEnd = null;
  
  for(const ev of sleepEvents){
    if(ev.type === 'sleep_start' && !mostRecentStart){
      mostRecentStart = ev;
    }
    if(ev.type === 'sleep_end' && !mostRecentEnd){
      mostRecentEnd = ev;
    }
    // Once we have both, we can stop searching
    if(mostRecentStart && mostRecentEnd) break;
  }
  
  // Determine state based on which is more recent
  if(mostRecentStart && mostRecentEnd){
    // If the most recent sleep_start is after the most recent sleep_end, we're sleeping
    const result = new Date(mostRecentStart.ts) > new Date(mostRecentEnd.ts);
    console.log('calcSleepingFromEvents: Most recent sleep_start:', mostRecentStart.ts, 'Most recent sleep_end:', mostRecentEnd.ts, '→ sleeping =', result);
    return result;
  }
  
  // If we only found a sleep_start (no sleep_end), we're sleeping
  if(mostRecentStart && !mostRecentEnd){
    console.log('calcSleepingFromEvents: Found sleep_start but no sleep_end → sleeping = true');
    return true;
  }
  
  // If we only found a sleep_end (no sleep_start), we're awake
  if(mostRecentEnd && !mostRecentStart){
    console.log('calcSleepingFromEvents: Found sleep_end but no sleep_start → sleeping = false');
  return false;
}

  // Fallback: should never reach here, but just in case
  return false;
}

// Determine breastfeeding state from most recent breast event
function calcBreastfeedingFromEvents(){
  // Sort events by timestamp, newest first, to find the most recent breast event
  const sorted = [...events].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  for(const ev of sorted){
    if(ev.type === 'breast_start') return true;
    if(ev.type === 'breast_end') return false;
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
  // Ensure timestamp is not in the future (use current time)
  const now = new Date();
  const ev = { id: Date.now().toString() + Math.random().toString(36).slice(2,6), type, ts: now.toISOString(), data };
  
  // Double-check: ensure timestamp is not in the future
  const eventTime = new Date(ev.ts);
  if(eventTime > now){
    console.warn('Event timestamp was in the future, correcting to current time');
    ev.ts = now.toISOString();
  }
  
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

// Delete all future-dated events (they shouldn't exist)
async function deleteFutureEvents(){
  const now = new Date();
  const futureEvents = events.filter(ev => {
    const evTime = new Date(ev.ts);
    return evTime > now;
  });
  
  if(futureEvents.length === 0){
    console.log('No future-dated events found.');
    return;
  }
  
  console.log(`Found ${futureEvents.length} future-dated event(s) to delete:`, futureEvents.map(e => ({type: e.type, ts: e.ts})));
  
  if(firestoreReady && isFirebaseAvailable()){
    try{
      const { collection, doc, deleteDoc } = window.firestoreFunctions;
      const eventsRef = collection(window.db, EVENTS_COLLECTION);
      
      const deletePromises = futureEvents.map(ev => {
        return deleteDoc(doc(eventsRef, ev.id));
      });
      
      await Promise.all(deletePromises);
      // Remove from local events array
      events = events.filter(ev => {
        const evTime = new Date(ev.ts);
        return evTime <= now;
      });
      // Recalculate states
      sleeping = calcSleepingFromEvents();
      breastfeeding = calcBreastfeedingFromEvents();
      // Real-time listener will update UI
      console.log(`Deleted ${futureEvents.length} future-dated event(s).`);
    } catch(error){
      console.error('Error deleting future events:', error);
      // Fallback: remove from local array
      events = events.filter(ev => {
        const evTime = new Date(ev.ts);
        return evTime <= now;
      });
      sleeping = calcSleepingFromEvents();
      breastfeeding = calcBreastfeedingFromEvents();
      save();
    }
  } else {
    // Remove from local array
    events = events.filter(ev => {
      const evTime = new Date(ev.ts);
      return evTime <= now;
    });
    sleeping = calcSleepingFromEvents();
    breastfeeding = calcBreastfeedingFromEvents();
    save();
    console.log(`Deleted ${futureEvents.length} future-dated event(s) from local storage.`);
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
    let breastHours = 0;
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
    
    // Calculate breast hours by pairing breast_start and breast_end
    const breastSessions = [];
    let currentBreastStart = null;
    
    for(const ev of dayEvents){
      if(ev.type === 'breast_start'){
        currentBreastStart = new Date(ev.ts);
      } else if(ev.type === 'breast_end' && currentBreastStart){
        const breastEnd = new Date(ev.ts);
        breastSessions.push({ start: currentBreastStart, end: breastEnd });
        currentBreastStart = null;
      }
    }
    
    // Calculate total breast hours for completed sessions on this day
    for(const session of breastSessions){
      const dayStart = new Date(dateKey + 'T00:00:00');
      const dayEnd = new Date(dateKey + 'T23:59:59.999');
      
      // Calculate the portion of breast session that occurred on this day
      const sessionStart = session.start < dayStart ? dayStart : session.start;
      const sessionEnd = session.end > dayEnd ? dayEnd : session.end;
      
      if(sessionEnd > sessionStart){
        const durationMs = sessionEnd - sessionStart;
        breastHours += durationMs / (1000 * 60 * 60);
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
    
    // Format average wake window in minutes
    const wakeWindowMinutes = Math.round(avgWakeWindow * 60);
    const wakeWindowStr = avgWakeWindow > 0 ? `, Avg wake window: ${wakeWindowMinutes} minutes` : '';
    
    // Format breast minutes
    const breastMinutes = Math.round(breastHours * 60);
    const breastMinutesStr = breastMinutes > 0 ? `${breastMinutes} minutes` : '0 minutes';
    
    // Build summary line
    const summary = `${dateStr}\nBaby Stats - Slept ${sleepHoursStr}${wakeWindowStr}, Breastfed ${breastMinutesStr}, Bottle Feed: ${feedOunces} oz, ${poopCount} ${poopCount === 1 ? 'poop' : 'poops'}, ${peeCount} ${peeCount === 1 ? 'pee' : 'pees'}, Antibiotic: ${antibioticCount}, Wound Clean: ${woundCleanCount}, Vit D: ${vitDCount}\nMama Stats - Pumped ${pumpOunces} oz, Froze ${freezeOunces} oz, Drank ${h2oOunces} oz\n`;
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
  console.log('=== toggleSleep called ===');
  console.log('Current sleeping state:', sleeping);
  console.log('Events before toggle:', events.filter(e => e.type === 'sleep_start' || e.type === 'sleep_end').map(e => ({type: e.type, ts: e.ts})).slice(0, 5));
  
  const eventTypeToAdd = !sleeping ? 'sleep_start' : 'sleep_end';
  console.log('Adding event:', eventTypeToAdd);
  
  addEvent(eventTypeToAdd, {});
  
  // Give addEvent a moment to add the event to the array, then recalculate
  // Note: addEvent() adds the event synchronously to the events array before calling save()
  sleeping = calcSleepingFromEvents();
  
  console.log('Events after toggle (first 5):', events.filter(e => e.type === 'sleep_start' || e.type === 'sleep_end').map(e => ({type: e.type, ts: e.ts})).slice(0, 5));
  console.log('New sleeping state:', sleeping);
  console.log('Button should now show:', sleeping ? 'Wake' : 'Sleep');
  console.log('=== end toggleSleep ===');
  
  render();
}

function toggleBreast(){
  if(!breastfeeding){
    addEvent('breast_start', {});
  }else{
    addEvent('breast_end', {});
  }
  // Recalculate breastfeeding state from events to ensure accuracy
  breastfeeding = calcBreastfeedingFromEvents();
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
  
  // Prevent future timestamps - only allow current or past times
  const now = new Date();
  if(newDate > now){
    alert('Cannot set event time in the future. Please use current or past time.');
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
  // Recalculate sleeping and breastfeeding state from events before rendering
  // This ensures the state is always accurate, even if events were updated externally
  sleeping = calcSleepingFromEvents();
  breastfeeding = calcBreastfeedingFromEvents();
  
  // sleep status
  elements.sleepStatus.textContent = sleeping ? 'Sleeping' : 'Awake';
  // update sleep button text
  elements.btnSleep.textContent = sleeping ? 'Wake' : 'Sleep';
  // update breast button text
  elements.btnBreast.textContent = breastfeeding ? 'Stop Breastfeed' : 'Breastfeed';

  // stats: counts for selected date (from 00:00:00 to 23:59:59.999 in local timezone)
  // Use local timezone to avoid timezone conversion issues
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();
  const dateStart = new Date(year, month, day, 0, 0, 0, 0);
  const dateEnd = new Date(year, month, day, 23, 59, 59, 999);
  const counts = { pee:0, poop:0, feedOunces:0, sleepHours:0, breastHours:0, wakeWindows:[], pumpOunces:0, freezeOunces:0, h2oOunces:0, antibiotic:0, woundClean:0, vitD:0 };
  
  // Get all events from selected date, sorted chronologically
  // Also include events from the day before to catch wake windows that span dates
  const prevDayStart = new Date(dateStart);
  prevDayStart.setDate(prevDayStart.getDate() - 1);
  
  const recentEvents = events.filter(ev => {
    const evDate = new Date(ev.ts);
    return evDate >= prevDayStart && evDate <= dateEnd;
  }).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  // Calculate sleep hours, breast hours, and wake windows
  let currentSleepStart = null;
  let lastSleepEnd = null;
  let currentBreastStart = null;
  
  for(const ev of recentEvents){
    const t = new Date(ev.ts);
    
    if(ev.type === 'sleep_start'){
      // If there was a previous sleep_end, calculate wake window
      // Only count wake windows that end on the selected date (sleep_start on selected date)
      if(lastSleepEnd && t >= dateStart && t <= dateEnd){
        const wakeDuration = t - lastSleepEnd;
        const wakeHours = wakeDuration / (1000 * 60 * 60);
        counts.wakeWindows.push(wakeHours);
      }
      currentSleepStart = t;
      lastSleepEnd = null;
    } else if(ev.type === 'sleep_end' && currentSleepStart){
      const sleepDuration = t - currentSleepStart;
      const sleepHours = sleepDuration / (1000 * 60 * 60);
      // Only count sleep hours that occur on the selected date
      if(t >= dateStart && t <= dateEnd){
        counts.sleepHours += sleepHours;
      }
      lastSleepEnd = t;
      currentSleepStart = null;
    } else if(ev.type === 'breast_start'){
      currentBreastStart = t;
    } else if(ev.type === 'breast_end' && currentBreastStart){
      const breastDuration = t - currentBreastStart;
      const breastHours = breastDuration / (1000 * 60 * 60);
      // Only count breast hours that occur on the selected date
      if(t >= dateStart && t <= dateEnd){
        counts.breastHours += breastHours;
      }
      currentBreastStart = null;
    }
    
    // Count other events - only count events that occur on the selected date
    if(t >= dateStart && t <= dateEnd){
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
  
  // Handle ongoing breast session (breast_start without matching breast_end)
  if(currentBreastStart && isToday){
    const breastDuration = now - currentBreastStart;
    const breastHours = breastDuration / (1000 * 60 * 60);
    counts.breastHours += breastHours;
  }
  
  // Calculate average wake window
  let avgWakeWindow = 0;
  if(counts.wakeWindows.length > 0){
    const totalWake = counts.wakeWindows.reduce((sum, w) => sum + w, 0);
    avgWakeWindow = totalWake / counts.wakeWindows.length;
  }
  
  const sleepHoursStr = counts.sleepHours > 0 ? `${counts.sleepHours.toFixed(1)}h` : '0h';
  const breastMinutes = Math.round(counts.breastHours * 60);
  const breastMinutesStr = breastMinutes > 0 ? `${breastMinutes}m` : '0m';
  const wakeWindowMinutes = Math.round(avgWakeWindow * 60);
  const wakeWindowStr = avgWakeWindow > 0 ? `Avg wake: ${wakeWindowMinutes}m` : 'No wake windows';
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const babyStatText = `${dateStr} — Pee: ${counts.pee}, Poop: ${counts.poop}, Bottle Feed: ${counts.feedOunces}oz, Breastfeed: ${breastMinutesStr}, Sleep: ${sleepHoursStr}, ${wakeWindowStr}, Antibiotic: ${counts.antibiotic}, Wound Clean: ${counts.woundClean}, Vit D: ${counts.vitD}`;
  const mamaStatText = `${dateStr} — Pump: ${counts.pumpOunces}oz, Freeze: ${counts.freezeOunces}oz, H2O: ${counts.h2oOunces}oz`;
  elements.statsBaby.textContent = babyStatText;
  elements.statsMama.textContent = mamaStatText;

  // Daily Log - show only events from selected date, category, and activity
  elements.history.innerHTML = '';
  console.log('Total events:', events.length);
  
  // Helper function to determine if an event is Baby or Mama
  const isBabyEvent = (ev) => {
    const babyTypes = ['sleep_start', 'sleep_end', 'breast_start', 'breast_end', 'feed', 'poop', 'pee', 'antibiotic', 'wound_clean', 'vit_d', 'sleep_session', 'breast_session'];
    return babyTypes.includes(ev.type);
  };
  
  // Helper function to get the activity type for an event
  const getActivityType = (ev) => {
    if(ev.type === 'sleep_session' || ev.type === 'sleep_start' || ev.type === 'sleep_end') return 'sleep';
    if(ev.type === 'breast_session' || ev.type === 'breast_start' || ev.type === 'breast_end') return 'breastfeed';
    if(ev.type === 'feed') return 'bottle_feed';
    if(ev.type === 'poop') return 'poop';
    if(ev.type === 'pee') return 'pee';
    if(ev.type === 'pump') return 'pump';
    if(ev.type === 'freeze') return 'freeze';
    if(ev.type === 'h2o') return 'h2o';
    if(ev.type === 'antibiotic') return 'antibiotic';
    if(ev.type === 'wound_clean') return 'wound_clean';
    if(ev.type === 'vit_d') return 'vit_d';
    return ev.type;
  };
  
  const allLogEvents = events.filter(ev => {
    const evDate = new Date(ev.ts);
    const dateMatch = evDate >= dateStart && evDate <= dateEnd;
    
    // Apply category filter
    let categoryMatch = true;
    if(selectedCategory === 'baby'){
      categoryMatch = isBabyEvent(ev);
    } else if(selectedCategory === 'mama'){
      categoryMatch = !isBabyEvent(ev);
    }
    
    // Apply activity filter
    let activityMatch = true;
    if(selectedActivity !== 'all'){
      activityMatch = getActivityType(ev) === selectedActivity;
    }
    
    return dateMatch && categoryMatch && activityMatch;
  }).sort((a, b) => new Date(a.ts) - new Date(b.ts)); // Sort chronologically for pairing
  console.log('Filtered events for selected date, category, and activity:', allLogEvents.length);
  
  // Pair up sleep and breast sessions
  const processedEvents = [];
  const usedEventIds = new Set();
  
  // First, pair up completed sessions
  for(let i = 0; i < allLogEvents.length; i++){
    const eventId = allLogEvents[i].id;
    if(!eventId){
      console.warn('Event missing ID:', allLogEvents[i]);
      // Add events without IDs directly
      processedEvents.push(allLogEvents[i]);
      continue;
    }
    if(usedEventIds.has(eventId)) continue;
    
    const ev = allLogEvents[i];
    
    // Check for sleep sessions
    if(ev.type === 'sleep_start'){
      // Look for matching sleep_end
      let endEvent = null;
      for(let j = i + 1; j < allLogEvents.length; j++){
        if(allLogEvents[j].type === 'sleep_end' && !usedEventIds.has(allLogEvents[j].id)){
          endEvent = allLogEvents[j];
          usedEventIds.add(endEvent.id);
          break;
        }
      }
      
      if(endEvent){
        // Create a combined session event
        processedEvents.push({
          type: 'sleep_session',
          startEvent: ev,
          endEvent: endEvent,
          ts: ev.ts, // Use start time for sorting
          id: ev.id + '_session' // Unique ID for the session
        });
        usedEventIds.add(ev.id);
        continue;
      }
      // If no end event found, fall through to add the start event as-is
    }
    
    // Check for breast sessions
    if(ev.type === 'breast_start'){
      // Look for matching breast_end
      let endEvent = null;
      for(let j = i + 1; j < allLogEvents.length; j++){
        if(allLogEvents[j].type === 'breast_end' && !usedEventIds.has(allLogEvents[j].id)){
          endEvent = allLogEvents[j];
          usedEventIds.add(endEvent.id);
          break;
        }
      }
      
      if(endEvent){
        // Create a combined session event
        processedEvents.push({
          type: 'breast_session',
          startEvent: ev,
          endEvent: endEvent,
          ts: ev.ts, // Use start time for sorting
          id: ev.id + '_session' // Unique ID for the session
        });
        usedEventIds.add(ev.id);
        continue;
      }
      // If no end event found, fall through to add the start event as-is
    }
    
    // Skip sleep_end and breast_end that are already paired (in usedEventIds)
    if(ev.type === 'sleep_end' || ev.type === 'breast_end'){
      if(usedEventIds.has(ev.id)){
        continue; // Already paired, skip it
      }
      // If not paired, it's an orphaned end event - show it as-is
    }
    
    // For unpaired start events, orphaned end events, or other events, add them as-is
    if(!usedEventIds.has(ev.id)){
      processedEvents.push(ev);
    }
  }
  
  // Sort by timestamp, most recent first
  processedEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  console.log('Processed events to display:', processedEvents.length);
  
  for(const ev of processedEvents){
    const li = document.createElement('li');
    const left = document.createElement('div');
    const right = document.createElement('div');
    
    // Create label with editable amount
    const label = document.createElement('div');
    label.className = 'event-label';
    
    // Handle session events (paired start/end)
    if(ev.type === 'sleep_session' || ev.type === 'breast_session'){
      const sessionType = ev.type === 'sleep_session' ? 'Sleep Session' : 'Breastfeed Session';
      label.textContent = `Baby - ${sessionType}`;
      
      const meta = document.createElement('div');
      meta.className = 'event-meta';
      // Format time range: extract just the time part (HH:mm format)
      const startTimeOnly = new Date(ev.startEvent.ts).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false});
      const endTimeOnly = new Date(ev.endEvent.ts).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false});
      meta.textContent = `${startTimeOnly} - ${endTimeOnly}`;
      meta.style.cursor = 'pointer';
      meta.style.textDecoration = 'underline';
      meta.title = 'Click to edit times';
      meta.onclick = () => {
        // When editing a session, allow editing both start and end times
        // Use the same format as regular events: YYYY-MM-DD HH:MM
        const now = new Date();
        
        // Format start time for prompt (same format as regular events: YYYY-MM-DD HH:MM)
        const startDate = new Date(ev.startEvent.ts);
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startHours = String(startDate.getHours()).padStart(2, '0');
        const startMinutes = String(startDate.getMinutes()).padStart(2, '0');
        const startDateTimeLocal = `${startYear}-${startMonth}-${startDay}T${startHours}:${startMinutes}`;
        
        const startTimeStr = prompt('Edit start time (YYYY-MM-DD HH:MM):', startDateTimeLocal.replace('T', ' '));
        if(startTimeStr){
          // Parse the input - handle both "YYYY-MM-DD HH:MM" and "YYYY-MM-DDTHH:MM" formats
          const startDateTimeStr = startTimeStr.replace(' ', 'T');
          const newStartDate = new Date(startDateTimeStr);
          if(isNaN(newStartDate.getTime())){
            alert('Invalid date/time format. Please use YYYY-MM-DD HH:MM');
            return;
          }
          if(newStartDate > now){
            alert('Cannot set start time in the future. Please use current or past time.');
            return;
          }
          ev.startEvent.ts = newStartDate.toISOString();
          save();
        }
        
        // Format end time for prompt (same format as regular events: YYYY-MM-DD HH:MM)
        const endDate = new Date(ev.endEvent.ts);
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        const endDateTimeLocal = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;
        
        const endTimeStr = prompt('Edit end time (YYYY-MM-DD HH:MM):', endDateTimeLocal.replace('T', ' '));
        if(endTimeStr){
          // Parse the input - handle both "YYYY-MM-DD HH:MM" and "YYYY-MM-DDTHH:MM" formats
          const endDateTimeStr = endTimeStr.replace(' ', 'T');
          const newEndDate = new Date(endDateTimeStr);
          if(isNaN(newEndDate.getTime())){
            alert('Invalid date/time format. Please use YYYY-MM-DD HH:MM');
            return;
          }
          if(newEndDate > now){
            alert('Cannot set end time in the future. Please use current or past time.');
            return;
          }
          ev.endEvent.ts = newEndDate.toISOString();
          save();
        }
      };
      
      left.appendChild(label);
      left.appendChild(meta);
      
      const del = document.createElement('button');
      del.textContent = '⋯';
      del.title = 'Delete';
      del.onclick = async () => {
        if(confirm('Delete this session?')){
          // Delete both start and end events
          if(firestoreReady && isFirebaseAvailable()){
            try{
              const { collection, doc, deleteDoc } = window.firestoreFunctions;
              await deleteDoc(doc(collection(window.db, EVENTS_COLLECTION), ev.startEvent.id));
              await deleteDoc(doc(collection(window.db, EVENTS_COLLECTION), ev.endEvent.id));
              // Real-time listener will update UI
            } catch(error){
              console.error('Firestore delete error:', error);
              events = events.filter(x => x.id !== ev.startEvent.id && x.id !== ev.endEvent.id);
              save();
            }
          } else {
            events = events.filter(x => x.id !== ev.startEvent.id && x.id !== ev.endEvent.id);
            save();
          }
        }
      };
      
      li.appendChild(left);
      li.appendChild(del);
      elements.history.appendChild(li);
      continue;
    }
    
    // Handle regular events (non-session)
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
    return `Baby - Bottle Feed${amt}`;
  }
  if(ev.type === 'breast_start') return 'Baby - Breastfeed — start';
  if(ev.type === 'breast_end') return 'Baby - Breastfeed — end';
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

elements.btnBreast.addEventListener('click', toggleBreast);

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

// Bulk import historical events
function bulkImportEvents(){
  console.log('bulkImportEvents called');
  const modal = document.getElementById('bulk-import-modal');
  const rowsContainer = document.getElementById('bulk-import-rows');
  const addRowBtn = document.getElementById('bulk-import-add-row');
  const cancelBtn = document.getElementById('bulk-import-cancel');
  const submitBtn = document.getElementById('bulk-import-submit');
  
  if(!modal || !rowsContainer || !addRowBtn || !cancelBtn || !submitBtn){
    console.error('Modal elements not found:', {modal, rowsContainer, addRowBtn, cancelBtn, submitBtn});
    alert('Error: Bulk import modal elements not found. Please refresh the page.');
    return;
  }
  
  // Clear existing rows
  rowsContainer.innerHTML = '';
  
  // Add first row
  addBulkImportRow(rowsContainer);
  
  // Show modal
  modal.style.display = 'flex';
  
  // Close modal function
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  // Cancel button
  cancelBtn.onclick = closeModal;
  
  // Add row button
  addRowBtn.onclick = () => {
    addBulkImportRow(rowsContainer);
  };
  
  // Submit button
  submitBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Submit button clicked');
    try {
      await processBulkImportFromForm(rowsContainer);
      closeModal();
    } catch(error) {
      console.error('Error in bulk import:', error);
      alert('Error importing events: ' + error.message);
    }
  };
  
  // Close on background click
  modal.onclick = (e) => {
    if(e.target === modal) closeModal();
  };
}

// Add a new row to the bulk import form
function addBulkImportRow(container){
  const row = document.createElement('div');
  row.className = 'bulk-import-row';
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px; align-items: center; padding: 8px; background: #f9f9f9; border-radius: 6px;';
  
  const rowId = Date.now() + Math.random().toString(36).slice(2, 6);
  
  // Date input
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'bulk-import-date';
  dateInput.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;';
  const today = new Date();
  dateInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  
  // Time input
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'bulk-import-time';
  timeInput.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;';
  const now = new Date();
  timeInput.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  
  // Action dropdown
  const actionSelect = document.createElement('select');
  actionSelect.className = 'bulk-import-action';
  actionSelect.style.cssText = 'flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 4px;';
  actionSelect.innerHTML = `
    <option value="">Select action...</option>
    <optgroup label="Baby Stats">
      <option value="sleep_start">Sleep - Start</option>
      <option value="sleep_end">Sleep - End</option>
      <option value="breast_start">Breastfeed - Start</option>
      <option value="breast_end">Breastfeed - End</option>
      <option value="feed">Bottle Feed</option>
      <option value="poop">Poop</option>
      <option value="pee">Pee</option>
      <option value="antibiotic">Antibiotic</option>
      <option value="wound_clean">Wound Clean</option>
      <option value="vit_d">Vit D Drop</option>
    </optgroup>
    <optgroup label="Mama Stats">
      <option value="pump">Pump</option>
      <option value="freeze">Freeze</option>
      <option value="h2o">H2O</option>
    </optgroup>
  `;
  
  // Amount input (shown conditionally)
  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.step = '0.5';
  amountInput.min = '0';
  amountInput.placeholder = 'Amount (oz)';
  amountInput.className = 'bulk-import-amount';
  amountInput.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; display: none;';
  
  // Show/hide amount input based on action
  actionSelect.addEventListener('change', () => {
    const needsAmount = ['feed', 'pump', 'freeze', 'h2o'].includes(actionSelect.value);
    amountInput.style.display = needsAmount ? 'block' : 'none';
    if(needsAmount && !amountInput.value){
      // Set default amounts
      if(actionSelect.value === 'feed' || actionSelect.value === 'pump') amountInput.value = '0.5';
      else if(actionSelect.value === 'freeze') amountInput.value = '1';
      else if(actionSelect.value === 'h2o') amountInput.value = '40';
    }
  });
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.style.cssText = 'width: 32px; height: 32px; padding: 0; border: 1px solid #ddd; background: #ff6b6b; color: white; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1;';
  deleteBtn.onclick = () => {
    row.remove();
  };
  
  row.appendChild(dateInput);
  row.appendChild(timeInput);
  row.appendChild(actionSelect);
  row.appendChild(amountInput);
  row.appendChild(deleteBtn);
  
  container.appendChild(row);
}

// Process bulk import from form rows
async function processBulkImportFromForm(rowsContainer){
  console.log('processBulkImportFromForm called', rowsContainer);
  if(!rowsContainer){
    alert('Error: Form container not found');
    return;
  }
  
  const rows = rowsContainer.querySelectorAll('.bulk-import-row');
  console.log('Found rows:', rows.length);
  const now = new Date();
  const importedEvents = [];
  const errors = [];
  
  for(let i = 0; i < rows.length; i++){
    const row = rows[i];
    const dateInput = row.querySelector('.bulk-import-date');
    const timeInput = row.querySelector('.bulk-import-time');
    const actionSelect = row.querySelector('.bulk-import-action');
    const amountInput = row.querySelector('.bulk-import-amount');
    
    // Skip empty rows
    if(!actionSelect || !actionSelect.value){
      continue;
    }
    
    try {
      // Get date and time
      const dateStr = dateInput ? dateInput.value : '';
      const timeStr = timeInput ? timeInput.value : '';
      
      if(!dateStr || !timeStr){
        errors.push(`Row ${i+1}: Date and time are required`);
        continue;
      }
      
      // Combine date and time
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const date = new Date(year, month - 1, day, hour, minute);
      
      if(isNaN(date.getTime())){
        errors.push(`Row ${i+1}: Invalid date/time`);
        continue;
      }
      
      if(date > now){
        errors.push(`Row ${i+1}: Date/time is in the future`);
        continue;
      }
      
      // Get event type
      const eventType = actionSelect.value;
      
      // Create event data
      const eventData = {};
      const needsAmount = ['feed', 'pump', 'freeze', 'h2o'].includes(eventType);
      if(needsAmount){
        const amount = amountInput ? parseFloat(amountInput.value) : 0;
        if(isNaN(amount) || amount <= 0){
          errors.push(`Row ${i+1}: Valid amount required for ${eventType}`);
          continue;
        }
        eventData.amount = amount;
      }
      
      // Create event
      const ev = {
        id: Date.now().toString() + Math.random().toString(36).slice(2,6) + '_' + i,
        type: eventType,
        ts: date.toISOString(),
        data: eventData
      };
      
      importedEvents.push(ev);
    } catch(error){
      errors.push(`Row ${i+1}: Error - ${error.message}`);
    }
  }
  
  if(importedEvents.length === 0){
    alert('No valid events to import.\n\nPlease fill in at least one row with an action selected.' + (errors.length > 0 ? '\n\nErrors:\n' + errors.join('\n') : ''));
    return;
  }
  
  // Show summary and ask for confirmation
  const summary = `Found ${importedEvents.length} valid event(s) to import.`;
  const errorMsg = errors.length > 0 ? `\n\n${errors.length} error(s) encountered:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` : '';
  
  if(!confirm(summary + errorMsg + '\n\nImport these events?')){
    return;
  }
  
  // Add events to the array
  events = [...importedEvents, ...events];
  
  // Re-sort by timestamp (newest first)
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  
  // Recalculate states
  sleeping = calcSleepingFromEvents();
  breastfeeding = calcBreastfeedingFromEvents();
  
  // Save
  await save();
  
  alert(`Successfully imported ${importedEvents.length} event(s)!`);
  render();
}

if(elements.btnBulkImport){
  elements.btnBulkImport.addEventListener('click', (e) => {
    console.log('Bulk import button clicked');
    e.preventDefault();
    bulkImportEvents();
  });
  console.log('Bulk import button event listener attached');
} else {
  console.error('Bulk import button not found in DOM');
}

elements.btnClearCache.addEventListener('click', async () => {
  if(confirm('This will clear the cache and reload the page. Continue?')){
    // Clear all caches
    if('caches' in window){
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // Unregister service worker
    if('serviceWorker' in navigator){
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    // Reload the page
    window.location.reload(true);
  }
});

// Refresh sync button - manually reload data from Firebase
if(elements.btnRefreshSync){
  elements.btnRefreshSync.addEventListener('click', async () => {
    if(!isFirebaseAvailable()){
      alert('Firebase is not available. Please check your connection.');
      return;
    }
    
    try {
      console.log('Manually refreshing data from Firebase...');
      const { collection, getDocs, query, orderBy } = window.firestoreFunctions;
      const eventsRef = collection(window.db, EVENTS_COLLECTION);
      const q = query(eventsRef, orderBy('ts', 'desc'));
      const snapshot = await getDocs(q);
      
      events = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() });
      });
      events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      
      console.log('Refreshed', events.length, 'events from Firebase');
      sleeping = calcSleepingFromEvents();
      breastfeeding = calcBreastfeedingFromEvents();
      render();
      
      alert(`Successfully refreshed ${events.length} events from Firebase.`);
    } catch(error) {
      console.error('Error refreshing from Firebase:', error);
      alert('Error refreshing data: ' + error.message);
    }
  });
}

elements.btnExport.addEventListener('click', exportCSV);
elements.btnExportSummary.addEventListener('click', exportDailySummary);

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
        const key = formatDateLocal(date);
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
        const key = formatDateLocal(date);
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
        const key = formatDateLocal(date);
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
        const key = formatDateLocal(date);
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
      periodKey = formatDateLocal(dayStart);
    } else if (interval === 'weekly') {
      const weekStart = new Date(evDate);
      weekStart.setHours(0, 0, 0, 0);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      periodKey = formatDateLocal(weekStart);
    }
    
    if (!periodKey || !dataMap.has(periodKey)) continue;
    
    let value = 0;
    
    if (stat === 'feed' && ev.type === 'feed') {
      value = (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    } else if (stat === 'sleep' && (ev.type === 'sleep_start' || ev.type === 'sleep_end')) {
      // Sleep requires special handling - we'll calculate hours between sleep_start and sleep_end
      // For now, we'll track this separately
      continue; // Skip for now, will handle below
    } else if (stat === 'breast' && (ev.type === 'breast_start' || ev.type === 'breast_end')) {
      // Breast requires special handling - we'll calculate hours between breast_start and breast_end
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
          periodKey = formatDateLocal(dayStart);
        } else {
          const weekStart = new Date(currentSleepStart);
          weekStart.setHours(0, 0, 0, 0);
          const dayOfWeek = weekStart.getDay();
          weekStart.setDate(weekStart.getDate() - dayOfWeek);
          periodKey = formatDateLocal(weekStart);
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
        periodKey = formatDateLocal(dayStart);
      } else {
        const weekStart = new Date(currentSleepStart);
        weekStart.setHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        periodKey = formatDateLocal(weekStart);
      }
      if (periodKey && dataMap.has(periodKey)) {
        dataMap.set(periodKey, dataMap.get(periodKey) + sleepHours);
      }
    }
  }
  
  // Handle breast hours calculation
  if (stat === 'breast') {
    const breastSessions = [];
    let currentBreastStart = null;
    
    for (const ev of relevantEvents.sort((a, b) => new Date(a.ts) - new Date(b.ts))) {
      if (ev.type === 'breast_start') {
        currentBreastStart = new Date(ev.ts);
      } else if (ev.type === 'breast_end' && currentBreastStart) {
        const breastEnd = new Date(ev.ts);
        const breastHours = (breastEnd - currentBreastStart) / (1000 * 60 * 60);
        const breastMinutes = Math.round(breastHours * 60); // Convert to minutes
        
        // Determine which period this breast session belongs to
        let periodKey;
        if (interval === 'daily') {
          const dayStart = new Date(currentBreastStart);
          dayStart.setHours(0, 0, 0, 0);
          periodKey = formatDateLocal(dayStart);
        } else {
          const weekStart = new Date(currentBreastStart);
          weekStart.setHours(0, 0, 0, 0);
          const dayOfWeek = weekStart.getDay();
          weekStart.setDate(weekStart.getDate() - dayOfWeek);
          periodKey = formatDateLocal(weekStart);
        }
        
        if (periodKey && dataMap.has(periodKey)) {
          dataMap.set(periodKey, dataMap.get(periodKey) + breastMinutes);
        }
        
        currentBreastStart = null;
      }
    }
    
    // Handle ongoing breast session (if today or within timeframe)
    if (currentBreastStart && (startDate === null || currentBreastStart >= startDate)) {
      const now = new Date();
      const breastHours = (now - currentBreastStart) / (1000 * 60 * 60);
      const breastMinutes = Math.round(breastHours * 60); // Convert to minutes
      let periodKey;
      if (interval === 'daily') {
        const dayStart = new Date(currentBreastStart);
        dayStart.setHours(0, 0, 0, 0);
        periodKey = formatDateLocal(dayStart);
      } else {
        const weekStart = new Date(currentBreastStart);
        weekStart.setHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        periodKey = formatDateLocal(weekStart);
      }
      if (periodKey && dataMap.has(periodKey)) {
        dataMap.set(periodKey, dataMap.get(periodKey) + breastMinutes);
      }
    }
  }
  
  // Handle average wake windows calculation
  if (stat === 'avg_wake_window') {
    // Initialize wake windows array for each period
    const wakeWindowsByPeriod = new Map();
    for (const period of periods) {
      wakeWindowsByPeriod.set(period.key, []);
    }
    
    let lastSleepEnd = null;
    let currentSleepStart = null;
    
    for (const ev of relevantEvents.sort((a, b) => new Date(a.ts) - new Date(b.ts))) {
      const evDate = new Date(ev.ts);
      
      if (ev.type === 'sleep_start') {
        // If there was a previous sleep_end, calculate wake window
        if (lastSleepEnd) {
          const wakeDuration = evDate - lastSleepEnd;
          const wakeHours = wakeDuration / (1000 * 60 * 60);
          
          // Determine which period this wake window belongs to
          // Assign to the period where the sleep_start occurs (when baby wakes up)
          let periodKey;
          if (interval === 'daily') {
            const dayStart = new Date(evDate);
            dayStart.setHours(0, 0, 0, 0);
            periodKey = formatDateLocal(dayStart);
          } else {
            const weekStart = new Date(evDate);
            weekStart.setHours(0, 0, 0, 0);
            const dayOfWeek = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            periodKey = formatDateLocal(weekStart);
          }
          
          if (periodKey && wakeWindowsByPeriod.has(periodKey)) {
            wakeWindowsByPeriod.get(periodKey).push(wakeHours);
          }
        }
        currentSleepStart = evDate;
        lastSleepEnd = null;
      } else if (ev.type === 'sleep_end' && currentSleepStart) {
        lastSleepEnd = evDate;
        currentSleepStart = null;
      }
    }
    
    // Calculate average wake window for each period (in minutes)
    for (const period of periods) {
      const wakeWindows = wakeWindowsByPeriod.get(period.key) || [];
      if (wakeWindows.length > 0) {
        const avgWakeWindowHours = wakeWindows.reduce((sum, w) => sum + w, 0) / wakeWindows.length;
        const avgWakeWindowMinutes = Math.round(avgWakeWindowHours * 60);
        dataMap.set(period.key, avgWakeWindowMinutes);
      } else {
        dataMap.set(period.key, 0);
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
    // Parse the date string (YYYY-MM-DD) in local timezone
    const [year, month, day] = d.key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (interval === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  });
  
  const values = data.map(d => d.value);
  
  const statLabels = {
    feed: 'Bottle (oz)',
    breast: 'Breastfeed (minutes)',
    sleep: 'Sleep (hours)',
    avg_wake_window: 'Avg Wake Windows (minutes)',
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
        },
        datalabels: {
          display: true,
          color: '#374151',
          anchor: 'end',
          align: 'top',
          formatter: function(value) {
            if (value === 0) return '';
            // Format based on stat type
            if (stat === 'feed' || stat === 'pump' || stat === 'freeze' || stat === 'h2o') {
              return value.toFixed(1);
            } else if (stat === 'sleep') {
              return value.toFixed(1) + 'h';
            } else if (stat === 'avg_wake_window') {
              return Math.round(value) + 'm';
            } else if (stat === 'breast') {
              return Math.round(value) + 'm';
            } else {
              return Math.round(value);
            }
          },
          font: {
            size: 10,
            weight: 'bold'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function updateChartMama() {
  if (!elements.trendChartMama || typeof Chart === 'undefined') return;
  
  const stat = elements.chartStatMama.value;
  const interval = elements.chartIntervalMama.value;
  const timeframe = elements.chartTimeframeMama.value === 'all' ? null : parseInt(elements.chartTimeframeMama.value);
  
  const data = aggregateDataForChart(stat, interval, timeframe);
  
  const labels = data.map(d => {
    // Parse the date string (YYYY-MM-DD) in local timezone
    const [year, month, day] = d.key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
        },
        datalabels: {
          display: true,
          color: '#374151',
          anchor: 'end',
          align: 'top',
          formatter: function(value) {
            if (value === 0) return '';
            // Format based on stat type
            if (stat === 'feed' || stat === 'pump' || stat === 'freeze' || stat === 'h2o') {
              return value.toFixed(1);
            } else if (stat === 'sleep') {
              return value.toFixed(1) + 'h';
            } else {
              return Math.round(value);
            }
          },
          font: {
            size: 10,
            weight: 'bold'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    },
    plugins: [ChartDataLabels]
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

// Category filter event listener
if(elements.categoryFilter){
  elements.categoryFilter.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    updateActivityFilterOptions();
    selectedActivity = 'all'; // Reset activity filter when category changes
    if(elements.activityFilter) elements.activityFilter.value = 'all';
    render();
  });
}

// Activity filter options based on category
function updateActivityFilterOptions(){
  if(!elements.activityFilter) return;
  
  const currentValue = elements.activityFilter.value;
  elements.activityFilter.innerHTML = '<option value="all">All Activities</option>';
  
  if(selectedCategory === 'baby' || selectedCategory === 'all'){
    elements.activityFilter.innerHTML += `
      <option value="sleep">Sleep</option>
      <option value="breastfeed">Breastfeed</option>
      <option value="bottle_feed">Bottle Feed</option>
      <option value="poop">Poop</option>
      <option value="pee">Pee</option>
      <option value="antibiotic">Antibiotic</option>
      <option value="wound_clean">Wound Clean</option>
      <option value="vit_d">Vit D Drop</option>
    `;
  }
  
  if(selectedCategory === 'mama' || selectedCategory === 'all'){
    elements.activityFilter.innerHTML += `
      <option value="pump">Pump</option>
      <option value="freeze">Freeze</option>
      <option value="h2o">H2O</option>
    `;
  }
  
  // Try to restore previous selection if it still exists
  if(currentValue !== 'all' && Array.from(elements.activityFilter.options).some(opt => opt.value === currentValue)){
    elements.activityFilter.value = currentValue;
    selectedActivity = currentValue;
  } else {
    elements.activityFilter.value = 'all';
    selectedActivity = 'all';
  }
}

// Activity filter event listener
if(elements.activityFilter){
  elements.activityFilter.addEventListener('change', (e) => {
    selectedActivity = e.target.value;
    render();
  });
}

// Initialize Firebase and start app
initFirebase().then(() => {
  // Set up daily email check
  setupDailyEmailCheck();
  // Initialize date picker after Firebase loads
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  elements.datePicker.value = todayStr;
  selectedDate = new Date();
  // Initialize activity filter options
  updateActivityFilterOptions();
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