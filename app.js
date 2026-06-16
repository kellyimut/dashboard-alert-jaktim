/* =============================================
   DASHBOARD ALERT – JAKARTA TIMUR
   app.js — Data fetch, render, modal logic
   =============================================
   
   KONFIGURASI:
   Ganti SHEET_ID dan SHEET_NAME sesuai spreadsheet kamu.
   Spreadsheet HARUS sudah dibuat "Anyone with link can view".
   ============================================= */

const CONFIG = {
  // ── GANTI INI dengan Sheet ID kamu ──────────────────────────────────────
  SHEET_ID: '1q_Ifa8RXrXm4fxs8gzcEMROU9jGp5NfW2cMeUGFbsFg',
  SHEET_NAME: 'hari ini',          // Nama sheet (harus sama persis)
  // ────────────────────────────────────────────────────────────────────────

  // Nama kolom di spreadsheet (sesuaikan jika header berbeda)
  COL_STO: 'STO',                  // kolom nama STO
  COL_SN:  'SN',                   // kolom Serial Number
  COL_CTYPE: 'CUSTOMER TYPE',      // kolom Customer Type

  REFRESH_MS: 5 * 60 * 1000,      // auto-refresh tiap 5 menit
};

/* ── State ─────────────────────────────────────────────────────────────── */
let allRows      = [];    // semua baris mentah dari sheet
let modalRows    = [];    // baris yang sedang ditampilkan di modal
let modalTitle   = '';

/* ── Fetch & Parse ─────────────────────────────────────────────────────── */
function buildCSVUrl() {
  const name = encodeURIComponent(CONFIG.SHEET_NAME);
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${name}`;
}

async function fetchData() {
  const url = buildCSVUrl();
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} – gagal mengambil data`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header — hapus tanda kutip dan lowercase untuk pencocokan fleksibel
  const headers = csvSplitLine(lines[0]).map(h => h.replace(/"/g, '').trim());

  // Cari index kolom
  const idxSTO   = findCol(headers, CONFIG.COL_STO);
  const idxSN    = findCol(headers, CONFIG.COL_SN);
  const idxCTYPE = findCol(headers, CONFIG.COL_CTYPE);

  if (idxSTO === -1 || idxSN === -1 || idxCTYPE === -1) {
    throw new Error(
      `Kolom tidak ditemukan di spreadsheet.\n` +
      `Header yang ditemukan: ${headers.join(', ')}\n` +
      `Kolom yang dicari: "${CONFIG.COL_STO}", "${CONFIG.COL_SN}", "${CONFIG.COL_CTYPE}"`
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = csvSplitLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim());
    const sto   = cells[idxSTO]   || '';
    const sn    = cells[idxSN]    || '';
    const ctype = cells[idxCTYPE] || 'Tidak diketahui';
    if (!sto && !sn) continue;    // skip baris kosong
    rows.push({ sto, sn, ctype });
  }
  return rows;
}

function findCol(headers, name) {
  const target = name.toLowerCase();
  return headers.findIndex(h => h.toLowerCase() === target);
}

function csvSplitLine(line) {
  // Simple CSV split — handles quoted commas
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

/* ── Aggregate ──────────────────────────────────────────────────────────── */
function aggregate(rows) {
  const stos = {};
  for (const row of rows) {
    const key = row.sto || '(Tanpa STO)';
    if (!stos[key]) stos[key] = { total: 0, ctypes: {}, rows: [] };
    stos[key].total++;
    stos[key].ctypes[row.ctype] = (stos[key].ctypes[row.ctype] || 0) + 1;
    stos[key].rows.push(row);
  }
  // Urutkan: total terbesar dulu
  return Object.entries(stos)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => ({ name, ...data }));
}

/* ── Render ─────────────────────────────────────────────────────────────── */
function render(rows) {
  const grid = document.getElementById('sto-grid');
  if (!rows.length) {
    grid.innerHTML = '<div class="empty-state">Tidak ada data alert saat ini.</div>';
    setMeta(0, 0);
    return;
  }

  const grouped = aggregate(rows);
  setMeta(rows.length, grouped.length);

  grid.innerHTML = grouped.map(sto => renderSTOCard(sto)).join('');
}

function renderSTOCard(sto) {
  const ctypes = Object.entries(sto.ctypes)
    .sort((a, b) => b[1] - a[1]);

  const ctypeRows = ctypes.map(([name, count]) => {
    const pct = Math.round((count / sto.total) * 100);
    return `
      <div class="ctype-row">
        <span class="ctype-name" title="${esc(name)}">${esc(name)}</span>
        <div class="ctype-right">
          <div class="ctype-bar-bg">
            <div class="ctype-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="ctype-count"
                onclick="openModal('${esc(sto.name)}','${esc(name)}')"
                title="Lihat detail ${esc(name)}">
            ${count}
          </span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="sto-card">
      <div class="sto-name">${esc(sto.name)}</div>
      <div class="sto-total-row">
        <span class="sto-total-label">Total Alert</span>
        <span class="sto-total-badge"
              onclick="openModal('${esc(sto.name)}', null)"
              title="Lihat semua alert ${esc(sto.name)}">
          ${sto.total}
        </span>
      </div>
      <div class="ctype-list">${ctypeRows}</div>
    </div>`;
}

function setMeta(total, stoCount) {
  document.getElementById('total-alert').textContent = total;
  document.getElementById('total-sto').textContent   = stoCount;
  document.getElementById('last-update').textContent =
    'Update: ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showError(msg) {
  const el = document.getElementById('status-msg');
  el.textContent = '⚠ ' + msg;
  el.classList.remove('hidden');
}
function hideError() {
  document.getElementById('status-msg').classList.add('hidden');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
function openModal(stoName, ctypeName) {
  // Filter baris sesuai klik
  if (ctypeName) {
    modalRows = allRows.filter(r => r.sto === stoName && r.ctype === ctypeName);
    modalTitle = `${stoName} · ${ctypeName}`;
  } else {
    modalRows = allRows.filter(r => r.sto === stoName);
    modalTitle = `${stoName} · Semua Alert`;
  }

  document.getElementById('modal-title').textContent   = modalTitle;
  document.getElementById('modal-subtitle').textContent = `${modalRows.length} data ditemukan`;
  document.getElementById('modal-search').value        = '';
  renderModalTable(modalRows);

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
  const filtered = modalRows.filter(r =>
    r.sn.toLowerCase().includes(q) || r.ctype.toLowerCase().includes(q)
  );
  renderModalTable(filtered);
}

function renderModalTable(rows) {
  const tbody = document.getElementById('modal-tbody');
  document.getElementById('modal-count').textContent = `${rows.length} data`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">Tidak ada data</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.sn) || '–'}</td>
      <td><span class="badge-ctype">${esc(r.ctype)}</span></td>
    </tr>`).join('');
}

// Tutup modal klik overlay
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
// Tutup modal dengan Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ── Load cycle ─────────────────────────────────────────────────────────── */
async function loadAndRender() {
  try {
    const rows = await fetchData();
    hideError();
    allRows = rows;
    render(rows);
  } catch (err) {
    console.error(err);
    showError(err.message + ' — Pastikan spreadsheet sudah diset "Anyone with link can view".');
    // Jika ada data lama, tetap tampilkan
    if (allRows.length) render(allRows);
    else document.getElementById('sto-grid').innerHTML =
      '<div class="empty-state">Gagal memuat data. Periksa konfigurasi spreadsheet.</div>';
  }
}

// Initial load
loadAndRender();

// Auto-refresh
setInterval(loadAndRender, CONFIG.REFRESH_MS);
