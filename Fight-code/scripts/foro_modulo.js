(() => {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el foro del módulo.');
    return data;
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function formatDate(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.valueOf()) ? escapeHtml(value) : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function initializeForum(slug) {
    const forum = document.querySelector('[data-module-forum]');
    if (!forum || !slug) return;
    const feed = forum.querySelector('[data-module-forum-feed]');
    const notice = forum.querySelector('[data-module-forum-message]');
    const composer = forum.querySelector('[data-module-forum-compose]');

    function setupComposer(user) {
      if (!composer || !['coder', 'mentor'].includes(user?.rol) || composer.querySelector('[data-new-module-conversation]')) return;
      composer.innerHTML = `<form class="module-forum-compose" data-new-module-conversation>
        <button class="button module-forum-create-button" type="button" aria-expanded="false" aria-controls="module-forum-compose-panel"><span aria-hidden="true">＋</span> Crear conversación</button>
        <div class="module-forum-compose-panel" id="module-forum-compose-panel" hidden>
        <div><span class="eyebrow accent">ABRE EL ROUND</span><h3>Inicia una conversación</h3><p>Comparte una duda, una idea o un reto con la comunidad de este módulo.</p></div>
        <label for="module-forum-title">Tema</label><input id="module-forum-title" name="titulo" maxlength="140" required placeholder="Ej. ¿Cómo funciona un bucle while?">
        <label for="module-forum-body">Tu mensaje</label><textarea id="module-forum-body" name="cuerpo" rows="4" maxlength="3000" required placeholder="Explica tu pregunta o comparte lo que descubriste…"></textarea>
        <div class="module-forum-compose-actions"><button class="button small" type="submit">Publicar en este módulo →</button><button class="button outline small" type="button" data-cancel-conversation>Cancelar</button></div>
        </div>
      </form>`;
      const form = composer.querySelector('[data-new-module-conversation]');
      const toggle = composer.querySelector('.module-forum-create-button');
      const panel = composer.querySelector('.module-forum-compose-panel');
      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
        toggle.innerHTML = panel.hidden ? '<span aria-hidden="true">＋</span> Crear conversación' : '<span aria-hidden="true">−</span> Cerrar formulario';
        if (!panel.hidden) form.querySelector('[name="titulo"]').focus();
      });
      composer.querySelector('[data-cancel-conversation]').addEventListener('click', () => {
        form.reset();
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span aria-hidden="true">＋</span> Crear conversación';
      });
      form.addEventListener('submit', submitConversation);
    }

    async function submitConversation(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await request('/api/foro', { method: 'POST', body: JSON.stringify({
          titulo: new FormData(form).get('titulo'),
          cuerpo: new FormData(form).get('cuerpo'),
          modulo_slug: slug
        }) });
        form.reset();
        notice.textContent = 'Tu conversación ya está publicada en este módulo.';
        notice.classList.remove('is-error');
        const panel = composer.querySelector('.module-forum-compose-panel');
        const toggle = composer.querySelector('.module-forum-create-button');
        if (panel && toggle) {
          panel.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = '<span aria-hidden="true">＋</span> Crear conversación';
        }
        await loadForum();
      } catch (error) {
        notice.textContent = error.message;
        notice.classList.add('is-error');
      } finally {
        button.disabled = false;
      }
    }

    async function loadComments(postId, details) {
      const root = details.querySelector(`[data-comments="${postId}"]`);
      root.innerHTML = '<p class="forum-empty-note">Cargando conversación…</p>';
      try {
        const data = await request(`/api/foro/${postId}/comentarios`);
        details.dataset.loaded = 'true';
        root.innerHTML = data.comentarios.length
          ? data.comentarios.map(comment => `<article class="forum-comment"><div><strong>${escapeHtml(comment.autor)}</strong><span>${comment.rol === 'mentor' ? 'MAESTRO' : 'CODER'}</span><time>${formatDate(comment.creado_en)}</time></div><p>${escapeHtml(comment.cuerpo).replace(/\n/g, '<br>')}</p></article>`).join('')
          : '<p class="forum-empty-note">Sé la primera persona en responder.</p>';
      } catch (error) {
        root.innerHTML = `<p class="forum-empty-note is-error">${escapeHtml(error.message)}</p>`;
      }
    }

    async function submitComment(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const postId = form.dataset.commentForm;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await request(`/api/foro/${postId}/comentarios`, { method: 'POST', body: JSON.stringify({ cuerpo: new FormData(form).get('cuerpo') }) });
        form.reset();
        await loadComments(postId, form.closest('details'));
        notice.textContent = 'Tu comentario se publicó en esta conversación.';
        notice.classList.remove('is-error');
      } catch (error) {
        notice.textContent = error.message;
        notice.classList.add('is-error');
      } finally {
        button.disabled = false;
      }
    }

    async function loadForum() {
      feed.innerHTML = '<article class="content-block forum-empty">Cargando conversaciones…</article>';
      try {
        const session = await request('/api/sesion');
        setupComposer(session.usuario);
        const data = await request(`/api/foro?modulo=${encodeURIComponent(slug)}`);
        const posts = data.publicaciones || [];
        if (!posts.length) {
          feed.innerHTML = '<article class="content-block forum-empty"><span class="eyebrow accent">FORO DEL MÓDULO</span><h2>Aún no hay conversaciones.</h2><p>Inicia la primera conversación y construye el aprendizaje con tu equipo.</p></article>';
          return;
        }
        feed.innerHTML = posts.map(post => {
          const body = post.cuerpo ? `<p class="forum-post-body">${escapeHtml(post.cuerpo).replace(/\n/g, '<br>')}</p>` : '';
          const resource = post.url ? `<a class="forum-resource" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso <span aria-hidden="true">↗</span></a>` : '';
          const author = [post.autor_nombre, post.autor_apellido].filter(Boolean).join(' ');
          const role = post.autor_rol === 'mentor' ? 'MAESTRO' : 'CODER';
          return `<article class="forum-post"><div class="forum-post-top"><span class="forum-tag">FORO DEL MÓDULO · CONVERSACIÓN</span><time>${formatDate(post.creado_en)}</time></div><h2>${escapeHtml(post.titulo)}</h2>${body}${resource}<div class="forum-post-byline">Publicado por <strong>${escapeHtml(author)}</strong><span class="forum-author-role">${role}</span></div><details class="forum-discussion" data-discussion="${post.id}"><summary><span>Ver conversación</span><span class="forum-comment-count">${Number(post.comentarios) || 0}</span></summary><div class="forum-comments" data-comments="${post.id}"><p class="forum-empty-note">Abre para cargar los comentarios.</p></div><form class="forum-comment-form" data-comment-form="${post.id}"><label for="module-comment-${post.id}">Tu respuesta</label><textarea id="module-comment-${post.id}" name="cuerpo" rows="3" maxlength="3000" required placeholder="Aporta una idea o haz una pregunta…"></textarea><button class="button small" type="submit">Publicar comentario</button></form></details></article>`;
        }).join('');
        feed.querySelectorAll('[data-discussion]').forEach(details => details.addEventListener('toggle', () => {
          if (details.open && details.dataset.loaded !== 'true') loadComments(details.dataset.discussion, details);
        }));
        feed.querySelectorAll('[data-comment-form]').forEach(form => form.addEventListener('submit', submitComment));
      } catch (error) {
        feed.innerHTML = `<article class="content-block forum-empty"><p>${escapeHtml(error.message)}</p></article>`;
      }
    }

    loadForum();
  }

  document.addEventListener('fightcode:module-loaded', event => initializeForum(event.detail?.slug));
  const staticForum = document.querySelector('[data-module-forum]');
  if (staticForum) initializeForum(staticForum.dataset.moduleForum);
})();
