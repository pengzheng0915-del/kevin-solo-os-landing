const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 开始生成朋友圈宣传图片...');

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  // 设置视口大小（适合移动端和朋友圈）
  await page.setViewport({ width: 1080, height: 1920 });

  // 打开落地页
  await page.goto('file:///C:/Users/pengz/.halo/spaces/25db4306-24c2-409e-b960-316f7e543917/kevin-solo-os-landing/index.html', {
    waitUntil: 'networkidle0'
  });

  // 等待动画完成
  await page.waitForTimeout(2000);

  console.log('📸 正在截取 Hero 区域...');
  // 截取 Hero 区域
  const heroSection = await page.$('.hero');
  if (heroSection) {
    await heroSection.screenshot({
      path: 'wechat-moments/01-hero-section.png'
    });
    console.log('✅ Hero 区域截图完成');
  }

  console.log('📸 正在截取核心价值区域...');
  // 截取核心价值区域
  const benefitsSection = await page.$('.benefits');
  if (benefitsSection) {
    await benefitsSection.screenshot({
      path: 'wechat-moments/02-benefits-section.png'
    });
    console.log('✅ 核心价值区域截图完成');
  }

  console.log('📸 正在截取定价区域...');
  // 截取定价区域
  const pricingSection = await page.$('.pricing');
  if (pricingSection) {
    await pricingSection.screenshot({
      path: 'wechat-moments/03-pricing-section.png'
    });
    console.log('✅ 定价区域截图完成');
  }

  await browser.close();

  console.log('\n🎉 所有截图生成完成！');
  console.log('📁 图片保存位置: wechat-moments/ 文件夹');
  console.log('\n生成的图片：');
  console.log('  1. 01-hero-section.png - 主标题和价值主张');
  console.log('  2. 02-benefits-section.png - 三大核心价值');
  console.log('  3. 03-pricing-section.png - 定价方案');
  console.log('\n现在可以发朋友圈了！🚀');
})();
