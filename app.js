// Eat-Poop-Sleep tracker (GitHub Gists for cloud sync)
// Updated: Cloud storage using GitHub Gists API
const KEY = 'eps_events_v1';
const GIST_FILENAME = 'eps-events.json';
const GIST_CONFIG_KEY = 'github_gist_config';

const elements = {
  btnSleep: document.getElementById('btn-sleep'),
  btnFeed: document.getElementById('btn-feed'),
  btnPoop: document.getElementById('btn-poop'),
  btnPee: document.getElementById('btn-pee'),
  btnPump: document.getElementById('btn-pump'),
  btnFreeze: document.getElementById('btn-freeze'),
  btnH2O: document.getElementById('btn-h2o'),
  history: document.getElementById('history'),
  stats: document.getElementById('stats'),
  sleepStatus: document.getElementById('sleep-status'),
  btnUndo: document.getElementById('btn-undo'),
  btnExport: document.getElementById('btn-export'),
  btnExportSummary: document.getElementById('btn-export-summary'),
  btnExportData: document.getElementById('btn-export-data'),
  btnImportData: document.getElementById('btn-import-data'),
  btnSetupGitHub: document.getElementById('btn-setup-github'),
  btnMigrateData: document.getElementById('btn-migrate-data'),
  btnClear: document.getElementById('btn-clear'),
};

let events = [];
let sleeping = false;
let githubReady = false;
let syncInterval = null;
let githubConfig = null;

// Load GitHub config from localStorage or window
function loadGitHubConfig(){
  try{
    const stored = localStorage.getItem(GIST_CONFIG_KEY);
    if(stored){
      return JSON.parse(stored);
    }
  } catch(e){}
  
  // Fallback to window config
  if(typeof window.githubConfig !== 'undefined'){
    return window.githubConfig;
  }
  
  return null;
}

// Save GitHub config
function saveGitHubConfig(config){
  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(config));
  githubConfig = config;
}

// GitHub API helper
async function githubAPI(endpoint, method = 'GET', body = null){
  if(!githubConfig || !githubConfig.token){
    throw new Error('GitHub token not configured');
  }
  
  const url = `https://api.github.com${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `token ${githubConfig.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  };
  
  if(body){
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if(!response.ok){
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

// Create a new Gist
async function createGist(){
  const response = await githubAPI('/gists', 'POST', {
    description: 'Eat-Poop-Sleep Tracker Events',
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify([], null, 2)
      }
    }
  });
  
  return response.id;
}

// Get Gist content
async function getGist(gistId){
  const gist = await githubAPI(`/gists/${gistId}`);
  const file = gist.files[GIST_FILENAME];
  
  if(!file){
    throw new Error('Gist file not found');
  }
  
  return JSON.parse(file.content);
}

// Update Gist content
async function updateGist(gistId, eventsData){
  const gist = await githubAPI(`/gists/${gistId}`);
  
  await githubAPI(`/gists/${gistId}`, 'PATCH', {
    description: 'Eat-Poop-Sleep Tracker Events',
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(eventsData, null, 2)
      }
    }
  });
}

// Migrate localStorage data to GitHub
async function migrateLocalStorageToGitHub(){
  if(!githubConfig || !githubConfig.token || !githubConfig.gistId){
    alert('GitHub sync not configured. Please set it up first.');
    return;
  }
  
  const localData = loadFromLocalStorage();
  if(localData.length === 0){
    alert('No data found in local storage to migrate.');
    return;
  }
  
  const confirmMigrate = confirm(`Found ${localData.length} events in local storage.\n\nWould you like to upload them to GitHub?\n\nThis will merge with any existing data in your Gist.`);
  if(!confirmMigrate) return;
  
  try{
    // Get existing Gist data
    let existingEvents = [];
    try{
      existingEvents = await getGist(githubConfig.gistId);
    } catch(e){
      // Gist might be empty, that's okay
    }
    
    // Merge data (localStorage + existing Gist)
    const merged = [...existingEvents, ...localData];
    merged.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    
    // Remove duplicates
    const seen = new Set();
    const uniqueEvents = merged.filter(ev => {
      if(ev.id && seen.has(ev.id)) return false;
      if(ev.id) seen.add(ev.id);
      return true;
    });
    
    // Upload to GitHub
    await updateGist(githubConfig.gistId, uniqueEvents);
    events = uniqueEvents;
    sleeping = calcSleepingFromEvents();
    render();
    
    // Clear localStorage after successful migration
    localStorage.removeItem(KEY);
    
    alert(`Successfully migrated ${localData.length} events to GitHub!`);
  } catch(error){
    alert('Migration failed: ' + error.message);
    console.error('Migration error:', error);
  }
}

