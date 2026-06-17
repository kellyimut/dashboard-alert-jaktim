/* =============================================
   DASHBOARD ALERT – JAKARTA TIMUR  v2
   Fitur: Status (Online/LOS/Dying Gasp/Offline)
          Filter STO, Dark/Light theme,
          Panel ACTION STO & KENDALA (count per nilai)
   ============================================= */

const CONFIG = {
  SHEET_ID:   '1q_Ifa8RXrXm4fxs8gzcEMROU9jGp5NfW2cMeUGFbsFg',
  SHEET_NAME: 'hari ini',

  COL_STO:    'STO',
  COL_SN:     'SN',
  COL_CTYPE:  'CUSTOMER TYPE',
  COL_STATUS: 'STATUS',
  COL_ACTION: 'ACTION STO',
  COL_KENDALA:'KENDALA',

  REFRESH_MS: 5 * 60 * 1000,

  STO_WHITELIST: ['GAN','KRG','PGG','CWA','KLD','JTN','RMG','PDK','PGB','PSR'],
};

/* ── Status mapping ─────────────────────────── */
const STATUS_KEY = {
  'online':      'online',
  'los':         'los',
  'loss':        'los',
  'dying gasp':  'dying',
  'dyinggasp':   'dying',
  'dying':       'dying',
  'offline':     'offline',
};
const STATUS_LABEL = { online:'Online', los:'LOS', dying:'Dying Gasp', offline:'Offline', unknown:'–' };
const STATUS_DOT   = { online:'dot-online', los:'dot-los', dying:'dot-dying', offline:'dot-offline', unknown:'dot-unknown' };
const STATUS_BADGE = { online:'badge-online', los:'badge-los', dying:'badge-dying', offline:'badge-offline', unknown:'badge-unknown' };

function normalizeStatus(raw) {
  const k = (raw || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return STATUS_KEY[k] || 'unknown';
}

/* ── State ──────────────────────────────────── */
let allRows        = [];
let modalRows      = [];
let activeSTO      = 'ALL';
let activePanelSTO = null;

/* ── Theme ──────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.querySelector('.theme-btn').textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', next);
}
(function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.theme-btn').textContent = saved === 'dark' ? '🌙' : '☀️';
  });
})();

/* ── Filter STO ─────────────────────────────── */
function filterSTO(sto) {
  activeSTO = sto;
  activePanelSTO = null;
  closeSidePanel();

  document.querySelectorAll('.sto-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.sto === sto);
  });

  const filtered    = sto === 'ALL' ? allRows : allRows.filter(r => r.sto === sto);
  const displayRows = filtered.length ? filtered : allRows;
  const grouped     = aggregate(displayRows);
  setMeta(displayRows.length, grouped.length, globalStatus(displayRows));
  renderCards(displayRows);
}

function buildSTOPills(grouped) {
  const wrap = document.getElementById('sto-filter-wrap');
  wrap.innerHTML = `<button class="sto-pill ${activeSTO==='ALL'?'active':''}" data-sto="ALL" onclick="filterSTO('ALL')">Semua</button>`;
  grouped.forEach(s => {
    const btn = document.createElement('button');
    btn.className   = 'sto-pill' + (activeSTO === s.name ? ' active' : '');
    btn.dataset.sto = s.name;
    btn.textContent = s.name;
    btn.onclick = () => filterSTO(s.name);
    wrap.appendChild(btn);
  });
}

/* ── Fetch & Parse ──────────────────────────── */
function buildCSVUrl() {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
}

