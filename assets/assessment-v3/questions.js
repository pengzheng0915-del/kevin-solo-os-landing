(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3Questions = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var screeningQuestions = [
    {
      id: 'decisionType',
      label: '你现在主要在判断哪一类问题？',
      type: 'single',
      options: ['career', 'productization', 'business', 'organization', 'continue'],
      required: true
    },
    {
      id: 'experienceStage',
      label: '你的相关经验目前更接近哪个阶段？',
      type: 'single',
      options: ['accumulating', 'repeatable', 'validated', 'commercialized'],
      required: true
    },
    {
      id: 'evidenceState',
      label: '你目前能拿出的结果证据到哪一步？',
      type: 'single',
      options: ['none', 'self_reported', 'feedback', 'measurable', 'repeatable'],
      required: true
    },
    {
      id: 'demandState',
      label: '外部需求或付费信号目前到哪一步？',
      type: 'single',
      options: ['none', 'asked', 'time_or_resource', 'paid_once', 'repeat_paid'],
      required: true
    },
    {
      id: 'realityState',
      label: '未来 30 天，你能投入多少真实行动？',
      type: 'single',
      options: ['observe_only', 'under_3_hours', '3_to_8_hours', 'over_8_hours'],
      required: true
    }
  ];

  var coreQuestions = [
    {
      id: 'decision',
      label: '你现在最需要做清楚的决定是什么？',
      help: '只写当前最需要判断的一件事，并说明可选方向。',
      purpose: '明确本次报告要帮助你做出的现实决定。',
      evidenceCategory: 'decision',
      minimumLength: 20,
      required: true
    },
    {
      id: 'urgency', label: '为什么你现在开始认真考虑这件事？', help: '写出最近发生的变化或触发点。',
      purpose: '判断问题的时效性和触发原因。', evidenceCategory: 'context', minimumLength: 20, required: false
    },
    {
      id: 'unacceptableOutcome', label: '这次选择中，你最不能接受的结果是什么？', help: '包括时间、收入、家庭或职业风险。',
      purpose: '识别必须优先保护的现实边界。', evidenceCategory: 'boundary', minimumLength: 20, required: false
    },
    {
      id: 'caseOneProblem',
      label: '请写一个你真实解决过的问题。',
      help: '当时是谁遇到了什么具体问题？',
      purpose: '确认你的经验对应了谁的什么真实问题。',
      evidenceCategory: 'problem',
      minimumLength: 20,
      required: true
    },
    {
      id: 'caseOneAction',
      label: '在这个事件里，你做了哪些判断和动作？',
      help: '写你亲自完成的部分，不只写岗位职责。',
      purpose: '区分你的真实能力与职位赋予的职责。',
      evidenceCategory: 'action',
      minimumLength: 20,
      required: true
    },
    {
      id: 'caseOneResult',
      label: '最后发生了什么，可以用什么证明？',
      help: '可以是结果、反馈、截图、复购或后续变化。',
      purpose: '验证你的动作是否产生了可观察的结果。',
      evidenceCategory: 'result',
      minimumLength: 20,
      required: true
    },
    {
      id: 'caseTwo', label: '还有没有另一次相似经历？', help: '写另一个独立事件，用来判断能力是否可重复。',
      purpose: '判断这项能力是否可重复。', evidenceCategory: 'repeatability', minimumLength: 20, required: false
    },
    {
      id: 'helpRequests', label: '最近几次，别人主动因为什么事来找你？', help: '写清是谁、什么问题、为什么找你。',
      purpose: '识别外部世界已经如何理解你的价值。', evidenceCategory: 'demand', minimumLength: 20, required: false
    },
    {
      id: 'costSignals',
      label: '为了得到你的帮助，对方投入过什么？',
      help: '例如时间、配合、资源、转介绍或预算；没有也请如实说明。',
      purpose: '判断需求是否已经从口头认可走向真实成本。',
      evidenceCategory: 'demand',
      minimumLength: 20,
      required: true
    },
    {
      id: 'paidOutcome', label: '是否有人为你的哪一种结果付过费？', help: '没有就写没有；有则写购买者和购买结果。',
      purpose: '识别已经发生的付费验证。', evidenceCategory: 'payment', minimumLength: 20, required: false
    },
    {
      id: 'candidatePaths', label: '你正在考虑哪些路径？各自的支持和反对证据是什么？', help: '区分事实、兴趣和想象。',
      purpose: '比较不同路径，而不是直接套入单一答案。', evidenceCategory: 'path', minimumLength: 20, required: false
    },
    {
      id: 'rejectedState', label: '即使能赚钱，你也不愿长期接受什么工作状态？', help: '这会决定哪条路不适合长期投入。',
      purpose: '排除不符合长期边界的路径。', evidenceCategory: 'boundary', minimumLength: 20, required: false
    }
  ];

  var recallOptions = [
    { id: 'solved_problem', label: '有人找我解决过一个问题' },
    { id: 'unstuck_work', label: '我把一件卡住的事情推进了' },
    { id: 'avoided_loss', label: '我避免过一次错误或损失' },
    { id: 'reusable_method', label: '我整理过一套别人能使用的方法' },
    { id: 'external_adoption', label: '别人曾经认可、采用或付费' },
    { id: 'not_yet', label: '暂时想不到' }
  ];

  function getRecallOptions() {
    return recallOptions.map(function (item) {
      return { id: item.id, label: item.label };
    });
  }

  var adaptiveOpenQuestions = [
    {
      id: 'decision',
      label: '你现在最需要做清楚的决定是什么？',
      help: '只写当前最需要判断的一件事。',
      sentenceStarter: '我现在最想判断的是____，因为____。',
      factChecks: ['只写一件当前问题', '写清正在比较的方向'],
      skipLabel: '暂时没有或想不清，诚实跳过',
      purpose: '明确本次报告真正要帮助你判断的现实问题。',
      evidenceCategory: 'decision',
      // 减负（规格第 7 条）：不再作为第 5 步的必填题，仅在其它入口需要时使用
      required: false
    },
    {
      id: 'caseOneProblem',
      label: '当时是什么问题？',
      help: '写清是谁、在什么场景下、遇到了什么具体问题，以及为什么由你处理。',
      sentenceStarter: '在____场景里，____遇到了____问题，希望我____。',
      factChecks: ['具体场景', '谁遇到了什么问题', '为什么由你处理'],
      skipLabel: '暂时没有或想不清，诚实跳过',
      purpose: '确认经验发生在什么具体条件下。',
      evidenceCategory: 'problem',
      required: true
    },
    {
      id: 'caseOneAction',
      label: '你具体做了什么？',
      help: '写你亲自完成的动作和当时的判断依据，不只写岗位职责。',
      sentenceStarter: '我先____，因为____；然后我又____。',
      factChecks: ['本人亲自完成的动作', '当时的判断依据'],
      skipLabel: '暂时没有或想不清，诚实跳过',
      purpose: '识别真正属于你的判断和行动。',
      evidenceCategory: 'action',
      required: true
    },
    {
      id: 'caseOneResult',
      label: '实际结果是什么？',
      help: '有结果就写结果、反馈或材料；没有可核对结果也请如实写。',
      sentenceStarter: '后来____；目前可以核对的是____。',
      factChecks: ['实际发生的变化', '反馈、材料或其他外部信号'],
      skipLabel: '暂时没有或想不清，诚实跳过',
      purpose: '区分真实结果、外部信号和尚未验证的解释。',
      evidenceCategory: 'result',
      required: true
    },
    {
      id: 'caseBoundaryTransfer',
      label: '这套做法在什么情况下适用，又会在什么情况下失效？（选填）',
      help: '如果现在还不清楚，可以直接跳过；跳过不影响生成摘要。',
      sentenceStarter: '这套做法适合____；遇到____时可能不适用。',
      factChecks: ['适用条件', '可能失效的边界'],
      skipLabel: '暂时没有或想不清，直接跳过',
      purpose: '避免把一次经历直接写成普遍规律。',
      evidenceCategory: 'boundary',
      // 减负（规格第 7 条）：这一题是"最多保留的 1 个可选"，不再是必填
      required: false
    },
    {
      id: 'nearestIncident',
      label: '如果没有完整案例，最近有没有一件最接近的真实小事？',
      help: '可以只写发生了什么；确实没有可以直接跳过。',
      sentenceStarter: '最近一次接近的真实小事是____；我当时做了____。',
      factChecks: ['确实发生过的小事', '本人做过的部分'],
      skipLabel: '暂时没有或想不清，诚实跳过',
      purpose: '在不编造案例的前提下，尽量找到一个真实起点。',
      evidenceCategory: 'case_evidence',
      required: false
    }
  ];

  var honestAbsencePattern = /^(?:(?:目前|暂时|现在)\s*(?:还\s*)?(?:没有|暂无|不清楚|无法核对|想不到|说不出来)|(?:暂无|还没有|不清楚|无法核对|想不到|说不出来)(?:[。！!？?]|$)|没有(?:[。！!？?]|$))/;

  function getInitialScreeningQuestions() {
    return screeningQuestions.slice();
  }

  function classifyAnswer(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return 'missing';
    return honestAbsencePattern.test(text) ? 'honest_absence' : 'answered';
  }

  /* 第 5 步真实经历（规格第 7 条减负）：
   * 必填 = 当时是什么问题 / 你具体做了什么 / 实际结果是什么（3 题）
   * 可选 = 适用边界或补充（最多 1 题）
   * 不再要求用户连续回答 6 个开放题。
   */
  function getOpenQuestionIds(context) {
    var route = String((context || {}).caseAvailability || 'has_case');
    if (route === 'no_case' || route === 'nearest_incident') {
      return ['nearestIncident'];
    }
    return ['caseOneProblem', 'caseOneAction', 'caseOneResult', 'caseBoundaryTransfer'];
  }

  function getOpenQuestions(context) {
    var ids = getOpenQuestionIds(context);
    return ids.map(function (id) {
      return adaptiveOpenQuestions.filter(function (item) { return item.id === id; })[0];
    });
  }

  function getCoreExperienceQuestions(context) {
    return getOpenQuestions(context || { caseAvailability: 'has_case' });
  }

  var branchDefinitions = [
    {
      id: 'career',
      label: '职业再定位补充题',
      match: function (a) { return a.decisionType === 'career'; },
      questions: [
        { id: 'career.currentConstraint', label: '你当前最现实的职业约束是什么？' },
        { id: 'career.transferableEvidence', label: '哪些能力离开当前公司仍然成立？请举证。' }
      ]
    },
    {
      id: 'productization',
      label: '经验产品化补充题',
      match: function (a) { return a.decisionType === 'productization'; },
      questions: [
        { id: 'productization.buyer', label: '谁最可能购买什么结果？' },
        { id: 'productization.minimumDelivery', label: '你能先交付的最小结果是什么？' }
      ]
    },
    {
      id: 'business',
      label: '已有服务经营补充题',
      match: function (a) { return a.decisionType === 'business'; },
      questions: [
        { id: 'business.repeatPayment', label: '是否出现复购、续费或转介绍？请写事实。' },
        { id: 'business.deliveryBoundary', label: '目前最难稳定复制的交付环节是什么？' }
      ]
    },
    {
      id: 'organization',
      label: '组织问题补充题',
      match: function (a) { return a.decisionType === 'organization'; },
      questions: [
        { id: 'organization.decisionAuthority', label: '你在这件事上拥有什么决策权？' },
        { id: 'organization.stakeholders', label: '还有哪些关键相关方会影响结果？' }
      ]
    },
    {
      id: 'sensitive',
      label: '专业边界补充题',
      match: function (a) { return /心理|医疗|法律|财务|投资/.test(String(a.sensitiveDomain || a.candidatePaths || '')); },
      questions: [
        { id: 'sensitive.qualification', label: '你是否具备相关专业资格和执业边界？' },
        { id: 'sensitive.riskBoundary', label: '哪些问题必须转交给持证专业人士？' }
      ]
    }
  ];

  function getVisibleBranches(answers) {
    var value = answers || {};
    return branchDefinitions.filter(function (item) { return item.match(value); });
  }

  function validateRequiredAnswers(answers, context) {
    var value = answers || {};
    var route = (context || {}).caseAvailability || value.caseAvailability || 'has_case';
    return getOpenQuestions({ caseAvailability: route }).filter(function (item) {
      if (!item.required) return false;
      return classifyAnswer(value[item.id]) === 'missing';
    }).map(function (item) { return item.id; });
  }

  return {
    screeningQuestions: screeningQuestions,
    coreQuestions: coreQuestions,
    adaptiveOpenQuestions: adaptiveOpenQuestions,
    branchDefinitions: branchDefinitions,
    getInitialScreeningQuestions: getInitialScreeningQuestions,
    getCoreExperienceQuestions: getCoreExperienceQuestions,
    getOpenQuestionIds: getOpenQuestionIds,
    getOpenQuestions: getOpenQuestions,
    getRecallOptions: getRecallOptions,
    classifyAnswer: classifyAnswer,
    getVisibleBranches: getVisibleBranches,
    validateRequiredAnswers: validateRequiredAnswers
  };
}));
