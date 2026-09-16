(function () {
  const storageKey = 'librahub-theme';
  const savedTheme = localStorage.getItem(storageKey);
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;

  function updateToggle(button) {
    const dark = document.documentElement.dataset.theme === 'dark';
    button.textContent = dark ? '☀️ Light' : '🌙 Dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  function addToggle() {
    if (document.querySelector('.theme-toggle')) return;
    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', function () {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(storageKey, nextTheme);
      updateToggle(button);
    });
    updateToggle(button);

    const navActions = document.querySelector('.nav-actions');
    const nav = document.querySelector('.site-nav nav, .nav-links');
    if (navActions || nav) {
      (navActions || nav).append(button);
      const menuButton = document.querySelector('.site-nav .nav-button:not(#menuButton)');
      const menuLinks = document.querySelector('.site-nav .nav-links');
      if (menuButton && menuLinks) {
        menuButton.addEventListener('click', () => {
          const open = menuLinks.classList.toggle('open');
          menuButton.setAttribute('aria-expanded', String(open));
          menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        });
      }
      return;
    }

    const compactNav = document.createElement('header');
    compactNav.className = 'site-nav compact-nav';
    const inner = document.createElement('div');
    inner.className = 'container nav-inner';
    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = 'index.html';
    const logo = document.createElement('img');
    logo.src = 'images/logo.png';
    logo.alt = 'LibraHub logo';
    const name = document.createElement('span');
    name.className = 'brand-name';
    name.textContent = 'LibraHub';
    brand.append(logo, name);

    const links = document.createElement('nav');
    links.className = 'nav-links compact-links';
    links.setAttribute('aria-label', 'Primary navigation');
    [
      ['Home', 'index.html'],
      ['Library', 'library.html'],
      ['Dashboard', 'dashboard.html'],
      ['Submit a book', 'topic_form.html']
    ].forEach(([label, href]) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (location.pathname.endsWith(href)) link.className = 'active';
      links.append(link);
    });
    const menuButton = document.createElement('button');
    menuButton.className = 'nav-button';
    menuButton.type = 'button';
    menuButton.textContent = '☰';
    menuButton.setAttribute('aria-label', 'Open navigation');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    const actions = document.createElement('div');
    actions.className = 'nav-actions compact-actions';
    [['Log in', 'login.html'], ['Get started', 'register.html']].forEach(([label, href]) => {
      const link = document.createElement('a');
      link.className = 'button small';
      link.href = href;
      link.textContent = label;
      actions.append(link);
    });
    actions.append(button);
    inner.append(brand, menuButton, links, actions);
    compactNav.append(inner);
    document.body.prepend(compactNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addToggle);
  } else {
    addToggle();
  }
}());
