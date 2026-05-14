// ─────────────────────────────────────────────
//  SPA ROUTER
//  Hash-based routing. All views live in the DOM permanently;
//  the router shows/hides them and swaps the dispatch table for
//  page-scoped functions (showError, tickSession, etc.).
// ─────────────────────────────────────────────
const SpaRouter = (function () {
  const PAGES = ['analysis', 'research', 'portfolio', 'settings'];
  const PAGE_TITLES = {
    analysis:  '<i class="fa-solid fa-bolt"></i> Analysis',
    research:  '<i class="fa-solid fa-eye"></i> Watchlist',
    portfolio: '<i class="fa-solid fa-chart-pie"></i> Portfolio',
    settings:  '<i class="fa-solid fa-gear"></i> Settings',
  };

  const _mods = {};
  let _cur  = null;
  let _user = null;

  // ── Dispatch table ────────────────────────
  // Functions that multiple pages implement; globals delegate here.
  const D = {};
  const DISPATCH_FNS = [
    'showError', 'clearError', 'updateLoad', 'startLoading', 'stopLoading',
    'tickSession', 'generateWatchlist', 'applyKeySaved',
  ];

  DISPATCH_FNS.forEach(fn => {
    window[fn] = function (...args) { if (D[fn]) D[fn](...args); };
  });

  function _swapDispatch(mod) {
    DISPATCH_FNS.forEach(fn => { D[fn] = mod && mod[fn] ? mod[fn].bind(mod) : null; });
  }

  // ── Navigation ────────────────────────────
  function navigate(page) {
    if (!PAGES.includes(page)) page = 'analysis';

    // Deactivate previous page
    if (_cur && _mods[_cur] && _mods[_cur].deactivate) _mods[_cur].deactivate();

    // Show/hide view containers
    PAGES.forEach(p => {
      const v = document.getElementById('view-' + p);
      if (v) v.style.display = p === page ? '' : 'none';
    });

    _cur = page;
    window.SB_PAGE = page;

    // Update nav active states
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update topbar title
    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.innerHTML = PAGE_TITLES[page] || PAGE_TITLES.analysis;

    // Swap dispatch + activate new page
    const mod = _mods[page];
    if (mod) {
      _swapDispatch(mod);
      mod.activate(_user);
    }

    closeSidebar();
  }

  function register(page, mod) {
    _mods[page] = mod;
  }

  function init(user) {
    _user = user;
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    navigate(PAGES.includes(hash) ? hash : 'analysis');
  }

  window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    navigate(PAGES.includes(hash) ? hash : 'analysis');
  });

  return { register, init, navigate };
})();