async function fetchData() {
  const res = await fetch(buildCSVUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSV(await res.text());
}

function parseCSV(text) {
  const lines   = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = csvSplit(lines[0]).map(h => h.replace(/"/g,'').trim());

  const iSTO     = findCol(headers, CONFIG.COL_STO);
  const iSN      = findCol(headers, CONFIG.COL_SN);
  const iCTYPE   = findCol(headers, CONFIG.COL_CTYPE);
  const iSTATUS  = findCol(headers, CONFIG.COL_STATUS);
  const iACTION  = findCol(headers, CONFIG.COL_ACTION);
  const iKENDALA = findCol(headers, CONFIG.COL_KENDALA);

  if (iSTO===-1 || iSN===-1 || iCTYPE===-1) {
    throw new Error(`Kolom tidak ditemukan. Header: ${headers.join(', ')}`);
  }

  const whitelist = new Set(CONFIG.STO_WHITELIST.map(s => s.toUpperCase()));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const c   = csvSplit(lines[i]).map(x => x.replace(/^"|"$/g,'').trim());
    const sto = c[iSTO] || '';
    const sn  = c[iSN]  || '';
    if (!sto && !sn) continue;
    if (!whitelist.has(sto.toUpperCase())) continue;

    rows.push({
      sto,
      sn,
      ctype:   c[iCTYPE]  || 'Tidak diketahui',
      status:  normalizeStatus(iSTATUS  !== -1 ? c[iSTATUS]  : ''),
      action:  iACTION  !== -1 ? (c[iACTION]  || '').trim() : '',
      kendala: iKENDALA !== -1 ? (c[iKENDALA] || '').trim() : '',
    });
  }
  return rows;
}

function findCol(h, name) { return h.findIndex(x => x.toLowerCase() === name.toLowerCase()); }

function csvSplit(line) {
  const out=[]; let cur='', inQ=false;
  for(const c of line){
    if(c==='"'){inQ=!inQ;}
    else if(c===','&&!inQ){out.push(cur);cur='';}
    else{cur+=c;}
  }
  out.push(cur); return out;
}

/* ── Aggregate ──────────────────────────────── */
function aggregate(rows) {
  const map = {};
  for (const r of rows) {
    const k = r.sto || '(Tanpa STO)';
    if (!map[k]) map[k] = {
      total: 0, ctypes: {},
      statuses: { online:0, los:0, dying:0, offline:0, unknown:0 },
      rows: [],
      actionCount: {},
      kendalaCount: {},
    };
    map[k].total++;
    map[k].ctypes[r.ctype] = (map[k].ctypes[r.ctype] || 0) + 1;
    map[k].statuses[r.status]++;
    map[k].rows.push(r);
    if (r.action)  map[k].actionCount[r.action]  = (map[k].actionCount[r.action]  || 0) + 1;
    if (r.kendala) map[k].kendalaCount[r.kendala] = (map[k].kendalaCount[r.kendala] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([name, d]) => ({ name, ...d }));
}

function globalStatus(rows) {
  const s = { online:0, los:0, dying:0, offline:0 };
  for (const r of rows) if (s[r.status] !== undefined) s[r.status]++;
  return s;
}

/* ── Render ─────────────────────────────────── */
function render(rows) {
  buildSTOPills(aggregate(allRows));
  setMeta(rows.length, aggregate(rows).length, globalStatus(rows));
  renderCards(rows);
}

function renderCards(rows) {
  const grid = document.getElementById('sto-grid');
  if (!rows.length) {
    grid.innerHTML = '<div class="empty-state">Tidak ada data untuk filter ini.</div>';
    return;
  }
  const grouped = aggregate(rows);
  grid.innerHTML = grouped.map(renderSTOCard).join('');

  if (activePanelSTO) {
    const card = document.querySelector(`.sto-card[data-sto="${CSS.escape(activePanelSTO)}"]`);
    if (card) card.classList.add('card-active');
  }
}

function renderSTOCard(sto) {
  const statOrder  = ['online','los','dying','offline'];
  const statusHTML = statOrder.map(sk => {
    const cnt = sto.statuses[sk] || 0;
    return `
      <div class="status-item" onclick="openModal('${esc(sto.name)}',null,'${sk}');event.stopPropagation()" title="Lihat ${STATUS_LABEL[sk]}">
        <span class="status-dot-label">
          <span class="status-dot ${STATUS_DOT[sk]}"></span>
          ${STATUS_LABEL[sk]}
        </span>
        <span class="status-count">${cnt}</span>
      </div>`;
  }).join('');

  const ctypes    = Object.entries(sto.ctypes).sort((a,b) => b[1]-a[1]);
  const ctypeHTML = ctypes.map(([name,count]) => {
    const pct = Math.round(count / sto.total * 100);
    return `
      <div class="ctype-row">
        <span class="ctype-name" title="${esc(name)}">${esc(name)}</span>
        <div class="ctype-right">
          <div class="ctype-bar-bg"><div class="ctype-bar-fill" style="width:${pct}%"></div></div>
          <span class="ctype-count" onclick="openModal('${esc(sto.name)}','${esc(name)}',null);event.stopPropagation()">${count}</span>
        </div>
      </div>`;
  }).join('');

  const isActive = activePanelSTO === sto.name;

  return `
    <div class="sto-card${isActive?' card-active':''}"
         data-sto="${esc(sto.name)}"
         onclick="toggleSidePanel('${esc(sto.name)}', event)">
      <div class="sto-name">${esc(sto.name)}</div>
      <div class="sto-total-row">
        <span class="sto-total-label">Total Alert</span>
        <span class="sto-total-badge" onclick="openModal('${esc(sto.name)}',null,null);event.stopPropagation()">${sto.total}</span>
      </div>

      <div class="card-divider"></div>
      <div class="section-label">Status</div>
      <div class="status-grid">${statusHTML}</div>

      <div class="card-divider"></div>
      <div class="section-label">Customer Type</div>
      <div class="ctype-list">${ctypeHTML}</div>

      <div class="card-hint">Klik card untuk lihat Action & Kendala →</div>
    </div>`;
}

function setMeta(total, stoCount, s) {
  document.getElementById('total-alert').textContent   = total;
  document.getElementById('total-sto').textContent     = stoCount;
  document.getElementById('total-online').textContent  = s.online;
  document.getElementById('total-los').textContent     = s.los;
  document.getElementById('total-dying').textContent   = s.dying;
  document.getElementById('total-offline').textContent = s.offline;
  document.getElementById('last-update').textContent   =
    'Update: ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function showError(msg) {
  const el = document.getElementById('status-msg');
  el.textContent = '⚠ ' + msg; el.classList.remove('hidden');
}
function hideError() { document.getElementById('status-msg').classList.add('hidden'); }

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Side Panel ACTION & KENDALA ────────────── */
function toggleSidePanel(stoName, event) {
  if (event && event.target.closest('.status-item, .ctype-count, .sto-total-badge')) return;

  if (activePanelSTO === stoName) {
    closeSidePanel();
    return;
  }

  activePanelSTO = stoName;

  document.querySelectorAll('.sto-card').forEach(c => c.classList.remove('card-active'));
  const card = document.querySelector(`.sto-card[data-sto="${CSS.escape(stoName)}"]`);
  if (card) card.classList.add('card-active');

  // Hitung count per nilai dari allRows
  const stoRows     = allRows.filter(r => r.sto === stoName);
  const actionCount = {};
  const kendalaCount = {};
  stoRows.forEach(r => {
    if (r.action)  actionCount[r.action]   = (actionCount[r.action]  || 0) + 1;
    if (r.kendala) kendalaCount[r.kendala] = (kendalaCount[r.kendala] || 0) + 1;
  });

  document.getElementById('panel-sto-name').textContent = stoName;

  // Render ACTION STO — list dengan count, urut terbanyak
  const actionEl = document.getElementById('panel-action');
  const actionEntries = Object.entries(actionCount).sort((a,b) => b[1]-a[1]);
  const actionTotal = actionEntries.reduce((s,[,c]) => s+c, 0);
  document.getElementById('panel-action-total').textContent = actionTotal;
  if (actionEntries.length) {
    actionEl.innerHTML = actionEntries.map(([name, cnt]) => `
      <div class="panel-row">
        <span class="panel-row-name">${esc(name)}</span>
        <span class="panel-row-count panel-count-action">${cnt}</span>
      </div>`).join('');
  } else {
    actionEl.innerHTML = '<span class="panel-empty">Tidak ada data</span>';
  }

  // Render KENDALA — list dengan count, urut terbanyak
  const kendalaEl = document.getElementById('panel-kendala');
  const kendalaEntries = Object.entries(kendalaCount).sort((a,b) => b[1]-a[1]);
  const kendalaTotal = kendalaEntries.reduce((s,[,c]) => s+c, 0);
  document.getElementById('panel-kendala-total').textContent = kendalaTotal;
  if (kendalaEntries.length) {
    kendalaEl.innerHTML = kendalaEntries.map(([name, cnt]) => `
      <div class="panel-row">
        <span class="panel-row-name">${esc(name)}</span>
        <span class="panel-row-count panel-count-kendala">${cnt}</span>
      </div>`).join('');
  } else {
    kendalaEl.innerHTML = '<span class="panel-empty">Tidak ada data</span>';
  }

  document.getElementById('side-panel').classList.remove('hidden');
}

function closeSidePanel() {
  activePanelSTO = null;
  document.querySelectorAll('.sto-card').forEach(c => c.classList.remove('card-active'));
  document.getElementById('side-panel').classList.add('hidden');
}

/* ── Modal ──────────────────────────────────── */
function openModal(stoName, ctypeName, statusKey) {
  let rows     = allRows.filter(r => r.sto === stoName);
  let subtitle = stoName;

  if (ctypeName) {
    rows      = rows.filter(r => r.ctype === ctypeName);
    subtitle += ' · ' + ctypeName;
  }
  if (statusKey) {
    rows      = rows.filter(r => r.status === statusKey);
    subtitle += ' · ' + STATUS_LABEL[statusKey];
  }
  if (!ctypeName && !statusKey) subtitle += ' · Semua Alert';

  modalRows = rows;
  document.getElementById('modal-title').textContent    = subtitle;
  document.getElementById('modal-subtitle').textContent = `${rows.length} data ditemukan`;
  document.getElementById('modal-search').value         = '';
  renderModalTable(rows);
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-search').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function filterModal() {
  const q = document.getElementById('modal-search').value.toLowerCase();
  renderModalTable(modalRows.filter(r =>
    r.sn.toLowerCase().includes(q) ||
    r.ctype.toLowerCase().includes(q) ||
    STATUS_LABEL[r.status].toLowerCase().includes(q)
  ));
}

function renderModalTable(rows) {
  document.getElementById('modal-count').textContent = `${rows.length} data`;
  const tbody = document.getElementById('modal-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">Tidak ada data</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${esc(r.sn)||'–'}</td>
      <td><span class="badge-ctype">${esc(r.ctype)}</span></td>
      <td><span class="badge-status ${STATUS_BADGE[r.status]}">${STATUS_LABEL[r.status]}</span></td>
    </tr>`).join('');
}

document.getElementById('modal-overlay').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') { closeModal(); closeSidePanel(); } });

/* ── Load cycle ─────────────────────────────── */
async function loadAndRender() {
  try {
    const rows = await fetchData();
    hideError();
    allRows = rows;

    const filtered    = activeSTO === 'ALL' ? rows : rows.filter(r => r.sto === activeSTO);
    const displayRows = filtered.length ? filtered : rows;

    buildSTOPills(aggregate(allRows));
    setMeta(displayRows.length, aggregate(displayRows).length, globalStatus(displayRows));
    renderCards(displayRows);

  } catch(err) {
    console.error(err);
    showError(err.message + ' — Pastikan spreadsheet sudah publik.');
    if (allRows.length) renderCards(allRows);
    else document.getElementById('sto-grid').innerHTML =
      '<div class="empty-state">Gagal memuat data.</div>';
  }
}

loadAndRender();
setInterval(loadAndRender, CONFIG.REFRESH_MS);
