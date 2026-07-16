const COLORS = { active: '#22c55e', inactive: '#ef4444', maintenance: '#f5a623' };
const STATUS_LABEL = { active: 'ACTIVE', inactive: 'INACTIVE / BROKEN', maintenance: 'REQUIRES MAINTENANCE' };
const DEFAULT_STATUS = 'active';
const MAX_ATTACH_BYTES = 180 * 1024; // per-attachment cap so the shared JSON blob stays small

const cols = ["A","B","C","D","E","F","G","H","I","J","K"];
const colX = {}; cols.forEach((c,i)=> colX[c] = 50 + i*140);
const rowY = {1:50, 2:125, 3:200, 4:275, 5:350};
const IMG_W = 1500, IMG_H = 399;
const pad = 90;
const W = IMG_W + pad*2;
const H = IMG_H + pad*2 + 40;
const imgX = pad, imgY = pad + 20;
const halfW = 62, halfH = 30;

const PDU_LIST = [];
(function buildPduList(){
  let n = 1;
  [1,2,3,4,5].forEach(r=>{
    cols.forEach(c=>{
      const x = imgX + colX[c], y = imgY + rowY[r];
      const id = "PDU-" + String(n).padStart(2,"0");
      PDU_LIST.push({ id, grid: c+r, x, y });
      n++;
    });
  });
})();

function ensurePduEntry(id){
  if(!STATE.pdu[id]){
    STATE.pdu[id] = { status: DEFAULT_STATUS, note: '', workingTechs: [], attachments: [], updatedBy: '', updatedAt: '' };
  }
  const e = STATE.pdu[id];
  if(!e.workingTechs) e.workingTechs = [];
  if(!e.attachments) e.attachments = [];
  if(!e.status) e.status = DEFAULT_STATUS;
  return e;
}

function renderGridSVG(){
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
  svg.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fbfaf7"/>`);
  svg.push(`<text x="${W/2}" y="30" text-anchor="middle" font-family="Courier New, monospace" font-size="18" font-weight="bold">OGG VIDEO WALL — SCREEN HOUSING PDU LAYOUT</text>`);
  svg.push(`<defs><linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#181c21"/><stop offset="100%" stop-color="#101317"/></linearGradient></defs>`);
  svg.push(`<rect x="${imgX}" y="${imgY}" width="${IMG_W}" height="${IMG_H}" fill="url(#panelGrad)"/>`);
  svg.push(`<text x="${imgX + IMG_W/2}" y="${imgY + IMG_H/2 + 24}" text-anchor="middle" font-family="Courier New, monospace" font-size="120" font-weight="bold" letter-spacing="6" fill="rgba(255,255,255,0.09)">OGG VIDEO WALL</text>`);
  svg.push('<g id="grid-cells">');
  PDU_LIST.forEach(p=>{
    svg.push(`<rect x="${p.x-halfW}" y="${p.y-halfH}" width="${halfW*2}" height="${halfH*2}" rx="3" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`);
  });
  svg.push('</g>');
  svg.push(`<rect x="${imgX}" y="${imgY}" width="${IMG_W}" height="${IMG_H}" fill="none" stroke="#2b2b2b" stroke-width="1.5"/>`);
  svg.push('<g id="grid-labels">');
  cols.forEach(c=>{
    svg.push(`<text x="${imgX + colX[c]}" y="${imgY-10}" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="bold">${c}</text>`);
  });
  [1,2,3,4,5].forEach(r=>{
    svg.push(`<text x="${imgX-15}" y="${imgY + rowY[r]+4}" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="bold">${r}</text>`);
  });
  svg.push('</g>');
  svg.push('<g id="pdu-points">');
  PDU_LIST.forEach(p=>{
    svg.push(`<g class="pdu-group" data-id="${p.id}" data-grid="${p.grid}">`);
    svg.push(`<circle class="pdu-dot" cx="${p.x}" cy="${p.y}" r="8" fill="${COLORS[DEFAULT_STATUS]}" stroke="#ffffff" stroke-width="1.6" data-id="${p.id}"/>`);
    svg.push(`<text class="pdu-label" x="${p.x+10}" y="${p.y-10}" font-size="9" font-weight="bold">${p.id}</text>`);
    svg.push(`<polygon class="pdu-flag" id="flag-${p.id}" points="${p.x+9},${p.y+7} ${p.x+9},${p.y+18} ${p.x+18},${p.y+12.5}" fill="#ffb347" stroke="#5a3800" stroke-width="1" style="display:none"/>`);
    svg.push('</g>');
  });
  svg.push('</g>');
  svg.push(`<text x="${imgX}" y="${H-15}" font-family="Courier New, monospace" font-size="9" fill="#555555">Reference: video wall screen housing only — Grid 11x5 = 55 PDUs — NTS</text>`);
  svg.push('</svg>');
  return svg.join('');
}

