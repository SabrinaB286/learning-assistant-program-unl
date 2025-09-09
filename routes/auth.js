// public/routes/auth.js
// Frontend auth/session helpers for LA Portal

const LS_KEY = "lap_auth_v1";

// ---- Session helpers
export function saveSession({ token, user }) {
  if (!token || !user) return;
  localStorage.setItem(LS_KEY, JSON.stringify({ token, user }));
}

export function clearSession() {
  localStorage.removeItem(LS_KEY);
}

export function getSession() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getToken() {
  return getSession().token || null;
}

export function getCurrentUser() {
  return getSession().user || null;
}

export function getCurrentUserName() {
  const u = getCurrentUser();
  return u?.name || u?.email || u?.nuid || null;
}

export function getCurrentUserRole() {
  const u = getCurrentUser();
  return (u?.role || "").toUpperCase();
}

export function isStaff() {
  return new Set(["SL", "CL", "LA"]).has(getCurrentUserRole());
}

// ---- API convenience
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function loginRequest({ login, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(()=>({message:"Login failed"}))).message;
    throw new Error(msg || "Login failed");
  }
  const data = await res.json(); // { token, user: { name, email, role, nuid } }
  saveSession(data);
  return data;
}

export async function meRequest() {
  const res = await fetch("/api/auth/me", { headers: { ...authHeaders() } });
  if (res.ok) return res.json();
  return null;
}

export async function logoutRequest() {
  // optional server call; we mostly just clear local
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  clearSession();
}
