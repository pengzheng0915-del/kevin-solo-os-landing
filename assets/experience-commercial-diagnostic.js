(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KevinCommercialDiagnosticModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function number(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  var diagnosticDimensions = {
    experience_depth: '经验厚度',
    problem_clarity: '问题清晰度',
    evidence_assets: '证据资产',
    demand_signal: '需求信号',
    delivery_feasibility: '交付可行性',
    // 规格 §4.2：对用户可读的维度名统一为「现实可行性」
    // （旧名「现实约束」只保留在内部注释与历史文档里）
    reality_constraints: '现实可行性'
  };

  var dimensionOrder = Object.keys(diagnosticDimensions);

  var pathCatalog = {
    content: {
      key: 'content',
      label: '内容探测路径',
      summary: '先用观点、案例和公开表达找到真实问题，不把内容当成最终产品。',
      firstOffer: '3 条案例型内容 + 私聊反馈整理',
      backup: '先做问题访谈，确认别人是否真的卡在这个问题。',
      avoid: '不要追热点、做人设包装或一上来做课程。'
    },
    knowledge: {
      key: 'knowledge',
      label: '知识产品路径',
      summary: '把经验整理成报告、清单、自学材料或专题结构，先验证别人愿意为哪个问题付费。',
      firstOffer: '一份低价报告、清单或自学材料',
      backup: '先做一页问题清单，换 3 个真实反馈。',
      avoid: '不要一上来录大课、堆大知识库或做复杂会员。'
    },
    template: {
      key: 'template',
      label: '模板工具路径',
      summary: '把经验压成模板、检查清单、SOP 或工具，让别人能直接用于一个具体场景。',
      firstOffer: '一个一页纸模板、检查清单或 SOP',
      backup: '先把一个真实案例拆成步骤，再找人试用。',
      avoid: '不要做大而全工具库，也不要脱离场景做模板。'
    },
    consulting: {
      key: 'consulting',
      label: '咨询诊断路径',
      summary: '把你的价值放在判断力和问题拆解上，做边界清楚的一次性诊断。',
      firstOffer: '一次 45-60 分钟问题拆解或路径诊断',
      backup: '先做 3 次免费或低价访谈，验证问题是否足够具体。',
      avoid: '不要做低价陪聊、无限答疑或没有交付边界的咨询。'
    },
    service: {
      key: 'service',
      label: '小服务交付路径',
      summary: '用一个边界清楚的小服务换反馈、案例和付费信号。',
      firstOffer: '一个周期短、结果清楚的小服务包',
      backup: '先做一次轻交付，确认客户愿意配合和验收。',
      avoid: '不要什么都接，不要按小时零散出售，也不要承诺不可控结果。'
    },
    case_extract: {
      key: 'case_extract',
      label: '案例萃取路径',
      summary: '先把真实经历拆成案例、问题、判断和结果，再考虑任何产品化。',
      firstOffer: '3 个经验案例拆解 + 1 条问题验证内容',
      backup: '先找旧同事或熟人确认这些问题是否真实存在。',
      avoid: '不要先买工具、改主页、做包装或预约高价咨询。'
    },
    career_reposition: {
      key: 'career_reposition',
      label: '职业再定位路径',
      summary: '先判断主业、岗位、现金流和可迁移能力，再决定是否把经验产品化。',
      firstOffer: '一页职业选择条件表 + 可迁移能力清单',
      backup: '先做低成本能力验证，不急着做副业产品。',
      avoid: '不要被焦虑推着离职、买课或直接做个人 IP。'
    },
    organization_map: {
      key: 'organization_map',
      label: '组织复杂问题梳理',
      summary: '先梳理老板、权责、资源和业务节奏，不把组织问题误判成个人努力问题。',
      firstOffer: '一页相关方和可控动作地图',
      backup: '先把你能控制的动作和不能控制的条件分开。',
      avoid: '不要用个人焦虑推动组织变革，也不要让自动报告替组织做决策。'
    }
  };

  var deepGroups = [
    {
      title: '基础背景',
      desc: '先确认你是不是适合现在做这件事',
      fields: [
        { id: 'name', label: '你的称呼（用于报告）', type: 'text', scored: false, valueHint: '只用于生成报告标题' },
        { id: 'industry', label: '你所在行业？', type: 'seg', scored: false, opts: ['互联网/IT','金融','制造业','教育/培训','医疗/健康','咨询/服务','政府/国企','其他'], valueHint: '只用于报告语境，不直接决定结论' },
        { id: 'years', label: '你有多少年可迁移的工作经验？', type: 'seg', dimension: 'experience_depth', opts: [
          opt('1-3年', '经验还在积累期，暂不适合急着做个人商业化。', { experience_depth: 20 }),
          opt('4-8年', '已有一定项目经验，但还需要证明可迁移价值。', { experience_depth: 48 }),
          opt('9-15年', '经验厚度足够，关键是能否被整理成案例和交付。', { experience_depth: 82 }),
          opt('16年+', '经验厚度较强，重点看证据、需求和交付边界。', { experience_depth: 90 })
        ], valueHint: '判断经验厚度，不等于能力高低' },
        { id: 'status', label: '你当前状态更接近哪一种？', type: 'seg', dimension: 'reality_constraints', opts: [
          opt('在职', '时间有限，适合低成本验证，不适合重交付。', { reality_constraints: 62 }),
          opt('自由职业', '有交付空间，但更需要现金流和边界控制。', { reality_constraints: 72 }),
          opt('正在探索新方向', '适合验证，但不能同时开太多方向。', { reality_constraints: 52 }),
          opt('还没开始', '先完成经验盘点和案例拆解。', { reality_constraints: 28 })
        ], valueHint: '判断现实约束，不给空想方案' }
      ]
    },
    {
      title: '经验与问题',
      desc: '判断你的经验能不能变成别人愿意理解的问题',
      fields: [
        { id: 'problemSpecificity', label: '你现在能把“帮谁解决什么问题”说到什么程度？', type: 'seg', dimension: 'problem_clarity', opts: [
          opt('说不清帮谁解决什么问题', '目前还只是自我感觉，暂时不能产品化。', { problem_clarity: 12 }),
          opt('大概知道方向，但人群和问题都比较泛', '可以继续收窄，但不能马上做重产品。', { problem_clarity: 38 }),
          opt('能说清一类人和一个高频问题', '已经具备低成本验证基础。', { problem_clarity: 68 }),
          opt('能说清具体人群、具体问题和触发场景', '问题清晰度较强，可以进入更明确的交付设计。', { problem_clarity: 88 })
        ], valueHint: '19.9 元完整自动报告会据此梳理是否适合继续验证' },
        { id: 'caseCount', label: '你能拿出几个真实案例说明自己解决过类似问题？', type: 'seg', dimensions: ['experience_depth','evidence_assets'], opts: [
          opt('暂时没有能讲清的案例', '没有案例就先不要收费。', { experience_depth: 15, evidence_assets: 8 }),
          opt('有1-2个能讲清的问题案例', '有一点基础，但还不够稳定。', { experience_depth: 48, evidence_assets: 42 }),
          opt('有3个以上真实案例', '已经可以做最小验证。', { experience_depth: 76, evidence_assets: 66 }),
          opt('有5个以上可复用案例', '案例基础较好，可以考虑系统化交付。', { experience_depth: 90, evidence_assets: 82 })
        ], valueHint: '案例数量决定报告敢不敢建议你收费' },
        { id: 'caseCountDetailed', label: '你能否写出 3 个真实案例？', type: 'seg', dimensions: ['experience_depth','evidence_assets'], opts: [
          opt('写不出来', '当前最该做的是案例萃取，不是收费或包装。', { experience_depth: 12, evidence_assets: 8 }),
          opt('能写1个案例', '开始有素材，但还不足以稳定判断路径。', { experience_depth: 36, evidence_assets: 30 }),
          opt('能写3个真实案例', '具备生成完整自动报告和进行低成本验证的基础。', { experience_depth: 72, evidence_assets: 62 }),
          opt('能写5个以上，并包含结果或反馈', '案例质量较好，可以进一步判断交付边界，以及是否适合预约职业经验资产一对一诊断。', { experience_depth: 90, evidence_assets: 84 })
        ], valueHint: '不是问你经历多不多，而是能不能把经历讲成案例' },
        { id: 'bestCaseDescription', label: '你最强的一个案例能被别人看懂到什么程度？', type: 'seg', dimensions: ['problem_clarity','evidence_assets'], opts: [
          opt('只能自己讲感觉', '客户还看不到判断依据。', { problem_clarity: 18, evidence_assets: 14 }),
          opt('能讲背景和过程', '有故事，但还缺判断、动作和结果。', { problem_clarity: 42, evidence_assets: 34 }),
          opt('能讲问题、判断、动作、结果', '案例已经能支撑路径判断。', { problem_clarity: 72, evidence_assets: 66 }),
          opt('已经形成文字、材料或对外展示', '案例可展示度较强。', { problem_clarity: 84, evidence_assets: 82 })
        ], valueHint: '判断你的经验能不能被客户理解和信任' },
        { id: 'assetFormat', label: '你的经验现在沉淀成了什么？', type: 'seg', dimensions: ['evidence_assets','delivery_feasibility'], opts: [
          opt('还没有任何可展示材料', '客户看不到你凭什么靠谱。', { evidence_assets: 8, delivery_feasibility: 12 }),
          opt('只有零散想法或聊天记录', '需要先整理成案例和流程。', { evidence_assets: 28, delivery_feasibility: 26 }),
          opt('有零散文章、方案或复盘', '可以做低成本验证。', { evidence_assets: 54, delivery_feasibility: 50 }),
          opt('有可展示的流程、清单或方法材料', '具备做小交付的基础。', { evidence_assets: 72, delivery_feasibility: 70 }),
          opt('已经有标准化流程、工具或交付说明', '可以考虑更清晰的付费交付。', { evidence_assets: 88, delivery_feasibility: 86 })
        ], valueHint: '判断经验是不是已经变成资产' },
        { id: 'evidenceQuality', label: '别人能看到什么外部证据？', type: 'seg', dimension: 'evidence_assets', opts: [
          opt('没有外部反馈或结果证据', '目前主要靠自我描述，可信度会被降低。', { evidence_assets: 8 }),
          opt('主要是自我描述，缺少外部反馈', '需要先换真实反馈。', { evidence_assets: 30 }),
          opt('有具体反馈，但还没有付费或转介绍', '可以进入低成本验证。', { evidence_assets: 62 }),
          opt('有客户反馈、结果证明或转介绍', '证据质量较强，适合更明确的商业判断。', { evidence_assets: 86 })
        ], valueHint: '可信度主要看外部证据，不看自信' }
        ,
        { id: 'evidenceType', label: '你现在最硬的证据是什么？', type: 'seg', dimension: 'evidence_assets', opts: [
          opt('没有外部反馈或结果证据', '不能只靠自我描述进入收费判断。', { evidence_assets: 8 }),
          opt('主要是自我描述，缺少外部反馈', '先补反馈和结果材料。', { evidence_assets: 28 }),
          opt('有具体反馈或结果截图', '可以做低成本路径验证。', { evidence_assets: 62 }),
          opt('有客户反馈、结果证明、转介绍或付费记录', '证据更硬，可以考虑更明确的付费路径。', { evidence_assets: 88 })
        ], valueHint: '区分“我觉得有用”和“别人看得见有用”' },
        { id: 'targetCustomerClarity', label: '你现在有没有明确目标对象？', type: 'seg', dimension: 'problem_clarity', opts: [
          opt('没有', '没有目标对象就没有产品边界。', { problem_clarity: 10 }),
          opt('有大概行业或人群', '行业名不是客户，还需要收窄。', { problem_clarity: 36 }),
          opt('有一类具体人和一个高频问题', '具备低成本验证基础。', { problem_clarity: 70 }),
          opt('有具体触发场景和购买动机', '问题清晰度较强。', { problem_clarity: 88 })
        ], valueHint: '不要先定终局定位，先找第一人群和第一问题' },
        { id: 'problemScene', label: '这个问题的触发场景清楚吗？', type: 'seg', dimension: 'problem_clarity', opts: [
          opt('说不清触发场景', '问题还停留在抽象方向。', { problem_clarity: 16 }),
          opt('能说清大概场景', '可以继续访谈确认。', { problem_clarity: 42 }),
          opt('能说清具体触发场景', '适合做验证内容或访谈。', { problem_clarity: 70 }),
          opt('能说清场景、痛点和购买动机', '适合设计第一版交付。', { problem_clarity: 88 })
        ], valueHint: '客户通常不是为方向买单，而是为具体场景里的问题买单' }
      ]
    },
    {
      title: '需求信号',
      desc: '判断这是不是你自己想做，还是别人真的需要',
      fields: [
        { id: 'consultedBefore', label: '是否有人主动找你咨询/请教过？', type: 'seg', dimension: 'demand_signal', opts: [
          opt('暂时没有', '还没有需求入口。', { demand_signal: 12 }),
          opt('有1-2人问过，但比较零散', '有弱信号，需要继续确认。', { demand_signal: 42 }),
          opt('有3-5人问过，说明有初步需求', '需求信号成立，可以测试交付边界。', { demand_signal: 68 }),
          opt('经常有人问我类似问题', '需求信号较强，可以考虑更系统的交付。', { demand_signal: 84 })
        ], valueHint: '咨询信号不等于付费信号' },
        { id: 'paidBefore', label: '是否有人为你的经验/服务付费过？', type: 'seg', dimension: 'demand_signal', opts: [
          opt('还没有付费记录', '不能直接假设客户愿意付钱。', { demand_signal: 18 }),
          opt('有1次付费尝试', '出现早期付费信号，但需要复验。', { demand_signal: 58 }),
          opt('有2-5次付费记录', '付费信号较强，可以考虑小交付或诊断。', { demand_signal: 78 }),
          opt('已经有相对稳定的付费需求', '可以进入交付体系和定价边界判断。', { demand_signal: 92 })
        ], valueHint: '付费信号是最硬的商业证据' },
        { id: 'costWillingnessSignal', label: '别人愿意为这个问题投入什么成本？', type: 'seg', dimension: 'demand_signal', opts: [
          opt('没有', '还不能证明这个问题值得产品化。', { demand_signal: 10 }),
          opt('愿意继续聊', '有弱需求信号，但还不是付费信号。', { demand_signal: 38 }),
          opt('愿意试用或花时间配合', '需求开始变得更真实。', { demand_signal: 64 }),
          opt('已经付费、复购或转介绍', '付费信号较硬，可以判断更明确路径。', { demand_signal: 90 })
        ], valueHint: '点赞和夸奖不算成本，时间、配合、付费才更硬' },
        { id: 'audienceAccess', label: '你能通过什么方式找到真实验证对象？', type: 'seg', dimensions: ['demand_signal','reality_constraints'], opts: [
          opt('暂时找不到可验证对象', '没有验证对象就不要做产品。', { demand_signal: 8, reality_constraints: 20 }),
          opt('有少量熟人或旧同事可以访问', '可以做第一轮低成本访谈。', { demand_signal: 36, reality_constraints: 52 }),
          opt('有稳定私域或小社群可以验证', '适合做 7 天验证。', { demand_signal: 68, reality_constraints: 72 }),
          opt('有公开内容渠道或稳定客户来源', '触达条件较好，可以考虑小规模试单。', { demand_signal: 82, reality_constraints: 78 })
        ], valueHint: '没有验证对象，不建议继续花钱包装' }
      ]
    },
    {
      title: '交付与现实',
      desc: '判断你第一步该做什么，以及什么情况下停止',
      fields: [
        { id: 'deliveryPreference', label: '如果做最小交付，你最自然的形式是什么？', type: 'seg', dimension: 'delivery_feasibility', opts: [
          opt('我还不确定', '交付形态不清，先别收费。', { delivery_feasibility: 18 }),
          opt('一份报告、清单或自学材料', '适合低价信息产品或自学包验证。', { delivery_feasibility: 62 }),
          opt('一次 45-60 分钟问题诊断', '适合边界清楚的职业经验资产一对一诊断。', { delivery_feasibility: 70 }),
          opt('一个模板、工具或 SOP', '适合做工具型小产品。', { delivery_feasibility: 68 }),
          opt('一个边界清楚的小服务包', '适合用交付结果验证商业化。', { delivery_feasibility: 76 })
        ], valueHint: '判断第一版产品假设' },
        { id: 'deliverableReadiness', label: '你现在有没有可交付成果？', type: 'seg', dimensions: ['delivery_feasibility','evidence_assets'], opts: [
          opt('没有', '知识还没有变成交付物。', { delivery_feasibility: 10, evidence_assets: 12 }),
          opt('有零散材料', '需要先整理成交付说明。', { delivery_feasibility: 34, evidence_assets: 34 }),
          opt('有清单、模板、SOP、报告或流程', '已经能进入小交付验证。', { delivery_feasibility: 68, evidence_assets: 64 }),
          opt('有标准交付说明和验收标准', '交付边界较清楚，可以进一步判断定价，以及是否适合预约职业经验资产一对一诊断。', { delivery_feasibility: 88, evidence_assets: 78 })
        ], valueHint: '知识不是产品，能交付的东西才是产品' },
        { id: 'careerVsProductization', label: '你现在最想解决哪类问题？', type: 'seg', dimensions: ['problem_clarity','reality_constraints'], opts: [
          opt('我主要想找工作、跳槽、转行', '这是职业再定位问题，不应直接商业化。', { problem_clarity: 42, reality_constraints: 46 }),
          opt('我想判断经验能否变成副业', '适合用完整自动报告先梳理路径与现实条件。', { problem_clarity: 58, reality_constraints: 58 }),
          opt('内容、咨询、知识产品和工具都想做', '方向过载，需要先裁剪第一路径。', { problem_clarity: 36, reality_constraints: 45 }),
          opt('我已经有交付，想标准化和产品化', '适合判断交付边界和产品化路径。', { problem_clarity: 72, reality_constraints: 68 }),
          opt('我已经有客户，想优化定价和增长', '已经进入经营系统判断。', { problem_clarity: 78, reality_constraints: 70 })
        ], valueHint: '先区分职业选择、经验产品化和增长优化，避免误判' },
        { id: 'organizationComplexity', label: '这个问题是否涉及组织决策？', type: 'seg', dimension: 'reality_constraints', opts: [
          opt('不涉及，主要是个人选择', '自动报告可以给出较清晰初筛。', { reality_constraints: 76 }),
          opt('部分涉及老板或团队', '需要把可控动作和不可控条件分开。', { reality_constraints: 56 }),
          opt('明显涉及公司战略、组织权责或资源', '自动报告要降低信心等级。', { reality_constraints: 36 }),
          opt('我没有决策权，只是推动者', '不能把组织问题当成个人商业化问题。', { reality_constraints: 24 })
        ], valueHint: '组织权责越复杂，自动报告越要保守' },
        { id: 'consumerAnxiety', label: '你现在做测评或咨询的主要动机是什么？', type: 'seg', dimensions: ['demand_signal','reality_constraints'], opts: [
          opt('我想先判断，不急着快速赚钱', '适合低成本判断。', { demand_signal: 62, reality_constraints: 72 }),
          opt('我怕选错方向，所以想同时试很多方向', '容易方向过载，需要先裁剪。', { demand_signal: 38, reality_constraints: 42 }),
          opt('因为年龄、AI 或别人成功，我很焦虑，想赶紧买答案', '要先止损，不建议高成本投入。', { demand_signal: 18, reality_constraints: 24 }),
          opt('我想快速赚钱，最好有人直接告诉我答案', '当前更适合先做低成本验证。', { demand_signal: 10, reality_constraints: 16 })
        ], valueHint: '这个问题用来保护你别被焦虑带着投入' },
        { id: 'deliveryResponsibility', label: '如果开始收费，你愿不愿意写清交付边界？', type: 'seg', dimension: 'delivery_feasibility', opts: [
          opt('还不想写清楚，只想先卖出去', '不适合收费，交付风险高。', { delivery_feasibility: 12 }),
          opt('愿意先写一版，但还不确定', '可以低成本试一次。', { delivery_feasibility: 46 }),
          opt('愿意写清交付物、不包含范围和验收标准', '具备小交付基础。', { delivery_feasibility: 78 })
        ], valueHint: '不愿对交付负责，就不适合做付费产品' },
        { id: 'serviceDataReadiness', label: '如果你已经有客户服务，是否记录经营数据？', type: 'seg', dimensions: ['delivery_feasibility','demand_signal'], opts: [
          opt('还没有客户或服务', '不按经营系统判断。', { delivery_feasibility: 44, demand_signal: 28 }),
          opt('有客户和交付，但没有复盘数据、转介绍记录或成交来源记录', '已有服务但经营系统弱。', { delivery_feasibility: 58, demand_signal: 62 }),
          opt('有客户数、转介绍、复购或成交来源记录', '可以进入服务边界和增长判断。', { delivery_feasibility: 82, demand_signal: 82 })
        ], valueHint: '已有服务的人，核心不是起步，而是经营系统' },
        { id: 'hours', label: '接下来每周能稳定投入多少小时？', type: 'range', min: 1, max: 40, step: 1, val: 8, dimensions: ['delivery_feasibility','reality_constraints'], valueHint: '时间太少就只能做轻验证' },
        { id: 'validationCommitment', label: '接下来 7 天，你愿意做到哪一步？', type: 'seg', dimensions: ['demand_signal','reality_constraints'], opts: [
          opt('暂时不想公开，也不想找人聊', '行动意愿不足，先不要收费。', { demand_signal: 8, reality_constraints: 16 }),
          opt('愿意发一条内容测试反馈', '可以做轻验证。', { demand_signal: 38, reality_constraints: 46 }),
          opt('愿意找 3 个人做问题访谈', '可以验证真实需求。', { demand_signal: 62, reality_constraints: 68 }),
          opt('愿意设计一次低门槛付费验证', '可以测试小交付或付费意向。', { demand_signal: 78, reality_constraints: 74 })
        ], valueHint: '行动意愿决定报告是否建议继续推进' }
      ]
    }
  ];

  function opt(label, note, scores) {
    return { label: label, value: label, t: label, d: note, scores: scores || {} };
  }

  function flattenFields() {
    var out = [];
    deepGroups.forEach(function(group) {
      (group.fields || []).forEach(function(field) { out.push(field); });
    });
    return out;
  }

  function findOption(field, value) {
    var picked = text(value);
    return (field.opts || []).find(function(option) {
      return text(option.value || option.t || option.label) === picked;
    });
  }

  function getConsultLevel(value) {
    var v = text(value);
    if (v.indexOf('经常') !== -1) return 3;
    if (v.indexOf('3-5') !== -1) return 2;
    if (v.indexOf('1-2') !== -1) return 1;
    return 0;
  }

  /* ---------- 需求信号等级：旧档优先，缺失时用 LIVE_FORM 可达字段自足 ----------
   * 问题（Round E 第 2 条）：`consultedBefore` 是旧档字段，真实新用户表单
   * **不采集它**（见 adaptive-diagnostic.js#ADAPTIVE_BASE_FIELD_IDS）。可是
   * seniorConsultReady 把它当成硬门槛 → 一个 5+ 案例、有外部证据、已付费的
   * 真实新用户会被永久降级成 paid_trial_ready，并被要求"先验证别人愿不愿意付钱"。
   *
   * 原则：**新用户的判断不能依赖用户根本无法填写的字段。**
   *
   * 读法分两层，且是"旧档优先"：
   *   1) `consultedBefore` 有回答 → 完全沿用 getConsultLevel，**行为与修复前逐位相同**；
   *   2) 缺失（= 真实新用户）→ 用可达字段推导同刻度的等级：
   *      · costWillingnessSignal 已经付费/复购/转介绍 —— 钱的流向比"问过"更硬 → 3
   *      · audienceAccess 触达条件 —— 与 consultedBefore 四档几乎同刻度（见 opt 打分：
   *        8/36/68/82 vs 12/42/68/84）→ 2 / 1 / 0
   *      · 兜底用 demand_signal 分数（8 题 + 深度表单合成的同一维度）
   *
   * 旧档优先是关键：A–K 等历史画像全都带 consultedBefore，因此
   * 本函数对它们返回的值与 getConsultLevel 完全一致 → **零回归**。
   * source 用于在报告里如实回显"依据的是哪一题"，避免又出现空文本条目。
   */
  function demandLevelDetail(d, scores) {
    d = d || {};
    var legacy = text(d.consultedBefore);
    if (legacy) {
      return { level: getConsultLevel(legacy), source: 'consultedBefore', option: legacy };
    }
    var cost = text(d.costWillingnessSignal);
    if (hasAny(cost, ['已经付费', '复购', '转介绍'])) {
      return { level: 3, source: 'costWillingnessSignal', option: cost };
    }
    var reach = text(d.audienceAccess);
    if (hasAny(reach, ['稳定私域', '公开内容渠道', '稳定客户来源'])) {
      return { level: 2, source: 'audienceAccess', option: reach };
    }
    if (hasAny(reach, ['少量熟人', '旧同事'])) {
      return { level: 1, source: 'audienceAccess', option: reach };
    }
    if (hasAny(reach, ['暂时找不到'])) {
      return { level: 0, source: 'audienceAccess', option: reach };
    }
    var ds = number(scores && scores.demand_signal, 0);
    if (ds >= 82) return { level: 3, source: 'demand_signal', option: '' };
    if (ds >= 62) return { level: 2, source: 'demand_signal', option: '' };
    if (ds >= 40) return { level: 1, source: 'demand_signal', option: '' };
    return { level: 0, source: '', option: '' };
  }

  function getDemandLevel(d, scores) {
    return demandLevelDetail(d, scores).level;
  }

  /* 每周可稳定投入少于 5 小时 = 时间条件不足。
   * 与 kevin-judgement.js#LOW_FEASIBLE_HOURS 同值（语义测试会断言两者相等）。 */
  var LOW_FEASIBLE_HOURS = 5;

  /* ---------- 唯一 canonical 付费状态（Round D 第 2 条） ----------
   * 全站只有这一处定义"付费真相"。规则引擎 decide() 与判断层
   * assets/assessment-v3/kevin-judgement.js 都消费它，不再各算各的。
   *
   * 尺度（**全站唯一**）：0 无真实付费 / 1 有 1 次真实付费 / 2 有 2-5 次 /
   * 3 已有可重复的付费（复购、续费、转介绍）。
   * 关键词匹配只作为「枚举之外的自由文本」兜底，不再用于枚举值本身。
   */
  var PAID_BEFORE_LEVEL_MAP = {
    '还没有付费记录': 0,
    '有1次付费尝试': 1,
    '有2-5次付费记录': 2,
    '已经有相对稳定的付费需求': 3
  };

  /* costWillingnessSignal 的真实枚举（两套表单各一组），值 = 付费等级。
   * 四类「愿意…」一律为 0 —— 意愿绝不产生付费证据。 */
  var COST_WILLINGNESS_PAID_MAP = {
    '没有': 0,
    '暂时没有发生': 0,
    '愿意继续聊': 0,
    '愿意试用或花时间配合': 0,
    '愿意投入时间或材料配合': 0,
    '已经付费、复购或转介绍': 3
  };

  /* 只有这两项是"明确否认发生过付费"。四类「愿意…」不是否认，
   * 只是"意愿不构成付费证据"——两者不能混为一谈，否则会把
   * 「有 1 次付费尝试 + 愿意继续聊」这种完全自洽的组合误判成冲突。 */
  var WILLINGNESS_PAYMENT_DENIAL = ['没有', '暂时没有发生'];

  function isPaymentDenial(value) {
    return WILLINGNESS_PAYMENT_DENIAL.indexOf(text(value)) !== -1;
  }

  function enumPayLevel(map, value) {
    var v = text(value);
    if (!v) return null;
    return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : null;
  }

  /* 自由文本 → 付费等级（仅在不是枚举值时作为补充证据） */
  function payLevelFromText(value) {
    var v = text(value);
    if (!v) return 0;
    if (hasAny(v, ['复购', '续费', '转介绍', '多次付费', '2-5', '稳定付费', '持续付费'])) return 3;
    if (hasAny(v, ['1次付费', '1 次付费', '付费尝试', '付过费', '买过', '购买过', '成交过'])) return 1;
    return 0;
  }

  function getPaidLevel(value) {
    var byMap = enumPayLevel(PAID_BEFORE_LEVEL_MAP, value);
    return byMap !== null ? byMap : payLevelFromText(value);
  }

  /* canonical 付费状态：**两题一起读**，不是各读各的。
   *
   * 冲突定义（两题都给出明确枚举，且一处说没有、另一处说有时才算）：
   *   paidBefore = 还没有付费记录  +  costWillingnessSignal = 已经付费、复购或转介绍
   *   paidBefore = 有付费          +  costWillingnessSignal = 没有 / 暂时没有发生
   * 冲突时不挑一个继续生成高置信判断：
   *   level 取**保守值 min**（不能凭一处就宣称收到过钱），
   *   并给出 conflict = true，交下游降 confidence、报告显式提示"需要确认"、
   *   且**不得进入系统放大期**（见 kevin-judgement.js#resolveStage）。
   */
  function resolvePaymentState(d) {
    d = d || {};
    var byPaid = enumPayLevel(PAID_BEFORE_LEVEL_MAP, d.paidBefore);
    var byWill = enumPayLevel(COST_WILLINGNESS_PAID_MAP, d.costWillingnessSignal);
    var paidLevel = byPaid !== null ? byPaid : payLevelFromText(d.paidBefore);
    var willLevel = byWill !== null ? byWill : payLevelFromText(d.costWillingnessSignal);

    var conflict =
      (byPaid === 0 && byWill === 3) ||
      (byPaid !== null && byPaid > 0 && isPaymentDenial(d.costWillingnessSignal));

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
      // 冲突时"能确认的事实"只能是两题都不反对的那一档（通常是 0）
      confirmedLevel: conflict ? Math.min(paidLevel, willLevel) : level,
      note: conflict ? paymentConflictNote(d) : ''
    };
  }

  function paymentConflictNote(d) {
    var a = text(d.paidBefore);
    var b = text(d.costWillingnessSignal);
    return '你在两处对"是否已经收到过钱"的回答互相矛盾：付费记录题选的是「'
      + a + '」，成本意愿题选的是「' + b + '」。'
      + '在你确认哪一处才是真实情况之前，这份报告**不把任何一处当作已发生的付费事实**，'
      + '也不会据此判断你能不能放大——请先确认付费信息，再重看这一部分。';
  }

  function hasAny(value, words) {
    var v = text(value);
    return (words || []).some(function(word) { return v.indexOf(word) !== -1; });
  }

  function getCaseLevel(d) {
    var detailed = text(d.caseCountDetailed);
    var basic = text(d.caseCount);
    if (hasAny(detailed + basic, ['5个以上', '可复用'])) return 3;
    if (hasAny(detailed + basic, ['3个'])) return 2;
    if (hasAny(detailed + basic, ['1个', '1-2'])) return 1;
    return 0;
  }

  function getEvidenceLevel(d) {
    var v = text(d.evidenceType || d.evidenceQuality);
    if (hasAny(v, ['付费', '转介绍', '结果证明', '客户反馈'])) return 3;
    if (hasAny(v, ['具体反馈', '结果截图'])) return 2;
    if (hasAny(v, ['自我描述'])) return 1;
    return 0;
  }

  function getCostSignalLevel(d) {
    var v = text(d.costWillingnessSignal || d.paidBefore);
    if (hasAny(v, ['复购', '转介绍', '稳定', '2-5', '已经付费'])) return 3;
    if (hasAny(v, ['花时间配合', '试用', '1次'])) return 2;
    if (hasAny(v, ['继续聊'])) return 1;
    return 0;
  }

  function getOrganizationLevel(d) {
    var v = text(d.organizationComplexity);
    if (hasAny(v, ['没有决策权'])) return 3;
    if (hasAny(v, ['明显涉及公司战略', '组织权责', '资源'])) return 2;
    if (hasAny(v, ['老板或团队'])) return 1;
    return 0;
  }

  function isCareerReposition(d) {
    return hasAny(d.careerVsProductization, ['找工作', '跳槽', '转行']);
  }

  function isDirectionOverload(d) {
    return hasAny(d.careerVsProductization, ['都想做']) ||
      hasAny(d.consumerAnxiety, ['同时试很多方向']) ||
      (hasAny(d.problemSpecificity, ['比较泛']) && hasAny(d.deliveryPreference, ['不确定']));
  }

  function isCautiousJudgement(d) {
    return hasAny(d.consumerAnxiety, ['先判断']) && hasAny(d.consumerAnxiety, ['不急着']);
  }

  function isQuickMoneyConsumer(d) {
    if (isCautiousJudgement(d)) return false;
    return hasAny(d.consumerAnxiety, ['我想快速赚钱', '直接告诉我答案']) ||
      hasAny(d.careerVsProductization, ['快速赚钱', '捷径', '直接告诉我答案']);
  }

  function isAnxietyConsumer(d) {
    if (isCautiousJudgement(d)) return false;
    return hasAny(d.consumerAnxiety, ['焦虑', '赶紧买答案', '直接告诉我答案']);
  }

  function isServiceSystemWeak(d) {
    var readiness = text(d.serviceDataReadiness);
    var explicitlyWeak = hasAny(readiness, ['没有复盘数据', '没有客户数', '没有转介绍', '没有成交来源', '没有沉淀', '没有数据']);
    var hasOperatingRecords = hasAny(readiness, ['有客户数', '有复购', '有转介绍', '有成交来源', '有服务数据']);
    return explicitlyWeak ||
      (hasAny(d.careerVsProductization, ['优化定价和增长']) && !hasOperatingRecords);
  }

  function hasStableServiceData(d) {
    return hasAny(d.serviceDataReadiness, ['有客户数', '有复购', '有转介绍', '有成交来源', '有服务数据']) ||
      hasAny(d.costWillingnessSignal, ['复购', '转介绍']);
  }

  function scoreHours(value) {
    var hours = number(value, 0);
    if (hours < 5) return { delivery_feasibility: 20, reality_constraints: 22 };
    if (hours < 10) return { delivery_feasibility: 46, reality_constraints: 52 };
    if (hours < 20) return { delivery_feasibility: 72, reality_constraints: 74 };
    return { delivery_feasibility: 82, reality_constraints: 78 };
  }

  function addScores(bucket, scores) {
    Object.keys(scores || {}).forEach(function(dimension) {
      if (!bucket[dimension]) bucket[dimension] = [];
      bucket[dimension].push(number(scores[dimension], 0));
    });
  }

  function scoreDimensions(data) {
    var fields = flattenFields();
    var bucket = {};
    fields.forEach(function(field) {
      if (field.scored === false) return;
      var value = data[field.id];
      if (field.id === 'hours') {
        addScores(bucket, scoreHours(value));
        return;
      }
      var option = findOption(field, value);
      if (option) addScores(bucket, option.scores);
    });

    var scores = {};
    dimensionOrder.forEach(function(dimension) {
      var values = bucket[dimension] || [];
      var avg = values.length ? values.reduce(function(sum, value) { return sum + value; }, 0) / values.length : 0;
      scores[dimension] = Math.round(Math.max(0, Math.min(100, avg)));
    });
    return scores;
  }

  function lowestDimension(scores) {
    var low = dimensionOrder[0];
    dimensionOrder.forEach(function(dimension) {
      if (scores[dimension] < scores[low]) low = dimension;
    });
    return low;
  }

  function getTypeKey(input) {
    return text(input && input.r && input.r.type) || 'content';
  }

  function inferProductRoute(input, scores) {
    var d = input.d || {};
    var preference = text(d.deliveryPreference);
    if (isCareerReposition(d)) return 'career_reposition';
    if (getOrganizationLevel(d) >= 2) return 'organization_map';
    if (preference.indexOf('诊断') !== -1) return 'consulting';
    if (preference.indexOf('报告') !== -1 || preference.indexOf('自学') !== -1 || preference.indexOf('清单') !== -1) return 'knowledge';
    if (preference.indexOf('模板') !== -1 || preference.indexOf('SOP') !== -1) return 'template';
    if (preference.indexOf('服务包') !== -1) return 'service';
    if (scores.problem_clarity >= 65 && scores.demand_signal >= 55) return 'consulting';
    return getTypeKey(input);
  }

  /* ---------- not_fit_now 的 cause（Round D 第 1 条） ----------
   * not_fit_now 现在把四类完全不同的原因合并成同一个 status：
   *   经验不足 / 问题不清 / 现实可行性不足 / 需求不足且不愿验证，
   * 再加上一个"焦虑消费"。
   * 下游如果只看 status，就会一律输出"补案例、补真实问题"——
   * Case K（经验 90 / 问题 88 / 证据 86 / 已有 5+ 案例 / 有付费，
   * 唯一触发条件是 reality_constraints < 25）会被明确错误地告知
   * "最缺的是可复述的真实案例"。
   * 因此 decide() 返回 not_fit_now 时**必须同时给出 cause**，
   * 所有下游（currentAction / actionReason / 免费摘要 / dontDoNow /
   * buildProductHypothesis / buildSevenDayPlan / 最终决定）都按 cause 取文案。
   *
   * 优先级：越靠前越"底层"——连素材都没有的人，先谈素材；
   * 素材齐了才轮到现实条件、需求与意愿。同一个人可能命中多条，
   * 全部记在 causes 里（机器可读），但只有一个 primary cause 驱动文案。
   */
  var NOT_FIT_CAUSE_ORDER = [
    'low_experience',
    'low_problem_clarity',
    'low_reality',
    'low_demand_and_unwilling',
    'anxiety_consumer'
  ];

  var NOT_FIT_CAUSE_PROFILE = {
    low_experience: {
      label: '案例素材不足',
      action: '先补出第一件说清「问题—动作—结果」的真实案例',
      kind: 'prepare',
      actionReason: '因为你现在还没有一件能讲清的真实案例，这时候做定位、做产品或买课都缺少判断基础。',
      gapText: '一件能说清「问题—动作—结果」的真实案例',
      dontDo: '暂不建议先付高价咨询或买系统课',
      dontDoWhy: '因为你现在缺的是第一件真实素材，不是更多方法。',
      summary: '当前最重要的不是包装、系统投入或立刻做产品，而是先补经验案例。'
    },
    low_problem_clarity: {
      label: '问题还不够清楚',
      action: '先把"帮谁解决什么问题"收窄到一类人和一个具体问题',
      kind: 'prepare',
      actionReason: '因为你还说不清帮谁解决什么，这时候做产品定义或对外表达，别人听不懂，反馈就只会停在礼貌夸奖。',
      gapText: '一类明确的人，以及他们反复遇到的一个具体问题',
      dontDo: '暂不建议先做主页包装、定位改版或产品上架',
      dontDoWhy: '因为问题不窄，包装越精致越容易吸引到不匹配的人。',
      summary: '当前最重要的不是包装或投入，而是先把问题收窄。'
    },
    low_reality: {
      label: '现实可行性不足',
      action: '先解决时间、验证对象和验证意愿这三件现实条件',
      kind: 'prepare',
      actionReason: '因为你的经验、案例和证据已经成立，真正卡住你的是现实可行性：',
      gapText: '每周可稳定投入的时间、能验证的真实对象、以及你继续验证的意愿',
      dontDo: '暂不建议在现实条件改善前扩大投入',
      dontDoWhy: '因为现实条件不改善，投入越多越容易停在原地，时间和钱都会沉在里面。',
      summary: '业务证据已经成立，当前限制是现实可行性。'
    },
    low_demand_and_unwilling: {
      label: '需求信号不足且不愿验证',
      action: '先找一个愿意讲真话的人，确认这个问题是否真实存在',
      kind: 'validate',
      actionReason: '因为目前既看不到需求信号，你也不打算做验证——此时任何投入都无法被证实或证伪。',
      gapText: '至少一次真实的需求确认（有人愿意说出自己的场景）',
      dontDo: '暂不建议在没有任何真实反馈前加大投入',
      dontDoWhy: '因为没有验证动作，投入只会变成单向消耗。',
      summary: '当前既缺少需求信号，也缺少验证意愿。'
    },
    anxiety_consumer: {
      label: '更像被焦虑推动，而不是已有素材',
      action: '先止损：暂停购买课程、工具和咨询',
      kind: 'prepare',
      actionReason: '因为当前更像被焦虑推动，而不是已经有案例、证据和验证动作——先止损比补素材更紧急。',
      gapText: '真实案例，以及愿意配合验证的对象',
      dontDo: '暂不建议买咨询、工具或课程',
      dontDoWhy: '因为焦虑驱动的购买不会带来素材，只会增加沉没成本。',
      summary: '当前最该省的是试错成本。'
    },
    /* 第 2 条专用：付费记录题与成本意愿题互相矛盾。
     * 它不是 not_fit_now 的第 6 种原因，而是"当前状态判定被阻塞"，
     * 因此不在 NOT_FIT_CAUSE_ORDER 里参与排序，只作为独立 profile 使用。 */
    payment_unconfirmed: {
      label: '付费信息需要确认',
      action: '先确认哪一处付费回答是真实情况',
      kind: 'prepare',
      actionReason: '因为你在"付费记录"和"成本意愿"两题上的回答互相矛盾，必须先确认真实情况，才能判断你处在早期验证还是已经可以放大。',
      gapText: '一份前后一致的付费事实（真实付费次数，或真实的成本意愿）',
      dontDo: '暂不建议依据当前付费信息扩大投入',
      dontDoWhy: '因为付费阶段此刻是未知的，基于未知阶段的任何投入判断都不可靠。',
      summary: '当前不是缺案例，而是付费信息自相矛盾，需要先确认。'
    }
  };

  function resolveNotFitCause(scores, d, validation) {
    var s = scores || {};
    var v = text(validation);
    var hasUnwilling = v.indexOf('不想') !== -1;
    var fired = [];
    if (number(s.experience_depth, 0) < 35) fired.push('low_experience');
    if (number(s.problem_clarity, 0) < 35) fired.push('low_problem_clarity');
    if (number(s.reality_constraints, 0) < 25) fired.push('low_reality');
    if (number(s.demand_signal, 0) < 18 && hasUnwilling) fired.push('low_demand_and_unwilling');
    if (isAnxietyConsumer(d) && hasUnwilling) fired.push('anxiety_consumer');

    var ordered = NOT_FIT_CAUSE_ORDER.filter(function(c) { return fired.indexOf(c) !== -1; });
    var cause = ordered[0] || 'low_experience';
    return {
      cause: cause,
      causes: ordered,
      profile: NOT_FIT_CAUSE_PROFILE[cause],
      triggerText: ordered.map(function(c) { return NOT_FIT_CAUSE_PROFILE[c].label; }).join('、')
    };
  }

  /* decide() 只做一件事：把**同一份**付费真相与 cause 注入决策结果，
   * 保证下游拿到的不是一个孤零零的 status。 */
  function decide(input, scores) {
    var d = input.d || {};
    var payment = resolvePaymentState(d);
    var notFit = resolveNotFitCause(scores, d, d.validationCommitment);
    var decision = decideFrom(input, scores, payment, notFit);
    decision.paymentState = payment;
    decision.paymentConflict = !!payment.conflict;
    /* Round E 第 2 条：需求等级的来源（consultedBefore 旧档 / 可达字段推导）
     * 一并交出去，判断层与渲染层"同源消费"，不再各自重算一遍。 */
    decision.demandLevel = demandLevelDetail(d, scores);
    decision.dimensionScores = scores;
    if (decision.status === 'not_fit_now') decision.causeProfile = notFit.profile;
    return decision;
  }

  function decideFrom(input, scores, payment, notFit) {
    var d = input.d || {};
    /* Round E 第 2 条：需求门槛不再读不可达字段。旧档有 consultedBefore 时
     * 返回值与旧行为完全一致（零回归）；真实新用户用可达字段自足推导。 */
    var demand = demandLevelDetail(d, scores);
    var consultLevel = demand.level;
    // 付费真相只有一处：resolvePaymentState() 的 canonical 结果（Round D 第 2 条）
    var paidLevel = payment.level;
    var validation = text(d.validationCommitment);
    var route = inferProductRoute(input, scores);
    var preference = text(d.deliveryPreference);
    var hours = number(d.hours, 0);
    var organizationLevel = getOrganizationLevel(d);

    /* 付费信息冲突（Round D 第 2 条）必须排在最前：
     * 后面每一条分支都要用到"你处在哪个付费阶段"，而这一项此刻是未知的。
     * 不允许"挑一个字段继续生成高置信判断"——所以这里直接给保守结论，
     * 并把 cause 交出去，让下游只说"先确认付费信息"。 */
    if (payment.conflict) {
      return {
        status: 'payment_unconfirmed',
        label: '付费信息待确认',
        title: '先确认付费信息，再判断下一步',
        summary: '你在付费记录题和成本意愿题上的回答互相矛盾，报告无法据此判断你处在早期验证还是已经可以放大。'
          + '先确认哪一处才是真实情况，这一部分会重新计算。',
        cause: 'payment_unconfirmed',
        causes: ['payment_unconfirmed'],
        causeProfile: NOT_FIT_CAUSE_PROFILE.payment_unconfirmed
      };
    }

    if (isCareerReposition(d)) {
      return {
        status: 'career_reposition_first',
        label: '先做职业再定位',
        title: '你现在先判断职业路径，不要急着商业化',
        summary: '你的核心问题更像岗位、转型、现金流和可迁移能力判断。先把主业路径、现实约束和低成本验证看清楚，再决定是否把经验做成产品。'
      };
    }

    if (organizationLevel >= 2) {
      return {
        status: 'organization_complexity',
        label: '组织问题需要人工判断',
        title: '这不是你一个人努力就能解决的问题',
        summary: '你的问题涉及公司战略、权责、资源或老板节奏。自动报告只能帮你先拆可控动作和风险，不能给唯一方案。'
      };
    }

    if (isServiceSystemWeak(d) && paidLevel >= 2) {
      return {
        status: 'service_system_weak',
        label: '已有服务但经营系统弱',
        title: '你不是没有产品，而是经营记录和复盘系统还不够',
        summary: '你已经有客户或交付，但客户数、转介绍、复购、交付时长和成交来源还没有沉淀。下一步先补经营系统，再谈放大。'
      };
    }

    if (isDirectionOverload(d)) {
      return {
        status: 'direction_overload',
        label: '先裁剪第一路径',
        title: '你不是缺机会，而是同时打开了太多方向',
        summary: '内容、咨询、知识产品、工具和服务都想做时，最容易每条路都只做到一半。现在先选一个人群、一个问题、一个交付。'
      };
    }

    if (isAnxietyConsumer(d) && validation.indexOf('不想') !== -1) {
      /* cause 优先取更底层的原因：焦虑只是"为什么该停"，
       * 真正缺什么由 cause 决定（否则又会退回"统一说缺案例"）。 */
      return {
        status: 'not_fit_now',
        label: '先止损，不建议投入',
        title: '你现在最该省的是试错成本',
        summary: '当前更像被焦虑推动，而不是已经有案例、证据和验证动作。先不要买咨询，也不要买工具和课程，先补真实案例和验证对象。',
        cause: notFit.cause,
        causes: notFit.causes,
        causeProfile: notFit.profile
      };
    }

    if (
      scores.experience_depth < 35 ||
      scores.problem_clarity < 35 ||
      scores.reality_constraints < 25 ||
      (scores.demand_signal < 18 && validation.indexOf('不想') !== -1)
    ) {
      /* 四类原因共用一个 status，因此必须把 cause 一起带出去。
       * 下游按 cause 分支取文案，不再统一说"补案例/补真实问题"。 */
      return {
        status: 'not_fit_now',
        label: '暂时不适合做',
        title: '你现在先别急着做个人经验商业化',
        summary: notFit.profile
          ? '当前限制是「' + notFit.profile.label + '」。' + notFit.profile.summary
          : '当前最重要的不是包装、系统投入或立刻做产品，而是先补经验案例、明确问题和找到真实验证对象。',
        cause: notFit.cause,
        causes: notFit.causes,
        causeProfile: notFit.profile
      };
    }

    if (scores.evidence_assets < 35 && scores.experience_depth >= 45) {
      return {
        status: 'extract_cases_first',
        label: '先萃取案例',
        title: '你不是没有经验，是证据还没有变成可判断的案例',
        summary: '你的年限和经历可能有价值，但客户现在看不到可信证据。先把 3 个真实案例拆清楚，再决定做内容、咨询、知识产品还是服务。'
      };
    }

    var seniorConsultReady =
      paidLevel >= 3 &&
      consultLevel >= 3 &&
      getCaseLevel(d) >= 3 &&
      getEvidenceLevel(d) >= 3 &&
      getCostSignalLevel(d) >= 3 &&
      hasStableServiceData(d) &&
      scores.problem_clarity >= 65 &&
      scores.reality_constraints >= 45 &&
      hours >= 5;

    if (
      seniorConsultReady ||
      paidLevel >= 2 &&
      consultLevel >= 2 &&
      scores.demand_signal >= 70 &&
      scores.evidence_assets >= 60 &&
      scores.problem_clarity >= 65 &&
      scores.delivery_feasibility >= 60 &&
      scores.reality_constraints >= 45
    ) {
      return {
        status: 'consult_ready',
        label: '适合进入后续定制判断',
        title: '你已经适合把路径和交付边界定下来',
        summary: '你已经有经验、证据和付费/咨询信号。下一步不是继续泛泛学习，而是把第一路径、第一案例、第一版交付和定价边界定清楚。'
      };
    }

    /* 付费信息冲突时不允许走到这里：该分支的措辞会声称"已经出现付费信号"，
     * 而 canonical 状态此刻恰恰是"付费未确认"。 */
    if (
      !payment.conflict && (
        paidLevel >= 1 ||
        (consultLevel >= 2 && validation.indexOf('低门槛付费') !== -1 && scores.problem_clarity >= 60 && scores.evidence_assets >= 50 && scores.delivery_feasibility >= 50)
      )
    ) {
      return {
        status: 'paid_trial_ready',
        label: '可以做低价试单或小交付',
        title: '你可以进入低价试单，建议先写清交付边界',
        summary: '你已经出现咨询或早期付费信号，但还没到稳定放大的阶段。先做一次边界清楚的小交付，验证客户是否愿意为具体问题付钱。'
      };
    }

    if (scores.demand_signal < 40 && paidLevel === 0 && consultLevel === 0) {
      return {
        status: 'validate_first',
        label: '先低成本验证',
        title: '你有案例，但还没有市场信号',
        summary: '现在不能直接假设别人愿意付费。先用 7 天验证一个具体问题，确认有人愿意继续聊、给反馈或投入小成本。'
      };
    }

    if (route === 'content') {
      return {
        status: 'content_probe',
        label: '适合先做内容探测',
        title: '先用内容找到第一批真实问题',
        summary: '你的表达路径更轻，适合先用案例和观点测试反馈。内容不是终点，而是低成本发现问题和信任入口的工具。'
      };
    }

    if (route === 'knowledge') {
      return {
        status: 'knowledge_product_fit',
        label: '适合知识产品验证',
        title: '先把经验做成一份低成本判断材料',
        summary: '你的经验更适合沉淀成报告、清单或自学材料。关键不是堆资料，而是让别人用它少走弯路。'
      };
    }

    if (route === 'template') {
      return {
        status: 'template_tool_fit',
        label: '适合模板工具验证',
        title: '先做一个能直接使用的小工具',
        summary: '你的经验可以被拆成模板、SOP 或检查清单。工具最好服务一个具体场景，否则容易变成没人使用的资料。'
      };
    }

    if (route === 'service' && hours >= 5) {
      return {
        status: 'service_delivery_fit',
        label: '适合小服务交付',
        title: '先用边界清楚的小服务换反馈',
        summary: '你的经验可以先变成一个小服务包。关键是写清交付物、周期、不包含范围和验收标准。'
      };
    }

    if (route === 'consulting' || preference.indexOf('诊断') !== -1) {
      return {
        status: 'consulting_diagnosis_fit',
        label: '适合咨询诊断验证',
        title: '你的价值更像判断力和问题拆解',
        summary: '你适合先做一次边界清楚的问题诊断，验证客户是否愿意为判断和下一步动作付费。'
      };
    }

    return {
      status: 'validate_first',
      label: '先低成本验证',
      title: '你可以验证，但不应该大额投入或直接做重产品',
      summary: '你有一定经验基础，但需求信号和证据还不够硬。先用 7 天验证一个具体问题，确认有人愿意继续聊、给反馈或投入小成本。'
    };
  }

  function buildConfidence(input, scores, decision, diagnosticStatus, informationGaps) {
    var d = input.d || {};
    var confidence = number(d.confidence, 0);
    /* 付费信息自相矛盾时，不能给出高置信的商业判断 —— 先降级并要求确认。 */
    if (decision.paymentConflict) {
      return {
        level: 'low',
        label: '结论可信度：低',
        reason: '你在付费记录题和成本意愿题上的回答互相矛盾，报告无法据此判断你处在哪一阶段。'
          + '在确认付费信息之前，这份报告只给保守判断，不判断能不能放大。'
      };
    }
    if (
      decision.status === 'not_fit_now' ||
      diagnosticStatus === 'not_ready' ||
      diagnosticStatus === 'evidence_missing' ||
      (informationGaps && informationGaps.length >= 3) ||
      scores.evidence_assets < 30 ||
      (confidence >= 8 && scores.evidence_assets < 45 && scores.demand_signal < 45)
    ) {
      return {
        level: 'low',
        label: '结论可信度：低',
        reason: '当前证据不足，或主观信心高于外部反馈。报告只能给出止损和验证动作，不能直接给你定制商业方案。'
      };
    }
    if (
      diagnosticStatus === 'organization_complexity' ||
      diagnosticStatus === 'career_reposition_first' ||
      diagnosticStatus === 'direction_overload'
    ) {
      return {
        level: 'medium',
        label: '结论可信度：中',
        reason: '你的问题涉及职业选择、组织权责或方向裁剪，自动报告只能给保守判断，不能替你做最终决策。'
      };
    }
    if (
      decision.status === 'consult_ready' ||
      (decision.status === 'paid_trial_ready' && scores.evidence_assets >= 60 && scores.demand_signal >= 60)
    ) {
      return {
        level: 'high',
        label: '结论可信度：高',
        reason: '你的回答里已经出现较明确的案例、证据、咨询或付费信号，报告可以给出更具体的商业化下一步。'
      };
    }
    return {
      level: 'medium',
      label: '结论可信度：中',
      reason: '你有一定经验和验证可能，但仍需要把判断从自我感觉推进到真实对话、反馈或试单。'
    };
  }

  function dimensionLabel(key) {
    return diagnosticDimensions[key] || key;
  }

  function buildEvidence(input, scores, decision) {
    var d = input.d || {};
    var low = lowestDimension(scores);
    var years = text(d.years);
    var caseCount = text(d.caseCount);
    var consultedBefore = text(d.consultedBefore);
    var paidBefore = text(d.paidBefore);
    var evidence = [
      '你的当前决策结论是「' + decision.label + '」，这不是人格分类，而是判断你现在应不应该继续投入时间和钱。',
      '六个维度里最低的是「' + dimensionLabel(low) + '」，说明真正卡点不在信息量，而在这个商业化前提还没被证明。'
    ];
    if (years || caseCount) {
      var experienceParts = [];
      if (years) experienceParts.push('经验年限是「' + years + '」');
      if (caseCount) experienceParts.push('案例数量是「' + caseCount + '」');
      evidence.push('你填写的' + experienceParts.join('，') + '，决定报告先看经验厚度和证据，而不是直接做包装。');
    } else {
      evidence.push('本次缺少经验年限和案例数量，报告不会把空字段当成判断依据，所以结论会更偏保守。');
    }
    if (consultedBefore || paidBefore) {
      var signalParts = [];
      if (consultedBefore) signalParts.push('咨询信号是「' + consultedBefore + '」');
      if (paidBefore) signalParts.push('付费信号是「' + paidBefore + '」');
      evidence.push('你的需求信号里，' + signalParts.join('，') + '，它们决定是否能进入试单或后续定制判断。');
    } else {
      evidence.push('本次没有提供咨询或付费信号，报告会先按低成本验证处理，不会假设你已经有客户需求。');
    }
    if (decision.status === 'not_fit_now') {
      var nfProfile = decision.causeProfile;
      if (nfProfile && decision.cause === 'low_reality') {
        evidence.push('当前建议暂缓投入：卡住你的**不是**经验、案例或证据（这些你已经具备），而是「'
          + nfProfile.label + '」——时间、验证对象或验证意愿。');
      } else if (nfProfile) {
        evidence.push('当前建议暂缓投入：真正卡住你的是「' + nfProfile.label + '」。');
      } else {
        evidence.push('当前建议暂缓投入：经验、问题、验证对象或行动意愿至少有一项明显不足。');
      }
    }
    else if (decision.status === 'consult_ready') evidence.push('当前可以继续推进，是因为你已经具备较强的需求、证据和付费基础。');
    else evidence.push('当前建议低成本推进，是因为方向有机会，但仍缺少足够硬的付费或复购证据。');
    return evidence;
  }

  function buildStopRules(input, scores, decision) {
    var rules = [];
    var nfProfile = decision && decision.causeProfile;
    if (scores.experience_depth < 45) rules.push('如果你拿不出至少 3 个真实案例，先不要做复杂产品、社群或高价服务。');
    if (scores.problem_clarity < 55) rules.push('如果你说不清帮谁解决什么问题，先不要做定位包装、主页改版或产品上架。');
    if (scores.evidence_assets < 50) rules.push('如果没有外部反馈、结果证据或可展示材料，先不要收高价。');
    if (scores.demand_signal < 50) rules.push('如果没人愿意继续聊具体问题，不要为这个方向继续花钱加码。');
    if (scores.reality_constraints < 45) rules.push('如果每周投入不足或行动意愿太低，只做轻验证，不做重服务。');
    if (decision.status !== 'consult_ready') {
      // 暂停线的落点必须与 cause 一致：不该让"现实可行性不足"的人"回到经验萃取"
      rules.push(nfProfile && decision.cause === 'low_reality'
        ? '如果现实条件（时间、验证对象、验证意愿）在 30 天内没有改善，就停在当前规模，不要扩大投入——你的经验素材本身不是问题。'
        : '如果 7 天内没有真实对话、追问、反馈或试单，停止产品化，回到经验萃取。');
    }
    if (decision.status === 'consult_ready') rules.push('后续定制判断只适合用来定制路径、案例、定价和交付边界，不替代你后续真实交付。');
    rules.push('如果交付物、不包含范围和判断标准没有写清，先不要正式提高价格。');
    if (rules.length < 2) rules.push('如果没有至少 3 个真实反馈样本，不要把一次自我判断当成长期定位。');
    return rules.slice(0, 6);
  }

  function offerMap(route) {
    var map = {
      content: {
        target: '过去问过你类似问题的同事、同行或转型中的朋友',
        problem: '他们不知道某个具体选择该怎么判断，容易被信息和情绪带着走。',
        offer: '3 条问题型内容 + 1 次评论/私聊反馈整理',
        boundary: '只验证问题是否成立，不承诺替对方做完整方案。'
      },
      consulting: {
        target: '已经带着真实问题来问你判断和建议的人',
        problem: '他们卡在选择、误区和下一步动作，不缺资料，缺判断。',
        offer: '一次 45-60 分钟问题拆解或路径诊断',
        boundary: '只判断路径、卡点和下一步，不做长期陪聊和无限答疑。'
      },
      knowledge: {
        target: '愿意自学判断，但不想一上来花上万元系统投入的人',
        problem: '他们想先理解底层逻辑，判断自己是否值得继续投入。',
        offer: '一份低价自学包、误区清单或专题报告',
        boundary: '提供判断框架和材料路线，不替他定制个人方案。'
      },
      template: {
        target: '已经有具体任务，但不知道怎么拆步骤的人',
        problem: '他们需要一个能直接照着用的模板、清单或 SOP。',
        offer: '一个一页纸模板、检查清单或 SOP',
        boundary: '只解决一个具体场景，不做大而全工具库。'
      },
      service: {
        target: '愿意为明确结果付费，但不想自己摸索执行的人',
        problem: '他们知道问题存在，但缺少可交付的执行支持。',
        offer: '一个边界清楚的小服务包',
        boundary: '写清交付物、次数、周期和不包含范围，避免什么都接。'
      }
    };
    return map[route] || map.content;
  }

  function buildProductHypothesis(input, scores, decision) {
    var route = inferProductRoute(input, scores);
    var base = offerMap(route);
    if (decision.status === 'not_fit_now') {
      /* 按 cause 分支 —— 现实可行性不足的人，假设卡不能是"补经验案例"。 */
      if (decision.cause === 'low_reality') {
        return {
          targetCustomer: '先不要新增陌生开发；只找你**已经能直接联系上**的人，而且这一轮只找 1 个。',
          problemScene: '当前要确认的不是产品，而是你能不能在自己的时间、验证对象和意愿条件下，把一次最小验证真的做完。',
          firstOffer: '一次最小验证动作：1 个人 / 1 个问题 / 15 分钟',
          validationPrice: '暂不收费，这一轮先解决现实条件',
          deliveryBoundary: '不承诺任何交付物，只确认时间、对象和意愿这三件事是否具备。',
          continueSignal: '每周能稳定投入 ' + LOW_FEASIBLE_HOURS + ' 小时以上，并且真的完成了至少 1 次真实对话。',
          stopSignal: '如果时间、对象或意愿两周内没有改善，先不扩大任何投入——你的经验素材本身不是问题。'
        };
      }
      if (decision.cause === 'low_problem_clarity') {
        return {
          targetCustomer: '先不要假设陌生客户，从你已经能直接联系上的人里挑一类。',
          problemScene: '当前要确认的是"到底是谁、在什么场景下、反复遇到哪一个具体问题"，而不是能不能做一个产品。',
          firstOffer: '一句话问题描述 + 3 次确认',
          validationPrice: '暂不收费，先换真实反馈',
          deliveryBoundary: '只收集问题和原话，不承诺解决方案。',
          continueSignal: '至少 3 个人能用他们自己的说法复述这个问题。',
          stopSignal: '如果对方听完只能给出礼貌性回应，说明问题还没收窄。'
        };
      }
      return {
        targetCustomer: '先不要假设陌生客户，先从 3 个熟人、旧同事或同行里找真实问题。',
        problemScene: '你现在要验证的是别人是否真的会因为某个问题来问你，而不是验证你能不能做一个产品。',
        firstOffer: '3 个经验案例拆解 + 1 条问题验证内容',
        validationPrice: '暂不收费，先换真实反馈',
        deliveryBoundary: '只收集问题和反馈，不承诺解决方案。',
        continueSignal: '至少 3 个人能说出具体问题，并愿意继续聊自己的情况。',
        stopSignal: '如果 7 天内连 3 个具体问题都找不到，停止产品化。'
      };
    }
    return {
      targetCustomer: base.target,
      problemScene: base.problem,
      firstOffer: decision.status === 'consult_ready' ? '一次个人经验路径诊断' : base.offer,
      validationPrice: decision.status === 'consult_ready' ? '按你的目标客户重新定价，先做后续定制判断' : (decision.status === 'paid_trial_ready' ? '99-299 元，先做边界清楚的小交付' : '0-99 元，先验证意愿，不追求收入'),
      deliveryBoundary: base.boundary,
      continueSignal: decision.status === 'consult_ready' ? '对方愿意提交真实经历、案例材料，并预约后续定制判断。' : '至少 3 个人给出具体场景、继续追问，或愿意投入时间/小额费用。',
      stopSignal: '如果反馈只停留在点赞、客气夸奖，没有具体问题和继续动作，暂时不要加码。'
    };
  }

  /* ---------- 7 天计划：第 1 天必须由**真实案例状态 / 主卡点**决定 ----------
   * Round D 第 3 条。旧版对所有人固定输出"第 1 天：写出 3 个真实经验案例"，
   * 结果 Case C / I（已有 5+ 案例、已有稳定付费）和 Case K（5+ 案例、
   * 现实可行性 22 分）都被要求"写 3 个案例"——与报告自己给出的主卡点自相矛盾。
   * 现在的分档（从"最缺"到"最不缺"）：
   *   0 个案例      → 写第一件完整案例
   *   1 个案例      → 补到 3 个
   *   3-4 个案例    → 从已有案例里挑最强的一个去做验证
   *   5+ / 已有付费 → 不再要求补案例，直接针对当前真实主卡点行动
   *   现实可行性不足 → 第一天先解决现实条件（时间 / 验证对象 / 验证意愿）
   */
  function sevenDayDayOne(input, scores, decision) {
    var d = input.d || {};
    var caseLevel = getCaseLevel(d);
    var pay = decision.paymentState || resolvePaymentState(d);
    var paidLevel = pay.level;
    var lowest = lowestDimension(scores);
    var lowestLabel = dimensionLabel(lowest);

    if (decision.cause === 'low_reality') {
      return {
        mode: 'reality',
        day: {
          day: '第 1 天',
          title: '先解决现实可行性：时间 / 验证对象 / 验证意愿',
          action: '只写三行：每周能稳定投入几小时、能直接联系上谁、愿不愿意做完一次 15 分钟验证。'
            + '三个里缺哪个就先补哪个；时间和对象不够时，不要新增任何投入，也不要先做产品。'
        }
      };
    }
    if (caseLevel === 0) {
      return {
        mode: 'case_0',
        day: {
          day: '第 1 天',
          title: '写出第一件完整案例',
          action: '只写 1 件：问题是什么、你怎么判断、你做了什么、结果是什么。'
            + '写不出结果就写对方的原话反馈。一件就够，不要凑数量。'
        }
      };
    }
    if (caseLevel === 1) {
      return {
        mode: 'case_1',
        day: {
          day: '第 1 天',
          title: '把案例从 1 个补到 3 个',
          action: '再补 2 件，每件只保留问题、判断、动作、结果。三件要来自不同场景，不要反复讲同一件事。'
        }
      };
    }
    if (caseLevel === 2) {
      return {
        mode: 'case_3',
        day: {
          day: '第 1 天',
          title: '从已有案例里选出最强的一个',
          action: '在你能拿出的案例里，挑最有实际结果、最接近目标客户场景的那一个，'
            + '用一句话写出"谁、什么问题、结果如何"。这一周只验证这一个，不新增案例。'
        }
      };
    }
    /* 5+ 案例 或 已有真实付费：补案例不再是瓶颈，第 1 天直接处理真实主卡点。 */
    return {
      mode: paidLevel >= 1 ? 'paid' : 'case_5plus',
      day: {
        day: '第 1 天',
        title: '不再补案例，直接处理当前主卡点：' + lowestLabel,
        action: '你已经能拿出 ' + (getCaseLevel(d) >= 3 ? '5 个以上' : '多个') + '案例'
          + (paidLevel >= 1 ? '，也已经有真实付费' : '')
          + '，补案例不再是你的瓶颈。六维里最低的是「' + lowestLabel + '」（'
          + Math.round(Number(scores[lowest]) || 0) + ' 分）——第一天把时间全部用在这一项上，'
          + '不要再花时间整理已经有的素材。'
      }
    };
  }

  function sevenDayPlanForReality() {
    return [
      { day: '第 1 天', title: '先解决现实可行性：时间 / 验证对象 / 验证意愿', action: '只写三行：每周能稳定投入几小时、能直接联系上谁、愿不愿意做完一次 15 分钟验证。三个里缺哪个就先补哪个。' },
      { day: '第 2 天', title: '把验证动作压到"一定做得完"的规模', action: '只保留：1 个人、1 个问题、15 分钟。把规模压到即使这一周很忙也做得完为止。' },
      { day: '第 3 天', title: '联系那 1 个人（只联系 1 个）', action: '不发公开内容、不做陌生开发，只找一个你已经能直接联系上的人，约一次 15 分钟。' },
      { day: '第 4 天', title: '把这次对话记成三行', action: '他的原话问题、他现在的处理方式、他是否愿意继续。记不下来就说明这次对话没发生。' },
      { day: '第 5 天', title: '复盘卡在哪一项', action: '这次验证没做完的话，卡在时间、验证对象还是意愿？把卡住的那一项写清楚。' },
      { day: '第 6 天', title: '针对卡住的那一项做一个具体调整', action: '换一个时间段、换一个更容易联系的人，或把要求再降低一档。只调一项，不要同时改三件。' },
      { day: '第 7 天', title: '做继续/暂停判断', action: '现实条件（时间、验证对象、验证意愿）没有改善，就停在当前规模，不扩大投入。你的经验素材本身不是问题。' }
    ];
  }

  /* 付费信息冲突专用 7 天（Round D 第 2 条）：
   * 报告其余部分已经在说"先确认付费信息，否则 30 天判断不成立"，
   * 如果第 1 天还去处理别的卡点，就等于同一份报告给两个第一优先。
   * 这里让第 1 天与决策层、30 天判断保持同一件事。 */
  function sevenDayPlanForPaymentConflict() {
    return [
      { day: '第 1 天', title: '先确认付费信息：付费记录题与成本意愿题哪一处才是真实情况', action: '只做一件事：找出真实发生过的那一笔（转账、收据、复购或转介绍成交都算）。真的没有，就明确写"没有"。' },
      { day: '第 2 天', title: '按确认后的真实情况改回一处', action: '把付费记录题或成本意愿题改成真实的那一版，不要两处都留。付费阶段确定后，下面的判断会重新计算。' },
      { day: '第 3 天', title: '用已有案例做一次真实对话', action: '用你已经能拿出的案例开头，只问对方最近是否遇到过同样的问题，不重新整理材料。' },
      { day: '第 4 天', title: '记录原话与卡点', action: '每个人只记三行：他的原话问题、他现在的处理方式、他是否愿意继续。' },
      { day: '第 5 天', title: '写出第一版最小交付', action: '在付费信息确认之后再定交付形态；这一天只写"不包含什么"，先把边界写清。' },
      { day: '第 6 天', title: '记录一次真实付费意向信号', action: '只观察，不推销：对方是否愿意为具体结果投入时间、反馈或费用，如实记下来。' },
      { day: '第 7 天', title: '做继续/暂停判断', action: '付费信息没有确认之前，不要按"可以放大"或"必须从零开始"任何一侧行动。' }
    ];
  }

  function buildSevenDayPlan(input, scores, decision) {
    var hypothesis = buildProductHypothesis(input, scores, decision);
    var dayOne = sevenDayDayOne(input, scores, decision);
    var paidAction = decision.status === 'consult_ready'
      ? '整理 3 个代表性案例和你想判断的第一路径，准备后续定制判断材料。'
      : '向有具体问题的人发出一次轻邀请，观察他是否愿意投入时间、反馈或小额费用。';

    if (dayOne.mode === 'reality') return sevenDayPlanForReality();
    /* 付费信息冲突：第 1 天必须是"确认付费信息"，与决策层/30 天判断同源。 */
    if (decision.status === 'payment_unconfirmed') return sevenDayPlanForPaymentConflict();

    /* 已有 5+ 案例或已有真实付费：全程不再安排"补案例"。
     * 第 7 天仍是继续/暂停判断（30 天口径由 buildThirtyDayDecision 统一给出）。 */
    var lateDays;

    /* Round E 第 1/3 条：已经出现过真实付费的人（paid >= 1），第 2–7 天
     * **不能再是"验证别人愿不愿意付钱"**（钱已经付过了）。整段改为
     * 交付边界 / 复购 / 转介绍，与 consult_ready 的当前动作同向。 */
    if (dayOne.mode === 'paid') {
      lateDays = [
        { day: '第 2 天', title: '把交付边界写成一句话', action: '只写三行：交付什么、不包含什么、怎么算完成。写不出"不包含什么"，就说明边界还没定。' },
        { day: '第 3 天', title: '回访已经付过费或替你转介绍过的人', action: '只找 3 位已经付过费、或转介绍过的人，不要开发新客户。逐个回看上一次到底交付了什么。' },
        { day: '第 4 天', title: '记录复购与转介绍的真实触发点', action: '每人只记三行：他上次为什么愿意付费、哪一部分最有用、下一次会因为哪件事再付。' },
        { day: '第 5 天', title: '写出第一版交付物', action: '把交付压成一个最小东西：' + hypothesis.firstOffer + '。同时写清不包含什么。' },
        { day: '第 6 天', title: decision.status === 'consult_ready' ? '准备定制判断材料' : '定下价格区间', action: paidAction },
        { day: '第 7 天', title: '做继续/暂停判断', action: '只看一件事：已有付费有没有继续重复出现。没有复购、也没有转介绍，就不要扩量，回到交付边界上继续修。' }
      ];
    } else if (dayOne.mode === 'case_5plus') {
      lateDays = [
        { day: '第 2 天', title: '把主卡点压成一个可验证的问题', action: '从当前主卡点里挑一个能在一周内被验证真假的问题，写成一句话。' },
        { day: '第 3 天', title: '直接去找已经认识你的人验证', action: '用你已经有的案例开头，不要重新整理材料，只问对方最近是否遇到过同样的问题。' },
        { day: '第 4 天', title: '记录原话与卡点', action: '每个人只记三行：他的原话问题、他现在的处理方式、他是否愿意继续。' },
        { day: '第 5 天', title: '写出第一版交付物', action: '把交付压成一个最小东西：' + hypothesis.firstOffer + '。同时写清不包含什么。' },
        { day: '第 6 天', title: decision.status === 'consult_ready' ? '准备定制判断材料' : '测试一次低门槛意向', action: paidAction },
        { day: '第 7 天', title: '做继续/暂停判断', action: '对照通过信号和停止信号。如果没有真实反馈，不要继续加码，回到当前主卡点上继续验证。' }
      ];
    } else {
      lateDays = [
        { day: '第 2 天', title: '压缩一个最小问题', action: '从案例里挑一个别人最可能也会遇到的问题，写成一句话。' },
        { day: '第 3 天', title: '发一条验证内容', action: '用案例开头，提出判断，不急着卖资料，不急着卖服务，只观察谁会停下来。' },
        { day: '第 4 天', title: '找 3 个人做问题访谈', action: '不要问"你要不要买"，只问他最近是否遇到过类似问题、怎么处理、卡在哪里。' },
        { day: '第 5 天', title: '写出第一版交付物', action: '把交付压成一个最小东西：' + hypothesis.firstOffer + '。同时写清不包含什么。' },
        { day: '第 6 天', title: decision.status === 'consult_ready' ? '准备定制判断材料' : '测试一次低门槛意向', action: paidAction },
        { day: '第 7 天', title: '做继续/暂停判断', action: '对照通过信号和停止信号。如果没有真实反馈，不要继续做产品，回到经验萃取。' }
      ];
    }

    return [dayOne.day].concat(lateDays);
  }

  function buildScripts(input, decision) {
    var route = inferProductRoute(input, scoreDimensions(input.d || {}));
    var label = offerMap(route).offer;
    return {
      moments: '我最近在整理一个小判断：很多人工作多年不是没经验，而是不知道经验能不能变成可交付的价值。我想用一个很轻的方式验证「' + label + '」这个方向。如果你也有类似问题，可以私信我一句你的情况。',
      interview: '我想请教你 3 个问题：你最近有没有遇到过类似问题？你现在是怎么解决的？如果有人能帮你把判断、步骤或交付边界讲清楚，你最希望先解决哪一块？',
      trialInvite: decision.status === 'consult_ready'
        ? '我可以做一次边界清楚的小诊断，重点不是陪聊，而是帮你判断第一路径、第一案例、第一版交付和边界。你愿意的话，我先根据你的情况判断是否适合继续。'
        : '我可以先用一个很轻的方式帮你拆一次，不承诺完整方案，只帮你判断问题、卡点和下一步。如果你觉得有用，我们再看是否需要更完整的诊断。',
      rejectionFollowup: '没关系，我不是想硬推。我更想确认这个问题是不是真实存在。你不想继续的原因是现在不急、问题不痛，还是我表达的交付不够清楚？'
    };
  }

  function buildNextStep(decision) {
    /* cause 优先：现实可行性不足的人，不能被告知"先补 3 个真实案例"。 */
    if (decision.status === 'not_fit_now' && decision.cause === 'low_reality') {
      return {
        recommendConsult: false,
        primary: '先解决时间、验证对象和验证意愿，不建议现在买咨询或做产品',
        secondary: '你的经验、案例、证据和付费已经成立，缺的是能把这些真正跑起来的现实条件；现实条件不改善，扩大投入只会停在原地。',
        route: 'reality_first'
      };
    }
    if (decision.status === 'not_fit_now' && decision.cause === 'low_problem_clarity') {
      return {
        recommendConsult: false,
        primary: '先把"帮谁解决什么问题"收窄，不建议急着买咨询',
        secondary: '问题不窄的时候，咨询也会变成陪聊；先写出一个人群和一个具体问题。',
        route: 'narrow_problem'
      };
    }
    if (decision.status === 'not_fit_now' || decision.status === 'extract_cases_first') {
      return {
        recommendConsult: false,
        primary: '先补 3 个真实案例，不建议急着买咨询',
        secondary: '可以用 一人公司海外源头库理解底层逻辑，但不要急着做产品。',
        route: 'stop_and_extract'
      };
    }
    if (decision.status === 'validate_first') {
      return {
        recommendConsult: false,
        primary: '先做 7 天低成本验证',
        secondary: '一人公司海外源头库补逻辑；如果后续确实需要做图或内容素材，再考虑工具库。',
        route: 'validate'
      };
    }
    if (decision.status === 'paid_trial_ready') {
      return {
        recommendConsult: false,
        primary: '先做一次低价试单或小交付',
        secondary: '如果试单后仍卡在路径、案例、定价或边界，再考虑后续定制判断。',
        route: 'paid_trial'
      };
    }
    if (decision.status === 'career_reposition_first') {
      return {
        recommendConsult: false,
        primary: '先做职业再定位，不建议直接做商业化',
        secondary: '把主业、现金流、可迁移能力和低成本验证拆清楚，再判断是否产品化。',
        route: 'career_reposition'
      };
    }
    if (decision.status === 'organization_complexity') {
      return {
        recommendConsult: false,
        primary: '先梳理组织权责和可控动作',
        secondary: '自动报告不能替组织做决策。先补老板、资源、决策权和短期收益信息。',
        route: 'organization_map'
      };
    }
    if (decision.status === 'direction_overload') {
      return {
        recommendConsult: false,
        primary: '先裁剪第一路径',
        secondary: '不要同时做内容、咨询、知识产品和工具。先选一个人群、一个问题、一个交付。',
        route: 'direction_cut'
      };
    }
    if (decision.status === 'service_system_weak') {
      return {
        recommendConsult: false,
        primary: '先补 30 天经营记录',
        secondary: '有服务不等于能放大。先记录客户数、复购、转介绍、成交来源和交付时长。',
        route: 'service_system'
      };
    }
    return {
      recommendConsult: true,
      primary: '可以进入定制判断',
      secondary: '自动报告已经完成第一轮判断，后续继续处理定制路径、案例、定价和交付边界。',
      route: 'consult'
    };
  }

  function buildConsultBoundary(decision) {
    if (decision.status === 'consult_ready') {
      return '这份报告负责第一轮判断和验证动作；后续定制判断会基于你的真实经历继续判断路径、案例、定价和交付边界。';
    }
    if (decision.status === 'not_fit_now') {
      if (decision.cause === 'low_reality') {
        return '暂时不建议直接买咨询。你缺的不是方法也不是素材，而是能投入的时间、可验证的对象和验证意愿；'
          + '现实条件改善后，再判断是否需要后续定制判断。';
      }
      if (decision.cause === 'low_problem_clarity') {
        return '暂时不建议直接买咨询。先写清"帮谁解决什么问题"，问题收窄之后再看是否需要后续定制判断。';
      }
      return '暂时不建议直接买咨询。先补案例和真实反馈，等你能说清第一问题后，再判断是否需要后续定制判断。';
    }
    if (decision.status === 'career_reposition_first') {
      return '这份报告只能帮你做职业和经验资产初筛，不能替你决定离职、转行或创业。先看主业现金流和可迁移能力，再判断是否需要后续定制判断。';
    }
    if (decision.status === 'organization_complexity') {
      return '你的问题涉及组织权责和公司节奏，19.9 元完整自动报告只做初步梳理。只有在你能补齐关键相关方、可控动作和决策成本后，才考虑是否适合预约职业经验资产一对一诊断。';
    }
    return '先按这份报告做 7 天验证或低价试单。如果验证后仍卡在路径、案例、定价或交付边界，再考虑后续定制判断。';
  }

  function pathByKey(key) {
    return pathCatalog[key] || pathCatalog.content;
  }

  function buildContradictions(input, scores, decision) {
    var d = input.d || {};
    var out = [];
    var confidence = number(d.confidence, 0);
    var consultLevel = getConsultLevel(d.consultedBefore);
    // canonical 付费真相，与 decide() / 判断层同源
    var pay = (decision && decision.paymentState) || resolvePaymentState(d);
    var paidLevel = pay.level;
    var preference = text(d.deliveryPreference);
    var hours = number(d.hours, 0);
    var yearsText = text(d.years);

    function add(label, evidence, meaning, action) {
      out.push({ label: label, evidence: evidence, meaning: meaning, action: action });
    }

    /* 付费信息自相矛盾要排在第一位：它让 Stage / 付费证据 / 结论三处无法同时成立。 */
    if (pay.conflict) {
      add(
        '付费信息自相矛盾',
        '付费记录题答「' + pay.paidBeforeOption + '」，成本意愿题答「' + pay.willingnessOption + '」。',
        '两题对"是否已经收到过钱"的说法不一致，报告无法据此判断你在早期验证还是已经可以放大。',
        '先确认哪一处才是真实情况；在确认之前，不把任何一处当作已发生的付费事实，也不进入放大判断。'
      );
    }

    if ((scores.experience_depth >= 75 || yearsText.indexOf('9-15') !== -1 || yearsText.indexOf('16') !== -1) && scores.evidence_assets < 40) {
      add(
        '年限和证据不匹配',
        '你的工作年限较长，但案例、材料或外部反馈不足。',
        '问题不是没经验，而是客户看不到可以相信的证据。',
        '先写 3 个真实案例，每个只保留问题、判断、动作和结果。'
      );
    }

    if (confidence >= 8 && scores.evidence_assets < 45 && scores.demand_signal < 50) {
      add(
        '自信高于外部证据',
        '你的主观信心较高，但需求和证据还没有跟上。',
        '这类状态最容易把自我感觉误判成市场需求。',
        '先找 3 个目标对象做访谈，不要先做产品或咨询包装。'
      );
    }

    if (consultLevel > 0 && paidLevel === 0 && !pay.conflict) {
      add(
        '有人问但没人付费',
        '已经有人请教或咨询，但还没有付费记录。',
        '这说明问题可能存在，但付费意愿和交付边界还没被验证。',
        '把一次帮助压成边界清楚的小交付，测试对方是否愿意投入成本。'
      );
    }

    if (preference.indexOf('诊断') !== -1 && scores.problem_clarity < 60) {
      add(
        '想做诊断但问题不够清楚',
        '你倾向做职业经验资产一对一诊断，但帮谁解决什么还不够窄。',
        '咨询卖的是判断，不是聊天。问题不窄，诊断会变成陪聊。',
        '先写清一个人群、一个触发场景和一个具体问题。'
      );
    }

    if ((preference.indexOf('报告') !== -1 || preference.indexOf('自学') !== -1 || preference.indexOf('清单') !== -1) && scores.delivery_feasibility < 55) {
      add(
        '想做知识产品但结构不够',
        '你倾向做报告或自学材料，但交付结构还不稳定。',
        '资料不是产品，能帮别人完成判断的结构才是产品。',
        '先做一页清单，写明适合谁、解决什么、包含什么、不包含什么。'
      );
    }

    if (preference.indexOf('服务包') !== -1 && hours > 0 && hours < 5) {
      add(
        '想做服务但时间不支持',
        '你想做服务交付，但每周可投入时间偏低。',
        '重服务会消耗你最稀缺的时间，容易拖垮现金流和体验。',
        '先做轻诊断、模板或一次短交付，不要做长期陪跑。'
      );
    }

    if (paidLevel > 0 && scores.delivery_feasibility < 55) {
      add(
        '有付费信号但交付边界不稳',
        '已经有人付费或愿意试单，但材料和边界还不够清楚。',
        '继续放大之前，建议先降低交付风险。',
        '写清交付物、周期、验收标准和不包含范围。'
      );
    }

    if (!out.length && decision.status === 'not_fit_now') {
      add(
        '投入欲望早于证据',
        '你还没有足够案例、问题和验证对象。',
        '现在继续买工具、做包装或预约咨询，都可能只是延迟面对底层素材不足。',
        '先补案例和真实问题，再决定是否继续。'
      );
    }

    return out;
  }

  /* 方向判定与「为什么是这个方向」必须**同源产生**（Round C 第 3 条）。
   * 规则在哪一层定下 route，就在同一处记录依据；渲染层只消费，不再事后猜测。
   *
   * 输出（挂在 firstPath 上 + pathTriage 根部）：
   *   firstPath.reason        一句话依据，免费摘要 / 19.9 报告直接显示
   *   firstPath.basis         结构化依据（rule / detail / readValue）
   *   reasonCodes[]           触发过的规则编号，可审计、可断言
   *   triggeredRules[]        触发明细（code / rule / detail）
   */
  function buildPathTriage(input, scores, decision) {
    var d = input.d || {};
    var triggered = [];

    function fire(code, rule, detail) {
      triggered.push({ code: code, rule: rule, detail: detail });
    }

    /* ---- 第 1 层：基础路径推断。判定顺序与 inferProductRoute 严格一致 ---- */
    var route = inferProductRoute(input, scores);
    var baseRoute = route;
    var preference = text(d.deliveryPreference);

    if (isCareerReposition(d)) {
      fire('R1', '职业再定位优先', '你的答案里出现了职业、转型或现金流这类约束，方向先判为职业再定位');
    } else if (getOrganizationLevel(d) >= 2) {
      fire('R2', '组织复杂度优先', '你的组织复杂度达到需要人工判断的档位，方向先判为组织问题梳理');
    } else if (preference.indexOf('诊断') !== -1) {
      fire('R3', '交付偏好＝咨询诊断', '你选的交付偏好是「' + preference + '」，含"诊断"');
    } else if (preference.indexOf('报告') !== -1 || preference.indexOf('自学') !== -1 || preference.indexOf('清单') !== -1) {
      fire('R4', '交付偏好＝知识产品', '你选的交付偏好是「' + preference + '」，指向可自学的知识产品');
    } else if (preference.indexOf('模板') !== -1 || preference.indexOf('SOP') !== -1) {
      fire('R5', '交付偏好＝模板工具', '你选的交付偏好是「' + preference + '」，指向模板或 SOP');
    } else if (preference.indexOf('服务包') !== -1) {
      fire('R6', '交付偏好＝小服务交付', '你选的交付偏好是「' + preference + '」，指向小服务包');
    } else if (scores.problem_clarity >= 65 && scores.demand_signal >= 55) {
      fire('R7', '六维分数交叉达标',
        '问题清晰度 ' + scores.problem_clarity + '（≥65）且需求信号 ' + scores.demand_signal + '（≥55），够得上咨询诊断');
    } else {
      fire('R8', '保留 8 题初步倾向',
        '深度信息还不足以确定方向，当前只保留 8 题提供的初步倾向');
    }

    /* ---- 第 2 层：规则引擎结论覆盖（status 单值，等值于一张映射表）---- */
    var STATUS_ROUTE = {
      extract_cases_first: 'case_extract',
      not_fit_now: 'case_extract',
      content_probe: 'content',
      knowledge_product_fit: 'knowledge',
      template_tool_fit: 'template',
      consulting_diagnosis_fit: 'consulting',
      service_delivery_fit: 'service',
      consult_ready: 'consulting',
      career_reposition_first: 'career_reposition',
      organization_complexity: 'organization_map',
      direction_overload: 'case_extract',
      service_system_weak: 'service'
    };
    if (STATUS_ROUTE[decision.status]) {
      route = STATUS_ROUTE[decision.status];
      fire('R9', '结合当前事实调整方向',
        '结合当前回答中的事实与现实条件，当前方向调整为「' + pathByKey(route).label + '」');
    }

    /* ---- 同源依据：由真正定下方向的规则生成，基础规则与覆盖规则都写清 ---- */
    var base = triggered[0];
    var overrideRule = null;
    for (var i = 0; i < triggered.length; i++) {
      if (triggered[i].code === 'R9') overrideRule = triggered[i];
    }
    var statusLabel = decision.label || decision.status;
    var baseLabel = pathByKey(baseRoute).label;
    var finalLabel = pathByKey(route).label;
    var overridden = !!overrideRule && baseRoute !== route;

    var reason;
    if (overridden) {
      reason = '你提供的回答先显示出「' + baseLabel + '」倾向；结合当前事实与现实条件后，当前更适合先按「' + finalLabel + '」继续核对。';
    } else if (overrideRule) {
      reason = '你提供的经历、需求信号与现实条件都更接近「' + finalLabel + '」，当前先保留这一方向。';
    } else {
      reason = '根据你提供的经历、需求信号与现实条件，当前更接近「' + finalLabel + '」；信息仍不足时，只把它作为初步参考。';
    }

    var first = pathByKey(route);
    var backupKey = 'case_extract';
    if (route === 'case_extract') backupKey = 'content';
    else if (route === 'content') backupKey = 'consulting';
    else if (route === 'knowledge') backupKey = 'template';
    else if (route === 'template') backupKey = 'knowledge';
    else if (route === 'consulting') backupKey = 'content';
    else if (route === 'service') backupKey = 'consulting';
    else if (route === 'career_reposition') backupKey = 'case_extract';
    else if (route === 'organization_map') backupKey = 'consulting';

    var avoidKey = 'service';
    if (scores.evidence_assets < 45) avoidKey = 'consulting';
    else if (scores.demand_signal < 45) avoidKey = 'service';
    else if (scores.reality_constraints < 45) avoidKey = 'service';
    else if (route === 'service') avoidKey = 'knowledge';
    if (route === 'career_reposition') avoidKey = 'service';
    if (route === 'organization_map') avoidKey = 'content';

    var reasonCodes = triggered.map(function (t) { return t.code; });

    return {
      firstPath: {
        key: first.key,
        label: first.label,
        why: first.summary,
        firstOffer: first.firstOffer,
        // ↓ 同源依据（新增）：渲染层直接消费，不再自行推测
        reason: reason,
        basis: {
          // 基础方向由哪条规则定下（R1–R8）
          rule: base.rule,
          ruleCode: base.code,
          // 最终是否被结论层改写（R9）
          decisiveRule: overrideRule ? overrideRule.rule : null,
          overridden: overridden,
          status: decision.status,
          statusLabel: statusLabel,
          readValue: preference || null,
          baseRoute: baseRoute,
          finalRoute: route,
          codes: reasonCodes
        }
      },
      backupPath: {
        key: backupKey,
        label: pathByKey(backupKey).label,
        why: pathByKey(backupKey).summary
      },
      notRecommendedPath: {
        key: avoidKey,
        label: pathByKey(avoidKey).label,
        why: pathByKey(avoidKey).avoid
      },
      reasonCodes: reasonCodes,
      triggeredRules: triggered,
      rationale: '路径不是按兴趣选，而是按证据、需求、交付和现实约束共同裁剪。'
    };
  }

  function buildRiskProfile(input, scores, decision, contradictions) {
    var firstContradiction = contradictions && contradictions[0];
    var level = 'medium';
    if (decision.status === 'not_fit_now' || scores.evidence_assets < 35 || scores.problem_clarity < 45) level = 'high';
    if (decision.status === 'consult_ready' || decision.status === 'paid_trial_ready') level = 'low';
    var label = level === 'high' ? '高风险' : (level === 'low' ? '可控风险' : '中等风险');
    var biggestMisread = firstContradiction
      ? firstContradiction.meaning
      : '你最容易把“我有经验”误读成“别人已经愿意为这个经验付钱”。';
    var doNotDoNow = '不要先做大课、重服务、复杂社群或高成本包装。';
    if (decision.status === 'consult_ready') doNotDoNow = '不要继续长期免费答疑，也不要在没有边界时直接放大。';
    if (decision.status === 'extract_cases_first') doNotDoNow = '不要先卖咨询或做复杂产品，先把案例证据补齐。';
    if (decision.status === 'content_probe') doNotDoNow = '不要追热点和做人设，先围绕一个具体问题表达。';
    return {
      level: level,
      label: label,
      biggestMisread: biggestMisread,
      doNotDoNow: doNotDoNow,
      riskReason: firstContradiction ? firstContradiction.evidence : '当前判断来自你的证据、需求、交付和现实约束组合。'
    };
  }

  function buildProductFit(input, scores, decision, pathTriage, diagnosticStatus) {
    var route = pathTriage.firstPath.key;
    var report99 = decision.status !== 'not_fit_now' && diagnosticStatus !== 'not_ready';
    var selfStudy99 = decision.status !== 'consult_ready' && (scores.problem_clarity < 70 || scores.evidence_assets < 60 || decision.status === 'extract_cases_first' || decision.status === 'validate_first');
    var prompt99 = route === 'content' || route === 'template' || route === 'knowledge';
    var consult699 = decision.status === 'consult_ready';
    if (scores.evidence_assets < 45 || scores.demand_signal < 55) consult699 = false;
    if (diagnosticStatus === 'career_reposition_first' || diagnosticStatus === 'organization_complexity' || diagnosticStatus === 'not_ready') {
      prompt99 = false;
      consult699 = false;
    }
    return {
      recommendReport99: report99,
      recommendSelfStudy99: selfStudy99,
      recommendPrompt99: prompt99,
      recommendConsult699: consult699,
      reportReason: report99 ? '这份报告已经给出第一轮路径判断，接下来先按验证清单补真实反馈。' : '当前更需要先补案例和问题，暂时不用购买 19.9 元完整自动报告。',
      selfStudyReason: selfStudy99 ? '一人公司海外源头库适合先补底层逻辑，避免为知识本身花大钱。' : '你已经更需要具体路径判断，而不是继续泛学。',
      promptReason: prompt99 ? '做图提示词库适合把表达、素材或模板验证做得更快。' : '当前不是缺做图或表达工具，而是缺案例、需求或交付判断。',
      consultReason: consult699 ? '你已经具备进入定制判断的基础，可以继续判断路径、案例、定价和交付边界。' : '当前更适合先按这份报告做本轮验证，再判断是否需要后续定制判断。'
    };
  }

  function buildConsultReadiness(input, scores, decision, productFit) {
    if (productFit.recommendConsult699) {
      return {
        status: 'ready',
        label: '可以考虑定制判断',
        reason: '你已经有经验、证据和需求信号，后续可以继续处理第一路径、案例、定价和交付边界。',
        recommendConsult699: true,
        prepList: ['3 个代表性案例', '当前最想判断的第一路径', '已有反馈或付费记录', '你愿意交付和不愿意交付的边界']
      };
    }
    if (decision.status === 'not_fit_now' || decision.status === 'extract_cases_first') {
      return {
        status: 'not_ready',
        label: '暂时不建议定制判断',
        reason: '你现在缺少足够案例或外部证据，定制判断也难以判断准。先补底层素材更省钱。',
        recommendConsult699: false,
        prepList: ['先写 3 个真实案例', '找到 3 个可访谈对象', '记录他们的具体问题']
      };
    }
    return {
      status: 'after_validation',
      label: '验证后再考虑定制判断',
      reason: '先按这份报告做本轮验证。如果仍卡在路径、案例、定价或交付边界，再考虑后续定制判断。',
      recommendConsult699: false,
      prepList: ['验证反馈', '访谈记录', '第一版交付物草稿', '最卡住的一个判断问题']
    };
  }

  function buildThirtyDayPlan(input, scores, decision, pathTriage) {
    var first = pathTriage.firstPath;
    var lowReality = decision && (decision.cause === 'low_reality' || scores.reality_constraints < 25);
    /* 第 1 周不安排"补案例"的条件：现实可行性不足，或案例已经完全不同缺 */
    var week1 = lowReality
      ? {
        week: '第 1 周',
        title: '先解决现实可行性',
        goal: '把时间、验证对象和验证意愿这三件现实条件摆清楚，再谈验证。',
        actions: ['写出每周可稳定投入的时间', '确认能直接联系上的验证对象', '把验证动作压到 15 分钟 / 1 个人的规模'],
        passSignal: '时间、对象、意愿三项里至少补齐两项，并且真的完成 1 次对话。',
        stopSignal: '现实条件没有改善时，不新增任何投入。'
      }
      : {
        week: '第 1 周',
        title: '案例和问题压缩',
        goal: '把经验从自我描述变成别人能理解的问题。',
        actions: ['整理已有案例（不足 3 个才需补写）', '压缩 1 个目标人群', '写出 1 个具体问题'],
        passSignal: '至少 3 个人能听懂并补充自己的类似问题。',
        stopSignal: '写不出案例，或别人听完不知道你在解决什么。'
      };
    return [
      week1,
      {
        week: '第 2 周',
        title: '真实需求访谈',
        goal: '确认这个问题是否真实存在。',
        actions: ['找 3-5 个目标对象', '问他们怎么处理这个问题', '记录原话和卡点'],
        passSignal: '有人继续追问，或愿意给更多背景。',
        stopSignal: '反馈停留在客气夸奖，没有具体场景。'
      },
      {
        week: '第 3 周',
        title: '第一交付物试做',
        goal: '把路径压成一个能交付的小东西。',
        actions: ['制作 ' + first.firstOffer, '写清不包含范围', '找 1-3 人试用'],
        passSignal: '有人愿意投入时间、反馈或小额费用。',
        stopSignal: '没人愿意试用，或交付范围说不清。'
      },
      {
        week: '第 4 周',
        title: '继续或暂停判断',
        goal: '决定继续做 99/低价试单/定制判断，还是回到萃取。',
        actions: ['整理反馈', '判断第一路径是否成立', '决定下一步投入上限'],
        passSignal: '出现付费、复购、转介绍或明确预约信号。',
        stopSignal: '没有真实对话、具体问题或可交付边界。'
      }
    ];
  }

  function buildCaseReadiness(input, scores) {
    var d = input.d || {};
    var level = getCaseLevel(d);
    if (level >= 3) {
      return {
        level: 'strong',
        label: '案例准备度：强',
        reason: '你能拿出多个包含结果或反馈的案例，可以支撑更明确的路径和交付判断。'
      };
    }
    if (level >= 2) {
      return {
        level: 'usable',
        label: '案例准备度：可用',
        reason: '你已经能写出 3 个真实案例，可以进入路径判断和低成本验证。'
      };
    }
    if (level >= 1) {
      return {
        level: 'weak',
        label: '案例准备度：偏弱',
        reason: '你有少量案例，但还不足以支撑高成本诊断或复杂产品化判断。'
      };
    }
    return {
      level: 'missing',
      label: '案例准备度：不足',
      reason: '你现在还写不出能被别人看懂的案例，先不要急着收费或做重产品。'
    };
  }

  function buildInformationGaps(input, scores, caseReadiness) {
    var d = input.d || {};
    var gaps = [];
    if (!text(d.problemSpecificity) || hasAny(d.problemSpecificity, ['说不清'])) gaps.push('缺少明确问题：还说不清帮谁解决什么。');
    if (!text(d.targetCustomerClarity) || hasAny(d.targetCustomerClarity, ['没有'])) gaps.push('缺少目标人群：还没有明确第一类客户。');
    if (caseReadiness.level === 'missing' || caseReadiness.level === 'weak') gaps.push('缺少真实案例：需要先补 3 个问题、判断、动作、结果清楚的案例。');
    if (getEvidenceLevel(d) <= 1) {
      var payGap = resolvePaymentState(d);
      if (payGap.conflict) {
        gaps.push('付费信息待确认：你在付费记录题与成本意愿题上的回答互相矛盾，先确认哪一处是真实情况。');
      } else {
        gaps.push(payGap.level > 0
          ? '外部证据还不完整：已有早期付费信号，但还需要补充反馈、结果、转介绍或复购记录。'
          : '缺少外部证据：还没有足够反馈、结果、转介绍或付费记录。');
      }
    }
    if (getCostSignalLevel(d) === 0) gaps.push('缺少成本信号：还看不到别人愿意投入时间、配合或付费。');
    if (!text(d.deliveryPreference) || hasAny(d.deliveryPreference, ['不确定'])) gaps.push('缺少第一交付物：还不知道先交付报告、诊断、模板还是服务。');
    if (getOrganizationLevel(d) >= 2) gaps.push('组织权责复杂：需要先补老板、资源、决策权和可控动作信息。');
    if (number(d.hours, 0) > 0 && number(d.hours, 0) < 5) gaps.push('现实投入不足：每周时间太少，只能做轻验证。');
    return gaps.slice(0, 6);
  }

  function buildDisqualificationRules(input, scores, caseReadiness) {
    var d = input.d || {};
    var rules = [];
    function add(code, label, reason, message) {
      rules.push({ code: code, label: label, reason: reason, message: message });
    }
    if (hasAny(d.years, ['1-3']) && scores.experience_depth < 40) {
      add('R1', '经验积累不足', '当前能被产品化的经验证据还不够厚。', '先在岗位里做 1-2 个可复盘项目，比急着买产品更省钱。');
    }
    if (caseReadiness.level === 'missing') {
      add('R2', '没有真实案例', '没有案例，报告无法判断经验能解决谁的问题。', '先写 3 个案例，每个只写问题、判断、动作、结果。');
    }
    if (getEvidenceLevel(d) <= 1) {
      add('R3', '没有外部证据', '客户看不到信任证据，商业化会变成自我证明。', '先整理一个证据包，找 3 个目标对象确认问题。');
    }
    if (isQuickMoneyConsumer(d)) {
      add('R4', '只想快速赚钱', '这类状态最容易买错产品，也最容易对结果失望。', '先做 7 天验证，不要先买咨询或复杂工具。');
    }
    if (hasAny(d.validationCommitment, ['不想公开', '不想找人聊'])) {
      add('R5', '不愿意行动验证', '没有行动，任何报告都会停在纸面。', '先做最低风险动作：找 1 个熟人聊一个问题。');
    }
    if (number(d.hours, 0) > 0 && number(d.hours, 0) < 5) {
      add('R6', '现实压力过大', '时间太少时，重服务和长期内容都会加重压力。', '只做轻验证，不做重投入。');
    }
    if (isAnxietyConsumer(d)) {
      add('R8', '被焦虑推动', '焦虑会让你买错课、选错方向、做错产品。', '先把焦虑转成清单：我有什么、别人问什么、我能交付什么。');
    }
    if (hasAny(d.deliveryResponsibility, ['不想写清楚', '只想先卖出去'])) {
      add('R9', '交付责任不足', '不愿意明确边界时，不适合收费。', '先写清交付物、不包含范围和验收标准。');
    }
    if (getOrganizationLevel(d) >= 2) {
      add('R11', '组织权责复杂', '这不是你一个人努力就能解决的问题。', '先梳理可控动作、关键人、决策权和短期收益。');
    }
    if (isServiceSystemWeak(d)) {
      add('R12', '服务经营系统弱', '没有数据，放大只会放大混乱。', '先记录 30 天客户数、转介绍、复购、成交来源和交付时长。');
    }
    return rules;
  }

  function buildDiagnosticStatus(input, scores, decision, caseReadiness, gaps, rules) {
    var d = input.d || {};
    var hasRule = function(code) {
      return rules.some(function(rule) { return rule.code === code; });
    };
    if ((hasRule('R1') || hasRule('R4') || hasRule('R8')) && hasAny(d.validationCommitment, ['不想'])) return 'not_ready';
    if (decision.status === 'not_fit_now') return 'not_ready';
    if (isCareerReposition(d) || decision.status === 'career_reposition_first') return 'career_reposition_first';
    if (getOrganizationLevel(d) >= 2 || decision.status === 'organization_complexity') return 'organization_complexity';
    if (isServiceSystemWeak(d) && (getPaidLevel(d.paidBefore) >= 2 || getCostSignalLevel(d) >= 2)) return 'service_system_weak';
    if (caseReadiness.level === 'missing' || decision.status === 'extract_cases_first') return 'case_extraction_first';
    if (isDirectionOverload(d) || decision.status === 'direction_overload') return 'direction_overload';
    if (caseReadiness.level !== 'missing' && getEvidenceLevel(d) <= 1) return 'evidence_missing';
    if (decision.status === 'consult_ready') return 'ready_for_paid_diagnosis';
    if (decision.status === 'paid_trial_ready') return 'validation_first';
    if (decision.status === 'validate_first') return 'validation_first';
    return decision.status || 'validation_first';
  }

  function buildAdminLead(input, scores, decision, productFit, consultReadiness, contradictions, diagnosticStatus, informationGaps, disqualificationRulesHit, confidence) {
    var bucket = 'path_report_99';
    if (decision.status === 'not_fit_now' || diagnosticStatus === 'not_ready') bucket = 'reject_now';
    else if (decision.status === 'extract_cases_first') bucket = 'case_extract';
    else if (diagnosticStatus === 'case_extraction_first') bucket = 'case_extract';
    else if (diagnosticStatus === 'career_reposition_first') bucket = 'career_reposition';
    else if (diagnosticStatus === 'organization_complexity') bucket = 'manual_review';
    else if (decision.status === 'consult_ready') bucket = 'consult_699';
    else if (decision.status === 'paid_trial_ready') bucket = 'paid_trial';
    else if (diagnosticStatus === 'service_system_weak') bucket = 'paid_trial';
    else if (productFit.recommendPrompt99 && !productFit.recommendConsult699 && (decision.status === 'content_probe' || decision.status === 'template_tool_fit')) bucket = 'prompt_library_99';
    else if (
      productFit.recommendSelfStudy99 &&
      decision.status === 'validate_first' &&
      (scores.problem_clarity < 55 || scores.evidence_assets < 45)
    ) bucket = 'self_study_99';

    var priority = 'medium';
    if (bucket === 'consult_699' || bucket === 'paid_trial' || bucket === 'manual_review') priority = 'high';
    if (bucket === 'reject_now' || bucket === 'case_extract') priority = 'low';

    var reasons = [];
    reasons.push(decision.label);
    if (contradictions && contradictions[0]) reasons.push(contradictions[0].label);
    if (informationGaps && informationGaps[0]) reasons.push('信息不足：' + informationGaps[0]);
    if (disqualificationRulesHit && disqualificationRulesHit[0]) reasons.push('劝退：' + disqualificationRulesHit[0].label);
    if (productFit.recommendConsult699) reasons.push('推荐 699');
    else if (productFit.recommendReport99) reasons.push('可考虑 19.9 元完整自动报告');
    if (productFit.recommendSelfStudy99) reasons.push('可推荐 99 自学');
    if (productFit.recommendPrompt99) reasons.push('可推荐 99 提示词');

    var nextMessage = '先查看 19.9 元完整自动报告，再根据验证结果判断下一步。';
    if (bucket === 'reject_now') nextMessage = '先劝退，不要收 699。让客户补 3 个案例和真实问题。';
    if (bucket === 'case_extract') nextMessage = '让客户先做案例萃取，补齐证据后再判断是否继续做测评或咨询。';
    if (bucket === 'self_study_99') nextMessage = '建议先看一人公司海外源头库补底层逻辑，不要直接做高成本投入。';
    if (bucket === 'prompt_library_99') nextMessage = '如果客户已有具体表达或素材任务，可推荐做图提示词库辅助验证。';
    if (bucket === 'paid_trial') nextMessage = '建议先做低价试单，记录反馈，暂不直接推荐职业经验资产一对一诊断。';
    if (bucket === 'consult_699') nextMessage = '先核对案例、反馈和付费信号，再判断是否适合预约职业经验资产一对一诊断。';
    if (bucket === 'career_reposition') nextMessage = '先聊职业再定位，不要直接推个人 IP 或做图提示词库。请客户补充主业、现金流和下一步选择成本。';
    if (bucket === 'manual_review') nextMessage = '这是组织复杂问题，先问清老板、权责、资源和可控动作；不要让自动报告给唯一方案。';

    return {
      bucket: bucket,
      diagnosticStatus: diagnosticStatus,
      priority: priority,
      reasons: reasons,
      nextMessage: nextMessage,
      consultStatus: consultReadiness.status,
      confidence: confidence && confidence.level,
      informationGaps: informationGaps || [],
      disqualificationRulesHit: disqualificationRulesHit || []
    };
  }

  function computeCommercialDiagnostic(input) {
    input = input || {};
    input.d = input.d || {};
    var scores = scoreDimensions(input.d);
    var decision = decide(input, scores);
    var nextStep = buildNextStep(decision);
    var caseReadiness = buildCaseReadiness(input, scores);
    var informationGaps = buildInformationGaps(input, scores, caseReadiness);
    var disqualificationRulesHit = buildDisqualificationRules(input, scores, caseReadiness);
    var diagnosticStatus = buildDiagnosticStatus(input, scores, decision, caseReadiness, informationGaps, disqualificationRulesHit);
    var confidence = buildConfidence(input, scores, decision, diagnosticStatus, informationGaps);
    var contradictions = buildContradictions(input, scores, decision);
    var pathTriage = buildPathTriage(input, scores, decision);
    var riskProfile = buildRiskProfile(input, scores, decision, contradictions);
    var productFit = buildProductFit(input, scores, decision, pathTriage, diagnosticStatus);
    var consultReadiness = buildConsultReadiness(input, scores, decision, productFit);
    var thirtyDayPlan = buildThirtyDayPlan(input, scores, decision, pathTriage);
    var adminLead = buildAdminLead(input, scores, decision, productFit, consultReadiness, contradictions, diagnosticStatus, informationGaps, disqualificationRulesHit, confidence);
    return {
      decision: decision,
      recommendation: decision,
      diagnosticStatus: diagnosticStatus,
      leadBucket: adminLead.bucket,
      confidence: confidence,
      dimensionScores: scores,
      dimensionLabels: diagnosticDimensions,
      lowestDimension: lowestDimension(scores),
      evidence: buildEvidence(input, scores, decision),
      stopRules: buildStopRules(input, scores, decision),
      caseReadiness: caseReadiness,
      informationGaps: informationGaps,
      disqualificationRulesHit: disqualificationRulesHit,
      productHypothesis: buildProductHypothesis(input, scores, decision),
      sevenDayPlan: buildSevenDayPlan(input, scores, decision),
      sevenDayAction: buildSevenDayPlan(input, scores, decision),
      thirtyDayPlan: thirtyDayPlan,
      thirtyDayValidation: thirtyDayPlan,
      contradictions: contradictions,
      pathTriage: pathTriage,
      primaryPath: pathTriage.firstPath,
      backupPath: pathTriage.backupPath,
      notRecommendedPath: pathTriage.notRecommendedPath,
      riskProfile: riskProfile,
      biggestMisjudgment: riskProfile.biggestMisread,
      productFit: productFit,
      consultReadiness: consultReadiness,
      adminLead: adminLead,
      nextMessage: adminLead.nextMessage,
      scripts: buildScripts(input, decision),
      nextStep: nextStep,
      consultBoundary: buildConsultBoundary(decision)
    };
  }

  var adaptiveDiagnostic = typeof globalThis !== 'undefined' ? globalThis.KevinAssessmentV3AdaptiveDiagnostic : null;
  if (!adaptiveDiagnostic && typeof require === 'function') {
    adaptiveDiagnostic = require('./assessment-v3/adaptive-diagnostic.js');
  }

  return {
    diagnosticDimensions: diagnosticDimensions,
    deepGroups: deepGroups,
    adaptiveBaseFieldIds: adaptiveDiagnostic ? adaptiveDiagnostic.adaptiveBaseFieldIds : [],
    getAdaptiveDeepGroups: adaptiveDiagnostic ? adaptiveDiagnostic.buildAdaptiveGroups : null,
    normalizeAdaptiveDeepData: adaptiveDiagnostic ? adaptiveDiagnostic.normalizeLegacyDeepData : null,
    computeCommercialDiagnostic: computeCommercialDiagnostic,
    // Round D 第 1 条：not_fit_now 的 cause 必须与 status 同时可见（供回归与审计断言）
    resolveNotFitCause: resolveNotFitCause,
    NOT_FIT_CAUSE_PROFILE: NOT_FIT_CAUSE_PROFILE,
    NOT_FIT_CAUSE_ORDER: NOT_FIT_CAUSE_ORDER,
    // Round D 第 2 条：唯一 canonical 付费真相（两处枚举表也导出供同源断言）
    resolvePaymentState: resolvePaymentState,
    PAID_BEFORE_LEVEL_MAP: PAID_BEFORE_LEVEL_MAP,
    COST_WILLINGNESS_PAID_MAP: COST_WILLINGNESS_PAID_MAP,
    WILLINGNESS_PAYMENT_DENIAL: WILLINGNESS_PAYMENT_DENIAL,
    LOW_FEASIBLE_HOURS: LOW_FEASIBLE_HOURS,
    // Round E 第 2 条：需求等级（旧档优先 / 可达字段自足）供两处消费
    demandLevelDetail: demandLevelDetail,
    getDemandLevel: getDemandLevel,
    // Round D 第 3 条：第 1 天的分档（供测试直接核对）
    sevenDayDayOne: sevenDayDayOne
  };
});
