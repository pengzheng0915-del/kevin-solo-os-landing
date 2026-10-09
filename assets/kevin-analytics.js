(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.KevinAnalytics = api.createClient(root);
    if (typeof window !== 'undefined') window.KevinAnalytics = root.KevinAnalytics;
    root._ktrack = function (eventName, meta) {
      return root.KevinAnalytics.track(eventName, meta);
    };
  } else if (root) {
    root.KevinAnalytics = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function hasPhoneLikeValue(value) {
    var candidates = String(value || '').match(/(?:\+|00)?\d[\d\s()._-]{5,}\d/g) || [];
    return candidates.some(function (candidate) {
      var digits = candidate.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    });
  }

  function containsSensitiveSource(value) {
    var text = String(value || '');
    return /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(text)
      || hasPhoneLikeValue(text)
      || /^(?=[A-HJ-NP-Z2-9]{8}$)(?=.*[2-9])[A-HJ-NP-Z2-9]{8}$/i.test(text);
  }

  function cleanSource(value) {
    var raw = String(value || '').trim();
    if (containsSensitiveSource(raw)) return '';
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  function resolveSource(search, referrer) {
    var params = new URLSearchParams(search || '');
    var explicitRaw = params.get('utm_source') || params.get('src') || '';
    if (explicitRaw) return cleanSource(explicitRaw) || 'direct';

    var host = '';
    try { host = new URL(referrer || '').hostname.toLowerCase(); } catch (error) {}
    if (!host) return 'direct';
    if (host.includes('baidu.')) return 'organic_baidu';
    if (host.includes('google.')) return 'organic_google';
    if (host.includes('bing.')) return 'organic_bing';
    if (host.includes('sogou.')) return 'organic_sogou';
    if (host.includes('so.com')) return 'organic_360';
    if (host.includes('zhihu.')) return 'referral_zhihu';
    if (host.includes('weixin.') || host.includes('wechat.')) return 'referral_wechat';
    if (host.includes('xiaohongshu.')) return 'referral_xiaohongshu';
    if (host.includes('toutiao.')) return 'referral_toutiao';
    var referral = cleanSource(host.replace(/^www\./, ''));
    return referral ? 'referral_' + referral : 'direct';
  }

  function buildPayload(options) {
    var meta = Object.assign({ landing_page: options.landingPage || options.page || '/' }, options.meta || {});
    return {
      event_type: options.eventName,
      page: options.page || '/',
      source: options.source || 'direct',
      session_id: options.sessionId || '',
      meta: meta
    };
  }

  function safeGet(storage, key) {
    try { return storage.getItem(key) || ''; } catch (error) { return ''; }
  }

  function safeSet(storage, key, value) {
    try { storage.setItem(key, value); } catch (error) {}
  }

  function makeSessionId() {
    return 'ks_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9).padEnd(4, '0');
  }

  function createClient(browserRoot) {
    var location = browserRoot.location;
    var document = browserRoot.document;
    var storage = browserRoot.sessionStorage;
    var isLocal = location.protocol === 'file:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    var source = safeGet(storage, '_ksrc');
    if (!source) {
      source = resolveSource(location.search, document.referrer);
      safeSet(storage, '_ksrc', source);
    }
    var landingPage = safeGet(storage, '_klanding');
    if (!landingPage) {
      landingPage = location.pathname || '/';
      safeSet(storage, '_klanding', landingPage);
    }
    var sessionId = safeGet(storage, '_ksite_analytics_sid');
    if (!/^ks_[a-z0-9]{6,20}_[a-z0-9]{4,16}$/.test(sessionId)) {
      sessionId = makeSessionId();
      safeSet(storage, '_ksite_analytics_sid', sessionId);
    }

    function track(eventName, meta) {
      if (!eventName || isLocal) return Promise.resolve(false);
      var payload = buildPayload({
        eventName: eventName,
        page: location.pathname || '/',
        source: source,
        sessionId: sessionId,
        landingPage: landingPage,
        meta: meta
      });
      try {
        return browserRoot.fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).then(function () { return true; }).catch(function () { return false; });
      } catch (error) {
        return Promise.resolve(false);
      }
    }

    function defaultEventForLink(link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('/fuye/quiz/') === 0) return 'click_quiz';
      if (href.indexOf('/tools/video/') === 0) return 'click_video_tool';
      if (href.indexOf('/tools/paiban/') === 0) return 'click_paiban_tool';
      if (href === '#wechat') return 'click_wechat';
      return '';
    }

    function bind() {
      document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('a,button') : null;
        if (!target) return;
        var eventName = target.getAttribute('data-track') || defaultEventForLink(target);
        if (!eventName) return;
        track(eventName, {
          label: (target.textContent || '').trim().slice(0, 120),
          href: target.getAttribute('href') || ''
        });
      });
      track('pageview', { title: document.title || '' });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
    else bind();

    return {
      source: source,
      landingPage: landingPage,
      sessionId: sessionId,
      track: track
    };
  }

  return {
    resolveSource: resolveSource,
    buildPayload: buildPayload,
    createClient: createClient
  };
});
