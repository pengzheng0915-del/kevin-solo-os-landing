(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3Rules = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function flatten(input) {
    return JSON.stringify(input || {});
  }

  function detectContradictions(input) {
    var core = (input && input.coreAnswers) || {};
    var branches = (input && input.branchAnswers) || {};
    var contradictions = [];
    var paid = text(core.paidOutcome);
    var repeat = text(branches.business && branches.business.repeatPayment);

    if (/(从未|没有|暂无|未曾).{0,6}(付费|付款|购买)/.test(paid) && /(稳定复购|已经复购|续费|再次购买)/.test(repeat)) {
      contradictions.push({
        fields: ['paidOutcome', 'business.repeatPayment'],
        message: '付费记录与复购描述互相矛盾，需要核对原始事实'
      });
    }

    var time = text(core.timeAvailable || (branches.career && branches.career.timeAvailable));
    var urgency = text(core.urgency);
    if (/(没有时间|零时间|无法投入)/.test(time) && /(马上|立刻|尽快启动)/.test(urgency)) {
      contradictions.push({
        fields: ['timeAvailable', 'urgency'],
        message: '行动紧迫性与可投入时间互相冲突'
      });
    }

    return contradictions;
  }

  function evaluate(input, evidencePack) {
    var value = input || {};
    var pack = evidencePack || { evidence: [], missing: [] };
    var evidence = Array.isArray(pack.evidence) ? pack.evidence : [];
    var core = value.coreAnswers || {};
    var branches = value.branchAnswers || {};
    var allText = flatten(value);
    var prohibited = [];
    var allowed = [];
    var reasons = [];
    var contradictions = detectContradictions(value);
    var reviewRequired = false;

    function prohibit(statement) {
      if (prohibited.indexOf(statement) === -1) prohibited.push(statement);
    }
    function requireReview(reason) {
      reviewRequired = true;
      if (reasons.indexOf(reason) === -1) reasons.push(reason);
    }

    var sensitiveMatch = allText.match(/心理|医疗|法律|财务|投资/);
    if (sensitiveMatch) {
      var qualification = text(branches.sensitive && branches.sensitive.qualification);
      requireReview(/没有|不具备|暂无|无正式/.test(qualification) || !qualification ? '高风险专业资格不足' : '高风险专业方向');
      prohibit(sensitiveMatch[0] + '服务适合作为收费路径');
      prohibit('替代持证专业人士提供服务');
    }

    var resignationContext = [text(core.decision), text(core.urgency), text(core.candidatePaths)].join(' ');
    var resignationNegated = /(不准备|不考虑|不愿|避免|不要|不能|不会).{0,8}(离职|辞职|裸辞)/.test(resignationContext);
    var resignationConsidered = /((考虑|计划|准备|想|是否|马上|立刻|尽快).{0,8}(离职|辞职|裸辞))|((离职|辞职|裸辞).{0,8}(转行|创业|开始|选择))/.test(resignationContext);
    if (resignationConsidered && !resignationNegated) {
      requireReview('涉及离职决策');
      prohibit('建议离职');
    }

    if (/重资产|借款|贷款|大额投资|投入全部积蓄|卖房/.test(allText)) {
      requireReview('涉及重资产投入');
      prohibit('建议重资产投入');
    }

    if (/公司机密|客户名单|客户数据|组织数据|数据权限|脱敏|保密/.test(allText)) {
      requireReview('涉及数据保密边界');
      prohibit('使用未脱敏的客户或组织数据');
    }

    var authority = text(branches.organization && branches.organization.decisionAuthority);
    var organizationContext = /公司|组织|战略|团队变革/.test(text(core.decision)) || Boolean(authority);
    if (organizationContext) {
      prohibit('替组织确定战略');
      if (!authority || /没有|无权|不具备|只有建议权|没有最终决策权|无最终决策权/.test(authority)) {
        requireReview('涉及组织决策边界');
      }
    }

    if (contradictions.length) requireReview('回答存在矛盾');

    var eventEvidence = evidence.filter(function (item) {
      return item.category === 'case_event' || item.category === 'repeated_event';
    });
    var strongest = evidence.reduce(function (max, item) {
      var level = Number(String(item.level || 'E0').slice(1)) || 0;
      return Math.max(max, level);
    }, 0);
    var confidence = 'low';
    if (eventEvidence.length >= 2 && strongest >= 3) confidence = 'high';
    else if (eventEvidence.length >= 2 || strongest >= 3) confidence = 'medium';
    if (contradictions.length) confidence = confidence === 'high' ? 'medium' : 'low';

    var judgementEvidence = evidence.filter(function (item) { return item.level !== 'E0'; }).map(function (item) { return item.id; });
    var primaryStatement;
    if (!judgementEvidence.length) {
      primaryStatement = '当前证据不足，暂时不能判断经验是否适合商业化';
    } else if (strongest >= 4) {
      primaryStatement = '已经出现真实付费证据，但仍需核对交付边界和可重复性';
      allowed.push('可以设计一次低风险复验');
    } else if (eventEvidence.length >= 2) {
      primaryStatement = '已经出现可重复的能力线索，下一步应验证具体人群和问题价值';
      allowed.push('可以继续做低成本验证');
    } else {
      primaryStatement = '目前只有初步能力线索，需要用第二个独立事件复验';
      allowed.push('先补充事件证据再选择路径');
    }

    var paths = text(core.candidatePaths).split(/[，,、;；\n]/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 4).map(function (item) {
      return {
        path: item,
        status: strongest >= 3 ? '可验证' : '待补证据',
        evidenceIds: judgementEvidence.slice()
      };
    });

    return {
      primaryJudgement: {
        statement: primaryStatement,
        confidence: confidence,
        evidenceIds: judgementEvidence
      },
      pathHypotheses: paths,
      allowedConclusions: allowed,
      prohibitedConclusions: prohibited,
      missingEvidence: Array.isArray(pack.missing) ? pack.missing.slice() : [],
      contradictions: contradictions,
      reviewRequired: reviewRequired,
      reviewReasons: reasons
    };
  }

  function enforceAiBoundaries(ruleResult, aiReport) {
    var result = ruleResult || {};
    var report = JSON.parse(JSON.stringify(aiReport || {}));
    var prohibited = Array.isArray(result.prohibitedConclusions) ? result.prohibitedConclusions : [];
    var rejectedSuggestions = [];

    function containsProhibited(value) {
      var content = JSON.stringify(value || {});
      return prohibited.some(function (statement) { return content.indexOf(statement) !== -1; });
    }

    report.pathComparison = (Array.isArray(report.pathComparison) ? report.pathComparison : []).filter(function (item) {
      if (!containsProhibited(item)) return true;
      rejectedSuggestions.push({ suggestion: item, reason: '违反 Kevin 禁止规则' });
      return false;
    });

    report.sevenDayAction = (Array.isArray(report.sevenDayAction) ? report.sevenDayAction : []).filter(function (item) {
      if (!containsProhibited(item)) return true;
      rejectedSuggestions.push({ suggestion: item, reason: '违反 Kevin 禁止规则' });
      return false;
    });

    var primary = report.primaryJudgement || {};
    if (result.reviewRequired || containsProhibited(primary)) {
      report.primaryJudgement = {
        text: result.primaryJudgement && result.primaryJudgement.statement
          ? result.primaryJudgement.statement
          : '当前证据不足，需要先核对事实再判断。',
        evidenceRefs: result.primaryJudgement && Array.isArray(result.primaryJudgement.evidenceIds)
          ? result.primaryJudgement.evidenceIds.slice()
          : [],
        confidence: result.primaryJudgement && result.primaryJudgement.confidence === 'high' ? 0.8
          : result.primaryJudgement && result.primaryJudgement.confidence === 'medium' ? 0.6 : 0.35,
        limitations: (result.reviewReasons || []).slice()
      };
    }

    function customerBoundary(statement) {
      if (statement === '建议离职') return '不要仅凭这份报告做离职决定';
      if (statement === '建议重资产投入') return '不要在缺少真实验证时进行重资产投入';
      if (statement === '替组织确定战略') return '涉及组织战略的决定，应由获得正式授权的负责人确认';
      if (statement === '替代持证专业人士提供服务') return '需要专业资质的服务，应转介给具备相应资格的人';
      if (statement === '使用未脱敏的客户或组织数据') return '验证时只使用已获授权并完成脱敏的数据';
      if (/服务适合作为收费路径$/.test(statement)) return '不要在资格和服务边界未核实前把这一专业方向作为收费服务';
      return '当前不要直接得出该结论：' + statement;
    }

    report.doNotDo = (Array.isArray(report.doNotDo) ? report.doNotDo : []).concat(prohibited.map(function (statement) {
      return {
        text: customerBoundary(statement),
        evidenceRefs: result.primaryJudgement && Array.isArray(result.primaryJudgement.evidenceIds)
          ? result.primaryJudgement.evidenceIds.slice()
          : []
      };
    }));

    return { report: report, rejectedSuggestions: rejectedSuggestions };
  }

  return {
    evaluate: evaluate,
    detectContradictions: detectContradictions,
    enforceAiBoundaries: enforceAiBoundaries
  };
}));
