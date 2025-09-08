// public/feedback/feedback.js
const starsBox = document.querySelector('#fbStars');
const stars = [...document.querySelectorAll('#fbStars .star')];
const course = document.querySelector('#fbCourse');
const typeSel = document.querySelector('#fbType');
const txt = document.querySelector('#fbText');
const submitter = document.querySelector('#fbSubmitter');
const year = document.querySelector('#fbYear');
const btn = document.querySelector('#fbSend');
const msg = document.querySelector('#fbMsg');

let chosen = 0;

function paint(n) {
  stars.forEach((s,i)=> s.classList.toggle('on', i < n));
}
stars.forEach(s=>{
  s.addEventListener('mouseenter', ()=> paint(Number(s.dataset.v)));
  s.addEventListener('mouseleave', ()=> paint(chosen));
  s.addEventListener('click', ()=> { chosen = Number(s.dataset.v); paint(chosen); });
});

btn.addEventListener('click', async () => {
  msg.className = 'alert hidden';
  const body = {
    course: course.value || null,
    type: typeSel.value,
    rating: chosen || null,
    text: txt.value.trim(),
    submitter: submitter.value.trim() || null,
    year: year.value || null
  };
  if (!body.type || !body.text) {
    msg.textContent = 'Type and feedback text are required.';
    msg.className = 'alert alert-bad';
    return;
  }
  try {
    const res = await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to submit');
    msg.textContent = 'Thanks! Your feedback was submitted.';
    msg.className = 'alert alert-ok';
    txt.value=''; chosen=0; paint(0);
  } catch(e) {
    msg.textContent = e.message || 'Error';
    msg.className = 'alert alert-bad';
  }
});
