let currentMonth = 4;
let currentEditDay = null;
let localCache = {};

const MONTH_NAMES = { 2:'Private Confidence', 3:'Expanding Space', 4:'Public Comfort', 5:'Creator Ready' };
const PHASE_LABELS = { 2:'PRIVATE CONFIDENCE', 3:'EXPANDING SPACE', 4:'PUBLIC COMFORT', 5:'CREATOR READY' };
const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

function applyViewMode() {
  if (!isAdmin) {
    document.querySelectorAll('.edit-score-btn').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.video-placeholder').forEach(p => {
      p.style.cursor = 'default';
      p.onclick = null;
    });
    const notes = document.getElementById('improvementNotes');
    if (notes) { notes.readOnly = true; notes.style.opacity = '0.6'; notes.style.cursor = 'not-allowed'; }
    const reportBtn = document.getElementById('adminReportBtn');
    if (reportBtn) reportBtn.style.display = 'none';
  } else {
    if (!document.querySelector('.admin-badge')) {
      const badge = document.createElement('div');
      badge.className = 'admin-badge';
      badge.textContent = '⚙ ADMIN MODE';
      document.body.appendChild(badge);
    }
  }
}

async function saveToFirestore(month, data) {
  try {
    await window._firestoreSetDoc(window._firestoreDoc(window._db, 'nazlan', 'month_' + month), data);
    showSaveNotice();
  } catch(e) { console.error('Save error:', e); alert('Gagal menyimpan: ' + e.message); }
}

function getMonthData(month) {
  if (!localCache[month]) localCache[month] = { videos: {}, notes: '' };
  return localCache[month];
}
async function loadFromFirestore(month) {
  try {
    const snap = await window._firestoreGetDoc(window._firestoreDoc(window._db, 'nazlan', 'month_' + month));
    return snap.exists() ? snap.data() : { videos: {}, notes: '' };
  } catch(e) { console.error('Load error:', e); return { videos: {}, notes: '' }; }
}

function showSaveNotice() {
  const n = document.getElementById('saveNotice');
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2500);
}

function calcScore(criteria) {
  const keys = ['eye','expr','fluency','clarity','creative','persona'];
  const vals = keys.map(k => parseFloat(criteria[k]) || 0);
  if (vals.filter(v => v > 0).length === 0) return null;
  return (vals.reduce((a,b) => a+b, 0) / keys.length).toFixed(1);
}

function toEmbedUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.match(/youtube\.com\/embed\/[a-zA-Z0-9_-]{11}/)) return url;
  const w = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (w) return 'https://www.youtube.com/embed/' + w[1];
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (s) return 'https://www.youtube.com/embed/' + s[1];
  const sh = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (sh) return 'https://www.youtube.com/embed/' + sh[1];
  return url;
}

