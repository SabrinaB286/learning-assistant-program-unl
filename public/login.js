// /public/login.js
// If your API base is different, change API_BASE below.
const API_BASE = '/api/auth';

const els = {
  form:    document.getElementById('login-form'),
  login:   document.getElementById('login-input'),
  pass:    document.getElementById('password-input'),
  btn:     document.getElementById('login-btn'),
  alert:   document.getElementById('login-alert'),
  change:  document.getElementById('change-pass-btn'),
};

function showAlert(msg, kind = 'error') {
  if (!els.alert) return;
  els.alert.classList.remove('hidden');
  els.alert.classList.remove('alert-success', 'alert-error');
  els.alert.classList.add(kind === 'success' ? 'alert-success' : 'alert-error');
  els.alert.textContent = msg;
}

function hideAlert() {
  if (!els.alert) return;
  els.alert.classList.add('hidden');
  els.alert.textContent = '';
}

async function handleLoginSubmit(evt) {
  evt.preventDefault();
  hideAlert();

  const login = (els.login?.value || '').trim();
  const password = els.pass?.value || '';

  if (!login || !password) {
    showAlert('Please enter both your NUID/email and password.');
    return;
  }

  // Disable button to prevent double submits
  els.btn.disabled = true;
  els.btn.textContent = 'Signing in…';

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',        // if your API sets an HTTP-only cookie
      body: JSON.stringify({ login, password }),
    });

    // Try to parse JSON safely; if not JSON, fall back to empty object
    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const msg = data?.message || data?.error || `Login failed (${res.status})`;
      throw new Error(msg);
    }

    // SUCCESS: store token if your API returns one
    if (data.token) {
      try { localStorage.setItem('lap_auth_token', data.token); } catch {}
    }

    // Redirect to the right place:
    // - staff → dashboard
    // - students → back to feedback
    const role = (data.role || data.staffRole || '').toUpperCase();
    if (role === 'SL' || role === 'CL' || role === 'LA') {
      window.location.assign('/feedback/index.html#dashboard');
    } else {
      window.location.assign('/feedback/index.html#feedback');
    }
  } catch (err) {
    console.error('Login error:', err);
    showAlert(err?.message || 'Login failed. Please try again.');
    els.btn.disabled = false;
    els.btn.textContent = 'Sign in';
  }
}

function handleChangePasswordClick() {
  // Optional: route where your change password UI lives
  window.location.assign('/feedback/index.html#change-password');
}

// Attach listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (!els.form) {
    console.warn('Login form not found on this page.');
    return;
  }
  els.form.addEventListener('submit', handleLoginSubmit);
  els.change?.addEventListener('click', handleChangePasswordClick);
  hideAlert();

  // Helpful debug: show any script path problems
  console.log('[login.js] bound to #login-form; API base:', API_BASE);
});
