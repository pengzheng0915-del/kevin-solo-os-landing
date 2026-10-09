(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinPaidQuestionnaireModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var REVISION = 'paid-evidence-v2';
  var LEGACY_REVISION = 'paid-evidence-v1';
  var CORE_FIELDS = new Set([
    'decision',
    'caseOneProblem',
    'caseOneAction',
    'caseOneResult',
    'caseBoundaryTransfer',
    'nearestIncident'
  ]);
  var CONTEXT_FIELDS = new Set(['industry', 'years', 'status', 'hours']);
  var CONSTRAINT_FIELDS = new Set([
    'industry',
    'years',
    'status',
    'hours',
    'audienceAccess',
    'organizationComplexity',
    'serviceDataReadiness',
    'consumerAnxiety',
    'sensitive.qualification'
  ]);
  var HONEST_UNKNOWN = /^(?:(?:目前|暂时|现在)\s*(?:还\s*)?(?:没有|暂无|不清楚|无法|不能|想不到|说不出来)|(?:暂无|还没有|尚无|不清楚|不确定|无法|不能|想不到|说不出来))/;

  var QUESTIONS = [
    {
      id: 'decision',
      stage: 'decision',
      source: 'core',
      type: 'textarea',
      required: true,
      reportSlot: 'decision',
      label: '这次你最需要做清楚的决定是什么？',
      help: '只写当前最需要判断的一件事，以及你正在比较的方向。',
      sentenceStarter: '我现在最想判断的是____，因为____。',
      factChecks: ['只写一件当前问题', '写清正在比较的方向'],
      affects: '本次报告回答的问题'
    },
    {
      id: 'industry',
      stage: 'context',
      source: 'branch',
      type: 'single',
      required: true,
      reportSlot: 'context',
      label: '你的相关经验主要发生在哪个行业？',
      help: '只用于建立报告语境，不直接决定能力高低。',
      options: ['互联网 / IT', '金融', '制造业', '教育 / 培训', '医疗 / 健康', '咨询 / 服务', '政府 / 国企', '其他 / 不便说明'],
      affects: '报告语境'
    },
    {
      id: 'years',
      stage: 'context',
      source: 'branch',
      type: 'single',
      required: true,
      reportSlot: 'context',
      label: '你有多少年相关工作经验？',
      help: '年限只说明经历背景，不代表能力等级。',
      options: ['1-3 年', '4-8 年', '9-15 年', '16 年以上', '暂时无法判断'],
      affects: '经验背景'
    },
    {
      id: 'status',
      stage: 'context',
      source: 'branch',
      type: 'single',
      required: true,
      reportSlot: 'constraint',
      label: '你当前的工作状态更接近哪一种？',
      help: '报告会据此避开不符合现实状态的建议。',
      options: ['在职', '自由职业', '正在探索新方向', '暂时没有稳定工作', '其他状态'],
      affects: '现实约束'
    },
    {
      id: 'hours',
      stage: 'context',
      source: 'branch',
      type: 'single',
      required: true,
      reportSlot: 'constraint',
      label: '接下来每周能稳定投入多少时间？',
      help: '请按可以长期做到的时间选择，不按理想状态选择。',
      options: ['暂时无法稳定投入', '每周 1-3 小时', '每周 4-8 小时', '每周 8 小时以上'],
      affects: '下一步行动强度'
    },
    {
      id: 'caseAvailability',
      stage: 'evidence',
      source: 'root',
      type: 'single',
      required: true,
      reportSlot: 'evidence',
      label: '你现在能拿出哪一种真实经历？',
      help: '选择最接近当前事实的一项。没有完整案例也可以继续。',
      options: [
        { value: 'has_case', label: '有一件完整经历', detail: '能说清问题、判断、动作和结果' },
        { value: 'nearest_incident', label: '有一件接近的真实小事', detail: '不完整，但确实发生过' },
        { value: 'no_case', label: '目前没有可用案例', detail: '按真实情况继续，不需要编故事' }
      ],
      affects: '报告能判断到多深'
    },
    {
      id: 'caseCountDetailed',
      stage: 'evidence',
      source: 'branch',
      type: 'single',
      required: true,
      route: 'has_case',
      reportSlot: 'evidence',
      label: '类似经历大约能还原几件？',
      help: '只看能够讲清事实的案例，不计算模糊印象。',
      options: ['只能还原这 1 件', '能还原 2-3 件', '能还原 4-5 件', '能还原 5 件以上，并包含结果或反馈'],
      affects: '能力是否可能重复'
    },
    {
      id: 'evidenceType',
      stage: 'evidence',
      source: 'branch',
      type: 'single',
      required: true,
      route: 'has_case',
      reportSlot: 'evidence',
      label: '这件经历目前有什么可以核对？',
      help: '选择最硬的一项。后面仍要写实际发生的结果。',
      options: ['目前没有可核对材料', '只有自己的回忆或复盘', '有具体反馈或结果记录', '有采用、转介绍或付费记录'],
      affects: '证据强度'
    },
    {
      id: 'costWillingnessSignal',
      stage: 'evidence',
      source: 'branch',
      type: 'single',
      required: true,
      route: 'has_case',
      reportSlot: 'external_signal',
      label: '别人曾为这类帮助投入过什么？',
      help: '点赞和夸奖不算成本。时间、材料、转介绍和付费更有意义。',
      options: ['暂时没有发生', '愿意继续聊', '愿意投入时间或材料配合', '已经付费、复购或转介绍'],
      affects: '需求和付费阶段'
    },
    {
      id: 'audienceAccess',
      stage: 'evidence',
      source: 'branch',
      type: 'single',
      required: true,
      route: 'has_case',
      reportSlot: 'constraint',
      label: '你现在能接触到多少真实验证对象？',
      help: '这里只判断下一步是否有真实对象可验证，不证明市场需求。',
      options: ['暂时找不到可验证对象', '有少量熟人或旧同事可以访问', '有稳定私域或小社群可以验证', '有公开渠道或稳定客户来源'],
      affects: '验证动作是否可执行'
    },
    {
      id: 'caseOneProblem',
      stage: 'case',
      source: 'core',
      type: 'textarea',
      required: true,
      route: 'has_case',
      reportSlot: 'known',
      label: '当时具体发生了什么？',
      help: '写清场景、谁遇到了什么问题，以及现实限制。',
      sentenceStarter: '在____场景里，____遇到了____问题。',
      factChecks: ['具体场景', '谁遇到什么问题', '当时有哪些限制'],
      affects: '真实问题与案例成立条件'
    },
    {
      id: 'caseOneAction',
      stage: 'case',
      source: 'core',
      type: 'textarea',
      required: true,
      route: 'has_case',
      reportSlot: 'known',
      label: '当时有哪些选择，你为什么这样判断？',
      help: '只写你亲自做出的判断和动作。',
      sentenceStarter: '我先____，因为____；然后____。',
      factChecks: ['比较过的选择', '判断依据', '亲自完成的动作'],
      affects: '能力判断与适用边界'
    },
    {
      id: 'caseOneResult',
      stage: 'case',
      source: 'core',
      type: 'textarea',
      required: true,
      route: 'has_case',
      reportSlot: 'known',
      label: '后来发生了什么，有什么可以核对？',
      help: '写实际变化、反馈或材料。没有可核对结果也请如实写。',
      sentenceStarter: '后来____；目前可以核对的是____。',
      factChecks: ['实际发生的变化', '反馈或材料', '仍不能证明的部分'],
      affects: '结果证据与当前阶段'
    },
    {
      id: 'caseBoundaryTransfer',
      stage: 'case',
      source: 'core',
      type: 'textarea',
      required: true,
      route: 'has_case',
      reportSlot: 'boundary',
      label: '这套做法在什么情况下会失效？',
      help: '写出适用条件，以及不能直接照搬的情况。',
      sentenceStarter: '这套做法适合____；遇到____时可能不适用。',
      factChecks: ['适用条件', '失效边界'],
      affects: '报告边界'
    },
    {
      id: 'nearestIncident',
      stage: 'case',
      source: 'core',
      type: 'textarea',
      required: true,
      route: 'limited',
      reportSlot: 'known',
      label: '最近有没有一件最接近的真实小事？',
      help: '可以只写发生了什么和你做过的部分。确实没有也请如实写。',
      sentenceStarter: '最近一次接近的真实小事是____；我当时做了____。',
      factChecks: ['确实发生过', '本人做过的部分'],
      affects: '有限报告的真实起点'
    }
  ];

  var CONDITIONAL_QUESTIONS = [
    {
      id: 'sensitive.qualification',
      priority: 400,
      pattern: /心理|医疗|法律|财务|投资/,
      label: '这项经验是否涉及持证专业判断？',
      help: '自动报告不能替代持证专业人士。请选择你的真实边界。',
      options: ['不涉及持证专业判断', '只整理个人经验，专业问题会转交', '具备相关资格并清楚执业边界', '暂时不确定，需要人工确认']
    },
    {
      id: 'organizationComplexity',
      priority: 300,
      pattern: /组织|战略|资源|决策权|老板|团队|复杂/,
      label: '这个问题涉及怎样的组织权责？',
      help: '组织因素越复杂，自动报告越需要保守。',
      options: ['不涉及，主要是个人选择', '部分涉及老板或团队', '明显涉及公司战略、权责或资源', '我没有决策权，只是推动者']
    },
    {
      id: 'consumerAnxiety',
      priority: 250,
      pattern: /焦虑|快速赚钱|赶紧买答案|同时试很多方向|现金流/,
      label: '你现在希望这份报告替你解决什么？',
      help: '报告支持判断，但不能替你承担选择结果。',
      options: ['先看清事实，不急着得到乐观答案', '害怕选错，所以想同时尝试多个方向', '最近很焦虑，希望尽快得到确定答案', '希望快速赚钱，最好直接告诉我做什么']
    },
    {
      id: 'serviceDataReadiness',
      priority: 100,
      pattern: /客户|服务|交付|复购|转介绍|成交|经营|数据|business/i,
      label: '如果已经有客户服务，你记录了哪些数据？',
      help: '已有服务时，报告需要区分起步问题和经营问题。',
      options: ['还没有客户或服务', '有客户和交付，但没有复盘数据', '有客户数、复购、转介绍或成交来源记录', '暂时无法确认']
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function answerState(value) {
    var current = text(value);
    if (!current) return 'missing';
    return HONEST_UNKNOWN.test(current) ? 'explicit_unknown' : 'answered';
  }

  function routeFor(input) {
    var route = text(input && input.caseAvailability);
    if (route === 'has_case') return 'has_case';
    if (route === 'nearest_incident' || route === 'no_case') return 'limited';
    return 'unselected';
  }

  function getFieldValue(input, id) {
    var source = input || {};
    if (id === 'caseAvailability') return source.caseAvailability;
    if (CORE_FIELDS.has(id)) return source.coreAnswers && source.coreAnswers[id];
    return source.branchAnswers && source.branchAnswers[id];
  }

  function conditionalText(input) {
    var source = input || {};
    return [source.screeningAnswers, source.diagnosticContext, source.branchAnswers, source.coreAnswers && source.coreAnswers.decision]
      .map(function (value) {
        if (value && typeof value === 'object') return Object.values(value).join(' ');
        return text(value);
      })
      .join(' ');
  }

  function visibleConditionals(input) {
    var sourceText = conditionalText(input);
    return CONDITIONAL_QUESTIONS
      .filter(function (item) { return item.pattern.test(sourceText); })
      .sort(function (left, right) { return right.priority - left.priority; })
      .slice(0, 2)
      .map(function (item) {
        return Object.assign({}, item, {
          stage: 'boundary',
          source: 'branch',
          type: 'single',
          required: true,
          reportSlot: 'constraint',
          affects: '专业或现实边界',
          conditional: true
        });
      });
  }

  function getVisibleQuestions(input) {
    var route = routeFor(input);
    var visible = QUESTIONS.filter(function (question) {
      if (!question.route) return true;
      return question.route === route;
    });
    return visible.concat(visibleConditionals(input)).map(clone);
  }

  function requiredFields(input) {
    return getVisibleQuestions(input).filter(function (question) { return question.required; }).map(function (question) { return question.id; });
  }

  function canFinalize(input) {
    var missingFields = requiredFields(input).filter(function (id) {
      return answerState(getFieldValue(input, id)) === 'missing';
    });
    return {
      pass: missingFields.length === 0,
      firstMissing: missingFields[0] || '',
      missingFields: missingFields
    };
  }

  function reviewItem(input, question) {
    return {
      field: question.id,
      label: question.label,
      state: answerState(getFieldValue(input, question.id)),
      value: text(getFieldValue(input, question.id))
    };
  }

  function buildReview(input) {
    var questions = getVisibleQuestions(input);
    var items = questions.map(function (question) { return reviewItem(input, question); });
    var decisionItems = items.filter(function (item) { return item.field === 'decision'; });
    var constraintItems = items.filter(function (item) { return CONSTRAINT_FIELDS.has(item.field) && item.state !== 'missing'; });
    var unknownItems = items.filter(function (item) {
      return item.state === 'explicit_unknown' && !CONSTRAINT_FIELDS.has(item.field);
    });
    if (text(input && input.caseAvailability) === 'no_case') {
      unknownItems.unshift({
        field: 'caseAvailability',
        label: '当前案例状态',
        state: 'explicit_unknown',
        value: '目前没有可用案例'
      });
    }
    var excluded = new Set(decisionItems.concat(constraintItems, unknownItems).map(function (item) { return item.field; }));
    var evidenceItems = items.filter(function (item) {
      return item.state === 'answered' && !excluded.has(item.field) && item.field !== 'caseAvailability';
    });
    return [
      { id: 'decision', title: '本次要判断', items: decisionItems },
      { id: 'evidence', title: '已提供证据', items: evidenceItems },
      { id: 'unknown', title: '明确未知', items: unknownItems },
      { id: 'constraints', title: '现实约束', items: constraintItems }
    ];
  }

  return {
    REVISION: REVISION,
    LEGACY_REVISION: LEGACY_REVISION,
    answerState: answerState,
    getVisibleQuestions: getVisibleQuestions,
    requiredFields: requiredFields,
    buildReview: buildReview,
    canFinalize: canFinalize
  };
}));