function extractYoutubeId(url) {
  if (!url) return '';
  const e = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (e) return e[1];
  const w = url.match(/youtube\.com\/watch\?.*v=([^&]+)/);
  if (w) return w[1];
  const s = url.match(/youtu\.be\/([^?&]+)/);
  if (s) return s[1];
  return '';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function playVideo(el, url) {
  el.innerHTML = '<iframe src="' + url + '?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>';
}

function renderVideoGrid() {
  const grid = document.getElementById('videoGrid');
  const videos = getMonthData(currentMonth).videos || {};
  const scored = [];
  for (let d = 1; d <= 30; d++) {
    const v = videos[d];
    if (v && v.score != null) scored.push({ day: d, score: parseFloat(v.score) });
  }
  scored.sort((a,b) => b.score - a.score);
  const rankMap = {};
  scored.forEach((item, idx) => { rankMap[item.day] = idx + 1; });

  grid.innerHTML = '';
  for (let day = 1; day <= 30; day++) {
    const v = videos[day] || {};
    const rank = rankMap[day];
    const score = v.score != null ? v.score : null;
    const rankClass = rank === 1 ? 'ranked-1' : rank === 2 ? 'ranked-2' : rank === 3 ? 'ranked-3' : '';
    const rankBadge = rank && rank <= 3 ? '<div class="rank-badge r' + rank + '">' + rank + '</div>' : '';
    const videoId = v.url ? extractYoutubeId(v.url) : null;
    const embedHtml = v.url
      ? '<div class="yt-thumb-wrap" onclick="playVideo(this,\'' + escapeHtml(v.url) + '\')" style="width:100%;height:100%;position:relative;cursor:pointer;"><img src="https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;" onerror="this.src=\'https://img.youtube.com/vi/' + videoId + '/0.jpg\'"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;background:rgba(232,25,44,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">▶</div></div></div>'
      : '<div class="video-placeholder"' + (isAdmin ? ' onclick="openModal(' + day + ')"' : '') + '><div class="play-icon">' + (isAdmin ? '＋' : '') + '</div><div class="add-text">' + (isAdmin ? 'TAP TO ADD<br>VIDEO' : '') + '</div></div>';
    const scoreDisplay = score !== null
      ? '<div class="score-display">' + score + '</div><div class="score-bar-wrap"><div class="score-bar" style="width:' + (score*10) + '%"></div></div>'
      : '<div class="score-empty">NO SCORE</div>';
    const editBtn = isAdmin ? '<button class="edit-score-btn" onclick="openModal(' + day + ')">✏</button>' : '';
    const pills = score !== null ? buildCriteriaPills(v.criteria || {}) : '';
    grid.innerHTML += '<div class="video-card ' + rankClass + '">' + rankBadge + '<div class="day-badge">DAY ' + day + '</div><div class="video-embed-wrap">' + embedHtml + '</div><div class="video-info"><div class="video-title">' + (v.title || 'Day ' + day + ' — ' + MONTH_NAMES[currentMonth]) + '</div><div class="video-score-row">' + scoreDisplay + editBtn + '</div>' + pills + (v.notes ? '<div style="font-size:0.6rem;color:var(--gray);margin-top:0.4rem;line-height:1.4;">' + v.notes + '</div>' : '') + '</div></div>';
  }
}

function buildCriteriaPills(c) {
  const map = [{label:'Eye',val:c.eye},{label:'Expr',val:c.expr},{label:'Lancar',val:c.fluency},{label:'Jelas',val:c.clarity},{label:'Kreatif',val:c.creative},{label:'Karakter',val:c.persona}];
  const pills = map.filter(m => m.val).map(m => {
    const v = parseFloat(m.val);
    const cls = v >= 8 ? 'cp-green' : v >= 6 ? 'cp-blue' : v >= 4 ? 'cp-yellow' : 'cp-red';
    return '<span class="criteria-pill ' + cls + '">' + m.label + ':' + v + '</span>';
  }).join('');
  return pills ? '<div class="criteria-pills">' + pills + '</div>' : '';
}

function openModal(day) {
  if (!isAdmin) return;
  currentEditDay = day;
  const v = (getMonthData(currentMonth).videos || {})[day] || {};
  document.getElementById('modalDayNum').textContent = day;
  document.getElementById('modalTitle').value = v.title || '';
  document.getElementById('modalUrl').value = v.url || '';
  document.getElementById('modalNotes').value = v.notes || '';
  const c = v.criteria || {};
  ['eye','expr','fluency','clarity','creative','persona'].forEach(k => { document.getElementById('sc-' + k).value = c[k] || ''; });
  document.getElementById('editModal').classList.add('open');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  currentEditDay = null;
}

async function saveVideo() {
  if (!currentEditDay || !isAdmin) return;
  const criteria = {};
  ['eye','expr','fluency','clarity','creative','persona'].forEach(k => {
    const val = document.getElementById('sc-' + k).value;
    if (val !== '') criteria[k] = parseFloat(val);
  });
  if (!localCache[currentMonth]) localCache[currentMonth] = { videos: {}, notes: '' };
  if (!localCache[currentMonth].videos) localCache[currentMonth].videos = {};
  localCache[currentMonth].videos[currentEditDay] = {
    title: document.getElementById('modalTitle').value,
    url: toEmbedUrl(document.getElementById('modalUrl').value),
    notes: document.getElementById('modalNotes').value,
    criteria,
    score: calcScore(criteria)
  };
  closeModal();
  renderAll();
  await saveToFirestore(currentMonth, localCache[currentMonth]);
}

function updateStats() {
  const videos = getMonthData(currentMonth).videos || {};
  let total = 0, totalScore = 0, scoreCount = 0, best = null, streak = 0, cur = 0;
  for (let d = 1; d <= 30; d++) {
    const v = videos[d];
    if (v && v.url) { total++; cur++; streak = Math.max(streak, cur); } else { cur = 0; }
    if (v && v.score != null) { const s = parseFloat(v.score); totalScore += s; scoreCount++; if (best === null || s > best) best = s; }
  }
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAvg').textContent = scoreCount > 0 ? (totalScore/scoreCount).toFixed(1) : '—';
  document.getElementById('statBest').textContent = best !== null ? best : '—';
  document.getElementById('statStreak').textContent = streak;
}

function renderRanking() {
  const videos = getMonthData(currentMonth).videos || {};
  const ranked = [];
  for (let d = 1; d <= 30; d++) { const v = videos[d]; if (v && v.score != null) ranked.push({ day: d, ...v }); }
  ranked.sort((a,b) => parseFloat(b.score) - parseFloat(a.score));
  const list = document.getElementById('rankingList');
  if (!ranked.length) { list.innerHTML = '<div class="empty-state">Belum ada video yang diberi skor</div>'; return; }
  list.innerHTML = ranked.map((v, idx) => {
    const pos = idx + 1;
    const pc = pos === 1 ? 'top1' : pos === 2 ? 'top2' : pos === 3 ? 'top3' : '';
    const col = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
    return '<div class="rank-row ' + pc + '"><div class="rank-pos ' + col + '">#' + pos + '</div><div class="rank-day">DAY ' + v.day + '</div><div class="rank-title-text">' + (v.title || 'Day ' + v.day) + '</div><div class="rank-score">' + v.score + '</div><div class="rank-progress"><div class="rank-progress-fill" style="width:' + (v.score*10) + '%"></div></div></div>';
  }).join('');
}

let chartInstance = null;
function renderChart() {
  const videos = getMonthData(currentMonth).videos || {};
  const labels = [], scores = [], colors = [];
  for (let d = 1; d <= 30; d++) {
    labels.push('D' + d);
    const v = videos[d];
    const s = v && v.score != null ? parseFloat(v.score) : null;
    scores.push(s);
    colors.push(s !== null ? 'rgba(232,25,44,0.8)' : 'rgba(100,100,100,0.3)');
  }
  const filled = scores.filter(s => s !== null);
  const avg = filled.length > 0 ? filled.reduce((a,b) => a+b, 0) / filled.length : null;
  const ctx = document.getElementById('scoreChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Skor', data:scores, backgroundColor:colors, borderColor:scores.map(s => s!==null?'#E8192C':'transparent'), borderWidth:1, borderRadius:4 },
      { label:'Avg', data:Array(30).fill(avg), type:'line', borderColor:'#FFD600', borderWidth:2, borderDash:[6,3], pointRadius:0, fill:false }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label: ctx => ctx.datasetIndex===0?(ctx.raw!==null?'Skor: '+ctx.raw:'Kosong'):('Avg: '+(ctx.raw?ctx.raw.toFixed(1):'—'))}, backgroundColor:'#162240', titleColor:'#F5F5F0', bodyColor:'#8A8F9E'}},
      scales: { x:{ticks:{color:'#8A8F9E',font:{family:'Space Mono',size:8}},grid:{color:'rgba(255,255,255,0.04)'}}, y:{min:0,max:10,ticks:{color:'#8A8F9E',font:{family:'Space Mono',size:8}},grid:{color:'rgba(255,255,255,0.06)'}} }
    }
  });
}

