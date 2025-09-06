// routes/auth.js  (client-side)
const TOKEN_KEY = 'lap_jwt';

// ---- token helpers ----
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function isLoggedIn() {
  return !!getToken();
}

// ---- high-level actions ----
export async function signIn(login, password) {
  // login can be NUID or email
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password })
  });

  if (!res.ok) {
    let msg = 'Login failed';
    try { msg = (await res.json()).message || msg; } catch {}
    throw new Error(msg);
  }

  const { token, user } = await res.json();
  setToken(token);
  return user; // { nuid, name, role, email ... }
}

export function signOut() {
  setToken('');
}

export async function changePassword(currentPassword, newPassword) {
  const token = getToken();
  const res = await fetch('/api/auth/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  if (!res.ok) {
    let msg = 'Password change failed';
    try { msg = (await res.json()).message || msg; } catch {}
    throw new Error(msg);
  }

  return true;
}
