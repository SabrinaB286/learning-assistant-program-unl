import { getToken } from '/routes/auth.js';

export async function updatePassword(currentPassword, newPassword) {
  const res = await fetch('/api/auth/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok) throw new Error('Password change failed');
  return true;
}
