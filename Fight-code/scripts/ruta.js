const route = FIGHTCODE.route;
const escapeRoute = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const moduleIconMarkup = value => {
  const icon = String(value ?? '');
  return /^\/api\/modulos\/icono\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(icon)
    ? `<img class="module-icon-image" src="${icon}" alt="">`
    : escapeRoute(icon || '</>');
};
let completedModules = new Map();
function updateCompletedBadges() {
  document.querySelectorAll('[data-module-status]').forEach(badge => {
    if (!completedModules.has(badge.dataset.moduleStatus)) return;
    badge.textContent = `Completado · ${completedModules.get(badge.dataset.moduleStatus)}%`;
    badge.classList.add('completed');
  });
}
document.title = 'Ruta de aprendizaje — FIGHT+ CODE';
document.querySelector('#routeGrid').innerHTML = `
  <article class="card" id="pythonBasicRouteCard">
    <div class="card-top">
      <span class="card-icon python-icon" aria-label="Icono de Python"><img src="../img/python.png" alt=""></span>
      <span class="badge available" data-module-status="python-basico">Módulo disponible</span>
    </div>
    <h3>${route.title}</h3>
    <p>${route.summary}</p>
    <div class="tags">
      <span class="tag">${route.duration}</span>
      <span class="tag">Nivel ${route.level}</span>
      <span class="tag">5 lecciones</span>
    </div>
    <div class="card-bottom">
      <strong>5 secciones · 25 preguntas · retos</strong>
      <a class="arrow-link" href="../modulos/python_basico.html">Explorar módulo →</a>
    </div>
  </article>
`;

fetch('/api/modulos', { credentials: 'same-origin' }).then(async response => {
  if (!response.ok) return;
  const { modulos } = await response.json();
  const pythonModule = modulos.find(module => module.slug === 'python-basico');
  if (pythonModule) {
    const card = document.querySelector('#pythonBasicRouteCard');
    const sections = pythonModule.estructura.quiz.secciones;
    const questionCount = sections.reduce((sum, section) => sum + section.preguntas.length, 0);
    card.querySelector('h3').textContent = pythonModule.titulo;
    card.querySelector('p').textContent = pythonModule.resumen;
    const icon = card.querySelector('.card-icon');
    icon.className = 'card-icon';
    icon.innerHTML = moduleIconMarkup(pythonModule.icono);
    const tags = card.querySelectorAll('.tags .tag');
    tags[0].textContent = pythonModule.duracion || `${pythonModule.estructura.lecciones.length} lecciones`;
    tags[1].textContent = `Nivel ${pythonModule.nivel}`;
    tags[2].textContent = `${pythonModule.estructura.lecciones.length} lecciones`;
    card.querySelector('.card-bottom strong').textContent = `${sections.length} secciones · ${questionCount} preguntas`;
    card.querySelector('.card-bottom a').href = `../modulos/modulo.html?slug=${encodeURIComponent(pythonModule.slug)}`;
  }
  const extraModules = modulos.filter(module => module.slug !== 'python-basico').map(module => {
    const questionCount = module.estructura.quiz.secciones.reduce((sum, section) => sum + section.preguntas.length, 0);
    return `<article class="card"><div class="card-top"><span class="card-icon">${moduleIconMarkup(module.icono)}</span><span class="badge available" data-module-status="${escapeRoute(module.slug)}">${module.publicado ? 'Módulo disponible' : 'Borrador privado'}</span></div><h3>${escapeRoute(module.titulo)}</h3><p>${escapeRoute(module.resumen)}</p><div class="tags"><span class="tag">${escapeRoute(module.duracion || `${module.estructura.lecciones.length} lecciones`)}</span><span class="tag">Nivel ${escapeRoute(module.nivel)}</span><span class="tag">${module.estructura.lecciones.length} lecciones</span></div><div class="card-bottom"><strong>${module.estructura.quiz.secciones.length} secciones · ${questionCount} preguntas</strong><a class="arrow-link" href="../modulos/modulo.html?slug=${encodeURIComponent(module.slug)}">Explorar módulo →</a></div></article>`;
  }).join('');
  document.querySelector('#routeGrid').insertAdjacentHTML('beforeend', extraModules);
  updateCompletedBadges();
}).catch(() => {});

fetch('/api/progreso', { credentials: 'same-origin' }).then(async response => {
  if (!response.ok) return;
  const { progreso } = await response.json();
  completedModules = new Map(progreso.map(item => [item.modulo, Number(item.mejor_puntaje)]));
  updateCompletedBadges();
}).catch(() => {});

const typingCode = document.querySelector('#typingCode');
if (typingCode) {
  const sample = [
    '# una idea se convierte en codigo',
    'nombre = "FIGHT+ CODE"',
    '',
    'def crear_futuro():',
    '    aprender()  # paso a paso',
    '    construir(nombre)',
    '',
    'crear_futuro()'
  ].join('\n');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    typingCode.textContent = sample;
  } else {
    let position = 0;
    let erasing = false;

    function animateCode() {
      typingCode.textContent = sample.slice(0, position);
      if (!erasing && position < sample.length) {
        position += 1;
        window.setTimeout(animateCode, 27);
      } else if (!erasing) {
        window.setTimeout(() => {
          erasing = true;
          animateCode();
        }, 1450);
      } else if (position > 0) {
        position = Math.max(0, position - 2);
        window.setTimeout(animateCode, 18);
      } else {
        erasing = false;
        window.setTimeout(animateCode, 550);
      }
    }

    animateCode();
  }
}
