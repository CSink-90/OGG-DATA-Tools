/* =========================================================================
   FIREBASE_CONFIG — fill these in per docs/SETUP.md.
   Set enabled:false to force local-only/offline mode.

   Get these values from: Firebase Console → Project settings → General →
   "Your apps" → Web app → SDK setup and configuration.
   ========================================================================= */
const FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyAP2Zh04uQQpWnXUa8hFhP23-tMPsGwMrg",
  authDomain: "ogg-pdu-dashboard-v2.firebaseapp.com",
  databaseURL: "https://ogg-pdu-dashboard-v2-default-rtdb.firebaseio.com",
  projectId: "ogg-pdu-dashboard-v2",
  rootPath: "ogg-dashboard"   // top-level key in the Realtime Database — no need to change this
};

/* =========================================================================
   Central app state. Each top-level key below is synced as its own node
   under FIREBASE_CONFIG.rootPath in the Realtime Database, live, in both
   directions. Locally, the whole thing is also mirrored to localStorage as
   an offline cache / fallback when Firebase isn't configured.
   ========================================================================= */
const STATE = {
  pdu: {},          // { "PDU-01": {status,note,workingTechs:[],attachments:[],updatedBy,updatedAt} }
  technicians: [],  // [{name,status:'active'|'idle'}]
  inventory: [],    // [{part,qty,notes}]
  tasks: [],        // [{title,assignedTech,status:'open'|'inprogress'|'done',dueDate,notes}]
  systemNotes: "",
  ticker: "",
  activity: []      // [{ts,who,action,target,detail}]
};

const CONN = { mode: 'local', lastSync: null, error: null };

const LOCAL_STATE_KEY = 'ogg_dashboard_state_v1';

function loadLocalState(){
  try{
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if(raw){
      const data = JSON.parse(raw);
      Object.assign(STATE, data);
    }
  }catch(e){}
}
function saveLocalState(){
  try{ localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(STATE)); }catch(e){}
}

function logActivity(who, action, target, detail){
  STATE.activity.unshift({ ts: new Date().toISOString(), who: who || '(unknown)', action, target, detail: detail || '' });
  if(STATE.activity.length > 150) STATE.activity.length = 150;
}

/* Call after changing STATE.<domain> to persist locally and, if connected,
   push that one domain to Firebase live. Also always pushes 'activity'. */
async function commitChange(domain){
  saveLocalState();
  if(typeof window.onStateChanged === 'function') window.onStateChanged(domain);
  if(CONN.mode === 'firebase' && fbDb){
    try{
      await fbDb.ref(FIREBASE_CONFIG.rootPath + '/' + domain).set(STATE[domain]);
      if(domain !== 'activity') await fbDb.ref(FIREBASE_CONFIG.rootPath + '/activity').set(STATE.activity);
      CONN.lastSync = new Date();
      CONN.error = null;
    }catch(err){
      CONN.error = err.message;
      console.error('Firebase write failed:', err);
    }
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  }
}

/* ---------------------------- Firebase ---------------------------- */
let fbApp = null, fbDb = null;

function initFirebase(){
  if(!FIREBASE_CONFIG.enabled) return;
  if(!window.firebase){
    console.warn('Firebase SDK failed to load — staying in local-only mode.');
    return;
  }
  try{
    fbApp = firebase.initializeApp({
      apiKey: FIREBASE_CONFIG.apiKey,
      authDomain: FIREBASE_CONFIG.authDomain,
      databaseURL: FIREBASE_CONFIG.databaseURL,
      projectId: FIREBASE_CONFIG.projectId
    });
    fbDb = firebase.database();
  }catch(err){
    CONN.error = err.message;
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
    return;
  }

  firebase.auth().signInAnonymously().then(()=>{
    attachLiveListeners();
    CONN.mode = 'firebase';
    CONN.error = null;
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  }).catch(err=>{
    CONN.mode = 'local';
    CONN.error = err.message;
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
    console.error('Firebase anonymous sign-in failed:', err);
  });
}

/* Live, push-based sync — no polling needed. Fires immediately with
   current data, then again every time anyone (including this browser)
   writes a change. */
function attachLiveListeners(){
  Object.keys(STATE).forEach(domain=>{
    fbDb.ref(FIREBASE_CONFIG.rootPath + '/' + domain).on('value', (snapshot)=>{
      const val = snapshot.val();
      if(val !== null && val !== undefined){
        STATE[domain] = val;
        saveLocalState();
        CONN.lastSync = new Date();
        if(window.EDIT_PANEL_OPEN && domain === 'pdu') return; // don't clobber an in-progress edit
        if(typeof window.onStateChanged === 'function') window.onStateChanged(domain);
        if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
      }
    }, (err)=>{
      CONN.error = err.message;
      if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
    });
  });
}
