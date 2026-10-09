(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3Evidence = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'];
  var CORE_FIELDS = [
    'decision', 'urgency', 'unacceptableOutcome', 'caseOneProblem', 'caseOneAction',
    'caseOneResult', 'caseTwo', 'helpRequests', 'costSignals', 'paidOutcome',
    'candidatePaths', 'rejectedState'
  ];

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function quote(value) {
    return clean(value).slice(0, 240);
  }

  function validateEvidenceLevel(level) {
    return LEVELS.indexOf(level) !== -1;
  }

  function hasActualMarketPayment(value) {
    return clean(value).split(/[，,；;。]/).some(function (clause) {
      var negative = /(从未|没有|暂无|尚未|未曾|没).{0,20}(付费|付款|购买|支付)/.test(clause) || /未付费|没付费/.test(clause);
      var employment = /(工资|薪酬|岗位薪资|岗位支付|奖金)/.test(clause);
      var positive = /(客户|对方|机构|家长|学员|朋友|同事|有人|买方|用户|公司|组织).{0,24}(购买|付费|支付|付款|买了|买过)/.test(clause)
        || /(购买|付费|支付|付款|买了|买过).{0,20}(课程|咨询|服务|产品|工具|诊断|方案)/.test(clause)
        || /(曾|已经|实际|过去).{0,24}\d+(?:\.\d+)?(?:元|块).{0,16}(收费|成交|收款)/.test(clause);
      return positive && !negative && !employment;
    });
  }

  function hasObservedExternalOutcome(value) {
    return clean(value).split(/[，,；;。]/).some(function (clause) {
      var negative = /(没有|暂无|尚未|未曾|不能证明|无法证明)/.test(clause);
      var observed = /(客户|顾客|用户|学员|家长|经营者|对方).{0,24}(明确反馈|采纳|采用|继续使用|再次到店|再次购买|转介绍|主动复述)/.test(clause);
      return observed && !negative;
    });
  }

  function mergeEvidence(input) {
    var value = input || {};
    var deterministic = Array.isArray(value.deterministic) ? value.deterministic : [];
    var aiAccepted = Array.isArray(value.aiAccepted) ? value.aiAccepted : [];
    var seen = {};
    var merged = [];

    function add(item, origin) {
      if (!item || !item.source) return;
      var key = clean(item.source.field).toLowerCase() + '|' + clean(item.source.quote).toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      merged.push(Object.assign({}, item, {
        source: Object.assign({}, item.source),
        limitations: Array.isArray(item.limitations) ? item.limitations.slice() : [],
        origin: item.origin || origin
      }));
    }

    deterministic.forEach(function (item) { add(item, 'kevin_deterministic'); });
    aiAccepted.forEach(function (item) { add(item, 'deepseek_verified'); });
    return merged;
  }

  function buildEvidencePack(input) {
    var value = input || {};
    var core = value.coreAnswers || {};
    var branches = value.branchAnswers || {};
    var evidence = [];
    var missing = CORE_FIELDS.filter(function (field) { return !clean(core[field]); });
    var nextId = 1;

    function add(category, level, statement, field, raw, confidence, limitations) {
      var sourceQuote = quote(raw);
      if (!sourceQuote) return;
      evidence.push({
        id: 'evidence-' + String(nextId++).padStart(3, '0'),
        category: category,
        level: level,
        statement: statement,
        source: { field: field, quote: sourceQuote },
        confidence: confidence || (level === 'E0' ? 'low' : 'medium'),
        limitations: limitations || []
      });
    }

    if (clean(core.candidatePaths)) {
      add('interest', 'E0', '客户正在考虑一条或多条候选路径', 'candidatePaths', core.candidatePaths, 'low', ['候选路径不等于能力或市场需求']);
    }

    if (clean(core.caseOneProblem) && clean(core.caseOneAction) && clean(core.caseOneResult)) {
      add('case_event', 'E1', '客户描述了一个包含问题、动作和结果的事件', 'caseOneResult', core.caseOneResult, 'medium', ['仍需核对结果证明和客户本人贡献']);
      if (hasObservedExternalOutcome(core.caseOneResult)) {
        add('external_outcome', 'E3', '客户描述了可观察的外部对象行为结果', 'caseOneResult', core.caseOneResult, 'medium', ['外部行为与本人行动之间的因果关系仍需核对', '不等于外部客户愿意购买该服务']);
      }
    } else {
      ['caseOneProblem', 'caseOneAction', 'caseOneResult'].forEach(function (field) {
        if (missing.indexOf(field) === -1 && !clean(core[field])) missing.push(field);
      });
    }

    var caseTwo = clean(core.caseTwo);
    var noSecondEvent = /(想不出|没有|暂无|未有|无法提供|暂时没有).{0,12}(第二|另一个|独立|事件|案例)/.test(caseTwo);
    if (caseTwo && caseTwo.length >= 12 && !noSecondEvent) {
      add('repeated_event', 'E2', '客户描述了第二个独立事件，存在能力重复线索', 'caseTwo', core.caseTwo, 'medium', ['需确认两个事件是否真正独立且能力相同']);
    }

    var helpRequests = clean(core.helpRequests);
    var personPattern = '(同事|客户|朋友|团队|老板|管理者|负责人|经营者|学员|家长|机构|组织|对方|有人)';
    var deniesRequest = /(没有|暂无|未有|没).{0,12}(主动|请我|找我|问我|交给我)/.test(helpRequests);
    var positiveRequest = !deniesRequest && new RegExp(personPattern + '.{0,24}(请我|找我|问我|交给我|主动)').test(helpRequests);
    var deniesFeedback = /(没有|暂无|未有|没).{0,12}(反馈|认可|采用|结果)/.test(helpRequests);
    var positiveFeedback = !deniesFeedback && new RegExp(personPattern + '.{0,32}(反馈|认可|采用|结果|解决|找到)').test(helpRequests);
    if (helpRequests && (positiveRequest || positiveFeedback)) {
      add('external_feedback', 'E3', '客户描述了外部主动求助或反馈', 'helpRequests', core.helpRequests, 'medium', ['反馈强度和来源仍需人工核对']);
    }

    var costSignals = clean(core.costSignals);
    var deniesCost = /(没有|暂无|未有|没|不愿|未曾).{0,20}(投入|时间|资源|预算|配合)|无预算|未投入/.test(costSignals);
    var affirmsSomeCost = /(愿意|主动|安排|提供|参加|已经投入|持续记录|持续投入).{0,16}(时间|资源|预算|会议|录音|数据|人员|配合)|愿意让我投入时间/.test(costSignals);
    var noCostSignal = deniesCost && !affirmsSomeCost;
    if (costSignals && !noCostSignal) {
      add('cost_signal', 'E2', '对方曾为获得帮助投入时间、资源或配合', 'costSignals', core.costSignals, 'medium', ['投入不等于付费需求']);
    }

    if (clean(core.paidOutcome) && hasActualMarketPayment(core.paidOutcome)) {
      add('payment', 'E4', '客户描述了购买者为具体结果付费的记录', 'paidOutcome', core.paidOutcome, 'high', ['需核对交易是否真实发生及购买边界']);
    }

    var repeatPayment = clean(branches.business && branches.business.repeatPayment);
    if (repeatPayment && /(复购|续费|再次购买|转介绍)/.test(repeatPayment) && !/(没有|从未|暂无)/.test(repeatPayment)) {
      add('repeated_payment', 'E5', '客户描述了复购、续费或转介绍证据', 'business.repeatPayment', repeatPayment, 'high', ['需核对次数、时间跨度和购买原因']);
    }

    return { evidence: evidence, missing: missing };
  }

  return {
    levels: LEVELS.slice(),
    validateEvidenceLevel: validateEvidenceLevel,
    mergeEvidence: mergeEvidence,
    buildEvidencePack: buildEvidencePack
  };
}));
