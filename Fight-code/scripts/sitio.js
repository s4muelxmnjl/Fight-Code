(() => {
  const root = document.documentElement;
  const scriptUrl = document.currentScript?.src;
  const toggle = document.querySelector('#themeToggle');
  const menuButton = document.querySelector('#menuToggle');
  const mobileNav = document.querySelector('#mobileNav');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const label = document.querySelector('#themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Tema oscuro' : 'Tema claro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#101011' : '#fffaf8';
    localStorage.setItem('fightcode-theme', theme);
  }

  applyTheme(localStorage.getItem('fightcode-theme') || 'light');
  toggle?.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  menuButton?.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  const isAccountPage = location.pathname.endsWith('/paginas/cuenta.html');
  if (scriptUrl && !isAccountPage) {
    const siteRoot = new URL('../', scriptUrl);
    const accountUrl = new URL('paginas/perfil.html', siteRoot);
    const forumUrl = new URL('paginas/foro.html', siteRoot);
    const createForumLink = () => {
      const link = document.createElement('a');
      link.href = forumUrl.href;
      link.textContent = 'Foro';
      if (location.pathname.endsWith('/paginas/foro.html')) link.setAttribute('aria-current', 'page');
      return link;
    };
    const desktopForumLink = createForumLink();
    const desktopRouteLink = document.querySelector('.nav-links a[href*="ruta_aprendizaje.html"]');
    if (desktopRouteLink) desktopRouteLink.after(desktopForumLink);
    else document.querySelector('.nav-links')?.append(desktopForumLink);
    const mobileForumLink = createForumLink();
    const mobileRouteLink = document.querySelector('.mobile-nav a[href*="ruta_aprendizaje.html"]');
    if (mobileRouteLink) mobileRouteLink.after(mobileForumLink);
    else mobileNav?.append(mobileForumLink);

    const accountLink = document.createElement('a');
    accountLink.className = 'account-nav-link';
    accountLink.href = accountUrl.href;
    accountLink.textContent = 'Mi cuenta';
    accountLink.setAttribute('aria-label', 'Iniciar sesión o ver mi cuenta');
    document.querySelector('.nav-tools')?.prepend(accountLink);
    document.addEventListener('fightcode:avatar-updated', event => {
      const existing = accountLink.querySelector('.account-nav-avatar');
      if (!event.detail?.foto) { existing?.remove(); return; }
      const avatar = existing || document.createElement('img');
      avatar.className = 'account-nav-avatar';
      avatar.alt = '';
      avatar.src = new URL(event.detail.foto, location.origin).href;
      if (!existing) accountLink.prepend(avatar);
    });

    if (mobileNav) {
      const mobileAccountLink = document.createElement('a');
      mobileAccountLink.href = accountUrl.href;
      mobileAccountLink.textContent = 'Mi cuenta';
      mobileNav.append(mobileAccountLink);
    }

    fetch(new URL('api/sesion', siteRoot), { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(session => {
        if (session?.autenticado) {
          accountLink.replaceChildren();
          if (session.usuario.foto) {
            const avatar = document.createElement('img');
            avatar.className = 'account-nav-avatar';
            avatar.src = new URL(session.usuario.foto, location.origin).href;
            avatar.alt = '';
            accountLink.append(avatar);
          }
          const accountName = document.createElement('span');
          accountName.textContent = session.usuario.nombre.split(' ')[0];
          accountLink.append(accountName);
          accountLink.setAttribute('aria-label', `Mi cuenta de ${session.usuario.nombre}`);
          const mobileAccount = [...(mobileNav?.querySelectorAll('a') || [])].find(link => link.href === accountUrl.href);
          if (mobileAccount) mobileAccount.textContent = `Mi cuenta · ${session.usuario.nombre.split(' ')[0]}`;
          if (session.usuario.rol === 'mentor') {
            const adminLink = document.createElement('a');
            adminLink.className = 'account-nav-link';
            adminLink.href = new URL('paginas/administracion.html', siteRoot).href;
            adminLink.textContent = 'Panel mentor';
            document.querySelector('.nav-tools')?.prepend(adminLink);
            if (mobileNav) {
              const mobileAdminLink = document.createElement('a');
              mobileAdminLink.href = adminLink.href;
              mobileAdminLink.textContent = 'Panel mentor';
              mobileNav.append(mobileAdminLink);
            }
          }
        }
      })
      .catch(() => {});
  }
})();
