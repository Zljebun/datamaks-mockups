/* Datamaks demo (generator) - GDPR cookie consent + gated Google Analytics 4.
   Isti Measurement ID kao datamaks.net (GA4 razdvaja po hostname-u).
   GA se učitava tek nakon "Prihvatam". Izbor u localStorage (dm_consent).
   Izlaže window.gtag da forma može poslati event "mockup_request" pri slanju. */
(function () {
  'use strict';

  var GA_ID = 'G-4WZCVMT7W1';
  var STORE_KEY = 'dm_consent';

  var TEXT = {
    bs: { msg: 'Koristimo kolačiće za anonimnu analitiku posjeta (Google Analytics) kako bismo poboljšali alat. Učitavamo ih tek uz vaš pristanak.', accept: 'Prihvatam', reject: 'Odbijam' },
    hr: { msg: 'Koristimo kolačiće za anonimnu analitiku posjeta (Google Analytics) kako bismo poboljšali alat. Učitavamo ih tek uz vaš pristanak.', accept: 'Prihvaćam', reject: 'Odbijam' },
    sr: { msg: 'Koristimo kolačiće za anonimnu analitiku poseta (Google Analytics) kako bismo poboljšali alat. Učitavamo ih tek uz vašu saglasnost.', accept: 'Prihvatam', reject: 'Odbijam' },
    en: { msg: 'We use cookies for anonymous visit analytics (Google Analytics) to improve this tool. They load only with your consent.', accept: 'Accept', reject: 'Decline' },
    de: { msg: 'Wir verwenden Cookies für anonyme Besuchsstatistiken (Google Analytics), um dieses Tool zu verbessern. Sie werden erst mit Ihrer Zustimmung geladen.', accept: 'Akzeptieren', reject: 'Ablehnen' }
  };

  var lang = (document.documentElement.lang || 'bs').toLowerCase().slice(0, 2);
  var t = TEXT[lang] || TEXT.bs;

  function readChoice() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function saveChoice(v) { try { localStorage.setItem(STORE_KEY, v); } catch (e) {} }

  function loadGA() {
    if (window.__dmGaLoaded) return;
    window.__dmGaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;                 // izloži globalno (forma šalje event)
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function injectStyles() {
    if (document.getElementById('dm-consent-styles')) return;
    var css =
      '.dm-consent{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;' +
      'max-width:440px;background:#ffffff;color:#334155;border:1px solid #e2e8f0;' +
      'border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.18);' +
      'padding:1.1rem 1.25rem;font-family:\'Inter\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'transform:translateY(140%);transition:transform .35s ease;}' +
      '.dm-consent.is-visible{transform:translateY(0);}' +
      '.dm-consent__text{margin:0 0 .9rem;font-size:.9rem;line-height:1.5;}' +
      '.dm-consent__actions{display:flex;gap:.6rem;justify-content:flex-end;}' +
      '.dm-consent__btn{cursor:pointer;border-radius:8px;font-size:.9rem;font-weight:600;' +
      'padding:.55rem 1.1rem;border:1px solid transparent;font-family:inherit;}' +
      '.dm-consent__btn--accept{background:#1e40af;color:#fff;}' +
      '.dm-consent__btn--accept:hover{background:#1e3a8a;}' +
      '.dm-consent__btn--reject{background:transparent;color:#475569;border-color:#cbd5e1;}' +
      '.dm-consent__btn--reject:hover{background:#f1f5f9;}' +
      '@media (max-width:520px){.dm-consent{max-width:none;}}';
    var style = document.createElement('style');
    style.id = 'dm-consent-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();
    var bar = document.createElement('div');
    bar.className = 'dm-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-live', 'polite');
    bar.setAttribute('aria-label', 'Cookie consent');
    var p = document.createElement('p'); p.className = 'dm-consent__text'; p.textContent = t.msg;
    var actions = document.createElement('div'); actions.className = 'dm-consent__actions';
    var reject = document.createElement('button'); reject.type = 'button'; reject.className = 'dm-consent__btn dm-consent__btn--reject'; reject.textContent = t.reject;
    var accept = document.createElement('button'); accept.type = 'button'; accept.className = 'dm-consent__btn dm-consent__btn--accept'; accept.textContent = t.accept;
    actions.appendChild(reject); actions.appendChild(accept);
    bar.appendChild(p); bar.appendChild(actions);
    document.body.appendChild(bar);
    function dismiss() { bar.classList.remove('is-visible'); setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 350); }
    accept.addEventListener('click', function () { saveChoice('granted'); loadGA(); dismiss(); });
    reject.addEventListener('click', function () { saveChoice('denied'); dismiss(); });
    requestAnimationFrame(function () { bar.classList.add('is-visible'); });
  }

  function init() {
    var choice = readChoice();
    if (choice === 'granted') { loadGA(); return; }
    if (choice === 'denied') { return; }
    showBanner();
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
