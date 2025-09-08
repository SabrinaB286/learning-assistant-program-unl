// public/routes/auth.js
const KEY = 'lap_jwt';

export function getToken(){ return localStorage.getItem(KEY) || ''; }
export function setToken(t){ t ? localStorage.setItem(KEY,t) : localStorage.removeItem(KEY); }
export function isLoggedIn(){ return !!getToken(); }

export async function signIn(login, password){
  const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,password})});
  if(!r.ok){ let msg='Login failed'; try{ msg=(await r.json()).message||msg; }catch{} throw new Error(msg); }
  const { token, user } = await r.json();
  setToken(token);
  return user;
}
export function signOut(){ setToken(''); }

export async function changePassword(currentPassword, newPassword){
  const r = await fetch('/api/auth/password',{method:'PUT',headers:{'Content-Type':'application/json', ...(getToken()?{Authorization:`Bearer ${getToken()}`}:{})},body:JSON.stringify({currentPassword,newPassword})});
  if(!r.ok){ let msg='Password change failed'; try{ msg=(await r.json()).message||msg; }catch{} throw new Error(msg); }
  return true;
}
