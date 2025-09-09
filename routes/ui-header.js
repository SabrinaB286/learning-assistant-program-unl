// public/routes/ui-header.js
// Header/UI wiring for LA Portal
import {
  getCurrentUser,
  getCurrentUserName,
  getToken,
  isStaff,
  loginRequest,
  logoutRequest,
  saveSession,
} from "/routes/auth.js";

// Call once on page load, and again after login/logout
export function hydrateHeader() {
  const title = document.getElementById("page-title");
  const actions = document.getElementById("page-actions");
  const btn = document.getElementById("primary-action");
  const greet = document.getElementById("user-greeting");
  const tabDash = document.getElementById("tab-dashboard");

  // Defensive: if host page is missing nodes, do nothing
  if (!actions || !btn || !greet) return;

  // Show greeting with **name** not NUID
  const name = getCurrentUserName();
  if (name) {
    btn.textContent = "Sign out";
    greet.textContent = `Signed in as ${name}`;
  } else {
    btn.textContent = "Sign in";
    greet.textContent = "";
  }

  // Staff dashboard tab visibility
  if (tabDash) {
    if (isStaff()) tabDash.classList.remove("hidden");
    else tabDash.classList.add("hidden");
  }

  // Ensure "actions" sits right under the title visually (in case CSS didn’t load)
  if (title && actions && title.nextElementSibling !== actions) {
    title.insertAdjacentElement("afterend", actions);
  }

  // Set active tab from hash
  markActiveTab();
}

export function wireHeader() {
  const btn = document.getElementById("primary-action");
  btn?.addEventListener("click", async () => {
    const token = getToken();
    if (token) {
      // Sign out
      await logoutRequest();
      hydrateHeader();
      location.hash = "#office-hours";
      return;
    }
    // Basic sign-in UX; replace with your modal/flow if you have one
    const login = prompt("Enter NUID or email:");
    if (!login) return;
    const password = prompt("Enter password:");
    if (password == null) return;
    try {
      const data = await loginRequest({ login, password });
      // already saved by loginRequest -> saveSession(data)
      hydrateHeader();
      location.hash = "#office-hours";
    } catch (e) {
      alert(e.message || "Login failed");
    }
  });

  // Keep tabs in sync with hash
  window.addEventListener("hashchange", markActiveTab);
}

function markActiveTab() {
  const current = location.hash || "#office-hours";
  document
    .querySelectorAll("#main-tabs .tab")
    .forEach((a) => a.classList.remove("is-active"));
  const active = document.querySelector(`#main-tabs .tab[href="${current}"]`);
  active?.classList.add("is-active");
}
