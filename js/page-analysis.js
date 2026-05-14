// ─────────────────────────────────────────────
//  ANALYSIS PAGE MODULE
// ─────────────────────────────────────────────
(function () {
  function el(id) { return document.querySelector('#view-analysis [id="' + id + '"]'); }

  // ── Page-scoped DOM helpers ───────────────
  function showError(msg) {
    const b = el('errorBox');
    if (b) { b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + msg; b.classList.add('active'); }
  }
  function clearError() { const b = el('errorBox'); if (b) b.classList.remove('active'); }
  function updateLoad(msg) { const m = el('loadMsg'); if (m) m.innerHTML = '<em>' + msg + '</em>'; }
  function startLoading() {
    el('loadingBox')?.classList.add('active');
    el('results')?.classList.remove('active');
    el('overviewBox')?.classList.remove('active');
    const tr = el('themesRow'); if (tr) tr.style.display = 'none';
    el('timestamp')?.classList.remove('active');
    el('wlSection')?.classList.remove('active');
    const se = el('stepsEl'); if (se) se.innerHTML = '';
    updateLoad('Starting…');
  }
  function stopLoading() { el('loadingBox')?.classList.remove('active'); }

  function tickSession() {
    const sess = sessionOf(etNow());
    const labels = {
      premarket:  ['Pre-Market Morning Brief',  'Before open — research and plan your entries',       'morning',   'Morning Session'],
      morning:    ['Mid-Session Analysis',       'Market open — track momentum and adjust positions',  'morning',   'Market Open'],
      afternoon:  ['Afternoon Close Review',     '~30 min to close — final moves and overnight holds', 'afternoon', '3:30 PM Session'],
      afterhours: ['After-Hours Wrap-Up',        'Market closed — debrief and prep for tomorrow',      'after',     'After Hours'],
    };
    const [t, d, cls, bl] = labels[sess];
    const titleEl = el('sessionTitle'); if (titleEl) titleEl.textContent = t;
    const descEl  = el('sessionDesc');  if (descEl)  descEl.textContent  = d;
    const badgeEl = el('sessionBadge');
    if (badgeEl) { badgeEl.textContent = bl; badgeEl.className = 'session-badge ' + cls; }
    const marketClosed = sess === 'afterhours' || sess === 'premarket';
    const wBtn = el('watchlistBtn');
    const wLbl = el('wlLabel');
    if (wBtn) {
      wBtn.style.display = marketClosed ? 'flex' : 'none';
      if (wLbl) wLbl.textContent = sess === 'premarket' ? "Research Today's Open" : "Research Tomorrow's Open";
    }
  }

  function applyKeySaved(saved) {
    const banner = el('noKeyBanner'); if (banner) banner.style.display = saved ? 'none' : 'block';
    const chip = el('keySaved'); if (chip) chip.classList.toggle('visible', saved);
    const genBtn = el('genBtn'); if (genBtn) genBtn.disabled = !saved;
    const wlBtn  = el('watchlistBtn'); if (wlBtn) wlBtn.disabled = !saved;
  }

  // ── Prompts ───────────────────────────────
  function systemPrompt() {
    return `You are an S&P 500 intraday day trader. All trades open and close the same session — no overnight holds.

Step 1: Search the web for today's market news, earnings, and catalysts.
Step 2: Reply with ONLY valid JSON wrapped in <json_data> tags. No other text before or after. No markdown. No explanation.

The JSON must follow this exact structure:
<json_data>
{"date":"YYYY-MM-DD","market_overview":"1-2 sentences","key_themes":["theme1","theme2"],"suggestions":[{"ticker":"AAPL","company":"Apple Inc","action":"BUY","sector":"Technology","reason":"Specific catalyst and setup","entry_point":"$XXX.XX","exit_target":"$XXX.XX","stop_loss":"$XXX.XX","risk_reward":"1:2","confidence":"HIGH","confidence_pct":88,"key_risk":"One sentence risk"}]}
</json_data>

Hard rules:
- Return EXACTLY 5 BUY + 5 SELL suggestions (10 total) in the suggestions array
- S&P 500 stocks only
- confidence_pct must be 85 or higher for every pick — if you cannot find a pick with ≥85% confidence, replace it with one you can
- All price fields must be exact dollar values like "$182.45", not ranges
- Tight stops: 1-2% from entry
- Output ONLY the <json_data> block — nothing before, nothing after`;
  }

  function userPrompt(sess, priceCtx, customWl) {
    const etNow_ = etNow();
    const today = etNow_.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const dayOfWeek = etNow_.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long' });
    const isMonday = dayOfWeek === 'Monday';
    const prices = priceCtx
      ? '\nLIVE PRICES RIGHT NOW — anchor ALL entry/exit/stop levels to these exact prices:\n' + priceCtx + '\n'
      : '\n[No live price feed — use your web search to find current prices before setting levels]\n';
    const customSection = customWl && customWl.length
      ? '\nADDITIONAL WATCHLIST TICKERS (include analysis for these if relevant): ' + customWl.join(', ') + '\n' : '';
    const dateBlock = 'TODAY IS ' + today.toUpperCase() + '. You are generating analysis FOR THIS DATE ONLY.\nDO NOT reference, repeat, or recycle analysis from any previous trading session.\nAll picks, catalysts, and price levels must reflect what is happening TODAY, ' + today + '.';
    if (sess === 'premarket' || sess === 'morning') {
      const mondayExtra = isMonday ? '\nIt is Monday — search specifically for: weekend earnings reactions, geopolitical/macro news from the weekend, Sunday night futures direction, analyst calls published this morning, any gap-up/gap-down setups driven by weekend news.' : '';
      return dateBlock + '\n' + prices + customSection + mondayExtra + '\nSearch for: today\'s pre-market futures direction, overnight news since yesterday\'s close, earnings reports due today, economic data releases today, analyst upgrades/downgrades published today, unusual pre-market volume.\n\nGive me 5 BUY + 5 SELL intraday picks for ' + today + '. All trades must open and close today by 4PM ET. Entry/exit/stop anchored to live prices above. Tight stops (1-2%).';
    }
    if (sess === 'afternoon') {
      return dateBlock + '\n' + prices + customSection + '\nSearch for: today\'s (' + today + ') biggest S&P 500 movers right now, unusual options flow today, any late-breaking catalysts in the last hour, earnings reports due after today\'s close.\n\n5 BUY (momentum into close) + 5 SELL (fade into close) for the final 30 min of today\'s session. Close all positions by 4PM ET today. Levels anchored to live prices above.';
    }
    return dateBlock + '\n' + prices + customSection + '\nSearch for: after-hours earnings reactions tonight (' + today + '), analyst calls out today, macro events scheduled for tomorrow, any breaking news after today\'s close.\n\n5 BUY + 5 SELL gap-play setups for tomorrow\'s open based on what happened today, ' + today + '. All trades close by 4PM ET tomorrow.';
  }

  // ── Claude API loop ───────────────────────
  async function callClaude(apiKey, model, sess, priceCtx, customWl) {
    let messages = [{ role:'user', content: userPrompt(sess, priceCtx, customWl) }];
    const MAX_TURNS = 12;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let res;
      for (let attempt = 0; attempt < 5; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05','anthropic-dangerous-direct-browser-access':'true' },
          body: JSON.stringify({ model, max_tokens:8000, tool_choice:{type:'auto',disable_parallel_tool_use:true}, tools:[{type:'web_search_20250305',name:'web_search'}], system:systemPrompt(), messages }),
        });
        if (res.status !== 429 && res.status !== 529) break;
        const wait = parseInt(res.headers.get('retry-after') || '60', 10);
        for (let s = wait; s > 0; s--) { updateLoad('<i class="fa-solid fa-clock"></i> Rate limit — retrying in ' + s + 's…'); await new Promise(r => setTimeout(r, 1000)); }
      }
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || 'HTTP ' + res.status); }
      const data = await res.json();
      if (data.type === 'error') throw new Error(data.error?.message || 'API error');
      if (data.stop_reason === 'end_turn') return data;
      if (data.stop_reason === 'tool_use') {
        const results = data.content.filter(b=>b.type==='tool_use').map(b=>({type:'tool_result',tool_use_id:b.id,content:[]}));
        const assistantContent = data.content.filter(b=>b.type!=='tool_result');
        messages = [messages[0],{role:'assistant',content:assistantContent},...(results.length?[{role:'user',content:results}]:[])];
        continue;
      }
      return data;
    }
    throw new Error('Analysis loop exceeded maximum turns. Please try again.');
  }

  // ── Render analysis ───────────────────────
  function render(analysis) {
    const themesRow  = el('themesRow');
    const themesList = el('themesList');
    if (themesList) {
      themesList.innerHTML = '';
      (analysis.key_themes || []).forEach(t => {
        const li = document.createElement('li');
        li.className = 'theme-item';
        li.innerHTML = '<span class="theme-bullet">•</span><span>' + t + '</span>';
        themesList.appendChild(li);
      });
    }
    if ((analysis.key_themes || []).length && themesRow) themesRow.style.display = 'block';
    const ot = el('overviewText'); if (ot) ot.textContent = analysis.market_overview || '';
    el('overviewBox')?.classList.add('active');
    const buys  = (analysis.suggestions || []).filter(s => s.action === 'BUY');
    const sells = (analysis.suggestions || []).filter(s => s.action === 'SELL');
    const bc = el('buyCount');  if (bc)  bc.textContent  = buys.length  + ' picks';
    const sc = el('sellCount'); if (sc)  sc.textContent  = sells.length + ' picks';
    const bCards = el('buyCards');  if (bCards)  bCards.innerHTML  = buys.map(cardHTML).join('');
    const sCards = el('sellCards'); if (sCards)  sCards.innerHTML  = sells.map(cardHTML).join('');
    staggerCards(el('results'));
    el('results')?.classList.add('active');
    const ts = new Date().toLocaleString('en-US', { timeZone:'America/New_York', dateStyle:'full', timeStyle:'medium' });
    const tsEl = el('timestamp');
    if (tsEl) { tsEl.textContent = 'Analysis generated: ' + ts + ' ET'; tsEl.classList.add('active'); }
    const ph = el('printSubheader');
    if (ph) ph.textContent = 'S&P 500 Intraday Analysis — Generated ' + ts + ' ET';
  }

  function loadCache() {
    const cached = getCache(CACHE_KEYS.analysis);
    if (!cached) return;
    const ageH = (Date.now() - cached.ts) / 3600000;
    if (ageH > 8) return;
    render(cached.data);
    const label = el('timestamp');
    if (label) {
      const cacheTime = new Date(cached.ts).toLocaleString('en-US', { timeZone:'America/New_York', timeStyle:'short' });
      label.innerHTML = 'Cached · ' + cacheTime + ' ET';
      if (ageH > 4) label.innerHTML += ' <span class="stale-badge">Stale — refresh for latest</span>';
    }
  }

  // ── Generate analysis (global — called from onclick) ──
  window.generate = async function () {
    const apiKey = localStorage.getItem('sb_key');
    if (!apiKey) { showError('Please enter your Anthropic API key first.'); return; }
    clearError();
    const model = el('modelSelect').value;
    const sess  = sessionOf(etNow());
    const btn   = el('genBtn');
    const lbl   = el('genLabel');
    const icon  = el('genIcon');
    btn.disabled = true; lbl.textContent = 'Analysing…'; icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    clearAllCaches();
    startLoading();
    try {
      updateLoad('<i class="fa-solid fa-satellite-dish"></i> Fetching live prices…');
      const customWl   = loadCustomWatchlist();
      const allSymbols = [...new Set([...SP500_TICKERS, ...customWl])];
      const prices     = await fetchLivePricesYahoo(allSymbols);
      const priceMap   = {};
      prices.forEach(p => { priceMap[p.ticker] = p; });
      const priceCtx = buildPriceContext(prices);
      updateLoad('<i class="fa-solid fa-globe"></i> Searching news and building analysis…');
      const data = await callClaude(apiKey, model, sess, priceCtx, customWl);
      const text = extractText(data);
      if (!text.trim()) throw new Error('Empty response — please try again.');
      updateLoad('<i class="fa-solid fa-circle-check"></i> Parsing recommendations…');
      let analysis;
      try { analysis = sanitizeParsed(parseAnalysis(text)); }
      catch (parseErr) {
        if (!parseErr.message.startsWith('PARSE_FAIL:')) throw parseErr;
        updateLoad('<i class="fa-solid fa-triangle-exclamation"></i> Reformatting response…');
        const fixedText = await reformatAsJson(apiKey, model, text);
        analysis = sanitizeParsed(parseAnalysis(fixedText));
      }
      const extended = isExtendedHours();
      (analysis.suggestions || []).forEach(s => {
        const p = priceMap[s.ticker]; if (!p) return;
        if (extended && p.extPrice != null) { s.live_price = p.extPrice; s.live_dp = p.extDp||0; s.price_is_close = false; s.is_extended = true; s.ext_session = sess; }
        else { s.live_price = p.price; s.live_dp = p.dp; s.price_is_close = extended; s.is_extended = false; }
      });
      render(analysis);
      setCache(CACHE_KEYS.analysis, analysis);
    } catch (err) {
      const msg = err.message.startsWith('PARSE_FAIL:')
        ? 'Could not parse response as JSON.\n\nWhat Claude returned:\n' + err.message.slice(11) : err.message;
      showError(msg);
    } finally {
      stopLoading();
      const b = el('genBtn'); if (b) b.disabled = false;
      const l = el('genLabel'); if (l) l.textContent = 'Refresh Analysis';
      const i = el('genIcon'); if (i) i.innerHTML = '<i class="fa-solid fa-bolt"></i>';
    }
  };

  // ── S&P 500 watchlist (Research Opens) ───
  function systemWatchlistPrompt() {
    return `You are an expert stock researcher screening the S&P 500 for the best open setups.

Step 1: Search the web for today's market news, earnings, catalysts, and overnight/after-hours movers across the S&P 500.
Step 2: Identify the 6-10 strongest setups for the next market open — any S&P 500 stock qualifies.
Step 3: Reply with ONLY valid JSON wrapped in <json_data> tags. No other text. No markdown. No explanation.

The JSON must follow this exact structure:
<json_data>
{"date":"YYYY-MM-DD","research_summary":"2-3 sentences on the overall setup","key_catalysts":["catalyst1","catalyst2"],"watchlist":[{"ticker":"AAPL","company":"Apple Inc","sector":"Technology","thesis":"Why this is worth watching","catalyst":"Specific catalyst","buy_trigger":"Exact condition before entering, e.g. holds above $182 in first 5 min on volume","entry_point":"$XXX.XX","first_target":"$XXX.XX","stop_loss":"$XXX.XX","risk_reward":"1:2","confidence":"HIGH","confidence_pct":88,"pre_market_signal":"What to check before 9:30 AM ET"}]}
</json_data>

Hard rules:
- S&P 500 stocks only — no ETFs, no non-index stocks
- Include only picks with confidence_pct ≥ 85% — omit weaker setups
- Minimum 5, maximum 10 picks
- All price fields must be exact dollar values like "$182.45"
- Tight stops: 1-2% from entry
- Output ONLY the <json_data> block — nothing before, nothing after`;
  }

  function watchlistUserPrompt(priceCtx) {
    const etNow_ = etNow();
    const sess = sessionOf(etNow_);
    const isPremarket = sess === 'premarket';
    const today = etNow_.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const tomorrow = new Date(etNow_.getTime() + 86400000).toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const priceLabel = isPremarket ? 'PRE-MARKET PRICES as of ' + today + ':' : 'AFTER-HOURS PRICES as of ' + today + ':';
    const prices = priceCtx ? '\n' + priceLabel + '\n' + priceCtx + '\n' : '\n[No live price feed — search web for current prices]\n';
    const customWl = loadCustomWatchlist();
    const customSection = customWl.length ? '\nPRIORITY TICKERS (always include if compelling setup): ' + customWl.join(', ') + '\n' : '';
    if (isPremarket) {
      return 'TODAY IS ' + today.toUpperCase() + '. Pre-market — market has NOT opened yet. Build a watchlist for TODAY\'s open (' + today + ').\n' + prices + customSection + '\nSearch for: overnight news, gap-up/gap-down setups forming now, pre-market earnings reactions, analyst upgrades published this morning, unusual pre-market volume across S&P 500.\n\nPick the 6-10 strongest S&P 500 setups for today\'s open. For each, define a buy_trigger — exact confirmation to wait for in the first 5 minutes after 9:30 AM ET. Only picks with ≥85% confidence.';
    }
    return 'TODAY IS ' + today.toUpperCase() + '. Market is closed. Build a watchlist for TOMORROW\'s open (' + tomorrow + ').\n' + prices + customSection + '\nSearch for: after-hours earnings reactions today (' + today + '), analyst calls published today, macro events scheduled for tomorrow, futures direction tonight.\n\nPick the 6-10 strongest S&P 500 setups for tomorrow\'s open. For each, define a buy_trigger — exact confirmation to wait for in the first 5 minutes after 9:30 AM ET. Only picks with ≥85% confidence.';
  }

  function renderWatchlistInline(analysis, wlSess) {
    const isPremarket = wlSess === 'premarket';
    const wlTitle = el('wlTitle');
    if (wlTitle) wlTitle.innerHTML = isPremarket ? '<i class="fa-solid fa-eye"></i> Today\'s Open Watchlist' : '<i class="fa-solid fa-eye"></i> Tomorrow\'s Open Watchlist';
    const wlSum = el('wlSummary'); if (wlSum) wlSum.textContent = analysis.research_summary || '';
    const wlCat = el('wlCatalysts'); if (wlCat) wlCat.innerHTML = (analysis.key_catalysts || []).map(c => '<span class="catalyst-tag">' + c + '</span>').join('');
    const wlC = el('wlCards'); if (wlC) wlC.innerHTML = '<div class="wl-cards-grid">' + (analysis.watchlist || []).map(wlCardHTML).join('') + '</div>';
    staggerCards(el('wlCards'));
    el('wlSection')?.classList.add('active');
    const ts = new Date().toLocaleString('en-US', { timeZone:'America/New_York', dateStyle:'full', timeStyle:'medium' });
    const tsEl = el('timestamp');
    if (tsEl) { tsEl.textContent = 'Watchlist generated: ' + ts + ' ET'; tsEl.classList.add('active'); }
  }

  function loadWlInlineCache() {
    const cached = getCache(CACHE_KEYS.wlInline);
    if (!cached) return;
    const ageH = (Date.now() - cached.ts) / 3600000;
    if (ageH > 10) return;
    renderWatchlistInline(cached.data, sessionOf(etNow()));
    const tsEl = el('timestamp');
    if (tsEl) {
      const cacheTime = new Date(cached.ts).toLocaleString('en-US', { timeZone:'America/New_York', timeStyle:'short' });
      tsEl.innerHTML = 'Cached · ' + cacheTime + ' ET';
      if (ageH > 6) tsEl.innerHTML += ' <span class="stale-badge">Stale — refresh for latest</span>';
    }
  }

  async function generateWatchlist() {
    const apiKey = localStorage.getItem('sb_key');
    if (!apiKey) { showError('Please enter your Anthropic API key first.'); return; }
    clearAllCaches();
    clearError();
    const model = el('modelSelect').value;
    const btn   = el('watchlistBtn');
    const lbl   = el('wlLabel');
    const icon  = el('wlIcon');
    btn.disabled = true; lbl.textContent = 'Researching…'; icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    startLoading();
    try {
      updateLoad('<i class="fa-solid fa-satellite-dish"></i> Fetching live prices…');
      const customWl   = loadCustomWatchlist();
      const allSymbols = [...new Set([...SP500_TICKERS, ...customWl])];
      const prices     = await fetchLivePricesYahoo(allSymbols);
      const priceMap   = {};
      prices.forEach(p => { priceMap[p.ticker] = p; });
      const priceCtx = buildPriceContext(prices);
      const wlSess = sessionOf(etNow());
      updateLoad(wlSess === 'premarket' ? '<i class="fa-solid fa-eye"></i> Scanning S&P 500 for today\'s open…' : '<i class="fa-solid fa-eye"></i> Scanning S&P 500 for tomorrow\'s open…');
      let messages = [{ role:'user', content: watchlistUserPrompt(priceCtx) }];
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
      const finalSess = sessionOf(etNow());
      (analysis.watchlist || []).forEach(s => {
        const p = priceMap[s.ticker]; if (!p) return;
        if (p.extPrice != null) { s.live_price = p.extPrice; s.live_dp = p.extDp||0; s.price_is_close = false; s.is_extended = true; s.ext_session = finalSess; s.prev_close = p.prevClose||null; }
        else { s.live_price = p.price; s.live_dp = p.dp; s.price_is_close = true; s.is_extended = false; s.prev_close = p.prevClose||null; }
      });
      renderWatchlistInline(analysis, finalSess);
      setCache(CACHE_KEYS.wlInline, analysis);
    } catch (err) {
      const msg = err.message.startsWith('PARSE_FAIL:') ? 'Could not parse response as JSON.\n\nWhat Claude returned:\n' + err.message.slice(11) : err.message;
      showError(msg);
    } finally {
      stopLoading();
      const b2 = el('watchlistBtn'); if (b2) b2.disabled = false;
      const fs = sessionOf(etNow());
      const l2 = el('wlLabel'); if (l2) l2.textContent = fs === 'premarket' ? "Research Today's Open" : "Research Tomorrow's Open";
      const i2 = el('wlIcon'); if (i2) i2.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  }

  // ── Lifecycle ─────────────────────────────
  let _interval = null;
  let _inited   = false;

  SpaRouter.register('analysis', {
    showError,
    clearError,
    updateLoad,
    startLoading,
    stopLoading,
    tickSession,
    generateWatchlist,
    applyKeySaved,
    activate(user) {
      initSharedUI('analysis');
      if (!_inited) {
        _inited = true;
        applyKeySaved(!!localStorage.getItem('sb_key'));
        loadCache();
        loadWlInlineCache();
        const saved = localStorage.getItem('sb_model');
        const sel = el('modelSelect'); if (saved && sel) sel.value = saved;
      }
      if (_interval) clearInterval(_interval);
      _interval = setInterval(tickSession, 1000);
      tickSession();
    },
    deactivate() {
      clearInterval(_interval);
      _interval = null;
    },
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const btn = el('genBtn');
      if (btn && !btn.disabled) window.generate();
    }
  });
})();
