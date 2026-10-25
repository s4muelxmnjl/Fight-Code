const mentorContentRoot = document.querySelector('#mentorContent');

function escapeMentorContent(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

fetch('/api/contenido', { credentials: 'same-origin' })
  .then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el contenido.');
    return data.contenido;
  })
  .then(items => {
    if (!items.length) {
      mentorContentRoot.innerHTML = '<article class="content-block mentor-empty">Aún no hay publicaciones. Los mentores pueden añadir avisos y recursos desde su panel.</article>';
      return;
    }
    mentorContentRoot.innerHTML = items.map(item => `<article class="content-block mentor-content-item">
      <div class="eyebrow accent">${escapeMentorContent(item.tipo)} · FIGHT+ CODE</div>
      <h3>${escapeMentorContent(item.titulo)}</h3>
      ${item.cuerpo ? `<p>${escapeMentorContent(item.cuerpo).replace(/\n/g, '<br>')}</p>` : ''}
      ${item.url ? `<a class="arrow-link" href="${escapeMentorContent(item.url)}" target="_blank" rel="noopener noreferrer">${item.tipo === 'enlace' ? 'Abrir recurso' : 'Ver material'} →</a>` : ''}
      <small>Publicado ${escapeMentorContent(item.actualizado_en)}</small>
    </article>`).join('');
  })
  .catch(error => {
    mentorContentRoot.innerHTML = `<article class="content-block">${escapeMentorContent(error.message)}</article>`;
  });