function renderProgressBars() {
  const videos = getMonthData(currentMonth).videos || {};
  const c = { eye:[], expr:[], fluency:[], clarity:[], creative:[], persona:[] };
  for (let d = 1; d <= 30; d++) { const v = videos[d]; if (v && v.criteria) Object.keys(c).forEach(k => { if (v.criteria[k]) c[k].push(parseFloat(v.criteria[k])); }); }
  const avg = k => { const a = c[k]; return a.length > 0 ? a.reduce((x,y)=>x+y,0)/a.length : null; };
  ['eye','expr','posture','fluency','clarity','rhythm','creative','engage','persona'].forEach(k => {
    const val = avg(k==='posture'?'expr':k==='rhythm'?'fluency':k==='engage'?'creative':k);
    const el = document.getElementById('prog-'+k), bar = document.getElementById('bar-'+k);
    if (el) { if (val!==null){el.textContent=val.toFixed(1)+'/10';bar.style.width=(val*10)+'%';}else{el.textContent='—';bar.style.width='0%';} }
  });
  const n = document.getElementById('improvementNotes');
  if (n) n.value = getMonthData(currentMonth).notes || '';
}

async function saveNotes() {
  if (!isAdmin) return;
  if (!localCache[currentMonth]) localCache[currentMonth] = { videos: {}, notes: '' };
  localCache[currentMonth].notes = document.getElementById('improvementNotes').value;
  await saveToFirestore(currentMonth, localCache[currentMonth]);
}

