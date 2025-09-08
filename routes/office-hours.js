// public/routes/office-hours.js
import { getToken } from '/routes/auth.js';
function auth(){ const t=getToken(); return t?{Authorization:`Bearer ${t}`} : {}; }

export async function fetchOfficeHours(course){
  const url=new URL('/api/office-hours',location.origin);
  if(course) url.searchParams.set('course',course);
  const r=await fetch(url); if(!r.ok) throw new Error('Failed'); return r.json();
}

// Staff CRUD
export async function listMySchedule(){
  const r=await fetch('/api/schedule/mine',{headers:auth()});
  if(!r.ok) throw new Error('Failed to load schedule');
  return r.json();
}

export async function upsertSchedule(entry){
  const r=await fetch('/api/schedule',{method:'POST',headers:{'Content-Type':'application/json',...auth()},body:JSON.stringify(entry)});
  if(!r.ok){let m='Save failed'; try{m=(await r.json()).message||m;}catch{} throw new Error(m);}
  return r.json();
}

export async function deleteSchedule(id){
  const r=await fetch(`/api/schedule/${id}`,{method:'DELETE',headers:auth()});
  if(!r.ok){let m='Delete failed'; try{m=(await r.json()).message||m;}catch{} throw new Error(m);}
  return true;
}
