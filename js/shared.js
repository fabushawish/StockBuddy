// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const YAHOO_WORKER_URL = 'https://stockbuddy-prices.shawish-f.workers.dev';

// ─────────────────────────────────────────────
//  CLOCK & MARKET STATUS
// ─────────────────────────────────────────────
function etNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function isOpen(et) {
  const d = et.getDay();
  if (d === 0 || d === 6) return false;
  const m = et.getHours() * 60 + et.getMinutes();
  return m >= 570 && m < 960;
}

function sessionOf(et) {
  const m = et.getHours() * 60 + et.getMinutes();
  if (m < 570)            return 'premarket';   // before 9:30 AM
  if (m < 900)            return 'morning';     // 9:30 AM – 3:00 PM
  if (m < 960)            return 'afternoon';   // 3:00 PM – 4:00 PM
  return 'afterhours';
}

// Base tick — updates topbar elements present on every page
function tick() {
  const now = new Date();

  // Clock
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent =
      now.toLocaleTimeString('en-US', { timeZone:'America/New_York', hour12:true, hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' ET';
  }

  // Market pill
  const et   = etNow();
  const open = isOpen(et);
  const dotEl  = document.getElementById('statusDot');
  const mktEl  = document.getElementById('marketText');
  if (dotEl) dotEl.className = 'status-dot' + (open ? '' : ' closed');
  if (mktEl) mktEl.textContent = open ? 'Market Open' : 'Market Closed';
}

// ─────────────────────────────────────────────
//  FIREBASE
// ─────────────────────────────────────────────
let sbApp = null, sbAuth = null, sbDb = null, sbUser = null;

const FIREBASE_READY = !!(
  window.FIREBASE_CONFIG &&
  window.FIREBASE_CONFIG.apiKey &&
  window.FIREBASE_CONFIG.apiKey !== 'PASTE_YOUR_API_KEY_HERE'
);

if (FIREBASE_READY && typeof firebase !== 'undefined') {
  try {
    sbApp  = firebase.initializeApp(window.FIREBASE_CONFIG);
    sbAuth = firebase.auth();
    sbDb   = firebase.firestore();
  } catch(e) { console.warn('Firebase init failed:', e.message); }
}

function signOut() {
  if (sbAuth) {
    sbAuth.signOut().then(() => { window.location.href = 'login.html'; });
  } else {
    window.location.href = 'index.html';
  }
}

function requireAuth(onUser) {
  if (!FIREBASE_READY || !sbAuth || sessionStorage.getItem('sb_guest_mode')) {
    updateSidebarUser(null);
    onUser(null);
    return;
  }
  sbAuth.onAuthStateChanged(user => {
    if (!user) { window.location.href = 'login.html'; return; }
    sbUser = user;
    updateSidebarUser(user);
    loadFromFirestore(user).then(() => onUser(user));
  });
}

function updateSidebarUser(user) {
  const nameEl   = document.getElementById('sidebarUserName');
  const emailEl  = document.getElementById('sidebarUserEmail');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (!nameEl) return;
  if (user) {
    nameEl.textContent  = user.displayName || 'User';
    emailEl.textContent = user.email || '';
    if (avatarEl && user.photoURL) { avatarEl.src = user.photoURL; avatarEl.style.display = 'block'; }
  } else {
    nameEl.textContent  = 'Local Mode';
    emailEl.textContent = 'Data stored on this device only';
    if (avatarEl) avatarEl.style.display = 'none';
  }
}

async function loadFromFirestore(user) {
  if (!sbDb || !user) return;
  try {
    const doc = await sbDb.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.portfolio)       localStorage.setItem('sb_portfolio',        JSON.stringify(data.portfolio));
      if (data.customWatchlist) localStorage.setItem('sb_custom_watchlist', JSON.stringify(data.customWatchlist));
      if (data.theme)           localStorage.setItem('sb_theme',            data.theme);
    }
  } catch(e) { console.warn('Firestore load failed:', e.message); }
}

async function syncToFirestore(field, value) {
  if (!sbDb || !sbUser) return;
  try {
    await sbDb.collection('users').doc(sbUser.uid).set({ [field]: value }, { merge: true });
  } catch(e) { console.warn('Firestore sync failed:', e.message); }
}

// ─────────────────────────────────────────────
//  SHARED UI INIT
// ─────────────────────────────────────────────
function initSharedUI(currentPage) {
  applyTheme(localStorage.getItem('sb_theme') || 'dark');
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
  document.querySelectorAll('.bottom-nav a[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
  setInterval(tick, 1000);
  tick();

  // Page exit transition — intercept internal nav link clicks
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//') || a.target === '_blank') return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 160);
  }, true);
}

