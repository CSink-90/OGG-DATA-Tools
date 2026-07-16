window.EDIT_PANEL_OPEN = false;

function renderAll(){
  ensureDefaultTechnicians();
  ensureMinInventory();
  PDU_LIST.forEach(p=> ensurePduEntry(p.id));
  refreshDotsAndFlags();
  renderTechPanel();
  renderHealthCard();
  renderIssuesPanel();
  renderActivityFeed();
  renderTasksBoard();
  renderInventory();
  tickerRender();
  const ta = document.getElementById('systemNotesText');
  if(document.activeElement !== ta) ta.value = STATE.systemNotes || '';
}

window.onStateChanged = function(domain){
  renderAll();
};

window.onConnectionChanged = function(){
  const dot = document.getElementById('sbDot');
  const label = document.getElementById('sbLabel');
  const signInBtn = document.getElementById('sbSignIn');
  const refreshBtn = document.getElementById('sbRefresh');
  if(CONN.mode === 'sharepoint'){
    dot.className = 'dot ' + (CONN.error ? 'error' : 'connected');
    const who = CONN.account ? CONN.account.name : 'Microsoft 365';
    const when = CONN.lastSync ? CONN.lastSync.toLocaleTimeString() : '—';
    label.textContent = CONN.error
      ? `Connected as ${who} — sync error: ${CONN.error}`
      : `Connected as ${who} — last synced ${when}`;
    signInBtn.textContent = 'Sign Out';
    refreshBtn.style.display = '';
  }else{
    dot.className = 'dot local';
    label.textContent = 'Local-only mode — notes stay in this browser only';
    signInBtn.textContent = 'Sign in with Microsoft 365';
    refreshBtn.style.display = 'none';
  }
};

function wireStatusBar(){
  document.getElementById('sbSignIn').addEventListener('click', ()=>{
    if(CONN.mode === 'sharepoint') signOut();
    else signIn();
  });
  document.getElementById('sbRefresh').addEventListener('click', manualRefresh);
}

(function init(){
  document.getElementById('sheetInner').innerHTML = renderGridSVG();

  loadLocalState();
  renderAll();

  wireTooltip();
  wireEditor();
  wireTechPanel();
  wireActiveModal();
  wireTasksBoard();
  wireInventory();
  wireSystemNotesBanner();
  wireTicker();
  wireSiteVendorPanel();
  wireExportImport();
  wireStatusBar();

  if(SP_CONFIG.enabled){
    initMsal();
  }else{
    document.getElementById('sbSignIn').style.display = 'none';
  }
  onConnectionChanged();
})();
