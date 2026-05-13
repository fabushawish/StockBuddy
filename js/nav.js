// ─────────────────────────────────────────────
//  SHARED NAV INJECTION
//  Each page sets window.SB_PAGE before loading this file.
// ─────────────────────────────────────────────
(function () {
  const PAGE_TITLES = {
    analysis:  '⚡ Analysis',
    research:  '🔭 Research',
    portfolio: '📊 Portfolio',
    settings:  '⚙ Settings',
  };

  const page  = window.SB_PAGE || 'analysis';
  const title = PAGE_TITLES[page] || '⚡ Analysis';

  // ── Overlay ───────────────────────────────
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) {
    overlay.className = 'fixed inset-0 bg-black/50 z-[150] hidden';
    overlay.setAttribute('onclick', 'closeSidebar()');
  }

  // ── Sidebar ───────────────────────────────
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.className =
      'fixed top-0 left-0 bottom-0 w-56 flex flex-col overflow-y-auto z-[200] ' +
      '-translate-x-full lg:translate-x-0 transition-transform duration-300';
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <div class="sidebar-wordmark"><span class="stock">Stock</span><span class="buddy">Buddy</span></div>
        <small><b>by Fadi</b></small>
      </div>
      <div class="sidebar-links">
        <a href="index.html"     class="sidebar-nav-item" data-page="analysis"> <span class="nav-icon">⚡</span> Analysis</a>
        <a href="research.html"  class="sidebar-nav-item" data-page="research">  <span class="nav-icon">🔭</span> Research</a>
        <a href="portfolio.html" class="sidebar-nav-item" data-page="portfolio"><span class="nav-icon">📊</span> Portfolio</a>
        <a href="settings.html"  class="sidebar-nav-item" data-page="settings"> <span class="nav-icon">⚙</span> Settings</a>
      </div>
      <div class="sidebar-footer-inner">
        <div class="sidebar-user">
          <img class="sidebar-avatar" id="sidebarAvatar" style="display:none" alt="avatar" />
          <div class="sidebar-user-info">
            <div class="sidebar-user-name"  id="sidebarUserName">—</div>
            <div class="sidebar-user-email" id="sidebarUserEmail">Loading…</div>
          </div>
        </div>
        <button class="sidebar-signout" onclick="signOut()">Sign out</button>
      </div>`;
  }

  // ── Topbar ────────────────────────────────
  const topbar = document.getElementById('sb-topbar');
  if (topbar) {
    topbar.className =
      'sticky top-0 z-[100] shrink-0 flex items-center justify-between gap-4 px-4 lg:px-7 h-14';
    topbar.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <button class="hamburger lg:hidden" onclick="toggleSidebar()">☰</button>
        <h1 class="page-title">${title}</h1>
        <div class="market-pill">
          <div class="status-dot" id="statusDot"></div>
          <span id="marketText">—</span>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="clock mono hidden sm:block" id="clock">--:-- ET</div>
        <button class="theme-toggle-btn" id="themeToggle" onclick="toggleTheme()">🌙</button>
      </div>`;
  }

  // ── Bottom nav ────────────────────────────
  const bottomNav = document.getElementById('sb-bottomnav');
  if (bottomNav) {
    bottomNav.className = 'bottom-nav fixed bottom-0 inset-x-0 z-[100] flex lg:hidden';
    bottomNav.innerHTML = `
      <a href="index.html"     data-page="analysis"> <span class="bnav-icon">⚡</span>Analysis</a>
      <a href="research.html"  data-page="research">  <span class="bnav-icon">🔭</span>Research</a>
      <a href="portfolio.html" data-page="portfolio"><span class="bnav-icon">📊</span>Portfolio</a>
      <a href="settings.html"  data-page="settings"> <span class="bnav-icon">⚙</span>Settings</a>`;
  }
})();
