// public/routes/staff.js
import { getToken } from '/routes/auth.js';

function auth(){ const t=getToken(); return t?{Authorization:`Bearer ${t}`} : {}; }

export async function getMyProfile(){
  const r=await fetch('/api/staff/me',{headers:auth()}); if(!r.ok) throw new Error('Failed'); return r.json();
}

export async function fetchCourses(){
  const r=await fetch('/api/courses'); if(!r.ok) throw new Error('Failed'); return r.json();
}

export async function addStaff(payload){
  const r=await fetch('/api/staff',{method:'POST',headers:{'Content-Type':'application/json',...auth()},body:JSON.stringify(payload)});
  if(!r.ok){ let msg='Failed'; try{msg=(await r.json()).message||msg;}catch{} throw new Error(msg);}
  return r.json();
}
