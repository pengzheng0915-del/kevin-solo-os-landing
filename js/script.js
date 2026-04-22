/**
 * KEVIN SOLO-OS Landing Page
 * Interactive Functionality
 */

document.addEventListener('DOMContentLoaded', function() {

    // === Scroll Reveal Animations ===
    // 使用 Intersection Observer 实现滚动时的淡入动画

    const observerOptions = {
        threshold: 0.1, // 元素进入视口 10% 时触发
        rootMargin: '0px 0px -100px 0px' // 提前 100px 触发动画
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // 动画触发后停止观察（性能优化）
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 观察所有 section 元素
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });

    // === CTA Button Tracking ===
    // 为所有 CTA 按钮添加点击追踪

    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const buttonText = this.textContent.trim();
            const buttonHref = this.getAttribute('href');

            // 控制台日志（开发调试用）
            console.log('CTA Button Clicked:', {
                text: buttonText,
                href: buttonHref,
                timestamp: new Date().toISOString()
            });

            // 这里可以添加分析工具追踪代码
            // 例如 Google Analytics:
            // gtag('event', 'cta_click', {
            //     'event_category': 'engagement',
            //     'event_label': buttonText,
            //     'value': buttonHref
            // });

            // 例如百度统计:
            // _hmt.push(['_trackEvent', 'CTA', 'click', buttonText]);
        });
    });

    // === Hero Section 页面加载动画 ===
    // 页面加载时立即显示 Hero 区域

    const hero = document.querySelector('.hero');
    if (hero) {
        // 延迟一小段时间后添加 visible 类，创建淡入效果
        setTimeout(() => {
            hero.classList.add('visible');
        }, 100);
    }

    // === 平滑滚动增强（可选）===
    // 为页面内锚点链接添加平滑滚动（如果有的话）

    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId !== '#' && targetId !== '') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    console.log('✅ KEVIN SOLO-OS Landing Page initialized');
});
