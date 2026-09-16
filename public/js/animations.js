(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function markRevealTargets() {
    const selectors = [
      '.hero-grid', '.feature-card', '.book-card', '.step', '.cta-inner',
      '.grid article', '.card', '.form-card', '.sidebar', '.illustration',
      'main > section'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((element) => {
      if (!element.hasAttribute('data-reveal')) element.setAttribute('data-reveal', '');
    });
    document.querySelectorAll('.feature-grid, .book-grid, .steps, .grid').forEach((parent) => {
      parent.setAttribute('data-reveal-stagger', '');
      Array.from(parent.children).forEach((child, index) => {
        child.style.setProperty('--reveal-index', index);
      });
    });
  }

  function reveal() {
    markRevealTargets();
    const targets = document.querySelectorAll('[data-reveal]:not(.is-revealed)');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        instance.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -35px' });
    targets.forEach((target) => observer.observe(target));
  }

  function addNavbarEffect() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function addRipples() {
    if (reducedMotion) return;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button, .button, .btn');
      if (!button || button.classList.contains('theme-toggle')) return;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'motion-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      button.append(ripple);
      window.setTimeout(() => ripple.remove(), 520);
    });
  }

  function addPageTransitions() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || link.target === '_blank') return;
      if (reducedMotion) return;
      event.preventDefault();
      document.body.classList.add('page-leaving');
      window.setTimeout(() => { location.href = link.href; }, 180);
    });
  }

  function init() {
    reveal();
    addNavbarEffect();
    addRipples();
    addPageTransitions();
    const dynamicContent = document.querySelector('#bookGrid, #books, #bookmarks, #history');
    if (dynamicContent) {
      new MutationObserver(() => reveal()).observe(dynamicContent, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
