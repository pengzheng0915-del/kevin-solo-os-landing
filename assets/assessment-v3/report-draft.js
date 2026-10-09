(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3ReportDraft = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function unique(items) {
    return items.filter(function (item, index) { return items.indexOf(item) === index; });
  }

  function auditDraft(draft, evidencePack, ruleResult) {
    var evidence = (evidencePack && evidencePack.evidence) || [];
    var evidenceIds = evidence.map(function (item) { return item.id; });
    var missingCitations = [];
    var unsupportedClaims = [];
    var highRiskViolations = [];
    var judgement = (draft && draft.primaryJudgement) || {};
    var cited = Array.isArray(judgement.evidenceIds) ? judgement.evidenceIds : [];

    if (judgement.statement && !cited.length) missingCitations.push('primaryJudgement');
    cited.forEach(function (id) {
      if (evidenceIds.indexOf(id) === -1) unsupportedClaims.push('不存在的证据引用: ' + id);
    });

    var prohibited = (ruleResult && ruleResult.prohibitedConclusions) || [];
    var recommendationText = JSON.stringify({
      pathComparison: (draft.pathComparison || []).map(function (item) {
        return { path: item.path, status: item.status };
      }),
      sevenDayAction: {
        title: draft.sevenDayAction && draft.sevenDayAction.title,
        action: draft.sevenDayAction && draft.sevenDayAction.action
      },
      thirtyDayEvidenceGoal: {
        title: draft.thirtyDayEvidenceGoal && draft.thirtyDayEvidenceGoal.title,
        goal: draft.thirtyDayEvidenceGoal && draft.thirtyDayEvidenceGoal.goal
      }
    });
    prohibited.forEach(function (statement) {
      if (recommendationText.indexOf(statement) !== -1) highRiskViolations.push(statement);
    });

    var sourceNumbers = unique(evidence.reduce(function (all, item) {
      return all.concat(String((item.source && item.source.quote) || '').match(/\d+(?:\.\d+)?/g) || []);
    }, []));
    var generatedNumbers = recommendationText.match(/\d+(?:\.\d+)?/g) || [];
    generatedNumbers.forEach(function (number) {
      if (sourceNumbers.indexOf(number) === -1) unsupportedClaims.push('无来源数字: ' + number);
    });

    return {
      unsupportedClaims: unique(unsupportedClaims),
      missingCitations: unique(missingCitations),
      highRiskViolations: unique(highRiskViolations),
      reviewOnly: Boolean(unsupportedClaims.length || missingCitations.length || highRiskViolations.length || (ruleResult && ruleResult.reviewRequired))
    };
  }

  function buildDraft(context) {
    var value = context || {};
    var pack = value.evidencePack || { evidence: [], missing: [] };
    var result = value.ruleResult || {
      primaryJudgement: { statement: '当前无法判断', confidence: 'low', evidenceIds: [] },
      pathHypotheses: [], prohibitedConclusions: [], missingEvidence: [], reviewRequired: true
    };
    var core = (value.input && value.input.coreAnswers) || {};
    var categories = (pack.evidence || []).map(function (item) { return item.category; });
    var hasPayment = categories.indexOf('payment') !== -1 || categories.indexOf('repeated_payment') !== -1;
    var hasRepeatedEvent = categories.indexOf('repeated_event') !== -1;
    var actionText;
    var actionTitle;
    if (hasPayment) {
      actionTitle = '复验已经出现的真实购买结果';
      actionText = '围绕“' + (core.decision || '当前决定') + '”，选取一位真实购买者，核对他购买的具体结果、采用过程和愿意再次购买的条件';
    } else if (hasRepeatedEvent) {
      actionTitle = '把重复能力收敛成一个最小验证';
      actionText = '围绕“' + (core.decision || '当前决定') + '”，选一个具体人和具体问题，用同一项能力完成一次小范围验证并记录前后变化';
    } else {
      actionTitle = '先补齐一个可核对的真实事件';
      actionText = '补充与“' + (core.decision || '当前决定') + '”直接相关的问题、个人动作、结果和外部反馈，再判断路径';
    }

    var draft = {
      understoodFacts: (pack.evidence || []).map(function (item) {
        return {
          text: item.statement,
          level: item.level,
          evidenceIds: [item.id],
          sourceQuote: item.source && item.source.quote
        };
      }),
      primaryJudgement: {
        statement: result.primaryJudgement.statement,
        confidence: result.primaryJudgement.confidence,
        evidenceIds: (result.primaryJudgement.evidenceIds || []).slice()
      },
      evidenceMap: (pack.evidence || []).reduce(function (map, item) {
        map[item.id] = {
          category: item.category,
          level: item.level,
          quote: item.source && item.source.quote,
          limitations: item.limitations || []
        };
        return map;
      }, {}),
      pathComparison: (result.pathHypotheses || []).map(function (item) {
        return {
          path: item.path,
          status: item.status,
          evidenceIds: (item.evidenceIds || []).slice()
        };
      }),
      avoidNow: (result.prohibitedConclusions || []).map(function (statement) {
        return { text: statement, reason: '当前证据或风险边界不支持这个结论' };
      }),
      sevenDayAction: {
        title: actionTitle,
        action: actionText,
        evidenceIds: (result.primaryJudgement.evidenceIds || []).slice()
      },
      thirtyDayEvidenceGoal: {
        title: '形成下一阶段需要的证据',
        goal: '确认问题是否重复出现、对方是否愿意投入，以及结果能否被清楚复述',
        evidenceIds: (result.primaryJudgement.evidenceIds || []).slice()
      },
      questionsForKevin: (result.missingEvidence || []).map(function (field) {
        return { field: field, question: '这个信息尚未提供，需要补充后再判断。' };
      }).concat((result.contradictions || []).map(function (item) {
        return { field: item.fields.join(', '), question: item.message };
      })),
      quality: { unsupportedClaims: [], missingCitations: [], highRiskViolations: [], reviewOnly: true }
    };

    draft.quality = auditDraft(draft, pack, result);
    return draft;
  }

  return { buildDraft: buildDraft, auditDraft: auditDraft };
}));
