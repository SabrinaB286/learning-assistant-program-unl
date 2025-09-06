import { getToken } from '/routes/auth.js';

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Everyone can read office hours; token is optional
export async function fetchOfficeHours(courseCode /* 'CSCE 101' or null */) {
  const url = new URL('/api/office-hours', window.location.origin);
  if (courseCode) url.searchParams.set('course', courseCode);
  const res = await fetch(url.toString(), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Failed to load office hours');
  return res.json();
}

// Students add themselves to the queue (protected: requires login)
export async function joinQueue(scheduleId) {
  const res = await fetch(`/api/office-hours/${scheduleId}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() }
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({message:'Join queue failed'}));
    throw new Error(err.message || 'Join queue failed');
  }
  return res.json();
}
