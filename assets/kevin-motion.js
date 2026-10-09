(function () {
  "use strict";

  var MOBILE_QUERY = "(max-width: 720px)";
  var REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

  function canAnimate() {
    return Boolean(
      window.gsap &&
      !window.matchMedia(REDUCED_QUERY).matches &&
      document.body
    );
  }

  function toArray(targets) {
    if (!targets) return [];
    return window.gsap.utils.toArray(targets).filter(Boolean);
  }

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function clearMotionProps(elements) {
    if (!elements.length) return;
    window.gsap.set(elements, {
      clearProps: "transform,opacity,visibility,willChange,clipPath,filter"
    });
  }

  function releaseAfter(targets, delay) {
    var elements = toArray(targets);
    if (!elements.length) return;
    window.setTimeout(function () {
      window.gsap.killTweensOf(elements);
      clearMotionProps(elements);
    }, delay || 2600);
  }

  function reveal(targets, options) {
    if (!canAnimate()) return null;

    var elements = toArray(targets);
    if (!elements.length) return null;

    var settings = options || {};
    var mobile = isMobile();
    var tweenVars = {
      opacity: 0,
      y: typeof settings.y === "number" ? settings.y : (mobile ? 10 : 18),
      x: typeof settings.x === "number" ? settings.x : 0,
      duration: settings.duration || (mobile ? 0.45 : 0.65),
      delay: settings.delay || 0,
      stagger: typeof settings.stagger === "number" ? settings.stagger : (mobile ? 0.05 : 0.08),
      ease: settings.ease || "power3.out",
      overwrite: "auto",
      onComplete: function () {
        clearMotionProps(elements);
        if (typeof settings.onComplete === "function") settings.onComplete();
      }
    };

    if (typeof settings.scale === "number") tweenVars.scale = settings.scale;
    if (settings.clipPath) tweenVars.clipPath = settings.clipPath;
    if (settings.filter) tweenVars.filter = settings.filter;

    window.gsap.set(elements, { willChange: settings.clipPath ? "transform, opacity, clip-path" : "transform, opacity" });
    return window.gsap.from(elements, tweenVars);
  }

  function scrollReveal(trigger, targets, options) {
    if (!canAnimate()) return null;

    var elements = toArray(targets);
    var triggerElement = typeof trigger === "string" ? document.querySelector(trigger) : trigger;
    if (!elements.length || !triggerElement) return null;

    if (isMobile() || !window.ScrollTrigger) {
      return reveal(elements, Object.assign({ y: 10, duration: 0.45 }, options || {}));
    }

    var settings = options || {};
    window.gsap.set(elements, { willChange: "transform, opacity" });
    var vars = {
      opacity: 0,
      y: typeof settings.y === "number" ? settings.y : 20,
      x: typeof settings.x === "number" ? settings.x : 0,
      duration: settings.duration || 0.7,
      stagger: typeof settings.stagger === "number" ? settings.stagger : 0.08,
      ease: settings.ease || "power3.out",
      overwrite: "auto",
      scrollTrigger: {
        trigger: triggerElement,
        start: settings.start || "top 78%",
        once: true,
        toggleActions: "play none none none"
      },
      onComplete: function () {
        clearMotionProps(elements);
      }
    };

    if (typeof settings.scale === "number") vars.scale = settings.scale;
    if (settings.filter) vars.filter = settings.filter;
    return window.gsap.from(elements, vars);
  }

  function initHomeMotion() {
    var hero = document.querySelector(".hero");
    if (!hero) return;

    var reportOffset = isMobile() ? 0 : 42;
    var timeline = window.gsap.timeline({
      defaults: { ease: "power3.out" }
    });

    var titleLines = toArray(".hero .hero-title span");
    var heroIntro = toArray([
      ".hero .hero-subtitle",
      ".hero .hero-stance"
    ].join(", "));
    var decisionItems = toArray(".hero .hero-decision-item");
    var heroActions = toArray(".hero .hero-copy > .hero-actions");
    var reportCard = document.querySelector(".hero .hero-report-card");
    var reportPieces = toArray([
      ".hero-report-card .diag-advisor",
      ".hero-report-card .diag-card-body > p",
      ".hero-report-card .diag-item",
      ".hero-report-card .diag-kp-seal"
    ].join(", "));

    if (titleLines.length) {
      window.gsap.set(titleLines, { willChange: "transform, opacity, clip-path" });
      timeline.from(titleLines, {
        opacity: 0,
        y: isMobile() ? 14 : 34,
        clipPath: "inset(0 0 100% 0)",
        duration: isMobile() ? 0.52 : 0.82,
        stagger: isMobile() ? 0.06 : 0.1,
        onComplete: function () { clearMotionProps(titleLines); }
      });
    }

    if (heroIntro.length) {
      window.gsap.set(heroIntro, { willChange: "transform, opacity" });
      timeline.from(heroIntro, {
        opacity: 0,
        y: isMobile() ? 10 : 16,
        duration: 0.55,
        stagger: 0.08,
        onComplete: function () { clearMotionProps(heroIntro); }
      }, titleLines.length ? "-=0.22" : 0);
    }

    if (decisionItems.length) {
      window.gsap.set(decisionItems, { willChange: "transform, opacity" });
      timeline.from(decisionItems, {
        opacity: 0,
        y: isMobile() ? 10 : 18,
        scale: isMobile() ? 1 : 0.96,
        duration: 0.58,
        stagger: isMobile() ? 0.05 : 0.09,
        onComplete: function () { clearMotionProps(decisionItems); }
      }, "-=0.12");
    }

    if (heroActions.length) {
      window.gsap.set(heroActions, { willChange: "transform" });
      timeline.from(heroActions, {
        y: isMobile() ? 8 : 12,
        duration: 0.5,
        onComplete: function () { clearMotionProps(heroActions); }
      }, "-=0.08");
    }

    if (reportCard) {
      window.gsap.set(reportCard, { willChange: "transform, opacity" });
      timeline.from(reportCard, {
        opacity: 0,
        x: reportOffset,
        y: isMobile() ? 12 : 18,
        scale: isMobile() ? 1 : 0.96,
        duration: 0.86,
        onComplete: function () { clearMotionProps([reportCard]); }
      }, titleLines.length ? 0.18 : 0);
    }

    if (reportPieces.length && !isMobile()) {
      window.gsap.set(reportPieces, { willChange: "transform" });
      timeline.from(reportPieces, {
        y: 14,
        duration: 0.52,
        stagger: 0.055,
        onComplete: function () { clearMotionProps(reportPieces); }
      }, "-=0.48");
    }

    releaseAfter([].concat(titleLines, heroIntro, decisionItems, heroActions, reportPieces, reportCard ? [reportCard] : []), 3200);

    scrollReveal("#products", "#products .product-system-step", {
      y: 30,
      scale: isMobile() ? 1 : 0.96,
      duration: 0.76,
      stagger: 0.12,
      start: "top 86%"
    });

    scrollReveal("#products .pricing", "#products .price-card:not([hidden]), #products .addon-tool-card", {
      y: 34,
      scale: isMobile() ? 1 : 0.97,
      duration: 0.78,
      stagger: 0.12,
      start: "top 80%"
    });
  }

  function initKnowledgeMotion() {
    var hero = document.querySelector(".knowledge-hero");
    if (!hero) return;

    reveal([
      ".knowledge-hero-copy .eyebrow",
      ".knowledge-hero-copy h1",
      ".knowledge-hero-copy .hero-sub"
    ].join(", "), {
      y: isMobile() ? 8 : 14,
      duration: isMobile() ? 0.36 : 0.42,
      stagger: 0.05
    });

    reveal(".knowledge-benefit", {
      delay: 0.05,
      y: isMobile() ? 8 : 14,
      scale: isMobile() ? 1 : 0.96,
      duration: 0.42,
      stagger: 0.06
    });

    reveal([
      ".knowledge-hero-actions .btn",
      ".knowledge-quick-use",
      ".knowledge-decision-strip > div"
    ].join(", "), {
      delay: 0.1,
      y: isMobile() ? 8 : 14,
      duration: 0.38,
      stagger: 0.06
    });

    reveal(".knowledge-product-card", {
      delay: isMobile() ? 0.06 : 0.08,
      x: isMobile() ? 0 : 22,
      y: isMobile() ? 8 : 12,
      scale: isMobile() ? 1 : 0.96,
      duration: 0.5
    });

    reveal([
      ".knowledge-card-cover > *",
      ".knowledge-card-body > *"
    ].join(", "), {
      delay: isMobile() ? 0.12 : 0.16,
      y: isMobile() ? 8 : 14,
      duration: 0.34,
      stagger: 0.04
    });

    releaseAfter([
      ".knowledge-hero-copy .eyebrow",
      ".knowledge-hero-copy h1",
      ".knowledge-hero-copy .hero-sub",
      ".knowledge-benefit",
      ".knowledge-hero-actions .btn",
      ".knowledge-quick-use",
      ".knowledge-decision-strip > div",
      ".knowledge-product-card",
      ".knowledge-card-cover > *",
      ".knowledge-card-body > *"
    ].join(", "), 1500);
  }

  function initPromptFilterReveal() {
    var filterWrap = document.getElementById("modelFilters");
    if (!filterWrap || typeof MutationObserver === "undefined") return;

    var hasAnimated = false;
    function animateFilters() {
      if (hasAnimated) return;
      var filters = filterWrap.querySelectorAll(".filter-btn");
      if (!filters.length) return;
      hasAnimated = true;
      reveal(filters, {
        y: isMobile() ? 5 : 12,
        scale: isMobile() ? 1 : 0.96,
        duration: 0.4,
        stagger: 0.03
      });
    }

    animateFilters();
    if (hasAnimated) return;

    var observer = new MutationObserver(function () {
      animateFilters();
      if (hasAnimated) observer.disconnect();
    });
    observer.observe(filterWrap, { childList: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, 4000);
  }

  function initPromptsMotion() {
    var page = document.querySelector(".kv-prompts");
    if (!page) return;

    scrollReveal(".use-steps", ".use-steps .step-card", {
      y: isMobile() ? 8 : 16,
      duration: 0.55,
      stagger: 0.06
    });

    initPromptFilterReveal();
    initPromptCardReveal();
  }

  function initPromptCardReveal() {
    var grid = document.getElementById("cardGrid");
    if (!grid || typeof MutationObserver === "undefined") return;

    var timer = null;
    function animateCards() {
      if (isMobile()) return;
      var cards = toArray(grid.querySelectorAll(".card")).slice(0, 12);
      if (!cards.length) return;
      reveal(cards, {
        y: 18,
        scale: 0.985,
        duration: 0.42,
        stagger: 0.025
      });
    }

    var observer = new MutationObserver(function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(animateCards, 80);
    });
    observer.observe(grid, { childList: true });
    window.setTimeout(animateCards, 600);
  }

  function initMotion() {
    if (!canAnimate()) return;

    document.body.classList.add("kv-motion-enhanced");

    if (window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    if (document.body.classList.contains("kv-home")) initHomeMotion();
    if (document.body.classList.contains("kv-knowledge")) initKnowledgeMotion();
    if (document.body.classList.contains("kv-prompts")) initPromptsMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMotion, { once: true });
  } else {
    initMotion();
  }

  window.KevinMotion = {
    initMotion: initMotion,
    canAnimate: canAnimate
  };
})();
