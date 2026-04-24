const { chromium } = require('playwright');

(async () => {
  console.log('🚀 开始生成朋友圈宣传图片...');

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  // 设置视口大小（适合移动端和朋友圈）
  await page.setViewportSize({ width: 1080, height: 1920 });

  // 打开落地页（使用本地服务器）
  console.log('📄 正在加载页面...');
  await page.goto('http://localhost:8000', {
    waitUntil: 'networkidle'
  });

  // 等待动画完成
  await page.waitForTimeout(2000);

  // 强制让所有元素可见（解决 opacity: 0 的问题）
  await page.evaluate(() => {
    // 移除所有 fade-in 类，添加 visible 类
    document.querySelectorAll('.fade-in').forEach(el => {
      el.classList.add('visible');
    });
    // 确保 hero 区域可见
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.classList.add('visible');
      hero.style.opacity = '1';
    }
    // 确保所有 section 可见
    document.querySelectorAll('section').forEach(el => {
      el.style.opacity = '1';
    });
  });

  // 等待 CSS 过渡完成
  await page.waitForTimeout(1000);

  console.log('📸 正在截取 Hero 区域...');
  // 滚动到页面顶部
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  // 截取视口（Hero 区域应该在顶部可见）
  await page.screenshot({
    path: 'wechat-moments/01-hero-section.png'
  });
  console.log('✅ Hero 区域截图完成');

  console.log('📸 正在截取核心价值区域...');
  // 滚动到 benefits 区域
  await page.evaluate(() => {
    const element = document.querySelector('.benefits');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  await page.waitForTimeout(1000);
  // 截取视口
  await page.screenshot({
    path: 'wechat-moments/02-benefits-section.png'
  });
  console.log('✅ 核心价值区域截图完成');

  console.log('📸 正在截取定价区域...');
  // 滚动到 pricing 区域
  await page.evaluate(() => {
    const element = document.querySelector('.pricing');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  await page.waitForTimeout(1000);
  // 截取视口
  await page.screenshot({
    path: 'wechat-moments/03-pricing-section.png'
  });
  console.log('✅ 定价区域截图完成');

  await browser.close();

  console.log('\n🎉 所有截图生成完成！');
  console.log('📁 图片保存位置: wechat-moments/ 文件夹');
  console.log('\n生成的图片：');
  console.log('  1. 01-hero-section.png - 主标题和价值主张');
  console.log('  2. 02-benefits-section.png - 三大核心价值');
  console.log('  3. 03-pricing-section.png - 定价方案');
  console.log('\n现在可以发朋友圈了！🚀');
})();
