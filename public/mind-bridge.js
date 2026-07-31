/* Mind Bridge — exécute les scripts envoyés par l'assistant directement sur la page WP Admin */
(function () {
  'use strict';

  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) return;

  var scriptUrl = new URL(currentScript.src);
  var appOrigin = scriptUrl.origin;
  var token = scriptUrl.searchParams.get('t') || localStorage.getItem('__mb_token');

  if (!token) {
    alert('Mind Bridge : token manquant. Régénérez le bookmarklet depuis la page Intégrations.');
    return;
  }

  localStorage.setItem('__mb_token', token);

  if (window.__mindBridgeActive) {
    console.log('[Mind Bridge] déjà actif sur cette page');
    return;
  }
  window.__mindBridgeActive = true;

  /* ── Badge flottant ── */
  var badge = document.createElement('div');
  badge.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
    'background:#7c3aed', 'color:white', 'border-radius:12px',
    'padding:8px 14px 8px 10px',
    'font-size:13px', 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'display:flex', 'align-items:center', 'gap:8px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'cursor:default', 'user-select:none',
  ].join(';');

  var dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0;';

  var labelEl = document.createElement('span');
  labelEl.textContent = 'Mind Bridge actif';

  var closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  closeBtn.title = 'Fermer Mind Bridge';
  closeBtn.style.cssText = 'margin-left:4px;cursor:pointer;opacity:0.7;font-size:17px;line-height:1;';
  closeBtn.onclick = function () {
    clearInterval(pollInterval);
    badge.remove();
    window.__mindBridgeActive = false;
  };

  badge.appendChild(dot);
  badge.appendChild(labelEl);
  badge.appendChild(closeBtn);
  document.body.appendChild(badge);

  function setStatus(status, text) {
    if (status === 'executing') {
      dot.style.background = '#facc15';
      labelEl.textContent = text || 'Exécution en cours…';
    } else if (status === 'done') {
      dot.style.background = '#4ade80';
      labelEl.textContent = 'Mind Bridge actif';
    } else if (status === 'error') {
      dot.style.background = '#f87171';
      labelEl.textContent = text || 'Erreur d\'exécution';
      setTimeout(function () { setStatus('done'); }, 4000);
    }
  }

  function reportResult(id, success, result) {
    fetch(appOrigin + '/api/wp/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, id: id, success: success, result: result }),
    }).catch(function () {});
  }

  function executeScript(pending) {
    var desc = pending.description || 'script';
    setStatus('executing', 'Exécution : ' + desc.slice(0, 50));
    try {
      // eslint-disable-next-line no-eval
      var result = eval(pending.script);
      var resultStr = result !== undefined
        ? (typeof result === 'string' ? result : JSON.stringify(result))
        : 'ok';
      reportResult(pending.id, true, resultStr);
      setStatus('done');
    } catch (e) {
      var errMsg = String(e);
      reportResult(pending.id, false, errMsg);
      setStatus('error', 'Erreur : ' + errMsg.slice(0, 60));
    }
  }

  function runSequentially(scripts) {
    return scripts.reduce(function (p, s) {
      return p.then(function () { executeScript(s); });
    }, Promise.resolve());
  }

  function poll() {
    fetch(appOrigin + '/api/wp/bridge?token=' + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var scripts = Array.isArray(data.scripts) ? data.scripts : [];
        if (scripts.length > 0) runSequentially(scripts);
      })
      .catch(function () {});
  }

  var pollInterval = setInterval(poll, 2000);
  poll();
})();
