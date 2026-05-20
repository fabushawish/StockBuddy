// ─────────────────────────────────────────────
//  PORTFOLIO PAGE MODULE
// ─────────────────────────────────────────────
(function () {
  function el(id) { return document.querySelector('#view-portfolio [id="' + id + '"]'); }

  function showError(msg) {
    const b = el('errorBox');
    if (b) { b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + msg; b.classList.add('active'); }
  }
  function clearError() { const b = el('errorBox'); if (b) b.classList.remove('active'); }
  function updateLoad(msg) { const m = el('loadMsg'); if (m) m.innerHTML = '<em>' + msg + '</em>'; }
  function startLoading() { el('loadingBox')?.classList.add('active'); const se = el('stepsEl'); if (se) se.innerHTML = ''; updateLoad('Loading…'); }
  function stopLoading()  { el('loadingBox')?.classList.remove('active'); }
  function applyKeySaved() {}
  function tickSession() {}
  function generateWatchlist() {}

  // ── Globals needed by dynamic onclick HTML ──
  window._portPriceMap   = window._portPriceMap   || {};
  window._portAiSugs     = window._portAiSugs     || [];
  window._portAiAnalysis = window._portAiAnalysis || {};
  window._portSort       = window._portSort       || 'value-desc';
  let _allocChart      = null;
  let _roiChart        = null;
  let _chartsExpanded  = false;
  let _lastChartData   = [];

  function getCSSVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  window.toggleCharts = function () {
    _chartsExpanded = !_chartsExpanded;
    const body    = el('chartsBody');
    const chevron = el('chartsChevron');
    if (body)    body.style.display    = _chartsExpanded ? 'block' : 'none';
    if (chevron) chevron.innerHTML     = _chartsExpanded ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
    if (_chartsExpanded) {
      renderPortfolioCharts(_lastChartData);
    } else {
      if (_allocChart) { _allocChart.destroy(); _allocChart = null; }
      if (_roiChart)   { _roiChart.destroy();   _roiChart   = null; }
    }
  };

  function renderPortfolioCharts(data) {
    const chartsEl = el('portfolioCharts');
    if (!data.length) { if (chartsEl) chartsEl.style.display = 'none'; return; }
    if (chartsEl) chartsEl.style.display = 'block';
    const PALETTE = ['#06b6d4','#38bdf8','#818cf8','#34d399','#fb923c','#f472b6','#a78bfa','#22d3ee','#4ade80','#fbbf24','#e879f9','#f97316'];
    const textDim = getCSSVar('--text-dim');
    const bg2     = getCSSVar('--bg2');
    const gridCol = getCSSVar('--border');
    if (_allocChart) { _allocChart.destroy(); _allocChart = null; }
    if (_roiChart)   { _roiChart.destroy();   _roiChart   = null; }
    const allocCanvas = el('allocChart');
    if (allocCanvas) {
      _allocChart = new Chart(allocCanvas, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.ticker),
          datasets: [{ data: data.map(d => parseFloat(d.value.toFixed(2))), backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: bg2, borderWidth: 2, hoverBorderWidth: 3 }],
        },
        options: {
          responsive: true, cutout: '60%',
          plugins: {
            legend: { position: 'right', labels: { color: textDim, font: { size: 11, weight: '600' }, padding: 10, boxWidth: 10, boxHeight: 10 } },
            tooltip: { callbacks: { label(ctx) { const val = ctx.parsed; const tot = ctx.dataset.data.reduce((a,b)=>a+b,0); return ' $' + val.toFixed(2) + ' (' + (val/tot*100).toFixed(1) + '%)'; } } },
          },
        },
      });
    }
    const sorted  = [...data].sort((a, b) => b.roi - a.roi);
    const roiWrap = el('roiChartWrap');
    if (roiWrap) roiWrap.style.height = Math.max(160, sorted.length * 34) + 'px';
    const roiCanvas = el('roiChart');
    if (roiCanvas) {
      _roiChart = new Chart(roiCanvas, {
        type: 'bar',
        data: {
          labels: sorted.map(d => d.ticker),
          datasets: [{ data: sorted.map(d => parseFloat(d.roi.toFixed(2))), backgroundColor: sorted.map(d => d.roi >= 0 ? 'rgba(16,185,129,.65)' : 'rgba(244,63,94,.65)'), borderColor: sorted.map(d => d.roi >= 0 ? '#10b981' : '#f43f5e'), borderWidth: 1, borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label(ctx) { return ' ' + (ctx.parsed.x >= 0 ? '+' : '') + ctx.parsed.x.toFixed(2) + '%'; } } },
          },
          scales: {
            x: { grid: { color: gridCol }, ticks: { color: textDim, callback: v => v + '%', font: { size: 11 } }, border: { color: 'transparent' } },
            y: { grid: { display: false }, ticks: { color: textDim, font: { family: '"JetBrains Mono"', size: 12, weight: '700' } }, border: { color: 'transparent' } },
          },
        },
      });
    }
  }

  window.handleSort = function (val) {
    window._portSort = val;
    renderPortfolio(window._portPriceMap, window._portAiSugs);
  };

  window.togglePortfolioCollapse = function (e) {
    if (e && e.target.closest('button,input,select')) return;
    const body    = el('portfolioBody');
    const chevron = el('portfolioChevron');
    if (body)    body.classList.toggle('collapsed');
    const collapsed = body ? body.classList.contains('collapsed') : false;
    if (chevron) chevron.innerHTML = collapsed ? '<i class="fa-solid fa-chevron-right"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
  };

  window.toggleAddForm = function () {
    const f = el('addPosForm');
    if (!f) return;
    const show = f.style.display !== 'flex';
    f.style.display = show ? 'flex' : 'none';
    if (show) { const inp = el('posTickerInput'); if (inp) inp.focus(); }
  };

  window.addPosition = function () {
    const ticker  = (el('posTickerInput')?.value || '').trim().toUpperCase();
    const shares  = parseFloat(el('posSharesInput')?.value);
    const avgCost = parseFloat(el('posCostInput')?.value);
    if (!ticker || isNaN(shares) || isNaN(avgCost) || shares <= 0 || avgCost <= 0) { showError('Enter ticker, number of shares, and average cost.'); return; }
    const p = loadPortfolio();
    p[ticker] = { shares, avgCost };
    savePortfolio(p);
    const ti = el('posTickerInput'); if (ti) ti.value = '';
    const si = el('posSharesInput'); if (si) si.value = '';
    const ci = el('posCostInput');   if (ci) ci.value = '';
    window.toggleAddForm();
    renderPortfolio(window._portPriceMap, window._portAiSugs);
    fetchPortfolioPrices();
  };

  window.removePosition = function (ticker) {
    const p = loadPortfolio();
    delete p[ticker];
    delete window._portAiAnalysis[ticker];
    localStorage.setItem('sb_portfolio', JSON.stringify(p));
    if (sbDb && sbUser) {
      sbDb.collection('users').doc(sbUser.uid).update({
        ['portfolio.' + ticker]: firebase.firestore.FieldValue.delete(),
      }).catch(e => console.warn('Firestore delete failed:', e.message));
    }
    renderPortfolio(window._portPriceMap, window._portAiSugs);
  };

  window.editPosition = function (ticker) {
    const { shares, avgCost } = loadPortfolio()[ticker];
    const card = document.getElementById('holding-card-' + ticker);
    if (!card) return;
    card.innerHTML = `
      <div class="holding-edit-form">
        <label class="edit-label">Ticker</label>
        <input class="edit-input" id="edit-ticker-${ticker}" value="${ticker}"
               oninput="this.value=this.value.toUpperCase()"
               style="font-family:'JetBrains Mono',monospace;font-weight:700" />
        <label class="edit-label">Shares</label>
        <input class="edit-input" type="number" id="edit-shares-${ticker}" value="${shares}" min="0.001" step="any" />
        <label class="edit-label">Avg cost ($)</label>
        <input class="edit-input" type="number" id="edit-cost-${ticker}" value="${avgCost}" min="0.01" step="0.01" />
        <div class="edit-form-actions">
          <button class="btn btn-primary" onclick="saveEdit('${ticker}')">Save</button>
          <button class="btn btn-ghost"   onclick="renderPortfolio(_portPriceMap,_portAiSugs)">Cancel</button>
        </div>
      </div>`;
  };

  window.saveEdit = function (oldTicker) {
    const newTicker = (document.getElementById('edit-ticker-' + oldTicker)?.value || '').trim().toUpperCase();
    const shares    = parseFloat(document.getElementById('edit-shares-' + oldTicker)?.value);
    const avgCost   = parseFloat(document.getElementById('edit-cost-' + oldTicker)?.value);
    if (!newTicker)                                                       { showError('Ticker cannot be empty.'); return; }
    if (isNaN(shares) || isNaN(avgCost) || shares <= 0 || avgCost <= 0) { showError('Invalid shares or cost.'); return; }
    const p = loadPortfolio();
    if (newTicker !== oldTicker) {
      if (p[newTicker]) { showError(newTicker + ' already exists in portfolio.'); return; }
      delete p[oldTicker];
      delete window._portAiAnalysis[oldTicker];
      if (sbDb && sbUser) {
        sbDb.collection('users').doc(sbUser.uid).update({
          ['portfolio.' + oldTicker]: firebase.firestore.FieldValue.delete(),
        }).catch(e => console.warn('Firestore delete failed:', e.message));
      }
    }
    p[newTicker] = { shares, avgCost };
    savePortfolio(p);
    renderPortfolio(window._portPriceMap, window._portAiSugs);
  };

  function portfolioSignal(ticker, pnlPct, aiSugs) {
    const ai = window._portAiAnalysis[ticker];
    if (ai) {
      const map = {
        'STRONG BUY': { cls:'sig-buy',  label:'<i class="fa-solid fa-bolt"></i> STRONG BUY' },
        'BUY MORE':   { cls:'sig-buy',  label:'<i class="fa-solid fa-arrow-trend-up"></i> BUY MORE' },
        'HOLD':       { cls:'sig-hold', label:'<i class="fa-solid fa-minus"></i> HOLD' },
        'REDUCE':     { cls:'sig-cut',  label:'<i class="fa-solid fa-arrow-down"></i> REDUCE' },
        'SELL':       { cls:'sig-sell', label:'<i class="fa-solid fa-arrow-trend-down"></i> SELL' },
      };
      return map[ai.signal] || { cls:'sig-hold', label:'<i class="fa-solid fa-minus"></i> HOLD' };
    }
    const hit = aiSugs.find(s => s.ticker === ticker);
    if (hit) return hit.action === 'BUY'
      ? { cls:'sig-buy',  label:'<i class="fa-solid fa-arrow-trend-up"></i> BUY MORE — AI PICK' }
      : { cls:'sig-sell', label:'<i class="fa-solid fa-arrow-trend-down"></i> SELL — AI PICK' };
    if (pnlPct <= -7)  return { cls:'sig-cut',  label:'<i class="fa-solid fa-scissors"></i> CUT LOSS' };
    if (pnlPct >= 20)  return { cls:'sig-take', label:'<i class="fa-solid fa-coins"></i> TAKE PROFIT' };
    return { cls:'sig-hold', label:'<i class="fa-solid fa-minus"></i> HOLD' };
  }

  window.renderPortfolio = function (priceMap, aiSugs) {
    window._portPriceMap = priceMap || {};
    window._portAiSugs   = aiSugs   || [];
    const portfolio = loadPortfolio();
    const tickers   = Object.keys(portfolio);
    const cardsEl   = el('portfolioCards');
    const subEl     = el('portfolioSub');
    const glanceEl  = el('portfolioGlance');
    if (!tickers.length) {
      if (cardsEl)  cardsEl.innerHTML  = '<div class="portfolio-empty">No holdings yet. Click <strong>+ Add Position</strong> to start tracking.</div>';
      if (subEl)    subEl.textContent  = 'No holdings tracked';
      if (glanceEl) glanceEl.style.display = 'none';
      return;
    }
    const sortedTickers = [...tickers];
    const [sortBy, sortDir] = window._portSort.split('-');
    sortedTickers.sort((a, b) => {
      const pa = window._portPriceMap[a], pb = window._portPriceMap[b];
      if (sortBy === 'value') {
        const va = pa ? portfolio[a].shares * (pa.extPrice ?? pa.price) : 0;
        const vb = pb ? portfolio[b].shares * (pb.extPrice ?? pb.price) : 0;
        return sortDir === 'desc' ? vb - va : va - vb;
      }
      if (sortBy === 'roi') {
        const ca = pa ? (pa.extPrice ?? pa.price) : null;
        const cb = pb ? (pb.extPrice ?? pb.price) : null;
        const ra = ca != null ? (ca - portfolio[a].avgCost) / portfolio[a].avgCost * 100 : (sortDir === 'desc' ? -Infinity : Infinity);
        const rb = cb != null ? (cb - portfolio[b].avgCost) / portfolio[b].avgCost * 100 : (sortDir === 'desc' ? -Infinity : Infinity);
        return sortDir === 'desc' ? rb - ra : ra - rb;
      }
      return 0;
    });
    let totalValue = 0, totalCost = 0, priced = 0;
    const cards = sortedTickers.map(ticker => {
      const { shares, avgCost } = portfolio[ticker];
      const p   = window._portPriceMap[ticker];
      const cur = p ? (p.extPrice ?? p.price) : null;
      const cost = shares * avgCost;
      totalCost += cost;
      let priceHtml, roiRowHtml, footerVal, pnlPct = 0;
      let signal = { cls:'sig-hold', label:'<i class="fa-solid fa-minus"></i> HOLD' };
      if (cur) {
        priced++;
        const value = shares * cur;
        const pnl   = value - cost;
        pnlPct      = ((cur - avgCost) / avgCost) * 100;
        totalValue += value;
        const up = pnl >= 0;
        priceHtml  = '<span class="holding-price ' + (up?'up':'down') + '">$' + cur.toFixed(2) + '</span>';
        roiRowHtml = '<div class="holding-roi-row"><span class="holding-roi-pct ' + (up?'up':'down') + '">ROI ' + (up?'+':'') + pnlPct.toFixed(2) + '%</span><span class="holding-roi-pnl ' + (up?'up':'down') + '">' + (up?'+':'-') + '$' + Math.abs(pnl).toFixed(2) + '</span></div>';
        footerVal  = 'Value: $' + value.toFixed(2);
        signal     = portfolioSignal(ticker, pnlPct, window._portAiSugs);
      } else {
        priceHtml  = '<span class="holding-price dim">No price</span>';
        roiRowHtml = '';
        footerVal  = 'Cost: $' + cost.toFixed(2);
        signal     = portfolioSignal(ticker, 0, window._portAiSugs);
      }
      const ai = window._portAiAnalysis[ticker];
      const analysisHtml = ai
        ? '<div class="holding-analysis"><div class="holding-reason">' + ai.reason + '</div>' + (ai.risk ? '<div class="holding-risk"><i class="fa-solid fa-triangle-exclamation"></i> ' + ai.risk + '</div>' : '') + '<div class="holding-conf">Confidence: ' + ai.confidence + '%</div></div>'
        : '<div class="holding-analysis"></div>';
      return '<div class="holding-card" id="holding-card-' + ticker + '"><div class="holding-top"><div><div class="holding-ticker">' + ticker + '</div><div class="holding-meta">' + shares + ' shares &middot; avg $' + avgCost.toFixed(2) + ' &middot; cost $' + cost.toFixed(2) + '</div></div><span class="sig ' + signal.cls + '">' + signal.label + '</span></div><div class="holding-price-row">' + priceHtml + '</div>' + roiRowHtml + analysisHtml + '<div class="holding-footer"><span class="holding-value">' + footerVal + '</span><div class="holding-footer-actions"><button class="holding-edit" onclick="editPosition(\'' + ticker + '\')"><i class="fa-solid fa-pen"></i> Edit</button><button class="holding-remove" onclick="removePosition(\'' + ticker + '\')"><i class="fa-solid fa-xmark"></i> Remove</button></div></div></div>';
    }).join('');
    if (cardsEl) { cardsEl.innerHTML = '<div class="portfolio-cards-grid">' + cards + '</div>'; staggerCards(cardsEl); }
    const totalPnl    = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const up          = totalPnl >= 0;
    if (totalValue > 0) {
      if (glanceEl) { glanceEl.style.display = 'flex'; glanceEl.innerHTML = '<div class="port-glance-stat"><span class="port-glance-label">Overall ROI</span><span class="port-roi-big ' + (up?'up':'down') + '">' + (up?'+':'') + totalPnlPct.toFixed(2) + '%</span></div><div class="port-glance-stat"><span class="port-glance-label">Total Value</span><span class="port-glance-val">$' + totalValue.toFixed(2) + '</span></div><div class="port-glance-stat"><span class="port-glance-label">Total P&amp;L</span><span class="port-glance-val ' + (up?'up':'down') + '">' + (up?'+':'-') + '$' + Math.abs(totalPnl).toFixed(2) + '</span></div><div class="port-glance-stat"><span class="port-glance-label">Holdings</span><span class="port-glance-val">' + tickers.length + '</span></div>'; }
      if (subEl) subEl.textContent = priced + ' of ' + tickers.length + ' priced · Cost basis $' + totalCost.toFixed(2);
    } else {
      if (glanceEl) glanceEl.style.display = 'none';
      if (subEl) subEl.textContent = tickers.length + ' holdings · Cost basis: $' + totalCost.toFixed(2);
    }
    _lastChartData = tickers.map(t => {
      const p = window._portPriceMap[t]; if (!p) return null;
      const cur = p.extPrice ?? p.price;
      const { shares, avgCost } = portfolio[t];
      return { ticker: t, value: shares * cur, roi: (cur - avgCost) / avgCost * 100 };
    }).filter(Boolean);
    const chartsEl = el('portfolioCharts');
    if (_lastChartData.length) {
      if (chartsEl) chartsEl.style.display = 'block';
      if (_chartsExpanded) renderPortfolioCharts(_lastChartData);
    } else {
      if (chartsEl) chartsEl.style.display = 'none';
    }
  };

  async function fetchPortfolioPrices() {
    const portfolio = loadPortfolio();
    const tickers   = Object.keys(portfolio);
    if (!tickers.length) return;
    const btn   = el('refreshPricesBtn');
    const subEl = el('portfolioSub');
    if (btn)   { btn.disabled = true; btn.textContent = '↻ Loading…'; }
    if (subEl) { subEl.textContent = 'Loading prices…'; }
    try {
      const rows = await fetchLivePricesYahoo(tickers);
      rows.forEach(r => { window._portPriceMap[r.ticker] = r; });
      renderPortfolio(window._portPriceMap, window._portAiSugs);
    } catch (e) {
      if (subEl) subEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Price fetch failed: ' + e.message;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Prices'; }
    }
  }

  window.manualRefreshPrices = async function () { window._portPriceMap = {}; await fetchPortfolioPrices(); };

  window.analysePortfolio = async function () {
    const apiKey = localStorage.getItem('sb_key');
    if (!apiKey) { showError('Anthropic API key required. Go to Settings.'); return; }
    clearAllCaches();
    const portfolio = loadPortfolio();
    const tickers   = Object.keys(portfolio);
    if (!tickers.length) return;
    const model = el('modelSelect').value;
    const btn   = el('analysePortBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analysing…';
    document.querySelectorAll('#view-portfolio .holding-analysis').forEach(e => { e.innerHTML = '<span class="holding-conf">Analysing fundamentals…</span>'; });
    const sysPrompt = 'You are a high-conviction portfolio analyst. Risk tolerance: HIGH — aggressive growth, momentum, and turnaround plays are fine when backed by fundamentals or a clear catalyst. Reject pure meme speculation with no thesis.\n\nAnalyse each ticker using your knowledge of its business model, recent earnings trajectory, analyst consensus, sector tailwinds/headwinds, valuation, and momentum as of your training data. Be direct and opinionated.\n\nSignal options: STRONG BUY | BUY MORE | HOLD | REDUCE | SELL\n\nReturn ONLY valid JSON in <json_data> tags:\n<json_data>\n{"analyses":[{"ticker":"AAPL","signal":"HOLD","confidence_pct":78,"reason":"1-2 sentence thesis with specific fundamental or catalyst","risk":"Primary risk factor"}]}\n</json_data>\n\nOutput ONLY the <json_data> block — nothing before or after.';
    try {
      const today = new Date().toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'long', year:'numeric', month:'long', day:'numeric' });
      const BATCH_SIZE = 10;
      const allAnalyses = [];
      const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
      for (let bi = 0; bi < tickers.length; bi += BATCH_SIZE) {
        const batch    = tickers.slice(bi, bi + BATCH_SIZE);
        const batchNum = Math.floor(bi / BATCH_SIZE) + 1;
        btn.innerHTML = totalBatches > 1 ? '<i class="fa-solid fa-magnifying-glass"></i> Analysing batch ' + batchNum + '/' + totalBatches + '…' : '<i class="fa-solid fa-magnifying-glass"></i> Analysing…';
        const holdingsList = batch.map(t => {
          const p = window._portPriceMap[t];
          const cur = p ? (p.extPrice ?? p.price) : null;
          const { shares, avgCost } = portfolio[t];
          const pnlPct = cur ? ((cur - avgCost) / avgCost * 100).toFixed(1) + '%' : 'unknown';
          return t + ': ' + shares + ' shares @ avg $' + avgCost.toFixed(2) + ', current ' + (cur ? '$' + cur.toFixed(2) : 'unknown') + ', P&L ' + pnlPct;
        }).join('\n');
        if (bi > 0) await new Promise(r => setTimeout(r, 3000));
        let res;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
            body: JSON.stringify({ model, max_tokens:4000, system:sysPrompt, messages:[{role:'user',content:'Today: ' + today + '\n\nAnalyse each holding below using your knowledge of fundamentals, earnings trajectory, analyst consensus, and sector context. Give a high-conviction signal for each:\n\n' + holdingsList}] }),
          });
          if (res.status !== 429 && res.status !== 529) break;
          const wait = parseInt(res.headers.get('retry-after') || '60', 10);
          btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Rate limit — retrying in ' + wait + 's…';
          await new Promise(r => setTimeout(r, wait * 1000));
        }
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || 'HTTP ' + res.status); }
        const data = await res.json();
        if (data.type === 'error') throw new Error(data.error?.message || 'API error');
        const text = extractText(data);
        let parsed;
        try { parsed = parseAnalysis(text); }
        catch (parseErr) { if (!parseErr.message.startsWith('PARSE_FAIL:')) throw parseErr; const fixedText = await reformatAsJson(apiKey, model, text); parsed = parseAnalysis(fixedText); }
        allAnalyses.push(...(parsed.analyses || []));
      }
      window._portAiAnalysis = {};
      allAnalyses.forEach(a => { window._portAiAnalysis[a.ticker] = { signal:a.signal, confidence:a.confidence_pct, reason:a.reason, risk:a.risk }; });
      setCache(CACHE_KEYS.portfolio, window._portAiAnalysis);
      renderPortfolio(window._portPriceMap, window._portAiSugs);
    } catch (err) {
      showError('Portfolio analysis failed: ' + err.message);
      document.querySelectorAll('#view-portfolio .holding-analysis').forEach(e => { e.innerHTML = ''; });
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Re-analyse';
    }
  };

  function loadPortfolioAiCache() {
    const cached = getCache(CACHE_KEYS.portfolio);
    if (!cached) return;
    const ageH = (Date.now() - cached.ts) / 3600000;
    if (ageH > 24) return;
    window._portAiAnalysis = cached.data;
    const btn = el('analysePortBtn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Re-analyse';
  }

  // ── Lifecycle ─────────────────────────────
  let _inited = false;

  SpaRouter.register('portfolio', {
    showError,
    clearError,
    updateLoad,
    startLoading,
    stopLoading,
    tickSession,
    generateWatchlist,
    applyKeySaved,
    activate(user) {
      initSharedUI('portfolio');
      if (!_inited) {
        _inited = true;
        loadPortfolioAiCache();
        renderPortfolio({}, []);
        fetchPortfolioPrices();
        const saved = localStorage.getItem('sb_model');
        const sel = el('modelSelect'); if (saved && sel) sel.value = saved;
      }
    },
    deactivate() {},
  });
})();
