const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🚀 开始生成朋友圈宣传图片...');

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  // 设置视口大小为 1080x1080（朋友圈正方形）
  await page.setViewportSize({ width: 1080, height: 1080 });

  const promoFiles = [
    { file: 'promo-1.html', output: 'wechat-moments/promo-1.png', name: '主标题宣传图' },
    { file: 'promo-2.html', output: 'wechat-moments/promo-2.png', name: '核心价值宣传图' },
    { file: 'promo-3.html', output: 'wechat-moments/promo-3.png', name: '定价宣传图' }
  ];

  for (const promo of promoFiles) {
    console.log(`📸 正在截取 ${promo.name}...`);

    await page.goto(`http://localhost:8000/${promo.file}`, {
      waitUntil: 'networkidle'
    });

    // 等待渲染完成
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: promo.output,
      fullPage: false
    });

    console.log(`✅ ${promo.name} 截图完成`);
  }

  await browser.close();

  console.log('\n🎉 所有截图生成完成！');
  console.log('📁 图片保存位置: wechat-moments/ 文件夹');
  console.log('\n生成的图片：');
  console.log('  1. promo-1.png - 主标题和价值主张');
  console.log('  2. promo-2.png - 三大核心价值');
  console.log('  3. promo-3.png - 定价方案');
  console.log('\n现在可以发朋友圈了！🚀');
})();
