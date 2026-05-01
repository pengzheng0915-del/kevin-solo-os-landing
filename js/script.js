/**
 * KEVIN SOLO-OS Landing Page
 * Interactive Functionality v4.0
 * Round 3: Updated for new HTML structure
 */

document.addEventListener('DOMContentLoaded', function() {
    const progressBar = document.getElementById('progressBar');
    const topNav = document.getElementById('topNav');
    const faqQuestions = document.querySelectorAll('.faq-question');
    const hero = document.querySelector('.hero');
    const sections = document.querySelectorAll('section:not(.hero)');
    const revealElements = document.querySelectorAll(
        '.problem-item, .solution-card, .kb-card, .sample-card, .advanced-card, .credential-item, .audience-col'
    );

    const heroHeight = hero ? hero.offsetHeight : 600;
    let lastScrollY = 0;
    let ticking = false;

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
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.min((lastScrollY / docHeight) * 100, 100);
        progressBar.style.width = scrollPercent + '%';

        // Show/hide top nav
        if (lastScrollY > heroHeight * 0.5) {
            topNav.classList.add('visible');
        } else {
            topNav.classList.remove('visible');
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

        // Keyboard support
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

        // Toggle current
        if (!isActive) {
            faqItem.classList.add('active');
            questionElement.setAttribute('aria-expanded', 'true');
        }
    }

    // Set initial aria-expanded on FAQ buttons
    faqQuestions.forEach(function(q) {
        q.setAttribute('aria-expanded', 'false');
    });

    // Section fade-in observer
    var sectionObserverOptions = {
        threshold: 0.08,
        rootMargin: '0px 0px -60px 0px'
    };

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
    var elementObserverOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
    };

    var elementObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry, index) {
            if (entry.isIntersecting) {
                var delay = index * 80;
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

    // Hero entrance animation
    if (hero) {
        requestAnimationFrame(function() {
            hero.classList.add('hero-enter');
        });
    }

    // Smooth scroll for anchor links
    var anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId !== '#' && targetId !== '') {
                var targetElement = document.querySelector(targetId);
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

    // Touch device optimizations
    var touchStartY = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        var touchEndY = e.changedTouches[0].clientY;
        var diff = Math.abs(touchEndY - touchStartY);

        if (diff < 10) {
            var target = e.target.closest('.cta-button, .secondary-button, .nav-btn');
            if (target) {
                target.classList.add('touch-active');
                setTimeout(function() {
                    target.classList.remove('touch-active');
                }, 150);
            }
        }
    }, { passive: true });

    // Detect touch device
    var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
        document.body.classList.add('touch-device');
    }
});
