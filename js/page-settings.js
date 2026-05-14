// ─────────────────────────────────────────────
//  SETTINGS PAGE MODULE
// ─────────────────────────────────────────────
(function () {
  function el(id) { return document.querySelector('#view-settings [id="' + id + '"]'); }

  function showError(msg) {}
  function clearError() {}
  function updateLoad(msg) {}
  function startLoading() {}
  function stopLoading() {}
  function tickSession() {}
  function generateWatchlist() {}

  function applyKeySaved(saved) {
    const ns = el('keyNotSaved');   if (ns) ns.style.display   = saved ? 'none'  : 'block';
    const ks = el('keySavedState'); if (ks) ks.style.display   = saved ? 'block' : 'none';
  }

  window.saveKey = function () {
    const k = (el('apiKeyInput')?.value || '').trim();
    if (!k.startsWith('sk-ant-')) {
      const errEl = el('keyErrorBox');
      if (errEl) { errEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Key must start with sk-ant-'; errEl.classList.add('active'); }
      return;
    }
    localStorage.setItem('sb_key', k);
    const inp = el('apiKeyInput'); if (inp) inp.value = '';
    const errEl = el('keyErrorBox'); if (errEl) errEl.classList.remove('active');
    applyKeySaved(true);
  };

  window.clearKey = function () {
    localStorage.removeItem('sb_key');
    applyKeySaved(false);
  };

  window.toggleThemeSettings = function () {
    const current = localStorage.getItem('sb_theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    updateThemeLabel(next);
  };

  function updateThemeLabel(theme) {
    const lbl = el('themeToggleSettingsLabel');
    if (lbl) lbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  }

  window.saveDefaultModel = function (val) { localStorage.setItem('sb_model', val); };

  function loadDefaultModel() {
    const saved = localStorage.getItem('sb_model');
    if (saved) { const sel = el('defaultModelSelect'); if (sel) sel.value = saved; }
  }

  function updateAccountSection(user) {
    const accountEl = el('accountSection');
    if (!accountEl) return;
    if (!FIREBASE_READY) {
      accountEl.innerHTML = `
        <div class="warning-box">
          <strong>Firebase not configured</strong>
          To enable Google sign-in and cloud sync, paste your Firebase project credentials into
          <code>js/firebase-config.js</code>. Until then, all data is stored locally only.
        </div>
        <div class="firebase-config-box">
          <span class="key">window.FIREBASE_CONFIG</span> = {<br>
          &nbsp;&nbsp;<span class="key">apiKey</span>: <span class="val">"PASTE_YOUR_API_KEY_HERE"</span>,<br>
          &nbsp;&nbsp;<span class="key">authDomain</span>: <span class="val">"PASTE_YOUR_AUTH_DOMAIN_HERE"</span>,<br>
          &nbsp;&nbsp;<span class="key">projectId</span>: <span class="val">"PASTE_YOUR_PROJECT_ID_HERE"</span>,<br>
          &nbsp;&nbsp;<span class="key">storageBucket</span>: <span class="val">"PASTE_YOUR_STORAGE_BUCKET_HERE"</span>,<br>
          &nbsp;&nbsp;<span class="key">messagingSenderId</span>: <span class="val">"PASTE_YOUR_MESSAGING_SENDER_ID_HERE"</span>,<br>
          &nbsp;&nbsp;<span class="key">appId</span>: <span class="val">"PASTE_YOUR_APP_ID_HERE"</span>,<br>
          };
        </div>`;
      return;
    }
    if (!user) {
      accountEl.innerHTML = `
        <div class="settings-section-sub">
          You are using StockBuddy in local mode. Sign in to sync your data across devices.
        </div>
        <a href="login.html" class="btn btn-primary">Sign in with Google</a>`;
      return;
    }
    accountEl.innerHTML = `
      <div class="settings-row">
        <div class="account-user-info">
          ${user.photoURL ? '<img src="' + user.photoURL + '" class="account-avatar" alt="avatar" />' : ''}
          <div>
            <div class="settings-label">${user.displayName || 'User'}</div>
            <div class="settings-desc">${user.email || ''}</div>
          </div>
        </div>
        <button class="btn btn-ghost" onclick="signOut()">Sign Out</button>
      </div>
      <div class="key-saved-hint">
        Your portfolio and watchlist are automatically synced to Firebase Firestore.
      </div>`;
  }

  window.exportPortfolio = function () {
    const portfolio = loadPortfolio();
    const data = JSON.stringify({ portfolio, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'stockbuddy-portfolio-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.clearAllData = function () {
    if (!confirm('Are you sure you want to clear ALL local data? This includes your portfolio, watchlist, API keys, and cached analysis. This cannot be undone.')) return;
    localStorage.clear();
    window.location.hash = '#analysis';
    window.location.reload();
  };

  // ── Lifecycle ─────────────────────────────
  let _authUser = null;

  SpaRouter.register('settings', {
    showError,
    clearError,
    updateLoad,
    startLoading,
    stopLoading,
    tickSession,
    generateWatchlist,
    applyKeySaved,
    activate(user) {
      _authUser = user;
      initSharedUI('settings');
      applyKeySaved(!!localStorage.getItem('sb_key'));
      updateAccountSection(user);
      loadDefaultModel();
      updateThemeLabel(localStorage.getItem('sb_theme') || 'dark');
    },
    deactivate() {},
  });
})();
