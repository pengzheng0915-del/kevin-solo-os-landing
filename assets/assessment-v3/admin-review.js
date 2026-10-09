(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AssessmentV3AdminReview = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELD_LABELS = {
    decision: '当前最需要做清楚的决定',
    caseAvailability: '当前是否有真实案例',
    caseOneProblem: '真实经历中的问题',
    caseOneAction: '客户亲自采取的行动',
    caseOneResult: '实际结果与证明',
    caseBoundaryTransfer: '经验适用边界',
    nearestIncident: '最接近的真实小事',
    costSignals: '对方投入与付费信号',
    context: '发生场景',
    problem: '真实问题',
    goalAndConstraints: '目标与限制',
    alternativesAndJudgement: '选择与判断依据',
    actions: '采取的行动',
    result: '实际结果',
    externalSignals: '外部反馈',
    boundaryAndTransfer: '适用与失效边界',
    problemSpecificity: '问题是否足够具体',
    caseCount: '已有案例数量',
    caseCountDetailed: '可核对的案例数量',
    evidenceQuality: '现有证据质量',
    evidenceType: '现有证据类型',
    audienceAccess: '可联系的真实对象',
    deliveryPreference: '倾向的交付方式',
    validationCommitment: '愿意完成的验证行动',
    costWillingnessSignal: '对方成本投入信号',
    deliverableReadiness: '交付物准备程度',
    hours: '每周可投入时间',
    industry: '所在行业',
    years: '从业年限',
    status: '当前职业状态',
    friends: '可联系的熟人',
    otherFans: '可触达的其他受众',
    hourlyRate: '期望时间回报',
    confidence: '当前把握程度',
    pastTry: '过去尝试',
    pastResult: '过去尝试结果',
    bottleneck: '当前主要卡点',
    assetFormat: '已有经验资产形式',
    consultedBefore: '是否提供过咨询',
    paidBefore: '是否获得过付费',
    helpRequests: '他人主动求助信号',
    caseTwo: '第二个案例',
    repeatPayment: '复购或重复付费',
    decisionAuthority: '决策权限',
    timeAvailable: '可投入时间',
    organizationComplexity: '组织协作复杂度',
    serviceDataReadiness: '服务数据准备程度',
    consumerAnxiety: '个人客户顾虑'
  };

  var STATUS_LABELS = {
    review_required: '系统建议：重点复核',
    approved: '已标记复核通过',
    rejected: '已标记需要调整',
    ready: '报告已生成',
    limited: '信息有限，已生成保守报告',
    analyzing: '个性化分析中',
    retryable_error: '生成失败，可重试'
  };

  var PATH_STATUS_LABELS = {
    priority: '优先考虑',
    recommended: '优先考虑',
    test: '先小范围验证',
    defer: '暂缓',
    hold: '暂缓',
    avoid: '暂不建议',
    not_recommended: '暂不建议'
  };

  var REASON_LABELS = {
    source_field_not_found: '在客户原回答中找不到对应字段',
    source_quote_not_found: '引用内容没有出现在客户原话中',
    quote_not_found: '引用内容没有出现在客户原话中',
    unsupported_claim: '这项结论超出了客户提供的信息',
    unsupported_number: '数字缺少客户原始回答依据',
    generic_copy: '表述过于通用，不能体现这位客户',
    rule_conflict: '与 Kevin 的判断边界冲突',
    missing_action: '建议不够具体，无法直接行动',
    customer_voice: '使用了内部视角，不适合直接给客户看',
    primary_judgement_requires_evidence: '核心判断缺少可核对证据'
  };

  function text(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    return '';
  }

  function containsChinese(value) {
    return /[\u3400-\u9fff]/.test(text(value));
  }

  function fieldLabel(field) {
    var raw = text(field);
    var key = raw.split('.').pop();
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    var followUp = raw.match(/followup-r\d+-question-(\d+)/i);
    if (followUp) return '补充回答 ' + followUp[1];
    return containsChinese(raw) ? raw : '其他补充信息';
  }

  function statusLabel(status) {
    return STATUS_LABELS[text(status)] || '状态待确认';
  }

  function pathStatusLabel(status) {
    return PATH_STATUS_LABELS[text(status)] || '待判断';
  }

  function rawReason(value) {
    if (value && typeof value === 'object') {
      return text(value.reason || value.code || value.text);
    }
    return text(value);
  }

  function reasonLabel(value) {
    var reason = rawReason(value);
    if (REASON_LABELS[reason]) return REASON_LABELS[reason];
    if (reason.indexOf('missing_required_section:') === 0) return '报告缺少必要内容';
    if (reason.indexOf('unknown_evidence:') === 0) return '报告引用了不存在的证据';
    if (reason.indexOf('unsupported_arabic_number:') === 0) return '报告中的数字缺少客户原话依据';
    if (reason.indexOf('unreasonable_action_number:') === 0) return '行动建议中的数字不合理';
    if (reason.indexOf('generic_phrase:') === 0) return '报告出现了过于通用的套话';
    if (reason.indexOf('prohibited_conclusion:') === 0) return '报告越过了不能下的判断结论';
    if (containsChinese(reason)) return reason;
    return reason ? '系统发现一项需要人工核对的问题' : '未通过证据核验';
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(function (item) {
      return item !== null && item !== undefined && text(
        item && typeof item === 'object' ? item.reason || item.code || item.text : item
      );
    }) : [];
  }

  function addCheck(checks, title, standard) {
    var normalizedTitle = text(title);
    var normalizedStandard = text(standard);
    if (!normalizedTitle || !normalizedStandard || checks.length >= 5) return;
    var duplicated = checks.some(function (item) {
      return item.title === normalizedTitle;
    });
    if (!duplicated) checks.push({ title: normalizedTitle, standard: normalizedStandard });
  }

  function qualityStandard(issue) {
    var raw = rawReason(issue);
    if (raw === 'primary_judgement_requires_evidence') {
      return '核心判断必须明确写成“待验证”或“证据有限”，不能把推测写成已经成立。';
    }
    if (raw.indexOf('unknown_evidence:') === 0 || raw.indexOf('unsupported_arabic_number:') === 0) {
      return '相关结论或数字必须能在客户原回答中找到依据；找不到就应删除或改成待验证。';
    }
    if (raw.indexOf('prohibited_conclusion:') === 0) {
      return '删除承诺性结论，只保留有边界的判断和低成本验证建议。';
    }
    return '确认这项问题已在报告中被修正；没有修正就标记“需要调整”。';
  }

  function reportFieldLabel(fieldPath) {
    var raw = text(fieldPath);
    var indexed = raw.match(/^(understoodFacts|pathComparison|sevenDayAction|doNotDo|uncertainty)\[(\d+)\]/);
    if (indexed) {
      var labels = {
        understoodFacts: '判断依据',
        pathComparison: '路径排序',
        sevenDayAction: '7 天行动',
        doNotDo: '暂时不要做',
        uncertainty: '判断边界'
      };
      return labels[indexed[1]] + '第 ' + String(Number(indexed[2]) + 1) + ' 条';
    }
    if (raw.indexOf('primaryJudgement') === 0) return '核心判断';
    return '客户可见报告';
  }

  function criticStandard(issue) {
    var code = text(issue && issue.code);
    if (code === 'customer_voice') {
      return '删除模型、后台、内部流程、复核状态和第三人称措辞，只保留直接对客户有用的判断、依据或行动。';
    }
    return qualityStandard(issue);
  }

  function buildReviewGuidance(data) {
    var value = data && typeof data === 'object' ? data : {};
    var report = value.report_candidate && typeof value.report_candidate === 'object'
      ? value.report_candidate
      : null;
    var evidence = value.evidence && typeof value.evidence === 'object' ? value.evidence : {};
    var accepted = Array.isArray(evidence.accepted) ? evidence.accepted : [];
    var rules = value.kevin_rule_result && typeof value.kevin_rule_result === 'object'
      ? value.kevin_rule_result
      : {};
    var quality = value.quality_result && typeof value.quality_result === 'object'
      ? value.quality_result
      : {};
    var reviewMetadata = value.review_metadata && typeof value.review_metadata === 'object'
      ? value.review_metadata
      : {};
    var critic = reviewMetadata.critic && typeof reviewMetadata.critic === 'object'
      ? reviewMetadata.critic
      : {};
    var issues = list(quality.issues || quality.warnings || quality.personalizationIssues);
    var criticIssues = list(critic.blockingIssues);
    var contradictions = list(rules.contradictions);
    var reviewReasons = list(rules.reviewReasons);
    var missing = list(value.missing_information);
    var boundaries = list(rules.prohibitedConclusions);
    var checks = [];
    var severe = criticIssues.length > 0 || issues.some(function (issue) {
      var raw = rawReason(issue);
      return raw.indexOf('prohibited_conclusion:') === 0
        || raw.indexOf('unknown_evidence:') === 0
        || raw.indexOf('unsupported_arabic_number:') === 0;
    });

    if (!report) {
      addCheck(checks, '报告是否已经生成', '候选报告没有生成时不能标记复核通过，应先重试生成。');
      return {
        level: 'high',
        recommendation: '暂不能复核通过',
        summary: '候选报告尚未生成，不需要阅读其他材料。',
        checks: checks
      };
    }

    issues.forEach(function (issue) {
      addCheck(checks, '质量检查：' + reasonLabel(issue), qualityStandard(issue));
    });

    criticIssues.forEach(function (issue) {
      addCheck(
        checks,
        '客户可见语言：' + reportFieldLabel(issue && issue.fieldPath),
        criticStandard(issue)
      );
    });

    if (!accepted.length) {
      addCheck(
        checks,
        '证据使用：当前没有被系统采纳的可核对证据',
        '报告必须明确写成“待验证”或“证据有限”，不能把推测写成事实。'
      );
    }

    contradictions.forEach(function (reason) {
      addCheck(
        checks,
        '回答矛盾：' + reasonLabel(reason),
        '报告应明确保留矛盾，不能替客户选择其中一种说法。'
      );
    });

    reviewReasons.forEach(function (reason) {
      addCheck(
        checks,
        '判断限制：' + reasonLabel(reason),
        '相关结论必须保留这条限制，不能写成确定答案。'
      );
    });

    missing.forEach(function (item) {
      addCheck(
        checks,
        '信息缺口：' + reasonLabel(item),
        '报告应明确说明缺少这项信息，不能自行补写。'
      );
    });

    if (boundaries.length) {
      addCheck(
        checks,
        '判断边界：确认报告没有承诺结果或替客户做决定',
        '只能给出有依据的判断和验证动作，不能承诺结果、收入或确定方向。'
      );
    }

    var hasSignals = criticIssues.length || issues.length || contradictions.length || reviewReasons.length
      || missing.length || !accepted.length || quality.pass === false;
    if (!hasSignals) {
      addCheck(
        checks,
        '抽查核心判断',
        '核心判断与客户原话一致，并且没有把假设写成事实。'
      );
      addCheck(
        checks,
        '抽查第一优先路径和 7 天行动',
        '两处方向一致，行动具体、低成本、可以验证。'
      );
    }

    var level = severe ? 'high' : (hasSignals ? 'medium' : 'low');
    var recommendation = severe
      ? '建议标记需要调整'
      : (hasSignals ? '重点核对后决定' : '可快速复核通过');
    return {
      level: level,
      recommendation: recommendation,
      summary: '系统已经完成自动检查。你只需核对下面 '
        + String(checks.length) + ' 项，不用逐字通读整份报告。',
      checks: checks
    };
  }

  return {
    fieldLabel: fieldLabel,
    statusLabel: statusLabel,
    pathStatusLabel: pathStatusLabel,
    reasonLabel: reasonLabel,
    reportFieldLabel: reportFieldLabel,
    buildReviewGuidance: buildReviewGuidance
  };
}));
