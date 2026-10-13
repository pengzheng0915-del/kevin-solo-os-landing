(function(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KevinAssessmentReportRenderer = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  var keys = ['content', 'consulting', 'knowledge', 'template', 'service', 'coaching'];
  var labels = ['内容表达', '咨询服务', '知识产品', '模板工具', '标准服务', '陪跑辅导'];
  var moduleLabels = ['是否建议现在做', '为什么这样判断', '最大误判与暂缓事项', '信息不足提醒', '优先、备用与暂缓路径', '第一版服务假设', '七天验证清单', '四类沟通话术', '自行研究的方法', '人工方向诊断', '深度服务准备条件', '真实卡点', '试错成本', '六维路径倾向', '现状与验证比较', '验证后的三十天'];
  var scriptKinds = ['moments', 'interview', 'trialInvite', 'rejectionFollowup'];
  var scriptNames = ['朋友圈验证文案', '私聊访谈话术', '低价试单邀请', '被拒绝后的追问'];
  function arr(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
  function str(value) { return typeof value === 'string' ? value.trim() : ''; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function txt(value, fallback) { return escapeHtml(str(value) || fallback || ''); }
  function para(value, cls) { return str(value) ? '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + txt(value) + '</p>' : ''; }
  function bullets(values, empty) { var items = arr(values); return items.length ? '<ul>' + items.map(function(item) { return '<li>' + txt(typeof item === 'string' ? item : item.text || item.label || item.statement) + '</li>'; }).join('') + '</ul>' : para(empty || '历史报告未保存这项内容，当前不能补作个性化判断。', 'krv-muted'); }
  function dl(entries) { return '<dl class="krv-dl">' + entries.filter(function(item) { return str(item[1]); }).map(function(item) { return '<div><dt>' + txt(item[0]) + '</dt><dd>' + txt(item[1]) + '</dd></div>'; }).join('') + '</dl>'; }
  function status(value) { return ({ available: '有依据', present: '有依据', self_reported: '本次自述', hypothesis: '待验证假设', conditional: '满足条件后', needs_input: '资料不足', insufficient: '资料不足', not_applicable: '当前不适用', missing: '资料不足', partial: '部分可回答', historical: '历史已有内容' })[value] || '待核对'; }
  function badge(value) { return '<span class="krv-status">' + txt(status(value)) + '</span>'; }
  function chapter(id, n, title, body) { return '<section class="krv-chapter" id="report-' + id + '" data-report-block="' + id + '"><header class="krv-chapter-head"><span>' + n + '</span><h2>' + title + '</h2></header>' + body + '</section>'; }
  function unique(values) { var seen = Object.create(null); return arr(values).filter(function(v) { var key = str(typeof v === 'string' ? v : v.text); if (!key || seen[key]) return false; seen[key] = true; return true; }); }
  function missingLabel(value) {
    if (str(value.label)) return value.label;
    var name = ({ case: '真实事件的背景、动作和结果', external_result: '可核对的外部结果', demand: '真实需求或求助信号', payment: '真实付费证据', repeat_delivery: '重复交付或复购证据' })[value.field];
    if (value.reason === 'incident_not_structured') return '真实事件尚未形成完整事实链';
    if (name) return name + (value.reason === 'explicitly_absent' ? '：本次回答明确表示暂时没有' : '：本次回答尚未提供');
    return /[一-鿿]/.test(value.reason || '') ? value.reason : '本次回答有一项关键信息需要补充';
  }
  // A display adapter only: it preserves saved prose and never reasons over customer answers.
  function historicalPresentation(documentValue, options) {
    var m = documentValue.modules || {}, memo = documentValue.decisionMemo || {};
    var summary = m.executiveSummary || {}, asset = m.assetAssessment || {}, stage = m.stageDiagnosis || {}, task = m.validationTask || {}, action = memo.action || {}, bounds = m.boundaries || {};
    var verdict = memo.verdict || {}, priority = m.priorityPath || {};
    var savedFacts = unique(arr(m.understoodFacts).concat(arr(memo.known)));
    var facts = savedFacts.map(function(item) { return { text: item.text, interpretation: '', limitation: item.limitation || '' }; });
    arr(memo.decisionBasis).forEach(function(item) { facts.push({ text: item.fact, interpretation: item.effect, limitation: '' }); });
    var steps = arr(task.steps).map(function(step) { return { title: step, action: '', doneWhen: '' }; });
    arr(m.actionChecklist).forEach(function(item) { steps.push({ title: item.text, action: '', doneWhen: item.doneWhen }); });
    arr(action.steps).forEach(function(step) { if (!steps.some(function(item) { return item.title === step; })) steps.push({ title: step }); });
    var unknown = arr(memo.unknown).map(function(item) { return [item.text, item.impact].filter(Boolean).join('；'); });
    unknown = unique(unknown.concat(arr(bounds.missingInformation).map(missingLabel), arr(stage.gaps).map(function(item) { return item.label; })));
    var boundaryText = arr(bounds.cautions).map(function(item) { return item.statement || item.text; }).concat(arr(bounds.hypotheses).map(function(item) { return item.label || item.description || item.text; }), [memo.boundary, bounds.intro]);
    return { schemaVersion: 'assessment-customer-presentation-v1', origin: 'historical_adapter',
      goal: { question: '', answer: [verdict.label, verdict.statement, summary.explanation].filter(Boolean).join('。'), cannotAnswer: unknown }, facts: facts,
      stage: { label: (stage.stage || summary.stage || {}).label, bottleneck: (stage.bottleneck || summary.bottleneck || {}).label, meaning: [asset.explanation, (asset.primary || summary.primaryAsset || {}).label, (asset.primary || {}).description, (summary.primaryAsset || {}).description, stage.explanation].filter(Boolean).join('；') },
      paths: { primary: { title: priority.label, reason: priority.explanation || priority.rationale }, deferred: arr(m.deferredPaths).map(function(item) { return { title: item.label, reason: item.explanation || item.rationale }; }) },
      serviceHypothesis: { status: 'needs_input', missing: ['历史报告未保存服务对象、问题、交付物及价格假设。'] },
      sevenDay: { steps: steps, worksheet: arr(action.worksheet), notes: [task.intro, task.goal, task.script, task.completionCriteria, action.title, action.why, action.doneWhen, action.stopRule, summary.nextStep].filter(Boolean) },
      scripts: scriptKinds.map(function(kind) { return { kind: kind, status: 'needs_input', scenario: '历史报告未保存独立的场景、对象与对外沟通正文。', conditions: [] }; }),
      decisionRules: { continue: action.doneWhen || task.completionCriteria, stop: action.stopRule }, thirtyDay: { status: 'needs_input' }, help: {}, cost: {}, boundaries: unique(boundaryText),
      scores: historicalScores(options.resultScores, options.quizModel || root.KevinQuizModel),
      coverage: moduleLabels.map(function(label, index) { return { id: String(index + 1).padStart(2, '0'), label: label, status: [1,2,3,4,5,7,12,14,15].indexOf(index + 1) >= 0 ? 'historical' : 'needs_input', reason: [1,2,3,4,5,7,12,14,15].indexOf(index + 1) >= 0 ? '保留已保存判断、事实与行动；缺项就近说明。' : '历史报告未保存该项的完整内容。' }; }),
      legacyExtras: { strengths: arr(stage.strengths).concat(summary.primaryStrength ? [summary.primaryStrength] : []), candidates: arr(asset.candidates).filter(function(item) { return item.id !== (asset.primary || {}).id; }), confirmed: arr(bounds.confirmed).filter(function(item) { return !savedFacts.some(function(fact) { return fact.text === item.text; }); }), conflicts: arr(bounds.conflicts) }
    };
  }
  function historicalScores(source, model) {
    return { status: 'historical', items: keys.map(function(key, i) { return { key: key, label: labels[i], raw: source && source[key], max: model && model.typeMax && model.typeMax[key] }; }), basis: '原始分 ÷ 该路径量表上限', note: '历史评分使用当前量表定义。缺少量表上限时不换算比例。' };
  }
  function scoreItems(scores) {
    return keys.map(function(key, i) {
      var saved = arr(scores.items).find(function(item) { return item.key === key; }) || {};
      var rawPresent = saved.raw !== null && saved.raw !== undefined && saved.raw !== '' && Number.isFinite(Number(saved.raw));
      var maxPresent = saved.max !== null && saved.max !== undefined && saved.max !== '' && Number.isFinite(Number(saved.max)) && Number(saved.max) > 0;
      var raw = rawPresent ? Number(saved.raw) : null, max = maxPresent ? Number(saved.max) : null;
      var ratio = rawPresent && maxPresent ? raw / max : null;
      return { key: key, label: str(saved.label) || labels[i], raw: raw, max: max, ratio: ratio, percent: ratio === null ? null : Math.round(ratio * 100) };
    });
  }
  function radar(items) {
    function point(i, ratio, radius) { var angle = (-90 + i * 60) * Math.PI / 180; return [(200 + Math.cos(angle) * radius * Math.max(0, Math.min(1, ratio))).toFixed(1), (180 + Math.sin(angle) * radius * Math.max(0, Math.min(1, ratio))).toFixed(1)]; }
    function polygon(ratio) { return items.map(function(_, i) { return point(i, ratio, 112).join(','); }).join(' '); }
    var html = '<svg class="krv-radar" role="img" aria-label="六维路径倾向雷达图" viewBox="0 0 400 360"><title>六维路径倾向雷达图</title><desc>原始分占各路径量表上限的比例，用于比较本次答卷的倾向。</desc>';
    [0.25, 0.5, 0.75, 1].forEach(function(ratio) { html += '<polygon class="krv-radar-grid" points="' + polygon(ratio) + '"/>'; });
    items.forEach(function(_, i) { var p = point(i, 1, 112); html += '<line class="krv-radar-grid" x1="200" y1="180" x2="' + p[0] + '" y2="' + p[1] + '"/>'; });
    html += '<polygon class="krv-radar-shape" points="' + items.map(function(item, i) { return point(i, item.ratio, 112).join(','); }).join(' ') + '"/>';
    items.forEach(function(item, i) { var p = point(i, 1, 148), x = Number(p[0]); var anchor = Math.abs(x - 200) < 8 ? 'middle' : x < 200 ? 'end' : 'start'; html += '<text class="krv-radar-label" x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + anchor + '"><tspan x="' + p[0] + '">' + txt(item.label) + '</tspan><tspan x="' + p[0] + '" dy="18">' + item.percent + '%</tspan></text>'; });
    return html + '</svg>';
  }
  function renderScores(scores) {
    scores = scores || {};
    var items = scoreItems(scores), complete = items.every(function(item) { return item.ratio !== null; });
    var ranked = items.slice().sort(function(a, b) { return a.ratio === null ? b.ratio === null ? 0 : 1 : b.ratio === null ? -1 : b.ratio - a.ratio; });
    var html = '<div class="krv-scores"><h3>六维路径倾向</h3><p>来自前面选择题的路径倾向。它不能单独证明经验价值、真实需求或可收费；最高分也不等于现在应出售这项服务。</p>';
    html += complete ? radar(items) : para('雷达图暂不绘制：六个维度没有全部读取时，不用 0 分补齐缺失项。', 'krv-muted');
    html += '<ol class="krv-score-list" aria-label="路径得分与量表上限">' + ranked.map(function(item) { return '<li data-score-key="' + item.key + '"><strong>' + txt(item.label) + '</strong><span class="krv-track">' + (item.ratio !== null ? '<i style="width:' + Math.max(0, Math.min(100, item.ratio * 100)) + '%"></i>' : '') + '</span><span class="krv-score-value">' + (item.percent === null ? '未读取' : item.percent + '%') + '<small>' + (item.raw !== null ? item.raw + ' / ' + (item.max === null ? '上限未读取' : item.max) : '原始分未读取') + '</small></span></li>'; }).join('') + '</ol>';
    return html + '<p class="krv-scale"><strong>怎样读分数：</strong>原始分 ÷ 该路径量表上限，四舍五入显示百分比。它不是能力分、商业价值、收入或成功概率。</p>' + para(scores.note, 'krv-muted') + '</div>';
  }
  function renderScripts(scripts) {
    return scriptKinds.map(function(kind, i) {
      var item = arr(scripts).find(function(script) { return script.kind === kind; }) || { status: 'needs_input' };
      var available = ['available', 'needs_input'].indexOf(item.status) >= 0 && str(item.body);
      var id = 'report-script-' + i;
      return '<article class="krv-script" data-script-kind="' + kind + '"><h3>' + scriptNames[i] + ' ' + badge(item.status) + '</h3>' + dl([['场景', item.scenario], ['对象', item.audience], ['目的', item.purpose]]) +
        '<p class="krv-muted"><strong>适用条件：</strong>' + txt(arr(item.conditions).join('；'), '请先补齐场景与对象，不能直接发出邀请。') + '</p>' +
        (available ? (item.status === 'needs_input' ? para('这是一份待填写草案。请先补齐方括号内的信息、核对条件，再向对方发送。', 'krv-muted') : '') + '<blockquote id="' + id + '" class="krv-script-body">' + txt(item.body) + '</blockquote><div class="krv-copy-row"><span id="' + id + '-status" role="status" aria-live="polite">使用前请核对真实情况。</span><button type="button" data-copy-script="' + id + '">复制话术</button></div>' : para('当前未提供可直接发送的正文；适用条件成立后再使用。', 'krv-muted')) + '</article>';
    }).join('');
  }
  function renderReportDocument(documentValue, options) {
    documentValue = documentValue || {}; options = options || {};
    var p = documentValue.presentation && documentValue.presentation.schemaVersion === 'assessment-customer-presentation-v1' ? documentValue.presentation : historicalPresentation(documentValue, options);
    var g = p.goal || {}, stage = p.stage || {}, paths = p.paths || {}, hypothesis = p.serviceHypothesis || {}, week = p.sevenDay || {}, rules = p.decisionRules || {}, month = p.thirtyDay || {}, help = p.help || {}, cost = p.cost || {}, extras = p.legacyExtras || {};
    var title = str(options.title).replace(/<\/?span\b[^>]*>/gi, '').replace(/个人经验\s*个人经验/g, '个人经验');
    var html = '<article class="krv-report" data-report-template="customer-presentation-v1"><header class="krv-header"><p class="krv-eyebrow">KEVIN · 个人经验完整路径报告</p><h1>' + txt(title, '个人经验完整路径报告') + '</h1><p class="krv-meta">' + txt(options.time) + (options.time ? ' · ' : '') + (options.reportId ? '报告编号 ' + txt(String(options.reportId)) : '本次报告') + '</p><p class="krv-muted">先读问题与判断，再看依据、路径和行动。信息不足的部分会明确保留。</p></header>';
    html += '<nav class="krv-nav" aria-label="报告章节导航">' + [['goal','你的问题'],['evidence','判断依据'],['paths','路径取舍'],['action','本周行动'],['followup','复盘下一步']].map(function(item) { return '<a href="#report-' + item[0] + '">' + item[1] + '</a>'; }).join('') + '</nav>';
    html += chapter('goal', '01', '先回答你的问题', '<h3>你的原问题</h3>' + para(g.question || '历史报告未保存独立的原问题，不能据此声称已回答你的完整取舍。') + '<div class="krv-lead">' + para(g.answer || '当前材料不足，暂不能形成完整判断。') + '</div>' + (arr(g.canAnswer).length ? '<h3>这份报告能回答</h3>' + bullets(g.canAnswer) : '') + (arr(g.cannotAnswer).length ? '<h3>目前还不能确定</h3>' + bullets(g.cannotAnswer) : '') + (arr(g.clarifications).length ? '<h3>需要补充的问题</h3>' + bullets(g.clarifications) : ''));
    var evidence = arr(p.facts).map(function(item) { return '<article class="krv-evidence">' + dl([['你的回答', item.text], ['本次解释', item.interpretation], ['仍待核对', item.limitation]]) + '</article>'; }).join('') || para('本次回答中没有更多可确认信息。', 'krv-muted');
    evidence += dl([['经验主线与阶段', stage.label], ['真实卡点', stage.bottleneck], ['怎样理解', stage.meaning]]) + (arr(extras.strengths).length ? '<h3>当前优势</h3>' + bullets(extras.strengths) : '') + (arr(extras.candidates).length ? '<h3>其它经验线索</h3>' + bullets(extras.candidates) : '') + (arr(extras.confirmed).length ? '<h3>已保存的其它事实</h3>' + bullets(extras.confirmed) : '') + (arr(extras.conflicts).length ? '<h3>需要先核对的矛盾回答</h3>' + bullets(extras.conflicts) : '');
    html += chapter('evidence', '02', '这个判断从哪里来', evidence);
    function route(label, value) { value = value || {}; return '<article class="krv-route"><h3>' + label + '</h3>' + para(value.title || (!value.reason ? '历史报告未保存该路径的独立判断。' : '')) + para(value.reason) + '</article>'; }
    html += chapter('paths', '03', '六条路径，怎样取舍', renderScores(p.scores) + route('第一优先', paths.primary) + route('备用方式与启动条件', paths.backup) + '<h3>暂缓方向</h3>' + (arr(paths.deferred).length ? arr(paths.deferred).map(function(item) { return route(txt(item.title), { reason: item.reason }); }).join('') : para('本次没有额外需要暂缓的路径。')) + '<h3>投入与试错成本</h3>' + dl([['做一次验证', cost.trial], ['维持现状', cost.unchanged], ['怎样比较', cost.comparison]]) + (!cost.trial && !cost.comparison ? para('历史报告未保存可核对的成本比较，不估算收入或机会成本。', 'krv-muted') : ''));
    html += chapter('hypothesis', '04', '第一版服务假设', badge(hypothesis.status) + dl([['服务对象', hypothesis.audience], ['具体问题', hypothesis.problem], ['第一交付物', hypothesis.deliverable], ['验证价格', hypothesis.price], ['交付边界', hypothesis.boundary]]) + (arr(hypothesis.missing).length ? '<h3>推进前需要补齐</h3>' + bullets(hypothesis.missing) : ''));
    var actionHtml = arr(week.constraints).length ? dl(week.constraints.map(function(item) { return [item.label, item.value]; })) : '';
    actionHtml += '<ol class="krv-schedule">' + arr(week.steps).map(function(item, i) { return '<li><span>' + txt(item.day, String(i + 1)) + '</span><div><h3>' + txt(item.title) + '</h3>' + para(item.action) + (item.doneWhen ? '<p class="krv-muted">做到什么算完成：' + txt(item.doneWhen) + '</p>' : '') + '</div></li>'; }).join('') + '</ol>';
    if (!arr(week.steps).length) actionHtml += para('历史报告未保存七天安排，暂不编排新的个性化计划。', 'krv-muted');
    if (arr(week.notes).length) actionHtml += '<h3>原报告的任务与完成标准</h3>' + bullets(week.notes);
    if (arr(week.worksheet).length) actionHtml += '<h3>随手留一张核对记录</h3><p class="krv-muted">以下问题仅供你自行记录；本页不会提交或保存你的填写内容。</p>' + dl(week.worksheet.map(function(item) { return [item.label, item.prompt]; }));
    html += chapter('action', '05', '接下来七天，完成一次核对', actionHtml + '<h3>按场景选择沟通话术</h3>' + renderScripts(p.scripts));
    html += chapter('followup', '06', '用什么信号决定下一步', dl([['继续', rules.continue], ['调整', rules.adjust], ['暂停', rules.stop]]) + ((!rules.continue && !rules.stop) ? para('历史报告未保存继续、调整与停止条件，不能替你补作结论。', 'krv-muted') : '') + '<h3>验证成立后的三十天</h3>' + badge(month.status) + para(month.condition || '历史报告未保存三十天推进的启动条件。') + '<ol class="krv-schedule">' + arr(month.steps).map(function(item) { return '<li><span>' + txt(item.period) + '</span><div>' + para(item.action) + para(item.passSignal, 'krv-muted') + '</div></li>'; }).join('') + '</ol>');
    html += chapter('help', '07', '需要外部帮助时，怎样选', dl([['自行研究', help.selfService], ['人工方向诊断', help.personalized], ['深度服务的准备条件', help.readiness], ['服务边界', help.purchaseBoundary]]) + ((!help.selfService && !help.personalized) ? para('历史报告未保存当时的完整服务建议；不根据旧文档自动增加购买要求。', 'krv-muted') : '') + '<h3>完整使用边界</h3>' + bullets(p.boundaries, '本报告根据测评回答自动形成初步判断；不证明市场需求、真实付费或稳定收益。'));
    var coverage = arr(p.coverage);
    html += '<details class="krv-appendix"><summary>查看完整内容清单与评分口径</summary><p class="krv-muted">原十六项逐项保留状态；资料不足与当前不适用也会说明原因。</p><ol class="krv-coverage">' + moduleLabels.map(function(label, i) { var id = String(i + 1).padStart(2, '0'), item = coverage.find(function(v) { return v.id === id; }) || {}; var section = ({ goal: 'goal', facts: 'evidence', stage: 'evidence', boundaries: 'help', paths: 'paths', cost: 'paths', scores: 'paths', serviceHypothesis: 'hypothesis', sevenDay: 'action', scripts: 'action', thirtyDay: 'followup', help: 'help' })[item.section]; return '<li data-coverage-id="' + id + '"><strong>' + id + ' ' + txt(item.label || label) + '</strong>' + badge(item.status) + (section ? '<a href="#report-' + section + '">查看正文</a>' : '') + para(['insufficient','needs_input','missing','not_applicable'].indexOf(item.status) >= 0 ? item.reason || '本次未提供完整内容，请补充材料后重新判断。' : '状态与适用条件已在正文说明。', 'krv-muted') + '</li>'; }).join('') + '</ol>' + para(/^(linked_screening|frozen_screening)$/.test((p.scores || {}).basis) ? '评分来自与本报告关联的初筛答卷。' : (p.scores || {}).basis === 'unavailable' ? '当前冻结材料没有完整评分口径。' : (p.scores || {}).basis) + para((p.scores || {}).scaleVersion ? '量表版本：' + (p.scores || {}).scaleVersion : '', 'krv-muted') + '</details>';
    return html + '<footer class="krv-footer"><strong>Kevin 彭峥｜职业经验资产顾问</strong><p>本报告用于帮助你核对事实、缩小取舍和安排验证。最终选择由你决定。</p><a href="#report-goal">返回开头</a></footer></article>';
  }
  function bindCopyActions(container, environment) {
    if (!container || container.__kevinReportCopyBound) return;
    container.__kevinReportCopyBound = true;
    var env = environment || root;
    container.addEventListener('click', async function(event) {
      var button = event.target && event.target.closest && event.target.closest('[data-copy-script]');
      if (!button || !container.contains(button)) return;
      var id = button.getAttribute('data-copy-script');
      if (!/^report-script-[0-3]$/.test(id)) return;
      var body = container.querySelector('#' + id), statusNode = container.querySelector('#' + id + '-status');
      if (!body) return;
      try {
        if (!env.navigator || !env.navigator.clipboard) throw new Error('clipboard unavailable');
        await env.navigator.clipboard.writeText(body.textContent);
        if (statusNode) statusNode.textContent = '话术已复制，请先核对真实情况再使用。';
      } catch (error) {
        if (env.document && env.getSelection) { var range = env.document.createRange(); range.selectNodeContents(body); var selection = env.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
        if (statusNode) statusNode.textContent = '请选中话术正文后使用复制操作。';
      }
    });
  }
  function bindReportInteractions(container, environment) {
    if (!container) return;
    if (container.__kevinReportInteractionsCleanup) container.__kevinReportInteractionsCleanup();
    bindCopyActions(container, environment);
    var env = environment || root;
    var report = container.querySelector('.krv-report');
    var nav = report && report.querySelector('.krv-nav');
    if (!nav || !env.addEventListener) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#report-"]'));
    var chapters = Array.prototype.slice.call(report.querySelectorAll('.krv-chapter'));
    var mapping = { hypothesis: 'paths', help: 'followup' };
    var current = '', frame = null;
    function setCurrent(section) {
      var target = '#report-' + (mapping[section] || section);
      if (current === target) return;
      current = target;
      links.forEach(function(link) {
        var active = link.getAttribute('href') === target;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
        if (active) {
          var box = nav.getBoundingClientRect(), item = link.getBoundingClientRect();
          if (item.left < box.left + 8) nav.scrollLeft += item.left - box.left - 8;
          else if (item.right > box.right - 8) nav.scrollLeft += item.right - box.right + 8;
        }
      });
    }
    function measure() {
      var header = env.document && env.document.querySelector('.kv-global-header');
      var headerBox = header && header.getBoundingClientRect();
      var position = header && env.getComputedStyle(header).position;
      var top = headerBox && (position === 'sticky' || position === 'fixed') ? Math.max(0, headerBox.bottom) : 0;
      report.style.setProperty('--krv-nav-top', top + 'px');
      report.style.setProperty('--krv-nav-offset', (top + nav.offsetHeight + 24) + 'px');
    }
    function update() {
      frame = null;
      if (!report.isConnected) { cleanup(); return; }
      measure();
      // Read the chapter entering the upper reading area, including anchor landings
      // while the site's header switches between its initial and scrolled states.
      var readingLine = nav.getBoundingClientRect().bottom + Math.min(150, env.innerHeight * 0.2);
      var active = chapters[0];
      chapters.forEach(function(chapter) { if (chapter.getBoundingClientRect().top <= readingLine) active = chapter; });
      if (active) setCurrent(active.getAttribute('data-report-block'));
    }
    function schedule() {
      if (frame === null) frame = env.requestAnimationFrame(update);
    }
    function onClick(event) {
      var link = event.target.closest && event.target.closest('a[href^="#report-"]');
      if (link && report.contains(link)) setCurrent(link.getAttribute('href').slice(8));
    }
    function cleanup() {
      env.removeEventListener('scroll', schedule);
      env.removeEventListener('resize', schedule);
      env.removeEventListener('hashchange', schedule);
      report.removeEventListener('click', onClick);
      if (frame !== null) env.cancelAnimationFrame(frame);
      if (container.__kevinReportInteractionsCleanup === cleanup) delete container.__kevinReportInteractionsCleanup;
    }
    env.addEventListener('scroll', schedule, { passive: true });
    env.addEventListener('resize', schedule, { passive: true });
    env.addEventListener('hashchange', schedule);
    report.addEventListener('click', onClick);
    container.__kevinReportInteractionsCleanup = cleanup;
    update();
    return cleanup;
  }
  return { escapeHtml: escapeHtml, renderReportDocument: renderReportDocument, bindCopyActions: bindCopyActions, bindReportInteractions: bindReportInteractions };
}));
