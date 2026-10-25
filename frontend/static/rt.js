/* RNTECH visitor stats — for the admin Visitors tab.
   No cookies and nothing saved on the visitor's device. The site is one page, so the app calls rtTrack.page('events')
   whenever the section changes; each section view sends how long it was on screen and how far down it was read.
   Key moments (event opened, checkout started, ticket bought, mix played…) go through rtTrack.event(name, detail).
   Admins (signed in with role admin) aren't counted. Load after api.js — it wraps the API calls that matter. */
(function () {
  var noop = { page: function () {}, event: function () {} };
  function isAdmin() { try { var u = JSON.parse(localStorage.getItem('rntech_user')); return !!(u && u.role === 'admin'); } catch (_) { return false; } }
  if (navigator.webdriver) { window.rtTrack = noop; return; }

  var landing = location.pathname, query = location.search.replace(/[?&](?!utm_|gclid|fbclid)[^&]*/g, ''), referrer = document.referrer;
  var view = null, current = null, visible = 0, shownAt = 0, deepest = 0, firstView = true, sent = {};

  function send(k, extra) {
    if (isAdmin()) return;
    var d = { k: k, v: view, p: current };
    for (var x in extra) d[x] = extra[x];
    var body = JSON.stringify(d);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/t', body)) return; } catch (_) {}
    try { fetch('/api/t', { method: 'POST', body: body, keepalive: true }); } catch (_) {}
  }
  function scrolled() {
    var h = document.documentElement, max = h.scrollHeight - innerHeight;
    var pct = max > 0 ? Math.round(Math.min(1, (scrollY || h.scrollTop) / max) * 100) : 100;
    if (pct > deepest) deepest = pct;
  }
  function flush() {
    if (!view) return;
    if (shownAt) { visible += Date.now() - shownAt; shownAt = document.hidden ? 0 : Date.now(); }
    send('leave', { t: visible, s: deepest });
  }

  window.rtTrack = {
    // A new section on screen (home, events, mixes, tickets, contact)
    page: function (name) {
      var path = '/' + (name || 'home');
      if (firstView && (landing === '/buy' || /^\/qr\//.test(landing))) path = landing;   // landed from /buy or a QR code
      if (path === current) return;
      flush();
      view = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      current = path; visible = 0; deepest = 0; shownAt = document.hidden ? 0 : Date.now(); sent = {};
      send('view', firstView ? { r: referrer, q: query } : { r: '' });
      firstView = false;
      setTimeout(scrolled, 400);
    },
    // Something worth counting; detail is e.g. the mix or event name (sent once per section view)
    event: function (name, detail) {
      var key = name + '|' + (detail || '');
      if (!view || sent[key]) return;
      sent[key] = 1;
      send('event', { l: name, h: String(detail || '').slice(0, 120) });
    },
  };

  addEventListener('scroll', scrolled, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flush(); else shownAt = Date.now();
  });
  addEventListener('pagehide', function () { if (shownAt) flush(); });

  // Clicks on links and buttons: what they said and where they went
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button, [data-track]');
    if (!el || !view || el.closest('.adm-root')) return;
    var label = el.getAttribute('data-track') || el.getAttribute('aria-label') || (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
    if (!label) return;
    send('click', { l: label.slice(0, 80), h: (el.getAttribute('href') || '').slice(0, 200) });
  }, true);

  // The API calls that mean something happened
  var api = window.RNTECH_API;
  if (api) {
    var wrap = function (fn, name, detail) {
      var orig = api[fn]; if (!orig) return;
      api[fn] = function () {
        var args = arguments, p = orig.apply(api, args);
        if (p && p.then) p.then(function (res) { try { window.rtTrack.event(name, detail ? detail(args, res) : ''); } catch (_) {} }, function () {});
        return p;
      };
    };
    wrap('getEvent', 'event_open', function (a, res) { return (res && (res.title || res.name)) || a[0]; });
    wrap('createCheckoutSession', 'checkout_start');
    wrap('issueTicket', 'ticket_free');
    wrap('register', 'signup');
    wrap('submitInterest', 'interest');
    wrap('submitMessage', 'contact_sent');
    wrap('getPromo', 'qr_link', function (a) { return a[0]; });
  }
})();
