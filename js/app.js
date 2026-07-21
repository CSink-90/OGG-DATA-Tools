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
  if(CONN.mode === 'firebase'){
    dot.className = 'dot ' + (CONN.error ? 'error' : 'connected');
    const when = CONN.lastSync ? CONN.lastSync.toLocaleTimeString() : '—';
    label.textContent = CONN.error
      ? `Live sync error: ${CONN.error}`
      : `Live sync active — last update ${when}`;
  }else{
    dot.className = 'dot ' + (CONN.error ? 'error' : 'local');
    label.textContent = CONN.error
      ? `Local-only mode — Firebase connection failed: ${CONN.error}`
      : 'Local-only mode — notes stay in this browser only';
  }
};

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

  initFirebase();
  onConnectionChanged();
})();
