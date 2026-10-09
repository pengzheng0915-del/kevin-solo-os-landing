(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3QuestionFlow = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_FOLLOW_UP_ROUNDS = 1;
  var MAX_FOLLOW_UP_QUESTIONS = 2;
  /* 第 5 步真实经历减负（规格第 7 条）：
   * 必填只有 3 项——当时是什么问题 / 你具体做了什么 / 实际结果是什么。
   * 「适用边界」等转入可选，不再阻塞摘要生成。 */
  var requirements = [
    { field: 'caseOneProblem', category: 'problem' },
    { field: 'caseOneAction', category: 'action' },
    { field: 'caseOneResult', category: 'result' }
  ];
  var optionalFields = ['caseBoundaryTransfer', 'decision', 'nearestIncident'];

  function classifyAnswer(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return 'missing';
    return /(没有|暂无|暂时没有|还没有|不清楚|无法核对|没发生|没有结果|没有案例|说不出来)/.test(text)
      ? 'honest_absence'
      : 'answered';
  }

  function unique(values) {
    return values.filter(function (value, index, list) {
      return list.indexOf(value) === index;
    });
  }

  function evaluateCompletion(input) {
    var value = input || {};
    var answers = value.answers || {};
    var evidencePack = Array.isArray(value.evidencePack) ? value.evidencePack : [];
    var contradictions = Array.isArray(value.contradictions) ? value.contradictions : [];
    var followUpRound = Math.max(0, Number(value.followUpRound != null ? value.followUpRound : value.followUpCount) || 0);
    var evidenceCategories = evidencePack.map(function (item) { return item && item.category; });
    var missingCategories = [];
    var caseAvailability = String(answers.caseAvailability || value.caseAvailability || 'has_case');

    if (caseAvailability === 'no_case') {
      return {
        status: 'limited',
        missingCategories: ['case_evidence'],
        maxFollowUpRounds: MAX_FOLLOW_UP_ROUNDS,
        maxFollowUpQuestions: MAX_FOLLOW_UP_QUESTIONS
      };
    }

    requirements.forEach(function (item) {
      var answerState = classifyAnswer(answers[item.field]);
      var answerIsUsable = answerState !== 'missing';
      var hasEvidence = evidenceCategories.indexOf(item.category) !== -1;
      var acceptedAbsence = answerState === 'honest_absence'
        && (item.category === 'result' || item.category === 'boundary');
      if (!answerIsUsable || (!hasEvidence && !acceptedAbsence)) missingCategories.push(item.category);
    });

    if (contradictions.length) missingCategories.unshift('contradiction');
    missingCategories = unique(missingCategories);

    if (!missingCategories.length) {
      return {
        status: 'ready',
        missingCategories: [],
        maxFollowUpRounds: MAX_FOLLOW_UP_ROUNDS,
        maxFollowUpQuestions: MAX_FOLLOW_UP_QUESTIONS
      };
    }

    return {
      status: followUpRound >= MAX_FOLLOW_UP_ROUNDS ? 'limited' : 'needs_follow_up',
      missingCategories: missingCategories,
      maxFollowUpRounds: MAX_FOLLOW_UP_ROUNDS,
      maxFollowUpQuestions: MAX_FOLLOW_UP_QUESTIONS
    };
  }

  return {
    MAX_FOLLOW_UP_ROUNDS: MAX_FOLLOW_UP_ROUNDS,
    MAX_FOLLOW_UP_QUESTIONS: MAX_FOLLOW_UP_QUESTIONS,
    classifyAnswer: classifyAnswer,
    evaluateCompletion: evaluateCompletion
  };
}));
