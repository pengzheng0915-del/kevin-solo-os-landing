(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3Flags = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isApprovedProductionHost(hostname) {
    return hostname === 'kevinsolo.cn'
      || hostname === 'www.kevinsolo.cn'
      || hostname === 'kevin-solo-os.pages.dev'
      || hostname.endsWith('.kevin-solo-os.pages.dev');
  }

  function getFlags(locationLike) {
    var locationValue = locationLike || {};
    var hostname = String(locationValue.hostname || '').toLowerCase();
    var port = String(locationValue.port || '');
    var search = String(locationValue.search || '');
    var isLocal = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
    var requested = /(?:^|[?&])localV3=1(?:&|$)/.test(search);
    var dedicatedReviewServer = isLocal && port === '8799';
    var productionEnabled = isApprovedProductionHost(hostname);
    var localEnabled = isLocal && (requested || dedicatedReviewServer);

    return {
      enabled: productionEnabled || localEnabled,
      aiEnabled: productionEnabled || localEnabled,
      reviewOnly: true
    };
  }

  return { getFlags: getFlags };
}));
