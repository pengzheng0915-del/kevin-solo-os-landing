/*!
 * kevin-wechat-float.js — 微信号常驻组件 v2
 *
 * 【要解决的问题】
 * 全站多个页面反复引导访客"加微信发送报告编号和链接"，但：
 *   - 首页 / 测评结果页 / 文章页 只写"加微信"，不显示微信号；
 *   - /report/ 的二维码与微信号只在"报告读取失败"的报错分支里渲染，正常完成态完全看不到；
 *   - /diagnosis-sample/ 有文字号码但没有二维码。
 * 结果：用户照着提示去做，却拿不到微信号，转化在这里断掉。
 *
 * 【本组件】
 * 右下角常驻入口，点击展开二维码 + 微信号 + 一键复制。
 * - 自包含：样式内联注入，不依赖任何框架，不修改现有 DOM 结构
 * - 可逆：移除页面里的这一行 <script> 即完全恢复
 * - 安全：z-index 取 900（低于常见模态框），并自动检测全屏遮罩/弹窗，
 *         一旦页面上出现模态层就自动隐藏，避免遮挡 /report/ 的支付弹窗
 * - 后台页面（/fuye/admin*）不注入
 */
(function () {
  'use strict';
  if (window.__kevinWechatFloat) return;
  window.__kevinWechatFloat = 1;

  var WECHAT_ID = 'kevin0915';
  var QR_SRC = '/assets/wechat-qr.jpg?v=clean-20260704';   // 版本号与原站一致，复用已有缓存
  var Z = 900;                      // 克制层级：低于常见模态框

  var p = location.pathname || '';
  // Complete the assessment without a secondary floating contact target.
  if (/^\/(fuye\/quiz|report)(?:\/|$)/.test(p)) return;
  if (/\/(fuye\/admin|admin-trash)/.test(p)) return;

  var CSS = [
    '#kv-wf{position:fixed;right:18px;bottom:18px;z-index:' + Z + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Serif SC",serif}',
    '#kv-wf *{box-sizing:border-box}',
    '#kv-wf.kv-hide{display:none!important}',
    '#kv-wf-btn{display:flex;align-items:center;gap:8px;padding:11px 18px;border:0;border-radius:999px;',
    'background:#2D2926;color:#F6F1E8;font-size:14px;font-weight:600;letter-spacing:.02em;cursor:pointer;',
    'box-shadow:0 6px 22px rgba(45,41,38,.28);transition:transform .18s ease,box-shadow .18s ease;font-family:inherit}',
    '#kv-wf-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(45,41,38,.34)}',
    '#kv-wf-btn svg{width:17px;height:17px;fill:#B08A5A;flex:0 0 auto}',
    '#kv-wf.open #kv-wf-btn{transform:translateY(-2px)}',
    /* 克制的呼吸提示：仅在未展开时轻微提示可点击 */
    '@keyframes kv-wf-pulse{0%,100%{box-shadow:0 6px 22px rgba(45,41,38,.28),0 0 0 0 rgba(176,138,90,.42)}',
    '70%{box-shadow:0 6px 22px rgba(45,41,38,.28),0 0 0 12px rgba(176,138,90,0)}}',
    '#kv-wf:not(.open):not(.kv-seen) #kv-wf-btn{animation:kv-wf-pulse 2.6s ease-out 3}',
    '#kv-wf-card{position:absolute;right:0;bottom:62px;width:298px;background:#F6F1E8;border:1px solid rgba(176,138,90,.34);',
    'border-radius:18px;padding:20px 20px 18px;box-shadow:0 20px 50px rgba(45,41,38,.22);text-align:center;',
    'opacity:0;visibility:hidden;transform:translateY(10px) scale(.97);transform-origin:bottom right;',
    'transition:opacity .2s ease,transform .2s ease,visibility .2s}',
    '#kv-wf.open #kv-wf-card{opacity:1;visibility:visible;transform:translateY(0) scale(1)}',
    '#kv-wf-close{position:absolute;top:9px;right:11px;border:0;background:transparent;color:#9a8f80;',
    'font-size:20px;line-height:1;cursor:pointer;padding:2px 5px;border-radius:6px}',
    '#kv-wf-close:hover{color:#2D2926;background:rgba(45,41,38,.06)}',
    '#kv-wf-card h4{margin:0 0 4px;font-size:15px;font-weight:700;color:#2D2926;letter-spacing:.01em}',
    '#kv-wf-card p{margin:0 0 13px;font-size:12px;color:#6f6558;line-height:1.6}',
    '#kv-wf-qr{width:176px;height:176px;object-fit:contain;border-radius:12px;background:#fff;',
    'padding:7px;border:1px solid rgba(45,41,38,.10);display:block;margin:0 auto 11px}',
    '#kv-wf-id{font-size:12px;color:#6f6558;margin-bottom:9px}',
    '#kv-wf-id strong{color:#2D2926;font-size:14px;letter-spacing:.03em;font-weight:700}',
    '#kv-wf-copy{width:100%;padding:11px;border:1px solid #B08A5A;border-radius:11px;background:#fff;',
    'color:#2D2926;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .16s ease}',
    '#kv-wf-copy:hover{background:#B08A5A;color:#fff}',
    '#kv-wf-tip{margin-top:9px;font-size:11px;color:#9a8f80;line-height:1.55}',
    '#kv-wf-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:rgba(45,41,38,.94);',
    'color:#F6F1E8;padding:9px 18px;border-radius:999px;font-size:13px;z-index:' + (Z + 2) + ';opacity:0;',
    'transition:opacity .22s ease;pointer-events:none;font-family:inherit}',
    '@media(max-width:560px){',
    '#kv-wf{right:12px;bottom:12px}',
    '#kv-wf-btn{padding:10px 15px;font-size:13px}',
    '#kv-wf-card{width:min(86vw,286px);bottom:58px}',
    '#kv-wf-qr{width:152px;height:152px}',
    '}',
    '@media(prefers-reduced-motion:reduce){#kv-wf:not(.open) #kv-wf-btn{animation:none!important}}'
  ].join('');

  function toast(msg) {
    var t = document.getElementById('kv-wf-toast');
    if (!t) { t = document.createElement('div'); t.id = 'kv-wf-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t.__tm);
    t.__tm = setTimeout(function () { t.style.opacity = '0'; }, 2200);
  }

  function track(name) {
    try {
      if (window.clarity && typeof window.clarity === 'function') window.clarity('event', name);
      if (window._ktrack) window._ktrack(name);
    } catch (e) {}
  }

  /* 检测页面上是否出现了全屏遮罩/模态层 —— 出现时隐藏本组件，避免遮挡支付等关键操作 */
  function overlayOpen(box) {
    var kids = document.body.children, i, e, cs, r;
    for (i = 0; i < kids.length; i++) {
      e = kids[i];
      if (e === box || e.id === 'kv-wf-toast') continue;
      cs = window.getComputedStyle(e);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
      r = e.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.72 && r.height > window.innerHeight * 0.72) return true;
    }
    return false;
  }

  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var box = document.createElement('div');
    box.id = 'kv-wf';
    box.innerHTML =
      '<div id="kv-wf-card" role="dialog" aria-label="添加微信">' +
        '<button id="kv-wf-close" type="button" aria-label="关闭">×</button>' +
        '<h4>直接加微信</h4>' +
        '<p>发报告编号、截图或你想问的问题，我本人看。</p>' +
        '<img id="kv-wf-qr" src="' + QR_SRC + '" alt="Kevin 彭峥 微信二维码" width="176" height="176" loading="lazy">' +
        '<div id="kv-wf-id">微信号 <strong>' + WECHAT_ID + '</strong></div>' +
        '<button id="kv-wf-copy" type="button">复制微信号</button>' +
        '<div id="kv-wf-tip">长按二维码识别，或搜索上方微信号添加</div>' +
      '</div>' +
      '<button id="kv-wf-btn" type="button" aria-label="加微信">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 3C4.9 3 1.8 5.6 1.8 8.8c0 1.9 1.1 3.5 2.7 4.6l-.7 2.1 2.4-1.2c.7.2 1.4.3 2.1.3h.6c-.1-.4-.2-.9-.2-1.3 0-3 2.9-5.4 6.5-5.4h.6C15.4 5.1 12.4 3 8.7 3zm-2.4 3.4c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm4.9 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/><path d="M22.2 13.3c0-2.7-2.6-4.9-5.8-4.9s-5.8 2.2-5.8 4.9 2.6 4.9 5.8 4.9c.6 0 1.2-.1 1.7-.2l2 1-.5-1.7c1.5-.9 2.6-2.3 2.6-4zm-7.7-1.2c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7zm3.9 0c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7z"/></svg>' +
        '<span>加微信</span>' +
      '</button>';
    document.body.appendChild(box);

    var btn = document.getElementById('kv-wf-btn');
    var close = document.getElementById('kv-wf-close');
    var copy = document.getElementById('kv-wf-copy');

    try {
      if (sessionStorage.getItem('kv_wf_seen')) box.classList.add('kv-seen');
    } catch (e) {}

    btn.addEventListener('click', function () {
      var open = box.classList.toggle('open');
      box.classList.add('kv-seen');
      try { sessionStorage.setItem('kv_wf_seen', '1'); } catch (e) {}
      track(open ? 'wechat_float_open' : 'wechat_float_close');
    });
    close.addEventListener('click', function () {
      box.classList.remove('open');
      track('wechat_float_close');
    });
    document.addEventListener('click', function (e) {
      if (box.classList.contains('open') && !box.contains(e.target)) box.classList.remove('open');
    });
    copy.addEventListener('click', function () {
      track('wechat_float_copy');
      var done = function () { toast('微信号已复制：' + WECHAT_ID); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(WECHAT_ID).then(done).catch(function () { toast('微信号：' + WECHAT_ID); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = WECHAT_ID;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('微信号：' + WECHAT_ID); }
        document.body.removeChild(ta);
      }
    });

    /* 遮罩/模态检测：出现全屏层时自动隐藏，避免遮挡支付弹窗等关键操作 */
    var last = false;
    var tick = function () {
      var busy = overlayOpen(box);
      if (busy !== last) {
        last = busy;
        box.classList.toggle('kv-hide', busy);
        if (busy) box.classList.remove('open');
      }
      setTimeout(tick, 450);
    };
    setTimeout(tick, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
