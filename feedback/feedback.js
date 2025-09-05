<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Learning Assistant Feedback</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- ---- Theme & Utilities (kept inline for one-file portability) ---- -->
  <style>
    :root{
      --unl-red:#d00000; --unl-red-dark:#a20000;
      --ink:#111; --muted:#5a5a5a; --bg:#f4f5f7; --card:#fff;
      --ring:#e7e7e7; --ok:#065f46; --ok-bg:#ecfdf5; --err:#991b1b; --err-bg:#fef2f2;
    }
    *,*::before,*::after{ box-sizing:border-box }
    html,body{ height:100% }
    body{ margin:0; color:var(--ink); background:var(--bg);
      font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif }
    a{ color:var(--unl-red); text-decoration:none }
    a:hover{ text-decoration:underline }

    /* Topbar */
    .topbar{ position:sticky; top:0; z-index:50; color:#fff;
      background:linear-gradient(135deg,var(--unl-red),var(--unl-red-dark)); box-shadow:0 1px 0 rgba(0,0,0,.1) }
    .shell{ max-width:1100px; margin:0 auto; padding:18px 16px }
    .brand{ font-weight:800; font-size:1.1rem; letter-spacing:.2px }
    .sub{ opacity:.9; font-size:.95rem }
    nav{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px }
    .chip{ display:inline-flex; align-items:center; gap:8px; cursor:pointer;
      color:#fff; background:transparent; border:1px solid rgba(255,255,255,.55); border-radius:999px; padding:8px 14px }
    .chip.active{ background:#fff; color:var(--unl-red); border-color:#fff }
    .badge{ display:inline-flex; margin-left:auto; background:#fff; color:var(--unl-red);
      border:1px solid rgba(255,255,255,.5); border-radius:999px; padding:7px 12px; font-weight:600 }

    /* Layout cards / containers */
    main>.wrap{ background:var(--card); border:1px solid var(--ring); border-radius:14px;
      padding:18px; margin:18px 0; box-shadow:0 10px 26px rgba(0,0,0,.04) }
    h1,h2,h3{ margin:.25rem 0 .75rem }
    h2{ font-size:1.5rem }
    p{ margin:.5rem 0 1rem; color:var(--muted) }

    /* Inputs & buttons */
    label{ display:block; font-weight:600; margin:0 0 6px }
    input,select,textarea{ width:100%; padding:10px 12px; border:1px solid var(--ring);
      border-radius:10px; background:#fff; color:var(--ink); outline:0 }
    input:focus,select:focus,textarea:focus{ border-color:#bbb; box-shadow:0 0 0 3px rgba(208,0,0,.12) }
    .row{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
    .push{ margin-left:auto }
    .btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;
      background:#fff; color:var(--unl-red); border:1px solid var(--unl-red); border-radius:10px; padding:10px 14px; font-weight:600 }
    .btn:hover{ filter:brightness(.98) }
    .btn-danger{ background:var(--unl-red); color:#fff; border:none }
    .btn-ghost{ background:transparent; border:1px solid var(--ring); color:#333 }

    /* Grid helpers */
    .grid{ display:grid; gap:14px }
    .g-2{ grid-template-columns:repeat(2,minmax(0,1fr)) }
    .g-3{ grid-template-columns:repeat(3,minmax(0,1fr)) }
    @media (max-width:900px){ .g-3{ grid-template-columns:repeat(2,minmax(0,1fr)) } }
    @media (max-width:640px){
      .g-3,.g-2{ grid-template-columns:1fr }
      nav{ gap:8px }
      .badge{ margin-left:0 }
    }

    /* Banners */
    #alert{ border-radius:12px; border:1px solid #a7f3d0; background:var(--ok-bg); color:var(--ok);
      padding:12px 14px; font-weight:600 }
    .alert-error{ background:var(--err-bg)!important; color:var(--err)!important; border-color:#fecaca!important }

    /* Tables (if needed later) */
    table{ width:100%; border-collapse:collapse }
    th,td{ text-align:left; padding:10px 12px; border-bottom:1px solid #efefef }
    th{ color:#555; font-weight:700 }

    /* Modals */
    .modal{ position:fixed; inset:0; display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,.35); z-index:60 }
    .modal.show{ display:flex }
    .modal .panel{ width:min(580px,92vw); background:#fff; border-radius:16px; border:1px solid var(--ring); padding:18px }
    .modal .panel h3{ margin-top:6px }
    .modal .foot{ display:flex; gap:10px; justify-content:flex-end; margin-top:14px }

    .hidden{ display:none!important }
  </style>
</head>
<body>
  <!-- ======= Header / Nav ======= -->
  <header class="topbar">
    <div class="shell">
      <div class="brand">Learning Assistant Feedback</div>
      <div class="sub">Computer Science &amp; Engineering – University of Nebraska–Lincoln</div>

      <nav>
        <button class="chip active" data-route="feedback">Feedback</button>
        <button class="chip" data-route="hours">Office Hours</button>
        <button class="chip" data-route="dashboard" id="nav-dashboard">Dashboard</button>
        <button class="chip" data-route="login" id="nav-login">Login</button>

        <span id="user-badge" class="badge hidden"></span>
        <button id="btn-logout" class="chip hidden">Log out</button>
      </nav>
    </div>
  </header>

  <main class="shell" role="main">
    <!-- Global banner -->
    <div id="alert" class="wrap hidden" aria-live="polite"></div>

    <!-- ======= Feedback ======= -->
    <section id="view-feedback" class="wrap">
      <h2>Feedback</h2>
      <p>Use this area to link or embed your existing feedback form, or keep it as a summary of how to submit feedback.</p>
      <div class="grid g-2">
        <div class="wrap" style="border:1px solid #eee">
          <h3>Submit Feedback</h3>
          <p class="muted">If you collect via Supabase-backed forms, your page script can post to <code>/api/feedback</code>.</p>
          <a class="btn" href="/feedback-app.html">Open Feedback Form</a>
        </div>
        <div class="wrap" style="border:1px solid #eee">
          <h3>Recent Feedback</h3>
          <p class="muted">You can render a list here using <code>/api/feedback</code> if you like.</p>
        </div>
      </div>
    </section>

    <!-- ======= Office Hours ======= -->
    <section id="view-hours" class="wrap hidden">
      <h2>Office Hours</h2>
      <p>Browse office hours by course. Data comes from staff schedules.</p>

      <div class="row" style="flex-wrap:wrap; gap:10px; margin:8px 0 12px">
        <button class="chip active" data-course="">All</button>
        <button class="chip" data-course="CSCE 101">CSCE 101</button>
        <button class="chip" data-course="CSCE 155A">CSCE 155A</button>
        <button class="chip" data-course="CSCE 155E">CSCE 155E</button>
        <button class="chip" data-course="CSCE 155H">CSCE 155H</button>
        <button class="chip" data-course="CSCE 156">CSCE 156</button>
      </div>

      <div id="hours-list" class="grid g-3"></div>
    </section>

    <!-- ======= Login ======= -->
    <section id="view-login" class="wrap hidden" aria-labelledby="login-title">
      <h2 id="login-title">Sign in</h2>
      <div class="grid g-2">
        <div>
          <label for="login-id">NUID or Email</label>
          <input id="login-id" placeholder="12345678 or user@huskers.unl.edu" autocomplete="username" />
        </div>
        <div>
          <label for="login-pass">Password</label>
          <input id="login-pass" type="password" placeholder="Your password" autocomplete="current-password" />
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button id="btn-login" class="btn btn-danger" type="button">Sign in</button>
        <span class="muted">New student? <a href="#" aria-disabled="true">Create an account</a></span>
        <span class="push"></span>
        <button id="btn-open-change-password" class="btn btn-ghost" type="button">Change password</button>
      </div>
    </section>

    <!-- ======= Dashboard (shell for future expansion) ======= -->
    <section id="view-dashboard" class="wrap hidden">
      <h2>Dashboard</h2>
      <div class="grid g-3">
        <div class="wrap" style="border:1px solid #eee">
          <h3>Total Feedback</h3>
          <div id="stat-total-feedback" style="font-size:2rem; font-weight:800;">0</div>
        </div>
        <div class="wrap" style="border:1px solid #eee">
          <h3>Average Rating</h3>
          <div id="stat-avg-rating" style="font-size:2rem; font-weight:800;">0.0</div>
        </div>
        <div class="wrap" style="border:1px solid #eee">
          <h3>This Week</h3>
          <div id="stat-this-week" style="font-size:2rem; font-weight:800;">0</div>
        </div>
      </div>

      <div class="wrap" style="border:1px solid #eee; margin-top:12px">
        <h3>My Schedule</h3>
        <table id="tbl-my-schedule" aria-label="My schedule">
          <thead><tr><th>Type</th><th>Day</th><th>Start</th><th>End</th><th>Location</th><th>Course</th></tr></thead>
          <tbody><tr><td colspan="6" class="muted">No entries.</td></tr></tbody>
        </table>
      </div>
    </section>
  </main>

  <!-- ======= Change Password Modal (frontend wiring optional) ======= -->
  <div id="modal-change-password" class="modal" aria-hidden="true" aria-label="Change password dialog">
    <div class="panel" role="dialog" aria-modal="true">
      <h3>Change password</h3>
      <div class="grid g-2">
        <div>
          <label for="cp-current">Current password</label>
          <input id="cp-current" type="password" autocomplete="current-password" />
        </div>
        <div>
          <label for="cp-new">New password</label>
          <input id="cp-new" type="password" autocomplete="new-password" />
        </div>
      </div>
      <div style="margin-top:10px">
        <label for="cp-confirm">Confirm new password</label>
        <input id="cp-confirm" type="password" autocomplete="new-password" />
      </div>
      <div class="foot">
        <button id="cp-cancel" class="btn btn-ghost" type="button">Cancel</button>
        <button id="cp-save" class="btn btn-danger" type="button">Save</button>
      </div>
    </div>
  </div>

  <!-- ======= Scripts (absolute paths + defer) ======= -->
  <script defer src="/config.js"></script>
  <script defer src="/lib/supabase.js"></script>
  <script defer src="/feedback/feedback.js"></script>

  <!-- Optional inline glue just for the modal (kept tiny & safe) -->
  <script defer>
    window.addEventListener('DOMContentLoaded', () => {
      const modal = document.getElementById('modal-change-password');
      const openBtn = document.getElementById('btn-open-change-password');
      const cancel = document.getElementById('cp-cancel');
      const save = document.getElementById('cp-save');

      function showModal(show){ modal.classList.toggle('show', !!show); modal.setAttribute('aria-hidden', show ? 'false':'true'); }
      openBtn?.addEventListener('click', () => showModal(true));
      cancel?.addEventListener('click', () => showModal(false));

      // If you want to wire this now:
      save?.addEventListener('click', async () => {
        const cur = document.getElementById('cp-current').value;
        const nw  = document.getElementById('cp-new').value;
        const cf  = document.getElementById('cp-confirm').value;
        if (!cur || !nw || !cf) return alert('Fill all fields');
        if (nw !== cf) return alert('New passwords do not match');
        // Your feedback.js provides jsonFetch/authFetch helpers; use fetch here if you prefer:
        try{
          const token = localStorage.getItem('lap_jwt');
          const res = await fetch('/api/auth/change-password', {
            method:'POST',
            headers:{'Content-Type':'application/json','Accept':'application/json','Authorization': token ? `Bearer ${token}`:''},
            body: JSON.stringify({ currentPassword: cur, newPassword: nw })
          });
          const data = await res.json();
          if(!res.ok) throw new Error(data?.error || 'Failed');
          alert('Password changed.');
          showModal(false);
        }catch(e){ alert(e.message||'Failed'); }
      });

      // Click outside closes modal
      modal.addEventListener('click', (e)=>{ if(e.target===modal) showModal(false); });
    });
  </script>
</body>
</html>
