// feedback/feedback.js

// ---------- small helpers ----------
const API_BASE = window.__API_BASE__ || location.origin;
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function showAlert(msg, type='ok') {
  const el = $('#alert');
  if (!msg) return el.classList.add('hidden');
  el.textContent = msg;
  el.style.background = type === 'ok' ? '#ecfdf5' : '#fef2f2';
  el.style.color = type === 'ok' ? '#065f46' : '#991b1b';
  el.classList.remove('hidden');
}

function saveAuth(token, user) { localStorage.setItem('lap_jwt', token); localStorage.setItem('lap_user', JSON.stringify(user)); }
function readAuth() { return { token: localStorage.getItem('lap_jwt'), user: JSON.parse(localStorage.getItem('lap_user') || 'null') }; }
function clearAuth() { localStorage.removeItem('lap_jwt'); localStorage.removeItem('lap_user'); }

async function jsonFetch(path, options = {}) {
  const headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
  const opts = Object.assign({}, options, { headers });
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  let payload;
  if (ct.includes('application/json')) payload = await res.json();
  else {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} — non-JSON: ${text.slice(0,200)}`);
  }
  if (!res.ok) throw new Error(payload?.error || payload?.message || `HTTP ${res.status}`);
  return payload;
}

function authFetch(path, options={}) {
  const { token } = readAuth();
  const headers = Object.assign({}, options.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  return jsonFetch(path, Object.assign({}, options, { headers }));
}

// ---------- UI state ----------
function show(id) {
  ['view-login','view-hours','view-feedback'].forEach(v => $('#'+v).classList.add('hidden'));
  $('#'+id).classList.remove('hidden');
  $$('.chip[data-route]').forEach(c => c.classList.remove('active'));
  const b = $(`.chip[data-route="${id.replace('view-','')}"]`);
  b && b.classList.add('active');
}

function renderAuthed(user) {
  $('#user-badge').textContent = `${user.name || 'User'} (${user.role || '—'})`;
  $('#user-badge').classList.remove('hidden');
  $('#btn-logout').classList.remove('hidden');
  $('#nav-login').classList.add('hidden');
}

function renderLoggedOut() {
  $('#user-badge').textContent = '';
  $('#user-badge').classList.add('hidden');
  $('#btn-logout').classList.add('hidden');
  $('#nav-login').classList.remove('hidden');
}

// ---------- login/logout ----------
async function doLogin() {
  showAlert('');
  const login = $('#login-id').value.trim();
  const password = $('#login-pass').value;
  if (!login || !password) return showAlert('Enter NUID/email and password', 'err');

  try {
    const { token, user } = await jsonFetch('/api/auth/login', { method:'POST', body:{ login, password } });
    saveAuth(token, user);
    renderAuthed(user);
    show('view-hours');
    await loadOfficeHours();
  } catch (err) {
    showAlert(`Login failed: ${err.message}`, 'err');
  }
}

// ---------- office hours ----------
function renderOfficeHours(items) {
  const root = $('#hours-list');
  root.innerHTML = items.map(i => `
    <div class="wrap" style="border:1px solid #eee">
      <div><strong>${i.staff_name || 'Unknown'}</strong> ${i.staff_role ? '('+i.staff_role+')' : ''}</div>
      <div class="muted">${i.course_code || ''}</div>
      <div>${i.day || ''} ${i.start_time || ''}–${i.end_time || ''} @ ${i.location || ''}</div>
    </div>
  `).join('') || '<div class="muted">No office hours yet.</div>';
}

async function loadOfficeHours(course = '') {
  try {
    showAlert('');
    const all = await jsonFetch('/api/schedule/office-hours');
    const items = course ? all.filter(i => (i.course_code || '') === course) : all;
    renderOfficeHours(items);
  } catch (err) {
    showAlert(`Request failed (${err.message}). Check your API route & Content-Type.`, 'err');
  }
}

// ---------- events ----------
window.addEventListener('DOMContentLoaded', () => {
  // nav
  $$('.chip[data-route]').forEach(b => b.addEventListener('click', () => {
    const r = b.dataset.route;
    if (r === 'login') show('view-login');
    if (r === 'hours') { show('view-hours'); loadOfficeHours(); }
    if (r === 'feedback') show('view-feedback');
  }));

  // login
  $('#btn-login')?.addEventListener('click', doLogin);
  $('#login-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });

  // logout
  $('#btn-logout')?.addEventListener('click', () => { clearAuth(); renderLoggedOut(); show('view-login'); });

  // course chips
  $$('#view-hours .chip[data-course]').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#view-hours .chip[data-course]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadOfficeHours(chip.dataset.course || '');
    });
  });

  // boot
  const { user } = readAuth();
  if (user) { renderAuthed(user); show('view-hours'); loadOfficeHours(); }
  else { renderLoggedOut(); show('view-login'); }
});
