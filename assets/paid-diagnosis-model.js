(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KevinPaidDiagnosisModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function includesAny(value, words) {
    var source = text(value);
    return words.some(function(word) { return source.indexOf(word) !== -1; });
  }

  function number(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function getConsultLevel(value) {
    var v = text(value);
    if (v.indexOf('经常') !== -1) return 3;
    if (v.indexOf('3-5') !== -1) return 2;
    if (v.indexOf('1-2') !== -1) return 1;
    return 0;
  }

  function getPaidLevel(value) {
    var v = text(value);
    if (v.indexOf('稳定') !== -1) return 3;
    if (v.indexOf('2-5') !== -1) return 2;
    if (v.indexOf('1次') !== -1) return 1;
    return 0;
  }

  function getTypeKey(rd) {
    return text(rd && rd.r && rd.r.type) || 'content';
  }

  function getTypeName(rd) {
    var name = text(rd && rd.td && rd.td.name);
    if (name) return name.replace(/型$/, '');
    var map = {
      content: '内容表达',
      consulting: '咨询判断',
      knowledge: '知识产品',
      template: '模板工具',
      service: '服务交付',
      coaching: '陪跑推进'
    };
    return map[getTypeKey(rd)] || '经验资产';
  }

  function getStageSignals(rd) {
    var r = rd.r || {};
    var d = rd.d || {};
    var score = number(r.score, 0);
    var axisScores = r.axisScores || {};
    var consultLevel = getConsultLevel(d.consultedBefore);
    var paidLevel = getPaidLevel(d.paidBefore);
    var pastTry = text(d.pastTry);
    var pastResult = text(d.pastResult);
    var hasPastWork = pastTry && pastTry !== '还没认真做过';
    var hasEvidence = hasPastWork || number(axisScores.proof, 0) >= 3 || includesAny(pastResult, ['有人付费', '有人感兴趣']);
    var hasPaidSignal = paidLevel > 0 || includesAny(pastTry + pastResult, ['付费', '有人付费']);
    var hasConsultSignal = consultLevel > 0;
    var hasInterestSignal = hasConsultSignal || hasPaidSignal || includesAny(pastResult, ['有人感兴趣']);
    var validationWill = number(axisScores.validationWill, 0);
    var hours = number(d.hours, 0);
    var bottleneck = text(d.bottleneck);

    return {
      score: score,
      axisScores: axisScores,
      consultLevel: consultLevel,
      paidLevel: paidLevel,
      hasPastWork: hasPastWork,
      hasEvidence: hasEvidence,
      hasPaidSignal: hasPaidSignal,
      hasConsultSignal: hasConsultSignal,
      hasInterestSignal: hasInterestSignal,
      validationWill: validationWill,
      hours: hours,
      bottleneck: bottleneck
    };
  }

  function buildRecommendation(rd, s) {
    if (s.score < 42 || (!s.hasEvidence && !s.hasInterestSignal)) {
      return {
        status: 'not_now',
        label: '暂时不要做',
        title: '你现在不适合急着做流量型个人品牌或付费产品',
        summary: '当前最值钱的动作不是系统投入、复杂产品或包装人设，而是把真实经历先拆成案例、问题和证据。先补素材，再谈产品化。'
      };
    }

    if (s.hasPaidSignal || (s.consultLevel >= 2 && s.score >= 60)) {
      return {
        status: 'ready',
        label: '可以进入付费验证',
        title: '你可以进入低风险付费验证，但要先写清交付边界',
        summary: '你已经出现咨询或付费信号，下一步不是继续免费输出，而是把第一版交付物、价格和不包含范围说清楚。'
      };
    }

    return {
      status: 'caution',
      label: '谨慎低成本验证',
      title: '你可以验证，但不应该大额投入或直接做重产品',
      summary: '你有经验基础，但市场信号还不够硬。先用 7 天验证一个具体问题，确认有人愿意继续聊、愿意给反馈，再决定是否加码。'
    };
  }

  function buildConfidence(rd, s) {
    var d = rd.d || {};
    var selfConfidence = number(d.confidence, 0);
    if (selfConfidence >= 8 && !s.hasInterestSignal) {
      return {
        level: 'low',
        label: '结论可信度：低',
        reason: '你主观信心较高，但目前没有咨询、付费或明确兴趣信号。这里最容易自我误判，建议先做外部验证。'
      };
    }
    if (s.hasPaidSignal || (s.consultLevel >= 2 && s.hasEvidence)) {
      return {
        level: 'high',
        label: '结论可信度：高',
        reason: '你的回答里出现了真实咨询、付费或明确需求信号，报告可以给出更明确的路径建议。'
      };
    }
    return {
      level: 'medium',
      label: '结论可信度：中',
      reason: '你的经验和资源有一定基础，但仍主要依赖自评。需要用 7 天动作把判断从自我感觉变成外部反馈。'
    };
  }

  function buildEvidence(rd, s) {
    var d = rd.d || {};
    var typeName = getTypeName(rd);
    var evidence = [];
    evidence.push('你当前的测评准备度是 ' + s.score + ' 分，说明这不是能力评价，而是判断经验离可验证、可交付、可收费还有多远。');
    evidence.push('你的主要倾向是「' + typeName + '」，第一步应该围绕这个方向做最小验证，不适合同时试很多产品形态。');
    evidence.push('你填写的当前卡点是「' + (text(d.bottleneck) || '暂未明确') + '」，这决定了报告优先处理判断和验证，而不是直接给你做包装。');
    if (s.hasPaidSignal) evidence.push('你已经出现过付费信号，重点是把交付边界和案例证据沉淀出来。');
    else if (s.hasConsultSignal) evidence.push('你已经出现过请教或咨询信号，但付费信号还不稳定，需要先验证别人是否愿意为更明确的判断投入成本。');
    else evidence.push('你暂时没有明确咨询或付费信号，所以不建议马上做复杂投入、大而全产品或重工具。');
    evidence.push('你每周可投入约 ' + (text(d.hours) || '未填写') + ' 小时，报告建议最好匹配这个现实限制，不要设计过重动作。');
    return evidence;
  }

  function buildStopRules(rd, s) {
    var rules = [];
    if (!s.hasEvidence) rules.push('如果你拿不出 3 个真实案例，先不要做复杂产品、社群或高价服务。');
    if (!s.hasInterestSignal) rules.push('如果没有人愿意继续聊具体问题，先不要为定位、视觉或工具继续投入钱。');
    if (s.hours > 0 && s.hours < 5) rules.push('如果每周可投入少于 5 小时，不要做重服务或长期陪跑，只做轻验证。');
    if (s.bottleneck.indexOf('方向') !== -1) rules.push('如果第一人群和第一问题说不清，先不要开产品、建社群或做系统投入。');
    if (s.bottleneck.indexOf('定价') !== -1) rules.push('如果客户为什么付费说不清，先不要纠结价格数字。');
    if (!rules.length) rules.push('如果交付物、不包含范围和通过标准没有写清，先不要正式收高价。');
    rules.push('如果 7 天内没有真实对话、追问或明确反馈，停止加码，回到经验萃取。');
    return rules.slice(0, 5);
  }

  function typeOffer(type) {
    var map = {
      content: {
        target: '过去问过你类似问题的同事、同行或转型中的朋友',
        problem: '他们不知道某个具体选择该怎么判断，容易被信息和情绪带着走。',
        offer: '3 条问题型内容 + 1 次评论/私聊反馈整理',
        boundary: '只验证问题是否成立，不承诺立刻帮对方做完整方案。'
      },
      consulting: {
        target: '带着真实问题来问你判断和建议的人',
        problem: '他们卡在选择、误区和下一步动作，不缺资料，缺判断。',
        offer: '一次 45-60 分钟问题拆解或路径诊断',
        boundary: '只判断路径、卡点和下一步，不做长期陪聊和无限答疑。'
      },
      knowledge: {
        target: '愿意自学判断，但不想一上来花上万元系统投入的人',
        problem: '他们想先理解底层逻辑，判断自己是否值得继续投入。',
        offer: '一份低价自学包、误区清单或专题报告',
        boundary: '提供判断框架和材料路线，不承诺替他定制个人方案。'
      },
      template: {
        target: '已经有具体任务，但不知道怎么拆步骤的人',
        problem: '他们需要一个能直接照着用的模板、清单或 SOP。',
        offer: '一个一页纸模板或检查清单',
        boundary: '只解决一个具体场景，不做大而全工具库。'
      },
      service: {
        target: '愿意为明确结果付费，但不想自己摸索执行的人',
        problem: '他们知道问题存在，但缺少可交付的执行支持。',
        offer: '一个边界清楚的小服务包',
        boundary: '写清交付物、次数、周期和不包含范围，避免什么都接。'
      },
      coaching: {
        target: '需要短周期推进和反馈的人',
        problem: '他们不是不知道，而是卡在行动、复盘和持续推进。',
        offer: '7 天轻服务或短周期行动验证',
        boundary: '只做 7 天推进，不承诺长期陪跑或结果包办。'
      }
    };
    return map[type] || map.content;
  }

  function buildProductHypothesis(rd, s, recommendation) {
    var base = typeOffer(getTypeKey(rd));
    var status = recommendation.status;
    return {
      targetCustomer: status === 'not_now' ? '先不要假设陌生客户，先从 3 个熟人或旧同事里找真实问题。' : base.target,
      problemScene: status === 'not_now' ? '你现在要验证的是别人是否真的会因为某个问题来问你，而不是验证你能不能做一个产品。' : base.problem,
      firstOffer: status === 'not_now' ? '3 个经验案例拆解 + 1 条问题验证内容' : base.offer,
      validationPrice: status === 'ready' ? '99-699 元，先从边界清楚的小交付开始' : (status === 'caution' ? '0-99 元，先验证意愿，不追求收入' : '暂不收费，先换真实反馈'),
      deliveryBoundary: base.boundary,
      continueSignal: status === 'ready' ? '有人愿意付费、复购、转介绍，或愿意把更具体的问题交给你继续拆。' : '至少 3 个人给出具体场景、继续追问，或愿意预约一次更深入的交流。',
      stopSignal: status === 'not_now' ? '如果 7 天内连 3 个具体问题都找不到，停止产品化，先回去做经验盘点。' : '如果反馈只停留在点赞、客气夸奖，没有具体问题和继续动作，暂时不要加码。'
    };
  }

  function buildSevenDayPlan(rd, s, recommendation) {
    var hypothesis = buildProductHypothesis(rd, s, recommendation);
    return [
      { day: '第 1 天', title: '写出 3 个真实经验案例', action: '每个案例只写问题、你怎么判断、你做了什么、结果是什么。写不出来就不要做产品。' },
      { day: '第 2 天', title: '选一个最小问题', action: '从 3 个案例里挑一个别人最可能也会遇到的问题，压成一句话。' },
      { day: '第 3 天', title: '发一条验证内容', action: '用案例开头，提出判断，不急着卖资料，不急着卖服务，只观察谁会停下来。' },
      { day: '第 4 天', title: '找 3 个人做问题访谈', action: '不要问“你要不要买”，只问他最近是否遇到过类似问题、怎么处理、卡在哪里。' },
      { day: '第 5 天', title: '写出第一版交付物', action: '把交付压成一个最小东西：' + hypothesis.firstOffer + '。同时写清不包含什么。' },
      { day: '第 6 天', title: '测试一次低门槛意向', action: '向有具体问题的人发出一次轻邀请，观察他是否愿意投入时间、反馈或小额费用。' },
      { day: '第 7 天', title: '做继续/暂停判断', action: '对照通过信号和停止信号。如果没有真实反馈，不要继续做产品，回到经验萃取。' }
    ];
  }

  function buildScripts(rd, recommendation) {
    var typeName = getTypeName(rd);
    var d = rd.d || {};
    var bottleneck = text(d.bottleneck) || '方向判断';
    return {
      moments: '我最近在整理一个关于「' + typeName + '」的小判断：很多人工作多年不是没经验，而是不知道经验能不能变成可交付的价值。如果你也卡在' + bottleneck + '，可以私信我一句你的情况，我想收集几个真实问题做验证。',
      interview: '我想请教你 3 个问题：你最近有没有遇到过类似问题？你现在是怎么解决的？如果有人能帮你把判断、步骤或交付边界讲清楚，你最希望先解决哪一块？',
      trialInvite: '我可以先用一个很轻的方式帮你拆一次，不承诺完整方案，只帮你判断问题、卡点和下一步。如果你觉得有用，我们再看是否需要预约职业经验资产一对一诊断。',
      rejectionFollowup: '没关系，我不是想推销。我更想确认这个问题是不是真实存在。你不想继续的原因是现在不急、问题不痛，还是我表达的交付不够清楚？'
    };
  }

  function buildConsultBoundary(recommendation) {
    if (recommendation.status === 'not_now') {
      return '暂时不建议直接预约职业经验资产一对一诊断。先按 7 天清单补案例和真实反馈，等你能说清第一问题后，再判断是否需要人工判断。';
    }
    if (recommendation.status === 'ready') {
      return '职业经验资产预诊断报告只负责自动初筛和第一版验证动作；职业经验资产一对一诊断才会基于你的真实经历做路径判断、案例选择和交付边界设计。';
    }
    return '先按职业经验资产预诊断报告做 7 天验证。如果验证后仍卡在路径、案例、定价或交付边界，再判断是否需要预约职业经验资产一对一诊断。';
  }

  function computePaidDiagnosisPackage(rd) {
    rd = rd || {};
    var signals = getStageSignals(rd);
    var recommendation = buildRecommendation(rd, signals);
    var confidence = buildConfidence(rd, signals);
    return {
      recommendation: recommendation,
      confidence: confidence,
      evidence: buildEvidence(rd, signals),
      stopRules: buildStopRules(rd, signals),
      productHypothesis: buildProductHypothesis(rd, signals, recommendation),
      sevenDayPlan: buildSevenDayPlan(rd, signals, recommendation),
      scripts: buildScripts(rd, recommendation),
      consultBoundary: buildConsultBoundary(recommendation)
    };
  }

  return {
    computePaidDiagnosisPackage: computePaidDiagnosisPackage
  };
});