function staggerCards(container) {
  if (!container) return;
  container.querySelectorAll('.stock-card, .wl-card, .holding-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 45}ms`;
  });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.toggle('hidden');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ─────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────
function toggleTheme() {
  const current = localStorage.getItem('sb_theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function applyTheme(name) {
  if (name === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('sb_theme', name);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = name === 'light' ? '🌙' : '☀️';
}

// ─────────────────────────────────────────────
//  PORTFOLIO
// ─────────────────────────────────────────────
function loadPortfolio() {
  try { return JSON.parse(localStorage.getItem('sb_portfolio') || '{}'); } catch(_) { return {}; }
}

function savePortfolio(p) {
  localStorage.setItem('sb_portfolio', JSON.stringify(p));
  syncToFirestore('portfolio', p);
}

// ─────────────────────────────────────────────
//  CUSTOM WATCHLIST
// ─────────────────────────────────────────────
function loadCustomWatchlist() {
  try { return JSON.parse(localStorage.getItem('sb_custom_watchlist') || '[]'); } catch(_) { return []; }
}

function saveCustomWatchlist(list) {
  localStorage.setItem('sb_custom_watchlist', JSON.stringify(list));
  syncToFirestore('customWatchlist', list);
}

// ─────────────────────────────────────────────
//  S&P 500 TICKERS
// ─────────────────────────────────────────────
const SP500_TICKERS = [
  // ── Mega-cap Tech ──────────────────────────
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','TSLA','AVGO','ORCL',
  // ── Semiconductors ─────────────────────────
  'AMD','QCOM','INTC','AMAT','MU','LRCX','KLAC','ADI','NXPI','MRVL','ON','TXN',
  // ── Software & Cloud ───────────────────────
  'ADBE','INTU','CRWD','PANW','SNPS','CDNS','WDAY','ZS','DDOG','NOW',
  'TTD','ADSK','TEAM','FTNT','APP','ANSS','HUBS','HOOD',
  // ── Financials ─────────────────────────────
  'JPM','BAC','WFC','GS','MS','C','BLK','AXP','SCHW','USB',
  'PNC','TFC','COF','ICE','CME','SPGI','MCO','MSCI','V','MA',
  'BX','KKR','APO','ALLY','SYF','DFS','AIG','MET','PRU','AFL',
  // ── Healthcare & Pharma ────────────────────
  'JNJ','UNH','LLY','PFE','ABBV','MRK','TMO','ABT','MDT','SYK',
  'BSX','DHR','HCA','CI','CVS','HUM','ELV','MCK','COR','CAH',
  'AMGN','GILD','REGN','ISRG','BIIB','MRNA','DXCM','GEHC','ILMN','IDXX',
  // ── Consumer Discretionary ─────────────────
  'HD','MCD','NKE','SBUX','TGT','LOW','CMG','YUM','BKNG','MAR',
  'HLT','F','GM','TSCO','EBAY','ETSY','ABNB','NFLX','DIS','PARA',
  'LULU','ROST','TJX','COST','DLTR','DG',
  // ── Consumer Staples ───────────────────────
  'WMT','PG','KO','PEP','PM','MO','MDLZ','CL','KMB','GIS',
  'HSY','MKC','SJM','KHC','STZ','BUD',
  // ── Energy ─────────────────────────────────
  'XOM','CVX','COP','EOG','SLB','HAL','DVN','MPC','PSX','VLO',
  'OXY','BKR','FANG','HES','APA','CTRA','MRO',
  // ── Industrials ────────────────────────────
  'CAT','DE','BA','GE','RTX','LMT','NOC','GD','MMM','EMR',
  'ETN','PH','ROK','HON','CTAS','FAST','ODFL','PCAR','UPS','FDX',
  'CSX','NSC','UNP','VRSK','AXON','UBER','LYFT',
  // ── Materials ──────────────────────────────
  'LIN','APD','ECL','SHW','NEM','FCX','NUE','VMC','MLM','CF',
  // ── Utilities ──────────────────────────────
  'NEE','DUK','SO','AEP','SRE','D','PCG','EXC','CEG','VST','ENPH',
  // ── Real Estate ────────────────────────────
  'AMT','PLD','CCI','EQIX','PSA','SPG','O','DLR','WELL',
  // ── Communications ─────────────────────────
  'T','VZ','CMCSA','TMUS','CSCO','WBD','SIRI',
  // ── Fintech & Payments ─────────────────────
  'PYPL','SQ','COIN','SOFI','AFRM','BILL','PAYX',
  // ── ADRs & International ───────────────────
  'MELI','PDD','ASML','TSM','BABA','SHOP',
  // ── High-beta & Momentum ───────────────────
  'PLTR','RIVN','LCID','IONQ','SMCI','ARM','MSTR','CVNA','RKLB',
];

// ─────────────────────────────────────────────
//  LIVE PRICES
// ─────────────────────────────────────────────
async function fetchLivePricesYahoo(symbols) {
  const BATCH = 50;

  const parseQuote = (q) => {
    if (!q || !q.regularMarketPrice) return null;
    const price     = q.regularMarketPrice;
    const dp        = q.regularMarketChangePercent || 0;
    const prevClose = q.regularMarketPreviousClose || price;
    const extPrice  = (q.preMarketPrice  > 0 ? q.preMarketPrice  :
                       q.postMarketPrice > 0 ? q.postMarketPrice : null);
    const extDp     = extPrice != null
      ? (q.preMarketChangePercent || q.postMarketChangePercent || 0) : null;
    return { ticker: q.symbol, price, dp, extPrice, extDp, prevClose };
  };

  const fetchBatch = async (batch) => {
    const sym  = batch.join(',');
    const enc  = encodeURIComponent(sym);
    const yhoo = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${sym}&lang=en-US&region=US`;
    const urls = [
      // ① Cloudflare Worker (most reliable — set up at dash.cloudflare.com)
      YAHOO_WORKER_URL ? `${YAHOO_WORKER_URL}?symbols=${enc}` : null,
      // ② Direct Yahoo (works locally, blocked on GitHub Pages)
      `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${sym}&lang=en-US&region=US`,
      yhoo,
      // ③ CORS proxies
      `https://corsproxy.io/?${encodeURIComponent(yhoo)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(yhoo)}`,
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(yhoo)}`,
    ].filter(Boolean);
    for (const url of urls) {
      try {
        const res   = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const json  = await res.json();
        const quotes = json?.quoteResponse?.result || [];
        if (quotes.length > 0) return quotes.map(parseQuote).filter(Boolean);
      } catch (_) { /* try next */ }
    }
    return [];
  };

  const results = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const rows = await fetchBatch(symbols.slice(i, i + BATCH));
    results.push(...rows);
  }
  return results;
}

function isExtendedHours() {
  const sess = sessionOf(etNow());
  return sess === 'premarket' || sess === 'afterhours';
}

function buildPriceContext(prices) {
  const extended = isExtendedHours();

  if (extended) {
    const sess       = sessionOf(etNow());
    const label      = sess === 'premarket' ? 'PRE-MARKET' : 'AFTER-HOURS';
    const withExt    = prices.filter(p => p.extPrice != null);
    const withoutExt = prices.filter(p => p.extPrice == null);
    let ctx = '';
    if (withExt.length) {
      ctx += `${label} PRICES (actual extended-hours prices — anchor ALL entry/exit/stop levels to these):\n`;
      ctx += withExt.map(p =>
        `${p.ticker}:$${p.extPrice.toFixed(2)}(${(p.extDp||0) >= 0 ? '+' : ''}${(p.extDp||0).toFixed(2)}% ext,prev close:$${(p.prevClose || p.price).toFixed(2)})`
      ).join(' ');
    }
    if (withoutExt.length) {
      ctx += (ctx ? '\n' : '') +
        `LAST REGULAR CLOSE (no extended-hours data — web-search for current ${label.toLowerCase()} price before setting levels):\n`;
      ctx += withoutExt.map(p =>
        `${p.ticker}:$${p.price.toFixed(2)}(${p.dp >= 0 ? '+' : ''}${p.dp.toFixed(2)}%)`
      ).join(' ');
    }
    return ctx;
  }

  return `LIVE PRICES: ${prices.map(p =>
    `${p.ticker}:$${p.price.toFixed(2)}(${p.dp >= 0 ? '+' : ''}${p.dp.toFixed(2)}%,prev:$${(p.prevClose||p.price).toFixed(2)})`
  ).join(' ')}`;
}

// ─────────────────────────────────────────────
//  JSON UTILITIES
// ─────────────────────────────────────────────
function extractText(data) {
  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

function sanitizeJson(str) {
  // Walk character-by-character to escape literal newlines/tabs inside string values
  let fixed = '';
  let inStr = false, esc = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc)                 { fixed += c; esc = false; continue; }
    if (c === '\\' && inStr) { fixed += c; esc = true;  continue; }
    if (c === '"')           { inStr = !inStr; fixed += c; continue; }
    if (inStr && c === '\n') { fixed += '\\n'; continue; }
    if (inStr && c === '\r') { fixed += '\\r'; continue; }
    if (inStr && c === '\t') { fixed += '\\t'; continue; }
    fixed += c;
  }
  return fixed
    .replace(/```(?:json)?[\s\S]*?```/g, s => s.replace(/```(?:json)?|```/g, ''))
    .replace(/```(?:json)?|```/g, '')
    .replace(/,\s*([}\]])/g, '$1')                  // trailing commas
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')  // remaining control chars
    .trim();
}

function parseAnalysis(raw) {
  const strip = s => s
    .replace(/<[^>]+>/g, '')    // strip ALL inline HTML/XML tags (citations, source, etc.)
    .replace(/\[\d+\]/g, '')   // strip [1] [2] numeric citation markers
    .replace(/ /g, ' ')   // non-breaking spaces
    .replace(/\r\n|\r/g, '\n'); // normalise line endings

  const candidates = [];

  // Strategy 1: extract content from <json_data> block then strip inline markup
  const tagMatch = raw.match(/<json_data>([\s\S]*?)<\/json_data>/i);
  if (tagMatch) candidates.push(strip(tagMatch[1]));

  // Strategy 2: strip ALL markup from full response then grab largest {} span
  const stripped = strip(raw);
  const s = stripped.indexOf('{'), e = stripped.lastIndexOf('}');
  if (s !== -1 && e !== -1) candidates.push(stripped.slice(s, e + 1));

  for (const c of candidates) {
    try { return JSON.parse(sanitizeJson(c)); } catch (_) {}
  }

  window.__lastRawResponse = raw;
  console.error('[StockBuddy] Raw AI response (copy this and share it):', raw);
  const preview = raw.replace(/<[^>]+>/g, '').slice(0, 300);
  throw new Error('PARSE_FAIL:' + preview);
}

function stripCitations(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, '$1').replace(/<cite[^>]*\/?>/gi, '').trim();
}

function sanitizeParsed(obj) {
  if (typeof obj === 'string') return stripCitations(obj);
  if (Array.isArray(obj))     return obj.map(sanitizeParsed);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeParsed(v);
    return out;
  }
  return obj;
}

// ─────────────────────────────────────────────
//  PRICE LABEL HELPERS
// ─────────────────────────────────────────────
function priceLabel(s) {
  if (s.is_extended) return s.ext_session === 'premarket' ? 'PRE-MKT' : 'POST-MKT';
  if (s.price_is_close) return 'PREV CLOSE';
  return 'LIVE';
}
function priceLabelClass(s) {
  if (s.is_extended) return 'live-label ext-label';
  if (s.price_is_close) return 'live-label close-label';
  return 'live-label';
}
function priceChgText(s) {
  const dp = Math.abs(s.live_dp || 0).toFixed(2);
  const arrow = (s.live_dp || 0) >= 0 ? '▲' : '▼';
  return s.is_extended ? `${arrow} ${dp}% ext hrs` : `${arrow} ${dp}% prev session`;
}

// ─────────────────────────────────────────────
//  CONFIDENCE CLASS
// ─────────────────────────────────────────────
function confClass(c, pct) {
  const p = parseInt(pct, 10) || 0;
  if (p >= 85) return 'conf-high';
  if (p >= 75) return 'conf-medium';
  return 'conf-low';
}

// ─────────────────────────────────────────────
//  CARD HTML
// ─────────────────────────────────────────────
function cardHTML(s) {
  const buy = s.action === 'BUY';
  return `
<div class="stock-card ${buy ? 'buy' : 'sell'}">
  <div class="card-top">
    <div class="ticker-block">
      <div class="ticker">${s.ticker}</div>
      <div class="company">${s.company}</div>
      <span class="sector-tag">${s.sector || '—'}</span>
    </div>
    <div class="conf-badge ${confClass(s.confidence, s.confidence_pct)}">
      ${s.confidence_pct ? s.confidence_pct + '%' : s.confidence}
    </div>
  </div>
  ${s.live_price != null ? `
  <div class="live-price-row">
    <span class="${priceLabelClass(s)}">${priceLabel(s)}</span>
    <span class="live-val ${(s.live_dp||0) >= 0 ? 'up' : 'down'}">$${s.live_price.toFixed(2)}</span>
    <span class="live-chg ${(s.live_dp||0) >= 0 ? 'up' : 'down'}">${priceChgText(s)}</span>
  </div>` : ''}
  <div class="card-reason">${s.reason}</div>
  <div class="card-metrics">
    <div>
      <div class="metric-label">Entry</div>
      <div class="metric-val entry-val">${s.entry_point || '—'}</div>
    </div>
    <div>
      <div class="metric-label">Target</div>
      <div class="metric-val target-val">${s.exit_target || '—'}</div>
    </div>
    <div>
      <div class="metric-label">Stop Loss</div>
      <div class="metric-val stop-val">${s.stop_loss || '—'}</div>
    </div>
  </div>
  <div class="card-footer">
    <div class="timeframe-tag">⏱ ${s.timeframe || '—'}${s.risk_reward ? ' &nbsp;·&nbsp; R/R ' + s.risk_reward : ''}</div>
    ${s.key_risk ? `<div class="risk-note">⚠ ${s.key_risk}</div>` : ''}
  </div>
</div>`;
}

// ─────────────────────────────────────────────
//  WATCHLIST CARD HTML
// ─────────────────────────────────────────────
function wlCardHTML(s) {
  const prevCloseHtml = s.prev_close != null
    ? `<span class="wl-prev-close">Prev close: $${s.prev_close.toFixed(2)}</span>` : '';
  const liveHtml = s.live_price != null ? `
  <div class="live-price-row">
    <span class="${priceLabelClass(s)}">${priceLabel(s)}</span>
    <span class="live-val ${(s.live_dp||0) >= 0 ? 'up' : 'down'}">$${s.live_price.toFixed(2)}</span>
    <span class="live-chg ${(s.live_dp||0) >= 0 ? 'up' : 'down'}">${priceChgText(s)}</span>
    ${prevCloseHtml}
  </div>` : '';

  return `
<div class="wl-card">
  <div class="wl-card-top">
    <div>
      <div class="wl-ticker">${s.ticker}</div>
      <div class="wl-company">${s.company}</div>
      <span class="wl-sector">${s.sector || '—'}</span>
    </div>
    <div class="conf-badge ${confClass(s.confidence, s.confidence_pct)}">
      ${s.confidence_pct ? s.confidence_pct + '%' : s.confidence}
    </div>
  </div>
  ${liveHtml}
  <div class="wl-thesis">${s.thesis}</div>
  <div class="wl-catalyst-box">
    <div class="wl-catalyst-label">Catalyst</div>
    <div class="wl-catalyst-text">${s.catalyst || '—'}</div>
  </div>
  <div class="wl-trigger-box">
    <div class="wl-trigger-label">⚡ Buy Trigger — wait for this before entering</div>
    <div class="wl-trigger-text">${s.buy_trigger || '—'}</div>
  </div>
  <div class="wl-metrics">
    <div>
      <div class="metric-label">Entry</div>
      <div class="metric-val entry-val">${s.entry_point || '—'}</div>
    </div>
    <div>
      <div class="metric-label">Target</div>
      <div class="metric-val target-val">${s.first_target || '—'}</div>
    </div>
    <div>
      <div class="metric-label">Stop Loss</div>
      <div class="metric-val stop-val">${s.stop_loss || '—'}</div>
    </div>
  </div>
  <div class="wl-footer">
    <div class="timeframe-tag">R/R ${s.risk_reward || '—'}</div>
    ${s.pre_market_signal ? `<div class="wl-signal">📋 Pre-market: ${s.pre_market_signal}</div>` : ''}
  </div>
</div>`;
}

// ─────────────────────────────────────────────
//  ANALYSIS CACHE
// ─────────────────────────────────────────────
const CACHE_KEYS = {
  analysis:  'sb_cache',
  research:  'sb_cache_research',
  portfolio: 'sb_cache_portfolio_ai',
};

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function clearAllCaches() {
  Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
}

// ─────────────────────────────────────────────
//  JSON REFORMAT FALLBACK
// ─────────────────────────────────────────────
async function reformatAsJson(apiKey, model, badText) {
  const truncated = badText.length > 8000 ? badText.slice(-8000) : badText;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content:
            'The following stock analysis response could not be parsed as JSON. ' +
            'Extract all the data and return it as ONLY a valid JSON object wrapped in <json_data> tags. ' +
            'No explanation, no markdown, no other text — start with <json_data> and end with </json_data>.\n\n' +
            truncated,
        }],
      }),
    });
    if (res.status === 429 || res.status === 529) {
      const wait = parseInt(res.headers.get('retry-after') || '60', 10);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Reformat failed (HTTP ${res.status}): ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return extractText(data);
  }
  throw new Error('Reformat failed after retries — rate limited. Please wait a moment and try again.');
}
