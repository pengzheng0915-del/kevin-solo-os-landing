(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KevinAssessmentReportRenderer = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function text(value, fallback) {
    var clean = typeof value === 'string' ? value.trim() : '';
    return escapeHtml(clean || fallback || '');
  }

  function reportTitle(value, fallback) {
    var clean = typeof value === 'string' ? value.trim() : '';
    clean = clean
      .replace(/<\/span>\s*<span\b[^>]*>/gi, ' ')
      .replace(/<\/?span\b[^>]*>/gi, '')
      .replace(/个人经验\s+个人经验/g, '个人经验')
      .trim();
    return text(clean, fallback || '19.9 元完整自动报告');
  }

  function list(values, renderItem, emptyText) {
    var items = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!items.length) return '<p class="assessment-report-v1__empty">' + text(emptyText, '本次回答中没有更多可确认信息。') + '</p>';
    return '<ul class="assessment-report-v1__list">' + items.map(renderItem).join('') + '</ul>';
  }

  function uniqueFacts(values, limit) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : []).filter(function(item) {
      if (!item || typeof item !== 'object') return false;
      var source = typeof item.sourceQuote === 'string' ? item.sourceQuote : '';
      var value = source || (typeof item.text === 'string' ? item.text : '');
      var key = value.replace(/\s+/g, '').trim();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, limit || 6);
  }

  function missingInformationLabel(entry) {
    var item = entry && typeof entry === 'object' ? entry : {};
    var label = typeof item.label === 'string' ? item.label.trim() : '';
    if (/[一-鿿]/.test(label)) return label;
    var reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    var field = typeof item.field === 'string' ? item.field.trim() : '';
    var fieldLabels = {
      case: '真实事件的背景、动作和结果',
      external_result: '可核对的外部结果',
      demand: '真实需求或求助信号',
      payment: '真实付费证据',
      repeat_delivery: '重复交付或复购证据'
    };
    if (reason === 'incident_not_structured') return '真实事件尚未形成完整事实链';
    if (fieldLabels[field] && reason === 'explicitly_absent') return fieldLabels[field] + '：本次回答明确表示暂时没有';
    if (fieldLabels[field] && reason === 'not_provided') return fieldLabels[field] + '：本次回答尚未提供';
    if (fieldLabels[field]) return fieldLabels[field] + '仍需补充';
    var reasonLabels = {
      explicitly_absent: '本次回答明确表示暂时没有相关证据',
      not_provided: '本次回答未提供相关信息'
    };
    if (reasonLabels[reason]) return reasonLabels[reason];
    if (/[一-鿿]/.test(reason)) return reason;
    if (/[一-鿿]/.test(field)) return field;
    return '本次回答仍有一项关键信息需要补充';
  }

  function section(number, title, body, modifier) {
    return '<section class="assessment-report-v1__section assessment-report-v1__section--' + text(modifier || number) + '">' +
      '<header class="assessment-report-v1__section-head"><span>' + text(number) + '</span><h2>' + text(title) + '</h2></header>' +
      '<div class="assessment-report-v1__section-body">' + body + '</div></section>';
  }

  function labelled(label, value, state) {
    if (!value) return '';
    return '<article class="assessment-report-v1__metric' + (state ? ' is-' + text(state) : '') + '"><small>' +
      text(label) + '</small><strong>' + text(value) + '</strong></article>';
  }

  function reportHeader(options) {
    var time = text(options.time);
    var reportIdentity = options.reportId ? '报告编号 ' + text(options.reportId) : '本次报告';
    return '<header class="assessment-report-v1__header"><p class="assessment-report-v1__eyebrow">个人经验决策报告</p><h1>' +
      reportTitle(options.title, '19.9 元完整自动报告') + '</h1><div class="assessment-report-v1__meta">' +
      (time ? '<span>' + time + '</span>' : '') + '<span>' + reportIdentity + '</span></div></header>';
  }

  function renderExecutiveSummary(value) {
    var item = value || {};
    var asset = item.primaryAsset || {};
    var stage = item.stage || {};
    var strength = item.primaryStrength || {};
    var bottleneck = item.bottleneck || {};
    return '<p class="assessment-report-v1__lead">' + text(item.explanation, asset.description || '先从已经确认的事实开始。') + '</p>' +
      '<div class="assessment-report-v1__metrics">' +
      labelled('当前经验资产', asset.label || asset.description, 'confirmed') +
      labelled('当前阶段', stage.label, 'confirmed') +
      labelled('当前优势', strength.label, 'confirmed') +
      labelled('核心卡点', bottleneck.label, 'missing') +
      labelled('下一步', item.nextStep, 'action') + '</div>';
  }

  function renderFacts(values) {
    return list(uniqueFacts(values, 6), function(item) {
      return '<li><span class="assessment-report-v1__state is-confirmed">已确认</span><p>' + text(item && item.text) + '</p></li>';
    }, '本次回答中没有更多可确认信息。');
  }

  function renderAssets(value) {
    var item = value || {};
    var primary = item.primary || {};
    var candidates = Array.isArray(item.candidates) ? item.candidates : [];
    var html = '<p>' + text(item.explanation, '经验资产判断仍需后续验证。') + '</p>';
    html += labelled('当前主线', primary.label || primary.description, primary.status === 'hypothesis_only' ? 'hypothesis' : 'confirmed');
    html += list(candidates.filter(function(candidate) { return candidate && candidate.id !== primary.id; }), function(candidate) {
      return '<li><span class="assessment-report-v1__state is-hypothesis">待验证</span><p><strong>' +
        text(candidate.label) + '</strong>' + (candidate.description ? '<br>' + text(candidate.description) : '') + '</p></li>';
    }, '当前先聚焦一条经验主线，不并行扩展其他方向。');
    return html;
  }

  function renderStage(value) {
    var item = value || {};
    var html = '<p>' + text(item.explanation) + '</p><div class="assessment-report-v1__metrics">';
    html += labelled('阶段', item.stage && item.stage.label, 'confirmed');
    html += labelled('核心卡点', item.bottleneck && item.bottleneck.label, 'missing');
    html += '</div><div class="assessment-report-v1__columns"><div><h3>当前优势</h3>';
    html += list(item.strengths, function(entry) { return '<li><p>' + text(entry && entry.label) + '</p></li>'; }, '尚未形成稳定优势结论。');
    html += '</div><div><h3>关键缺口</h3>';
    html += list(item.gaps, function(entry) { return '<li><p>' + text(entry && entry.label) + '</p></li>'; }, '当前没有额外缺口。');
    html += '</div></div>';
    return html;
  }

  function renderPriorityPath(value) {
    var item = value || {};
    return '<article class="assessment-report-v1__priority"><span>当前只推进这一条</span><h3>' +
      text(item.label) + '</h3><p>' + text(item.explanation, item.rationale) + '</p></article>';
  }

  function renderDeferredPaths(values) {
    return list(values, function(item) {
      return '<li><span class="assessment-report-v1__state is-deferred">暂缓</span><p><strong>' + text(item && item.label) +
        '</strong><br>' + text(item && item.explanation, item && item.rationale) + '</p></li>';
    }, '本次没有额外需要暂缓的路径。');
  }

  function renderValidationTask(value, actionLabel) {
    var item = value || {};
    var html = '<article class="assessment-report-v1__task"><small>当前行动</small><h3>' + text(actionLabel, item.goal || item.title) + '</h3><p>' +
      text(item.intro) + '</p>';
    if (item.script) html += '<details class="decision-report__script-details"><summary>查看可直接使用的话术</summary><blockquote>' + text(item.script) + '</blockquote></details>';
    html += list(item.steps, function(step) { return '<li><p>' + text(step) + '</p></li>'; }, '按行动清单完成当前验证。');
    if (item.completionCriteria) html += '<div class="assessment-report-v1__done"><strong>完成标准</strong><p>' + text(item.completionCriteria) + '</p></div>';
    return html + '</article>';
  }

  function renderChecklist(values) {
    return list(values, function(item, index) {
      return '<li class="assessment-report-v1__check"><span>' + text(item && item.order, index + 1) + '</span><div><p>' +
        text(item && item.text) + '</p>' + (item && item.doneWhen ? '<small>做到什么算完成：' + text(item.doneWhen) + '</small>' : '') + '</div></li>';
    }, '当前没有额外行动项。');
  }

  function renderBoundaries(value) {
    var item = value || {};
    var html = '<p>' + text(item.intro, '以下边界用于避免把线索写成已经成立的结论。') + '</p>';
    html += '<div class="assessment-report-v1__boundary-grid">';
    html += '<article class="is-confirmed"><h3>已确认</h3>' + list(item.confirmed, function(entry) { return '<li><p>' + text(entry && entry.text) + '</p></li>'; }) + '</article>';
    html += '<article class="is-hypothesis"><h3>仍是假设</h3>' + list(item.hypotheses, function(entry) { return '<li><p>' + text(entry && (entry.label || entry.description || entry.text)) + '</p></li>'; }) + '</article>';
    html += '<article class="is-missing"><h3>仍缺信息</h3>' + list(item.missingInformation, function(entry) { return '<li><p>' + text(missingInformationLabel(entry)) + '</p></li>'; }) + '</article>';
    html += '</div>';
    if (item.conflicts && item.conflicts.length) {
      html += '<div class="assessment-report-v1__conflicts"><h3>需要先核对的矛盾回答</h3>' + list(item.conflicts, function(entry) { return '<li><p>' + text(entry && entry.text) + '</p></li>'; }) + '</div>';
    }
    html += list(item.cautions, function(entry) { return '<li><p>' + text(entry && (entry.statement || entry.text)) + '</p></li>'; }, '结论仅适用于本次回答所覆盖的事实。');
    return html;
  }

  function reportFooter(boundary) {
    return '<footer class="assessment-report-v1__footer"><strong>Kevin 彭峥</strong><span>职业经验资产顾问</span><p>本报告基于你的测评回答自动生成，用于支持下一步验证，不构成收入或结果承诺。</p></footer>';
  }

  function uniqueMemoItems(values) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : []).filter(function(item) {
      var key = String(item && item.text || '').replace(/\s+/g, '').trim();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function memoSection(block, title, intro, body) {
    return '<section class="decision-memo__section decision-memo__section--' + text(block) + '" data-report-block="' + text(block) + '">' +
      '<header class="decision-memo__section-head"><h2>' + text(title) + '</h2>' +
      (intro ? '<p>' + text(intro) + '</p>' : '') + '</header>' + body + '</section>';
  }

  function renderMemoKnown(values) {
    var items = uniqueMemoItems(values);
    if (!items.length) return '<p class="decision-memo__empty">本次回答还没有形成可用于判断的完整事实。</p>';
    return '<ol class="decision-memo__known">' + items.map(function(item) {
      return '<li><span>已确认</span><div><p>' + text(item && item.text) + '</p>' +
        (item && item.limitation ? '<small>' + text(item.limitation) + '</small>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  function renderMemoBasis(values) {
    var items = Array.isArray(values) ? values.filter(Boolean).slice(0, 4) : [];
    if (!items.length) return '<p class="decision-memo__empty">本次材料还没有形成可解释的判断依据。</p>';
    return '<ol class="decision-memo__basis">' + items.map(function(item) {
      return '<li><span>' + text(item && item.label) + '</span><div><p>' + text(item && item.fact) + '</p>' +
        '<small><strong>因此：</strong>' + text(item && item.effect) + '</small></div></li>';
    }).join('') + '</ol>';
  }

  function renderMemoUnknown(values) {
    var items = uniqueMemoItems(values);
    if (!items.length) return '<p class="decision-memo__empty">当前没有额外需要补充的关键信息。</p>';
    return '<ol class="decision-memo__unknown">' + items.map(function(item) {
      var state = item && item.reason === 'explicitly_absent' ? '本次明确没有' : '目前尚未提供';
      return '<li><span>' + state + '</span><div><h3>' + text(item && item.text) + '</h3>' +
        (item && item.impact ? '<p>' + text(item.impact) + '</p>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  function countLabel(value) {
    return ({ 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' })[value] || String(value || '');
  }

  function renderMemoAction(value) {
    var action = value || {};
    var steps = Array.isArray(action.steps) ? action.steps.filter(Boolean) : [];
    var worksheet = Array.isArray(action.worksheet) ? action.worksheet.filter(Boolean) : [];
    var stepsHtml = '<ol class="decision-memo__steps">' + steps.map(function(step, index) {
      return '<li><span>' + (index + 1) + '</span><p>' + text(step) + '</p></li>';
    }).join('') + '</ol>';
    var worksheetHtml = '<section class="decision-memo__worksheet"><h3>照着回答这' + countLabel(worksheet.length) + '个问题</h3><ol>' +
      worksheet.map(function(item, index) {
        return '<li><span>' + (index + 1) + '</span><div><strong>' + text(item && item.label) + '</strong><p>' + text(item && item.prompt) + '</p></div></li>';
      }).join('') + '</ol></section>';
    return '<div class="decision-memo__action"><p class="decision-memo__action-why">' + text(action.why) + '</p>' +
      stepsHtml + worksheetHtml + '<div class="decision-memo__outcomes"><article><span>做到什么算完成</span><p>' +
      text(action.doneWhen) + '</p></article><article><span>什么时候停止</span><p>' + text(action.stopRule) + '</p></article></div></div>';
  }

  function renderDecisionMemo(documentValue, options) {
    var memo = documentValue.decisionMemo || {};
    var verdict = memo.verdict || {};
    return '<article class="assessment-report-v1 assessment-report-v1--decision assessment-report-v1--memo">' + reportHeader(options) +
      '<section class="decision-memo__verdict" data-report-block="verdict"><span>当前结论</span><h2>' + text(verdict.label) +
      '</h2><p>' + text(verdict.statement) + '</p></section>' +
      (memo.schemaVersion === 'assessment-decision-memo-v2'
        ? memoSection('basis', '本次判断依据', '每一项都说明你的回答怎样影响了结论。', renderMemoBasis(memo.decisionBasis))
        : '') +
      memoSection('known', '我们确认了什么', '只保留会改变本次判断的回答事实。', renderMemoKnown(memo.known)) +
      memoSection('unknown', '目前还不能确定什么', '“尚未提供”和“明确没有”是两种不同状态。', renderMemoUnknown(memo.unknown)) +
      memoSection('action', '接下来只做这一件事', '完成后再重新判断，不并行扩大投入。',
        '<h3 class="decision-memo__action-title">' + text(memo.action && memo.action.title) + '</h3>' + renderMemoAction(memo.action)) +
      '<footer class="assessment-report-v1__footer"><strong>判断边界</strong><p>' + text(memo.boundary) +
      '</p><span>Kevin 彭峥｜职业经验资产顾问</span></footer></article>';
  }

  function chapterHeader(title, intro) {
    return '<header class="decision-report__chapter-head"><h2>' + text(title) + '</h2>' +
      (intro ? '<p>' + text(intro) + '</p>' : '') + '</header>';
  }

  function normalizedScores(source) {
    var paths = [
      { key: 'content', label: '内容表达', max: 26 },
      { key: 'consulting', label: '咨询服务', max: 32 },
      { key: 'knowledge', label: '知识产品', max: 27 },
      { key: 'template', label: '模板工具', max: 28 },
      { key: 'service', label: '标准服务', max: 29 },
      { key: 'coaching', label: '陪跑辅导', max: 26 }
    ];
    var scores = source && typeof source === 'object' ? source : {};
    return paths.map(function(path) {
      var raw = Number(scores[path.key]);
      var score = Number.isFinite(raw) ? Math.max(0, Math.min(path.max, raw)) : 0;
      return { key: path.key, label: path.label, percent: Math.round(score / path.max * 100) };
    });
  }

  function renderRadarChart(values) {
    var center = 180;
    var radius = 112;
    var labelRadius = 148;

    function point(index, percent, targetRadius) {
      var angle = (-90 + index * 60) * Math.PI / 180;
      var distance = targetRadius * Math.max(0, Math.min(100, percent)) / 100;
      return {
        x: center + Math.cos(angle) * distance,
        y: center + Math.sin(angle) * distance
      };
    }

    function points(percent, targetRadius) {
      return values.map(function(_, index) {
        var item = point(index, percent, targetRadius);
        return item.x.toFixed(1) + ',' + item.y.toFixed(1);
      }).join(' ');
    }

    var grids = [25, 50, 75, 100].map(function(level) {
      return '<polygon class="decision-report__radar-grid" points="' + points(level, radius) + '"></polygon>';
    }).join('');
    var axes = values.map(function(_, index) {
      var edge = point(index, 100, radius);
      return '<line class="decision-report__radar-axis" x1="' + center + '" y1="' + center + '" x2="' + edge.x.toFixed(1) + '" y2="' + edge.y.toFixed(1) + '"></line>';
    }).join('');
    var shapePoints = values.map(function(item, index) {
      var valuePoint = point(index, item.percent, radius);
      return valuePoint.x.toFixed(1) + ',' + valuePoint.y.toFixed(1);
    }).join(' ');
    var nodes = values.map(function(item, index) {
      var valuePoint = point(index, item.percent, radius);
      return '<circle class="decision-report__radar-node" cx="' + valuePoint.x.toFixed(1) + '" cy="' + valuePoint.y.toFixed(1) + '" r="4"></circle>';
    }).join('');
    var labels = values.map(function(item, index) {
      var labelPoint = point(index, 100, labelRadius);
      var anchor = Math.abs(labelPoint.x - center) < 8 ? 'middle' : (labelPoint.x < center ? 'end' : 'start');
      var baselineShift = labelPoint.y < center - 80 ? -6 : (labelPoint.y > center + 80 ? 4 : 0);
      return '<text class="decision-report__radar-label" x="' + labelPoint.x.toFixed(1) + '" y="' + (labelPoint.y + baselineShift).toFixed(1) + '" text-anchor="' + anchor + '">' +
        '<tspan x="' + labelPoint.x.toFixed(1) + '">' + text(item.label) + '</tspan>' +
        '<tspan class="decision-report__radar-value" x="' + labelPoint.x.toFixed(1) + '" dy="16">' + item.percent + '%</tspan></text>';
    }).join('');

    return '<svg class="decision-report__radar" role="img" aria-label="六维路径倾向雷达图。这是六条路径的相对倾向，不是能力、商业价值或成功概率。" viewBox="0 0 360 360">' +
      '<title>六维路径倾向雷达图</title><desc>这是六条路径的相对倾向，不是能力、商业价值或成功概率。</desc>' +
      '<g>' + grids + axes + '</g><polygon class="decision-report__radar-shape" points="' + shapePoints + '"></polygon>' +
      nodes + labels + '</svg>';
  }

  function renderScoreChart(source) {
    var scoreKeys = ['content', 'consulting', 'knowledge', 'template', 'service', 'coaching'];
    var hasScore = source && typeof source === 'object' && scoreKeys.some(function(key) {
      return source[key] !== '' && source[key] !== null && source[key] !== undefined && Number.isFinite(Number(source[key]));
    });
    if (!hasScore) {
      return '<section class="decision-report__score-panel"><div><span>六维路径倾向</span><h3>本次未读取到六维评分</h3><p>不使用 0 分代替缺失数据；其它判断仍只依据本次报告中已有的回答材料。</p></div></section>';
    }
    var values = normalizedScores(source);
    var ranked = values.slice().sort(function(a, b) { return b.percent - a.percent; });
    var rows = ranked.map(function(item, index) {
      return '<li><span>' + String(index + 1).padStart(2, '0') + '</span><strong>' + text(item.label) +
        '</strong><em>' + item.percent + '%</em></li>';
    }).join('');
    return '<section class="decision-report__score-panel"><div class="decision-report__score-intro"><span>六维路径倾向</span><h3>这是相对匹配度，不是能力分数</h3><p>数值来自前面 8 道选择题，用来比较六条可能路径；不能单独证明经验价值或市场需求。</p></div><div class="decision-report__score-visual">' + renderRadarChart(values) + '<ol>' + rows + '</ol></div></section>';
  }

  function renderScoreDetails(source) {
    var scoreKeys = ['content', 'consulting', 'knowledge', 'template', 'service', 'coaching'];
    var hasScore = source && typeof source === 'object' && scoreKeys.some(function(key) {
      return source[key] !== '' && source[key] !== null && source[key] !== undefined && Number.isFinite(Number(source[key]));
    });
    if (!hasScore) return '';
    return renderScoreChart(source);
  }

  function renderStateGrid(modules) {
    var summary = modules.executiveSummary || {};
    var stage = summary.stage || (modules.stageDiagnosis || {}).stage || {};
    var asset = summary.primaryAsset || (modules.assetAssessment || {}).primary || {};
    var bottleneck = summary.bottleneck || (modules.stageDiagnosis || {}).bottleneck || {};
    return '<div class="decision-report__state-grid">' +
      '<article><span>当前经验线索</span><h3>' + text(asset.label || asset.description, '当前材料不足') + '</h3><p>只表示本次回答中已经出现的线索，不代表经验已经产品化。</p></article>' +
      '<article class="is-current"><span>当前阶段</span><h3>' + text(stage.label, '当前材料不足，暂不判断') + '</h3><p>' + text(summary.explanation, '先补充具体事件，再判断经验是否成立。') + '</p></article>' +
      '<article><span>核心卡点</span><h3>' + text(bottleneck.label, '仍需补充事实与证据') + '</h3><p>未提及不等于不存在；写不出来也不等于没有经验。</p></article></div>';
  }

  function renderFactsPanel(modules) {
    var facts = Array.isArray(modules.understoodFacts) ? modules.understoodFacts : [];
    var assets = modules.assetAssessment || {};
    var stage = modules.stageDiagnosis || {};
    return '<div class="decision-report__evidence-columns"><section><h3>已确认的回答线索</h3>' +
      renderFacts(facts) + '</section><section><h3>经验资产判断</h3>' + renderAssets(assets) +
      '</section><section><h3>阶段与缺口</h3>' + renderStage(stage) + '</section></div>';
  }

  function renderPathPanel(modules, scores) {
    var priority = modules.priorityPath || {};
    var boundaries = modules.boundaries || {};
    return '<div class="decision-report__path-layout"><section><h3>当前优先路径</h3>' + renderPriorityPath(priority) +
      '<div class="decision-report__deferred"><h3>暂不建议并行推进</h3>' + renderDeferredPaths(modules.deferredPaths) +
      '</div></section>' + renderScoreChart(scores) + '</div><div class="decision-report__boundary-panel">' + renderBoundaries(boundaries) + '</div>';
  }

  function renderActionSteps(values) {
    var items = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!items.length) return '<p class="assessment-report-v1__empty">当前材料不足，暂时没有可交付的行动清单。</p>';
    return '<ol class="decision-report__steps">' + items.map(function(item, index) {
      return '<li class="decision-report__step"><span>' + text(item.order, index + 1) + '</span><div><h3>' +
        text(item.text) + '</h3>' + (item.doneWhen ? '<p>做到什么算完成：' + text(item.doneWhen) + '</p>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  function renderPurchaseGuidance() {
    return '<div class="decision-report__purchase-groups">' +
      '<article><span>报告边界</span><div><strong>19.9 元自动报告</strong><h3>自动生成，不含Kevin人工审核</h3><p>这是初步判断，不验证商业潜力，不预测收入，也不代表任何人工服务资格已经通过。</p></div></article>' +
      '<article><span>独立自助商品</span><div><strong>99 元 · 365天</strong><h3>一人公司海外源头库</h3><p>用于阅读现有海外源头内容与中文整理；不包含人工咨询，也不是人工服务的前置购买。</p></div></article>' +
      '<article><span>人工服务</span><div><strong>1999 元</strong><h3>帮助你确定方向</h3><p>结合真实经历、意愿与现实条件作出取舍，不包含产品开发；具体安排购买前确认。</p></div><div><strong>9800 元</strong><h3>按约定开发你的产品／模型</h3><p>Kevin本人一对一参与，具体知识或能力模型、方法论、SOP等成果形式与范围按约定，不默认全部包含；购买前由Kevin人工确认适配与范围，自动报告不会批准资格。</p></div></article></div>';
  }

  function renderSummary(modules) {
    var summary = modules.executiveSummary || {};
    var stage = summary.stage || (modules.stageDiagnosis || {}).stage || {};
    var bottleneck = summary.bottleneck || (modules.stageDiagnosis || {}).bottleneck || {};
    var asset = summary.primaryAsset || (modules.assetAssessment || {}).primary || {};
    var next = summary.nextStep;
    if (!next || next === bottleneck.label) {
      next = (modules.priorityPath || {}).label || ((modules.validationTask || {}).steps || [])[0] ||
        (modules.validationTask || {}).goal || '先补充一件具体事件';
    }
    return '<div class="decision-report__summary"><div class="decision-report__verdict-band"><div><span>当前阶段</span><h3>' +
      text(stage.label || bottleneck.label, '当前材料不足，暂不做确定判断') + '</h3><p>' +
      text(summary.explanation, '本次回答不足以形成完整结论，先补充具体事件和可核对证据。') +
      '</p></div><div><span>当前只做一件事</span><strong>' + text(next) + '</strong></div></div>' +
      '<div class="assessment-report-v1__metrics">' +
      labelled('经验主线', asset.label || asset.description, 'confirmed') +
      labelled('当前缺口', bottleneck.label, 'missing') + '</div></div>';
  }

  function renderEvidenceBlock(modules, scores) {
    var stage = modules.stageDiagnosis || {};
    var priority = modules.priorityPath || {};
    return '<div class="decision-report__evidence-columns"><section><h3>系统确认了什么</h3>' +
      renderFacts(modules.understoodFacts) + '</section><section><h3>为什么这样判断</h3><p>' +
      text(stage.explanation, '当前判断仅基于本次回答中可追溯的事实。') + '</p><h3>为什么先走这条路</h3>' +
      renderPriorityPath(priority) + '</section></div>' + renderScoreDetails(scores);
  }

  function renderGapBlock(modules) {
    var boundaries = modules.boundaries || {};
    var stage = modules.stageDiagnosis || {};
    var missing = Array.isArray(boundaries.missingInformation) && boundaries.missingInformation.length
      ? boundaries.missingInformation
      : stage.gaps;
    var html = '<p class="decision-report__boundary-intro">当前缺口按本次回答标注；未提及不等于不存在。</p>' +
      '<div class="decision-report__gap-grid"><section><h3>还不能确定</h3>' +
      list(missing, function(entry) { return '<li><p>' + text(missingInformationLabel(entry)) + '</p></li>'; }, '当前没有额外缺口。') +
      '</section><section><h3>暂时不要做</h3>' + renderDeferredPaths(modules.deferredPaths) + '</section></div>';
    if (boundaries.conflicts && boundaries.conflicts.length) {
      html += '<div class="assessment-report-v1__conflicts"><h3>需要先核对的矛盾回答</h3>' +
        list(boundaries.conflicts, function(entry) { return '<li><p>' + text(entry && entry.text) + '</p></li>'; }) + '</div>';
    }
    html += '<div class="decision-report__cautions"><h3>判断边界</h3>' +
      list(boundaries.cautions, function(entry) { return '<li><p>' + text(entry && (entry.statement || entry.text)) + '</p></li>'; }, '结论仅适用于本次回答所覆盖的事实。') + '</div>';
    return html;
  }

  function renderDecisionDocument(documentValue, options) {
    var modules = (documentValue && documentValue.modules) || {};
    var settings = options || {};
    var task = modules.validationTask || {};
    return '<article class="assessment-report-v1 assessment-report-v1--decision">' + reportHeader(settings) +
      '<section class="decision-report__chapter" data-report-block="judgement">' +
        chapterHeader('核心判断', '先看系统理解了什么，以及当前只需要做哪一件事。') + renderSummary(modules) + '</section>' +
      '<section class="decision-report__chapter" data-report-block="evidence">' +
        chapterHeader('判断依据', '只保留会改变阶段、路径或行动的客户事实。') + renderEvidenceBlock(modules, settings.resultScores) + '</section>' +
      '<section class="decision-report__chapter" data-report-block="gap">' +
        chapterHeader('当前缺口', '明确哪些事情还不能下结论，以及为什么暂缓其他路径。') + renderGapBlock(modules) + '</section>' +
      '<section class="decision-report__chapter" data-report-block="action">' +
        chapterHeader('一个行动', '先完成这一轮最小验证，再根据新证据选择继续、调整或停止。') +
        '<div class="decision-report__task-panel">' + renderValidationTask(task, (modules.priorityPath || {}).label) + '</div>' +
        '<details class="decision-report__purchase-details"><summary>查看购买建议与服务边界</summary>' + renderPurchaseGuidance() + '</details></section>' +
      reportFooter() + '</article>';
  }

  return {
    escapeHtml: escapeHtml,
    renderReportDocument: function renderReportDocument(documentValue, options) {
      if (documentValue && documentValue.decisionMemo && ['assessment-decision-memo-v1','assessment-decision-memo-v2'].includes(documentValue.decisionMemo.schemaVersion)) {
        return renderDecisionMemo(documentValue, options || {});
      }
      return renderDecisionDocument(documentValue, options);
    }
  };
}));
