/**
 * KEVIN SOLO-OS Landing Page
 * Interactive Functionality v3.0
 * 视觉层次 + 动效 + 移动端优化
 */

document.addEventListener('DOMContentLoaded', function() {
    const progressBar = document.getElementById('progressBar');
    const backToTop = document.getElementById('backToTop');
    const stickyCtaBar = document.getElementById('stickyCtaBar');
    const faqQuestions = document.querySelectorAll('.faq-question');
    const hero = document.querySelector('.hero');
    const sections = document.querySelectorAll('section');
    const revealElements = document.querySelectorAll('.problem-item, .solution-item, .evidence-item, .value-item, .step-item, .audience-item, .comparison-card');

    // 阈值：滚动超过 hero 区域后显示固定栏
    const heroHeight = hero ? hero.offsetHeight : 600;
    let lastScrollY = 0;
    let ticking = false;

    // 使用 requestAnimationFrame 优化滚动性能
    function onScroll() {
        lastScrollY = window.scrollY;
        requestTick();
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateUI);
            ticking = true;
        }
    }

    function updateUI() {
        // 更新进度条
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.min((lastScrollY / docHeight) * 100, 100);
        progressBar.style.width = scrollPercent + '%';

        // 显示/隐藏返回顶部按钮
        if (lastScrollY > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }

        // 显示/隐藏固定CTA栏
        if (lastScrollY > heroHeight * 0.5) {
            stickyCtaBar.classList.add('visible');
        } else {
            stickyCtaBar.classList.remove('visible');
        }

        ticking = false;
    }

    // 优化：使用 passive 事件监听
    window.addEventListener('scroll', onScroll, { passive: true });

    // 初始化
    updateUI();

    // 返回顶部 - 添加触感反馈
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // FAQ 手风琴 - 改进触摸体验
    faqQuestions.forEach(question => {
        // 点击事件
        question.addEventListener('click', function() {
            toggleFaq(this);
        });

        // 键盘支持
        question.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFaq(this);
            }
        });
    });

    function toggleFaq(questionElement) {
        const faqItem = questionElement.parentElement;
        const isActive = faqItem.classList.contains('active');

        // 关闭其他项
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });

        // 切换当前项
        if (!isActive) {
            faqItem.classList.add('active');
        }
    }

    // 为 FAQ 问题添加可访问性属性
    faqQuestions.forEach(question => {
        question.setAttribute('role', 'button');
        question.setAttribute('tabindex', '0');
        question.setAttribute('aria-expanded', 'false');
    });

    // 滚动动画观察器 - 用于 section
    const sectionObserverOptions = {
        threshold: 0.08,
        rootMargin: '0px 0px -60px 0px'
    };

    const sectionObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, sectionObserverOptions);

    sections.forEach(section => {
        section.classList.add('fade-in');
        sectionObserver.observe(section);
    });

    // 元素交错动画观察器
    const elementObserverOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
    };

    const elementObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // 添加延迟以创建交错效果
                const delay = index * 80;
                setTimeout(() => {
                    entry.target.classList.add('reveal', 'visible');
                }, delay);
                elementObserver.unobserve(entry.target);
            }
        });
    }, elementObserverOptions);

    revealElements.forEach(el => {
        el.classList.add('reveal');
        elementObserver.observe(el);
    });

    // Hero 动画 - 添加入场动画
    if (hero) {
        setTimeout(() => {
            hero.classList.add('visible');
        }, 100);

        // 为 hero 内的元素添加交错动画
        const heroElements = hero.querySelectorAll('.hero-title, .hero-subtitle, .hero-tagline, .hero-actions, .value-strip');
        heroElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transitionDelay = `${0.2 + index * 0.1}s`;

            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 150);
        });
    }

    // 平滑滚动锚点
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

    // 触摸设备优化 - 移除 hover 状态的延迟
    let touchStartY = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = Math.abs(touchEndY - touchStartY);

        // 如果是点击而非滚动，添加触觉反馈类
        if (diff < 10) {
            const target = e.target.closest('.cta-button, .secondary-button, .sticky-button, .back-to-top');
            if (target) {
                target.classList.add('touch-active');
                setTimeout(() => {
                    target.classList.remove('touch-active');
                }, 150);
            }
        }
    }, { passive: true });

    // 检测是否支持触摸
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
        document.body.classList.add('touch-device');
    }

    // 性能优化：减少动画在不可见页面时的开销
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // 页面不可见时暂停动画
            document.body.classList.add('reduce-motion');
        } else {
            document.body.classList.remove('reduce-motion');
        }
    });

    // 添加触摸激活状态的样式
    const style = document.createElement('style');
    style.textContent = `
        .touch-device .cta-button.touch-active,
        .touch-device .secondary-button.touch-active,
        .touch-device .sticky-button.touch-active {
            transform: scale(0.98);
            opacity: 0.9;
        }
        .touch-device .back-to-top.touch-active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
});
