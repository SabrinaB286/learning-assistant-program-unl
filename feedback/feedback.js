// ===== Auth state & helpers =====
let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch { currentUser = null; }

function authHeaders() {
  const t = authToken || localStorage.getItem('authToken');
  return t
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
    : { 'Content-Type': 'application/json' };
}

function show(el, on) { if (!el) return; el.classList[on ? 'remove' : 'add']('hidden'); }

function updateUI() {
  const who    = document.getElementById('whoami');
  const whoTxt = document.getElementById('whoami-text');
  const auth   = document.getElementById('auth-panel');
  const sched  = document.getElementById('schedule-panel');
  const admin  = document.getElementById('admin-panel');
  const fb     = document.getElementById('feedback-panel');

  const loggedIn = !!(authToken && currentUser);
  show(auth,   !loggedIn);
  show(who,     loggedIn);
  show(fb,      loggedIn);

  if (loggedIn) {
    whoTxt.textContent = currentUser.kind === 'staff'
      ? `Logged in as ${currentUser.name} (${currentUser.role})`
      : `Logged in as ${currentUser.name} (student)`;
  }

  // Staff schedule
  const isStaff = loggedIn && currentUser.kind === 'staff';
  show(sched, isStaff);
  if (isStaff) loadMySchedule();

  // Admin (SL only)
  const isSL = isStaff && currentUser.role === 'SL';
  show(admin, isSL);
  if (isSL) loadPendingStudents();
}

// ===== Data loaders =====
async function loadMySchedule() {
  const tbody = document.querySelector('#schedule-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
  try {
    const r = await fetch(`/api/staff/${currentUser.nuid}/schedule`, { headers: authHeaders() });
    const rows = await r.json();
    if (!r.ok) throw new Error(rows.error || 'Failed');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">No entries</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(x => `
      <tr><td>${x.type}</td><td>${x.day}</td><td>${x.start_time}</td><td>${x.end_time}</td><td>${x.location || ''}</td><td>${x.course || ''}</td></tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">Error: ${e.message}</td></tr>`;
  }
}

async function loadPendingStudents() {
  const box = document.getElementById('pending-rows');
  if (!box) return;
  box.textContent = 'Loading…';
  try {
    const r = await fetch('/api/auth/students/pending', { headers: authHeaders() });
    const rows = await r.json();
    if (!r.ok) throw new Error(rows.error || 'Failed');
    if (!rows.length) { box.textContent = 'No pending students.'; return; }
    box.innerHTML = rows.map(r => `
      <div class="card">
        <b>${r.name}</b> — ${r.email} ${r.nuid ? `(${r.nuid})` : ''} — ${r.class_year || ''}
        <div style="margin-top:6px">
          <button data-act="approve" data-id="${r.id}">Approve</button>
          <button data-act="reject"  data-id="${r.id}">Reject</button>
        </div>
      </div>
    `).join('');
    box.querySelectorAll('button[data-act]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        const r2 = await fetch(`/api/auth/students/${id}/${act}`, { method: 'POST', headers: authHeaders() });
        const j  = await r2.json().catch(() => ({}));
        if (!r2.ok) return alert(j.error || 'Action failed');
        loadPendingStudents();
      };
    });
  } catch (e) {
    box.textContent = `Error: ${e.message}`;
  }
}

// ===== Wire events =====
window.addEventListener('DOMContentLoaded', () => {
  updateUI();

  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const login = (document.getElementById('login-id')?.value || '').trim();
    const password = (document.getElementById('login-pw')?.value || '');
    if (!login || !password) return alert('Please enter login and password');
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Login failed');
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    updateUI();
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    updateUI();
  });

  document.getElementById('btn-student-signup')?.addEventListener('click', async () => {
    const name  = (document.getElementById('su-name')?.value || '').trim();
    const email = (document.getElementById('su-email')?.value || '').trim().toLowerCase();
    const nuid  = (document.getElementById('su-nuid')?.value || '').trim();
    const password = (document.getElementById('su-pw')?.value || '');
    const class_year = (document.getElementById('su-year')?.value || '').trim();
    const courses = (document.getElementById('su-courses')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    const r = await fetch('/api/auth/student/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, nuid, password, class_year, courses })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Signup failed');
    alert('Submitted for approval by SL. You can log in after approval.');
  });

  document.getElementById('btn-add-staff')?.addEventListener('click', async () => {
    const nuid = (document.getElementById('st-nuid')?.value || '').trim();
    const name = (document.getElementById('st-name')?.value || '').trim();
    const role = (document.getElementById('st-role')?.value || 'LA');
    const email = (document.getElementById('st-email')?.value || '').trim();
    const password = (document.getElementById('st-pass')?.value || '');
    const courses = (document.getElementById('st-courses')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    const r = await fetch('/api/staff', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nuid, name, role, email, password, courses })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Create failed');
    alert('Staff created.');
  });

  document.getElementById('btn-send-feedback')?.addEventListener('click', async () => {
    const course = (document.getElementById('fb-course')?.value || '').trim();
    const type   = (document.getElementById('fb-type')?.value || 'General');
    const rating = Number(document.getElementById('fb-rating')?.value || '') || null;
    const text   = (document.getElementById('fb-text')?.value || '').trim();
    if (!text) return alert('Please enter feedback text');
    const r = await fetch('/api/feedback', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ course, type, rating, text })
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Could not submit');
    alert('Thanks for the feedback!');
    document.getElementById('fb-text').value = '';
  });
});
