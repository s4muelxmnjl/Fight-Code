(() => {
  const feed = document.querySelector('#forumFeed');
  const message = document.querySelector('#forumMessage');
  if (!feed) return;

  let posts = [];
  let channel = 'anuncios';
  let authenticated = false;
  let currentUser = null;
  const description = document.querySelector('#forumDescription');
  const composer = document.querySelector('#forumComposer');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function showMessage(text = '', isError = false) {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
  }

  function formatDate(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.valueOf()) ? escapeHtml(value) : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
    return data;
  }

  async function loadForum() {
    showMessage();
    feed.innerHTML = '<article class="content-block forum-empty">Cargando publicaciones…</article>';
    try {
      const session = await request('/api/sesion');
      authenticated = Boolean(session.autenticado);
      currentUser = session.usuario || null;
      setupComposer();
      const data = await request('/api/foro');
      posts = data.publicaciones || [];
      document.querySelector('#announcementsCount').textContent = posts.filter(post => post.canal === 'anuncios').length;
      document.querySelector('#communityCount').textContent = posts.filter(post => post.canal === 'comunidad').length;
      renderPosts();
    } catch (error) {
      feed.innerHTML = `<article class="content-block forum-empty">${escapeHtml(error.message)}</article>`;
      showMessage('No se pudieron cargar las publicaciones. Inténtalo de nuevo.', true);
    }
  }

  function setupComposer() {
    if (!composer) return;
    if (!authenticated || !['coder', 'mentor'].includes(currentUser?.rol)) {
      composer.replaceChildren();
      return;
    }
    if (composer.dataset.ready === 'true') return;
    composer.dataset.ready = 'true';
    composer.innerHTML = `<div class="module-forum-compose forum-global-compose">
      <button class="button module-forum-create-button" type="button" aria-expanded="false" aria-controls="forum-compose-panel"><span aria-hidden="true">＋</span> Crear conversación</button>
      <form class="module-forum-compose-panel" id="forum-compose-panel" hidden>
        <div><span class="eyebrow accent">NUEVO TEMA</span><h3>Inicia una conversación</h3><p>Elige el módulo para que la conversación también aparezca dentro de su foro.</p></div>
        <label for="forumModule">Módulo</label><select id="forumModule" name="modulo_slug" required><option value="">Cargando módulos…</option></select>
        <label for="forumTitle">Título</label><input id="forumTitle" name="titulo" maxlength="140" required placeholder="¿Sobre qué quieres conversar?">
        <label for="forumBody">Mensaje</label><textarea id="forumBody" name="cuerpo" maxlength="3000" required placeholder="Escribe tu pregunta, idea o aporte…"></textarea>
        <div class="module-forum-compose-actions"><button class="button" type="submit">Publicar conversación</button><button class="button outline" type="button" data-compose-cancel>Cancelar</button></div>
      </form>
    </div>`;
    const toggle = composer.querySelector('.module-forum-create-button');
    const form = composer.querySelector('form');
    const panel = composer.querySelector('.module-forum-compose-panel');
    toggle.addEventListener('click', async () => {
      channel = 'comunidad';
      updateTabs();
      renderPosts();
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        await loadModules();
        composer.querySelector('#forumTitle').focus();
      }
    });
    composer.querySelector('[data-compose-cancel]').addEventListener('click', () => {
      form.reset();
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });
    form.addEventListener('submit', submitConversation);
  }

  async function loadModules() {
    const select = composer.querySelector('#forumModule');
    if (select.dataset.loaded === 'true') return;
    try {
      const data = await request('/api/modulos');
      const modules = data.modulos || [];
      select.innerHTML = '<option value="">Selecciona un módulo</option>' + modules.map(module => `<option value="${escapeHtml(module.slug)}">${escapeHtml(module.titulo || module.nombre || module.slug)}</option>`).join('');
      select.dataset.loaded = 'true';
      if (!modules.length) select.innerHTML = '<option value="">No hay módulos disponibles</option>';
    } catch (error) {
      select.innerHTML = '<option value="">No se pudieron cargar los módulos</option>';
      showMessage(error.message, true);
    }
  }

  async function submitConversation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    button.disabled = true;
    try {
      await request('/api/foro', { method: 'POST', body: JSON.stringify({
        modulo_slug: values.get('modulo_slug'), titulo: values.get('titulo'), cuerpo: values.get('cuerpo')
      }) });
      form.reset();
      const panel = form;
      panel.hidden = true;
      composer.querySelector('.module-forum-create-button').setAttribute('aria-expanded', 'false');
      showMessage('Tu conversación se publicó en el foro del módulo.');
      await loadForum();
      channel = 'comunidad';
      updateTabs();
      renderPosts();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function updateTabs() {
    document.querySelectorAll('[data-channel]').forEach(item => {
      const active = item.dataset.channel === channel;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
  }

  function renderPosts() {
    const visiblePosts = posts.filter(post => post.canal === channel);
    description.textContent = channel === 'anuncios'
      ? 'Avisos, materiales y enlaces oficiales publicados por los mentores.'
      : 'Comparte ideas, pregunta y conversa con coders y mentores.';
    if (!visiblePosts.length) {
      feed.innerHTML = `<article class="content-block forum-empty"><span class="eyebrow accent">${channel === 'anuncios' ? 'TABLÓN OFICIAL' : 'CONVERSACIÓN ABIERTA'}</span><h2>${channel === 'anuncios' ? 'Todavía no hay anuncios.' : 'La conversación empieza contigo.'}</h2><p>${channel === 'anuncios' ? 'Cuando el mentor publique novedades o recursos, aparecerán aquí.' : 'Aún no hay temas en comunidad. Pulsa “Crear conversación” para elegir un módulo e iniciar un tema.'}</p></article>`;
      return;
    }
    feed.innerHTML = visiblePosts.map(post => {
      const type = { anuncio: 'Anuncio', material: 'Material', enlace: 'Enlace' }[post.tipo] || 'Publicación';
      const body = post.cuerpo ? `<p class="forum-post-body">${escapeHtml(post.cuerpo).replace(/\n/g, '<br>')}</p>` : '';
      const resource = post.url ? `<a class="forum-resource" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${type === 'enlace' ? 'Abrir recurso' : 'Ver material'} <span aria-hidden="true">↗</span></a>` : '';
      const discussion = channel === 'comunidad' ? `<details class="forum-discussion" data-discussion="${post.id}">
        <summary><span>Ver conversación</span><span class="forum-comment-count" data-comment-count="${post.id}">${Number(post.comentarios) || 0}</span></summary>
        <div class="forum-comments" data-comments="${post.id}"><p class="forum-empty-note">Abre para cargar los comentarios.</p></div>
        ${authenticated ? `<form class="forum-comment-form" data-comment-form="${post.id}"><label for="comment-${post.id}">Tu respuesta</label><textarea id="comment-${post.id}" name="cuerpo" rows="3" maxlength="3000" required placeholder="Aporta una idea o haz una pregunta…"></textarea><button class="button small" type="submit">Publicar comentario</button></form>` : '<p class="forum-empty-note"><a href="cuenta.html">Inicia sesión para participar en esta conversación →</a></p>'}
      </details>` : '<div class="forum-no-comments">Anuncio oficial · comentarios desactivados</div>';
      const author = [post.autor_nombre, post.autor_apellido].filter(Boolean).join(' ');
      const authorRole = post.autor_rol === 'mentor' ? 'MAESTRO' : 'CODER';
      return `<article class="forum-post"><div class="forum-post-top"><span class="forum-tag">${channel === 'comunidad' ? 'COMUNIDAD' : 'ANUNCIO'} · ${escapeHtml(type)}</span><time datetime="${escapeHtml(post.creado_en)}">${formatDate(post.creado_en)}</time></div><h2>${escapeHtml(post.titulo)}</h2>${body}${resource}<div class="forum-post-byline">Publicado por <strong>${escapeHtml(author)}</strong><span class="forum-author-role">${authorRole}</span></div>${discussion}</article>`;
    }).join('');
    feed.querySelectorAll('[data-discussion]').forEach(details => details.addEventListener('toggle', () => {
      if (details.open && details.dataset.loaded !== 'true') loadComments(details.dataset.discussion, details);
    }));
    feed.querySelectorAll('[data-comment-form]').forEach(form => form.addEventListener('submit', submitComment));
  }

  async function loadComments(postId, details) {
    const root = details.querySelector(`[data-comments="${postId}"]`);
    root.innerHTML = '<p class="forum-empty-note">Cargando conversación…</p>';
    try {
      const data = await request(`/api/foro/${postId}/comentarios`);
      details.dataset.loaded = 'true';
      root.innerHTML = data.comentarios.length ? data.comentarios.map(comment => `<article class="forum-comment"><div><strong>${escapeHtml(comment.autor)}</strong><span>${comment.rol === 'mentor' ? 'MENTOR' : 'CODER'}</span><time>${formatDate(comment.creado_en)}</time></div><p>${escapeHtml(comment.cuerpo).replace(/\n/g, '<br>')}</p></article>`).join('') : '<p class="forum-empty-note">Sé la primera persona en responder.</p>';
    } catch (error) {
      root.innerHTML = `<p class="forum-empty-note is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const postId = form.dataset.commentForm;
    const button = form.querySelector('button[type="submit"]');
    const body = new FormData(form).get('cuerpo');
    button.disabled = true;
    try {
      await request(`/api/foro/${postId}/comentarios`, { method: 'POST', body: JSON.stringify({ cuerpo: body }) });
      form.reset();
      const post = posts.find(item => String(item.id) === String(postId));
      post.comentarios = Number(post.comentarios || 0) + 1;
      form.closest('details').querySelector(`[data-comment-count="${postId}"]`).textContent = post.comentarios;
      await loadComments(postId, form.closest('details'));
      showMessage('Tu comentario se publicó en la conversación.');
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  document.querySelectorAll('[data-channel]').forEach(tab => tab.addEventListener('click', () => {
    channel = tab.dataset.channel;
    updateTabs();
    renderPosts();
  }));
  document.querySelector('#refreshForum').addEventListener('click', loadForum);
  loadForum();
})();
