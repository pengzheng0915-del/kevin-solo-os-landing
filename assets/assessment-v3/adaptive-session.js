(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3AdaptiveSession = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'assessment-v3-adaptive-v1';
  /* 第 5 步真实经历减负（规格第 7 条）：
   * 不再要求用户连续回答 6 个开放题。
   * caseAvailability 是路由单选，不算"开放题"。
   * 必填 3 题 = 当时是什么问题 / 你具体做了什么 / 实际结果是什么。
   * 可选 1 题 = 适用边界或补充。
   */
  var BASE_QUESTION_IDS = ['caseAvailability'];
  var REQUIRED_CASE_QUESTION_IDS = ['caseOneProblem', 'caseOneAction', 'caseOneResult'];
  var OPTIONAL_CASE_QUESTION_IDS = ['caseBoundaryTransfer'];
  var CASE_QUESTION_IDS = REQUIRED_CASE_QUESTION_IDS.concat(OPTIONAL_CASE_QUESTION_IDS);
  var EVENT_NAMES = Object.freeze([
    'adaptive_deep_started',
    'adaptive_deep_completed',
    'open_answers_started',
    'open_answers_completed',
    'follow_up_shown',
    'follow_up_completed',
    'draft_recovered',
    'flow_exited',
    'report_ready',
    'report_limited',
    'report_retryable_error'
  ]);
  var EVENT_NAME_SET = new Set(EVENT_NAMES);
  var EVENT_FIELDS = Object.freeze(['event', 'route', 'stepIndex', 'durationBucket', 'viewportBucket', 'timestamp']);
  var EVENT_FIELD_SET = new Set(EVENT_FIELDS);
  var ROUTE_SET = new Set(['has_case', 'nearest_incident', 'no_case', 'unselected', 'legacy', 'unknown']);
  var DURATION_BUCKET_SET = new Set(['<1m', '1-3m', '3-7m', '7-12m', '12m+', 'unknown']);
  var VIEWPORT_BUCKET_SET = new Set(['mobile', 'tablet', 'desktop', 'unknown']);
  var MAX_LOCAL_EVENTS = 100;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function routeQuestions(route) {
    if (route === 'no_case' || route === 'nearest_incident') {
      return BASE_QUESTION_IDS.concat(['nearestIncident']);
    }
    if (route === 'has_case') return BASE_QUESTION_IDS.concat(CASE_QUESTION_IDS);
    return BASE_QUESTION_IDS.slice();
  }

  function createSession(input) {
    var value = input || {};
    return {
      version: VERSION,
      sessionId: String(value.sessionId || ''),
      questionIds: BASE_QUESTION_IDS.slice(),
      currentIndex: 0,
      answers: {},
      completed: false,
      updatedAt: new Date(0).toISOString()
    };
  }

  function currentQuestionId(session) {
    if (!session || session.completed) return null;
    return session.questionIds[session.currentIndex] || null;
  }

  function advance(session, answer) {
    var next = clone(session);
    var expectedId = currentQuestionId(next);
    var id = String(answer && answer.id || '');
    if (!expectedId || id !== expectedId) throw new Error('answer does not match the current question');
    next.answers[id] = String(answer && answer.value == null ? '' : answer.value).trim();

    if (id === 'caseAvailability') {
      next.questionIds = routeQuestions(next.answers.caseAvailability);
      Object.keys(next.answers).forEach(function (key) {
        if (next.questionIds.indexOf(key) === -1) delete next.answers[key];
      });
    }

    if (next.currentIndex >= next.questionIds.length - 1) {
      next.completed = true;
    } else {
      next.currentIndex += 1;
    }
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function goBack(session) {
    var next = clone(session);
    next.completed = false;
    next.currentIndex = Math.max(0, next.currentIndex - 1);
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function reopenSession(session) {
    var next = clone(session);
    next.completed = false;
    next.currentIndex = 0;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function storageKey(sessionId) {
    return 'kevin:assessment-v3:adaptive:' + String(sessionId || 'anonymous');
  }

  function saveSession(storage, key, session) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(key, JSON.stringify(session));
    return true;
  }

  function restoreSession(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    var raw = storage.getItem(key);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.questionIds)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function clearSession(storage, key) {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    storage.removeItem(key);
    return true;
  }

  function eventStorageKey(sessionId) {
    return 'kevin:assessment-v3:events:' + String(sessionId || 'anonymous');
  }

  function readEvents(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    var raw = storage.getItem(key);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-MAX_LOCAL_EVENTS) : [];
    } catch (error) {
      return [];
    }
  }

  function validTimestamp(value) {
    return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value));
  }

  function recordEvent(storage, key, input) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    var value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    var keys = Object.keys(value);
    if (keys.some(function (field) { return !EVENT_FIELD_SET.has(field); })) return false;
    if (!EVENT_NAME_SET.has(value.event)) return false;
    if (!ROUTE_SET.has(value.route)) return false;
    if (!Number.isInteger(value.stepIndex) || value.stepIndex < 0) return false;
    if (!DURATION_BUCKET_SET.has(value.durationBucket)) return false;
    if (!VIEWPORT_BUCKET_SET.has(value.viewportBucket)) return false;
    if (!validTimestamp(value.timestamp)) return false;

    var events = readEvents(storage, key);
    events.push({
      event: value.event,
      route: value.route,
      stepIndex: value.stepIndex,
      durationBucket: value.durationBucket,
      viewportBucket: value.viewportBucket,
      timestamp: value.timestamp
    });
    storage.setItem(key, JSON.stringify(events.slice(-MAX_LOCAL_EVENTS)));
    return true;
  }

  return {
    VERSION: VERSION,
    EVENT_NAMES: EVENT_NAMES,
    requiredCaseQuestionIds: REQUIRED_CASE_QUESTION_IDS.slice(),
    optionalCaseQuestionIds: OPTIONAL_CASE_QUESTION_IDS.slice(),
    routeQuestions: routeQuestions,
    createSession: createSession,
    currentQuestionId: currentQuestionId,
    advance: advance,
    goBack: goBack,
    reopenSession: reopenSession,
    storageKey: storageKey,
    saveSession: saveSession,
    restoreSession: restoreSession,
    clearSession: clearSession,
    eventStorageKey: eventStorageKey,
    readEvents: readEvents,
    recordEvent: recordEvent
  };
}));
