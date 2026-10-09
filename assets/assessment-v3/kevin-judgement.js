/* kevin-judgement.js — 规则判断层（唯一判断源）
 *
 * 架构（严格按规格 §11）：
 *   用户答案 → 规则判断层(本文件) → 证据映射层 → 文案模块层 → 报告组合层
 *
 * 不调用任何大模型 API。免费摘要与 19.9 完整报告复用同一个判断对象。
 * 依赖：window.KevinQuizModel、window.KevinCommercialDiagnosticModel（规则引擎）
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KevinJudgement = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'kevin-judgement-v1';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function has(value) {
    return text(value).length > 0;
  }

  function num(value, fallback) {
    var n = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function includes(value, words) {
    var v = text(value);
    return (words || []).some(function (w) { return v.indexOf(w) !== -1; });
  }

  /* ---------- 语义判断层 ----------
   * 规格：所有 evidence / missing 判断禁止只用 has(非空字符串)。
   * 用户会填「没有外部反馈」「暂时没有」「还没有付费记录」「不确定」这类否定式回答，
   * 字符串非空，但语义上属于缺失或弱证据，不能被当作"已经提供"。
   */

  // 否定 / 弱化的开头表达。只看首个小句，避免"没有A但有B"被整体判负。
  var NEGATIVE_HEAD = /^\s*(?:目前|暂时|现在|其实|基本上|大概|可能|我)?\s*(?:还|也|都|并)?\s*(?:没有|暂无|未有|未曾|没|无|不清楚|不确定|不好说|说不清|说不出来|想不到|想不起|没想过|无法核对|记不清)/;

  // 明确的弱证据措辞：即使不以下定词开头，语义上也不构成外部证据
  var WEAK_EVIDENCE_MARKERS = [
    '没有外部反馈', '缺少外部反馈', '无外部反馈', '没有外部', '缺少外部',
    '主要是自我描述', '仅自我描述', '没有结果证据', '缺少结果证据', '不能证明'
  ];

  function firstClause(value) {
    return text(value).split(/[，,；;。！!？?\n]/)[0] || '';
  }

  function isNegativeAnswer(value) {
    var v = text(value);
    if (!v) return true;
    return NEGATIVE_HEAD.test(firstClause(v)) || NEGATIVE_HEAD.test(v.slice(0, 10));
  }

  function isWeakEvidenceText(value) {
    var v = text(value);
    if (!v) return true;
    return includes(v, WEAK_EVIDENCE_MARKERS);
  }

  /* 统一的"弱或缺失"判断。所有 evidence / missing 决策都必须经过这里。 */
  function weakOrMissing(value) {
    var v = text(value);
    if (!v) return true;
    if (isNegativeAnswer(v)) return true;
    if (isWeakEvidenceText(v)) return true;
    return false;
  }

  /* 强文本 = 非空 且 语义上不是否定或弱证据 */
  function strongText(value) {
    return !weakOrMissing(value);
  }

  /* ---------- 与规则引擎同口径的基础判定（不引入第二套逻辑） ---------- */

  /* ---------- 案例数量 与 案例质量 必须分开 ----------
   * 规格：1 个案例 ≠ 3 个案例。能写 1 个案例不得通过"有 3 个案例"。
   * 注意：caseAvailability='nearest_incident'（接近的真事）不算可用案例。
   */

  function parseCaseCount(d) {
    var joined = text(d.caseCountDetailed) || text(d.caseCount) || '';
    if (includes(joined, ['5个以上', '5 个以上', '可复用', '很多', '大量'])) return 5;
    var match = joined.match(/(\d+)\s*个/);
    if (match) return Math.max(0, Number(match[1]) || 0);
    if (includes(joined, ['1件', '一件', '有1件'])) return 1;
    if (text(d.caseAvailability) === 'has_case') return 1;
    return 0;
  }

  /* 至少一个可用案例：数量≥1，或深度回答里已有完整的"问题—动作—结果" */
  function hasUsableCase(d) {
    if (parseCaseCount(d) >= 1) return true;
    var story = buildCaseStory(d);
    return !!(story && story.problem && story.action && story.result);
  }

  /* 3 个及以上真实案例。1 个案例永远不通过这一项。 */
  function hasThreeCases(d) {
    return parseCaseCount(d) >= 3;
  }

  /* 兼容旧调用方的分级：0 无 / 1 有一个可用案例 / 2 有三个以上案例 */
  function getCaseLevel(d) {
    if (hasThreeCases(d)) return 2;
    return hasUsableCase(d) ? 1 : 0;
  }

  /* ---------- 付费证据 与 投入意愿 必须分开 ----------
   * 规格：「愿意继续聊 / 愿意投入时间 / 愿意试用 / 愿意提供材料」属于需求或投入意愿，
   * 不属于付费。「已有付费」只能由真实金钱支付、复购或转介绍成交这类事实触发。
   */

  /* ---------- 固定单选题：逐字枚举映射（Round C 第 1 条，P0）----------
   * paidBefore / costWillingnessSignal 都是**固定单选题**，合法取值有限且已知。
   * 旧实现用模糊关键词去猜（'已经相对稳定'、'稳定付费'），但真实原文是
   * 「已经**有**相对稳定**的**付费需求」——两个标记词都不是它的子串，
   * 于是最高档付费被误判成 0。这是被审计点名的 P0。
   *
   * 现在改为：枚举值 → 等级，逐字精确映射（下表与真实表单逐字对齐）。
   * 关键词匹配只保留给**枚举之外的自由文本**（如 paidOutcome 自述）。
   */

  /* 与 report/index.html 深度题型定义逐字一致：
   * opts: ['还没有付费记录','有1次付费尝试','有2-5次付费记录','已经有相对稳定的付费需求'] */
  /* paidBefore 固定单选题：逐字枚举映射（Round C 第 1 条，P0）。
   * **尺度与 experience-commercial-diagnostic.js 完全一致**（Round D 第 2 条统一）：
   *   0 无真实付费 / 1 有 1 次 / 2 有 2-5 次 / 3 已有可重复付费。
   * 旧版本文件用的 0/2/3/3 私有尺度已废弃 —— 两个判断层各用一套尺度，
   * 正是"付费真相"分裂的来源。 */
  var PAID_BEFORE_LEVEL_MAP = {
    '还没有付费记录': 0,
    '有1次付费尝试': 1,
    '有2-5次付费记录': 2,
    '已经有相对稳定的付费需求': 3
  };

  /* costWillingnessSignal 在两套表单里各有一组枚举，全部列出：
   * 深度表单      : '没有' / '愿意继续聊' / '愿意试用或花时间配合' / '已经付费、复购或转介绍'
   * 付费问卷 v2   : '暂时没有发生' / '愿意继续聊' / '愿意投入时间或材料配合' / '已经付费、复购或转介绍'
   * 值 = 付费等级。四类「愿意…」一律为 0 —— 意愿绝不产生付费证据。 */
  var COST_WILLINGNESS_PAID_MAP = {
    '没有': 0,
    '暂时没有发生': 0,
    '愿意继续聊': 0,
    '愿意试用或花时间配合': 0,
    '愿意投入时间或材料配合': 0,
    '已经付费、复购或转介绍': 3
  };

  /* 值 = 投入意愿等级：0 无 / 1 愿意继续聊 / 2 愿意投入时间或试用 / 3 已含真实付费 */
  var COST_WILLINGNESS_LEVEL_MAP = {
    '没有': 0,
    '暂时没有发生': 0,
    '愿意继续聊': 1,
    '愿意试用或花时间配合': 2,
    '愿意投入时间或材料配合': 2,
    '已经付费、复购或转介绍': 3
  };

  /* 自由文本补充证据用的关键词（**不再用于枚举值**） */
  var WILLINGNESS_MARKERS = ['愿意继续聊', '愿意聊', '愿意投入时间', '愿意试用', '愿意提供材料', '愿意配合', '花时间配合'];
  var PAYMENT_REPEAT_MARKERS = ['复购', '续费', '转介绍', '多次付费', '2-5次', '2-5 次', '稳定付费', '持续付费'];
  var PAYMENT_ONCE_MARKERS = ['1次付费', '1 次付费', '付费尝试', '付过费', '买过', '购买过', '成交过'];

  /* 查表：命中返回等级（含 0），未命中返回 null —— 用于区分「枚举说是 0」与「不是枚举值」 */
  function lookupEnum(map, value) {
    var v = text(value);
    if (!v) return null;
    return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : null;
  }

  /* 自由文本 → 付费等级。仅在枚举缺失时作为补充证据使用。
   * 尺度与枚举表一致：一次付费 = 1（旧版返回 2，已随尺度统一修正）。 */
  function payLevelFromText(value) {
    var v = text(value);
    if (!v || weakOrMissing(v)) return 0;
    if (includes(v, PAYMENT_REPEAT_MARKERS)) return 3;
    if (includes(v, PAYMENT_ONCE_MARKERS)) return 1;
    return 0;
  }

  function isPureWillingness(value) {
    var v = text(value);
    if (!v) return false;
    // 命中枚举时，直接看该枚举是否含付费等级 —— 比关键词更准
    var byMap = lookupEnum(COST_WILLINGNESS_PAID_MAP, v);
    if (byMap !== null) return byMap === 0 && lookupEnum(COST_WILLINGNESS_LEVEL_MAP, v) > 0;
    if (includes(v, PAYMENT_REPEAT_MARKERS) || includes(v, PAYMENT_ONCE_MARKERS)) return false;
    return includes(v, WILLINGNESS_MARKERS);
  }

  /* ---------- 唯一 canonical 付费真相（Round D 第 2 条） ----------
   * 判断层不再自己"取两个字段的最大值"就当结论。
   *   1) 优先消费规则引擎算出的**同一份** paymentState（同源：pack.paymentState）；
   *   2) 只有 pack 缺失（模型未加载 / 单测直接调 getPaidLevel）时才本地回退，
   *      回退逻辑与 experience-commercial-diagnostic.js#resolvePaymentState 完全一致，
   *      枚举表也逐字相同（语义测试会断言两张表相等）。
   * 冲突 = 一题说"还没有付费"、另一题说"已经付费"：
   *   level 取保守值，conflict=true 交下游 —— 降 confidence、报告提示"需要确认"、
   *   并且**不得进入系统放大期**（见 resolveStage）。
   */
  var PAYMENT_DENIAL_OPTIONS = ['没有', '暂时没有发生'];

  function localPaymentState(d) {
    d = d || {};
    var byPaid = lookupEnum(PAID_BEFORE_LEVEL_MAP, d.paidBefore);
    var byWill = lookupEnum(COST_WILLINGNESS_PAID_MAP, d.costWillingnessSignal);
    var paidLevel = byPaid !== null ? byPaid : payLevelFromText(d.paidBefore);
    var willLevel = byWill !== null ? byWill : payLevelFromText(d.costWillingnessSignal);
    var willIsDenial = PAYMENT_DENIAL_OPTIONS.indexOf(text(d.costWillingnessSignal)) !== -1;
    var conflict = (byPaid === 0 && byWill === 3) || (byPaid !== null && byPaid > 0 && willIsDenial);
    var level = conflict ? Math.min(paidLevel, willLevel) : Math.max(paidLevel, willLevel);
    var source = 'none';
    if (paidLevel > 0 && willLevel > 0) source = 'both';
    else if (paidLevel > 0) source = 'paidBefore';
    else if (willLevel > 0) source = 'costWillingnessSignal';
    return {
      level: level,
      paidBeforeLevel: paidLevel,
      willingnessLevel: willLevel,
      paidBeforeOption: text(d.paidBefore),
      willingnessOption: text(d.costWillingnessSignal),
      source: source,
      conflict: conflict,
      note: conflict ? localConflictNote(d) : ''
    };
  }

  function localConflictNote(d) {
    d = d || {};
    return '你在两处对"是否已经收到过钱"的回答互相矛盾：付费记录题选的是「'
      + text(d.paidBefore) + '」，成本意愿题选的是「' + text(d.costWillingnessSignal) + '」。'
      + '在你确认哪一处才是真实情况之前，这份报告**不把任何一处当作已发生的付费事实**，'
      + '也不会据此判断你能不能放大——请先确认付费信息，再重看这一部分。';
  }

  /* 同源读取：有 pack 就用规则引擎那一份，没有才本地算。 */
  function paymentStateOf(d, pack) {
    var fromPack = pack && pack.paymentState;
    if (fromPack && typeof fromPack.level === 'number') return fromPack;
    return localPaymentState(d);
  }

  /* 付费等级：0 无真实付费 / 1 有 1 次 / 2 有 2-5 次 / 3 已有可重复付费。
   * 与规则引擎同尺度（旧版本文件用的是 0/2/3/3 的私有尺度，已废弃）。
   * 只由真实支付事实决定；四类「愿意…」在枚举表里都是 0。 */
  function getPaidLevel(d) {
    return paymentStateOf(d, null).level;
  }

  /* 投入意愿等级：只进需求信号，绝不进付费证据。 */
  function getWillingnessLevel(d) {
    var w = text(d.costWillingnessSignal);
    var byMap = lookupEnum(COST_WILLINGNESS_LEVEL_MAP, w);
    if (byMap !== null) return byMap;
    if (!w || weakOrMissing(w)) return 0;
    if (includes(w, PAYMENT_REPEAT_MARKERS) || includes(w, PAYMENT_ONCE_MARKERS)) return 3;
    if (includes(w, ['愿意试用', '愿意提供材料', '花时间配合', '投入时间'])) return 2;
    if (includes(w, ['愿意继续聊', '愿意聊'])) return 1;
    return 0;
  }

  /* 触发付费成立的原文来源（用于回显，不用于判断） */
  function paidSource(d) {
    var v = text(d.paidBefore);
    if (lookupEnum(PAID_BEFORE_LEVEL_MAP, v) > 0) return v;
    if (includes(v, PAYMENT_REPEAT_MARKERS) || includes(v, PAYMENT_ONCE_MARKERS)) return v;
    return text(d.costWillingnessSignal);
  }

  /* ---------- 外部证据 与 案例完整性 必须分开 ----------
   * 规格：一个完整的自述案例 ≠ 已有外部证据。
   * 「主要是自我描述，缺少外部反馈」必须判为"外部证据尚未成立"。
   */

  var SELF_DESCRIPTION_MARKERS = ['主要是自我描述', '仅自我描述', '自我描述', '缺少外部反馈'];
  // 明确否认外部证据存在 → 判 missing（而不是"弱"）
  var EXTERNAL_DENIAL_MARKERS = ['没有外部反馈', '无外部反馈', '没有外部证据', '没有结果证据', '缺少结果证据'];
  var EXTERNAL_EVIDENCE_MARKERS = [
    '具体反馈', '客户反馈', '用户反馈', '学员反馈', '家长反馈', '结果截图', '结果证明',
    '结果记录', '转介绍', '付费记录', '复购', '续费', '采用', '采纳', '继续使用', '再次购买'
  ];
  var EXTERNAL_OUTCOME_RE = /(客户|顾客|用户|学员|家长|机构|对方|同事|团队|老板|经营者)[^。；;]{0,24}(反馈|认可|采用|采纳|复购|续费|转介绍|继续使用|再次购买|主动复述)/;

  function isSelfDescriptionOnly(value) {
    return includes(value, SELF_DESCRIPTION_MARKERS);
  }

  /* 返回 { state: 'established' | 'weak' | 'missing', source, reason } */
  function externalEvidenceState(d) {
    var candidates = [d.evidenceType, d.evidenceQuality, d.assetFormat];
    var sawWeak = false;
    var sawDenial = false;
    for (var i = 0; i < candidates.length; i++) {
      var v = text(candidates[i]);
      if (!v) continue;
      // 明确否认 → missing，优先于"弱"判定
      if (includes(v, EXTERNAL_DENIAL_MARKERS)) { sawDenial = true; continue; }
      if (weakOrMissing(v) || isSelfDescriptionOnly(v)) { sawWeak = true; continue; }
      if (includes(v, EXTERNAL_EVIDENCE_MARKERS)) {
        return {
          state: 'established',
          source: v,
          reason: '你在证据这一项里明确写了外部反馈、结果材料、采用或转介绍。'
        };
      }
      sawWeak = true;
    }

    // 深度自由文本里明确描述了外部对象的行为，才算外部证据（保守判定）
    var story = buildCaseStory(d);
    var resultText = (story && story.result) || text(d.caseOneResult);
    if (strongText(resultText) && EXTERNAL_OUTCOME_RE.test(resultText)) {
      return {
        state: 'established',
        source: resultText,
        reason: '你在真实经历的结果里写了可观察的外部对象行为。'
      };
    }

    if (sawDenial) {
      return {
        state: 'missing',
        source: text(d.evidenceType || d.evidenceQuality || d.assetFormat),
        reason: '你明确说明目前没有外部反馈或结果证据，所以外部证据这一项尚未成立。'
      };
    }
    return {
      state: sawWeak ? 'weak' : 'missing',
      source: text(d.evidenceType || d.evidenceQuality || d.assetFormat),
      reason: sawWeak
        ? '你目前能拿出的还主要是自我描述，还不足以构成外部证据。'
        : '你目前没有提供外部反馈、结果记录、采用或转介绍这类可核对的外部证据。'
    };
  }

  function getConsultLevel(d) {
    var v = text(d.consultedBefore);
    if (includes(v, ['经常'])) return 3;
    if (includes(v, ['3-5'])) return 2;
    if (includes(v, ['1-2'])) return 1;
    return 0;
  }

  /* ---------- 需求信号等级（Round E 第 2 条） ----------
   * 与 experience-commercial-diagnostic.js#demandLevelDetail **逐字同逻辑**：
   * consultedBefore 旧档优先，缺失（真实新用户）时用 LIVE_FORM 可达字段推导。
   * 有 pack 时优先消费规则引擎算出的那一份，保证两处不会各说各话。
   * 语义测试会断言两个模块对同一输入给出相同 level。 */
  function localDemandLevel(d, scores) {
    d = d || {};
    var legacy = text(d.consultedBefore);
    if (legacy) {
      return { level: getConsultLevel(d), source: 'consultedBefore', option: legacy };
    }
    var cost = text(d.costWillingnessSignal);
    if (includes(cost, ['已经付费', '复购', '转介绍'])) {
      return { level: 3, source: 'costWillingnessSignal', option: cost };
    }
    var reach = text(d.audienceAccess);
    if (includes(reach, ['稳定私域', '公开内容渠道', '稳定客户来源'])) {
      return { level: 2, source: 'audienceAccess', option: reach };
    }
    if (includes(reach, ['少量熟人', '旧同事'])) {
      return { level: 1, source: 'audienceAccess', option: reach };
    }
    if (includes(reach, ['暂时找不到'])) {
      return { level: 0, source: 'audienceAccess', option: reach };
    }
    var ds = num(scores && scores.demand_signal, 0);
    if (ds >= 82) return { level: 3, source: 'demand_signal', option: '' };
    if (ds >= 62) return { level: 2, source: 'demand_signal', option: '' };
    if (ds >= 40) return { level: 1, source: 'demand_signal', option: '' };
    return { level: 0, source: '', option: '' };
  }

  function demandLevelOf(d, scores, pack) {
    var fromPack = pack && pack.decision && pack.decision.demandLevel;
    if (fromPack && typeof fromPack.level === 'number') return fromPack;
    return localDemandLevel(d, scores);
  }

  /* 需求证据在报告里的回显句：必须说清依据的是哪一题，
   * 不能像旧版那样固定回显 d.consultedBefore（新用户为空 → 空文本条目）。 */
  var DEMAND_SOURCE_LABEL = {
    consultedBefore: '是否有人主动来找你咨询',
    costWillingnessSignal: '别人愿意为这个问题投入什么成本',
    audienceAccess: '你能通过什么方式找到真实验证对象',
  };

  function demandEvidenceText(detail) {
    if (!detail) return '';
    if (detail.source === 'demand_signal' || !detail.option) {
      return '按你这几项的作答合成的需求信号已经到「' + (detail.level >= 2 ? '较强' : '偏弱') + '」档。';
    }
    var label = DEMAND_SOURCE_LABEL[detail.source] || '需求信号';
    return '关于「' + label + '」，你选的是「' + detail.option + '」。';
  }

  /* 报告一致性（A）：这一项**已经成立**时，不能同时显示"偶尔一两个人问过，
   * 还不足以证明是重复需求"——同一张卡里自相矛盾。
   * 成立时换成对应的正向依据；只有尚未成立时才给缺口说明。 */
  function repeatedDemandBasis(detail) {
    var src = (detail && detail.source) || '';
    if (src === 'costWillingnessSignal' || src === 'paidBefore') {
      return '已经出现真实付费、复购或转介绍，说明这件事被重复需要，不只是有人随口问过。';
    }
    if (src === 'audienceAccess') {
      return '你有能反复触达同一类人的渠道，说明这个问题不是一次性的巧合。';
    }
    return '你在几项作答里给出的信号已经互相印证，说明这个问题在反复出现。';
  }

  function band(score, strongAt, mediumAt) {
    var s = Number(score) || 0;
    if (s >= (strongAt == null ? 70 : strongAt)) return 'strong';
    if (s >= (mediumAt == null ? 45 : mediumAt)) return 'medium';
    return 'weak';
  }

  /* ---------- 动作层：当前动作（与"方向倾向"分层，避免互相打脸） ---------- */

  var ACTION_BY_STATUS = {
    not_fit_now: { key: 'extract_first', label: '先补齐真实案例与真实问题', kind: 'prepare' },
    extract_cases_first: { key: 'extract_first', label: '先补齐真实案例与真实问题', kind: 'prepare' },
    validate_first: { key: 'validate_demand', label: '先做一次需求验证，不加码投入', kind: 'validate' },
    paid_trial_ready: { key: 'small_delivery', label: '先做一次边界清楚的小交付', kind: 'validate' },
    consult_ready: { key: 'define_boundary', label: '把第一路径与交付边界定清楚', kind: 'advance' },
    career_reposition_first: { key: 'career_first', label: '先做职业再定位，不急着产品化', kind: 'prepare' },
    organization_complexity: { key: 'org_map', label: '先梳理组织权责与你可控的动作', kind: 'prepare' },
    direction_overload: { key: 'cut_path', label: '先砍到只剩一条路径', kind: 'prepare' },
    service_system_weak: { key: 'service_records', label: '先补 30 天经营记录', kind: 'prepare' },
    content_probe: { key: 'content_test', label: '先用一条内容换真实反馈', kind: 'validate' },
    knowledge_product_fit: { key: 'small_material', label: '先做一份低价判断材料', kind: 'validate' },
    template_tool_fit: { key: 'small_tool', label: '先做一个一页纸小工具', kind: 'validate' },
    service_delivery_fit: { key: 'small_service', label: '先做一个小服务包', kind: 'validate' },
    consulting_diagnosis_fit: { key: 'small_diagnosis', label: '先做一次边界清楚的问题诊断', kind: 'validate' }
  };

  /* ---------- cause → 当前动作（Round D 第 1 条） ----------
   * not_fit_now 有四种完全不同的原因，动作层**不能**再统一说"补案例/补问题"。
   * 文案由规则引擎的 NOT_FIT_CAUSE_PROFILE 提供（一个 cause 只写一次），
   * 这里只把它接到动作层，保证 action.kind 与文案不打架。 */
  function actionFromCause(status, causeProfile, fallback) {
    if (!causeProfile || !has(causeProfile.action)) return fallback;
    return {
      key: 'cause:' + text(causeProfile.label || status),
      label: causeProfile.action,
      kind: causeProfile.kind || 'prepare',
      reason: text(causeProfile.actionReason)
    };
  }

  var DIRECTION_LABEL_FIX = {
    '内容探测路径': '内容表达',
    '知识产品路径': '知识产品',
    '模板工具路径': '模板工具',
    '咨询诊断路径': '咨询诊断',
    '小服务交付路径': '小服务交付',
    '案例萃取路径': '案例萃取',
    '职业再定位路径': '职业再定位',
    '组织复杂问题梳理': '组织问题梳理'
  };

  function directionLabel(pathTriage) {
    var first = (pathTriage && pathTriage.firstPath) || {};
    var raw = text(first.label);
    if (DIRECTION_LABEL_FIX[raw]) return DIRECTION_LABEL_FIX[raw];
    return raw ? raw.replace(/路径$/, '') : '尚未判断清楚';
  }

  /* ---------- 为什么这样判断：只回显用户真实填写的事实 ---------- */

  /* F-4（既有限制，本轮只调优先级，不扩范围）：事实条目有 6 条上限。
   * legacy 画像同时填了 paidBefore 与 costWillingnessSignal 时会出现两条付费描述，
   * 把用户亲写的真实经历（story）挤出 6 条之外。真实经历必须优先于**重复**的付费描述。
   *
   * 只做这件事，其余一律不动：
   *   · 条目数没到上限 → 原样返回（绝不动第一条付费事实的位置）；
   *   · story 已经在 6 条内 → 原样返回；
   *   · 有付费描述可让位 → 用 story 替换**靠后**的那一条付费描述；
   *   · 没有可让位的 → 保持原样，不改任何条目。
   * 这样 legacy 双付费字段场景 story 不再被丢掉，而新用户（只有一个付费字段）行为完全不变。 */
  function prioritizeFacts(facts) {
    var LIMIT = 6;
    if (facts.length <= LIMIT) return facts;
    var stories = facts.filter(function (item) { return item.key === 'story'; });
    if (!stories.length) return facts;
    var out = facts.slice(0, LIMIT);
    if (out.indexOf(stories[0]) !== -1) return out;
    var evict = -1;
    for (var i = out.length - 1; i >= 0; i -= 1) {
      if (out[i].key === 'paid' || out[i].key === 'cost') { evict = i; break; }
    }
    if (evict < 0) return out;
    out[evict] = stories[0];
    return out;
  }

  function buildFacts(d, scores, levels) {
    var facts = [];

    // 1. 工作年限 / 职业状态
    if (has(d.years)) {
      var parts = ['你说自己有「' + text(d.years) + '」的相关工作经验'];
      if (has(d.status)) parts.push('当前状态是「' + text(d.status) + '」');
      if (has(d.industry)) parts.push('行业是「' + text(d.industry) + '」');
      facts.push({ key: 'years', label: '工作年限与职业状态', text: parts.join('，') + '。' });
    } else if (has(d.status) || has(d.industry)) {
      var alt = [];
      if (has(d.status)) alt.push('当前状态是「' + text(d.status) + '」');
      if (has(d.industry)) alt.push('行业是「' + text(d.industry) + '」');
      facts.push({ key: 'years', label: '职业状态', text: alt.join('，') + '。' });
    }

    // 2. 是否有真实案例
    if (has(d.caseCountDetailed) || has(d.caseCount)) {
      facts.push({
        key: 'case',
        label: '真实案例',
        text: '你填写的案例情况是「' + text(d.caseCountDetailed || d.caseCount) + '」。'
      });
    }

    // 3. 案例结果 / 可核对证据
    if (has(d.evidenceType) || has(d.evidenceQuality) || has(d.assetFormat)) {
      facts.push({
        key: 'evidence',
        label: '可核对证据',
        text: '你目前最硬的证据是「' + text(d.evidenceType || d.evidenceQuality || d.assetFormat) + '」。'
      });
    }

    // 4. 是否有人主动咨询
    if (has(d.consultedBefore)) {
      facts.push({ key: 'consult', label: '主动咨询信号', text: '关于是否有人主动来找你，你选的是「' + text(d.consultedBefore) + '」。' });
    }

    // 5. 付费事实 / 投入意愿（两者必须分开陈述）
    /* 付费事实的措辞必须与 canonical 付费状态一致（尺度：1 = 有一次付费，
     * 旧版本这里是 >= 2，会把"有 1 次付费尝试"误写成"付费未成立"）。 */
    var payState = (levels && levels.paymentState) || localPaymentState(d);
    if (payState.conflict) {
      facts.push({
        key: 'paid',
        label: '付费信息待确认',
        text: '你在付费记录题选的是「' + payState.paidBeforeOption + '」，在成本意愿题选的是「'
          + payState.willingnessOption + '」，两处互相矛盾，报告不据此判断付费是否成立。'
      });
    } else if (has(d.paidBefore)) {
      facts.push({
        key: 'paid',
        label: payState.level >= 1 ? '真实付费事实' : '付费事实',
        text: payState.level >= 1
          ? '关于是否有人为此付过费，你选的是「' + text(d.paidBefore) + '」，这一项按事实计入你的付费证据。'
          : '关于是否有人为此付过费，你选的是「' + text(d.paidBefore) + '」，所以下面的判断不把付费当作已成立。'
      });
    }
    if (has(d.costWillingnessSignal)) {
      /* Round E 第 1 条：这一题**不是**无条件只算需求信号。
       * 真实新用户表单只有 costWillingnessSignal 这一个付费入口，
       * 其中「已经付费、复购或转介绍」是已经发生的金钱交易，必须计入付费证据。
       * 旧版对这一题的全部 6 种取值输出同一句"不计入付费证据"（条件盲），
       * 于是同一份报告里 A 模块说"系统放大期"、B 模块说"不计入付费证据"，
       * 自相矛盾。现在按枚举档位分流，口径与 resolvePaymentState 完全一致。 */
      /* 只看**这一题自己的文本**是否表示已发生金钱交易。
       * 不能借用 payState.level：那是两个字段的合并结果，
       * 会让「paidBefore=有2-5次 + 这一题=愿意继续聊」被误写成"愿意继续聊是真实金钱交易"。 */
      var costMapped = lookupEnum(COST_WILLINGNESS_PAID_MAP, d.costWillingnessSignal);
      var costIsRealPayment = costMapped !== null
        ? costMapped > 0
        : payLevelFromText(d.costWillingnessSignal) > 0;
      facts.push({
        key: 'cost',
        label: costIsRealPayment ? '真实付费事实' : '对方的投入意愿（不等于付费）',
        text: costIsRealPayment
          ? '别人愿意为这件事投入什么，你选的是「' + text(d.costWillingnessSignal)
            + '」，这是已经发生的真实金钱交易，计入你的付费证据。'
          : '别人愿意为这件事投入什么，你选的是「' + text(d.costWillingnessSignal)
            + '」，这一项只计入需求信号，不计入付费证据。'
      });
    }

    // 6. 每周可投入时间
    if (has(d.hours)) {
      facts.push({ key: 'hours', label: '可投入时间', text: '你说接下来每周能稳定投入约 ' + num(d.hours, 0) + ' 小时。' });
    }

    // 7. 真实经历自由文本（问题—动作—结果）
    var story = buildCaseStory(d);
    if (story) {
      facts.push({ key: 'story', label: '你亲口写的真实经历', text: story.quote, story: story });
    }

    // 8. 用户当前最需要判断的问题
    if (has(d.decision)) {
      facts.push({ key: 'decision', label: '你最需要判断的问题', text: '你这次最需要判断的是：「' + clip(text(d.decision), 90) + '」。' });
    }

    return prioritizeFacts(facts).slice(0, 6);
  }

  function clip(value, limit) {
    var v = text(value).replace(/\s+/g, ' ');
    return v.length > limit ? v.slice(0, limit) + '…' : v;
  }

  function buildCaseStory(d) {
    var problem = text(d.caseOneProblem);
    var action = text(d.caseOneAction);
    var result = text(d.caseOneResult);
    var boundary = text(d.caseBoundaryTransfer);
    var nearest = text(d.nearestIncident);
    var isHonestAbsent = function (v) {
      return /^(?:目前|暂时|现在)?\s*(?:还)?\s*(?:没有|暂无|不清楚|想不到|说不出来)/.test(v);
    };
    var usable = function (v) { return v && !isHonestAbsent(v); };

    if (usable(problem) || usable(action) || usable(result)) {
      var seg = [];
      if (usable(problem)) seg.push('当时的问题是「' + clip(problem, 70) + '」');
      if (usable(action)) seg.push('你自己做的是「' + clip(action, 70) + '」');
      if (usable(result)) seg.push('后来实际发生的是「' + clip(result, 70) + '」');
      return {
        problem: usable(problem) ? problem : '',
        action: usable(action) ? action : '',
        result: usable(result) ? result : '',
        boundary: usable(boundary) ? boundary : '',
        quote: '你写下的真实经历是：' + seg.join('；') + '。',
        quoteFields: {
          problem: usable(problem) ? clip(problem, 50) : '',
          action: usable(action) ? clip(action, 50) : '',
          result: usable(result) ? clip(result, 50) : ''
        }
      };
    }
    if (usable(nearest)) {
      return {
        problem: '', action: '', result: '', boundary: '',
        quote: '你写下的最接近的真实小事是：「' + clip(nearest, 90) + '」。',
        quoteFields: { problem: clip(nearest, 50), action: '', result: '' }
      };
    }
    return null;
  }

  function buildMissingFacts(d, facts) {
    var out = [];
    var ext = externalEvidenceState(d);
    var hasEvidence = ext.state === 'established';
    // 语义判断：否定式回答不算"提供了信号"
    var hasDemand = strongText(d.consultedBefore) || getWillingnessLevel(d) >= 1 || getPaidLevel(d) >= 2;

    if (!hasThreeCases(d)) {
      out.push({
        key: 'case',
        text: hasUsableCase(d)
          ? '你目前只有 1 个可用案例，还不够 3 个。1 个案例能说明你做过，但不能说明这件事可重复，这一项会直接限制报告敢不敢建议你收费。'
          : '你目前没有提供 3 个能写清楚的真实案例。这一项空缺会直接限制报告敢不敢建议你收费。'
      });
    }
    if (!hasEvidence) {
      out.push({ key: 'evidence', text: ext.reason });
    }
    if (!hasDemand) {
      out.push({
        key: 'demand',
        text: '你目前没有提供任何人主动咨询、愿意投入时间或真实付费的信号。'
      });
    }
    if (weakOrMissing(d.hours)) {
      out.push({ key: 'hours', text: '你目前没有提供每周可稳定投入的时间。' });
    }
    if (!buildCaseStory(d)) {
      out.push({ key: 'story', text: '你目前没有提供一段能说清"问题—你的动作—实际结果"的真实经历。' });
    }
    // 去重，最多 3 条
    var seen = {};
    return out.filter(function (item) {
      if (seen[item.key]) return false;
      seen[item.key] = true;
      return true;
    }).slice(0, 3);
  }

  /* ---------- 证据映射层 ---------- */

  function buildEvidence(d, scores, pack) {
    var ext = externalEvidenceState(d);
    // 同源：有 pack 就消费规则引擎那一份 canonical 付费真相
    var pay = paymentStateOf(d, pack);
    var paid = pay.level;
    return {
      experience: band(scores.experience_depth),
      // 案例证据只由"有没有可用案例 / 有没有 3 个案例"决定，不与外部证据混用
      case: hasThreeCases(d) ? 'strong' : (hasUsableCase(d) ? 'medium' : 'weak'),
      caseCount: parseCaseCount(d),
      hasUsableCase: hasUsableCase(d),
      hasThreeCases: hasThreeCases(d),
      // 外部证据独立判定：一个完整自述案例不等于已有外部证据
      external: ext.state,
      externalWhy: ext.reason,
      externalSource: ext.source,
      demand: band(scores.demand_signal),
      // 付费证据只由真实支付事实决定；投入意愿单独记账
      // 尺度：0 无 / 1 一次 / 2 2-5 次 / 3 稳定（与规则引擎同尺度）
      // 档位换算后与旧版集合一致：strong = 已有可重复付费，medium = 仅一次付费
      payment: paid >= 2 ? 'strong' : (paid >= 1 ? 'medium' : 'weak'),
      paymentLevel: paid,
      // 付费信息冲突时既不能算"已成立"也不能被当成"从没付过"（见 buildAssets）
      paymentConflict: !!pay.conflict,
      paymentState: pay,
      willingness: getWillingnessLevel(d),
      delivery: band(scores.delivery_feasibility),
      reality: band(scores.reality_constraints)
    };
  }

  var EVIDENCE_LABEL = {
    experience: '经验厚度',
    case: '案例证据',
    external: '外部证据',
    demand: '需求信号',
    payment: '付费证据',
    delivery: '交付能力',
    reality: '现实可行性'
  };

  /* 资产条目一律用中性名词做标签，"已成立 / 尚未成立"由所在栏位表达。
   * 这样"尚未成立"栏里不会出现"已有付费""已有外部证据"这类会被误读成事实的措辞。 */
  function buildAssets(d, scores, pack, evidence) {
    var established = [];
    var notYet = [];
    var pay = paymentStateOf(d, pack);
    var paidLevel = pay.level;
    /* Round E 第 2 条：需求等级走同源读取（旧档 consultedBefore 优先，
     * 缺失时用可达字段推导），不再只认一个新用户填不了的字段。 */
    var demandDetail = demandLevelOf(d, scores, pack);
    var consultLevel = demandDetail.level;
    var ext = externalEvidenceState(d);

    function add(label, textValue, yes, why) {
      (yes ? established : notYet).push({ label: label, text: textValue, why: why || '' });
    }

    add('真实工作经验',
      has(d.years) ? '你说自己有「' + text(d.years) + '」相关工作经验。' : '你在测评里确认自己有可复述的工作经历。',
      has(d.years) || scores.experience_depth >= 45,
      has(d.years) ? '' : '年限没有填，这里只按你的深度回答保守判断。');

    /* 第 5 步真实经历：成立时必须引用用户自己写下的原话，
     * 不能只回一句抽象的"你能写出可讲的真实案例"。 */
    var caseStory = buildCaseStory(d);
    add('可讲清的真实案例',
      hasUsableCase(d)
        ? (caseStory && caseStory.quote
          ? caseStory.quote
          : '你能写出可讲的真实案例（' + text(d.caseCountDetailed || d.caseCount || '') + '）。')
        : '',
      hasUsableCase(d),
      '要写成"问题—你的动作—实际结果—可核对证据"才算成立。');

    add('案例积累（用户自述）',
      hasThreeCases(d) ? '你表示能整理 ' + parseCaseCount(d) + ' 个案例。' + (caseStory && caseStory.quote ? '本次展开了一件经历，其他案例仍需逐项整理。' : '本次尚未展开这些案例。') : '',
      hasThreeCases(d),
      hasUsableCase(d) && !hasThreeCases(d)
        ? '你目前只有 1 个可用案例。1 个案例能说明你做过，但不能说明这件事可重复，也不足以支撑收费判断。'
        : '需要 3 个能写清问题、动作和结果的独立案例。');

    add('外部反馈或结果证据',
      ext.state === 'established' ? '你表示已有「' + text(ext.source) + '」；本次未核验原始材料。' : '',
      ext.state === 'established',
      ext.state === 'established' ? '' : ext.reason);

    /* Round E 第 2 条：新用户表单里没有 consultedBefore，回显句必须按真实依据
     * 取文本，否则会出现"你选的是「」"这种空条目。 */
    add('重复需求信号',
      consultLevel >= 2 ? demandEvidenceText(demandDetail) : '',
      consultLevel >= 2,
      consultLevel >= 2
        ? repeatedDemandBasis(demandDetail)
        : '偶尔一两个人问过，还不足以证明是重复需求。');

    /* 付费信息冲突时：既不能说"已成立"，也不能写成"你从没付过钱"——
     * 只能如实写成"待确认"（Round D 第 2 条）。 */
    add('真实付费记录',
      pay.conflict
        ? '你在两处对"是否收到过钱"的回答互相矛盾：付费记录题「' + pay.paidBeforeOption
          + '」／成本意愿题「' + pay.willingnessOption + '」。'
        : (paidLevel >= 1 ? '你选的是「' + text(paidSource(d)) + '」。' : ''),
      !pay.conflict && paidLevel >= 1,
      pay.conflict
        ? '这一项目前既不能算成立，也不能算不成立：请先确认哪一处才是真实情况，报告不把任何一处当作已发生的付费事实。'
        : '付费是最硬的商业证据。只有真实金钱支付、复购或转介绍成交才算；愿意继续聊、愿意投入时间、愿意试用都只算投入意愿，不算付费。');

    add('可复制的交付',
      has(d.deliverableReadiness) ? '你选的是「' + text(d.deliverableReadiness) + '」。' : '',
      includes(d.deliverableReadiness, ['标准化', '交付说明', '清单', '模板', 'SOP', '报告']) || scores.delivery_feasibility >= 70,
      '能交付的东西才是产品，知道很多不算。');

    return { established: established, notYet: notYet };
  }

  /* 报告一致性（C）：Day 1 必须与 currentAction 对齐。
   * 六维最低项仍在可用区间（gaps.level === 'none'）时，说明没有需要先补的短板，
   * 不能再机械地让用户"先把最低那一项补上"——那会和"当前动作"互相打脸。 */
  function alignedDayOne(day, action, gaps) {
    if (!day || !action || !action.label) return day;
    var lowest = gaps && gaps.primary ? gaps.primary : null;
    var value = '';
    if (lowest) {
      value = '六个维度里相对最低的是「' + lowest.label + '」（' + lowest.score
        + ' 分），仍在可用区间，没有需要先补的短板。';
    }
    value += '第 1 天与当前动作保持一致：' + action.label + '。';
    if (action.reason) value += '这样判断的理由：' + action.reason;
    return { day: day.day || '第 1 天', title: action.label, action: value };
  }

  /* ---------- 卡点：按 0-100 归一化分，高分不再被硬塞"卡点" ---------- */

  /* 规格 §4.2：维度统一命名。现实限制/现实约束 → 现实可行性（对用户可读）。
     这里强制覆盖规则引擎的旧标签，保证免费摘要与 19.9 报告用的是同一套名称。 */
  var DIMENSION_LABELS = {
    experience_depth: '经验厚度',
    problem_clarity: '问题清晰度',
    evidence_assets: '证据资产',
    demand_signal: '需求信号',
    delivery_feasibility: '交付可行性',
    reality_constraints: '现实可行性'
  };
  var DIMENSION_ORDER = ['experience_depth', 'problem_clarity', 'evidence_assets', 'demand_signal', 'delivery_feasibility', 'reality_constraints'];

  /* 规格 §4.2：对用户可见的文案里，旧的「现实约束 / 现实限制」一律统一成「现实可行性」。
     规则引擎的原始文案会经由这里输出，保证全文只有一种叫法。 */
  function normalizeDimensionWording(value) {
    return String(value == null ? '' : value)
      .replace(/现实约束/g, '现实可行性')
      .replace(/现实限制/g, '现实可行性');
  }

  function normalizeDeep(value) {
    if (typeof value === 'string') return normalizeDimensionWording(value);
    if (Array.isArray(value)) return value.map(normalizeDeep);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (key) { out[key] = normalizeDeep(value[key]); });
      return out;
    }
    return value;
  }

  function buildGaps(scores, pack) {
    var order = DIMENSION_ORDER;
    var sorted = order.map(function (key) {
      return { key: key, label: DIMENSION_LABELS[key] || key, score: Math.max(0, Math.min(100, Number(scores[key]) || 0)) };
    }).sort(function (a, b) { return a.score - b.score; });

    var lowest = sorted[0];
    var second = sorted[1];
    var tied = second && (second.score - lowest.score) <= 5 ? second : null;

    var level = lowest.score < 50 ? 'critical' : (lowest.score < 70 ? 'moderate' : 'none');
    var headline = level === 'critical'
      ? '主要卡点'
      : (level === 'moderate' ? '当前优先补的证据' : '暂无明显短板');

    var toGap = function (item, isPrimary) {
      var why;
      if (!isPrimary) {
        why = '这一项与最低项相差不超过 5 分（' + item.score + ' 分），可以和最低项一起补，不必单独处理。';
      } else if (level === 'none') {
        /* 报告一致性（B）：最低项仍在可用区间（headline = 暂无明显短板）时，
         * 不能再说"它决定你下一步能不能继续加码"——同一模块里自相矛盾。 */
        why = '这是六个维度中的相对低项（' + item.score + ' 分），但仍在可用区间，'
          + '可以作为后续优化优先级，不代表当前存在明显短板。';
      } else {
        /* 第二位（并列缺口）不能沿用"最低"这句 —— 它并不是最低的那一项，
         * 否则同一份报告会同时出现"最低 75"和"最低 79"两句互相打脸的话。 */
        why = '这一项在你六个维度里最低（' + item.score + ' 分），它决定你下一步能不能继续加码。';
      }
      return { key: item.key, label: item.label, score: item.score, why: why };
    };

    return {
      level: level,
      headline: headline,
      primary: toGap(lowest, true),
      secondary: tied ? toGap(tied, false) : null,
      all: sorted,
      // 固定展示顺序（低→高排序会破坏雷达图形状，图表必须用这个）
      allOrdered: order.map(function (key) {
        return { key: key, label: DIMENSION_LABELS[key] || key, score: Math.max(0, Math.min(100, Number(scores[key]) || 0)) };
      })
    };
  }

  /* ---------- 7 天只做一件事 ---------- */

  function buildValidation(d, scores, action, story, cause, pack) {
    var hasAudience = has(d.audienceAccess);
    var audienceTarget = hasAudience ? text(d.audienceAccess) : '';
    var who = '真实遇到这类问题的人';
    if (includes(audienceTarget, ['稳定私域', '小社群'])) who = '你已有稳定触达的私域或小社群成员';
    else if (includes(audienceTarget, ['熟人或旧同事', '少量熟人'])) who = '你还能直接联系上的熟人、旧同事或同行';
    else if (includes(audienceTarget, ['公开渠道', '客户来源'])) who = '已经通过公开渠道或现有客户来源认识你的人';

    var problemClarity = text(d.problemSpecificity);
    var focus = '';
    if (includes(problemClarity, ['能说清具体人群、具体问题'])) focus = text(d.problemScene) || '你已经说清的那个具体问题';
    else if (includes(problemClarity, ['能说清一类人和一个高频问题'])) focus = '你已经收窄的那一类人和那个高频问题';
    else focus = story && story.problem ? '你在真实经历里写到的那个问题' : '你现在最想验证的那一个问题';

    if (story && story.problem) focus = text(story.problem).slice(0, 100);
    var isPrepare = action.kind === 'prepare';
    var passList = [
      '至少 2 人明确表示"这就是我现在真实的问题"，并说出自己的具体场景；',
      '至少 1 人愿意进一步了解解决方式，或愿意配合一次小交付。'
    ];
    if (!isPrepare) passList.push('如果这一轮允许，尝试一次低门槛付费意向确认（不预设价格）。');

    var stopList = [
      '如果 3 个人都说不出具体场景，说明你瞄准的问题还没成立；',
      '如果反馈只停在客气夸奖、没有具体问题、没有下一步动作，先暂停产品化，不扩大投入。'
    ];

    /* 现实可行性不足时，"7 天找 3 个人"本身就是他做不到的事
     * （时间不够 / 找不到对象 / 不愿验证）。把这一轮压到"一定做得完"的规模，
     * 目标也从"验证需求"改成"确认现实条件"。 */
    var times = 3;
    var intro = '';
    var howText = '';
    var recordText = '';
    var sentenceOut = '';
    if (cause === 'low_reality') {
      times = 1;
      who = '你已经能直接联系上、并且愿意给你 15 分钟的人';
      intro = '这一轮只做一件事：找 1 位你已经能直接联系上、并且愿意给你 15 分钟的人，'
        + '确认他最近是否真的遇到过「' + focus + '」这个问题。'
        + '如果连这 1 个人、15 分钟都排不出来，说明现在真正的限制是时间，而不是方法。';
      passList = [
        '这一周真的完成了 1 次 15 分钟的真实对话（哪怕对方没有给出结论）；',
        '你能说清卡住的是时间、验证对象还是验证意愿。'
      ];
      stopList = [
        '如果连 1 个人、15 分钟都排不出来，说明现在的限制是时间与精力，不是方法；',
        '现实条件没有改善时，不新增任何投入，也不做产品设计。'
      ];
    }

    /* 付费信息冲突（Round D 第 2 条）：这一轮的第一件事不是验证需求，
     * 而是先确认付费事实；否则通过标准会与决策层、30 天判断互相打架。 */
    if (cause === 'payment_unconfirmed') {
      intro = '这一轮的第一步不是去验证需求，而是先确认付费事实：'
        + '付费记录题与成本意愿题哪一处才是真实情况。确认之后，再按下面的动作走。'
        + (intro ? ' ' + intro : '');
      passList = [
        '付费信息已经改回前后一致的一版（有就是有，没有就是没有）；',
        '这一周至少完成 1 次真实对话，并记下对方的原话问题。'
      ];
      stopList = [
        '付费信息没有确认之前，不要按"可以放大"或"必须从零开始"任何一侧行动；',
        '如果反馈只停在客气夸奖、没有具体问题、没有下一步动作，先暂停产品化，不扩大投入。'
      ];
    }

    /* 已经出现可重复付费（复购 / 续费 / 转介绍）的人，这一轮不该再去
     * "验证别人愿不愿意付钱"——钱已经付过了（Round E 第 3 条验收：
     * "不再要求验证是否愿意付钱"）。7 天验证改为把**交付边界**写清、
     * 并拿一次真实的**复购或转介绍**，与 consult_ready 的当前动作同向。 */
    var alreadyPaid = paymentStateOf(d, pack).level >= 2
      && !paymentStateOf(d, pack).conflict;
    if (alreadyPaid && cause !== 'low_reality' && cause !== 'payment_unconfirmed') {
      who = '3 位已经为你付过费、或替你转介绍过的人';
      /* 这一轮的"要确认的那一个问题"不再是"这个问题真不真实"，
       * 而是"下一次会因为哪件事继续付费"。 */
      focus = '他们上一次为什么愿意付费、下一次愿意为哪件事付费';
      intro = '这一轮只做一件事：把这 3 位已经付过费（或转介绍过）的人逐个过一遍，'
        + '确认他们下一次愿意为哪一件具体的事继续付费。'
        + '你的问题已经不是"有没有人愿意付钱"，而是"交付边界和复购来源清不清楚"。';
      /* 免费摘要 D 模块原句是"找 N 位符合「who」条件的人，确认他们是否反复遇到
       * 「question」"——对已付费的人这句是错的（钱已经付过）。用整句覆盖。 */
      sentenceOut = '这一轮只做一件事：把这 3 位已经为你付过费、或替你转介绍过的人逐个过一遍，'
        + '确认他们下一次愿意为哪一件具体的事继续付费。你不需要再验证"有没有人愿意付钱"。';
      howText = '每人只问两句："上一次交付里哪一部分最有用"、"如果还有下一件需要你判断的事，会是什么"。不要重新推销，也不要降价。';
      recordText = '每人只记三行：他上次为什么付费、他觉得最有用的部分、他下一次愿意为哪件事付费。';
      passList = [
        '至少 2 人能说清"上一次为什么愿意付钱"，并且指向同一个交付点；',
        '至少 1 人明确说出下一次愿意付费的具体事件，或愿意把你介绍给一个人。'
      ];
      stopList = [
        '如果 3 个人都说不清上次为什么付费，说明交付边界还没写清：先补交付说明，不要扩量；',
        '这一轮不要开发新客户、不要降价，也不要新增交付形态。'
      ];
    }

    return {
      who: who,
      question: focus,
      times: times,
      intro: intro,
      /* 整句覆盖（仅在句子结构本身需要变时才给），渲染层优先用它。 */
      sentence: sentenceOut,
      how: howText || (cause === 'low_reality'
        ? '只约 15 分钟，只问一个问题。不要做公开内容、不做陌生开发、不整理材料——先把这一件事做完。'
        : '一次只问一个问题，不要问"你要不要买"，只问"你最近有没有遇到、怎么处理、卡在哪"。'),
      record: recordText || '每个人只记三行：他的原话问题、他现在的处理方式、他是否愿意继续。',
      pass: passList,
      stop: stopList
    };
  }

  /* ---------- 什么证据会改变当前判断 ---------- */

  function buildDecisionSignals(d, scores, action, evidence, cause) {
    var out = [];
    /* 现实可行性是第一位的：它不改善，其他信号都不会发生。 */
    if (cause === 'low_reality') {
      out.push({
        if: '每周可稳定投入的时间、可验证的对象或你的验证意愿，任意一项明显改善',
        then: '才重新进入验证节奏；现实条件没有改善之前，不扩大任何投入。'
      });
    }
    if (evidence.payment === 'weak') {
      out.push({
        if: evidence.paymentConflict
          ? '先确认付费信息（付费记录题与成本意愿题哪一处是真实情况）'
          : '出现第一笔真实付费（哪怕金额很小）',
        then: evidence.paymentConflict
          ? '确认之后这一档会重新计算，不会停在现在这个结论上：付费成立与不成立，后续的判断和动作都不一样。'
          : '把"先做需求验证"升级为"先做一次边界清楚的小交付"，并开始写交付说明。'
      });
    }
    if (evidence.case !== 'strong') {
      out.push({
        if: '你能写出第 3 个包含实际结果或外部反馈的案例',
        then: '案例证据成立，路径可以从"案例萃取"切到具体交付路径。'
      });
    }
    if (evidence.demand !== 'strong') {
      out.push({
        if: '连续 3 次以上有人主动带着同一个具体问题来找你',
        then: '需求信号成立，优先路径的确定性提高，可以考虑开始设计第一版交付。'
      });
    }
    // cause 已经把现实可行性放在第一位时，不重复一条同义信号
    if (band(scores.reality_constraints) !== 'strong' && cause !== 'low_reality') {
      out.push({
        if: '你每周可稳定投入时间仍然很低',
        then: '只保留轻验证动作，不要启动重服务、长内容系列或复杂产品。'
      });
    }
    out.push({
      if: '连续两次验证都没有拿到任何具体问题或继续动作',
      then: '当前假设应暂停，回到经验萃取，换一个人群或换一个问题重新验证。'
    });
    return out.slice(0, 4);
  }

  function buildDontDoNow(d, scores, pack, gaps, action, causeProfile) {
    var out = [];
    var push = function (textValue, why) { out.push({ text: textValue, why: why }); };

    if (gaps.primary && gaps.primary.key === 'evidence_assets' || scores.evidence_assets < 50) {
      push('暂不建议先做大课、重服务或复杂产品', '因为你现在缺的是可核对证据，不是更长的交付物；证据不足时先做重产品，只会把试错成本放大。');
    }
    if (scores.demand_signal < 55) {
      push('暂不建议仅凭熟人反馈就扩大投入', '因为熟人反馈往往是礼貌，不等于需求；没有付费或重复信号之前，投入越大越难回头。');
    }
    if (band(scores.reality_constraints) !== 'strong') {
      push('暂不建议同时启动多个方向', '因为你的时间与现金流约束是真实的，同时开多条路会让每条路都只做到一半。');
    }
    if (scores.delivery_feasibility < 55) {
      push('暂不建议先做复杂工具或知识库', '因为交付形态还没定，先做复杂工具等于先锁定一个还没验证的答案。');
    }
    if (action.kind === 'prepare') {
      /* cause 提供更精确的"暂缓项"时用它；否则保留通用措辞。
       * 关键：现实可行性不足的人不该被告知"你缺真实素材"。 */
      if (causeProfile && has(causeProfile.dontDo)) {
        out.unshift({
          text: causeProfile.dontDo,
          why: has(causeProfile.dontDoWhy) ? causeProfile.dontDoWhy : ''
        });
      } else {
        push('暂不建议先付高价咨询或买系统课', '因为你现在缺的是真实素材（案例、问题、验证对象），不是更多方法。');
      }
    }
    if (includes(d.organizationComplexity, ['明显涉及公司战略', '我没有决策权'])) {
      push('暂不建议把组织问题当成个人能力问题来处理', '因为这件事的关键相关方与决策权不在你手上，个人努力解决不了权责问题。');
    }
    var seen = {};
    return out.filter(function (item) {
      if (seen[item.text]) return false;
      seen[item.text] = true;
      return true;
    }).slice(0, 3);
  }

  /* 第 05 模块"第一版交付假设"被推迟时的说明：
   * 证据不足 → 说"先补这几项证据"；
   * 现实可行性不足 → 说"先补现实条件"，并且明确"素材本身不是问题"。
   * 交付层只负责把这两句渲染出来，不再自己拼措辞。 */
  function deferInfoFrom(scores, pack, causeProfile, cause) {
    var isReality = cause === 'low_reality';
    return {
      headline: '当前不建议设计产品',
      lead: isReality
        ? '先把下面这些现实条件补齐，再回来设计第一版交付。'
        : '先完成 ' + gapsTextFrom(scores, pack, causeProfile) + ' 这几项证据，再回来设计第一版交付。',
      gapText: gapsTextFrom(scores, pack, causeProfile),
      note: isReality
        ? '你的经验素材本身不是问题——在现实条件改善之前，任何产品设计都只是猜测。'
        : '在你把上面这些证据补齐之前，任何产品设计都只是猜测。'
    };
  }

  function buildFirstDelivery(d, scores, pack, action, direction, causeProfile, cause) {
    var hypothesis = (pack && pack.productHypothesis) || {};
    var isPrepare = action.kind === 'prepare';
    var route = direction;
    var form = '一份一页纸的判断清单';
    if (/咨询/.test(route)) form = '一次 45-60 分钟的问题诊断';
    else if (/知识产品/.test(route)) form = '一份低价判断材料（报告或自学清单）';
    else if (/模板工具/.test(route)) form = '一个一页纸的模板或检查清单';
    else if (/服务/.test(route)) form = '一个周期短、结果清楚的小服务包';
    else if (/内容/.test(route)) form = '3 条案例型内容 + 一次评论/私聊反馈整理';
    else if (/案例萃取/.test(route)) form = '3 个经验案例拆解 + 1 条问题验证内容';

    if (isPrepare) {
      var defer = deferInfoFrom(scores, pack, causeProfile, cause);
      defer.defer = true;
      defer.reason = '当前不建议设计产品';
      return defer;
    }
    return {
      defer: false,
      targetCustomer: hypothesis.targetCustomer || '先锁定一类你已经有真实接触的人',
      problemScene: hypothesis.problemScene || '他们反复遇到的一个具体问题',
      firstOffer: hypothesis.firstOffer || form,
      takeaway: '能带走一个明确的判断结论和一条下一步动作，而不是一堆资料。',
      notIncluded: hypothesis.deliveryBoundary || '不包含长期陪跑、无限答疑和结果承诺。'
    };
  }

  function gapsTextFrom(scores, pack, causeProfile) {
    /* cause 给出了"真正缺的东西"时以 cause 为准——
     * 否则六维都高的用户会掉进 labels 兜底，被写成"先完成外部证据"（Case K 的真实缺陷）。 */
    if (causeProfile && has(causeProfile.gapText)) return causeProfile.gapText;
    var labels = (pack && pack.dimensionLabels) || {};
    var gaps = [];
    if ((scores.evidence_assets || 0) < 50) gaps.push('可核对的外部证据');
    if ((scores.demand_signal || 0) < 55) gaps.push('真实需求或付费信号');
    if ((scores.experience_depth || 0) < 45) gaps.push('可复述的真实案例');
    if (!gaps.length) gaps.push(labels.evidence_assets || '外部证据');
    return gaps.join('、');
  }

  function gapsToNeed(value) {
    return '先完成 ' + value + ' 这几类证据';
  }

  /* ---------- 当前阶段：不得只依据 8 题总分 ----------
   * 8 题总分只能叫"8 题准备度"。真正的当前阶段必须结合深度证据：
   * 案例可用性、外部证据、真实付费事实。
   * 关键约束：没有真实付费事实时，绝不出现"早期付费 / 系统放大期"。
   */

  /* 8 题分档的原始名称里带「早期付费/系统放大期」。
   * 这一档只反映初筛题的准备程度，与用户是否真的收到过钱无关，
   * 所以在这里换成不含付费语义的准备度措辞——否则没有付费记录的用户
   * 会在摘要里看到"早期付费"，等于报告替他编造了付费事实。 */
  var READINESS_LABEL_MAP = {
    '经验盘点期': '证据储备偏低',
    '方向校准期': '方向待校准',
    '需求验证期': '需求待验证',
    '早期付费/系统放大期': '初筛准备度较高'
  };

  function eightQuestionReadiness(result) {
    var profiles = (root.KevinQuizModel && root.KevinQuizModel.levelProfiles) || [];
    var score = Number(result && result.score) || 0;
    var raw = '';
    for (var i = 0; i < profiles.length; i++) {
      if (score <= profiles[i].max) { raw = profiles[i].level; break; }
    }
    if (!raw) return { score: score, label: '未判定', rawLabel: '' };
    return {
      score: score,
      // 对用户展示的准备度名称（不含付费语义）
      label: READINESS_LABEL_MAP[raw] || raw,
      // 保留原始档位名，仅供内部追溯，不渲染
      rawLabel: raw
    };
  }

  function resolveStage(d, evidence, pack) {
    var pay = paymentStateOf(d, pack);
    var paid = pay.level;
    /* 付费信息冲突 → 不允许进入"系统放大期"这类需要付费事实支撑的阶段。
     * 也不退回"从没付过钱"的档位（那等于替用户否定他填过的答案），
     * 而是如实标成"待确认"。 */
    if (pay.conflict) {
      return {
        label: '付费信息待确认期',
        why: '因为你在付费记录题与成本意愿题上的回答互相矛盾，报告无法据此判断你在早期验证还是已经可以放大。'
          + '确认之后，这一档会重新计算。',
        paymentConflict: true
      };
    }
    /* 档位阈值与旧版行为保持一致（换算后集合完全相同）：
     *   旧尺度 0/2/3/3，旧阈值 paid>=2 早期付费验证期 / paid>=3 系统放大期
     *   → 新尺度 0/1/2/3，新阈值 paid>=1 早期付费验证期 / paid>=2 系统放大期
     * 两个档位覆盖的枚举集合逐一对应，不会因为统一尺度而挪动任何一档。 */
    if (paid >= 2) {
      return { label: '系统放大期', why: '因为你已经出现复购、续费或转介绍这类可重复的付费事实。' };
    }
    if (paid >= 1) {
      return { label: '早期付费验证期', why: '因为已经出现真实付费记录，可以开始判断交付边界和定价。' };
    }
    if (evidence.external === 'established') {
      return { label: '需求验证期', why: '因为已经出现外部反馈或结果证据，下一步是确认这种需求是否反复出现，再尝试第一笔边界清楚的付费交付。' };
    }
    if (evidence.hasUsableCase) {
      return { label: '方向校准期', why: '因为你能讲清一件真实经历，但还没有外部反馈证明它真的被别人需要。' };
    }
    return { label: '经验盘点期', why: '因为目前还没有一件能讲清"问题—动作—结果"的真实案例。' };
  }

  /* ---------- 方向来源：按真实算法说明，不硬写"来自 8 题" ----------
   * 规则引擎的路径裁剪顺序：深度字段（职业状态 / 组织复杂度 / 交付偏好）
   * → 六维分数（问题清晰度、需求信号）→ 决策结论覆盖 → 最后才回退 8 题类型。
   */

  /* 方向来源：**直接消费** pathTriage 在同源处生成的依据（Round C 第 3 条）。
   * 不再根据用户字段在渲染层事后猜测"为什么是这个方向"。
   * 依据来自 buildPathTriage 里真正定下 route 的那条规则，
   * 因此方向一变，原因必然随之改变，不会出现"方向是 A、解释引用 B 规则"。 */
  function directionReason(pack, d) {
    var triage = (pack && pack.pathTriage) || {};
    var first = triage.firstPath || {};
    var sameSource = text(first.reason);
    if (sameSource) return sameSource;

    // 兜底：pathTriage 未提供依据时（例如模型未加载），按真实算法顺序如实描述
    var parts = [];
    if (has(d.status)) parts.push('你的职业状态');
    if (has(d.organizationComplexity)) parts.push('你对组织复杂度的回答');
    if (has(d.deliveryPreference)) parts.push('你选的交付偏好「' + text(d.deliveryPreference) + '」');
    parts.push('六维分数里的问题清晰度与需求信号');
    if (!parts.length) return '当前还没有足够信息定方向。';
    return '这项判断综合参考了' + parts.join('、')
      + '；信息不足时，只保留较保守的初步倾向。';
  }

  /* ---------- 30 天是否继续投入：付费墙承诺必须真的交付 ---------- */

  /* ---------- 现实可行性：业务证据成立 ≠ 有能力扩大投入 ----------
   * Round C 第 5 条。只做 gate / downgrade，不发明新的评分体系。
   * 输入全部取自用户已填字段：每周可投入时间、验证对象、职业状态、
   * 六维里的现实约束分、以及"是否愿意继续验证"。
   */
  var LOW_FEASIBLE_HOURS = 5;      // 每周可稳定投入少于 5 小时 = 时间条件不足
  var LOW_REALITY_SCORE = 45;      // 与 buildPathTriage 的现实约束阈值同源

  function realityFeasibility(d, scores) {
    d = d || {};
    var reasons = [];

    var hoursRaw = d.hours;
    var hours = null;
    if (hoursRaw !== '' && hoursRaw != null && !isNaN(Number(hoursRaw))) hours = Number(hoursRaw);
    if (hours !== null && hours < LOW_FEASIBLE_HOURS) {
      reasons.push('你每周能稳定投入的时间只有 ' + hours + ' 小时');
    }

    var access = text(d.audienceAccess);
    if (access && includes(access, ['暂时找不到', '找不到', '没有可验证'])) {
      reasons.push('你现在找不到可以验证的真实对象');
    }

    var status = text(d.status);
    if (status && includes(status, ['还没开始'])) {
      reasons.push('你目前还没有真正开始的动作');
    }

    var rc = Number((scores || {}).reality_constraints);
    if (!isNaN(rc) && rc < LOW_REALITY_SCORE) {
      reasons.push('六维里的现实可行性只有 ' + rc + ' 分');
    }

    var vc = text(d.validationCommitment);
    var refusesToValidate = !!vc && includes(vc, [
      '不愿意', '不想', '暂时不做', '先不做', '放弃', '不打算', '先等等', '再说吧', '看看情况'
    ]);
    if (refusesToValidate) reasons.push('你明确表示暂时不愿意继续做验证');

    // 明确不愿继续验证 = 直接否决；命中 2 条以上现实条件 = 低可行性
    var level = (refusesToValidate || reasons.length >= 2)
      ? 'low'
      : (reasons.length === 1 ? 'medium' : 'high');

    return {
      level: level,
      reasons: reasons,
      summary: reasons.length ? reasons.join('；') + '。' : '',
      refusedToValidate: refusesToValidate
    };
  }

  /* 30 天判断：必须由**深度证据**分档，不能只按"有无付费"两比特。
   * 分档依据（从强到弱）：付费可重复性 → 外部验证 → 案例可重复性。
   * 特别注意：external 的 weak 与 missing 必须分开措辞 ——
   *   weak   = 有自我描述、缺外部反馈（当事人手上有案例）
   *   missing= 完全没有外部反馈
   * 旧版把 weak 并进"既没有外部反馈"，与事实矛盾，已修正。
   * Round C 第 5 条：现实可行性作为**降级/否决 gate**，先于业务结论判断 ——
   *   即使有案例、有需求、有付费，现实条件不够也不能说"可以继续扩大投入"。 */
  function buildThirtyDayDecision(d, evidence, action, scores, pack) {
    // 同源 canonical 付费真相（Round D 第 2 条）
    var pay = paymentStateOf(d, pack);
    var paid = pay.level;
    var ext = evidence.external;                 // established | weak | missing
    var hasCase = !!evidence.hasUsableCase;
    var hasThree = !!evidence.hasThreeCases;
    var reality = realityFeasibility(d, scores);

    var continueWhen = [];
    var stopWhen = [];

    /* 付费信息冲突：30 天判断必须先把"确认付费"放在第一位，
     * 否则会同时出现"系统放大期"和"付费不足"这类自相矛盾。 */
    if (pay.conflict) {
      continueWhen.unshift('先确认付费信息：付费记录题与成本意愿题哪一处才是真实情况');
      stopWhen.unshift('付费信息没有确认之前，不要按"可以放大"或"必须从零开始"任何一侧行动');
    }

    // --- 外部验证 ---
    if (ext === 'established') {
      continueWhen.push('外部反馈仍然稳定出现，并且指向同一个问题');
    } else if (ext === 'weak') {
      continueWhen.push('除了你自己的描述，至少有 2 个人给出具体反馈或结果');
      stopWhen.push('30 天内反馈仍然只来自你自己的复述，没有任何外部的人替你作证');
    } else {
      continueWhen.push('7 天验证里至少有 2 人说出了自己的具体场景，而不只是客气肯定');
      stopWhen.push('30 天内连一个愿意描述自己场景的人都找不到');
    }

    // --- 案例可重复性（1 个 ≠ 3 个，也不能与"没有案例"混为一谈）---
    if (!hasCase) {
      continueWhen.push('你能写出第一件说清「问题—动作—结果」的真实案例');
      stopWhen.push('连一件能讲清的真实案例都写不出来，说明还不到产品化的阶段');
    } else if (!hasThree) {
      continueWhen.push('案例从 1 个补到 3 个，而不是反复讲同一个');
      stopWhen.push('案例仍然停在 1 个，无法证明这件事可重复');
    }

    // --- 付费可重复性（尺度：0 / 1 次 / 2-5 次 / 稳定）---
    if (paid < 1) {
      continueWhen.push('出现第一笔为具体结果支付的费用，哪怕金额很小');
      stopWhen.push('30 天内仍然没有任何人为具体结果付费');
    } else if (paid === 1) {
      continueWhen.push('出现第二笔付费或复购，证明不是孤立一次');
      stopWhen.push('30 天内付费没有第二次出现');
    } else {
      continueWhen.push('复购、续费或转介绍在 30 天内继续出现，而不是只停在已有的几次');
      stopWhen.push('已经有过的付费不再重复出现（没有复购，也没有转介绍）');
    }

    if (action && action.kind === 'prepare') {
      stopWhen.push('7 天里连具体问题都收不拢，说明现在还不是产品化的时候');
    }

    // --- 现实可行性 gate（优先于业务结论）---
    if (reality.level === 'low') {
      continueWhen.unshift('每周可稳定投入的时间先稳定到 ' + LOW_FEASIBLE_HOURS + ' 小时以上');
      stopWhen.unshift('现实条件没有改善（时间、验证对象或意愿仍然不足），即使有付费也不扩大投入');
    } else if (reality.level === 'medium') {
      continueWhen.push('把当前这个现实可行性先解决掉，再谈扩大');
    }

    // --- 结论：先按业务证据定档，再过现实可行性 gate ---
    var baseVerdict;
    if (paid >= 2) {
      // 与 resolveStage 的"系统放大期"（paid>=2）严格对齐，避免"阶段可放大 / 结论说不足以放大"
      baseVerdict = '你已经出现可重复的付费事实。30 天后要不要继续，取决于付费能不能继续重复出现，而不是取决于感觉好不好。';
    } else if (paid === 1) {
      baseVerdict = '你已经有真实付费，但还只有一次。30 天要看的是第二笔能不能出现——一次付费说明有人愿意买，两次才说明这件事可以重复。';
    } else if (ext === 'established' && hasThree) {
      baseVerdict = '你自述已有多个案例和外部反馈，但仍需确认重复需求与真实付费能否成立。30 天内先完成本报告的访谈和小范围验证；若始终没有具体需求或付费信号，先暂停增加投入，回看对象、问题和交付边界。';
    } else if (ext === 'established') {
      baseVerdict = '已经有人替你作证，但你手上只有 1 个案例。30 天重点是把案例补到 3 个，同时试第一笔付费；两件都做不到，就不要继续投入。';
    } else if (hasCase) {
      baseVerdict = (ext === 'weak')
        ? '你手里有一个能讲清的真实经历，但它目前主要是自我描述，还没有外部的人替你作证。30 天是把这个案例拿出去换外部反馈的窗口，换不到具体反馈就先停。'
        : '你手里有一个能讲清的真实经历，但还没有任何外部反馈。30 天是把它拿出去验证的窗口，拿不到具体反馈就先停。';
    } else {
      baseVerdict = '你现在还没有一件能讲清「问题—动作—结果」的真实案例。30 天是补案例的窗口，不是扩大投入的窗口。';
    }

    /* 现实可行性 gate：
     *  - 业务证据已经成立 → 直接把结论降级为"暂不支持扩大投入"（否决"继续扩大"）
     *  - 业务证据尚未成立 → 保留原结论（它本来就不是"扩大投入"），
     *    只在前面补上现实条件，避免把"案例不足"这个更重要的信息挤掉
     * 付费信息冲突优先级最高：先确认付费，其他判断都不成立。 */
    var evidenceStrong = paid >= 1 || (ext === 'established' && hasThree);
    var verdict = baseVerdict;
    if (pay.conflict) {
      verdict = '付费信息存在冲突，需要确认。' + (pay.note || '')
        + '在确认之前，这 30 天的判断不成立，也不要把任何一处当作已发生的付费事实。';
    } else if (reality.level === 'low') {
      verdict = evidenceStrong
        ? '业务证据成立，但现实条件暂不支持扩大投入。' + reality.summary
          + '30 天内先把这些现实条件补上——这一阶段不是扩大投入的窗口。'
        : '现实条件暂不支持扩大投入。' + reality.summary + baseVerdict;
    }

    return {
      question: '30 天后是否值得继续投入',
      verdict: verdict,
      continueWhen: continueWhen.slice(0, 3),
      stopWhen: stopWhen.slice(0, 3),
      // 现实可行性（机器可读，供审计断言）
      reality: reality,
      // 付费真相（机器可读，供一致性断言）
      paymentConflict: !!pay.conflict,
      paymentLevel: paid
    };
  }

  /* ---------- 主入口 ---------- */

  function build(input) {
    input = input || {};
    var d = input.deepData || {};
    var quizAnswers = input.quizAnswers || [];
    var result = input.result || {};
    var model = root.KevinCommercialDiagnosticModel;

    var pack = null;
    if (model && typeof model.computeCommercialDiagnostic === 'function') {
      pack = model.computeCommercialDiagnostic({ d: d, r: result, td: input.typeData, quizAnswers: quizAnswers });
    }
    pack = pack || {};
    var scores = pack.dimensionScores || {};
    var evidence = buildEvidence(d, scores, pack);
    var decision = pack.decision || pack.recommendation || {};
    var status = text(decision.status) || 'validate_first';
    var action = ACTION_BY_STATUS[status] || ACTION_BY_STATUS.validate_first;
    /* Round D 第 1·2 条：只要规则引擎给了 causeProfile（not_fit_now 的 5 种原因，
     * 以及付费信息冲突），动作就必须由它决定，不能再回落到 status 的统一文案。 */
    var cause = text(decision.cause) || null;
    var causeProfile = decision.causeProfile || null;
    var reality = realityFeasibility(d, scores);
    if (causeProfile) {
      action = actionFromCause(status, causeProfile, action);
      // "现实可行性不足"的原因必须落在动作理由里，否则理由会只说"缺素材"
      if (cause === 'low_reality' && reality.summary) action.reason = text(action.reason) + reality.summary;
    }
    var story = buildCaseStory(d);
    var direction = directionLabel(pack.pathTriage);
    var gaps = buildGaps(scores, pack);
    /* 报告一致性（C）：只在「consult_ready 类动作 + 已有可重复付费证据 + 无任何真实卡点」
     * 三个条件同时成立时，第 1 天才改为与 currentAction 对齐。
     * 条件里的付费门槛用 paymentLevel>=2（已出现复购/续费/转介绍），
     * 与 Round E 的 canonical 付费口径同源；缺任一条一律保留规则引擎原本的 Day 1。 */
    var sevenDayPlan = (pack.sevenDayPlan || []).slice(0, 7);
    if (gaps.level === 'none' && !cause && action.kind === 'advance'
        && evidence.paymentLevel >= 2 && sevenDayPlan.length) {
      sevenDayPlan[0] = alignedDayOne(sevenDayPlan[0], action, gaps);
    }
    var facts = buildFacts(d, scores, evidence);
    var missingFacts = buildMissingFacts(d, facts);
    var validation = buildValidation(d, scores, action, story, cause, pack);
    /* 付费信息冲突 → confidence 必须降级（同源：规则引擎已给出低置信理由，
     * 这里再兜一层，避免任何调用路径漏掉）。 */
    var confidence = (pack.confidence && pack.confidence.level) || (missingFacts.length >= 2 ? 'low' : 'medium');
    if (evidence.paymentConflict) confidence = 'low';

    var readiness = eightQuestionReadiness(result);
    // 同源：pack 交给 resolveStage，付费真相只有一份
    var stageInfo = resolveStage(d, evidence, pack);
    var thirtyDay = buildThirtyDayDecision(d, evidence, action, scores, pack);

    /* Round E 第 1 条：同一份付费真相。level>=2 是"已经可以重复付费"，
     * 不能再写成"付费还不足以证明可以放大"（旧版对所有 level>=1 输出同一句，条件盲）。 */
    var evidenceWord = evidence.hasUsableCase
      ? (evidence.external === 'established'
        ? (evidence.paymentConflict
          ? '但付费信息需要你确认后才能作为判断依据'
          : (evidence.paymentLevel >= 2
            ? '而且已经出现复购、续费或转介绍这类可重复的付费事实'
            : (evidence.paymentLevel >= 1 ? '但只出现过一次付费，还不足以证明可以放大' : '但还没有真实付费来证明它值钱')))
        : '但还没有外部证据证明它真的被别人需要')
      : '但还缺一件能说清的真实案例';

    return {
      version: VERSION,
      packed: pack,
      dimensionScores: scores,
      // 当前阶段由深度证据决定
      stage: stageInfo.label,
      stageWhy: stageInfo.why,
      // 8 题总分只作为"准备度"保留，不再冒充当前阶段
      eightQuestionReadiness: readiness,
      stageBasis: {
        caseCount: evidence.caseCount,
        hasUsableCase: evidence.hasUsableCase,
        hasThreeCases: evidence.hasThreeCases,
        external: evidence.external,
        paymentLevel: evidence.paymentLevel
      },
      /* Round D 第 2 条：付费真相（唯一来源 = 规则引擎的 paymentState）。
       * 报告要显式提示"冲突、需要确认"，因此把整块状态带出去。 */
      payment: {
        level: evidence.paymentLevel,
        source: (evidence.paymentState && evidence.paymentState.source) || 'none',
        conflict: !!evidence.paymentConflict,
        paidBeforeOption: (evidence.paymentState && evidence.paymentState.paidBeforeOption) || '',
        willingnessOption: (evidence.paymentState && evidence.paymentState.willingnessOption) || '',
        note: (evidence.paymentState && evidence.paymentState.note) || ''
      },
      paymentConflict: !!evidence.paymentConflict,
      /* Round D 第 1 条：not_fit_now 的原因（机器可读，供下游与断言消费） */
      actionCause: cause,
      actionCauses: decision.causes || (cause ? [cause] : []),
      actionCauseLabel: causeProfile ? text(causeProfile.label) : '',
      direction: {
        label: direction,
        reason: directionReason(pack, d),
        // 同源依据（机器可读，供审计断言；不渲染给用户）
        reasonCodes: (pack.pathTriage && pack.pathTriage.reasonCodes) || [],
        basis: (pack.pathTriage && pack.pathTriage.firstPath && pack.pathTriage.firstPath.basis) || null
      },
      thirtyDay: normalizeDeep(thirtyDay),
      /* 规格 §4.2：currentAction.reason 可能来自原因画像（含"六维里的…分"这类原话），
       * 这里同样走一次维度改名归一化，否则免费摘要会漏出旧名「现实约束」。 */
      currentAction: normalizeDeep({
        key: action.key,
        label: action.label,
        kind: action.kind,
        reason: action.reason || actionReason(status, gaps, causeProfile)
      }),
      gap: gaps,
      primaryGap: gaps.primary,
      secondaryGap: gaps.secondary,
      evidence: evidence,
      evidenceLabel: EVIDENCE_LABEL,
      facts: facts,
      missingFacts: missingFacts,
      assets: buildAssets(d, scores, pack, evidence),
      paths: normalizeDeep(pack.pathTriage || {}),
      dontDoNow: normalizeDeep(buildDontDoNow(d, scores, pack, gaps, action, causeProfile)),
      validation: normalizeDeep(validation),
      decisionSignals: normalizeDeep(buildDecisionSignals(d, scores, action, evidence, cause)),
      firstDelivery: normalizeDeep(buildFirstDelivery(d, scores, pack, action, direction, causeProfile, cause)),
      story: story,
      confidence: confidence,
      conclusion: buildConclusionSentence(d, direction, action, evidenceWord),
      sevenDayPlan: sevenDayPlan,
      scripts: pack.scripts || {},
      riskProfile: pack.riskProfile || {},
      stopRules: pack.stopRules || [],
      informationGaps: pack.informationGaps || [],
      actionStatus: status
    };
  }

  function actionReason(status, gaps, causeProfile) {
    /* cause 有话说时以 cause 为准：这是"为什么是这个动作"的唯一来源。 */
    if (causeProfile && has(causeProfile.actionReason)) return text(causeProfile.actionReason);
    if (status === 'not_fit_now' || status === 'extract_cases_first') {
      return '因为你现在最缺的是可复述的真实案例和真实问题，先花钱或先做重产品都会放大试错成本。';
    }
    if (status === 'consult_ready') {
      return '因为你已经有经验、证据和需求信号，继续泛泛学习没有意义，该把边界定下来。';
    }
    if (status === 'career_reposition_first') {
      return '因为你当前要解决的是职业选择，不是产品化；先定职业，再谈经验变现。';
    }
    if (gaps && gaps.primary) {
      return '因为六个维度里最低的是「' + gaps.primary.label + '」（' + gaps.primary.score + ' 分），它还没被证明。';
    }
    return '因为方向有机会，但还缺足够硬的付费或复购证据。';
  }

  function buildConclusionSentence(d, direction, action, evidenceWord) {
    if (has(d.years)) {
      return '你已经有可用于判断的经验（' + text(d.years) + '），' + evidenceWord + '。';
    }
    return '你已经有可拆解的经历，' + evidenceWord + '。';
  }

  /* ---------- 免费摘要（4 模块） ---------- */

  function buildFreeSummary(J) {
    if (!J) return null;
    J = J.version === VERSION ? J : build(J);
    var facts = J.facts.slice(0, 4).map(function (item) { return item.text; });
    var moduleA = {
      stage: J.stage,
      stageWhy: J.stageWhy,
      readinessLabel: '8题准备度',
      readiness: (J.eightQuestionReadiness || {}).label || '',
      readinessScore: (J.eightQuestionReadiness || {}).score || 0,
      directionLabel: '方向倾向',
      direction: J.direction.label,
      directionReason: J.direction.reason,
      actionLabel: '当前动作',
      action: J.currentAction.label,
      statement: J.conclusion + '你的方向更接近「' + J.direction.label + '」，但当前最优动作不是直接投入，而是「' + J.currentAction.label + '」。'
    };
    return {
      version: VERSION,
      A_judgement: moduleA,
      A_reason: J.currentAction.reason,
      // 付费信息冲突：免费摘要也必须显式提示"需要确认"，不能默默进入判断
      paymentConflict: !!J.paymentConflict,
      paymentNote: (J.payment && J.payment.note) || '',
      actionCause: J.actionCause || null,
      actionCauseLabel: J.actionCauseLabel || '',
      B_facts: facts,
      B_missing: J.missingFacts.map(function (item) { return item.text; }),
      B_storyQuote: J.story ? J.story.quote : '',
      C_dontDoNow: J.dontDoNow,
      D_validation: J.validation,
      D_gapHeadline: J.gap.headline,
      D_primaryGap: J.primaryGap,
      D_secondaryGap: J.secondaryGap,
      confidence: J.confidence
    };
  }

  return {
    VERSION: VERSION,
    build: build,
    buildFreeSummary: buildFreeSummary,
    // 语义判断（供回归测试与其它模块复用，保证全站只有一套口径）
    weakOrMissing: weakOrMissing,
    strongText: strongText,
    isNegativeAnswer: isNegativeAnswer,
    isPureWillingness: isPureWillingness,
    parseCaseCount: parseCaseCount,
    hasUsableCase: hasUsableCase,
    hasThreeCases: hasThreeCases,
    externalEvidenceState: externalEvidenceState,
    eightQuestionReadiness: eightQuestionReadiness,
    resolveStage: resolveStage,
    getCaseLevel: getCaseLevel,
    getPaidLevel: getPaidLevel,
    getWillingnessLevel: getWillingnessLevel,
    getConsultLevel: getConsultLevel,
    // Round E 第 2 条：需求等级（旧档优先 / LIVE_FORM 可达字段自足），供测试与审计核对
    localDemandLevel: localDemandLevel,
    demandLevelOf: demandLevelOf,
    demandEvidenceText: demandEvidenceText,
    // Round D 第 2 条：canonical 付费状态（同源读取 + 本地回退），供测试直接核对
    paymentStateOf: paymentStateOf,
    localPaymentState: localPaymentState,
    PAYMENT_DENIAL_OPTIONS: PAYMENT_DENIAL_OPTIONS,
    // 30 天判断（第 10 条：付费墙承诺必须真交付，故导出供断言核验）
    buildThirtyDayDecision: buildThirtyDayDecision,
    // 现实可行性 gate（第 5 条：业务证据成立 ≠ 有能力扩大投入）
    realityFeasibility: realityFeasibility,
    LOW_FEASIBLE_HOURS: LOW_FEASIBLE_HOURS,
    // 固定单选题的逐字枚举映射（第 1 条 P0，导出供审计直接核对）
    PAID_BEFORE_LEVEL_MAP: PAID_BEFORE_LEVEL_MAP,
    COST_WILLINGNESS_PAID_MAP: COST_WILLINGNESS_PAID_MAP,
    COST_WILLINGNESS_LEVEL_MAP: COST_WILLINGNESS_LEVEL_MAP
  };
}));
