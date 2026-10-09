(() => {
  const button = document.getElementById('copy-consultation-wechat');
  const value = document.getElementById('consultation-wechat');
  const status = document.getElementById('consultation-copy-status');
  if (!button || !value || !status) return;
  button.addEventListener('click', async () => {
    const wechat = value.textContent.trim();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(wechat);
      status.textContent = '微信号已复制。请在微信添加好友，发送“诊断咨询”和你的核心问题。';
    } catch {
      status.textContent = `请长按或选中上方微信号手动复制：${wechat}`;
    }
  });
})();
