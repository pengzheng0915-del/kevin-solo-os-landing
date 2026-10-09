document.documentElement.classList.add('kv-js');

window.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  if (!body?.matches('[data-kevin-ui="v1"], [data-kv-nav-runtime="v1"]')) return;

  body.classList.add('kv-ready');

  const scrollSentinel = document.createElement('span');
  scrollSentinel.className = 'kv-scroll-sentinel';
  scrollSentinel.setAttribute('aria-hidden', 'true');
  body.prepend(scrollSentinel);

  if ('IntersectionObserver' in window) {
    const scrollObserver = new IntersectionObserver(([entry]) => {
      body.classList.toggle('kv-scrolled', !entry.isIntersecting);
    });
    scrollObserver.observe(scrollSentinel);
  }

  const normalizedPath = window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('[data-kv-nav="public"] a[href], .kv-site-nav a[href]').forEach((link) => {
    const target = new URL(link.href, window.location.href);
    const targetPath = target.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    if (target.origin === window.location.origin && targetPath === normalizedPath) {
      link.setAttribute('aria-current', 'page');
    }
  });

  document.querySelectorAll('.kv-global-header__products').forEach((products, index) => {
    const trigger = products.querySelector('.kv-global-header__product-trigger');
    const panel = products.querySelector('.kv-global-header__product-panel');
    if (!trigger || !panel) return;

    const panelId = panel.id || `kv-product-panel-${index + 1}`;
    panel.id = panelId;
    trigger.setAttribute('aria-controls', panelId);
    trigger.setAttribute('aria-haspopup', 'true');
    products.dataset.open = 'false';

    const setOpen = (open, { focus = '' } = {}) => {
      products.dataset.open = String(open);
      trigger.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
      panel.toggleAttribute('inert', !open);

      if (focus === 'trigger') trigger.focus();
      if (open && focus === 'first') {
        window.requestAnimationFrame(() => panel.querySelector('a[href]')?.focus());
      }
    };

    setOpen(false);

    trigger.addEventListener('click', () => {
      setOpen(products.dataset.open !== 'true');
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true, { focus: 'first' });
      }
      if (event.key === 'Escape' && products.dataset.open === 'true') {
        event.preventDefault();
        setOpen(false, { focus: 'trigger' });
      }
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false, { focus: 'trigger' });
    });

    products.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!products.contains(document.activeElement)) setOpen(false);
      }, 0);
    });

    document.addEventListener('click', (event) => {
      if (!products.contains(event.target)) setOpen(false);
    });

    if (panel.querySelector('[aria-current="page"]')) products.dataset.current = 'true';
  });

  document.querySelectorAll('.kv-global-header__mobile-menu').forEach((menu, index) => {
    const summary = menu.querySelector(':scope > summary');
    const panel = menu.querySelector('.kv-global-header__mobile-panel');
    if (!summary || !panel) return;

    const panelId = panel.id || `kv-mobile-menu-panel-${index + 1}`;
    panel.id = panelId;
    summary.setAttribute('aria-controls', panelId);

    let mobileProducts = panel.querySelector('.kv-global-header__mobile-products');
    if (!mobileProducts) {
      const knowledgeLink = panel.querySelector('a[href="/knowledge/"]');
      const promptsLink = panel.querySelector('a[href="/prompts/"]');
      if (knowledgeLink && promptsLink) {
        mobileProducts = document.createElement('div');
        mobileProducts.className = 'kv-global-header__mobile-products';

        const productTrigger = document.createElement('button');
        productTrigger.className = 'kv-global-header__mobile-product-trigger';
        productTrigger.type = 'button';
        productTrigger.textContent = '产品';

        const productPanel = document.createElement('div');
        productPanel.className = 'kv-global-header__mobile-product-panel';
        productPanel.id = `kv-mobile-product-panel-${index + 1}`;
        productTrigger.setAttribute('aria-controls', productPanel.id);

        knowledgeLink.before(mobileProducts);
        productPanel.append(knowledgeLink, promptsLink);
        mobileProducts.append(productTrigger, productPanel);
      }
    }

    const productTrigger = mobileProducts?.querySelector(':scope > .kv-global-header__mobile-product-trigger');
    const productPanel = mobileProducts?.querySelector(':scope > .kv-global-header__mobile-product-panel');
    const setProductOpen = (open, { focus = '' } = {}) => {
      if (!mobileProducts || !productTrigger || !productPanel) return;
      mobileProducts.dataset.open = String(open);
      productTrigger.setAttribute('aria-expanded', String(open));
      productPanel.hidden = !open;
      productPanel.toggleAttribute('inert', !open);
      if (focus === 'trigger') productTrigger.focus();
      if (open && focus === 'first') {
        window.requestAnimationFrame(() => productPanel.querySelector('a[href]')?.focus());
      }
    };

    const updateMenuState = () => {
      summary.setAttribute('aria-expanded', String(menu.open));
      summary.setAttribute('aria-label', menu.open ? '关闭站点菜单' : '打开站点菜单');
      body.classList.toggle('kv-menu-open', menu.open);
      if (!menu.open && mobileProducts) {
        setProductOpen(false);
      }
    };

    setProductOpen(false);
    if (mobileProducts?.querySelector('[aria-current="page"]')) mobileProducts.dataset.current = 'true';
    updateMenuState();
    menu.addEventListener('toggle', updateMenuState);

    productTrigger?.addEventListener('click', () => {
      setProductOpen(mobileProducts.dataset.open !== 'true');
    });

    productTrigger?.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      setProductOpen(true, { focus: 'first' });
    });

    productPanel?.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setProductOpen(false, { focus: 'trigger' });
    });

    document.addEventListener('click', (event) => {
      if (!menu.open || menu.contains(event.target)) return;
      menu.open = false;
      updateMenuState();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      menu.open = false;
      updateMenuState();
      summary.focus();
    });
  });

  document.querySelectorAll('[data-kv-menu-button]').forEach((button) => {
    const panelId = button.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      body.classList.toggle('kv-menu-open', !open);
    });
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !window.gsap) return;

  if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  window.gsap.utils.toArray('[data-kv-reveal]').forEach((node, index) => {
    const belowFold = node.getBoundingClientRect().top > window.innerHeight * 0.82;
    const animate = () => window.gsap.from(node, {
      y: 18,
      duration: 0.55,
      delay: Math.min(index * 0.04, 0.2),
      ease: 'power2.out',
      clearProps: 'transform'
    });

    if (belowFold && window.ScrollTrigger) {
      window.ScrollTrigger.create({
        trigger: node,
        start: 'top 88%',
        once: true,
        onEnter: animate
      });
    } else {
      animate();
    }
  });
});