function renderReport() {
  document.querySelectorAll('.report-month').forEach(el => {
    el.style.display = el.dataset.month == currentMonth ? 'block' : 'none';
  });
  document.getElementById('reportMonthTitle').textContent = MONTH_NAMES[currentMonth];
}

function generateReport() {
  const videos = getMonthData(currentMonth).videos || {};
  let total = 0, scoreCount = 0, totalScore = 0, best = null, bestDay = null;
  for (let d = 1; d <= 30; d++) {
    const v = videos[d];
    if (v && v.url) total++;
    if (v && v.score != null) { const s = parseFloat(v.score); scoreCount++; totalScore += s; if (best===null||s>best){best=s;bestDay=d;} }
  }
  const avg = scoreCount > 0 ? (totalScore/scoreCount).toFixed(1) : 'N/A';
  const notes = getMonthData(currentMonth).notes || 'Tidak ada catatan.';
  document.getElementById('reportContent').innerHTML = '<strong>Periode:</strong> ' + MONTH_NAMES[currentMonth] + '<br><strong>Fase:</strong> ' + PHASE_LABELS[currentMonth] + '<br><br><strong>📹 Ringkasan:</strong><br>• Total video: <span style="color:var(--yellow)">' + total + '/30</span><br>• Dinilai: <span style="color:var(--yellow)">' + scoreCount + '</span><br>• Rata-rata: <span style="color:var(--yellow)">' + avg + '/10</span><br>• Terbaik: <span style="color:var(--gold)">Day ' + (bestDay||'—') + ' (Skor: ' + (best||'—') + ')</span><br><br><strong>📝 Catatan:</strong><br><span style="color:#ccc;">' + notes + '</span>';
  document.getElementById('generatedReport').style.display = 'block';
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'ranking') { renderRanking(); renderChart(); }
  if (name === 'progress') renderProgressBars();
  if (name === 'report') renderReport();
}

// Update phase tracker visual selection
function updatePhaseSelection(month) {
  document.querySelectorAll('.phase-item').forEach(el => {
    el.classList.remove('active-selected');
    if (parseInt(el.dataset.month) === month) {
      el.classList.add('active-selected');
    }
  });
  document.getElementById('phaseLabel').textContent = PHASE_LABELS[month];
  document.getElementById('monthLabelTitle').textContent = MONTH_NAMES[month];
}

async function switchMonth(month) {
  currentMonth = parseInt(month);
  updatePhaseSelection(currentMonth);
  document.getElementById('loadingOverlay').classList.remove('hidden');
  localCache[currentMonth] = await loadFromFirestore(currentMonth);
  document.getElementById('loadingOverlay').classList.add('hidden');
  renderAll();
}

function renderAll() {
  renderVideoGrid();
  updateStats();
  applyViewMode();
  // Re-render active panel
  const activePanel = document.querySelector('.panel.active');
  if (activePanel) {
    const name = activePanel.id.replace('panel-', '');
    if (name === 'ranking') { renderRanking(); renderChart(); }
    if (name === 'progress') renderProgressBars();
    if (name === 'report') renderReport();
  }
}

document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

window.addEventListener('firebaseReady', async () => {
  localCache[currentMonth] = await loadFromFirestore(currentMonth);
  document.getElementById('loadingOverlay').classList.add('hidden');
  renderAll();
});
