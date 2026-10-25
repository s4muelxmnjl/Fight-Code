const route = FIGHTCODE.route;
fetch(`/api/modulos/${encodeURIComponent(route.id)}`, { credentials: 'same-origin' }).then(response => {
  if (response.ok) location.replace(`modulo.html?slug=${encodeURIComponent(route.id)}`);
}).catch(() => {});
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

document.title = `${route.title} — FIGHT+ CODE`;
document.querySelector('#moduleTitle').textContent = route.title;
document.querySelector('#moduleSummary').textContent = route.summary;
document.querySelector('#moduleDuration').textContent = route.duration;
document.querySelector('#moduleLevel').textContent = `Nivel ${route.level}`;

document.querySelector('#lessonList').innerHTML = route.lessons.map((lesson, index) => `
  <article class="content-block lesson-card" id="seccion-${index + 1}">
    <div class="card-top">
      <span class="card-icon">${String(index + 1).padStart(2, '0')}</span>
      <span class="badge">Sección ${index + 1}</span>
    </div>
    <h3>${escapeHtml(lesson.title)}</h3>
    <p>${escapeHtml(lesson.description)}</p>
    <h4>En esta sección aprenderás</h4>
    <ul>${lesson.concepts.map(concept => `<li>${escapeHtml(concept)}</li>`).join('')}</ul>
    <a class="arrow-link" href="../paginas/cuestionario.html">Ir al quiz →</a>
  </article>
`).join('');

document.querySelector('#docList').innerHTML = FIGHTCODE.docs.slice(0, 4).map(item => `
  <article class="resource">
    <span class="resource-icon">↗</span>
    <div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">Abrir referencia →</a>
    </div>
  </article>
`).join('');
