(function () {
  const typeKeys = ['content', 'consulting', 'knowledge', 'template', 'service', 'coaching'];

  const baseQuestions = [
    {
      axis: 'direction',
      q: '别人最常因为哪类问题来问你？',
      help: '这一题了解别人曾因什么问题找你。暂时没人来问，不等于你没有可用经验；请按实际情况回答。',
      opts: [
        { v: 'A', t: '基本没人问我具体问题', d: '我有经历，但还没有被别人当成某类问题的解决者。', score: 1, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '常问我判断和建议', d: '别人会问我怎么看、该怎么选、哪里容易判断错、下一步怎么做。', score: 3, types: { content: 1, consulting: 4, knowledge: 1, template: 0, service: 1, coaching: 1 } },
        { v: 'C', t: '常问我要资料、流程或方法', d: '别人更需要我的清单、模板、SOP、资料包或方法步骤。', score: 3, types: { content: 1, consulting: 1, knowledge: 3, template: 4, service: 1, coaching: 0 } },
        { v: 'D', t: '常让我帮忙推进或带着做', d: '别人不只是听建议，还希望我帮他落地、陪他推进、一起解决。', score: 3, types: { content: 0, consulting: 2, knowledge: 0, template: 1, service: 4, coaching: 4 } }
      ]
    },
    {
      axis: 'proof',
      q: '你目前有哪些经验相关材料或反馈？',
      help: '信任不是靠自我介绍建立的。客户需要看到案例、作品、反馈、过程记录或结果证据。',
      opts: [
        { v: 'A', t: '只有经历，没有证据', d: '我做过不少事，但还拿不出能给别人看的材料。', score: 1, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '有几个零散案例', d: '我能想起一些项目、问题、成果，但还没整理成可展示材料。', score: 2, types: { content: 1, consulting: 2, knowledge: 1, template: 1, service: 2, coaching: 1 } },
        { v: 'C', t: '有作品、文档或方法材料', d: '我有文章、方案、培训材料、表格、流程、复盘或项目材料。', score: 3, types: { content: 2, consulting: 1, knowledge: 4, template: 3, service: 1, coaching: 1 } },
        { v: 'D', t: '有明确反馈、结果或转介绍', d: '有人因为我的帮助受益、反馈、复购、转介绍或愿意继续聊。', score: 4, types: { content: 1, consulting: 3, knowledge: 1, template: 1, service: 4, coaching: 3 } }
      ]
    },
    {
      axis: 'mode',
      q: '你更擅长用哪种方式交付价值？',
      help: '不是每个人都适合公开表达、做内容或陪跑。选你最自然、最能稳定交付的方式。',
      opts: [
        { v: 'A', t: '我还不确定', d: '我知道自己有经验，但不确定该讲、写、咨询还是服务。', score: 1, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '公开表达观点和案例', d: '我能通过文章、视频、直播、朋友圈把观点讲清楚。', score: 3, types: { content: 5, consulting: 1, knowledge: 2, template: 0, service: 0, coaching: 0 } },
        { v: 'C', t: '一对一沟通和判断', d: '我更适合听完一个人的情况后，帮他拆问题、做判断。', score: 3, types: { content: 0, consulting: 5, knowledge: 0, template: 0, service: 1, coaching: 2 } },
        { v: 'D', t: '写成材料、工具或流程', d: '我更擅长把复杂经验整理成文档、模板、清单、SOP。', score: 3, types: { content: 1, consulting: 0, knowledge: 4, template: 5, service: 1, coaching: 0 } }
      ]
    },
    {
      axis: 'structure',
      q: '你的经验能不能被写成一份别人拿得走的材料？',
      help: '这一题了解你目前能否自行整理经验。不会写不等于没有经验，也不代表必须先学会整理才能请人协助开发。',
      opts: [
        { v: 'A', t: '还停留在脑子里', d: '我能讲，但一写就散，不知道怎么组织。', score: 1, types: { content: 0, consulting: 1, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '能写成案例或复盘', d: '我可以写出问题、过程、动作、结果，但还不够系统。', score: 2, types: { content: 3, consulting: 2, knowledge: 2, template: 0, service: 1, coaching: 1 } },
        { v: 'C', t: '能写成清单、模板或流程', d: '我能拆出步骤、表格、检查清单、话术或 SOP。', score: 3, types: { content: 1, consulting: 1, knowledge: 3, template: 5, service: 2, coaching: 1 } },
        { v: 'D', t: '已经有体系或可交付材料', d: '我已经有知识库、内容大纲、服务流程、工具包或标准交付物。', score: 4, types: { content: 1, consulting: 2, knowledge: 5, template: 4, service: 3, coaching: 2 } }
      ]
    },
    {
      axis: 'signal',
      q: '你的经验有没有出现过真实需求信号？',
      help: '不是你觉得有价值，而是别人愿意反馈、请教、转发、付费，或投入时间继续聊。',
      opts: [
        { v: 'A', t: '暂时没有信号', d: '我还没有公开验证，或者发出去基本没人回应。', score: 1, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '有人反馈或感兴趣', d: '有人点赞、评论、私聊、收藏、转发，但还没形成明确需求。', score: 2, types: { content: 3, consulting: 1, knowledge: 2, template: 1, service: 0, coaching: 0 } },
        { v: 'C', t: '有人主动请教或咨询', d: '已经有人带着具体问题来问我，但我还没稳定收费。', score: 3, types: { content: 1, consulting: 5, knowledge: 1, template: 0, service: 2, coaching: 2 } },
        { v: 'D', t: '有人付费、复购或转介绍', d: '已经出现真实付费、复购、转介绍，或很明确的购买意向。', score: 4, types: { content: 1, consulting: 3, knowledge: 2, template: 2, service: 5, coaching: 4 } }
      ]
    },
    {
      axis: 'deliveryFit',
      q: '如果明天就要做一个最小产品，你最想做哪一种？',
      help: '这一题了解你当前的交付偏好，不是终局选择，也不能证明商业可行；你也可以明确选择先处理主业或职业方向。',
      opts: [
        { v: 'A', t: '一组内容或观点文章', d: '先用内容表达观点，观察哪类问题最能引发反馈。', score: 4, types: { content: 5, consulting: 0, knowledge: 1, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '一次有明确边界的问题诊断', d: '先用一对一问题拆解，判断对方到底卡在哪里。', score: 4, types: { content: 0, consulting: 5, knowledge: 0, template: 0, service: 1, coaching: 1 } },
        { v: 'C', t: '一份知识库/报告/模板', d: '先把经验做成可购买、可交付、可反复使用的资料。', score: 4, types: { content: 0, consulting: 0, knowledge: 5, template: 5, service: 0, coaching: 0 } },
        { v: 'D', t: '一个小服务或短陪跑', d: '先帮一个具体对象推进结果，用交付换案例和反馈。', score: 4, types: { content: 0, consulting: 1, knowledge: 0, template: 0, service: 5, coaching: 5 } },
        { v: 'E', t: '暂不产品化，先处理主业或职业方向', d: '我想先确认现有工作、求职或职业再定位，不把做产品当作默认目标。', score: 4, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } }
      ]
    },
    {
      axis: 'constraint',
      q: '你现在最大的现实限制是什么？',
      help: '时间、现金流和家庭责任都会影响选择，请按实际情况回答。',
      opts: [
        { v: 'A', t: '时间和精力很少', d: '我不能承受长期试错，只能做低成本、低维护动作。', score: 1, types: { content: 1, consulting: 0, knowledge: 2, template: 2, service: 0, coaching: 0 } },
        { v: 'B', t: '现金流压力比较大', d: '我需要尽快判断方向，不能继续把钱和精力投错地方。', score: 2, types: { content: 0, consulting: 3, knowledge: 1, template: 1, service: 3, coaching: 0 } },
        { v: 'C', t: '方向太多，不知道选哪个', d: '内容、咨询、工具、服务都想做，但缺少判断标准。', score: 2, types: { content: 1, consulting: 4, knowledge: 1, template: 1, service: 1, coaching: 1 } },
        { v: 'D', t: '知道方向，但缺获客和系统', d: '我已经有一点基础，现在缺持续触达、案例沉淀和交付体系。', score: 3, types: { content: 3, consulting: 2, knowledge: 2, template: 1, service: 2, coaching: 3 } }
      ]
    },
    {
      axis: 'validationWill',
      q: '接下来 7 天，你愿意做哪种验证？',
      help: '真正的判断来自行动。你愿意验证到哪一步，决定下一步适不适合收费和咨询。',
      opts: [
        { v: 'A', t: '暂时不想公开或找人聊', d: '我还想再准备一下，不想被别人评价或拒绝。', score: 1, types: { content: 0, consulting: 0, knowledge: 0, template: 0, service: 0, coaching: 0 } },
        { v: 'B', t: '愿意发一次内容测试反馈', d: '我可以发一条内容或案例，看看有没有真实回应。', score: 2, types: { content: 4, consulting: 0, knowledge: 1, template: 0, service: 0, coaching: 0 } },
        { v: 'C', t: '愿意找 3 个人做问题访谈', d: '我可以直接找目标对象，听真实问题，而不是自己猜。', score: 3, types: { content: 1, consulting: 4, knowledge: 1, template: 1, service: 1, coaching: 2 } },
        { v: 'D', t: '愿意设计一次低门槛付费验证', d: '我愿意先确认对象、交付边界和可承受成本，再尝试一次小范围付费验证，不预设价格。', score: 4, types: { content: 0, consulting: 4, knowledge: 2, template: 2, service: 4, coaching: 3 } }
      ]
    }
  ];

  const axisLabels = {
    direction: '需求入口',
    proof: '信任证据',
    mode: '交付方式',
    structure: '结构化材料',
    signal: '市场信号',
    deliveryFit: '最小产品',
    constraint: '现实限制',
    validationWill: '验证意愿'
  };

  const typeProfiles = {
    content: {
      name: '内容表达型倾向',
      desc: '你适合先用观点、案例和内容被别人看见。但内容只是验证工具，不是目的；你要围绕一个具体人群和具体问题持续表达。'
    },
    consulting: {
      name: '咨询诊断型倾向',
      desc: '你的价值更像判断力和问题拆解能力。你适合先做边界清楚的一对一路径诊断，而不是低价陪聊或盲目卖资料。'
    },
    knowledge: {
      name: '知识产品型倾向',
      desc: '你的经验适合沉淀成知识库、报告、方法论或清单。重点是先验证别人愿意为哪个具体问题付费，不要一上来做复杂产品。'
    },
    template: {
      name: '模板工具型倾向',
      desc: '你的经验适合拆成模板、表格、SOP、话术或工具。优势是轻交付，风险是没有具体场景时会变成没人用的资料。'
    },
    service: {
      name: '服务交付型倾向',
      desc: '你的经验更适合变成具体服务包。客户不是买你的履历，而是买一次清楚的结果、边界和交付过程。'
    },
    coaching: {
      name: '陪跑交付型倾向',
      desc: '你适合持续陪伴和推进别人完成动作。但陪跑对信任、边界和耐心要求高，不适合一开始就做重服务。'
    }
  };

  const bottleneckProfiles = {
    direction: { name: '需求入口不清', desc: '你还没有找到别人最愿意因为什么问题来找你。先别急着做产品，先找真实问题。' },
    proof: { name: '信任证据不足', desc: '你可能有能力，但客户看不到证据。需要先把案例、作品、反馈和过程记录整理出来。' },
    mode: { name: '交付方式未定', desc: '你还没判断自己适合公开表达、一对一问题判断、写材料，还是做服务。方式选错，后面都会费力。' },
    structure: { name: '经验还没结构化', desc: '你的经验还停在脑子里，没有变成别人能拿走、能使用、能复购的材料。' },
    signal: { name: '缺少真实需求信号', desc: '你还没有足够市场反馈。继续闭门打磨，会把时间花在不确定的方向上。' },
    deliveryFit: { name: '第一交付物不清', desc: '你不知道第一版该做内容、诊断、知识库、模板、服务还是陪跑，所以容易一直绕圈。' },
    constraint: { name: '现实限制未处理', desc: '时间、现金流、家庭责任都会影响路径选择。忽略限制，方案再漂亮也落不了地。' },
    validationWill: { name: '验证动作不足', desc: '你现在最缺的不是更多想法，而是一次足够小、足够真实、足够快的验证。' }
  };

  const levelProfiles = [
    { max: 42, level: '经验盘点期', headline: '你不是没有经验，是经验还没有被整理成可判断的资产。', summary: '现在最危险的是继续盲目投入工具、包装和复杂项目，继续收集信息，继续等状态。你需要先把过去做过的事拆开，找出能解决别人问题的那一部分。' },
    { max: 58, level: '方向校准期', headline: '你有积累，但第一路径还没判断清楚。', summary: '你现在容易在内容、咨询、工具、服务之间来回摇摆。真正该做的是先确定一个人群、一个问题、一个最小交付。' },
    { max: 74, level: '需求验证期', headline: '你的经验已经有机会变成产品，但还需要真实反馈。', summary: '你已经不只是空想了。下一步不是再学更多，而是把方法、案例、证据和交付方式拿去做低成本验证。' },
    { max: 100, level: '早期付费/系统放大期', headline: '你已经有经验资产雏形，下一步是系统化。', summary: '你现在最该做的不是换方向，而是把已有反馈、案例和交付边界固定下来，再考虑提价和放大。' }
  ];

  const riskProfiles = [
    { condition: (score) => score <= 42, name: '继续用学习逃避萃取', desc: '你现在再盲目投入工具、包装或项目，很可能只是延迟面对真正问题：你还没有把自己的经验讲清楚。' },
    { condition: (_, minAxis) => minAxis === 'signal', name: '自我感觉很好，但市场没有反馈', desc: '没有真实反馈之前，所有定位都只是猜测。你需要先拿一个小表达或一次访谈去换反馈。' },
    { condition: (_, minAxis) => minAxis === 'deliveryFit', name: '第一交付物不清，动作越多越乱', desc: '如果不知道第一版交付物是什么，内容、社群、知识库和服务都会变成假动作。' },
    { condition: (_, minAxis) => minAxis === 'constraint', name: '忽略现实限制，方案会落空', desc: '35 岁以后不能只看热情。时间、现金流和家庭责任最好一起放进路径选择里。' },
    { condition: () => true, name: '把复杂问题误判成努力不够', desc: '你不是不努力，而是还没把经验、问题、产品和验证放在同一条线上。' }
  ];

  const actionProfiles = {
    direction: { name: '写出一个真实需求入口', desc: '今天只做一件事：写下“别人最常因为什么问题来问我”。写不出来，就先不要做产品。' },
    proof: { name: '整理 3 个信任证据', desc: '列出 3 个最能证明你靠谱的项目、反馈、成果或过程记录。没有证据，先补证据。' },
    mode: { name: '判断你的第一交付方式', desc: '从内容、诊断、知识库、模板、服务、陪跑里只选一个最小起点，不要同时做。' },
    structure: { name: '写一页纸方法结构', desc: '选一个熟悉的问题，记录当时怎样判断和行动；难以整理时可保留口述材料，再决定自行整理还是寻求协助。' },
    signal: { name: '拿 3 个真实反馈', desc: '找 3 个目标对象问同一个问题，看他们是否愿意继续聊、试用或付费。' },
    deliveryFit: { name: '设计一个最小交付物', desc: '写清楚：适合谁、解决什么、交付什么、不包含什么、如何判断有效。' },
    constraint: { name: '按现实限制砍掉假动作', desc: '如果时间少，就别做重服务；如果现金流紧，就别盲目投入工具、包装和项目。先选最低成本验证。' },
    validationWill: { name: '发起一次 7 天内验证', desc: '不要继续准备。用一条内容、一次访谈或一个小交付，换一次真实反馈。' }
  };

  const diagnosticStatuses = {
    career_first: {
      label: '先处理主业或职业方向',
      headline: '暂不产品化，也是清楚的选择',
      summary: '你的经验仍然可以服务于主业升级、求职和职业再定位。本轮不建议为了做产品而额外投入。',
      reason: '你明确选择了先处理职业路径；这种选择不代表经验不足，也不影响已有证据的判断。',
      avoid: '不把辞职、做内容、卖服务或购买人工诊断当作必经步骤。',
      sevenDayAction: '选一个当前主业或求职问题，整理一段相关经历与结果，找了解该岗位的人核对是否有用。',
      recommend99: true,
      recommendConsult: false
    },
    not_fit_now: {
      label: '当前需要补充经验线索',
      headline: '先整理具体经历，再判断下一步',
      summary: '这些回答还不足以确定下一步。可以先整理真实事件、遇到的问题与现有反馈；不会整理不等于没有经验。',
      reason: '当前答案主要说明信息还不够，不能据此判断你没有经验或不适合形成自己的专业方法。',
      avoid: '暂时不要只凭这次选择题作出重投入决定。',
      sevenDayAction: '整理 1—3 件真实事件，记录当时的问题、你的判断、采取的动作和实际结果。',
      recommend99: false,
      recommendConsult: false
    },
    validate_first: {
      label: '先低成本验证',
      headline: '方向有机会，但不能马上加码',
      summary: '你已经有一些积累，但还需要用真实反馈证明问题存在。先做一个足够小的验证，再决定是否继续投入。',
      reason: '当前卡点不是知识不够，而是需求、证据或交付物还没有被外部反馈确认。',
      avoid: '不要同时试很多方向，也不要先做大而全资料、训练营或复杂工具。',
      sevenDayAction: '找 3 个目标对象问同一个问题，确认他们是否愿意继续聊、试用或付小钱。',
      recommend99: true,
      recommendConsult: false
    },
    content_expression: {
      label: '适合做内容表达',
      headline: '先用内容找到第一批真实问题',
      summary: '你的经验适合先通过观点、案例和公开表达被看见。内容只是验证工具，不是最终目的。',
      reason: '你的表达和案例倾向更强，适合先观察哪些问题会引发具体反馈。',
      avoid: '不要追热点，不要做泛泛人设，也不要把内容当成唯一产品。',
      sevenDayAction: '发 1 条案例型内容，只讲一个具体问题和你的判断，观察谁来追问。',
      recommend99: true,
      recommendConsult: false
    },
    knowledge_product: {
      label: '适合做知识产品',
      headline: '先把经验整理成低成本自学材料',
      summary: '你的经验更适合沉淀成报告、清单、自学包或方法结构。关键是先验证别人愿意为哪个问题付费。',
      reason: '你的结构化材料和知识沉淀倾向更强，适合先做低价、边界清楚的判断产品。',
      avoid: '不要一上来录大课、做大知识库，或把所有内容一次性堆进去。',
      sevenDayAction: '写出一份 1 页清单：适合谁、解决什么、包含什么、不包含什么。',
      recommend99: true,
      recommendConsult: false
    },
    consulting_diagnosis: {
      label: '适合做咨询诊断',
      headline: '你的价值更像判断力和问题拆解',
      summary: '你适合先把一次诊断做清楚：帮谁判断什么、输出什么、不包含什么。',
      reason: '你的回答显示一对一判断、需求信号和问题拆解更强，适合用低风险诊断验证。',
      avoid: '不要做低价陪聊、无限答疑，也不要在边界不清时承诺长期结果。',
      sevenDayAction: '设计一次 45-60 分钟诊断说明，写清交付物和不包含范围。',
      recommend99: true,
      recommendConsult: false
    },
    template_tool: {
      label: '适合做模板工具',
      headline: '先做一个能直接拿去用的小工具',
      summary: '你的经验适合拆成模板、SOP、检查清单或话术。工具最好服务一个具体场景。',
      reason: '你的流程化和材料化倾向更强，适合用一个小模板验证具体需求。',
      avoid: '不要做大而全工具库，也不要为了完美迟迟不发布。',
      sevenDayAction: '把一个高频场景压成一页纸模板，找 3 个人试用并要反馈。',
      recommend99: true,
      recommendConsult: false
    },
    service_delivery: {
      label: '适合做服务交付',
      headline: '先用边界清楚的小服务换反馈',
      summary: '你的经验更适合变成具体服务包。客户买的不是履历，而是一次可理解、可交付的结果。',
      reason: '你的推进、交付和付费信号更强，可以开始设计小服务，但建议先控制范围。',
      avoid: '不要什么都接，不要按小时零散出售，也不要承诺无法稳定交付的结果。',
      sevenDayAction: '写出一个小服务包：对象、问题、交付物、周期、价格和不包含范围。',
      recommend99: true,
      recommendConsult: true
    },
    consult_ready: {
      label: '可以考虑预约职业经验资产一对一诊断',
      headline: '可以进一步了解人工方向判断',
      summary: '你的回答提供了一些经验与需求线索。如果仍有具体方向取舍，可了解1999元服务；是否适配还需结合真实经历由Kevin确认。',
      reason: '选择题提供的是线索，不是已核实的事实。需要结合真实经历与材料，才能进一步判断服务是否适配。',
      avoid: '不要再长期免费答疑，也不要在没有交付边界时直接放大。',
      sevenDayAction: '整理 3 个代表性案例和当前最卡的问题，作为预约职业经验资产一对一诊断前的材料。',
      recommend99: true,
      recommendConsult: true
    }
  };

  const tieBreakAxes = ['signal', 'validationWill', 'deliveryFit', 'proof', 'structure', 'direction', 'mode', 'constraint'];

  function cloneTypes(types) {
    const out = {};
    typeKeys.forEach((key) => { out[key] = Number(types && types[key]) || 0; });
    return out;
  }

  function normalizeScores(scores) {
    const out = {};
    typeKeys.forEach((key) => { out[key] = Number(scores && scores[key]) || 0; });
    if (scores && scores.consult !== undefined) out.consulting = Number(scores.consult) || out.consulting;
    if (scores && scores.tool !== undefined) out.template = Number(scores.tool) || out.template;
    return out;
  }

  function getTypeMax() {
    const max = Object.fromEntries(typeKeys.map((key) => [key, 0]));
    baseQuestions.forEach((q) => {
      typeKeys.forEach((key) => {
        max[key] += Math.max.apply(null, q.opts.map((o) => Number(o.types[key]) || 0));
      });
    });
    return max;
  }

  const typeMax = getTypeMax();

  function pickTopType(scores) {
    const normalized = normalizeScores(scores);
    let best = 'content';
    let bestRatio = -1;
    const typeTieBreak = ['consulting', 'content', 'knowledge', 'template', 'service', 'coaching'];
    typeTieBreak.forEach((key) => {
      const ratio = (normalized[key] || 0) / Math.max(1, typeMax[key] || 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = key;
      }
    });
    return best;
  }

  function pickBottleneckAxis(axisScores) {
    const entries = Object.entries(axisScores || {});
    if (!entries.length) return 'direction';
    const min = Math.min.apply(null, entries.map(([, value]) => Number(value) || 0));
    const lows = entries.filter(([, value]) => (Number(value) || 0) === min).map(([key]) => key);
    for (const key of tieBreakAxes) {
      if (lows.includes(key)) return key;
    }
    return lows[0] || 'direction';
  }

  function normalizeAnswerMap(answers) {
    const out = {};
    if (Array.isArray(answers)) {
      baseQuestions.forEach((q, index) => {
        const value = answers[index];
        if (typeof value === 'number') {
          out[q.axis] = q.opts[value] ? q.opts[value].v : null;
        } else {
          out[q.axis] = String(value || '').trim().toUpperCase() || null;
        }
      });
      return out;
    }
    baseQuestions.forEach((q, index) => {
      const value = answers && (answers[q.axis] ?? answers[index] ?? answers['q' + index]);
      if (typeof value === 'number') {
        out[q.axis] = q.opts[value] ? q.opts[value].v : null;
      } else {
        const raw = String(value || '').trim().toUpperCase();
        out[q.axis] = raw.length === 1 ? raw : null;
      }
    });
    return out;
  }

  function computeQuizResult(answers) {
    const answerMap = normalizeAnswerMap(answers);
    const axisScores = {};
    const scores = Object.fromEntries(typeKeys.map((key) => [key, 0]));
    let rawScore = 0;
    let maxScore = 0;
    baseQuestions.forEach((q) => {
      const picked = answerMap[q.axis];
      const opt = q.opts.find((item) => item.v === picked) || q.opts[0];
      rawScore += opt.score || 0;
      maxScore += Math.max.apply(null, q.opts.map((item) => item.score || 0));
      axisScores[q.axis] = opt.score || 0;
      typeKeys.forEach((key) => {
        scores[key] += Number(opt.types[key]) || 0;
      });
    });
    const score = Math.round((rawScore / Math.max(1, maxScore)) * 100);
    const topType = pickTopType(scores);
    const minAxis = pickBottleneckAxis(axisScores);
    return { score, scores, axisScores, topType, minAxis, answerMap };
  }

  function inferDiagnosticStatus(result) {
    const a = result.answerMap || {};
    if (a.deliveryFit === 'E') return 'career_first';
    const axis = result.axisScores || {};
    const lowProof = (axis.proof || 0) <= 1;
    const lowDirection = (axis.direction || 0) <= 1;
    const noSignal = (axis.signal || 0) <= 1;
    const noValidation = (axis.validationWill || 0) <= 1;
    if (result.score <= 42 || ((lowProof || lowDirection) && noSignal && noValidation)) return 'not_fit_now';
    if (result.score >= 78 && (a.signal === 'D' || a.proof === 'D') && a.validationWill === 'D') {
      if (result.topType === 'consulting' || a.deliveryFit === 'B') return 'consult_ready';
      if (result.topType === 'service' || a.deliveryFit === 'D') return 'service_delivery';
    }
    if (result.score < 60 || noSignal || noValidation) return 'validate_first';
    if ((axis.proof || 0) <= 2 && (axis.signal || 0) <= 2 && (axis.validationWill || 0) <= 2) return 'validate_first';
    if (a.deliveryFit === 'D' || result.topType === 'service' || result.topType === 'coaching') return 'service_delivery';
    if (a.deliveryFit === 'B' || result.topType === 'consulting') return 'consulting_diagnosis';
    if (a.deliveryFit === 'C' && a.structure === 'C') return 'template_tool';
    if (a.deliveryFit === 'C' || result.topType === 'knowledge') return 'knowledge_product';
    if (a.deliveryFit === 'A' || result.topType === 'content') return 'content_expression';
    if (result.topType === 'template') return 'template_tool';
    return 'validate_first';
  }

  function computeQuizDiagnostic(answers) {
    const result = computeQuizResult(answers);
    const status = inferDiagnosticStatus(result);
    const base = diagnosticStatuses[status] || diagnosticStatuses.validate_first;
    const bottleneck = bottleneckProfiles[result.minAxis] || bottleneckProfiles.direction;
    return {
      status,
      label: base.label,
      headline: base.headline,
      summary: base.summary,
      reason: base.reason,
      bottleneck: bottleneck.name,
      bottleneckDesc: bottleneck.desc,
      avoid: base.avoid,
      sevenDayAction: base.sevenDayAction,
      recommend99: base.recommend99,
      recommendConsult: base.recommendConsult,
      score: result.score,
      type: result.topType,
      typeName: status === 'career_first' ? '职业路径优先（暂不产品化）' : (typeProfiles[result.topType] || typeProfiles.content).name,
      axisScores: result.axisScores,
      typeScores: result.scores,
      minAxis: result.minAxis,
      answerMap: result.answerMap
    };
  }

  function toFuyeQuestions() {
    return baseQuestions.map((q) => ({
      id: q.axis,
      title: q.q,
      desc: q.help,
      options: q.opts.map((o) => ({
        key: o.v,
        text: o.t,
        note: o.d,
        score: o.score,
        types: cloneTypes(o.types)
      }))
    }));
  }

  function toReportQuestions() {
    return baseQuestions.map((q) => ({
      axis: q.axis,
      q: q.q,
      help: q.help,
      opts: q.opts.map((o) => ({
        v: o.v,
        t: o.t,
        d: o.d,
        score: o.score,
        types: cloneTypes(o.types)
      }))
    }));
  }

  window.KevinQuizModel = {
    typeKeys,
    typeMax,
    axisLabels,
    typeProfiles,
    bottleneckProfiles,
    levelProfiles,
    riskProfiles,
    actionProfiles,
    diagnosticStatuses,
    fuyeQuestions: toFuyeQuestions(),
    reportQuestions: toReportQuestions(),
    pickTopType,
    pickBottleneckAxis,
    computeQuizDiagnostic,
    normalizeScores
  };
})();
