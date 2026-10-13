/* Berakah Remodeling, site behaviour (no dependencies). Hooks are data-attributes so markup can change freely. */
(function () {
  'use strict';
  var d = document, w = window;
  var CONSENT_KEY = 'nh_cookie_consent';
  function $(sel, root) { return (root || d).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function store(k, v) { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- Mobile navigation ---------- */
  $$('[data-nav-toggle]').forEach(function (btn) {
    var targetSel = btn.getAttribute('data-nav-toggle') || '[data-nav]';
    var nav = $(targetSel);
    if (!nav) return;
    btn.setAttribute('aria-expanded', 'false');
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      d.documentElement.classList.toggle('nav-open', open);
      /* keep Tab inside the open menu: everything outside the header is inert (no-op where unsupported) */
      $$('.skip-link, .topbar, main, footer, .mobile-cta, [data-cookie-banner]').forEach(function (el) { el.inert = open; });
    }
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); if (!nav.classList.contains('is-open')) btn.focus(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); btn.focus(); } });
  });
  /* Dropdown submenus: open on click for touch/keyboard (hover handled in CSS) */
  var deskNav = w.matchMedia('(min-width:1100px)');
  $$('[data-submenu-toggle]').forEach(function (btn) {
    var item = btn.closest('[data-has-submenu]') || btn.parentElement;
    btn.setAttribute('aria-expanded', 'false');
    /* keep the reported state matching the panel, which CSS also opens on hover/focus at desktop widths */
    function sync(open) { btn.setAttribute('aria-expanded', (open || item.classList.contains('is-open')) ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      item.classList.toggle('is-open');
      sync(deskNav.matches); /* at desktop widths the toggle keeps focus inside, so the panel stays open */
    });
    ['focusin', 'mouseenter'].forEach(function (type) {
      item.addEventListener(type, function () { if (deskNav.matches) sync(true); });
    });
    ['focusout', 'mouseleave'].forEach(function (type) {
      item.addEventListener(type, function (e) {
        if (!deskNav.matches) return;
        if (type === 'focusout' && e.relatedTarget && item.contains(e.relatedTarget)) return;
        sync(false);
      });
    });
  });
  /* Header shadow after scroll */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', w.scrollY > 8); };
    onScroll(); w.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Analytics (GA4) gated by cookie consent ---------- */
  var gaId = (d.querySelector('meta[name="ga-id"]') || {}).content || '';
  var gaLoaded = false;
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;
  function loadGA() {
    if (gaLoaded || !gaId) return;
    gaLoaded = true;
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', gaId, { anonymize_ip: true });
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    d.head.appendChild(s);
  }
  function track(name, params) { if (gaLoaded) gtag('event', name, params || {}); }

  /* ---------- Cookie consent banner ---------- */
  var banner = $('[data-cookie-banner]');
  function showBanner() { if (banner) { banner.hidden = false; banner.setAttribute('aria-hidden', 'false'); } }
  function hideBanner() { if (banner) { banner.hidden = true; banner.setAttribute('aria-hidden', 'true'); } }
  function revokeGA() {
    if (!gaLoaded) return;
    w['ga-disable-' + gaId] = true;
    gtag('consent', 'update', { analytics_storage: 'denied' });
    var host = location.hostname, parts = host.split('.'), apex = parts.length > 2 ? parts.slice(-2).join('.') : host;
    d.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name !== '_ga' && name.indexOf('_ga_') !== 0) return;
      d.cookie = name + '=; Max-Age=0; path=/';
      [host, '.' + host, '.' + apex].forEach(function (dom) { d.cookie = name + '=; Max-Age=0; path=/; domain=' + dom; });
    });
  }
  function applyConsent(value) {
    store(CONSENT_KEY, value);
    hideBanner();
    if (value === 'granted') loadGA(); else revokeGA();
  }
  var saved = read(CONSENT_KEY);
  if (saved === 'granted') loadGA();
  else if (saved !== 'denied' && gaId) showBanner();
  $$('[data-consent]').forEach(function (b) { b.addEventListener('click', function () { applyConsent(b.getAttribute('data-consent') === 'accept' ? 'granted' : 'denied'); }); });
  $$('[data-open-cookie-settings]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); store(CONSENT_KEY, undefined); showBanner(); }); });

  /* ---------- Click tracking for calls / emails / CTAs ---------- */
  $$('a[href^="tel:"]').forEach(function (a) { a.addEventListener('click', function () { track('click_call', { link_url: a.href }); }); });
  $$('a[href^="mailto:"]').forEach(function (a) { a.addEventListener('click', function () { track('click_email', { link_url: a.href }); }); });
  $$('[data-track]').forEach(function (a) { a.addEventListener('click', function () { track(a.getAttribute('data-track'), { link_text: (a.textContent || '').trim().slice(0, 60) }); }); });

  /* ---------- "Get a Free Estimate" goes to the form on /contact ----------
     Every button is a plain link to /contact. On /contact itself it scrolls to the form instead of
     reloading. The GoHighLevel chat stays available as the bubble on every page. */
  var quoteBox = $('#quote');
  var goToForm = function () {
    if (!quoteBox) return false;
    var first = $('#q-name');
    quoteBox.scrollIntoView({ block: 'start' });
    if (first) first.focus({ preventScroll: true });
    return true;
  };
  d.addEventListener('click', function (e) {
    var opener = e.target && e.target.closest ? e.target.closest('[data-quote-open]') : null;
    if (opener && quoteBox && !opener.closest('#quote')) { e.preventDefault(); goToForm(); }
  });
  if (quoteBox && (/[?&]quote(=|&|$)/.test(location.search) || location.hash === '#quote')) w.addEventListener('load', goToForm);

  /* ---------- Quote form: validation + send to the GoHighLevel inbound webhook ----------
     The webhook URL lives in the form's data-webhook attribute. A GHL workflow with an
     "Inbound Webhook" trigger receives the JSON below and creates or updates the contact. */
  var PROJECT_TYPES = ['decks-porches', 'addition', 'kitchen-bath', 'interior-carpentry', 'siding-roofing', 'commercial', 'other'];
  var BUDGETS = ['under-10k', '10k-30k', '30k-75k', '75k-plus', 'not-sure'];
  function usPhone(v) { var n = v.replace(/\D/g, ''); if (n.length === 11 && n.charAt(0) === '1') n = n.slice(1); return n.length === 10 ? n : ''; }
  var RULES = {
    name: function (v) { v = v.trim(); if (v.length < 2) return 'Enter your full name.'; if (v.length > 80) return 'Keep your name to 80 characters or fewer.'; return true; },
    phone: function (v) { if (!v.trim()) return 'Enter your phone number so we can call you back.'; return !!usPhone(v) || 'Enter a 10-digit US phone number.'; },
    email: function (v) { v = v.trim(); if (!v) return 'Enter your email address.'; return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Enter a valid email address, like name@example.com.'; },
    city: function (v) { v = v.trim(); if (v.length < 2) return 'Enter the town where the project is.'; if (v.length > 60) return 'Keep the town name to 60 characters or fewer.'; return true; },
    project_type: function (v) { return PROJECT_TYPES.indexOf(v) !== -1 || 'Choose the type of project.'; },
    budget: function (v) { return BUDGETS.indexOf(v) !== -1 || 'Choose a budget range. Not sure yet is fine.'; },
    message: function (v) { v = v.trim(); if (v.length < 10) return 'Tell us what you need, in at least a few words.'; if (v.length > 2000) return 'Keep your message to 2,000 characters or fewer.'; return true; },
    source: function (v) { return v.trim().length <= 80 || 'Keep this to 80 characters or fewer.'; }
  };
  var CALL_US = 'Please call (781) 818-1828 or email berakahremodeling2122@gmail.com.';
  $$('form[data-quote-form]').forEach(function (form) {
    var status = form.querySelector('[data-form-status]');
    var submitBtn = form.querySelector('[type="submit"]');
    var opened = Date.now();
    function say(msg, kind) { if (status) { status.textContent = msg; status.className = 'form-status' + (kind ? ' is-' + kind : ''); } }
    function setError(el, msg) {
      var box = form.querySelector('[data-error-for="' + el.name + '"]');
      if (box) { box.textContent = msg || ''; box.hidden = !msg; }
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      (el.closest('.field') || el.parentElement).classList.toggle('has-error', !!msg);
    }
    function validateField(el) { var rule = RULES[el.name]; if (!rule) return true; var r = rule(el.value); setError(el, r === true ? '' : r); return r === true; }
    function label(name) { var el = form.elements[name]; return el && el.options ? el.options[el.selectedIndex].text : ''; }
    form.setAttribute('novalidate', 'novalidate');
    $$('input, select, textarea', form).forEach(function (el) {
      el.addEventListener('blur', function () { validateField(el); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') validateField(el); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      $$('input, select, textarea', form).forEach(function (el) { if (!validateField(el)) { ok = false; first = first || el; } });
      if (!ok) { if (first) first.focus(); say('Please fix the highlighted fields.', 'error'); return; }
      var f = form.elements, hook = form.getAttribute('data-webhook');
      if ((f._hp && f._hp.value) || Date.now() - opened < 2500) { w.location.assign('/thank-you'); return; }  // bots
      if (!hook) { say('The form is not connected yet. ' + CALL_US, 'error'); return; }
      var name = f.name.value.trim().replace(/\s+/g, ' '), cut = name.indexOf(' ');
      var data = {
        full_name: name, first_name: cut > 0 ? name.slice(0, cut) : name, last_name: cut > 0 ? name.slice(cut + 1) : '',
        phone: '+1' + usPhone(f.phone.value), email: f.email.value.trim(), city: f.city.value.trim(),
        project_type: label('project_type'), budget: label('budget'), message: f.message.value.trim(), source: f.source.value.trim(),
        sms_consent: f.sms_consent && f.sms_consent.checked ? 'yes' : 'no', page: location.href, submitted_at: new Date().toISOString()
      };
      say('Sending your request…', 'pending');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }
      var done = function () { track('generate_lead', { project_type: data.project_type, budget: data.budget }); w.location.assign('/thank-you'); };
      fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); done(); })
        .catch(function () {
          say('We could not send your request. ' + CALL_US, 'error');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
        });
    });
  });

  /* ---------- Decode lazy photos as they arrive, so the before/after handle never reveals a half-decoded frame ---------- */
  $$('main img[loading="lazy"]').forEach(function (img) {
    function go() { if (img.decode) img.decode().catch(function () {}); }
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  });

  /* ---------- Before / after comparison slider ---------- */
  $$('[data-compare]').forEach(function (box) {
    var range = box.querySelector('input[type="range"]'), after = box.querySelector('[data-compare-after]');
    if (!range || !after) return;
    var update = function () { after.style.width = range.value + '%'; box.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', update); update();
  });

  /* ---------- Leave-a-review: star picker ---------- */
  /* 5 stars is a plain link to Google. 1 to 4 reveal the private form in place, without a reload,
     and stamp the rating onto the form so the owner sees which one was picked. Without JavaScript
     the same links still work: they carry ?r=N and the #private anchor, which CSS :target reveals. */
  var picker = $('.rating-picker');
  if (picker) {
    var panel = document.getElementById('private');
    var star = '<svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>';
    var openPrivate = function (n) {
      if (!panel) return;
      var field = $('[data-rating-field]'); if (field) field.value = n;
      var echo = $('[data-rating-echo]');
      if (echo) {
        var stars = $('[data-rating-stars]', echo), label = $('[data-rating-label]', echo);
        if (stars) { stars.innerHTML = new Array(Number(n) + 1).join(star); stars.setAttribute('aria-label', n + ' out of 5'); }
        if (label) label.textContent = n === '1' ? 'You picked 1 star' : 'You picked ' + n + ' stars';
        echo.hidden = false;
      }
      panel.classList.add('is-open');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = $('#f-name'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
    };
    picker.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-rating]') : null;
      if (!a) return;
      var n = a.getAttribute('data-rating');
      if (n === '5') return;               // deixa o link para o Google seguir normalmente
      e.preventDefault();
      openPrivate(n);
    });
    // chegada direta em ?r=N (sem JS no clique anterior, ou link colado)
    var m = /[?&]r=([1-4])\b/.exec(location.search);
    if (m) openPrivate(m[1]);
  }

})();

/* ---------- GHL chat widget: keep the bubble above the fixed .mobile-cta bar on phones ----------
   The widget renders inside a shadow root, so page CSS cannot reach it; we inject a <style> there. */
(function () {
  var CSS = '@media(max-width:899px){.bk-chat-lift{bottom:92px!important}}';
  function lift(host) {
    var sr = host.shadowRoot; if (!sr) return false;
    if (!sr.querySelector('style[data-bk-chat-lift]')) { var st = document.createElement('style'); st.setAttribute('data-bk-chat-lift', ''); st.textContent = CSS; sr.appendChild(st); }
    sr.querySelectorAll('*').forEach(function (el) {
      if (el.classList.contains('bk-chat-lift') || el.tagName === 'STYLE') return;
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' && parseFloat(cs.bottom) < 48) el.classList.add('bk-chat-lift');
    });
    if (!sr.__bkObserved) { sr.__bkObserved = true; new MutationObserver(function () { lift(host); }).observe(sr, { childList: true, subtree: true }); }
    return true;
  }
  var tries = 0, t = setInterval(function () {
    var host = document.querySelector('chat-widget');
    if ((host && lift(host)) || ++tries > 60) clearInterval(t);
  }, 500);
})();