// Setup GitHub token manually
async function setupGitHubToken(){
  const username = prompt('Enter your GitHub username:', githubConfig?.username || 'nokescohen');
  if(!username){
    alert('Username is required');
    return;
  }
  
  const token = prompt('Enter your GitHub Personal Access Token:\n\nGet one at: https://github.com/settings/tokens\n\n(Required scope: gist)');
  if(!token){
    alert('Token is required for GitHub sync');
    return;
  }
  
  githubConfig = {
    username: username,
    token: token,
    gistId: githubConfig?.gistId || ''
  };
  
  saveGitHubConfig(githubConfig);
  
  // Reinitialize
  await initGitHub();
  
  // Check if there's localStorage data to migrate
  const localData = loadFromLocalStorage();
  if(localData.length > 0){
    const migrate = confirm(`GitHub sync configured!\n\nFound ${localData.length} events in local storage.\n\nWould you like to migrate them to GitHub now?`);
    if(migrate){
      await migrateLocalStorageToGitHub();
    }
  } else {
    alert('GitHub sync configured! Your data will now sync across devices.');
  }
}

// Initialize GitHub storage
async function initGitHub(){
  githubConfig = loadGitHubConfig();
  
  if(!githubConfig || !githubConfig.username){
    console.warn('GitHub not configured, falling back to localStorage');
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    render();
    return;
  }
  
  // Check if token is set
  if(!githubConfig.token){
    console.warn('GitHub token not set, using localStorage only. Click "Setup GitHub Sync" to enable cloud sync.');
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    render();
    return;
  }
  
  try{
    // Get or create Gist
    if(!githubConfig.gistId){
      console.log('Creating new Gist...');
      githubConfig.gistId = await createGist();
      saveGitHubConfig(githubConfig);
      
      // Check if there's existing localStorage data to migrate
      const localData = loadFromLocalStorage();
      if(localData.length > 0){
        const migrate = confirm(`Found ${localData.length} events in local storage.\n\nWould you like to migrate them to GitHub?\n\nClick OK to migrate, Cancel to start fresh.`);
        if(migrate){
          events = localData;
          await updateGist(githubConfig.gistId, events);
          // Clear localStorage after successful migration
          localStorage.removeItem(KEY);
        }
      }
    } else {
      // Load existing data from Gist
      events = await getGist(githubConfig.gistId);
      events.sort((a, b) => new Date(b.ts) - new Date(a.ts)); // Sort newest first
      
      // If Gist is empty but localStorage has data, offer to migrate
      if(events.length === 0){
        const localData = loadFromLocalStorage();
        if(localData.length > 0){
          const migrate = confirm(`Your GitHub Gist is empty, but you have ${localData.length} events in local storage.\n\nWould you like to migrate them to GitHub?\n\nClick OK to migrate, Cancel to keep them local.`);
          if(migrate){
            events = localData;
            await updateGist(githubConfig.gistId, events);
            // Clear localStorage after successful migration
            localStorage.removeItem(KEY);
          } else {
            // Keep using localStorage
            events = localData;
          }
        }
      }
    }
    
    sleeping = calcSleepingFromEvents();
    render();
    
    // Set up polling for sync (every 5 seconds)
    syncInterval = setInterval(async () => {
      try{
        const remoteEvents = await getGist(githubConfig.gistId);
        remoteEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        
        // Check if remote has newer data
        if(remoteEvents.length !== events.length || 
           JSON.stringify(remoteEvents) !== JSON.stringify(events)){
          events = remoteEvents;
          sleeping = calcSleepingFromEvents();
          render();
        }
      } catch(error){
        console.error('Sync error:', error);
      }
    }, 5000);
    
    githubReady = true;
    console.log('GitHub Gist connected, sync enabled');
  } catch(error){
    console.error('GitHub initialization error:', error);
    alert('GitHub setup failed: ' + error.message + '\n\nFalling back to localStorage.');
    events = loadFromLocalStorage();
    sleeping = calcSleepingFromEvents();
    render();
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
  if(githubReady && githubConfig && githubConfig.gistId){
    try{
      await updateGist(githubConfig.gistId, events);
      // Also save to localStorage as backup
      saveToLocalStorage();
      // Don't call render() - polling will update if needed
    } catch(error){
      console.error('GitHub save error:', error);
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
  events.shift();
  await save();
  render();
}

async function clearAll(){
  if(!confirm('Clear all events?')) return;
  events = [];
  sleeping = false;
  await save();
  render();
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
            // Replace - just set new events (will overwrite on save)
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
    const summary = `${dateStr}\nBaby Stats - Slept ${sleepHoursStr}${wakeWindowStr}, Fed ${feedOunces} oz, ${poopCount} ${poopCount === 1 ? 'poop' : 'poops'}, ${peeCount} ${peeCount === 1 ? 'pee' : 'pees'}\nMama Stats - Pumped ${pumpOunces} oz, Froze ${freezeOunces} oz, Drank ${h2oOunces} oz\n`;
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

async function sendDailySummaryEmail(){
  if(events.length === 0) return; // No events to send
  
  // Check if we should send
  if(!shouldSendDailyEmail()) return;
  
  // Get today's summary (sending at end of day for today's events)
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  
  // Filter events from today
  const todayEvents = events.filter(ev => {
    const evDate = new Date(ev.ts).toISOString().split('T')[0];
    return evDate === todayKey;
  });
  
  if(todayEvents.length === 0) return; // No events today
  
  const summaryText = generateDailySummaryText(todayEvents);
  
  // Initialize EmailJS if not already initialized
  if(typeof emailjs === 'undefined'){
    console.error('EmailJS not loaded. Please check the script tag.');
    return;
  }
  
  try{
    // Initialize EmailJS
    emailjs.init(EMAILJS_CONFIG.publicKey);
    
    // Send email to both recipients
    const today = new Date();
    const emailParams = {
      to_email: 'ben@cohen-family.org,anokheecohen@gmail.com',
      subject: `Daily Summary - ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      message: summaryText
    };
    
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      emailParams
    );
    
    // Mark as sent for today
    localStorage.setItem(LAST_EMAIL_SENT_KEY, getTodayDateKey());
    console.log('Daily summary email sent successfully');
  } catch(error){
    console.error('Failed to send email:', error);
  }
}

// Set up daily email check - runs every minute
function setupDailyEmailCheck(){
  // Check immediately
  sendDailySummaryEmail();
  
  // Then check every minute
  setInterval(() => {
    sendDailySummaryEmail();
  }, 60 * 1000); // Check every minute
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

  // stats: counts in last 24h
  const since = new Date(Date.now() - 24*60*60*1000);
  const counts = { pee:0, poop:0, feedOunces:0, sleepHours:0, wakeWindows:[], pumpOunces:0, freezeOunces:0, h2oOunces:0 };
  
  // Get all events in last 24h, sorted chronologically
  const recentEvents = events.filter(ev => new Date(ev.ts) >= since).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
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
    if(ev.type === 'pump') counts.pumpOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'freeze') counts.freezeOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
    if(ev.type === 'h2o') counts.h2oOunces += (ev.data && ev.data.amount) ? Number(ev.data.amount) : 0;
  }
  
  // Handle ongoing sleep session (sleep_start without matching sleep_end)
  if(currentSleepStart){
    const now = new Date();
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
  const statText = `24h — Baby: Pee: ${counts.pee}, Poop: ${counts.poop}, Feeds: ${counts.feedOunces}oz, Sleep: ${sleepHoursStr}, ${wakeWindowStr} | Mama: Pump: ${counts.pumpOunces}oz, Freeze: ${counts.freezeOunces}oz, H2O: ${counts.h2oOunces}oz`;
  elements.stats.textContent = statText;

  // history
  elements.history.innerHTML = '';
  for(const ev of events){
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
        events = events.filter(x=>x.id!==ev.id);
        await save();
        render();
      }
    };

    li.appendChild(left);
    li.appendChild(del);
    elements.history.appendChild(li);
  }
}

function prettyLabel(ev){
  if(ev.type === 'pee') return 'Pee';
  if(ev.type === 'poop') return 'Poop';
  if(ev.type === 'feed'){
    const amt = ev.data && ev.data.amount ? ` • ${ev.data.amount} oz` : '';
    return `Feed${amt}`;
  }
  if(ev.type === 'pump'){
    const amt = ev.data && ev.data.amount ? ` • ${ev.data.amount} oz` : '';
    return `Pump${amt}`;
  }
  if(ev.type === 'freeze'){
    const amt = ev.data && ev.data.amount ? ` • ${ev.data.amount} oz` : '';
    return `Freeze${amt}`;
  }
  if(ev.type === 'h2o'){
    const amt = ev.data && ev.data.amount ? ` • ${ev.data.amount} oz` : '';
    return `H2O${amt}`;
  }
  if(ev.type==='sleep_start') return 'Sleep — start';
  if(ev.type==='sleep_end') return 'Sleep — end';
  return ev.type;
}

// Button handlers
elements.btnPee.addEventListener('click', () => {
  addEvent('pee', {});
});

elements.btnPoop.addEventListener('click', () => {
  addEvent('poop', {});
});

elements.btnFeed.addEventListener('click', () => {
  // Each press = 1 ounce
  addEvent('feed', { amount: 1 });
});

elements.btnSleep.addEventListener('click', toggleSleep);

elements.btnPump.addEventListener('click', () => {
  // Each press = 1 ounce
  addEvent('pump', { amount: 1 });
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
elements.btnExportData.addEventListener('click', exportData);
elements.btnImportData.addEventListener('click', importData);
if(elements.btnSetupGitHub) elements.btnSetupGitHub.addEventListener('click', setupGitHubToken);
if(elements.btnMigrateData) elements.btnMigrateData.addEventListener('click', migrateLocalStorageToGitHub);
elements.btnClear.addEventListener('click', clearAll);

// Initialize GitHub storage and start app
initGitHub().then(() => {
  // Set up daily email check
  setupDailyEmailCheck();
}).catch(error => {
  console.error('Failed to initialize:', error);
  // Fallback: render with localStorage data
  render();
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