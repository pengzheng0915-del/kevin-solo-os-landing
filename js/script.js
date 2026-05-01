/**
 * KEVIN SOLO-OS Landing Page
 * v5.0 — 路径优化 & 移动端优先
 */

document.addEventListener('DOMContentLoaded', function() {
    var progressBar = document.getElementById('progressBar');
    var topNav = document.getElementById('topNav');
    var faqQuestions = document.querySelectorAll('.faq-question');
    var hero = document.querySelector('.hero');
    var sections = document.querySelectorAll('section:not(.hero)');
    var revealElements = document.querySelectorAll(
        '.problem-item, .kb-card, .sample-card, .advanced-card, .credential-item, .audience-col'
    );
    var mobileBar = document.querySelector('.mobile-bottom-bar');

    var heroHeight = hero ? hero.offsetHeight : 600;
    var lastScrollY = 0;
    var ticking = false;

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
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var scrollPercent = Math.min((lastScrollY / docHeight) * 100, 100);
        progressBar.style.width = scrollPercent + '%';

        // Top nav visibility
        if (lastScrollY > heroHeight * 0.4) {
            topNav.classList.add('visible');
        } else {
            topNav.classList.remove('visible');
        }

        // Mobile bottom bar: hide near footer
        if (mobileBar) {
            var scrollBottom = lastScrollY + window.innerHeight;
            var distToBottom = document.body.scrollHeight - scrollBottom;
            if (distToBottom < 400) {
                mobileBar.style.transform = 'translateY(120%)';
                mobileBar.style.opacity = '0';
                mobileBar.style.pointerEvents = 'none';
            } else {
                mobileBar.style.transform = 'translateY(0)';
                mobileBar.style.opacity = '1';
                mobileBar.style.pointerEvents = 'auto';
            }
        }

        ticking = false;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    updateUI();

    // FAQ accordion
    faqQuestions.forEach(function(question) {
        question.addEventListener('click', function() {
            toggleFaq(this);
        });

        question.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFaq(this);
            }
        });
    });

    function toggleFaq(questionElement) {
        var faqItem = questionElement.closest('.faq-item');
        if (!faqItem) return;
        var isActive = faqItem.classList.contains('active');

        // Close all FAQ items
        document.querySelectorAll('.faq-item').forEach(function(item) {
            item.classList.remove('active');
            var btn = item.querySelector('.faq-question');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });

        // Toggle current (only if it wasn't already active)
        if (!isActive) {
            faqItem.classList.add('active');
            questionElement.setAttribute('aria-expanded', 'true');
        }
    }

    // Ensure aria-expanded matches initial active state (first item is active in HTML)
    faqQuestions.forEach(function(q) {
        var item = q.closest('.faq-item');
        if (item && !item.classList.contains('active')) {
            q.setAttribute('aria-expanded', 'false');
        }
    });

    // Section fade-in observer
    var sectionObserverOptions = { threshold: 0.06, rootMargin: '0px 0px -60px 0px' };

    var sectionObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in', 'visible');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, sectionObserverOptions);

    sections.forEach(function(section) {
        sectionObserver.observe(section);
    });

    // Element reveal observer
    var elementObserverOptions = { threshold: 0.12, rootMargin: '0px 0px -40px 0px' };

    var elementObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry, index) {
            if (entry.isIntersecting) {
                var delay = Math.min(index, 4) * 80;
                setTimeout(function() {
                    entry.target.classList.add('reveal', 'visible');
                }, delay);
                elementObserver.unobserve(entry.target);
            }
        });
    }, elementObserverOptions);

    revealElements.forEach(function(el) {
        elementObserver.observe(el);
    });

    // Hero entrance
    if (hero) {
        requestAnimationFrame(function() {
            hero.classList.add('hero-enter');
        });
    }

    // Smooth scroll anchors
    var anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId !== '#' && targetId !== '') {
                var targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // Touch device detection
    var touchStartY = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        var touchEndY = e.changedTouches[0].clientY;
        if (Math.abs(touchEndY - touchStartY) < 10) {
            var target = e.target.closest('.cta-button, .secondary-button, .nav-btn, .mobile-bottom-btn');
            if (target) {
                target.classList.add('touch-active');
                setTimeout(function() {
                    target.classList.remove('touch-active');
                }, 150);
            }
        }
    }, { passive: true });

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.add('touch-device');
    }
});
