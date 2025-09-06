import { getToken } from '/routes/auth.js';

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// List LAs assigned to a CL
export async function fetchAssignedLAs() {
  const res = await fetch('/api/staff/assigned-las', {
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error('Failed to load assigned LAs');
  return res.json();
}

// Add or update a staff schedule row
export async function upsertSchedule(entry) {
  const res = await fetch('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry)   // { day, start, end, type, location, course_code }
  });
  if (!res.ok) throw new Error('Failed to save schedule');
  return res.json();
}

// Delete a schedule row
export async function deleteSchedule(id) {
  const res = await fetch(`/api/schedule/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error('Failed to delete schedule');
  return true;
}
