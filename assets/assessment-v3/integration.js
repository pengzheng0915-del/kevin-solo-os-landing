(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3Integration = api;
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var REQUEST_TIMEOUT_MS = 300000;
  var FLOW_VERSION = 'assessment-v3-adaptive-v1';
  var MAX_FOLLOW_UP_ROUNDS = 1;
  var MAX_FOLLOW_UP_QUESTIONS = 2;
  var LEGACY_FALLBACK_MESSAGE = '测评摘要暂时没有生成成功。已填写内容仍保留，请稍后重试。';
  var CORE_KEYS = [
    'decision', 'caseOneProblem', 'caseOneAction',
    'caseOneResult', 'caseBoundaryTransfer', 'nearestIncident'
  ];
  /* 第 5 步真实经历（规格第 7 条减负）：
   * 必填 3 题 = 当时是什么问题 / 你具体做了什么 / 实际结果是什么。
   * 可选 1 题 = 适用边界或补充。留空按"诚实跳过"落库，不阻塞生成摘要。 */
  var REQUIRED_OPEN_IDS = ['caseOneProblem', 'caseOneAction', 'caseOneResult'];
  var OPTIONAL_OPEN_IDS = ['caseBoundaryTransfer', 'decision', 'nearestIncident'];
  var SCREENING_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', 'typeKey', 'score', 'axisScores', 'decisionType', 'realityState'];
  var BRANCH_KEYS = [
    'industry', 'years', 'status', 'hours', 'friends', 'otherFans', 'hourlyRate', 'confidence',
    'pastTry', 'pastResult', 'bottleneck', 'problemSpecificity', 'caseCount', 'assetFormat',
    'evidenceQuality', 'consultedBefore', 'paidBefore', 'audienceAccess', 'deliveryPreference',
    'validationCommitment', 'helpRequests', 'caseTwo', 'repeatPayment', 'decisionAuthority', 'timeAvailable',
    'problemSpecificity', 'caseCountDetailed', 'evidenceType', 'costWillingnessSignal',
    'deliverableReadiness', 'organizationComplexity', 'serviceDataReadiness', 'consumerAnxiety',
    'sensitive.qualification'
  ];
  var DIAGNOSTIC_KEYS = ['diagnosticStatus', 'lowestDimension', 'organizationComplexity', 'serviceDataReadiness', 'consumerAnxiety', 'sensitiveDomain', 'candidatePaths'];

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function canSubmitFollowUp(followUpRound) {
    return Number(followUpRound) <= MAX_FOLLOW_UP_ROUNDS;
  }

  function cleanText(value, limit) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, limit || 1400);
  }

  function durationBucket(startedAt, nowValue) {
    var start = Number(startedAt);
    var now = Number(nowValue);
    if (!Number.isFinite(start) || !Number.isFinite(now) || now < start) return 'unknown';
    var elapsed = now - start;
    if (elapsed < 60000) return '<1m';
    if (elapsed < 180000) return '1-3m';
    if (elapsed < 420000) return '3-7m';
    if (elapsed < 720000) return '7-12m';
    return '12m+';
  }

  function viewportBucket(windowValue) {
    var width = Number(windowValue && windowValue.innerWidth);
    if (!Number.isFinite(width) || width <= 0) return 'unknown';
    if (width <= 640) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  function buildLocalEvent(windowValue, state, eventName, nowValue) {
    var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    var startedAt = Number.isFinite(Number(state && state.flowStartedAt)) ? Number(state.flowStartedAt) : now;
    var route = cleanText(state && state.answers && state.answers.caseAvailability, 30);
    if (['has_case', 'nearest_incident', 'no_case'].indexOf(route) === -1) route = 'unselected';
    var stepIndex = Number(state && state.adaptiveSession && state.adaptiveSession.currentIndex);
    return {
      event: eventName,
      route: route,
      stepIndex: Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : 0,
      durationBucket: durationBucket(startedAt, now),
      viewportBucket: viewportBucket(windowValue),
      timestamp: new Date(now).toISOString()
    };
  }

  function chineseCharacterCount(value) {
    return (String(value || '').match(/[\u3400-\u9fff]/g) || []).length;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function detectTextPii(value) {
    var text = String(value || '');
    var types = [];
    function found(type, expression) {
      if (expression.test(text) && types.indexOf(type) === -1) types.push(type);
    }
    found('手机号', /(?:\+?86[\s-]*)?1[3-9](?:[\s-]*\d){9}/);
    found('邮箱', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    found('微信号', /(?:微信|wechat|wx)\s*(?:号|id)?\s*(?:[:：]\s*)?[A-Z0-9_-]{5,}/i);
    found('姓名', /(?:姓名|真实姓名|联系人(?:姓名)?|名字)\s*[:：]\s*[\u3400-\u9fff]{2,4}/);
    found('身份证号', /\d{17}[\dXx]/);
    found('密码', /(?:密码|password|pwd)\s*[:：]\s*\S+/i);
    return types;
  }

  function getQuestionApi() {
    if (root && root.KevinAssessmentV3Questions) return root.KevinAssessmentV3Questions;
    if (typeof require === 'function') return require('./questions.js');
    return null;
  }

  function getSessionApi() {
    if (root && root.KevinAssessmentV3AdaptiveSession) return root.KevinAssessmentV3AdaptiveSession;
    if (typeof require === 'function') return require('./adaptive-session.js');
    return null;
  }

  function classifyAnswer(value) {
    var api = getQuestionApi();
    if (api && typeof api.classifyAnswer === 'function') return api.classifyAnswer(value);
    return cleanText(value) ? 'answered' : 'missing';
  }

  function hasUsefulManualEvidence(answers) {
    return CORE_KEYS.some(function (key) {
      return classifyAnswer(answers && answers[key]) === 'answered';
    });
  }

  function validateOpenAnswers(answers, context) {
    var value = answers || {};
    var errors = {};
    var route = cleanText(value.caseAvailability || context && context.caseAvailability);
    if (['has_case', 'nearest_incident', 'no_case'].indexOf(route) === -1) {
      errors.caseAvailability = '请选择最接近你当前真实情况的一项。';
      route = 'has_case';
    }
    return errors;
  }

  function validateLocalSubmission(answers, context) {
    return validateOpenAnswers(answers, context);
  }

  function detectObviousPii(answers) {
    var findings = [];
    Object.keys(answers || {}).forEach(function (key) {
      detectTextPii(answers[key]).forEach(function (type) {
        findings.push({ field: key, type: type });
      });
    });
    return findings;
  }

  function safeValue(value) {
    if (typeof value === 'string') {
      var text = cleanText(value);
      return detectTextPii(text).length ? '' : text;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return value;
    return undefined;
  }

  function copyAllowlist(source, keys) {
    var copy = {};
    keys.forEach(function (key) {
      if (!own(source, key)) return;
      if (key === 'axisScores' && source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        var scores = {};
        Object.keys(source[key]).forEach(function (scoreKey) {
          var score = safeValue(source[key][scoreKey]);
          if (typeof score === 'number') scores[scoreKey] = score;
        });
        copy[key] = scores;
        return;
      }
      var item = safeValue(source[key]);
      if (item !== undefined) copy[key] = item;
    });
    return copy;
  }

  function resolveDeepData(windowValue) {
    var source = windowValue || {};
    if (typeof source.getAssessmentDeepData === 'function') {
      try {
        var exposed = source.getAssessmentDeepData();
        if (exposed && typeof exposed === 'object' && !Array.isArray(exposed)) return exposed;
      } catch (error) {}
    }
    return source.deepData && typeof source.deepData === 'object' && !Array.isArray(source.deepData)
      ? source.deepData
      : {};
  }

  function resolveQuizAnswers(windowValue) {
    var source = windowValue || {};
    if (typeof source.getAssessmentQuizAnswers === 'function') {
      try {
        var exposed = source.getAssessmentQuizAnswers();
        if (exposed && typeof exposed === 'object' && !Array.isArray(exposed)) return exposed;
      } catch (error) {}
    }
    return source.quizAnswers && typeof source.quizAnswers === 'object' && !Array.isArray(source.quizAnswers)
      ? source.quizAnswers
      : {};
  }

  function copyFollowUpAnswers(source) {
    var copy = {};
    Object.keys(source || {}).forEach(function (key) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) return;
      var item = safeValue(source[key]);
      if (typeof item === 'string' && item) copy[key] = item;
    });
    return copy;
  }

  function copyDiagnosticContext(source) {
    var value = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    var copy = copyAllowlist(value, DIAGNOSTIC_KEYS);
    if (typeof copy.diagnosticStatus !== 'string') copy.diagnosticStatus = '';
    if (typeof copy.lowestDimension !== 'string') copy.lowestDimension = '';
    var readiness = value.caseReadiness && typeof value.caseReadiness === 'object' && !Array.isArray(value.caseReadiness)
      ? value.caseReadiness
      : {};
    var level = safeValue(readiness.level);
    copy.caseReadiness = { level: typeof level === 'string' ? level : '' };
    return copy;
  }

  function copyRuleResult(source) {
    var rules = source || {};
    var judgement = rules.primaryJudgement || {};
    function cleanStrings(values) {
      return Array.isArray(values) ? values.filter(function (item) {
        return typeof item === 'string' && item.trim();
      }).map(function (item) { return cleanText(item, 600); }).slice(0, 30) : [];
    }
    return {
      primaryJudgement: {
        statement: cleanText(judgement.statement, 600),
        confidence: ['low', 'medium', 'high'].indexOf(judgement.confidence) === -1 ? 'low' : judgement.confidence,
        evidenceIds: Array.isArray(judgement.evidenceIds) ? judgement.evidenceIds.filter(function (id) {
          return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
        }).slice(0, 30) : []
      },
      prohibitedConclusions: cleanStrings(rules.prohibitedConclusions),
      reviewRequired: rules.reviewRequired === true,
      reviewReasons: cleanStrings(rules.reviewReasons)
    };
  }

  function buildAnonymousPayload(input) {
    var value = input || {};
    var rawCoreAnswers = value.openAnswers || value.coreAnswers || {};
    var coreAnswers = copyAllowlist(rawCoreAnswers, CORE_KEYS);
    var questionnaireRevision = value.questionnaireRevision === 'paid-evidence-v1' || value.questionnaireRevision === 'paid-evidence-v2'
      ? value.questionnaireRevision
      : '';
    var screening = value.quizAnswers || value.screeningAnswers || {};
    if (screening['5'] === 'E' && !cleanText(coreAnswers.decision)) {
      coreAnswers.decision = '我当前暂不产品化，希望先处理主业或职业方向。';
    }
    var caseAvailability = cleanText(value.caseAvailability || rawCoreAnswers.caseAvailability);
    if (['has_case', 'nearest_incident', 'no_case'].indexOf(caseAvailability) === -1) {
      caseAvailability = questionnaireRevision === 'paid-evidence-v2' ? '' : 'has_case';
    }
    var rawRound = Number.isInteger(value.followUpRound)
      ? value.followUpRound
      : (Number(value.followUpCount) > 0 ? 1 : 0);
    var output = {
      session_id: cleanText(value.session_id || value.sessionId, 160),
      version: FLOW_VERSION,
      caseAvailability: caseAvailability,
      screeningAnswers: copyAllowlist(value.quizAnswers || value.screeningAnswers || {}, SCREENING_KEYS),
      coreAnswers: coreAnswers,
      branchAnswers: copyAllowlist(value.deepData || value.branchAnswers || {}, BRANCH_KEYS),
      diagnosticContext: copyDiagnosticContext(value.diagnosticContext),
      followUpAnswers: copyFollowUpAnswers(value.followUpAnswers),
      followUpRound: Math.max(0, Math.min(MAX_FOLLOW_UP_ROUNDS, rawRound)),
      kevinRuleResult: copyRuleResult(value.kevinRuleResult)
    };
    if (questionnaireRevision) output.questionnaireRevision = questionnaireRevision;
    return output;
  }

  function runAfterLegacy(options) {
    var value = options || {};
    return Promise.resolve().then(function () {
      return value.legacyGenerate();
    }).then(function (legacyResult) {
      if (legacyResult && legacyResult.success === false) return legacyResult;
      var sessionId = typeof value.getSessionId === 'function' ? value.getSessionId() : '';
      if (!sessionId) {
        var fallback = { kind: 'legacy_fallback', message: LEGACY_FALLBACK_MESSAGE };
        if (typeof value.onLegacyFallback === 'function') value.onLegacyFallback(fallback);
        return fallback;
      }
      return value.requestV3(sessionId);
    });
  }

  function getCustomerState(response) {
    var state = response && (response.state || response.status);
    if (state === 'analyzing') return 'analyzing';
    if (state === 'needs_follow_up') return 'needs_follow_up';
    if (state === 'limited') return 'limited';
    if (state === 'ready') return 'ready';
    if (state === 'review_required') return 'review_required';
    return 'retry_available';
  }

  function candidateHeading(response) {
    var customerState = getCustomerState(response);
    if (customerState === 'retry_available') return '测评摘要暂时未生成';
    if (customerState === 'analyzing') return '正在生成你的测评摘要';
    if (customerState === 'needs_follow_up') return '再补充一两点，会更准确';
    return '你的测评摘要';
  }

  function candidateStatusLabel(customerState) {
    var labels = {
      analyzing: '请稍候',
      needs_follow_up: '可继续补充',
      limited: '测评摘要',
      ready: '测评摘要',
      review_required: '测评摘要',
      retry_available: '请稍后重试'
    };
    return labels[customerState] || labels.retry_available;
  }

  function normalizeStoredAssessment(value) {
    if (!value || typeof value !== 'object') return null;
    var report = value.report || value.report_candidate;
    var caseEvidenceCard = value.caseEvidenceCard || value.case_evidence_card || null;
    if (!report && value.status !== 'needs_follow_up') return null;
    return {
      session_id: cleanText(value.session_id, 160),
      status: cleanText(value.status, 80),
      state: cleanText(value.state || value.status, 80),
      report: report || {},
      caseEvidenceCard: caseEvidenceCard,
      inputSummary: value.inputSummary || value.input_summary || null,
      followups: Array.isArray(value.followups) ? value.followups : [],
      followUpRound: Number.isInteger(value.followUpRound) ? value.followUpRound : 0
    };
  }

  function loadExistingAssessment(windowValue, sessionId) {
    var sid = cleanText(sessionId, 160);
    if (!sid || !windowValue || typeof windowValue.fetch !== 'function') return Promise.resolve(null);
    var url = '/api/getAssessmentV3?sid=' + encodeURIComponent(sid) + '&view=customer';
    return windowValue.fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (response) {
      if (!response || !response.ok) return null;
      return response.json().then(normalizeStoredAssessment).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function formatCandidateForDisplay(report) {
    var value = report || {};
    var summary = escapeHtml(value.summary || value.overview || value.primaryJudgement || '');
    var items = Array.isArray(value.items) ? value.items : [];
    var html = '<section class="v3-candidate-copy"><p>' + summary + '</p>';
    items.forEach(function (item) {
      html += '<article><h4>' + escapeHtml(item && (item.title || item.label || '')) + '</h4><p>'
        + escapeHtml(item && (item.body || item.text || '')) + '</p></article>';
    });
    return html + '</section>';
  }

  function summarizeCustomerBoundaries(limitations, uncertainty) {
    var values = (Array.isArray(limitations) ? limitations : []).concat(
      Array.isArray(uncertainty) ? uncertainty : []
    ).map(function (item) {
      return cleanText(item, 1200)
        .replace(/^(?:判断边界|仍需核对)[：:\s]*/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }).filter(Boolean);
    var source = values.join('；');
    var result = [];

    function add(line) {
      var value = cleanText(line, 600);
      if (!value || result.indexOf(value) !== -1 || result.length >= 4) return;
      result.push(value);
    }

    if (/单案例|第二个.{0,8}案例|相似案例|反例|其他场景|稳定复现|可迁移|迁移/.test(source)) {
      add('这仍是一段单案例材料，能否在其他团队或场景稳定复现，还需要第二个独立案例或外部结果验证。');
    }

    var demand = values.find(function (item) {
      return /付费|购买|市场需求|外部需求|价格敏感|投入时间/.test(item);
    });
    if (demand) {
      add('仍需验证：' + demand.replace(/[？?。]+$/, '') + '。');
    }

    var detailLabels = [];
    function addDetail(label) {
      if (detailLabels.indexOf(label) === -1 && detailLabels.length < 3) detailLabels.push(label);
    }
    if (/项目规模|行业|客户名称/.test(source)) addDetail('项目规模和行业');
    if (/投诉|结果数据|具体数据|表单记录|外部记录/.test(source)) addDetail('结果数据或外部记录');
    if (/核对内容|清单细节|访谈提纲|服务流程|服务步骤/.test(source)) addDetail('具体服务步骤');
    if (/长期积累|经验内容|具体时长/.test(source)) addDetail('经验内容');
    if (/目标.{0,6}(团队|客户)|客户范围/.test(source)) addDetail('目标客户范围');
    if (detailLabels.length) {
      add('还需要补充' + detailLabels.join('、') + '等关键信息，当前结论只适合作为小范围验证依据。');
    }

    if (/组织决策|战略决策|替.{0,6}决策|承诺.{0,6}收益/.test(source)) {
      add('涉及组织决策时，这份报告只判断验证路径，不替团队作战略承诺或收益保证。');
    }

    if (result.length < 4 && /标准化|个人判断/.test(source)) {
      add('还需要区分哪些部分可以标准化，哪些部分仍依赖你的个人判断。');
    }

    values.forEach(function (item) {
      if (result.length >= 4) return;
      var normalized = item.replace(/[？?]+$/, '').trim();
      if (!normalized) return;
      var duplicated = result.some(function (line) {
        return line.indexOf(normalized) !== -1 || normalized.indexOf(line.replace(/[。]+$/, '')) !== -1;
      });
      if (!duplicated) add('还需要确认：' + normalized.replace(/[。]+$/, '') + '。');
    });
    return result;
  }

  function candidateSections(report) {
    var value = report || {};
    var sections = [];
    function add(title, role, lines, fallback) {
      var cleaned = (Array.isArray(lines) ? lines : []).map(function (line) {
        return cleanText(line, 1200);
      }).filter(Boolean).slice(0, 3);
      sections.push({ title: title, role: role, lines: cleaned.length ? cleaned : [fallback] });
    }
    var judgement = value.primaryJudgement || {};
    add('核心判断', 'core', [judgement.text].concat(summarizeCustomerBoundaries(
      judgement.limitations,
      value.uncertainty
    ).slice(0, 2)),
    '现有信息不足以支持完整判断，本报告只保留当前能够成立的结论。');
    add('判断依据', 'evidence', (value.understoodFacts || []).map(function (item) { return item && item.text; }),
      '暂时没有足够具体的事实可作为判断依据。');
    var pathLabels = { priority: '优先考虑', test: '先验证', defer: '暂缓', avoid: '暂时不要做' };
    add('路径排序', 'paths', (value.pathComparison || []).map(function (item) {
      if (!item) return '';
      var label = pathLabels[item.status] || '待判断';
      return cleanText(item.path, 300) + '｜' + label + (item.reason ? '。' + cleanText(item.reason, 800) : '');
    }), '先补充一段真实经历，再决定优先路径。');
    add('7 天行动', 'action', (value.sevenDayAction || []).map(function (item) {
      if (!item) return '';
      var prefix = item.dayRange ? cleanText(item.dayRange, 80) + '：' : '';
      var signal = item.successSignal ? ' 判断信号：' + cleanText(item.successSignal, 500) : '';
      return prefix + cleanText(item.action, 800) + signal;
    }), '选择最近发生的一件具体事情，写清问题、你的动作和实际结果。');
    add('暂时不要做', 'avoid', (value.doNotDo || []).map(function (item) { return item && item.text; }),
      '暂时不要仅凭想法扩大投入或作出高成本决定。');
    return sections;
  }

  function caseCardSections(card) {
    var value = card || {};
    var sections = [];
    function add(title, lines) {
      var cleaned = (Array.isArray(lines) ? lines : []).map(function (line) {
        return cleanText(line, 1400);
      }).filter(Boolean);
      if (cleaned.length) sections.push({ title: title, lines: cleaned });
    }
    add('这段真实经历', [
      value.title ? '案例主题：' + value.title : '',
      value.context ? '发生场景：' + value.context : '',
      value.problem ? '需要解决：' + value.problem : '',
      value.goalAndConstraints ? '目标与限制：' + value.goalAndConstraints : '',
      value.alternativesAndJudgement ? '当时的选择与判断：' + value.alternativesAndJudgement : '',
      value.actions ? '亲自采取的动作：' + value.actions : '',
      value.result ? '实际结果：' + value.result : '',
      value.externalSignals ? '外部投入与反馈：' + value.externalSignals : ''
    ]);
    add('本次判断采用的事实陈述', (Array.isArray(value.facts) ? value.facts : []).filter(function (item) {
      return item && item.accepted === true && item.sourceQuote;
    }).map(function (item) { return item.sourceQuote; }));
    add('当前解释', [value.interpretation && value.interpretation.text]);
    add('仍待验证', (Array.isArray(value.hypotheses) ? value.hypotheses : []).map(function (item) {
      return item && item.text;
    }).concat((Array.isArray(value.limitations) ? value.limitations : []).map(function (item) {
      return '仍需核对：' + item;
    })));
    add('适用边界与下一步', [
      value.boundaryAndTransfer ? '适用与失效条件：' + value.boundaryAndTransfer : ''
    ].concat(Array.isArray(value.doNotInfer) ? value.doNotInfer : []).concat([
      value.nextAction ? '下一步：' + value.nextAction : ''
    ]));
    return sections;
  }

  function candidatePresentation(response) {
    var value = response || {};
    var customerState = getCustomerState(value);
    var evidenceSections = [];
    var shouldDeliverReport = ['limited', 'ready', 'review_required'].indexOf(customerState) !== -1;
    return {
      customerState: customerState,
      sections: [],
      freeSummary: shouldDeliverReport ? buildFreeSummary(value.report || {}) : null,
      evidenceSections: evidenceSections,
      showEvidenceDisclosure: false,
      inputNotice: customerInputNotice(customerState, value.inputSummary || value.input_summary),
      boundaryNote: ''
    };
  }

  function buildFreeSummary(report) {
    var value = report || {};
    var judgement = value.primaryJudgement || {};
    var firstPath = Array.isArray(value.pathComparison) ? value.pathComparison.filter(Boolean)[0] : null;
    var firstAction = Array.isArray(value.sevenDayAction) ? value.sevenDayAction.filter(Boolean)[0] : null;
    var limitations = Array.isArray(judgement.limitations) ? judgement.limitations.filter(Boolean) : [];
    return {
      conclusion: cleanText(judgement.text || value.summary || value.overview, 1200)
        || '先用一个具体问题完成一次低成本验证。',
      bottleneck: cleanText(value.currentBottleneck || value.bottleneck || (firstPath && firstPath.reason) || limitations[0], 1200)
        || '这一项需要你补充真实经历后再判断。',
      action: cleanText(firstAction && firstAction.action, 1200)
        || '未来 7 天找 3 位目标用户确认一个具体问题。',
      unlockItems: ['判断依据', '路径取舍', '风险边界', '验证动作']
    };
  }

  function validateFollowUpAnswers(questions, answers) {
    var errors = {};
    (Array.isArray(questions) ? questions : []).forEach(function (question) {
      if (!question || !question.id) return;
      if (!cleanText(answers && answers[question.id])) {
        errors[question.id] = '请如实补充这一项；没有或无法核对也可以直接写明。';
      }
    });
    return errors;
  }

  function normalizeFollowUpAnswers(questions, answers) {
    var normalized = {};
    (Array.isArray(questions) ? questions : []).forEach(function (question) {
      if (!question || !question.id) return;
      normalized[question.id] = cleanText(answers && answers[question.id], 1400)
        || '目前没有可补充的真实事实。';
    });
    return normalized;
  }

  function customerInputNotice(customerState, inputSummary) {
    return '';
  }

  function createElement(documentValue, tag, className, text) {
    var element = documentValue.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function ensureCustomerReportStyles(documentValue) {
    if (!documentValue || typeof documentValue.createElement !== 'function') return null;
    var existing = documentValue.getElementById('v3-customer-report-styles');
    if (existing) return existing;
    if (!documentValue.head || typeof documentValue.head.appendChild !== 'function') return null;
    var link = documentValue.createElement('link');
    link.id = 'v3-customer-report-styles';
    link.rel = 'stylesheet';
    link.href = '/assets/assessment-v3/report.css?v=20260724b';
    documentValue.head.appendChild(link);
    return link;
  }

  function addStatus(state, message, kind) {
    if (!state.statusNode) return;
    state.statusNode.className = 'field-hint v3-status' + (kind ? ' ' + kind : '');
    state.statusNode.textContent = message || '';
  }

  function countAnsweredLeaves(value) {
    if (Array.isArray(value)) {
      return value.reduce(function (total, item) { return total + countAnsweredLeaves(item); }, 0);
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce(function (total, key) {
        return total + countAnsweredLeaves(value[key]);
      }, 0);
    }
    return value !== undefined && value !== null && String(value).trim() ? 1 : 0;
  }

  function generationFacts(state) {
    return { deepAnswerCount: countAnsweredLeaves(state && state.answers) };
  }

  function refreshOpenErrors(state) {
    return validateLocalSubmission(state.answers, { caseAvailability: state.answers.caseAvailability });
  }

  function questionDefinition(id) {
    if (id === 'caseAvailability') {
      return {
        id: id,
        label: '你现在能拿出哪一种真实经历？',
        help: '选择最接近当前事实的一项。没有完整案例也可以继续。'
      };
    }
    var api = getQuestionApi();
    var questions = api && api.adaptiveOpenQuestions || [];
    return questions.filter(function (item) { return item.id === id; })[0] || {
      id: id,
      label: '请补充这项真实情况。',
      help: '按当前事实回答即可。'
    };
  }

  function honestAbsenceAnswer(questionId) {
    var values = {
      decision: '目前还没有明确要判断的问题。',
      caseOneProblem: '目前没有能够还原的具体问题。',
      caseOneAction: '目前没有能够确认是本人完成的关键动作。',
      caseOneResult: '目前没有可核对的结果或外部反馈。',
      caseBoundaryTransfer: '目前还不清楚适用边界，需要继续验证。',
      nearestIncident: '目前想不到接近的真实小事。'
    };
    return values[questionId] || '目前没有可补充的真实内容。';
  }

  function normalizeOptionalAnswer(questionId, value) {
    return cleanText(value, 1400) || honestAbsenceAnswer(questionId);
  }

  function appendRecallGuidance(documentValue, card, windowValue, state) {
    var api = getQuestionApi();
    var options = api && typeof api.getRecallOptions === 'function' ? api.getRecallOptions() : [];
    if (!options.length) return;

    var intro = createElement(
      documentValue,
      'p',
      'v3-guidance-intro',
      '这不是考试，也不要求写得漂亮。按你当前能确认的事实填写即可；暂时想不到可以直接跳过。'
    );
    card.appendChild(intro);
    card.appendChild(createElement(documentValue, 'p', 'v3-recall-label', '先选一个最容易让你想起真实经历的入口：'));
    var optionRow = createElement(documentValue, 'div', 'v3-recall-options');
    options.forEach(function (option) {
      var button = createElement(documentValue, 'button', 'v3-recall-option', option.label);
      button.type = 'button';
      button.setAttribute('aria-pressed', state.recallCue === option.id ? 'true' : 'false');
      button.addEventListener('click', function () {
        state.recallCue = option.id;
        Array.prototype.forEach.call(optionRow.querySelectorAll('button'), function (node) {
          node.setAttribute('aria-pressed', node === button ? 'true' : 'false');
        });
      });
      optionRow.appendChild(button);
    });
    card.appendChild(optionRow);
  }

  function appendQuestionGuidance(documentValue, card, definition) {
    if (definition.sentenceStarter) {
      card.appendChild(createElement(
        documentValue,
        'p',
        'v3-sentence-starter',
        '可以接着这句话写：' + cleanText(definition.sentenceStarter, 240)
      ));
    }
    if (Array.isArray(definition.factChecks) && definition.factChecks.length) {
      var checks = createElement(documentValue, 'ul', 'v3-fact-checks');
      definition.factChecks.forEach(function (label) {
        checks.appendChild(createElement(documentValue, 'li', '', cleanText(label, 80)));
      });
      card.appendChild(checks);
    }
  }

  function draftSessionId(windowValue) {
    if (windowValue.reportSessionId) return windowValue.reportSessionId;
    var match = String(windowValue.location && windowValue.location.search || '').match(/[?&]sid=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : 'local-draft';
  }

  function saveAdaptiveDraft(windowValue, state) {
    if (state.paidFlow) { if (state.scheduleSave) state.scheduleSave(); return; }
    var api = getSessionApi();
    if (!api || !state.adaptiveSession || !state.draftKey) return;
    try { api.saveSession(windowValue.localStorage, state.draftKey, state.adaptiveSession); } catch (error) {}
  }

  function clearAdaptiveDraft(windowValue, state) {
    var api = getSessionApi();
    if (!api || !state.draftKey) return;
    try { api.clearSession(windowValue.localStorage, state.draftKey); } catch (error) {}
  }

  function alignAdaptiveDraftWithReportSession(windowValue, state) {
    var api = getSessionApi();
    var sessionId = cleanText(windowValue && windowValue.reportSessionId, 160);
    if (!api || !sessionId) return false;
    var preservedAnswers = Object.assign({}, state.answers || {});
    var session = ensureAdaptiveSession(windowValue, state);
    if (!session) return false;
    var previousKey = state.draftKey;
    var nextKey = api.storageKey(sessionId);
    session.sessionId = sessionId;
    session.answers = Object.assign(
      {},
      session.answers || {},
      preservedAnswers
    );
    state.adaptiveSession = session;
    state.answers = Object.assign({}, session.answers);
    try {
      api.saveSession(windowValue.localStorage, nextKey, session);
      state.draftKey = nextKey;
      if (previousKey && previousKey !== nextKey) {
        api.clearSession(windowValue.localStorage, previousKey);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function recordLocalEvent(windowValue, state, eventName) {
    var api = getSessionApi();
    if (!api || typeof api.recordEvent !== 'function') return false;
    state.recordedEvents = state.recordedEvents || {};
    if (state.recordedEvents[eventName]) return false;
    if (!state.eventKey && typeof api.eventStorageKey === 'function') {
      state.eventKey = api.eventStorageKey(draftSessionId(windowValue));
    }
    try {
      var recorded = api.recordEvent(
        windowValue.localStorage,
        state.eventKey,
        buildLocalEvent(windowValue, state, eventName)
      );
      if (recorded) state.recordedEvents[eventName] = true;
      return recorded;
    } catch (error) {
      return false;
    }
  }

  function ensureAdaptiveSession(windowValue, state) {
    var api = getSessionApi();
    if (!api) return null;
    if (!state.draftKey) state.draftKey = api.storageKey(draftSessionId(windowValue));
    if (!state.adaptiveSession) {
      var restored = null;
      try { restored = api.restoreSession(windowValue.localStorage, state.draftKey); } catch (error) {}
      state.adaptiveSession = restored || api.createSession({ sessionId: draftSessionId(windowValue) });
      if (restored) recordLocalEvent(windowValue, state, 'draft_recovered');
    }
    state.answers = Object.assign({}, state.adaptiveSession.answers || {});
    return state.adaptiveSession;
  }

  function adaptiveStage(questionId, completed) {
    if (completed) return 3;
    return questionId === 'caseAvailability' ? 1 : 2;
  }

  function appendAdaptiveStages(documentValue, section, stage) {
    var labels = ['选择判断', '真实经历', '查看结果'];
    var row = createElement(documentValue, 'div', 'v3-adaptive-stages');
    labels.forEach(function (label, index) {
      var item = createElement(documentValue, 'span', index + 1 < stage ? 'done' : (index + 1 === stage ? 'active' : ''), label);
      row.appendChild(item);
    });
    section.appendChild(row);
  }

  function renderAdaptiveQuestion(windowValue, state, section, submitRow) {
    var api = getSessionApi();
    var documentValue = windowValue.document;
    var session = ensureAdaptiveSession(windowValue, state);
    if (!api || !session) return false;
    section.innerHTML = '';
    var questionId = api.currentQuestionId(session);
    appendAdaptiveStages(documentValue, section, adaptiveStage(questionId, session.completed));

    var submitButton = submitRow.matches && submitRow.matches('button')
      ? submitRow
      : submitRow.querySelector('button');
    var submitHint = submitRow.querySelector ? submitRow.querySelector('.field-hint') : null;
    if (submitHint) submitHint.textContent = '';
    if (submitButton) {
      submitButton.textContent = state.paidFlow ? '保存深度测评' : '生成我的测评摘要';
      submitButton.style.display = session.completed ? '' : 'none';
    }

    if (session.completed) {
      recordLocalEvent(windowValue, state, 'open_answers_completed');
      state.answers = Object.assign({}, state.adaptiveSession.answers || {});
      if (submitButton && !state.autoGenerationStarted) {
        state.autoGenerationStarted = true;
        submitButton.click();
      }
      return true;
    }

    var definition = questionDefinition(questionId);
    var isOptionalQuestion = OPTIONAL_OPEN_IDS.indexOf(questionId) !== -1;
    var progressText = '第 ' + String(session.currentIndex + 1) + ' 题 / 共 ' + String(session.questionIds.length) + ' 题'
      + (isOptionalQuestion ? '（选填，可跳过）' : '（必填）');
    if (questionId === 'caseAvailability') progressText = '先选择经历类型；完整经历路线还需补充 4 项，其中 1 项可跳过。';
    var progress = createElement(documentValue, 'div', 'v3-adaptive-progress', progressText);
    section.appendChild(progress);
    var card = createElement(documentValue, 'div', 'v3-adaptive-question');
    card.appendChild(createElement(documentValue, 'h2', 'deep-title', definition.label));
    card.appendChild(createElement(documentValue, 'p', 'deep-desc', definition.help));
    var errorNode = createElement(documentValue, 'div', 'field-error');

    if (questionId === 'caseAvailability') {
      var options = [
        { value: 'has_case', label: '有一件完整经历', detail: '我能说清问题、判断、动作和结果' },
        { value: 'nearest_incident', label: '有一件接近的真实小事', detail: '不完整，但确实发生过' },
        { value: 'no_case', label: '目前没有可用案例', detail: '按真实情况继续，不需要编故事' }
      ];
      var optionRow = createElement(documentValue, 'div', 'v3-adaptive-options');
      options.forEach(function (option) {
        var button = createElement(documentValue, 'button', 'v3-adaptive-option', '');
        button.type = 'button';
        button.setAttribute('aria-pressed', session.answers[questionId] === option.value ? 'true' : 'false');
        button.appendChild(createElement(documentValue, 'strong', '', option.label));
        button.appendChild(createElement(documentValue, 'span', '', option.detail));
        button.addEventListener('click', function () {
          session.answers[questionId] = option.value;
          state.answers[questionId] = option.value;
          Array.prototype.forEach.call(optionRow.querySelectorAll('button'), function (node) {
            node.setAttribute('aria-pressed', node === button ? 'true' : 'false');
          });
          saveAdaptiveDraft(windowValue, state);
          errorNode.textContent = '';
        });
        optionRow.appendChild(button);
      });
      card.appendChild(optionRow);
    } else {
      if (questionId === 'decision') appendRecallGuidance(documentValue, card, windowValue, state);
      appendQuestionGuidance(documentValue, card, definition);
      var textarea = createElement(documentValue, 'textarea', 'form-input v3-adaptive-input');
      textarea.id = 'v3-' + questionId;
      textarea.name = questionId;
      textarea.rows = questionId === 'decision' ? 3 : 5;
      textarea.maxLength = 1400;
      textarea.value = session.answers[questionId] || '';
      textarea.setAttribute('data-assessment-v3-open-answer', questionId);
      textarea.addEventListener('input', function () {
        session.answers[questionId] = textarea.value;
        state.answers[questionId] = textarea.value;
        if (classifyAnswer(textarea.value) === 'answered') {
          state.allowBasicSummaryWithoutEvidence = false;
        }
        saveAdaptiveDraft(windowValue, state);
        errorNode.textContent = '';
      });
      card.appendChild(textarea);
      var skip = createElement(
        documentValue,
        'button',
        'v3-honest-skip',
        definition.skipLabel || '暂时没有或想不清，诚实跳过'
      );
      skip.type = 'button';
      skip.addEventListener('click', function () {
        var answer = honestAbsenceAnswer(questionId);
        state.adaptiveSession = api.advance(state.adaptiveSession, { id: questionId, value: answer });
        state.answers = Object.assign({}, state.adaptiveSession.answers || {});
        saveAdaptiveDraft(windowValue, state);
        renderAdaptiveQuestion(windowValue, state, section, submitRow);
        scrollOpenAnswersToTop(windowValue, section);
      });
      card.appendChild(skip);
    }
    card.appendChild(errorNode);
    section.appendChild(card);

    var nav = createElement(documentValue, 'div', 'v3-adaptive-nav');
    var back = createElement(documentValue, 'button', 'btn v3-adaptive-back', '上一步');
    back.type = 'button';
    back.addEventListener('click', function () {
      if (state.adaptiveSession.currentIndex === 0 && typeof windowValue.showGroup === 'function') {
        windowValue.showGroup(3);
        return;
      }
      state.adaptiveSession = api.goBack(state.adaptiveSession);
      saveAdaptiveDraft(windowValue, state);
      renderAdaptiveQuestion(windowValue, state, section, submitRow);
      scrollOpenAnswersToTop(windowValue, section);
    });
    var isLastQuestion = state.adaptiveSession.currentIndex >= state.adaptiveSession.questionIds.length - 1;
    var next = createElement(documentValue, 'button', 'btn btn-primary v3-adaptive-next', questionId === 'caseAvailability' ? '按此情况继续' : (isLastQuestion ? (state.paidFlow ? '保存深度测评' : '生成我的测评摘要') : '下一题'));
    next.type = 'button';
    next.addEventListener('click', function () {
      var currentValue = cleanText(state.adaptiveSession.answers[questionId]);
      if (questionId === 'caseAvailability' && !currentValue) {
        errorNode.textContent = '请选择最接近你当前真实情况的一项。';
        return;
      }
      if (questionId !== 'caseAvailability') {
        var isOptional = OPTIONAL_OPEN_IDS.indexOf(questionId) !== -1;
        if (!currentValue && !isOptional) {
          errorNode.textContent = '请先填写当前问题，或使用下方的诚实跳过。';
          return;
        }
        // 可选题留空 = 诚实跳过，直接落库，不阻塞生成摘要
        currentValue = normalizeOptionalAnswer(questionId, currentValue);
      }
      state.adaptiveSession = api.advance(state.adaptiveSession, { id: questionId, value: currentValue });
      state.answers = Object.assign({}, state.adaptiveSession.answers || {});
      saveAdaptiveDraft(windowValue, state);
      renderAdaptiveQuestion(windowValue, state, section, submitRow);
      scrollOpenAnswersToTop(windowValue, section);
    });
    nav.appendChild(back);
    nav.appendChild(next);
    section.appendChild(nav);
    state.statusNode = createElement(documentValue, 'div', 'field-hint v3-status');
    section.appendChild(state.statusNode);
    return true;
  }

  function scrollOpenAnswersToTop(windowValue, section) {
    if (!section || !windowValue || typeof windowValue.scrollTo !== 'function') return;
    var rect = section.getBoundingClientRect();
    var top = Math.max(0, Number(windowValue.scrollY || windowValue.pageYOffset || 0) + rect.top);
    windowValue.scrollTo({ top: top, left: 0, behavior: 'auto' });
  }

  function unmountOpenAnswers(windowValue) {
    var section = windowValue.document.getElementById('v3-open-answers');
    if (section && section.parentNode) section.parentNode.removeChild(section);
  }

  function mountOpenAnswers(windowValue, state) {
    var documentValue = windowValue.document;
    var openStage = documentValue.querySelector('#deepForm [data-v3-open-stage="true"]');
    if (!openStage) {
      unmountOpenAnswers(windowValue);
      return false;
    }
    var submitRow = openStage.querySelector('.deep-submit-row');
    if (!submitRow) return false;
    var section = documentValue.getElementById('v3-open-answers');
    if (!section) {
      section = createElement(documentValue, 'section', 'deep-group v3-open-answers');
      section.id = 'v3-open-answers';
    }
    if (submitRow.parentNode
        && (section.parentNode !== submitRow.parentNode || section.nextSibling !== submitRow)) {
      submitRow.parentNode.insertBefore(section, submitRow);
    }
    var mounted = renderAdaptiveQuestion(windowValue, state, section, submitRow);
    if (mounted) {
      recordLocalEvent(windowValue, state, 'adaptive_deep_completed');
      recordLocalEvent(windowValue, state, 'open_answers_started');
      scrollOpenAnswersToTop(windowValue, section);
    }
    return mounted;
  }

  function evidencePromptNode(windowValue) {
    return windowValue.document.getElementById('assessmentEvidencePrompt');
  }

  function hideEvidencePrompt(windowValue) {
    var prompt = evidencePromptNode(windowValue);
    if (prompt) prompt.hidden = true;
  }

  function showEvidencePrompt(windowValue) {
    var prompt = evidencePromptNode(windowValue);
    if (!prompt) return false;
    var loading = windowValue.document.getElementById('loadStatus');
    var generation = windowValue.document.getElementById('reportGeneration');
    var deepStep = windowValue.document.getElementById('stepDeep');
    var reportStep = windowValue.document.getElementById('stepReport');
    if (loading) loading.classList.remove('active');
    if (generation) generation.hidden = true;
    if (deepStep) deepStep.classList.remove('active');
    if (reportStep) reportStep.style.display = 'none';
    prompt.hidden = false;
    if (typeof prompt.scrollIntoView === 'function') {
      prompt.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return true;
  }

  function returnToOpenAnswers(windowValue, state) {
    var api = getSessionApi();
    var preservedAnswers = Object.assign({}, state.answers || {});
    var session = ensureAdaptiveSession(windowValue, state);
    if (api && session) {
      session.answers = Object.assign({}, session.answers || {}, preservedAnswers);
      // 用同一套路由函数，避免与 adaptive-session 的题干序列漂移
      session.questionIds = (api && typeof api.routeQuestions === 'function')
        ? api.routeQuestions(session.answers.caseAvailability)
        : (session.answers.caseAvailability === 'has_case'
          ? ['caseAvailability', 'caseOneProblem', 'caseOneAction', 'caseOneResult', 'caseBoundaryTransfer']
          : ['caseAvailability', 'nearestIncident']);
      session.currentIndex = 0;
      session.completed = false;
      session.updatedAt = new Date().toISOString();
      state.adaptiveSession = session;
      state.answers = Object.assign({}, session.answers);
      saveAdaptiveDraft(windowValue, state);
    }
    state.allowBasicSummaryWithoutEvidence = false;
    state.supplementingEvidence = true;
    hideEvidencePrompt(windowValue);
    if (typeof windowValue.finishReportGeneration === 'function') {
      windowValue.finishReportGeneration(false);
    }
    if (typeof windowValue.enterOpenAnswersStage === 'function') {
      windowValue.enterOpenAnswersStage();
    } else {
      mountOpenAnswers(windowValue, state);
    }
    windowValue.setTimeout(function () {
      var first = windowValue.document.querySelector('[data-assessment-v3-open-answer]');
      if (first && typeof first.focus === 'function') first.focus();
    }, 0);
  }

  function localRuleResult(windowValue, state) {
    var evidenceApi = windowValue.KevinAssessmentV3Evidence;
    var rulesApi = windowValue.KevinAssessmentV3Rules;
    if (!evidenceApi || !rulesApi) {
      return {
        primaryJudgement: { statement: '本次判断暂时没有完成，请稍后重试。', confidence: 'low', evidenceIds: [] },
        prohibitedConclusions: ['当前不展示确定结论'],
        reviewRequired: true,
        reviewReasons: ['判断所需内容暂时没有准备完成']
      };
    }
    var deep = resolveDeepData(windowValue);
    var core = Object.assign({}, state.answers, {
      caseTwo: deep.caseTwo || '',
      helpRequests: deep.helpRequests || '',
      paidOutcome: deep.paidBefore || '',
      candidatePaths: deep.assetFormat || '',
      caseContext: state.followUpAnswers.caseContext || '',
      caseGoalConstraints: state.followUpAnswers.caseGoalConstraints || '',
      caseChoicesJudgement: state.followUpAnswers.caseChoicesJudgement || '',
      caseBoundaryTransfer: state.followUpAnswers.caseBoundaryTransfer || ''
    });
    var branches = {
      business: { repeatPayment: deep.repeatPayment || '' },
      organization: { decisionAuthority: deep.decisionAuthority || '' },
      career: { timeAvailable: deep.timeAvailable || '' }
    };
    var pack = evidenceApi.buildEvidencePack({ coreAnswers: core, branchAnswers: branches });
    return rulesApi.evaluate({ coreAnswers: core, branchAnswers: branches }, pack);
  }

  function currentPayload(windowValue, state) {
    state.kevinRuleResult = localRuleResult(windowValue, state);
    return buildAnonymousPayload({
      session_id: windowValue.reportSessionId,
      quizAnswers: resolveQuizAnswers(windowValue),
      deepData: resolveDeepData(windowValue),
      openAnswers: state.answers,
      diagnosticContext: windowValue.__kevinAssessmentDiagnosticContext || {},
      followUpAnswers: state.followUpAnswers,
      followUpRound: state.followUpRound,
      kevinRuleResult: state.kevinRuleResult,
      questionnaireRevision: state.questionnaireRevision
    });
  }

  function requestV3(windowValue, payload) {
    var controller = typeof windowValue.AbortController === 'function' ? new windowValue.AbortController() : null;
    var timeout = windowValue.setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);
    return windowValue.fetch('/api/runAssessmentV3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body && body.code ? body.code : 'V3_REQUEST_FAILED');
          error.response = body;
          throw error;
        }
        return body;
      });
    }).finally(function () {
      windowValue.clearTimeout(timeout);
    });
  }

  function getReportContainer(windowValue) {
    return windowValue.document.getElementById('reportContainer');
  }

  function removeCandidate(windowValue) {
    var existing = windowValue.document.getElementById('v3-candidate-panel');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function clearReportContainer(container) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  function appendReportValue(documentValue, parent, value, label, depth) {
    if (depth > 4 || value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      var line = createElement(documentValue, 'p', 'v3-candidate-line');
      if (label) line.appendChild(createElement(documentValue, 'strong', '', String(label) + '：'));
      line.appendChild(documentValue.createTextNode(String(value)));
      parent.appendChild(line);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 12).forEach(function (item) { appendReportValue(documentValue, parent, item, '', depth + 1); });
      return;
    }
    Object.keys(value).slice(0, 20).forEach(function (key) {
      if (key === 'evidenceRefs' || key === 'version') return;
      appendReportValue(documentValue, parent, value[key], key, depth + 1);
    });
  }

  function appendPathItem(documentValue, list, line) {
    var parts = cleanText(line, 1200).split('｜');
    if (parts.length < 2) {
      list.appendChild(createElement(documentValue, 'li', 'v3-path-item v3-plain-item', line));
      return;
    }
    var recommendation = parts.slice(1).join('｜');
    var stop = recommendation.indexOf('。');
    var status = stop === -1 ? recommendation : recommendation.slice(0, stop);
    var reason = stop === -1 ? '' : recommendation.slice(stop + 1);
    var item = createElement(documentValue, 'li', 'v3-path-item');
    var header = createElement(documentValue, 'div', 'v3-path-header');
    header.appendChild(createElement(documentValue, 'strong', 'v3-path-name', parts[0]));
    header.appendChild(createElement(documentValue, 'span', 'v3-path-status', status));
    item.appendChild(header);
    if (reason) item.appendChild(createElement(documentValue, 'p', 'v3-path-reason', reason));
    list.appendChild(item);
  }

  function appendActionItem(documentValue, list, line) {
    var value = cleanText(line, 1400);
    var dayStop = value.indexOf('：');
    var day = dayStop === -1 ? '下一步' : value.slice(0, dayStop);
    var body = dayStop === -1 ? value : value.slice(dayStop + 1);
    var signalMarker = '判断信号：';
    var signalStop = body.indexOf(signalMarker);
    var action = signalStop === -1 ? body : body.slice(0, signalStop).trim();
    var signal = signalStop === -1 ? '' : body.slice(signalStop + signalMarker.length).trim();
    var item = createElement(documentValue, 'li', 'v3-action-item');
    item.appendChild(createElement(documentValue, 'span', 'v3-action-day', day));
    var copy = createElement(documentValue, 'div', 'v3-action-body');
    copy.appendChild(createElement(documentValue, 'p', 'v3-action-copy', action));
    if (signal) copy.appendChild(createElement(documentValue, 'p', 'v3-action-signal', '完成信号：' + signal));
    item.appendChild(copy);
    list.appendChild(item);
  }

  function appendCandidateSections(documentValue, parent, report) {
    candidateSections(report).forEach(function (section) {
      var article = createElement(
        documentValue,
        'article',
        'v3-candidate-section v3-section-' + cleanText(section.role, 30)
      );
      article.setAttribute('data-section-role', section.role);
      article.appendChild(createElement(documentValue, 'h3', '', section.title));
      var list = createElement(documentValue, 'ul', 'v3-candidate-list v3-' + section.role + '-list');
      section.lines.forEach(function (line) {
        if (section.role === 'paths') appendPathItem(documentValue, list, line);
        else if (section.role === 'action') appendActionItem(documentValue, list, line);
        else list.appendChild(createElement(documentValue, 'li', '', line));
      });
      article.appendChild(list);
      parent.appendChild(article);
    });
  }

  function appendEvidenceDisclosure(documentValue, parent, card) {
    var sections = caseCardSections(card);
    if (!sections.length) return;
    var disclosure = createElement(documentValue, 'details', 'v3-evidence-disclosure');
    var summary = createElement(documentValue, 'summary', 'v3-evidence-summary');
    summary.appendChild(createElement(documentValue, 'span', '', '查看这次判断依据'));
    summary.appendChild(createElement(documentValue, 'small', '', '事实、解释与待验证边界'));
    disclosure.appendChild(summary);
    var intro = createElement(documentValue, 'div', 'v3-evidence-intro');
    intro.appendChild(createElement(documentValue, 'h4', '', '这次判断具体依据了什么'));
    intro.appendChild(createElement(documentValue, 'p', '', '这里不是第二份报告，只用于核对本次判断采用的事实、当前解释和仍待验证的边界。'));
    disclosure.appendChild(intro);
    var body = createElement(documentValue, 'div', 'v3-evidence-body');
    sections.forEach(function (section) {
      var article = createElement(documentValue, 'article', 'v3-evidence-section');
      article.appendChild(createElement(documentValue, 'h5', '', section.title));
      var list = createElement(documentValue, 'ul', 'v3-evidence-list');
      section.lines.forEach(function (line) {
        list.appendChild(createElement(documentValue, 'li', '', line));
      });
      article.appendChild(list);
      body.appendChild(article);
    });
    disclosure.appendChild(body);
    parent.appendChild(disclosure);
  }

  function prepareFoundationReport(documentValue, container) {
    if (!documentValue || !container || typeof container.querySelector !== 'function') return null;
    var disclosure = container.querySelector(':scope > .v3-foundation-disclosure');
    var report = disclosure
      ? disclosure.querySelector(':scope > .report-card')
      : container.querySelector(':scope > .report-card');
    if (!report) return null;
    if (disclosure) {
      container.insertBefore(report, disclosure);
      disclosure.parentNode.removeChild(disclosure);
    }
    report.classList.add('v3-foundation-report');
    report.removeAttribute('hidden');
    if (report.style && typeof report.style.removeProperty === 'function') {
      report.style.removeProperty('display');
    }
    return report;
  }

  function preserveCustomerHandoff(container) {
    if (!container || typeof container.querySelector !== 'function') return false;
    var handoff = container.querySelector('.locked-preview, .locked-report-gate');
    if (!handoff || typeof handoff.cloneNode !== 'function') return false;
    var preserved = handoff.cloneNode(true);
    clearReportContainer(container);
    container.appendChild(preserved);
    return true;
  }

  function showCandidate(windowValue, response, state) {
    var container = getReportContainer(windowValue);
    if (!container) return;
    ensureCustomerReportStyles(windowValue.document);
    removeCandidate(windowValue);
    var presentation = candidatePresentation(response);
    var customerState = presentation.customerState;
    if (customerState === 'limited' || customerState === 'ready' || customerState === 'review_required') {
      windowValue.__kevinAssessmentFollowUpPending = false;
      if (typeof windowValue.applyAssessmentV3FreeSummary === 'function'
          && windowValue.applyAssessmentV3FreeSummary(
            presentation.freeSummary,
            response && (response.input_summary || response.inputSummary) || {}
          )) {
        state.candidateNode = null;
        return;
      }
    }
    var documentValue = windowValue.document;
    var panel = createElement(documentValue, 'section', 'v3-candidate-panel');
    panel.id = 'v3-candidate-panel';
    panel.setAttribute('data-customer-state', customerState);
    var header = createElement(documentValue, 'header', 'v3-candidate-header');
    var headingGroup = createElement(documentValue, 'div', 'v3-candidate-heading');
    headingGroup.appendChild(createElement(documentValue, 'h2', '', candidateHeading(response)));
    if (['limited', 'ready', 'review_required'].indexOf(customerState) !== -1) {
      headingGroup.appendChild(createElement(documentValue, 'p', 'v3-candidate-intro', '先看结论，再完成一个可以验证的小动作。'));
    }
    header.appendChild(headingGroup);
    header.appendChild(createElement(
      documentValue,
      'div',
      'v3-review-badge',
      candidateStatusLabel(customerState)
    ));
    panel.appendChild(header);
    if (response && (response.status === 'analyzing' || response.state === 'analyzing')) {
      panel.appendChild(createElement(documentValue, 'p', '', '请稍候，不需要重复提交。'));
    } else if (customerState === 'needs_follow_up') {
      panel.appendChild(createElement(documentValue, 'p', '', '下面问题可以跳过，也可以补充后再继续。'));
    } else if (presentation.freeSummary) {
      var summaryGrid = createElement(documentValue, 'div', 'v3-free-summary');
      [
        ['核心结论', presentation.freeSummary.conclusion],
        ['当前主要瓶颈', presentation.freeSummary.bottleneck],
        ['未来 7 天可执行动作', presentation.freeSummary.action]
      ].forEach(function (item) {
        var article = createElement(documentValue, 'article', 'v3-free-summary-item');
        article.appendChild(createElement(documentValue, 'small', '', item[0]));
        article.appendChild(createElement(documentValue, 'p', '', item[1]));
        summaryGrid.appendChild(article);
      });
      var unlock = createElement(documentValue, 'section', 'v3-free-summary-unlock');
      unlock.appendChild(createElement(documentValue, 'small', '', '19.9 元完整自动报告会继续提供更完整的整理与行动建议'));
      unlock.appendChild(createElement(documentValue, 'p', '', presentation.freeSummary.unlockItems.join('、')));
      summaryGrid.appendChild(unlock);
      panel.appendChild(summaryGrid);
    } else {
      panel.appendChild(createElement(documentValue, 'p', '', LEGACY_FALLBACK_MESSAGE));
      if (state && typeof state.retryV3 === 'function') {
        var retryButton = createElement(documentValue, 'button', 'btn btn-primary v3-retry-button', '重新生成测评摘要');
        retryButton.type = 'button';
        retryButton.addEventListener('click', function () {
          state.retryV3(retryButton);
        });
        panel.appendChild(retryButton);
      }
    }
    if (presentation.showEvidenceDisclosure) {
      appendEvidenceDisclosure(documentValue, panel, response.caseEvidenceCard);
    }
    container.insertBefore(panel, container.firstChild);
    prepareFoundationReport(documentValue, container);
    state.candidateNode = panel;
  }

  function followUpQuestion(question, index, round) {
    var sourceId = typeof question === 'string' ? '' : cleanText(question && question.id, 50);
    sourceId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'question-' + String(index + 1);
    var isServerId = /^follow-up-(?:contradiction|result-evidence|judgement-basis|demand-signal)-\d+$/.test(sourceId);
    var id = isServerId ? sourceId : 'follow-up-result-evidence-' + String(index + 1);
    if (typeof question === 'string') return { id: id, question: cleanText(question, 600) };
    return { id: id, question: cleanText(question && question.question, 600) };
  }

  function prepareFollowUpQuestions(response, currentFollowUpRound) {
    var reported = response && response.followUpRound;
    if (!Number.isInteger(reported) && Number(response && response.followUpCount) > 0) reported = 1;
    var hasServerRound = Number.isInteger(reported) && reported >= 0;
    var followUpRound = hasServerRound
      ? Math.min(MAX_FOLLOW_UP_ROUNDS, reported)
      : Math.min(MAX_FOLLOW_UP_ROUNDS, Math.max(0, Number(currentFollowUpRound) || 0) + 1);
    var round = Math.max(1, followUpRound);
    var questions = (Array.isArray(response && response.followups) ? response.followups : []).slice(0, MAX_FOLLOW_UP_QUESTIONS).map(function (question, index) {
      return followUpQuestion(question, index, round);
    });
    return { followUpRound: followUpRound, questions: questions };
  }

  function showFollowUps(windowValue, questions, state, submit, caseEvidenceCard, inputSummary) {
    var container = getReportContainer(windowValue);
    if (!container) return;
    removeCandidate(windowValue);
    clearReportContainer(container);
    windowValue.__kevinAssessmentFollowUpPending = true;
    var documentValue = windowValue.document;
    var panel = createElement(documentValue, 'section', 'v3-candidate-panel');
    panel.id = 'v3-candidate-panel';
    panel.appendChild(createElement(documentValue, 'h3', '', '如果愿意，可以再补充一两点'));
    panel.appendChild(createElement(documentValue, 'p', '', '下面问题都是可选项；暂时没有也可以直接按现有信息继续。'));
    recordLocalEvent(windowValue, state, 'follow_up_shown');
    if (!questions.length) {
      panel.appendChild(createElement(documentValue, 'p', '', '当前没有可展示的追问，原报告仍可使用。'));
      container.insertBefore(panel, container.firstChild);
      return;
    }
    var errorNodes = {};
    questions.forEach(function (question) {
      var label = createElement(documentValue, 'label', 'form-label', question.question);
      label.htmlFor = 'v3-follow-' + question.id;
      var textarea = createElement(documentValue, 'textarea', 'form-input');
      textarea.id = 'v3-follow-' + question.id;
      textarea.rows = 3;
      textarea.maxLength = 1400;
      textarea.value = state.followUpAnswers[question.id] || '';
      var fieldError = createElement(documentValue, 'div', 'field-error');
      errorNodes[question.id] = fieldError;
      textarea.addEventListener('input', function () {
        state.followUpAnswers[question.id] = textarea.value;
        fieldError.textContent = '';
      });
      panel.appendChild(label);
      panel.appendChild(textarea);
      panel.appendChild(fieldError);
    });
    var status = createElement(documentValue, 'div', 'field-hint v3-status');
    var button = createElement(documentValue, 'button', 'btn btn-primary', '按现有信息生成测评摘要');
    button.type = 'button';
    button.addEventListener('click', function () {
      state.followUpAnswers = normalizeFollowUpAnswers(questions, state.followUpAnswers);
      Object.keys(errorNodes).forEach(function (id) { errorNodes[id].textContent = ''; });
      status.textContent = '';
      submit(status, button);
    });
    panel.appendChild(button);
    panel.appendChild(status);
    container.insertBefore(panel, container.firstChild);
  }

  function initReportIntegration(windowValue) {
    var browser = windowValue || root;
    var paidFlow = Boolean(browser.KevinPaidAssessmentFlow && browser.KevinPaidAssessmentFlow.detectPaidFlow(browser.location));
    var flagsApi = browser && browser.KevinAssessmentV3Flags;
    var flags = flagsApi && flagsApi.getFlags ? flagsApi.getFlags(browser.location) : { enabled: false };
    if (!paidFlow && (!flags.enabled || !flags.aiEnabled)) return false;
    if (browser.__kevinAssessmentV3ReportIntegration) return true;
    if (typeof browser.generateReport !== 'function') return false;
    var state = {
      answers: {}, followUpAnswers: {}, followUpRound: 0, pending: false,
      statusNode: null, kevinRuleResult: null, adaptiveSession: null, draftKey: '',
      eventKey: '', flowStartedAt: Date.now(), recordedEvents: {}, reportDelivered: false,
      recallCue: '', allowBasicSummaryWithoutEvidence: false, supplementingEvidence: false,
      autoGenerationStarted: false, paidFlow: paidFlow,
      questionnaireRevision: 'paid-evidence-v1', questionnaire: null
    };
    browser.__kevinAssessmentV3ReportIntegration = state;
    browser.supplementAssessmentV3Evidence = function () {
      returnToOpenAnswers(browser, state);
    };
    recordLocalEvent(browser, state, 'adaptive_deep_started');
    if (typeof browser.addEventListener === 'function') {
      browser.addEventListener('beforeunload', function () {
        if (!state.reportDelivered) recordLocalEvent(browser, state, 'flow_exited');
      });
    }
    var originalShowGroup = typeof browser.showGroup === 'function' ? browser.showGroup : null;
    if (originalShowGroup) {
      browser.showGroup = function () {
        var result = originalShowGroup.apply(this, arguments);
        if (browser.document.querySelector('#deepForm [data-v3-open-stage="true"]')) {
          mountOpenAnswers(browser, state);
        } else {
          unmountOpenAnswers(browser);
        }
        return result;
      };
    }
    if (browser.document.querySelector('#deepForm [data-v3-open-stage="true"]')) {
      mountOpenAnswers(browser, state);
    }
    var evidencePrompt = evidencePromptNode(browser);
    if (evidencePrompt) {
      var supplementButton = evidencePrompt.querySelector('[data-action="supplement-evidence"]');
      var basicSummaryButton = evidencePrompt.querySelector('[data-action="continue-basic-summary"]');
      if (supplementButton) {
        supplementButton.addEventListener('click', function () {
          returnToOpenAnswers(browser, state);
        });
      }
      if (basicSummaryButton) {
        basicSummaryButton.addEventListener('click', function () {
          state.allowBasicSummaryWithoutEvidence = true;
          hideEvidencePrompt(browser);
          browser.generateReport();
        });
      }
    }

    function showFallback(showPanel) {
      recordLocalEvent(browser, state, 'report_retryable_error');
      addStatus(state, LEGACY_FALLBACK_MESSAGE, 'v3-fallback');
      if (typeof browser.failReportGeneration === 'function') {
        browser.failReportGeneration(LEGACY_FALLBACK_MESSAGE);
      } else if (showPanel) {
        showCandidate(browser, { status: 'retryable_error' }, state);
      }
    }

    function handleResponse(response) {
      var customerState = getCustomerState(response);
      if (response && response.analysisFacts && typeof response.analysisFacts === 'object') {
        browser.__kevinAssessmentAnalysisFacts = response.analysisFacts;
      }
      if (customerState === 'needs_follow_up') {
        var followUp = prepareFollowUpQuestions(response, state.followUpRound);
        state.followUpRound = followUp.followUpRound;
        showFollowUps(
          browser,
          followUp.questions,
          state,
          submitFollowUp,
          response && response.caseEvidenceCard,
          response && (response.inputSummary || response.input_summary)
        );
        if (typeof browser.finishReportGeneration === 'function') browser.finishReportGeneration(true);
        return;
      }
      if (['limited', 'ready', 'review_required'].indexOf(customerState) === -1) {
        showFallback(true);
        return;
      }
      if (customerState === 'limited') recordLocalEvent(browser, state, 'report_limited');
      else if (customerState === 'ready' || customerState === 'review_required') recordLocalEvent(browser, state, 'report_ready');
      if (typeof browser.enterReportReadyMode === 'function') browser.enterReportReadyMode(false);
      showCandidate(browser, response, state);
      addStatus(state, '测评摘要已生成。', 'v3-ready');
      if (typeof browser.finishReportGeneration === 'function') browser.finishReportGeneration(true);
      if (customerState === 'limited' || customerState === 'ready' || customerState === 'review_required') {
        state.reportDelivered = true;
        var inputSummary = response && (response.input_summary || response.inputSummary) || {};
        if (inputSummary.hasUsefulManualEvidence === true) {
          clearAdaptiveDraft(browser, state);
        }
      }
    }

    function revealExistingAssessment(response) {
      if (!response) return false;
      if (state.supplementingEvidence) return false;
      var customerState = getCustomerState(response);
      if (['needs_follow_up', 'limited', 'ready', 'review_required'].indexOf(customerState) === -1) return false;
      var loading = browser.document.getElementById('loadStatus');
      var quizStep = browser.document.getElementById('stepQuiz');
      var deepStep = browser.document.getElementById('stepDeep');
      var reportStep = browser.document.getElementById('stepReport');
      if (loading) loading.classList.remove('active');
      if (quizStep) quizStep.classList.remove('active');
      if (deepStep) deepStep.classList.remove('active');
      if (reportStep) reportStep.style.display = 'block';
      handleResponse(response);
      return true;
    }

    var storedSessionId = draftSessionId(browser);
    if (!paidFlow && /[?&]sid=/.test(String(browser.location && browser.location.search || ''))) {
      loadExistingAssessment(browser, storedSessionId).then(revealExistingAssessment);
    }

    function submitFollowUp(statusNode, button) {
      if (state.pending || !canSubmitFollowUp(state.followUpRound)) return;
      if (detectObviousPii(state.followUpAnswers).length) {
        statusNode.textContent = '当前填写内容无法提交，请检查后重试。';
        return;
      }
      state.pending = true;
      button.disabled = true;
      recordLocalEvent(browser, state, 'follow_up_completed');
      statusNode.textContent = '正在生成你的测评摘要…';
      if (typeof browser.showReportGeneration === 'function') browser.showReportGeneration(generationFacts(state));
      requestV3(browser, currentPayload(browser, state)).then(handleResponse).catch(function () {
        showFallback(true);
      }).finally(function () {
        state.pending = false;
        button.disabled = false;
      });
    }

    var originalGenerate = browser.generateReport;
    if (paidFlow) {
      initPaidFlow(browser, state);
      return true;
    }
    state.retryV3 = function (button) {
      if (state.pending) return Promise.resolve();
      state.pending = true;
      if (button) button.disabled = true;
      addStatus(state, '正在生成你的测评摘要…');
      if (typeof browser.showReportGeneration === 'function') browser.showReportGeneration(generationFacts(state));
      var ensureSession = browser.reportSessionId
        ? Promise.resolve()
        : Promise.resolve().then(function () { return originalGenerate.call(browser); });
      return ensureSession.then(function () {
        if (!browser.reportSessionId) throw new Error('V3_SESSION_MISSING');
        alignAdaptiveDraftWithReportSession(browser, state);
        return requestV3(browser, currentPayload(browser, state));
      }).then(function (response) {
        handleResponse(response);
        return response;
      }).catch(function () {
        showFallback(true);
        return { kind: 'legacy_fallback' };
      }).finally(function () {
        state.pending = false;
        if (button) button.disabled = false;
      });
    };
    browser.generateReport = function () {
      if (state.pending) return Promise.resolve();
      var errors = refreshOpenErrors(state);
      var pii = detectObviousPii(state.answers);
      if (Object.keys(errors).length || pii.length) {
        if (pii.length) addStatus(state, '当前填写内容无法提交，请检查后重试。', 'v3-error');
        else addStatus(state, '请先完成当前真实问题；没有相关经历也可以如实选择。', 'v3-error');
        return Promise.resolve({ kind: 'validation_error' });
      }
      if (!hasUsefulManualEvidence(state.answers)
          && !state.allowBasicSummaryWithoutEvidence) {
        showEvidencePrompt(browser);
        return Promise.resolve({ kind: 'evidence_prompt' });
      }
      if (hasUsefulManualEvidence(state.answers)) {
        state.allowBasicSummaryWithoutEvidence = false;
      }
      hideEvidencePrompt(browser);
      state.supplementingEvidence = false;
      state.pending = true;
      browser.__kevinDeferGenerationFinish = true;
      addStatus(state, '正在生成你的测评摘要…');
      if (typeof browser.showReportGeneration === 'function') browser.showReportGeneration(generationFacts(state));
      return runAfterLegacy({
        legacyGenerate: function () { return originalGenerate.apply(browser, arguments); },
        getSessionId: function () { return browser.reportSessionId; },
        onLegacyFallback: function () { showFallback(true); },
        requestV3: function () {
          alignAdaptiveDraftWithReportSession(browser, state);
          addStatus(state, '正在生成你的测评摘要…');
          return requestV3(browser, currentPayload(browser, state)).then(function (response) {
            handleResponse(response);
            return response;
          }).catch(function () {
            showFallback(true);
            return { kind: 'legacy_fallback' };
          });
        }
      }).finally(function () {
        state.pending = false;
        browser.__kevinDeferGenerationFinish = false;
      });
    };
    return true;
  }

  // Paid transport owns lifecycle; the canonical questionnaire, mapper and renderer stay shared.
  function initPaidFlow(browser, state) {
    var client=browser.KevinPaidAssessmentFlow, doc=browser.document;
    var sid=new URL(browser.location.href).searchParams.get('sid') || '';
    var registered=false, latest=null, saveTimer=0, pollTimer=0, revision=0, stopped=false;
    var queue=Promise.resolve(), lastSaved='', generationBusy=false, pollCount=0;
    var editingKey=getSessionApi().storageKey(sid)+':editing';
    // Only navigation intent is stored in this tab; server snapshots own every answer.
    function rememberEditing(active) {
      try { if(active)browser.sessionStorage.setItem(editingKey,'1');else browser.sessionStorage.removeItem(editingKey); } catch(error) {}
    }
    function isEditing() {
      try { return browser.sessionStorage.getItem(editingKey)==='1'; } catch(error) { return false; }
    }
    function hideSteps() {
      ['loadStatus','stepQuiz','stepDeep'].forEach(function(id){doc.getElementById(id).classList.remove('active');});
      doc.getElementById('reportGeneration').hidden=true;
      doc.getElementById('stepReport').style.display='block';
      browser.document.body.classList.remove('deep-mode','report-ready','paid-questionnaire-mode');
      if(state.questionnaire&&state.questionnaire.destroy)state.questionnaire.destroy();
      state.questionnaire=null;
    }
    function panel(title,message,buttons,feedback) {
      hideSteps();
      var container=doc.getElementById('reportContainer');container.innerHTML='';
      var box=createElement(doc,'article','report-card paid-flow-panel');box.id='paidFlowPanel';
      box.setAttribute('aria-live','polite');box.appendChild(createElement(doc,'h2','',title));
      box.appendChild(createElement(doc,'p','',message));
      if(Array.isArray(feedback)&&feedback.length){
        var feedbackList=createElement(doc,'div','paid-flow-feedback');
        feedback.slice(0,2).forEach(function(item){
          var feedbackButton=createElement(doc,'button','paid-flow-feedback-item',item.message);
          feedbackButton.type='button';
          feedbackButton.setAttribute('aria-label',item.message+'，去修改');
          feedbackButton.addEventListener('click',function(){edit(item.field);});
          feedbackList.appendChild(feedbackButton);
        });
        box.appendChild(feedbackList);
      }
      (buttons||[]).forEach(function(item){var button=createElement(doc,'button','btn '+(item.primary?'btn-primary':'btn-outline'),item.label);button.type='button';button.addEventListener('click',item.action);box.appendChild(button);});
      container.appendChild(box);
      var hero=doc.querySelector('.hero h1');if(hero)hero.textContent='19.9 元完整自动报告';
      var sub=doc.getElementById('heroSub');if(sub)sub.textContent='按真实经历完成判断，购买后自动生成，不含人工审核。';
      var eyebrow=doc.querySelector('.hero .eyebrow');if(eyebrow)eyebrow.textContent='深度测评';
    }
    function recovery(purchase) {
      registered=false;browser.__kevinPaidFlowRegistered=false;
      browser.clearTimeout(saveTimer);browser.clearTimeout(pollTimer);
      var terminal=purchase==='refunded_or_revoked';
      panel(terminal?'报告访问已停止':purchase==='payment_pending'?'支付状态待确认':'恢复已购买报告',
        terminal?'这份报告当前不可访问，请返回小程序查看订单状态。':purchase==='payment_pending'?'请返回小程序确认这笔订单；当前材料已锁定。':'请返回小程序，在报告记录中恢复已购买的报告，无需再次付款。',
        [{label:'重新检查状态',action:boot}]);
    }
    function failure(error,retry) {
      if(error&&error.code==='PAID_ASSESSMENT_INPUT_LOCKED'){recovery(error.details&&error.details.purchase_state);return;}
      var text=error&&error.code==='NOT_FOUND'?'当前访问已失效，请返回小程序重新打开或恢复报告。':error&&error.code==='PAID_ASSESSMENT_NEW_ORDERS_DISABLED'?'新报告购买暂时停止，已填写材料会保留。':error&&error.code==='MINIPROGRAM_BRIDGE_UNAVAILABLE'?'暂时无法打开小程序支付，请返回小程序后重试。':'暂时未能完成，请检查网络后重试。';
      panel('暂时未完成',text,[{label:'重试',action:retry||boot}]);
    }
    function receipt(value) {
      latest=value;
      if(value.purchase_state!=='unpaid'){recovery(value.purchase_state);return;}
      var status=value.eligibility_status;
      var copy=client.eligibilityPresentation(status);
      var firstFeedback=value.feedback&&value.feedback[0];
      var buttons=[];
      var message='材料已经保存在当前测评中。';
      if(status==='ready'){
        message='完整报告 19.9 元，一次购买；自动生成，不含 Kevin 人工审核。';
        if(value.can_create_order)buttons.push({label:copy.action,primary:true,action:checkout});
        buttons.push({label:'返回修改材料',action:function(){edit();}});
      }else if(status==='provider_error'){
        message='你的回答没有丢失，也还没有进入支付。可以直接重新检查。';
        buttons.push({label:copy.action,primary:true,action:retryQualityCheck});
        buttons.push({label:'返回修改材料',action:function(){edit(firstFeedback&&firstFeedback.field);}});
      }else if(status==='invalid'||status==='needs_evidence'){
        message=status==='invalid'?'请按下方提示修改；这里只显示当前最关键的两处。':'不用重填，补上当前最关键的事实后再检查。';
        buttons.push({label:copy.action,primary:true,action:function(){edit(firstFeedback&&firstFeedback.field);}});
      }
      panel(copy.title,message,buttons,value.feedback);
      if(status==='ready'&&!value.can_create_order)doc.getElementById('paidFlowPanel').appendChild(createElement(doc,'p','',value.next_action==='wait'?'新报告购买暂时停止，材料已保存。':'材料已保存，请完成确认后再购买。'));
    }
    function save(finalize) {
      browser.clearTimeout(saveTimer);
      if(!registered)return Promise.reject(new client.PaidFlowError('NOT_FOUND'));
      var payload=currentPayload(browser,state), serialized=JSON.stringify(payload), atRevision=revision;
      if(!finalize&&serialized===lastSaved)return queue;
      queue=queue.catch(function(){}).then(function(){
        if(!registered)throw new client.PaidFlowError('NOT_FOUND');
        return client.savePaidDraft({sessionId:sid,answerSnapshot:payload,finalize:finalize});
      }).then(function(value){
        latest=value;lastSaved=serialized;
        if(value.purchase_state!=='unpaid')recovery(value.purchase_state);
        else if(finalize&&atRevision===revision){rememberEditing(false);receipt(value);}
        var hint=doc.getElementById('paidDraftStatus');if(hint)hint.textContent='材料已保存';
        if(state.questionnaire&&state.questionnaire.setSaveState)state.questionnaire.setSaveState('saved');
        return value;
      });
      return queue;
    }
    state.scheduleSave=function(){
      if(!registered||state.pending)return;
      revision++;browser.clearTimeout(saveTimer);
      var hint=doc.getElementById('paidDraftStatus');if(hint)hint.textContent='正在保存…';
      if(state.questionnaire&&state.questionnaire.setSaveState)state.questionnaire.setSaveState('saving');
      saveTimer=browser.setTimeout(function(){save(false).catch(function(error){
        if(error.code==='PAID_ASSESSMENT_INPUT_LOCKED'){recovery(error.details&&error.details.purchase_state);return;}
        var hint=doc.getElementById('paidDraftStatus');if(hint)hint.textContent='保存未完成，请保持页面打开后重试。';
        if(state.questionnaire&&state.questionnaire.setSaveState)state.questionnaire.setSaveState('failed');
      });},450);
    };
    function edit(focusField) {
      if(!latest||latest.purchase_state!=='unpaid')return;
      registered=true;browser.__kevinPaidFlowRegistered=true;state.autoGenerationStarted=false;
      if(state.questionnaireRevision==='paid-evidence-v2'&&browser.KevinPaidQuestionnaireUI&&browser.KevinPaidQuestionnaireModel){
        rememberEditing(true);
        doc.getElementById('stepReport').style.display='none';doc.getElementById('stepDeep').classList.add('active');
        doc.body.classList.add('paid-questionnaire-mode');
        if(state.questionnaire&&state.questionnaire.destroy)state.questionnaire.destroy();
        state.questionnaire=browser.KevinPaidQuestionnaireUI.mount({
          container:doc.getElementById('paidQuestionnaire'),
          model:browser.KevinPaidQuestionnaireModel,
          initialPayload:currentPayload(browser,state),
          onChange:function(next){
            state.questionnaireRevision=next.questionnaireRevision;
            browser.restorePaidAssessmentDraft(next);
            state.answers=Object.assign({},next.coreAnswers,{caseAvailability:next.caseAvailability});
            state.followUpAnswers=next.followUpAnswers||{};
            state.scheduleSave();
          },
          onFinalize:function(next){
            state.questionnaireRevision=next.questionnaireRevision;
            browser.restorePaidAssessmentDraft(next);
            state.answers=Object.assign({},next.coreAnswers,{caseAvailability:next.caseAvailability});
            state.followUpAnswers=next.followUpAnswers||{};
            return save(true);
          }
        });
        if(focusField&&state.questionnaire.focusField&&!state.questionnaire.focusField(focusField)){
          state.questionnaire.focusField('caseAvailability');
        }
        return;
      }
      state.adaptiveSession=getSessionApi().reopenSession(state.adaptiveSession);
      var focusFound=false;
      if(focusField){
        var focusIndex=state.adaptiveSession.questionIds.indexOf(focusField);
        if(focusIndex>=0){state.adaptiveSession.currentIndex=focusIndex;focusFound=true;}
      }
      state.answers=Object.assign({},state.adaptiveSession.answers);
      rememberEditing(true);
      saveAdaptiveDraft(browser,state);
      doc.getElementById('stepReport').style.display='none';doc.getElementById('stepDeep').classList.add('active');
      browser.renderDeepForm();
      if(focusFound&&typeof browser.enterOpenAnswersStage==='function')browser.enterOpenAnswersStage();
      var hint=doc.getElementById('paidDraftStatus');if(!hint){hint=createElement(doc,'p','field-hint','材料已保存');hint.id='paidDraftStatus';hint.setAttribute('role','status');doc.querySelector('#stepDeep .deep-panel').appendChild(hint);}
      if(focusFound)browser.setTimeout(function(){var target=doc.getElementById('v3-'+focusField);if(target&&typeof target.focus==='function')target.focus();},0);
    }
    function retryQualityCheck(){
      if(state.pending||!registered)return Promise.resolve();
      state.pending=true;
      return save(true).catch(function(error){failure(error,retryQualityCheck);}).finally(function(){state.pending=false;});
    }
    browser.generateReport=function(){
      if(state.pending||!registered)return Promise.resolve();
      if(!browser.validateAllDeep())return Promise.resolve({kind:'validation_error'});
      if(Object.keys(validateOpenAnswers(state.answers)).length||detectObviousPii(state.answers).length){addStatus(state,'请检查当前回答后重试。','v3-error');return Promise.resolve({kind:'validation_error'});}
      state.pending=true;
      return save(true).catch(function(error){failure(error,browser.generateReport);}).finally(function(){state.pending=false;});
    };
    async function checkout() {
      if(state.pending)return;state.pending=true;browser.clearTimeout(saveTimer);
      try{
        await queue;
        var paid=await protectedStatus();if(paid){await handlePaid(paid);return;}
        var fresh=await client.loadPaidDraft(sid);latest=fresh;
        if(fresh.purchase_state!=='unpaid'){recovery(fresh.purchase_state);return;}
        if(!fresh.can_create_order){receipt(fresh);return;}
        var token=await client.createCheckout({sessionId:sid,inputVersion:fresh.input_version});
        await client.navigateToMiniProgramPayment(token.checkout_token);
        registered=false;browser.__kevinPaidFlowRegistered=false;
        panel('请在小程序完成支付','返回后将重新核对支付状态。',[{label:'检查支付状态',action:boot}]);
      }catch(error){failure(error,boot);}finally{state.pending=false;}
    }
    async function protectedStatus(){try{return await client.loadPaidReportStatus(sid);}catch(error){if(error.code==='NOT_FOUND')return null;throw error;}}
    function generating() {
      panel('报告正在生成','购买时的材料已锁定，请稍候。无需再次付款。',[{label:stopped?'继续检查生成状态':'停止自动检查',action:function(){stopped=!stopped;browser.clearTimeout(pollTimer);if(stopped)generating();else{pollCount=0;boot();}}}]);
    }
    async function handlePaid(value,resumeGeneration) {
      registered=false;browser.__kevinPaidFlowRegistered=false;browser.clearTimeout(saveTimer);
      if(value.status==='report_ready'){
        browser.clearTimeout(pollTimer);
        var data=await client.loadPaidReport(sid);hideSteps();
        browser.reportMeasurementCode=data.measurement_code;
        browser.renderFullReport({assessmentV3ReportDocument:data.assessment_v3_report_document,assessmentV3InputSummary:data.assessment_v3_input_summary,resultScores:data.result_scores||{}},new Date(data.created_at).toLocaleString('zh-CN'));
        browser.enterReportReadyMode(true);return;
      }
      if(value.status==='recoverable_error'){
        panel('报告生成暂时中断','已购买权益仍保留，可继续生成，无需再次付款。',[{label:'继续生成报告',primary:true,action:generate}]);return;
      }
      if(resumeGeneration!==false&&(value.status==='paid'||value.status==='report_generating')){await generate();return;}
      generating();
      if(!stopped&&pollCount++<30)pollTimer=browser.setTimeout(function(){boot(false);},2000);
      else{stopped=true;generating();}
    }
    async function generate() {
      if(generationBusy)return;generationBusy=true;stopped=false;pollCount=0;generating();
      try{await handlePaid(await client.generateOrResumePaidReport(sid),false);}
      catch(error){if(error.code==='REPORT_GENERATION_RETRYABLE')await handlePaid(error.details,false);else failure(error,boot);}
      finally{generationBusy=false;}
    }
    async function boot(resumeGeneration) {
      browser.clearTimeout(pollTimer);
      try{
        var status=await protectedStatus();if(status){await handlePaid(status,resumeGeneration);return;}
        var draft=await client.loadPaidDraft(sid);latest=draft;
        if(draft.purchase_state!=='unpaid'){recovery(draft.purchase_state);return;}
        registered=true;browser.__kevinPaidFlowRegistered=true;
        var payload=draft.answer_snapshot;
        state.questionnaireRevision=payload.questionnaireRevision||'paid-evidence-v1';
        browser.restorePaidAssessmentDraft(payload);
        var api=getSessionApi(),session=api.createSession({sessionId:sid});
        var answers=Object.assign({},payload.coreAnswers);
        if(payload.coreAnswers.decision)answers.caseAvailability=payload.caseAvailability;
        while(!session.completed){var id=api.currentQuestionId(session);if(!answers[id])break;session=api.advance(session,{id:id,value:answers[id]});}
        session.answers=Object.assign({},session.answers,answers);state.adaptiveSession=session;state.answers=answers;
        state.followUpAnswers=payload.followUpAnswers;state.followUpRound=payload.followUpRound;
        lastSaved=JSON.stringify(currentPayload(browser,state));
        doc.getElementById('loadStatus').classList.remove('active');
        if(!isEditing()&&(draft.can_create_order||(session.completed&&draft.input_version>0)))receipt(draft);else edit();
      }catch(error){failure(error,boot);}
    }
    browser.addEventListener('pageshow',function(event){if(event.persisted&&!stopped)boot();});
    browser.addEventListener('visibilitychange',function(){if(doc.visibilityState==='visible'&&!registered&&!stopped)boot();});
    browser.addEventListener('pagehide',function(){browser.clearTimeout(pollTimer);browser.clearTimeout(saveTimer);});
    boot();
  }

  return {
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    legacyFallbackMessage: LEGACY_FALLBACK_MESSAGE,
    candidateHeading: candidateHeading,
    candidateStatusLabel: candidateStatusLabel,
    honestAbsenceAnswer: honestAbsenceAnswer,
    normalizeOptionalAnswer: normalizeOptionalAnswer,
    validateOpenAnswers: validateOpenAnswers,
    validateLocalSubmission: validateLocalSubmission,
    detectObviousPii: detectObviousPii,
    resolveQuizAnswers: resolveQuizAnswers,
    resolveDeepData: resolveDeepData,
    buildAnonymousPayload: buildAnonymousPayload,
    durationBucket: durationBucket,
    viewportBucket: viewportBucket,
    buildLocalEvent: buildLocalEvent,
    runAfterLegacy: runAfterLegacy,
    candidateSections: candidateSections,
    summarizeCustomerBoundaries: summarizeCustomerBoundaries,
    caseCardSections: caseCardSections,
    candidatePresentation: candidatePresentation,
    buildFreeSummary: buildFreeSummary,
    customerInputNotice: customerInputNotice,
    validateFollowUpAnswers: validateFollowUpAnswers,
    normalizeFollowUpAnswers: normalizeFollowUpAnswers,
    prepareFollowUpQuestions: prepareFollowUpQuestions,
    canSubmitFollowUp: canSubmitFollowUp,
    getCustomerState: getCustomerState,
    formatCandidateForDisplay: formatCandidateForDisplay,
    clearReportContainer: clearReportContainer,
    ensureCustomerReportStyles: ensureCustomerReportStyles,
    prepareFoundationReport: prepareFoundationReport,
    showCandidate: showCandidate,
    preserveCustomerHandoff: preserveCustomerHandoff,
    normalizeStoredAssessment: normalizeStoredAssessment,
    loadExistingAssessment: loadExistingAssessment,
    initReportIntegration: initReportIntegration
  };
}));