function refreshDotsAndFlags(){
  document.querySelectorAll('.pdu-dot').forEach(dot=>{
    const id = dot.getAttribute('data-id');
    const e = ensurePduEntry(id);
    dot.setAttribute('fill', COLORS[e.status] || COLORS[DEFAULT_STATUS]);
    const flag = document.getElementById('flag-' + id);
    if(flag) flag.style.display = (e.note && e.note.trim()) ? '' : 'none';
  });
  const count = PDU_LIST.filter(p => { const e = STATE.pdu[p.id]; return e && e.note && e.note.trim(); }).length;
  const sc = document.getElementById('statusCount');
  if(sc) sc.textContent = `${count} of 55 PDUs have active notes`;
}

/* ------------------------------ Tooltip ------------------------------ */
function wireTooltip(){
  const tooltip = document.getElementById('tooltip');
  document.querySelectorAll('.pdu-dot').forEach(dot=>{
    dot.addEventListener('mouseenter', ()=>{
      const id = dot.getAttribute('data-id');
      const grid = dot.closest('.pdu-group').getAttribute('data-grid');
      const e = ensurePduEntry(id);
      const noteHtml = e.note && e.note.trim() ? e.note.replace(/</g,'&lt;') : 'No note — click to add';
      const techs = e.workingTechs.length ? e.workingTechs.join(', ') : 'Unassigned';
      tooltip.innerHTML = `<span class="tt-id">${id} — Grid ${grid}</span><span class="tt-status" style="color:${COLORS[e.status]}">${STATUS_LABEL[e.status]}</span><br>Tech: ${techs}<br>${noteHtml}`;
      tooltip.style.display = 'block';
    });
    dot.addEventListener('mousemove', (e)=>{
      tooltip.style.left = (e.clientX+14) + 'px';
      tooltip.style.top = (e.clientY+14) + 'px';
    });
    dot.addEventListener('mouseleave', ()=> tooltip.style.display = 'none');
  });
}

/* ---------------------------- Edit panel ---------------------------- */
let activeId = null;
let activeStatus = DEFAULT_STATUS;
let pendingAttachments = [];

function techRadialHTML(selected){
  const techs = (STATE.technicians || []).filter(t => t.name && t.name.trim());
  if(!techs.length) return '<div class="ep-none">No technicians yet — add names in the Technicians panel.</div>';
  return techs.map(t=>{
    const checked = selected.includes(t.name) ? 'checked' : '';
    return `<label><input type="checkbox" class="ep-tech-check" value="${t.name.replace(/"/g,'&quot;')}" ${checked}> ${t.name}</label>`;
  }).join('');
}

function attachThumbHTML(a, idx){
  if(a.dataUrl && a.dataUrl.startsWith('data:image/')){
    return `<div class="ep-attach-thumb" title="${a.name}"><img src="${a.dataUrl}"><button type="button" class="ep-attach-del" data-idx="${idx}">&times;</button></div>`;
  }
  return `<div class="ep-attach-thumb" title="${a.name}"><div class="ep-attach-file">${a.name}</div><button type="button" class="ep-attach-del" data-idx="${idx}">&times;</button></div>`;
}

function renderAttachList(){
  const list = document.getElementById('epAttachList');
  list.innerHTML = pendingAttachments.map(attachThumbHTML).join('');
  list.querySelectorAll('.ep-attach-del').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      pendingAttachments.splice(Number(btn.getAttribute('data-idx')), 1);
      renderAttachList();
    });
  });
}

function setActiveStatusUI(status){
  activeStatus = status;
  ['active','inactive','maintenance'].forEach(k=>{
    document.getElementById('epStatus_' + k).classList.remove('sel-active','sel-inactive','sel-maint');
  });
  const cls = status === 'active' ? 'sel-active' : status === 'inactive' ? 'sel-inactive' : 'sel-maint';
  document.getElementById('epStatus_' + status).classList.add(cls);
}

