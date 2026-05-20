// ─────────────────────────────────────────────
//  RESEARCH / WATCHLIST PAGE MODULE
// ─────────────────────────────────────────────
(function () {
  function el(id) { return document.querySelector('#view-research [id="' + id + '"]'); }

  function showError(msg) {
    const b = el('errorBox');
    if (b) { b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + msg; b.classList.add('active'); }
  }
  function clearError() { const b = el('errorBox'); if (b) b.classList.remove('active'); }
  function updateLoad(msg) { const m = el('loadMsg'); if (m) m.innerHTML = '<em>' + msg + '</em>'; }
  function startLoading() {
    el('loadingBox')?.classList.add('active');
    el('watchlistSection')?.classList.remove('active');
    el('timestamp')?.classList.remove('active');
    const se = el('stepsEl'); if (se) se.innerHTML = '';
    updateLoad('Starting…');
  }
  function stopLoading() { el('loadingBox')?.classList.remove('active'); }

  function tickSession() {
    const sess = sessionOf(etNow());
    const labels = {
      premarket:  ['Pre-Market Research',  'Before open — build your watchlist for today',        'morning',   'Morning Session'],
      morning:    ['Market Open',          'Market is live — use after-hours for watchlist',       'morning',   'Market Open'],
      afternoon:  ['Afternoon Session',    "Research tomorrow's open setups",                     'afternoon', '3:30 PM Session'],
      afterhours: ['After-Hours Research', "Market closed — build watchlist for tomorrow's open", 'after',     'After Hours'],
    };
    const [t, d, cls, bl] = labels[sess];
    const titleEl = el('sessionTitle'); if (titleEl) titleEl.textContent = t;
    const descEl  = el('sessionDesc');  if (descEl)  descEl.textContent  = d;
    const badgeEl = el('sessionBadge');
    if (badgeEl) { badgeEl.textContent = bl; badgeEl.className = 'session-badge ' + cls; }
    const marketClosed = sess === 'afterhours' || sess === 'premarket';
    const wBtn = el('wlGenerateBtn');
    const wLbl = el('wlLabel');
    if (wBtn) {
      wBtn.style.display = marketClosed ? 'flex' : 'none';
      if (marketClosed && localStorage.getItem('sb_key')) wBtn.disabled = false;
      if (wLbl) wLbl.textContent = sess === 'premarket' ? "Research Today's Open" : "Research Tomorrow's Open";
    }
  }

  // applyKeySaved not used on this page (key chip shown but not interactive)
  function applyKeySaved() {}

  // ── Custom watchlist ──────────────────────
  window.addCustomTicker = function () {
    const input  = el('customTickerInput');
    const ticker = (input ? input.value : '').trim().toUpperCase().replace(/[^A-Z.]/g, '');
    if (!ticker) return;
    const list = loadCustomWatchlist();
    if (!list.includes(ticker)) { list.push(ticker); saveCustomWatchlist(list); }
    if (input) input.value = '';
    renderCustomWatchlist();
  };

  window.removeCustomTicker = function (ticker) {
    const list = loadCustomWatchlist().filter(t => t !== ticker);
    saveCustomWatchlist(list);
    renderCustomWatchlist();
  };

  window.renderCustomWatchlist = function () {
    const list = loadCustomWatchlist();
    const el2  = el('customWlTickers');
    if (!el2) return;
    el2.innerHTML = list.length
      ? list.map(t => '<span class="custom-ticker-chip">' + t + '<button onclick="removeCustomTicker(\'' + t + '\')" title="Remove"><i class="fa-solid fa-xmark"></i></button></span>').join('')
      : '<span class="wl-company">No custom tickers yet</span>';
  };

  // ── Prompts ───────────────────────────────
  function systemWatchlistPrompt() {
    return `You are an expert stock researcher. Analyse ONLY the specific tickers the user provides — do not substitute or add any other stocks.

Step 1: Search the web for today's news, recent earnings, and catalysts for each ticker in the list.
Step 2: Reply with ONLY valid JSON wrapped in <json_data> tags. No other text. No markdown. No explanation.

The JSON must follow this exact structure:
<json_data>
{"date":"YYYY-MM-DD","research_summary":"2-3 sentences on the overall setup for these tickers","key_catalysts":["catalyst1","catalyst2"],"watchlist":[{"ticker":"AAPL","company":"Apple Inc","sector":"Technology","thesis":"Why this is worth watching","catalyst":"Specific catalyst","buy_trigger":"Exact condition before entering, e.g. holds above $182 in first 5 min on volume","entry_point":"$XXX.XX","first_target":"$XXX.XX","stop_loss":"$XXX.XX","risk_reward":"1:2","confidence":"HIGH","confidence_pct":88,"pre_market_signal":"What to check before 9:30 AM ET"}]}
</json_data>

Hard rules:
- Include ONLY the tickers the user provides — no substitutions, no additions
- Omit any ticker with confidence_pct below 85% (fewer entries is fine)
- All price fields must be exact dollar values like "$182.45"
- Tight stops: 1-2% from entry
- Output ONLY the <json_data> block — nothing before, nothing after`;
  }

  function watchlistUserPrompt(priceCtx, customWl) {
    const etNow_   = etNow();
    const sess     = sessionOf(etNow_);
    const isPremarket = sess === 'premarket';
    const today = etNow_.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const tomorrow = new Date(etNow_.getTime() + 86400000).toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const priceLabel = isPremarket
      ? 'PRE-MARKET PRICES as of ' + today + ' (use these to set realistic entry levels for today\'s open):'
      : 'AFTER-HOURS PRICES as of ' + today + ' (use these to set realistic entry levels for tomorrow\'s open):';
    const prices    = priceCtx ? '\n' + priceLabel + '\n' + priceCtx + '\n' : '\n[No live price feed — use web search for current prices]\n';
    const tickerList = '\nTICKERS TO ANALYSE (analyse ONLY these — do not add or substitute others): ' + customWl.join(', ') + '\n';
    if (isPremarket) {
      return 'TODAY IS ' + today.toUpperCase() + '. It is pre-market — the market has NOT opened yet. You are building a watchlist for TODAY\'S open (' + today + ').\nDO NOT say "tomorrow" — the open you are researching IS TODAY, ' + today + '.\n' + prices + tickerList + '\nFor each ticker: search for overnight news, pre-market price action, analyst calls from this morning, gap-up/gap-down setups forming before today\'s open.\n\nFor each ticker with a compelling setup (confidence ≥ 85%), define a specific buy_trigger — the exact confirmation to wait for in the first 5 minutes after 9:30 AM ET. Skip any ticker with no clear catalyst or below-85% confidence.';
    }
    return 'TODAY IS ' + today.toUpperCase() + '. The market is closed for today. You are building a watchlist for TOMORROW\'s open (' + tomorrow + ').\nDo not recycle any analysis from previous days. Base everything on news from today, ' + today + '.\n' + prices + tickerList + '\nFor each ticker: search for after-hours earnings reactions from today (' + today + '), analyst calls published today, macro events scheduled for tomorrow that affect these stocks, futures direction for tomorrow\'s open.\n\nFor each ticker with a compelling setup (confidence ≥ 85%), define a specific buy_trigger — the exact confirmation to wait for in the first 5 minutes after 9:30 AM ET. Skip any ticker with no clear catalyst or below-85% confidence.';
  }

  // Session-agnostic version used by analyseWatchlist (works during market hours too)
  function watchlistUserPromptAny(priceCtx, customWl) {
    const etNow_  = etNow();
    const sess    = sessionOf(etNow_);
    const today   = etNow_.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const tomorrow = new Date(etNow_.getTime() + 86400000).toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const tickerList = '\nTICKERS TO ANALYSE (analyse ONLY these — do not add or substitute others): ' + customWl.join(', ') + '\n';
    let priceLabel, preamble, instructions;
    if (sess === 'premarket') {
      priceLabel   = 'PRE-MARKET PRICES as of ' + today + ':';
      preamble     = 'TODAY IS ' + today.toUpperCase() + '. It is pre-market — the market has NOT opened yet. You are building a watchlist for TODAY\'s open (' + today + ').';
      instructions = 'For each ticker: search for overnight news, pre-market price action, analyst calls from this morning, gap-up/gap-down setups. Define a specific buy_trigger for the first 5 minutes after 9:30 AM ET. Skip tickers with no clear catalyst or below-85% confidence.';
    } else if (sess === 'morning' || sess === 'afternoon') {
      priceLabel   = 'LIVE PRICES as of ' + today + ' (market is currently open — anchor all levels to these):';
      preamble     = 'TODAY IS ' + today.toUpperCase() + '. The market is currently OPEN. Analyse these tickers for intraday and near-term setups.';
      instructions = 'For each ticker: search for today\'s news, earnings reactions, analyst upgrades/downgrades, and any intraday catalysts. Define a specific buy_trigger based on current price action. Anchor entry, target, and stop levels to the live prices provided. Skip tickers with no clear catalyst or below-70% confidence.';
    } else {
      priceLabel   = 'AFTER-HOURS PRICES as of ' + today + ':';
      preamble     = 'TODAY IS ' + today.toUpperCase() + '. The market is closed. You are building a watchlist for TOMORROW\'s open (' + tomorrow + '). Base everything on news from today — do not recycle older analysis.';
      instructions = 'For each ticker: search for after-hours earnings reactions from today, analyst calls published today, macro events scheduled for tomorrow, and futures direction. Define a specific buy_trigger for the first 5 minutes after 9:30 AM ET. Skip tickers with no clear catalyst or below-85% confidence.';
    }
    const prices = priceCtx ? '\n' + priceLabel + '\n' + priceCtx + '\n' : '\n[No live price feed — use web search for current prices]\n';
    return preamble + '\n' + prices + tickerList + '\n' + instructions;
  }

  // ── Render watchlist ──────────────────────
  function renderWatchlist(analysis) {
    const isPremarket = sessionOf(etNow()) === 'premarket';
    const wlTitleEl = document.querySelector('#view-research .watchlist-title');
    if (wlTitleEl) wlTitleEl.innerHTML = isPremarket ? '<i class="fa-solid fa-eye"></i> Today\'s Open Watchlist' : '<i class="fa-solid fa-eye"></i> Tomorrow\'s Open Watchlist';
    const wlSum = el('wlSummary'); if (wlSum) wlSum.textContent = analysis.research_summary || '';
    const wlCat = el('wlCatalysts'); if (wlCat) wlCat.innerHTML = (analysis.key_catalysts || []).map(c => '<span class="catalyst-tag">' + c + '</span>').join('');
    const wlC = el('wlCards'); if (wlC) wlC.innerHTML = '<div class="wl-cards-grid">' + (analysis.watchlist || []).map(wlCardHTML).join('') + '</div>';
    staggerCards(el('wlCards'));
    el('watchlistSection')?.classList.add('active');
    const ts = new Date().toLocaleString('en-US', { timeZone:'America/New_York', dateStyle:'full', timeStyle:'medium' });
    const tsEl = el('timestamp');
    if (tsEl) { tsEl.textContent = 'Watchlist generated: ' + ts + ' ET'; tsEl.classList.add('active'); }
  }

  function loadResearchCache() {
    const cached = getCache(CACHE_KEYS.research);
    if (!cached) return;
    const ageH = (Date.now() - cached.ts) / 3600000;
    if (ageH > 10) return;
    renderWatchlist(cached.data);
    const tsEl = el('timestamp');
    if (tsEl) {
      const cacheTime = new Date(cached.ts).toLocaleString('en-US', { timeZone:'America/New_York', timeStyle:'short' });
      tsEl.innerHTML = 'Cached · ' + cacheTime + ' ET';
      if (ageH > 6) tsEl.innerHTML += ' <span class="stale-badge">Stale — refresh for latest</span>';
    }
  }

  // ── Generate watchlist (custom tickers only) ──
  async function generateWatchlist() {
    const apiKey = localStorage.getItem('sb_key');
    if (!apiKey) { showError('Please enter your Anthropic API key first.'); return; }
    clearAllCaches();
    clearError();
    const model = el('modelSelect').value;
    const btn   = el('wlGenerateBtn');
    const lbl   = el('wlLabel');
    const icon  = el('wlIcon');
    btn.disabled = true; lbl.textContent = 'Researching…'; icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    startLoading();
    try {
      const customWl = loadCustomWatchlist();
      if (!customWl.length) {
        showError('Your watchlist is empty — add tickers above before researching.');
        stopLoading(); btn.disabled = false; lbl.textContent = 'Research Watchlist'; icon.innerHTML = '<i class="fa-solid fa-eye"></i>';
        return;
      }
      updateLoad('<i class="fa-solid fa-satellite-dish"></i> Fetching live prices…');
      const prices = await fetchLivePricesYahoo(customWl);
      const priceMap = {};
      prices.forEach(p => { priceMap[p.ticker] = p; });
      const priceCtx = buildPriceContext(prices);
      const wlSess = sessionOf(etNow());
      updateLoad(wlSess === 'premarket' ? '<i class="fa-solid fa-eye"></i> Researching today\'s open candidates…' : '<i class="fa-solid fa-eye"></i> Researching tomorrow\'s open candidates…');
      let messages = [{ role:'user', content: watchlistUserPrompt(priceCtx, customWl) }];
      const MAX_TURNS = 12;
      let responseData;
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        let res;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05','anthropic-dangerous-direct-browser-access':'true' },
            body: JSON.stringify({ model, max_tokens:8000, tool_choice:{type:'auto',disable_parallel_tool_use:true}, tools:[{type:'web_search_20250305',name:'web_search'}], system:systemWatchlistPrompt(), messages }),
          });
          if (res.status !== 429 && res.status !== 529) break;
          const wait = parseInt(res.headers.get('retry-after') || '60', 10);
          for (let s = wait; s > 0; s--) { updateLoad('<i class="fa-solid fa-clock"></i> Rate limit — retrying in ' + s + 's…'); await new Promise(r => setTimeout(r, 1000)); }
        }
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || 'HTTP ' + res.status); }
        const data = await res.json();
        if (data.type === 'error') throw new Error(data.error?.message || 'API error');
        if (data.stop_reason === 'end_turn') { responseData = data; break; }
        if (data.stop_reason === 'tool_use') {
          const results = data.content.filter(b=>b.type==='tool_use').map(b=>({type:'tool_result',tool_use_id:b.id,content:[]}));
          const assistantContent = data.content.filter(b=>b.type!=='tool_result');
          messages = [messages[0],{role:'assistant',content:assistantContent},...(results.length?[{role:'user',content:results}]:[])];
          continue;
        }
        responseData = data; break;
      }
      if (!responseData) throw new Error('No response received. Please try again.');
      updateLoad('<i class="fa-solid fa-circle-check"></i> Building watchlist…');
      const text = extractText(responseData);
      if (!text.trim()) throw new Error('Empty response — please try again.');
      let analysis;
      try { analysis = sanitizeParsed(parseAnalysis(text)); }
      catch (parseErr) {
        if (!parseErr.message.startsWith('PARSE_FAIL:')) throw parseErr;
        updateLoad('<i class="fa-solid fa-triangle-exclamation"></i> Reformatting response…');
        const fixedText = await reformatAsJson(apiKey, model, text);
        analysis = sanitizeParsed(parseAnalysis(fixedText));
      }
      (analysis.watchlist || []).forEach(s => {
        const p = priceMap[s.ticker]; if (!p) return;
        if (p.extPrice != null) { s.live_price = p.extPrice; s.live_dp = p.extDp||0; s.price_is_close = false; s.is_extended = true; s.ext_session = wlSess; s.prev_close = p.prevClose||null; }
        else { s.live_price = p.price; s.live_dp = p.dp; s.price_is_close = true; s.is_extended = false; s.prev_close = p.prevClose||null; }
      });
      renderWatchlist(analysis);
      setCache(CACHE_KEYS.research, analysis);
    } catch (err) {
      const msg = err.message.startsWith('PARSE_FAIL:') ? 'Could not parse response as JSON.\n\nWhat Claude returned:\n' + err.message.slice(11) : err.message;
      showError(msg);
    } finally {
      stopLoading();
      const b2 = el('wlGenerateBtn'); if (b2) b2.disabled = false;
      const l2 = el('wlLabel'); if (l2) l2.textContent = 'Refresh Watchlist';
      const i2 = el('wlIcon'); if (i2) i2.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  }

  // ── Analyse watchlist (always-available) ─
  window.analyseWatchlist = async function () {
    const apiKey = localStorage.getItem('sb_key');
    if (!apiKey) { showError('Please enter your Anthropic API key first.'); return; }
    const customWl = loadCustomWatchlist();
    if (!customWl.length) { showError('Your watchlist is empty — add tickers above before analysing.'); return; }
    clearError();
    const model = el('modelSelect').value;
    const btn   = el('analyseWlBtn');
    const lbl   = el('analyseWlLabel');
    const icon  = el('analyseWlIcon');
    btn.disabled = true;
    lbl.textContent = 'Analysing…';
    icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    startLoading();
    try {
      updateLoad('<i class="fa-solid fa-satellite-dish"></i> Fetching live prices…');
      const prices   = await fetchLivePricesYahoo(customWl);
      const priceMap = {};
      prices.forEach(p => { priceMap[p.ticker] = p; });
      const priceCtx = buildPriceContext(prices);
      updateLoad('<i class="fa-solid fa-magnifying-glass"></i> Analysing watchlist…');
      let messages = [{ role:'user', content: watchlistUserPromptAny(priceCtx, customWl) }];
      const MAX_TURNS = 12;
      let responseData;
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        let res;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05','anthropic-dangerous-direct-browser-access':'true' },
            body: JSON.stringify({ model, max_tokens:8000, tool_choice:{type:'auto',disable_parallel_tool_use:true}, tools:[{type:'web_search_20250305',name:'web_search'}], system:systemWatchlistPrompt(), messages }),
          });
          if (res.status !== 429 && res.status !== 529) break;
          const wait = parseInt(res.headers.get('retry-after') || '60', 10);
          for (let s = wait; s > 0; s--) { updateLoad('<i class="fa-solid fa-clock"></i> Rate limit — retrying in ' + s + 's…'); await new Promise(r => setTimeout(r, 1000)); }
        }
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || 'HTTP ' + res.status); }
        const data = await res.json();
        if (data.type === 'error') throw new Error(data.error?.message || 'API error');
        if (data.stop_reason === 'end_turn') { responseData = data; break; }
        if (data.stop_reason === 'tool_use') {
          const results = data.content.filter(b=>b.type==='tool_use').map(b=>({type:'tool_result',tool_use_id:b.id,content:[]}));
          const assistantContent = data.content.filter(b=>b.type!=='tool_result');
          messages = [messages[0],{role:'assistant',content:assistantContent},...(results.length?[{role:'user',content:results}]:[])];
          continue;
        }
        responseData = data; break;
      }
      if (!responseData) throw new Error('No response received. Please try again.');
      updateLoad('<i class="fa-solid fa-circle-check"></i> Building analysis…');
      const text = extractText(responseData);
      if (!text.trim()) throw new Error('Empty response — please try again.');
      let analysis;
      try { analysis = sanitizeParsed(parseAnalysis(text)); }
      catch (parseErr) {
        if (!parseErr.message.startsWith('PARSE_FAIL:')) throw parseErr;
        updateLoad('<i class="fa-solid fa-triangle-exclamation"></i> Reformatting response…');
        const fixedText = await reformatAsJson(apiKey, model, text);
        analysis = sanitizeParsed(parseAnalysis(fixedText));
      }
      (analysis.watchlist || []).forEach(s => {
        const p = priceMap[s.ticker]; if (!p) return;
        if (p.extPrice != null) { s.live_price = p.extPrice; s.live_dp = p.extDp||0; s.price_is_close = false; s.is_extended = true; s.prev_close = p.prevClose||null; }
        else { s.live_price = p.price; s.live_dp = p.dp; s.price_is_close = true; s.is_extended = false; s.prev_close = p.prevClose||null; }
      });
      renderWatchlist(analysis);
      setCache(CACHE_KEYS.research, analysis);
    } catch (err) {
      const msg = err.message.startsWith('PARSE_FAIL:') ? 'Could not parse response as JSON.\n\nWhat Claude returned:\n' + err.message.slice(11) : err.message;
      showError(msg);
    } finally {
      stopLoading();
      const b2 = el('analyseWlBtn'); if (b2) b2.disabled = false;
      const l2 = el('analyseWlLabel'); if (l2) l2.textContent = 'Analyse Watchlist';
      const i2 = el('analyseWlIcon'); if (i2) i2.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    }
  };

  // ── Lifecycle ─────────────────────────────
  let _interval = null;
  let _inited   = false;

  SpaRouter.register('research', {
    showError,
    clearError,
    updateLoad,
    startLoading,
    stopLoading,
    tickSession,
    generateWatchlist,
    applyKeySaved,
    activate(user) {
      initSharedUI('research');
      const hasKey = !!localStorage.getItem('sb_key');
      const analyseBtn = el('analyseWlBtn');
      if (analyseBtn) analyseBtn.disabled = !hasKey;
      if (!_inited) {
        _inited = true;
        const chip = el('keySaved');
        if (chip && hasKey) chip.classList.add('visible');
        loadResearchCache();
        const saved = localStorage.getItem('sb_model');
        const sel = el('modelSelect'); if (saved && sel) sel.value = saved;
      }
      renderCustomWatchlist();
      if (_interval) clearInterval(_interval);
      _interval = setInterval(tickSession, 1000);
      tickSession();
    },
    deactivate() {
      clearInterval(_interval);
      _interval = null;
    },
  });
})();
