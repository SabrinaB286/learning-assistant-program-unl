/* global supabase */
(function () {
  const $ = (s, sc=document) => sc.querySelector(s);
  const alertBox = document.getElementById('alert');

  function showAlert(msg, isErr=false){
    if(!alertBox) return;
    alertBox.textContent = msg;
    alertBox.classList.toggle('alert-error', !!isErr);
    alertBox.classList.remove('hidden');
    setTimeout(()=>alertBox.classList.add('hidden'), 5000);
  }

  const form = document.getElementById('feedback-form');
  if(!form){ return; }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const course = $('#fb-course').value;
    const type   = $('#fb-type').value;
    const ratingRaw = $('#fb-rating').value;
    const rating = ratingRaw ? Number(ratingRaw) : null; // optional
    const text   = $('#fb-text').value.trim();
    const submitter = $('#fb-name').value.trim() || null;
    const year = $('#fb-year').value || null;

    if(!course || !type || !text){
      showAlert('Please choose a course and type, and write some feedback.', true);
      return;
    }

    try{
      const { error } = await supabase.from('feedback').insert({
        course, type, rating, text, submitter, year
      });
      if(error) throw error;

      form.reset();
      $('#fb-rating').value = '';
      document.querySelectorAll('#fb-stars .star').forEach(s=>s.classList.remove('active'));
      showAlert('Thanks! Your feedback was submitted.');
    }catch(err){
      showAlert(err.message || 'Could not submit feedback.', true);
    }
  });
})();
