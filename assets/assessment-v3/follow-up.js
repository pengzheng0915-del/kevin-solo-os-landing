(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3FollowUp = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var templates = {
    contradiction: '你前后两处描述存在差异。请按实际发生的时间顺序，把相关事实重新说明一次。',
    decision: '这份报告最需要帮你做清楚的一个决定是什么？请只写一个。',
    problem: '请选一个真实事件：当时是谁遇到了什么具体问题？',
    action: '在这个事件里，哪些判断和动作是你亲自完成的？',
    result: '这次工作最后发生了什么变化？有哪些结果、反馈或材料可以核对？',
    demand: '为了得到你的帮助，对方实际投入过哪些时间、配合、资源或预算？',
    payment: '是否有人为某一个具体结果付过费？如果没有，请直接写没有。',
    repeatability: '除了刚才的事件，还有没有另一次相似经历可以证明这项能力能够重复？',
    boundary: '即使这条路可能有收入，你最不愿长期接受的工作状态是什么？'
  };

  function normalize(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function unique(values) {
    return values.filter(function (item, index, list) {
      return item && list.indexOf(item) === index;
    });
  }

  function buildFollowUps(input) {
    var value = input || {};
    var completion = value.completion || {};
    if (completion.status !== 'needs_follow_up') return [];

    var analysis = value.analysis || {};
    var ruleResult = value.ruleResult || {};
    var previous = (Array.isArray(value.previousQuestions) ? value.previousQuestions : []).map(normalize);
    var supported = (Array.isArray(analysis.evidence) ? analysis.evidence : []).map(function (item) {
      return item && item.category;
    });
    var contradictions = Array.isArray(analysis.contradictions) ? analysis.contradictions : [];
    var aiMissing = Array.isArray(analysis.missingEvidence) ? analysis.missingEvidence : [];
    var ruleMissing = Array.isArray(ruleResult.missingEvidence) ? ruleResult.missingEvidence : [];
    var requested = [];

    if (contradictions.length) requested.push('contradiction');
    requested = requested.concat(completion.missingCategories || []);
    requested = requested.concat(aiMissing.map(function (item) { return item.category; }));
    requested = requested.concat(ruleMissing.map(function (item) {
      return typeof item === 'string' ? item : item.category;
    }));
    requested = unique(requested).filter(function (category) {
      return category === 'contradiction' || supported.indexOf(category) === -1;
    });

    var result = [];
    requested.some(function (category) {
      if (result.length >= 3) return true;
      var aiSuggestion = aiMissing.filter(function (item) { return item.category === category; })[0];
      var question = category === 'contradiction'
        ? templates.contradiction
        : normalize(aiSuggestion && aiSuggestion.suggestedQuestion) || templates[category];
      if (!question || previous.indexOf(normalize(question)) !== -1) return false;
      if (result.some(function (item) { return normalize(item.question) === normalize(question); })) return false;

      var reason = category === 'contradiction'
        ? normalize(contradictions[0] && contradictions[0].reason) || '需要先核对互相冲突的事实。'
        : normalize(aiSuggestion && aiSuggestion.reason) || '这类证据仍不足，补充后才能提高结论精度。';
      result.push({
        id: 'followup-' + String(result.length + 1),
        question: question,
        reason: reason,
        targetCategory: category
      });
      return false;
    });

    return result;
  }

  return { buildFollowUps: buildFollowUps };
}));
