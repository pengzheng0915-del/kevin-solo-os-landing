(function(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KevinAssessmentV3AdaptiveDiagnostic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  var ADAPTIVE_BASE_FIELD_IDS = [
    'industry',
    'years',
    'status',
    'problemSpecificity',
    'caseCountDetailed',
    'evidenceType',
    'costWillingnessSignal',
    'audienceAccess',
    'deliveryPreference',
    'deliverableReadiness',
    'hours',
    'validationCommitment'
  ];
  var SENSITIVE_TERMS = /心理|医疗|法律|财务|投资/;

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function values(source) {
    if (!source || typeof source !== 'object') return '';
    return Object.keys(source).map(function(key) {
      var value = source[key];
      return value && typeof value === 'object' ? values(value) : text(value);
    }).join(' ');
  }

  function getCommercialModel() {
    if (root.KevinCommercialDiagnosticModel) return root.KevinCommercialDiagnosticModel;
    if (typeof require === 'function') return require('../experience-commercial-diagnostic.js');
    return null;
  }

  function getQuestionModel() {
    if (root.KevinAssessmentV3Questions) return root.KevinAssessmentV3Questions;
    if (typeof require === 'function') return require('./questions.js');
    return null;
  }

  function getLegacyFields() {
    var model = getCommercialModel();
    var groups = model && model.deepGroups || [];
    return groups.reduce(function(all, group) {
      return all.concat(group.fields || []);
    }, []);
  }

  function getField(id) {
    return getLegacyFields().filter(function(field) { return field.id === id; })[0] || null;
  }

  function getSensitiveQualificationField() {
    var questions = getQuestionModel();
    var sensitive = questions && (questions.branchDefinitions || []).filter(function(branch) {
      return branch.id === 'sensitive';
    })[0];
    var question = sensitive && (sensitive.questions || []).filter(function(item) {
      return item.id === 'sensitive.qualification';
    })[0];
    if (!question) return null;
    return Object.assign({}, question, {
      type: 'text',
      valueHint: question.help || '用于确认专业资格和必须转交的边界。'
    });
  }

  function normalizeLegacyDeepData(deepData) {
    var normalized = Object.assign({}, deepData || {});
    var aliases = {
      caseCountDetailed: 'caseCount',
      evidenceType: 'evidenceQuality',
      deliverableReadiness: 'assetFormat',
      costWillingnessSignal: 'paidBefore'
    };
    Object.keys(aliases).forEach(function(canonical) {
      var legacy = aliases[canonical];
      if (!text(normalized[canonical]) && text(normalized[legacy])) {
        normalized[canonical] = normalized[legacy];
      }
    });
    return normalized;
  }

  function includes(value, pattern) {
    return pattern.test(text(value));
  }

  function getConditionalCandidates(context) {
    var input = context || {};
    var deepData = normalizeLegacyDeepData(input.deepData);
    var quizAnswers = input.quizAnswers || {};
    var diagnosticContext = input.diagnosticContext || {};
    var candidates = [];
    var organizationValue = text(deepData.organizationComplexity || diagnosticContext.organizationComplexity || quizAnswers.decisionType);
    var serviceValue = text(deepData.serviceDataReadiness || diagnosticContext.serviceDataReadiness || quizAnswers.decisionType);
    var anxietyValue = text(deepData.consumerAnxiety || diagnosticContext.consumerAnxiety || quizAnswers.realityState);
    var sensitiveValue = [
      deepData.sensitiveDomain,
      deepData.candidatePaths,
      diagnosticContext.sensitiveDomain,
      diagnosticContext.candidatePaths,
      diagnosticContext.coreAnswers && diagnosticContext.coreAnswers.candidatePaths
    ].join(' ');

    if (includes(organizationValue, /组织|战略|资源|决策权|老板|团队|复杂/)) {
      candidates.push({ id: 'organizationComplexity', priority: 300 });
    }
    if (includes(serviceValue, /客户|服务|交付|复购|转介绍|成交|经营|数据|business/)) {
      candidates.push({ id: 'serviceDataReadiness', priority: 100 });
    }
    if (includes(anxietyValue, /焦虑|快速赚钱|赶紧买答案|直接告诉我答案|同时试很多方向|现金流/)) {
      candidates.push({ id: 'consumerAnxiety', priority: 250 });
    }
    if (SENSITIVE_TERMS.test(sensitiveValue)) {
      candidates.push({ id: 'sensitive.qualification', priority: 400 });
    }

    return candidates.sort(function(a, b) { return b.priority - a.priority; }).slice(0, 2);
  }

  function getVisibleFieldIds(context) {
    var conditional = getConditionalCandidates(context).map(function(candidate) { return candidate.id; });
    return {
      base: ADAPTIVE_BASE_FIELD_IDS.slice(),
      conditional: conditional,
      aiFieldIds: ADAPTIVE_BASE_FIELD_IDS.concat(conditional)
    };
  }

  function buildAdaptiveGroups(context) {
    var visible = getVisibleFieldIds(context);
    var requiredIds = (context && context.requireName === false ? [] : ['name']).concat(visible.base, visible.conditional);
    var fields = requiredIds.map(function(id) {
      return id === 'sensitive.qualification' ? getSensitiveQualificationField() : getField(id);
    }).filter(Boolean);
    var groupDefinitions = [
      { id: 'adaptive-background', title: '基础背景', description: '确认当前经验和现实约束。', fieldIds: ['name', 'industry', 'years', 'status'] },
      { id: 'adaptive-evidence', title: '经验与证据', description: '判断经验是否已有可核对的案例和证据。', fieldIds: ['problemSpecificity', 'caseCountDetailed', 'evidenceType'] },
      { id: 'adaptive-validation', title: '验证信号', description: '确认外部信号和第一版交付方向。', fieldIds: ['costWillingnessSignal', 'audienceAccess', 'deliveryPreference'] },
      { id: 'adaptive-commitment', title: '投入与必要补充', description: '确认交付准备、投入边界和必要的风险信息。', fieldIds: ['deliverableReadiness', 'hours', 'validationCommitment'].concat(visible.conditional) }
    ];

    return groupDefinitions.map(function(group) {
      return {
        id: group.id,
        title: group.title,
        desc: group.description,
        description: group.description,
        fields: group.fieldIds.map(function(id) {
          return fields.filter(function(field) { return field.id === id; })[0];
        }).filter(Boolean)
      };
    });
  }

  return {
    adaptiveBaseFieldIds: ADAPTIVE_BASE_FIELD_IDS.slice(),
    getVisibleFieldIds: getVisibleFieldIds,
    buildAdaptiveGroups: buildAdaptiveGroups,
    normalizeLegacyDeepData: normalizeLegacyDeepData
  };
});
