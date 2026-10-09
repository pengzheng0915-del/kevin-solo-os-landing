/* kevin-report-v1.js — 文案模块层 + 报告组合层
 *
 * 只负责把 kevin-judgement.js 产出的判断对象渲染成 HTML。
 * 不做判断、不调模型、不补造事实。
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinReportV1 = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function t(value) { return esc(value); }

  var STYLE_ID = 'ksj-report-style';
  var CSS = [
    '.ksj-free{display:grid;gap:14px;margin-top:14px}',
    '.ksj-block{border:1px solid rgba(230,222,210,.95);border-radius:18px;background:rgba(255,255,255,.62);padding:18px 18px 16px}',
    '.ksj-block>header{display:flex;align-items:center;gap:9px;margin-bottom:10px}',
    '.ksj-block>header>span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;color:#F6F1E8;background:#55624F;flex:0 0 auto}',
    '.ksj-block>header>h3{margin:0;font-size:16px;line-height:1.35;color:#2D2926}',
    '.ksj-block p{margin:0;font-size:14px;line-height:1.85;color:#5C5349}',
    '.ksj-stage{margin-bottom:8px!important}',
    '.ksj-stage strong{color:#2D2926}',
    '.ksj-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-bottom:6px!important}',
    '.ksj-tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:800;color:#55624F;background:rgba(85,98,79,.1);border:1px solid rgba(85,98,79,.18);flex:0 0 auto}',
    '.ksj-line>strong{font-size:15px;color:#2D2926}',
    '.ksj-why{margin-top:8px!important;padding-top:8px;border-top:1px dashed rgba(230,222,210,.95)}',
    '.ksj-block ul{margin:8px 0 0;padding-left:18px;display:grid;gap:7px}',
    '.ksj-block li{font-size:14px;line-height:1.8;color:#5C5349}',
    '.ksj-block li strong{color:#2D2926;display:block}',
    '.ksj-block li em{font-style:normal;display:block;color:#7A7168;font-size:13px;line-height:1.7}',
    '.ksj-missing{margin-top:10px!important;padding:10px 12px;border-radius:12px;background:rgba(138,58,43,.06);border:1px solid rgba(138,58,43,.16);color:#8A3A2B!important;font-size:16px}',
    '.ksj-pass{margin-top:10px!important;padding:12px 14px;border-radius:12px;background:rgba(85,98,79,.06);border:1px solid rgba(85,98,79,.16)}',
    '.ksj-pass strong{color:#55624F;display:block;margin-bottom:4px;font-size:13px}',
    '.ksj-note{margin-top:8px!important;font-size:15.5px;color:#7A7168!important}',
    '.ksj-report{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;max-width:100%;gap:18px}',
    '.ksj-r{min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;scroll-margin-top:90px;border:1px solid rgba(230,222,210,.95);border-radius:20px;background:rgba(255,255,255,.66);padding:22px}',
    '.ksj-r__head{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
    '.ksj-r__num{flex:0 0 auto;white-space:nowrap;font-size:12px;font-weight:900;letter-spacing:.1em;color:#B08A5A}',
    '.ksj-r__head h2{margin:0;font-size:20px;line-height:1.3;color:#2D2926}',
    '.ksj-r__head p{margin:2px 0 0;font-size:13px;color:#7A7168}',
    '.ksj-r p{font-size:14.5px;line-height:1.9;color:#4C4035;margin:0 0 10px}',
    '.ksj-r p:last-child{margin-bottom:0}',
    '.ksj-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
    '.ksj-two>article{min-width:0;box-sizing:border-box;border-radius:16px;padding:16px;border:1px solid rgba(230,222,210,.95);background:rgba(255,255,255,.6)}',
    '.ksj-two>article.yes{border-color:rgba(85,98,79,.28);background:rgba(85,98,79,.05)}',
    '.ksj-two>article.no{border-color:rgba(176,138,90,.3);background:rgba(176,138,90,.06)}',
    '.ksj-two h3{margin:0 0 10px;font-size:15px;color:#2D2926}',
    '.ksj-two ul{margin:0;padding-left:16px;display:grid;gap:7px}',
    '.ksj-two li{font-size:13.5px;line-height:1.75;color:#5C5349}',
    '.ksj-two li em{font-style:normal;display:block;color:#8A7F72;font-size:12.5px}',
    '.ksj-gap{border-radius:16px;padding:16px;border:1px solid rgba(138,58,43,.18);background:rgba(138,58,43,.05);margin-bottom:12px}',
    '.ksj-gap.moderate{border-color:rgba(176,138,90,.28);background:rgba(176,138,90,.07)}',
    '.ksj-gap.none{border-color:rgba(85,98,79,.26);background:rgba(85,98,79,.06)}',
    '.ksj-gap h3{margin:0 0 6px;font-size:16px;color:#2D2926}',
    '.ksj-gap small{display:block;font-size:12px;color:#7A7168;margin-bottom:6px}',
    '.ksj-path{border-radius:16px;padding:16px;border:1px solid rgba(230,222,210,.95);margin-bottom:10px;background:rgba(255,255,255,.6)}',
    '.ksj-path b{display:block;font-size:13px;color:#7A7168;font-weight:700;margin-bottom:4px}',
    '.ksj-path strong{font-size:15.5px;color:#2D2926;display:block;margin-bottom:6px}',
    '.ksj-path--first{border-color:rgba(85,98,79,.3);background:rgba(85,98,79,.055)}',
    '.ksj-path--avoid{border-color:rgba(138,58,43,.2);background:rgba(138,58,43,.045)}',
    '.ksj-days{display:grid;gap:9px;margin:6px 0 12px}',
    '.ksj-day{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;border:1px solid rgba(230,222,210,.95);border-radius:14px;padding:12px 14px;background:rgba(255,255,255,.55)}',
    '.ksj-day span{font-size:12.5px;font-weight:800;color:#B08A5A}',
    '.ksj-day p{margin:0;font-size:13.5px;line-height:1.75}',
    '.ksj-final{border-radius:16px;border:1px solid rgba(85,98,79,.24);background:rgba(85,98,79,.055);padding:18px}',
    '.ksj-final p{margin:0 0 10px;font-size:14.5px}',
    '.ksj-final p:last-child{margin-bottom:0}',
    '.ksj-final b{color:#55624F}',
    '.ksj-soft{margin-top:14px;padding-top:12px;border-top:1px dashed rgba(230,222,210,.95);font-size:13px;color:#7A7168}',
    '.ksj-radar{margin:16px 0 2px;display:flex;flex-direction:column;align-items:center}',
    '.ksj-radar svg{width:100%;max-width:392px;height:auto;display:block}',
    '.ksj-radar__legend{display:flex;flex-wrap:wrap;gap:7px 16px;justify-content:center;margin-top:6px}',
    '.ksj-radar__legend span{font-size:12.5px;color:#5C5349;line-height:1.6}',
    '.ksj-radar__legend b{color:#2D2926;font-weight:800}',
    '@media(max-width:820px){.ksj-two{grid-template-columns:1fr}.ksj-r{padding:18px}.ksj-day{grid-template-columns:52px minmax(0,1fr)}}'
    ,'.ksj-r__head>div,.ksj-day>p{min-width:0}.kv-report-toc a{display:block;color:inherit;text-decoration:none}.kv-report-toc a:focus-visible,.kv-report-actions button:focus-visible{outline:3px solid #8a542f;outline-offset:3px}.kv-report-actions{display:flex;flex-wrap:wrap;gap:10px;padding:14px 18px}.kv-report-actions a,.kv-report-actions button{font:inherit;font-size:15px;min-height:44px;padding:10px 14px;border:1px solid #a9b2a4;background:#f6f1e8;color:#183e32;border-radius:8px;cursor:pointer}.ksj-trace{margin:10px 0;font-size:14px}.ksj-trace summary{cursor:pointer;min-height:32px}@media(max-width:820px){.ksj-r__head{align-items:flex-start}.ksj-radar{min-width:0;max-width:100%}}'
  ].join('');

  function ensureStyle(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    var node = doc.createElement('style');
    node.id = STYLE_ID;
    node.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(node);
  }

  function li(items, render) {
    var values = (items || []).filter(Boolean);
    if (!values.length) return '';
    return '<ul>' + values.map(render).join('') + '</ul>';
  }

  /* 付费信息冲突（Round D 第 2 条）：阶段 / 付费证据 / 结论三处必须同时说清
   * "现在无法判断，需要你先确认"，不能一边写"系统放大期"一边写"付费不足"。 */
  var CONFLICT_FALLBACK = '你在两处对"是否已经收到过钱"的回答互相矛盾，报告不把任何一处当作已发生的付费事实。';
  function conflictBlock(noteText) {
    var note = noteText || CONFLICT_FALLBACK;
    return '<p class="ksj-missing" data-ksj="payment-conflict">'
      + '付费信息存在冲突，需要确认：' + t(note) + '</p>';
  }

  /* ================= 免费摘要：固定 4 个模块 ================= */

  function renderFreeSummary(J) {
    if (!J) return '';
    var fs = J.freeSummary || (root.KevinJudgement ? root.KevinJudgement.buildFreeSummary(J) : null);
    if (!fs) return '';
    var a = fs.A_judgement || {};
    var html = '<div class="ksj-free" data-ksj="free-summary">';

    // A. 当前判断
    html += '<section class="ksj-block" data-ksj-block="A">';
    html += '<header><span>A</span><h3>当前判断</h3></header>';
    html += '<p class="ksj-stage">当前阶段：<strong>' + t(a.stage) + '</strong></p>';
    if (a.stageWhy) html += '<p class="ksj-note">' + t(a.stageWhy) + '</p>';
    html += '<p class="ksj-line"><span class="ksj-tag">方向倾向</span><strong>' + t(a.direction) + '</strong></p>';
    html += '<p class="ksj-line"><span class="ksj-tag">当前动作</span><strong>' + t(a.action) + '</strong></p>';
    html += '<p class="ksj-why">方向倾向说的是"你更可能适合哪种交付"，当前动作说的是"现在最该做哪一步验证"。' + t(fs.A_reason) + '</p>';
    if (a.directionReason) html += '<details class="ksj-trace"><summary>查看方向判断依据</summary><p class="ksj-note">' + t(a.directionReason) + '</p></details>';
    if (fs.paymentConflict) html += conflictBlock(fs.paymentNote);
    html += '<p class="ksj-note">8 题准备度：' + t(a.readiness) + '（' + t(a.readinessScore) + ' 分）。'
      + '这只是 8 题选择的准备度，不是你的当前阶段；当前阶段由你在深度判断里提供的真实证据决定。</p>';
    html += '</section>';

    // B. 为什么这样判断
    html += '<section class="ksj-block" data-ksj-block="B">';
    html += '<header><span>B</span><h3>为什么这样判断</h3></header>';
    if (fs.B_facts && fs.B_facts.length) {
      html += '<p>我看到的关键事实：</p>';
      html += li(fs.B_facts, function (item) { return '<li>' + t(item) + '</li>'; });
    } else {
      html += '<p>这次你只完成了 8 题选择，还没有补充具体经历。所以下面这些我暂时无法引用你的真实情况。</p>';
    }
    if (fs.B_storyQuote) html += '<p class="ksj-note">' + t(fs.B_storyQuote) + '</p>';
    if (fs.B_missing && fs.B_missing.length) {
      html += '<p class="ksj-missing">你目前没有提供（这几项我不能替你补）：' + t(fs.B_missing.join(' ')) + '</p>';
    }
    html += '</section>';

    // C. 暂时不要做
    html += '<section class="ksj-block" data-ksj-block="C">';
    html += '<header><span>C</span><h3>暂时不要做</h3></header>';
    if (fs.C_dontDoNow && fs.C_dontDoNow.length) {
      html += li(fs.C_dontDoNow, function (item) {
        return '<li><strong>' + t(item.text) + '</strong><em>为什么：' + t(item.why) + '</em></li>';
      });
    } else {
      html += '<p>当前没有额外的暂缓项，但仍然建议先完成一轮验证再加码。</p>';
    }
    html += '</section>';

    // D. 未来 7 天只做一件事
    var v = fs.D_validation || {};
    html += '<section class="ksj-block" data-ksj-block="D">';
    html += '<header><span>D</span><h3>未来 7 天只做一件事</h3></header>';
    /* 已经有真实付费的人，句子结构本身要变（不是"验证问题真不真实"），
     * 所以生产侧会直接给整句；这时不再拼模板句。 */
    html += '<p>' + (v.sentence
      ? t(v.sentence)
      : '找 ' + t(v.times || 3) + ' 位「' + t(v.who) + '」，确认他们是否反复遇到「' + t(v.question) + '」这个问题。') + '</p>';
    html += '<p class="ksj-note">' + t(v.how) + t(v.record || '') + '</p>';
    html += '<div class="ksj-pass"><strong>通过标准</strong>';
    html += li(v.pass, function (item) { return '<li>' + t(item) + '</li>'; });
    html += '</div>';
    html += '<div class="ksj-pass"><strong>如果没有出现这些信号</strong>';
    html += li(v.stop, function (item) { return '<li>' + t(item) + '</li>'; });
    html += '</div>';
    html += '</section>';

    html += '</div>';
    return html;
  }

  /* ================= 19.9 完整报告：固定 8 个模块 ================= */

  function moduleHead(num, title, sub) {
    return '<header class="ksj-r__head"><span class="ksj-r__num">' + t(num) + '</span><div><h2>' + t(title) + '</h2>'
      + (sub ? '<p>' + t(sub) + '</p>' : '') + '</div></header>';
  }

  /* 六维雷达：每根轴按「本维度 0-100 归一化分」直接映射半径。
     规格 §4.2 —— 不使用 ÷4 之类的固定除数，避免高分维度被压平或恒定顶到 100%。 */
  function renderRadar(J) {
    var dims = (J && J.gap && (J.gap.allOrdered || J.gap.all)) || [];
    if (dims.length < 3) return '';
    var n = dims.length;
    var cx = 200, cy = 196, R = 112;
    function point(i, radius) {
      var angle = (-90 + i * (360 / n)) * Math.PI / 180;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    }
    function norm(value) { return Math.max(0, Math.min(100, Number(value) || 0)); }

    var svg = '<svg viewBox="0 0 400 400" role="img" aria-label="经验资产六维图">';
    [0.25, 0.5, 0.75, 1].forEach(function (level) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = point(i, R * level); pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      svg += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(45,41,38,' + (level === 1 ? 0.24 : 0.12) + ')" stroke-width="1"/>';
    });
    for (var i = 0; i < n; i++) {
      var spoke = point(i, R);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + spoke[0].toFixed(1) + '" y2="' + spoke[1].toFixed(1) + '" stroke="rgba(45,41,38,0.12)" stroke-width="1"/>';
    }
    var dataPts = [];
    dims.forEach(function (d, i) {
      var p = point(i, R * norm(d.score) / 100);
      dataPts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
    });
    svg += '<polygon points="' + dataPts.join(' ') + '" fill="rgba(85,98,79,0.20)" stroke="#55624F" stroke-width="2" stroke-linejoin="round"/>';
    dims.forEach(function (d, i) {
      var angle = (-90 + i * (360 / n)) * Math.PI / 180;
      var cos = Math.cos(angle);
      var anchor = Math.abs(cos) < 0.2 ? 'middle' : (cos > 0 ? 'start' : 'end');
      var dp = point(i, R * norm(d.score) / 100);
      var lp = point(i, R + 30);
      svg += '<circle cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="3.4" fill="#55624F"/>';
      svg += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3).toFixed(1) + '" text-anchor="' + anchor + '" font-size="12.5" font-weight="700" fill="#2D2926">' + t(d.label) + '</text>';
      svg += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 18).toFixed(1) + '" text-anchor="' + anchor + '" font-size="11.5" fill="#7A7168">' + t(norm(d.score)) + '</text>';
    });
    svg += '</svg>';

    var legend = '<div class="ksj-radar__legend">' + dims.map(function (d) {
      return '<span>' + t(d.label) + ' <b>' + t(norm(d.score)) + '</b></span>';
    }).join('') + '</div>';

    return '<div class="ksj-radar">' + svg + legend + '</div>';
  }

  function renderPaidReport(J, meta) {
    if (!J) return '';
    meta = meta || {};
    var html = '<div class="ksj-report" data-ksj="paid-report">';

    /* 01 一句话诊断 */
    html += '<section class="ksj-r" id="report-module-01" data-ksj-module="01">' + moduleHead('01', '一句话诊断', '当前阶段、第一优先级、最大的判断依据') ;
    html += '<p>当前阶段：<strong>' + t(J.stage) + '</strong>。</p>';
    if (J.stageWhy) html += '<p>' + t(J.stageWhy) + '</p>';
    html += '<p>第一优先级：<strong>' + t(J.currentAction.label) + '</strong>。</p>';
    if (J.paymentConflict) html += conflictBlock((J.payment || {}).note);
    var basis = (J.facts[0] && J.facts[0].text) || '';
    var basis2 = (J.facts[1] && J.facts[1].text) || '';
    html += '<p>目前最大的判断依据：' + t(basis + basis2) + '</p>';
    var rd = J.eightQuestionReadiness || {};
    html += '<p class="ksj-note">8 题准备度：' + t(rd.label) + '（' + t(rd.score) + ' 分）。'
      + '8 题总分只反映你在初筛题里的准备程度，不能用来说明当前阶段；'
      + '上面的当前阶段是由你提供的案例、外部证据和真实付费事实共同决定的。</p>';
    html += '<p class="ksj-note">这份报告只依据你本次填写的回答生成，没有补充任何你没有提供的事实。</p>';
    html += '</section>';

    /* 02 经验资产证据 */
    html += '<section class="ksj-r" id="report-module-02" data-ksj-module="02">' + moduleHead('02', '你的经验资产证据', '左边是已经成立的，右边是还没成立的');
    html += '<div class="ksj-two">';
    html += '<article class="yes"><h3>已经成立</h3>' + (
      (J.assets.established || []).length
        ? li(J.assets.established, function (item) { return '<li><strong>' + t(item.label) + '</strong>' + t(item.text) + (item.why ? '<em>' + t(item.why) + '</em>' : '') + '</li>'; })
        : '<p style="font-size:13.5px;color:#7A7168;margin:0">本次回答里还没有已经成立的经验资产证据。</p>'
    ) + '</article>';
    html += '<article class="no"><h3>尚未成立</h3>' + (
      (J.assets.notYet || []).length
        ? li(J.assets.notYet, function (item) { return '<li><strong>' + t(item.label) + '</strong>' + (item.why ? '<em>' + t(item.why) + '</em>' : '') + '</li>'; })
        : '<p style="font-size:13.5px;color:#7A7168;margin:0">本次六项证据都已经出现，当前重点是把它们标准化。</p>'
    ) + '</article>';
    html += '</div>';
    if (J.paymentConflict) html += conflictBlock((J.payment || {}).note);
    html += renderRadar(J);
    html += '<p class="ksj-note">每根轴按「这一项自己的满分」归一化后显示，不是六项平均分。某一根短，只代表这一项相对它自己的标准还不足，不代表你整体不行。</p>';
    html += '</section>';

    /* 03 主卡点 + 次卡点 */
    html += '<section class="ksj-r" id="report-module-03" data-ksj-module="03">' + moduleHead('03', '主要卡点与次要卡点', '最多两个，每个都说明为什么它限制下一步');
    var gapClass = J.gap.level === 'critical' ? '' : (J.gap.level === 'moderate' ? ' moderate' : ' none');
    html += '<div class="ksj-gap' + gapClass + '">';
    html += '<small>' + t(J.gap.headline) + '（' + t(J.primaryGap.label) + ' · ' + t(J.primaryGap.score) + ' 分）</small>';
    html += '<h3>' + t(gapHeadlineText(J)) + '</h3>';
    html += '<p>' + t(J.primaryGap.why) + '</p>';
    html += '</div>';
    if (J.secondaryGap) {
      html += '<div class="ksj-gap moderate">';
      html += '<small>并列缺口（与最低项相差不超过 5 分）· ' + t(J.secondaryGap.label) + ' · ' + t(J.secondaryGap.score) + ' 分</small>';
      html += '<h3>第二个要补的是：' + t(J.secondaryGap.label) + '</h3>';
      html += '<p>' + t(J.secondaryGap.why) + '</p>';
      html += '</div>';
    }
    html += '<p class="ksj-note">六个维度：' + J.gap.all.map(function (item) {
      return t(item.label) + ' ' + t(item.score);
    }).join(' · ') + '</p>';
    html += '</section>';

    /* 04 路径排序 */
    html += '<section class="ksj-r" id="report-module-04" data-ksj-module="04">' + moduleHead('04', '路径排序', '第一优先、第二备选、暂缓，以及各自的理由');
    var first = (J.paths.firstPath) || {};
    var backup = (J.paths.backupPath) || {};
    var avoid = (J.paths.notRecommendedPath) || {};
    html += '<div class="ksj-path ksj-path--first"><b>第一优先</b><strong>' + t(first.label) + '</strong><p>' + t(first.why) + '</p></div>';
    html += '<div class="ksj-path"><b>第二备选</b><strong>' + t(backup.label) + '</strong><p>' + t(backup.why) + '</p></div>';
    html += '<div class="ksj-path ksj-path--avoid"><b>暂缓</b><strong>' + t(avoid.label) + '</strong><p>' + t(avoid.why) + '</p></div>';
    html += '<p class="ksj-note">' + t(J.paths.rationale || '路径不是按兴趣选，而是按证据、需求、交付和现实可行性共同裁剪。') + '</p>';
    html += '</section>';

    /* 05 第一个最小交付假设 */
    html += '<section class="ksj-r" id="report-module-05" data-ksj-module="05">' + moduleHead('05', '第一个最小交付假设', '先做小，先验证，先拿反馈');
    var fd = J.firstDelivery || {};
    if (fd.defer) {
      /* 措辞由判断层给出（cause 决定说"补证据"还是"补现实条件"），
       * 渲染层只负责输出，不再自己拼"这几项证据"。 */
      html += '<p><strong>' + t(fd.headline || fd.reason || '当前不建议设计产品') + '</strong></p>';
      html += '<p>' + t(fd.lead || ('先完成 ' + fd.gapText + ' 这几项证据，再回来设计第一版交付。')) + '</p>';
      html += '<p class="ksj-note">' + t(fd.note || '在你把上面这些补齐之前，任何产品设计都只是猜测。') + '</p>';
    } else {
      html += '<p><strong>适合谁：</strong>' + t(fd.targetCustomer) + '</p>';
      html += '<p><strong>解决什么问题：</strong>' + t(fd.problemScene) + '</p>';
      html += '<p><strong>第一版交付形式：</strong>' + t(fd.firstOffer) + '</p>';
      html += '<p><strong>对方能带走什么：</strong>' + t(fd.takeaway) + '</p>';
      html += '<p><strong>暂不包含什么：</strong>' + t(fd.notIncluded) + '</p>';
    }
    html += '</section>';

    /* 06 7 天验证计划 */
    var v = J.validation || {};
    html += '<section class="ksj-r" id="report-module-06" data-ksj-module="06">' + moduleHead('06', '7 天验证计划', '只安排必要动作，并且写明通过标准和停止标准');
    // v.intro：现实可行性不足时，7 天规模要压到"一定做得完"，由判断层给整句
    html += '<p>' + (v.intro
      ? t(v.intro)
      : '找 ' + t(v.times || 3) + ' 位「' + t(v.who) + '」，确认他们是否反复遇到「' + t(v.question) + '」这个问题。') + '</p>';
    html += '<p><strong>问什么：</strong>围绕「' + t(v.question) + '」这一个问题，不问"你要不要买"。</p>';
    html += '<p><strong>做什么：</strong>' + t(v.how) + '</p>';
    /* Round E 第 3 条：已经有可重复付费事实的人，不能再被要求"验证别人愿不愿意付钱"。
     * 这一行必须与 7 天计划、当前动作、stage 同一方向。 */
    var paidRepeat = !!(J.evidence && J.evidence.paymentLevel >= 2) && !(J.evidence && J.evidence.paymentConflict);
    html += '<p><strong>是否尝试收费：</strong>' + (
      paidRepeat
        ? '你已经有可重复的付费事实，本轮不再测试付费意愿：重点是把交付边界写清，并拿到一次复购或转介绍。'
        : (J.firstDelivery && J.firstDelivery.defer ? '本轮不收费，只换真实反馈。' : '可以在最后一轮尝试一次低门槛付费意向确认，但不预设价格、不承诺结果。')
    ) + '</p>';
    html += '<p><strong>如何记录：</strong>' + t(v.record) + '</p>';
    if (J.sevenDayPlan && J.sevenDayPlan.length) {
      html += '<div class="ksj-days">';
      J.sevenDayPlan.forEach(function (day) {
        html += '<div class="ksj-day"><span>' + t(day.day) + '</span><p><strong>' + t(day.title) + '</strong><br>' + t(day.action) + '</p></div>';
      });
      html += '</div>';
    }
    html += '<div class="ksj-pass"><strong>通过标准</strong>' + li(v.pass, function (item) { return '<li>' + t(item) + '</li>'; }) + '</div>';
    html += '<div class="ksj-pass"><strong>停止标准</strong>' + li(v.stop, function (item) { return '<li>' + t(item) + '</li>'; }) + '</div>';
    html += '</section>';

    /* 07 什么证据会改变当前判断 */
    html += '<section class="ksj-r" id="report-module-07" data-ksj-module="07">' + moduleHead('07', '什么证据会改变当前判断', '判断可以被新证据更新，这不是算命');
    html += '<ul style="margin:0;padding-left:18px;display:grid;gap:9px">';
    (J.decisionSignals || []).forEach(function (item) {
      html += '<li style="font-size:14px;line-height:1.8;color:#5C5349"><strong>如果' + t(item.if) + '</strong><br>→ ' + t(item.then) + '</li>';
    });
    html += '</ul>';
    if (J.stopRules && J.stopRules.length) {
      html += '<p class="ksj-note">另外，这些是明确的暂停线：' + t(J.stopRules.slice(0, 3).join(' ')) + '</p>';
    }
    html += '</section>';

    /* 08 最终决定 */
    html += '<section class="ksj-r" id="report-module-08" data-ksj-module="08">' + moduleHead('08', '最终决定', '三句话收口，并给出 30 天继续或停止的判断');
    html += '<div class="ksj-final">';
    html += '<p><b>现在做：</b>' + t(J.currentAction.label) + '。</p>';
    html += '<p><b>现在不做：</b>' + t((J.dontDoNow[0] && J.dontDoNow[0].text) || '不要在没有真实反馈前扩大投入') + '。</p>';
    html += '<p><b>什么时候重新判断：</b>当你完成上面这一轮 7 天验证、并且至少出现' + t(changeSignalShort(J)) + '之后，再重新判断要不要继续投入。</p>';
    html += '</div>';

    /* 付费墙承诺过"30 天后是否值得继续投入"，这里必须真的交付这个判断 */
    var td = J.thirtyDay || {};
    if (td.question) {
      html += '<div class="ksj-pass" style="margin-top:14px" data-ksj="thirty-day">';
      html += '<strong>' + t(td.question) + '</strong>';
      html += '<p style="margin-top:6px">' + t(td.verdict) + '</p>';
      if (td.continueWhen && td.continueWhen.length) {
        html += '<p style="margin-top:10px;font-size:13px"><b>满足这些条件就继续：</b></p>';
        html += '<ul>' + td.continueWhen.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>';
      }
      if (td.stopWhen && td.stopWhen.length) {
        html += '<p style="margin-top:10px;font-size:13px"><b>出现这些情况就停：</b></p>';
        html += '<ul>' + td.stopWhen.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
    }
    if (J.confidence === 'low' || (J.missingFacts || []).length >= 2) {
      html += '<p class="ksj-soft">如果你的问题涉及多个方向冲突、复杂经历取舍或高成本职业决策，可以再考虑一对一经验资产诊断。'
        + '在你补齐上面的证据之前，人工诊断也很难给出比你手上这份报告更准的结论。</p>';
    }
    html += '</section>';

    html += '</div>';
    return html;
  }

  function gapHeadlineText(J) {
    if (J.gap.level === 'none') {
      return '暂无明显短板，当前重点是：' + J.currentAction.label;
    }
    if (J.gap.level === 'moderate') {
      return '当前优先补的证据是：' + J.primaryGap.label;
    }
    return '你卡在：' + J.primaryGap.label;
  }

  function changeSignalShort(J) {
    var sig = (J.decisionSignals || [])[0];
    if (!sig) return '一条新的真实反馈';
    return '一条新的真实反馈（' + sig.if + '）';
  }

  return {
    ensureStyle: ensureStyle,
    renderFreeSummary: renderFreeSummary,
    renderPaidReport: renderPaidReport,
    renderRadar: renderRadar,
    gapHeadlineText: gapHeadlineText,
    escapeHtml: esc
  };
}));