function openEditor(id, e){
  activeId = id;
  window.EDIT_PANEL_OPEN = true;
  const entry = ensurePduEntry(id);
  pendingAttachments = entry.attachments.map(a=>({...a}));
  document.getElementById('epId').textContent = id;
  document.getElementById('epTextarea').value = entry.note || '';
  document.getElementById('epRadial').innerHTML = techRadialHTML(entry.workingTechs);
  document.getElementById('epMeta').textContent = entry.updatedBy ? `Last updated by ${entry.updatedBy} — ${new Date(entry.updatedAt).toLocaleString()}` : 'No updates yet';
  renderAttachList();
  setActiveStatusUI(entry.status);
  const panel = document.getElementById('editPanel');
  panel.style.display = 'block';
  let left = e.clientX + 16, top = e.clientY + 16;
  if(left + 310 > window.innerWidth) left = window.innerWidth - 320;
  if(top + 400 > window.innerHeight) top = Math.max(10, window.innerHeight - 410);
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  document.getElementById('tooltip').style.display = 'none';
}

function closeEditor(){
  document.getElementById('editPanel').style.display = 'none';
  window.EDIT_PANEL_OPEN = false;
  activeId = null;
}

function selectedTechs(){
  return Array.from(document.querySelectorAll('.ep-tech-check:checked')).map(cb=>cb.value);
}

function currentUserName(){
  const techs = selectedTechs();
  return techs.length ? techs.join(' + ') : (CONN.account ? CONN.account.name : 'Unknown');
}

async function saveEditor(){
  if(!activeId) return;
  const entry = ensurePduEntry(activeId);
  const prevNote = entry.note;
  entry.status = activeStatus;
  entry.note = document.getElementById('epTextarea').value;
  entry.workingTechs = selectedTechs();
  entry.attachments = pendingAttachments;
  entry.updatedBy = currentUserName();
  entry.updatedAt = new Date().toISOString();
  if(!prevNote && entry.note) logActivity(entry.updatedBy, 'Opened note', activeId, entry.note.slice(0,80));
  else logActivity(entry.updatedBy, 'Updated', activeId, entry.note.slice(0,80));
  await commitChange('pdu');
  refreshDotsAndFlags();
  closeEditor();
}

async function closeIssue(){
  if(!activeId) return;
  const techs = selectedTechs();
  if(!techs.length){
    alert('Select your name from the Technician list to verify before closing this note.');
    return;
  }
  if(!confirm(`Close this note on ${activeId} as ${techs.join(', ')}? This clears the note text and attachments.`)) return;
  const entry = ensurePduEntry(activeId);
  entry.note = '';
  entry.attachments = [];
  entry.updatedBy = techs.join(' + ');
  entry.updatedAt = new Date().toISOString();
  logActivity(entry.updatedBy, 'Closed note', activeId, '');
  await commitChange('pdu');
  refreshDotsAndFlags();
  closeEditor();
}

function wireEditor(){
  document.querySelectorAll('.pdu-dot').forEach(dot=>{
    dot.addEventListener('click', (e)=> openEditor(dot.getAttribute('data-id'), e));
  });
  ['active','inactive','maintenance'].forEach(k=>{
    document.getElementById('epStatus_' + k).addEventListener('click', ()=> setActiveStatusUI(k));
  });
  document.getElementById('epClose').addEventListener('click', closeEditor);
  document.getElementById('epSave').addEventListener('click', saveEditor);
  document.getElementById('epCloseIssue').addEventListener('click', closeIssue);
  document.getElementById('epFile').addEventListener('change', (ev)=>{
    Array.from(ev.target.files).forEach(file=>{
      if(file.size > MAX_ATTACH_BYTES){
        alert(`"${file.name}" is too large (${Math.round(file.size/1024)}KB). Keep attachments under ${Math.round(MAX_ATTACH_BYTES/1024)}KB — this dashboard stores them inline, not in a document library.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = ()=>{
        pendingAttachments.push({ name: file.name, dataUrl: reader.result, size: file.size });
        renderAttachList();
      };
      reader.readAsDataURL(file);
    });
    ev.target.value = '';
  });
  document.addEventListener('click', (e)=>{
    const panel = document.getElementById('editPanel');
    if(panel.style.display === 'block' && !panel.contains(e.target) && !e.target.classList.contains('pdu-dot')){
      closeEditor();
    }
  });
}

function jumpToPdu(id){
  const group = document.querySelector(`.pdu-group[data-id="${id}"]`);
  if(!group) return;
  group.scrollIntoView({ behavior:'smooth', block:'center' });
  const dot = group.querySelector('.pdu-dot');
  const rect = dot.getBoundingClientRect();
  openEditor(id, { clientX: rect.left, clientY: rect.top });
}
