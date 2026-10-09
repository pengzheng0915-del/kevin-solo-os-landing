(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3AiEvidence = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function compact(value) {
    return String(value == null ? '' : value).replace(/\s+/g, '');
  }

  function getByPath(value, path) {
    var current = value;
    String(path || '').split('.').forEach(function (part) {
      if (current != null) current = current[part];
    });
    return current;
  }

  function numbersIn(value) {
    var matches = String(value == null ? '' : value).match(/\d+(?:\.\d+)?%?/g);
    return matches || [];
  }

  function levelNumber(level) {
    var match = String(level || '').match(/^E([0-5])$/);
    return match ? Number(match[1]) : 0;
  }

  function hasNoPayment(value) {
    var content = String(value == null ? '' : value);
    return /(从未|没有|暂无|尚未|未曾|没).{0,20}(付费|付款|支付|购买|复购|续费)|未付费|没付费/.test(content);
  }

  function hasActualPayment(value) {
    var content = String(value == null ? '' : value);
    return content.split(/[，,；;。]/).some(function (clause) {
      var negative = hasNoPayment(clause);
      var employment = /(工资|薪酬|岗位薪资|岗位支付|奖金)/.test(clause);
      var positive = /(客户|对方|机构|家长|学员|朋友|同事|有人|买方|用户|公司|组织).{0,24}(购买|付费|支付|付款|买了|买过|续费|复购|转介绍)/.test(clause)
        || /(购买|付费|支付|付款|买了|买过|续费|复购|转介绍).{0,20}(课程|咨询|服务|产品|工具|诊断|方案)/.test(clause);
      return positive && !negative && !employment;
    });
  }

  function maximumAllowedLevel(field, sourceAnswer) {
    var path = String(field || '');
    var content = String(sourceAnswer == null ? '' : sourceAnswer);
    if (path === 'business.repeatPayment') {
      return hasActualPayment(sourceAnswer) && /(复购|续费|再次购买|转介绍)/.test(sourceAnswer) ? 5 : 0;
    }
    if (path === 'paidOutcome') return hasActualPayment(sourceAnswer) ? 4 : 0;
    if (path === 'helpRequests') {
      var personPattern = '(同事|客户|朋友|团队|老板|管理者|负责人|经营者|学员|家长|机构|组织|对方|有人)';
      var deniesRequest = /(没有|暂无|未有|没).{0,12}(主动|请我|找我|问我|交给我)/.test(content);
      var positiveRequest = !deniesRequest && new RegExp(personPattern + '.{0,24}(请我|找我|问我|交给我|主动)').test(content);
      var deniesFeedback = /(没有|暂无|未有|没).{0,12}(反馈|认可|采用|结果)/.test(content);
      var positiveFeedback = !deniesFeedback && new RegExp(personPattern + '.{0,32}(反馈|认可|采用|结果|解决|找到)').test(content);
      return positiveRequest || positiveFeedback ? 3 : 0;
    }
    if (path === 'costSignals') {
      var deniesCost = /(没有|暂无|未有|没|不愿|未曾).{0,20}(投入|时间|资源|预算|配合)|无预算|未投入/.test(content);
      var affirmsSomeCost = /(愿意|主动|安排|提供|参加|已经投入|持续记录|持续投入).{0,16}(时间|资源|预算|会议|录音|数据|人员|配合)|愿意让我投入时间/.test(content);
      return deniesCost && !affirmsSomeCost ? 0 : 2;
    }
    if (path === 'caseTwo') return /(想不出|没有|暂无|未有|无法提供|暂时没有).{0,12}(第二|另一个|独立|事件|案例)/.test(content) ? 0 : 2;
    if (/^caseOne(Problem|Action|Result)$/.test(path)) return 1;
    if (/^(decision|urgency|unacceptableOutcome|candidatePaths|rejectedState)$/.test(path)) return 0;
    return 2;
  }

  function verifyAiEvidence(input) {
    var value = input || {};
    var analysis = value.analysis || {};
    var answers = value.answers || {};
    var evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
    var accepted = [];
    var rejected = [];
    var unsupportedNumbers = [];

    evidence.forEach(function (item) {
      var sourceAnswer = String(getByPath(answers, item.sourceField) == null ? '' : getByPath(answers, item.sourceField));
      if (!sourceAnswer || compact(sourceAnswer).indexOf(compact(item.sourceQuote)) === -1) {
        rejected.push({ item: item, reason: 'quote_not_found' });
        return;
      }

      var sourceNumbers = numbersIn(sourceAnswer);
      var generatedNumbers = numbersIn(item.claim);
      var invented = generatedNumbers.filter(function (number) {
        return sourceNumbers.indexOf(number) === -1;
      });
      if (invented.length) {
        unsupportedNumbers.push({
          evidenceId: item.id,
          sourceField: item.sourceField,
          numbers: invented
        });
        rejected.push({ item: item, reason: 'unsupported_number' });
        return;
      }

      var suggestedLevel = levelNumber(item.suggestedLevel);
      var allowedLevel = maximumAllowedLevel(item.sourceField, sourceAnswer);
      var finalLevel = 'E' + Math.min(suggestedLevel, allowedLevel);

      accepted.push({
        id: item.id,
        category: item.category,
        level: finalLevel,
        statement: item.claim,
        source: { field: item.sourceField, quote: item.sourceQuote },
        confidence: item.confidence,
        limitations: Array.isArray(item.limitations) ? item.limitations.slice() : [],
        origin: 'deepseek_verified'
      });
    });

    return {
      accepted: accepted,
      rejected: rejected,
      audit: {
        reviewed: evidence.length,
        accepted: accepted.length,
        rejected: rejected.length,
        unsupportedNumbers: unsupportedNumbers
      }
    };
  }

  return { verifyAiEvidence: verifyAiEvidence };
}));
