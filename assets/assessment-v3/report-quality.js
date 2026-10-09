(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinAssessmentV3ReportQuality = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var genericPhrases = [
    '你很有潜力',
    '相信自己',
    '持续行动',
    '勇敢迈出第一步',
    '找到适合自己的方向',
    '未来可期',
    '这是更适合你的方向',
    '可以先试试看',
    '不要着急'
  ];
  var stopTokens = [
    '当前', '已经', '可以', '需要', '一个', '这次', '判断', '方向', '事实', '验证',
    '结果', '客户', '报告', '不要', '暂时', '继续', '适合', '你的', '已有', '仍然'
  ];
  var boundaryTerms = [
    '离职', '辞职', '裸辞', '重资产', '借款', '贷款', '隐私', '脱敏', '机密',
    '资质', '心理', '医疗', '法律', '财务', '投资', '公开', '高曝光', '扩大投入'
  ];

  function unique(items) {
    return items.filter(function (item, index) { return items.indexOf(item) === index; });
  }

  function arrayOf(value) {
    if (Array.isArray(value)) return value;
    return value && typeof value === 'object' ? [value] : [];
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function flattenStrings(value, path, output) {
    if (typeof value === 'string') {
      output.push({ path: path, value: value });
      return;
    }
    if (typeof value === 'number') {
      output.push({ path: path, value: String(value) });
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(function (item, index) { flattenStrings(item, path + '[' + index + ']', output); });
      return;
    }
    Object.keys(value).forEach(function (key) {
      if (/^(version|evidenceRefs|evidenceIds|confidence)$/i.test(key)) return;
      flattenStrings(value[key], path ? path + '.' + key : key, output);
    });
  }

  function textOf(value) {
    var output = [];
    flattenStrings(value, '', output);
    return output.map(function (item) { return item.value; }).join(' ');
  }

  function stripVolatile(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stripVolatile);
    var result = {};
    Object.keys(value).sort().forEach(function (key) {
      if (/^(name|nickname|clientName|reportId|generatedAt)$/i.test(key)) return;
      result[key] = stripVolatile(value[key]);
    });
    return result;
  }

  function evidenceIdsFrom(item) {
    if (!item || typeof item !== 'object') return [];
    if (Array.isArray(item.evidenceIds)) return item.evidenceIds;
    if (Array.isArray(item.evidenceRefs)) return item.evidenceRefs;
    return [];
  }

  function evidenceText(item) {
    if (!item || typeof item !== 'object') return '';
    return [
      item.statement,
      item.claim,
      item.sourceQuote,
      item.source && item.source.quote,
      item.quote
    ].map(clean).filter(Boolean).join(' ');
  }

  function evidenceIndex(value, report) {
    var index = {};
    (Array.isArray(value) ? value : []).forEach(function (item) {
      if (!item || !item.id || item.accepted === false) return;
      index[item.id] = item;
    });
    var map = report && report.evidenceMap;
    if (map && typeof map === 'object') {
      Object.keys(map).forEach(function (id) {
        if (!index[id]) index[id] = Object.assign({ id: id }, map[id]);
      });
    }
    return index;
  }

  function meaningfulTokens(value) {
    var normalized = clean(value).toLowerCase();
    var tokens = [];
    var latin = normalized.match(/[a-z][a-z0-9_-]{3,}/g) || [];
    tokens = tokens.concat(latin);
    var runs = normalized.match(/[\u3400-\u9fff]{2,}/g) || [];
    runs.forEach(function (run) {
      for (var length = 2; length <= 4; length += 1) {
        if (run.length < length) continue;
        for (var start = 0; start <= run.length - length; start += 1) {
          var token = run.slice(start, start + length);
          if (stopTokens.indexOf(token) === -1) tokens.push(token);
        }
      }
    });
    return unique(tokens);
  }

  function hasSpecificOverlap(first, second) {
    var left = meaningfulTokens(first);
    var right = meaningfulTokens(second);
    var matches = left.filter(function (item) { return right.indexOf(item) !== -1; });
    if (matches.some(function (item) { return item.length >= 3; })) return true;
    if (matches.length >= 2) return true;
    return boundaryTerms.some(function (term) {
      return clean(first).indexOf(term) !== -1 && clean(second).indexOf(term) !== -1;
    });
  }

  function referencedEvidenceText(item, index) {
    return evidenceIdsFrom(item).map(function (id) { return evidenceText(index[id]); }).filter(Boolean).join(' ');
  }

  function hasAcceptedReference(item, index) {
    var refs = evidenceIdsFrom(item);
    return refs.length > 0 && refs.some(function (id) { return Boolean(index[id]); });
  }

  function numericExpressions(value) {
    return (clean(value).match(/(?<![\d.])[-+]?\d+(?:\.\d+)?(?![\d.])/g) || []).map(function (item) {
      return String(Number(item));
    });
  }

  function reasonableActionNumber(path, value, numberText) {
    var number = Math.abs(Number(numberText));
    var matchIndex = clean(value).indexOf(numberText);
    var context = clean(value).slice(Math.max(0, matchIndex - 7), matchIndex + numberText.length + 9);
    var isDayRange = /dayRange$/.test(path);
    var isDuration = /(分钟|小时)/.test(context);
    var isDayCount = /(天|日)/.test(context);
    var isSmallCount = /(位|名|个|家|份|条|次|场)/.test(context);
    var isWritingLength = /字/.test(context);
    var isPriceOrOutcome = /(元|块|万元|收入|收益|价格|定价|%|％)/.test(context);
    if (isPriceOrOutcome) return false;
    if (isDayRange || isDayCount) return number >= 1 && number <= 7;
    if (isDuration) return number > 0 && number <= 120;
    if (isSmallCount) return number > 0 && number <= 10;
    if (isWritingLength) return number > 0 && number <= 500;
    return number > 0 && number <= 10;
  }

  function auditNumbers(report, sourceText, unsupportedClaims) {
    var sourceNumbers = numericExpressions(sourceText);
    var strings = [];
    flattenStrings(report, '', strings);
    strings.forEach(function (item) {
      numericExpressions(item.value).forEach(function (number) {
        if (sourceNumbers.indexOf(number) !== -1) return;
        if (/^sevenDayAction/.test(item.path) && reasonableActionNumber(item.path, item.value, number)) return;
        unsupportedClaims.push('无来源数字：' + item.path + '：' + number);
      });
    });
  }

  function reportItemText(item) {
    return clean(item && (item.text || item.statement || item.reason || item.action || item.goal));
  }

  function auditPersonalization(input) {
    var value = input || {};
    var report = value.report || {};
    var comparisonReports = Array.isArray(value.comparisonReports) ? value.comparisonReports : [];
    var accepted = evidenceIndex(value.acceptedEvidence, report);
    var sourceText = [textOf(value.sourceAnswers || {}), textOf(value.acceptedEvidence || []), textOf(report.evidenceMap || {})].join(' ');
    var genericClaims = [];
    var unsupportedClaims = [];
    var personalizationIssues = [];
    var strings = [];
    flattenStrings(report, '', strings);

    strings.forEach(function (item) {
      genericPhrases.forEach(function (phrase) {
        if (item.value.indexOf(phrase) !== -1) genericClaims.push(phrase);
      });
    });

    function auditGroundedItem(item, label, requireSpecificText) {
      var content = reportItemText(item) || textOf(item || {});
      var refs = evidenceIdsFrom(item);
      if (!refs.length) unsupportedClaims.push(label + '没有证据引用');
      refs.forEach(function (id) {
        if (!accepted[id]) unsupportedClaims.push('不存在的证据引用: ' + id);
      });
      if (requireSpecificText && (!hasAcceptedReference(item, accepted)
        || !hasSpecificOverlap(content, [referencedEvidenceText(item, accepted), sourceText].filter(Boolean).join(' ')))) {
        personalizationIssues.push(label + '没有写入这位客户已经提供的具体事实');
      }
    }

    var judgement = report.primaryJudgement || {};
    auditGroundedItem(judgement, '主要判断', true);

    arrayOf(report.understoodFacts).forEach(function (item, index) {
      auditGroundedItem(item, '事实陈述 ' + String(index + 1), true);
    });

    arrayOf(report.pathComparison).forEach(function (item, index) {
      var reason = clean(item && item.reason);
      auditGroundedItem(item, '路径理由 ' + String(index + 1), false);
      if (!reason || !hasSpecificOverlap(reason, [referencedEvidenceText(item, accepted), sourceText].filter(Boolean).join(' '))) {
        personalizationIssues.push('路径理由 ' + String(index + 1) + '可以复制给任何人，没有绑定客户事实');
      }
    });

    var ruleResult = value.kevinRuleResult || {};
    var gaps = (Array.isArray(value.actualGaps) ? value.actualGaps : [])
      .concat(Array.isArray(ruleResult.missingEvidence) ? ruleResult.missingEvidence : [])
      .filter(Boolean);
    arrayOf(report.sevenDayAction).forEach(function (item, index) {
      var action = clean(item && item.action);
      auditGroundedItem(item, '七天行动 ' + String(index + 1), false);
      var target = [gaps.join(' '), referencedEvidenceText(item, accepted), sourceText].filter(Boolean).join(' ');
      if (!action || !hasSpecificOverlap(action, target)) {
        personalizationIssues.push('七天行动 ' + String(index + 1) + '没有对应当前真实缺口');
      }
    });

    var boundaries = [];
    var answers = value.sourceAnswers || {};
    ['unacceptableOutcome', 'rejectedState'].forEach(function (key) {
      if (clean(answers[key])) boundaries.push(clean(answers[key]));
    });
    var doNotDoText = textOf(report.doNotDo || []);
    boundaries.forEach(function (boundary) {
      if (!hasSpecificOverlap(boundary, doNotDoText)) {
        personalizationIssues.push('暂时不要做没有体现客户边界或 Kevin 禁止规则：' + boundary);
      }
    });

    [judgement].concat(arrayOf(report.understoodFacts)).concat(arrayOf(report.pathComparison))
      .concat(arrayOf(report.sevenDayAction)).concat(arrayOf(report.doNotDo)).forEach(function (item) {
        evidenceIdsFrom(item).forEach(function (id) {
          if (!accepted[id]) unsupportedClaims.push('不存在的证据引用: ' + id);
        });
      });
    auditNumbers(report, sourceText, unsupportedClaims);

    var fingerprint = JSON.stringify(stripVolatile(report));
    var nameSwapRisk = comparisonReports.some(function (other) {
      return fingerprint === JSON.stringify(stripVolatile(other));
    });

    genericClaims = unique(genericClaims);
    unsupportedClaims = unique(unsupportedClaims);
    personalizationIssues = unique(personalizationIssues);
    return {
      pass: genericClaims.length === 0 && unsupportedClaims.length === 0
        && personalizationIssues.length === 0 && !nameSwapRisk,
      genericClaims: genericClaims,
      unsupportedClaims: unsupportedClaims,
      personalizationIssues: personalizationIssues,
      nameSwapRisk: nameSwapRisk
    };
  }

  return { auditPersonalization: auditPersonalization };
}));
