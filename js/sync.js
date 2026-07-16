/* =========================================================================
   SP_CONFIG — fill these in per the SETUP.md guide.
   Set enabled:false to force local-only/offline mode.
   ========================================================================= */
const SP_CONFIG = {
  enabled: true,

  tenantId: "11249f19-556c-4ca5-b24d-8fdf987f4162",

  clientId: "6dfd3611-4766-4943-8bc5-93334b56e0ca",

  siteHostname: "chdn.sharepoint.com",

  sitePath: "/sites/corporate/oakgrove",

  listName: "OGG Dashboard V1",

  syncIntervalMs: 20000
};

/* =========================================================================
   Central app state. One JSON blob per "domain" is stored as a row
   (Title = domain key, Payload = JSON) in the SP_CONFIG.listName list.
   Locally, the whole thing is mirrored to localStorage as a fallback and
   as an offline cache.
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

const CONN = { mode: 'local', account: null, lastSync: null, siteId: null, listId: null, error: null };

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
   push that one domain to SharePoint. Always also pushes 'activity'. */
async function commitChange(domain){
  saveLocalState();
  if(typeof window.onStateChanged === 'function') window.onStateChanged(domain);
  if(CONN.mode === 'sharepoint'){
    try{
      await upsertRow(domain, STATE[domain]);
      if(domain !== 'activity') await upsertRow('activity', STATE.activity);
      CONN.lastSync = new Date();
      CONN.error = null;
    }catch(err){
      CONN.error = err.message;
      console.error('SharePoint save failed:', err);
    }
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  }
}

/* ---------------------------- MSAL / Graph ---------------------------- */
let msalInstance = null;
const GRAPH_SCOPES = ['Sites.ReadWrite.All'];

function initMsal(){
  if(!window.msal){ console.warn('msal-browser.js not loaded — SharePoint mode unavailable.'); return; }
  msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: SP_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${SP_CONFIG.tenantId}`,
      redirectUri: window.location.href.split('#')[0].split('?')[0]
    },
    cache: { cacheLocation: 'localStorage' }
  });
}

async function signIn(){
  if(!msalInstance){ alert('Sign-in is unavailable — msal-browser.js failed to load.'); return; }
  try{
    const result = await msalInstance.loginPopup({ scopes: GRAPH_SCOPES });
    msalInstance.setActiveAccount(result.account);
    CONN.account = result.account;
    await connectToSharePoint();
  }catch(err){
    alert('Sign-in failed: ' + err.message);
  }
}

function signOut(){
  if(!msalInstance) return;
  const account = msalInstance.getActiveAccount();
  CONN.mode = 'local';
  CONN.account = null;
  if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  if(account) msalInstance.logoutPopup({ account });
}

async function getToken(){
  const account = msalInstance.getActiveAccount();
  if(!account) throw new Error('Not signed in.');
  try{
    const r = await msalInstance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return r.accessToken;
  }catch(e){
    const r = await msalInstance.acquireTokenPopup({ scopes: GRAPH_SCOPES });
    return r.accessToken;
  }
}

async function graphFetch(url, options = {}){
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    throw new Error(`Graph ${res.status}: ${t.slice(0,200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function ensureSite(){
  if(CONN.siteId) return CONN.siteId;
  const d = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${SP_CONFIG.siteHostname}:${SP_CONFIG.sitePath}`);
  CONN.siteId = d.id;
  return CONN.siteId;
}
async function ensureList(){
  if(CONN.listId) return CONN.listId;
  await ensureSite();
  const d = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${CONN.siteId}/lists?$filter=displayName eq '${SP_CONFIG.listName}'`);
  if(!d.value.length) throw new Error(`List "${SP_CONFIG.listName}" not found on site. See SETUP.md Step 1.`);
  CONN.listId = d.value[0].id;
  return CONN.listId;
}
async function fetchRows(){
  await ensureList();
  const d = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${CONN.siteId}/lists/${CONN.listId}/items?expand=fields&$top=200`);
  return d.value;
}
async function upsertRow(title, payloadObj){
  await ensureList();
  const rows = await fetchRows();
  const existing = rows.find(r => r.fields && r.fields.Title === title);
  const payload = JSON.stringify(payloadObj);
  if(existing){
    await graphFetch(`https://graph.microsoft.com/v1.0/sites/${CONN.siteId}/lists/${CONN.listId}/items/${existing.id}/fields`, {
      method: 'PATCH', body: JSON.stringify({ Payload: payload })
    });
  }else{
    await graphFetch(`https://graph.microsoft.com/v1.0/sites/${CONN.siteId}/lists/${CONN.listId}/items`, {
      method: 'POST', body: JSON.stringify({ fields: { Title: title, Payload: payload } })
    });
  }
}

async function pullAll(){
  const rows = await fetchRows();
  rows.forEach(r=>{
    const key = r.fields && r.fields.Title;
    if(!key || !(key in STATE)) return;
    try{ STATE[key] = JSON.parse(r.fields.Payload || 'null') ?? STATE[key]; }catch(e){}
  });
  saveLocalState();
  CONN.lastSync = new Date();
}

async function connectToSharePoint(){
  try{
    await pullAll();
    CONN.mode = 'sharepoint';
    CONN.error = null;
    startPolling();
  }catch(err){
    CONN.mode = 'local';
    CONN.error = err.message;
    alert('Connected to Microsoft 365, but could not reach SharePoint:\n' + err.message + '\n\nCheck SP_CONFIG values and the list setup in SETUP.md. Falling back to local-only mode.');
  }
  if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  if(typeof window.onStateChanged === 'function') window.onStateChanged('all');
}

let pollTimer = null;
function startPolling(){
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async ()=>{
    if(CONN.mode !== 'sharepoint') return;
    if(window.EDIT_PANEL_OPEN) return; // don't clobber an in-progress edit
    try{
      await pullAll();
      CONN.error = null;
    }catch(err){
      CONN.error = err.message;
    }
    if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
    if(typeof window.onStateChanged === 'function') window.onStateChanged('all');
  }, SP_CONFIG.syncIntervalMs);
}

async function manualRefresh(){
  if(CONN.mode !== 'sharepoint') return;
  try{
    await pullAll();
    CONN.error = null;
  }catch(err){ CONN.error = err.message; }
  if(typeof window.onConnectionChanged === 'function') window.onConnectionChanged();
  if(typeof window.onStateChanged === 'function') window.onStateChanged('all');
}
