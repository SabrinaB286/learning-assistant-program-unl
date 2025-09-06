// feedback/feedback.js
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '/public/config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const form = document.getElementById('feedback-form');
const alertBox = document.getElementById('fb-alert');

function showAlert(kind, msg) {
  alertBox.classList.remove('hidden', 'alert-ok', 'alert-error');
  alertBox.classList.add('alert', kind === 'ok' ? 'alert-ok' : 'alert-error');
  alertBox.textContent = msg;
  setTimeout(()=> alertBox.classList.add('hidden'), 4000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);

  const payload = {
    course:    fd.get('course') || null,
    type:      fd.get('type')   || 'General',
    rating:    fd.get('rating') ? Number(fd.get('rating')) : null,
    text:      (fd.get('text') || '').trim(),
    submitter: fd.get('submitter') || null,
    year:      fd.get('year') || null,
    id_entered: fd.get('id_entered') || null
  };

  if (!payload.text) {
    showAlert('err', 'Please enter feedback.');
    return;
  }

  const { error } = await supabase.from('feedback').insert(payload);
  if (error) {
    showAlert('err', error.message);
  } else {
    form.reset();
    showAlert('ok', 'Thank you! Your feedback was submitted.');
  }
});
