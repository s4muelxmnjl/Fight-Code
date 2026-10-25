const moduleRoot = document.querySelector('#moduleContent');
const moduleSlug = new URLSearchParams(location.search).get('slug');
const escapeModule = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const moduleIconMarkup = value => {
  const icon = String(value ?? '');
  return /^\/api\/modulos\/icono\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(icon)
    ? `<img class="module-icon-image" src="${icon}" alt="">`
    : escapeModule(icon || '</>');
};

async function loadModulePage() {
  if (!moduleSlug) throw new Error('No se indicó qué módulo abrir.');
  const response = await fetch(`/api/modulos/${encodeURIComponent(moduleSlug)}`, { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) location.assign(`/paginas/cuenta.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error(data.error || 'No se pudo cargar el módulo.');
  }
  const module = data.modulo;
  const structure = module.estructura;
  const quizUrl = `../paginas/cuestionario.html?modulo=${encodeURIComponent(module.slug)}`;
  document.title = `${module.titulo} — FIGHT+ CODE`;
  const lessons = structure.lecciones.map((lesson, index) => `<article class="content-block lesson-card" id="leccion-${index + 1}"><div class="card-top"><span class="card-icon">${String(index + 1).padStart(2, '0')}</span><span class="badge">Lección ${index + 1}</span></div><h3>${escapeModule(lesson.titulo)}</h3><p>${escapeModule(lesson.descripcion)}</p>${lesson.conceptos.length ? `<h4>Conceptos clave</h4><ul>${lesson.conceptos.map(item => `<li>${escapeModule(item)}</li>`).join('')}</ul>` : ''}<a class="arrow-link" href="${quizUrl}">Ir al quiz →</a></article>`).join('');
  const materials = [...structure.materiales, ...structure.recursos].map(item => `<article class="resource"><span class="resource-icon">↗</span><div><h3>${escapeModule(item.titulo)}</h3><p>${escapeModule(item.descripcion || 'Recurso complementario del módulo.')}</p>${item.url ? `<a href="${escapeModule(item.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso →</a>` : ''}</div></article>`).join('');
  const challenge = structure.reto?.descripcion || 'El mentor agregará aquí un reto práctico para aplicar los conceptos del módulo.';
  const pdf = structure.reto?.pdf ? `<a class="button" href="${escapeModule(structure.reto.pdf)}" target="_blank" rel="noopener noreferrer">Descargar reto PDF ↓</a>` : '';
  const quizCount = structure.quiz.secciones.reduce((sum, section) => sum + section.preguntas.length, 0);
  moduleRoot.innerHTML = `
    <section class="page-hero"><div class="breadcrumb"><a href="../index.html">Inicio</a><span>/</span><a href="../paginas/ruta_aprendizaje.html">Ruta de aprendizaje</a><span>/</span><span>${escapeModule(module.titulo)}</span></div><div class="module-intro"><div><div class="eyebrow accent">MÓDULO · NIVEL ${escapeModule(module.nivel)}</div><h1 class="page-title">${escapeModule(module.titulo)}</h1><p class="lead">${escapeModule(module.resumen)}</p><div class="tags" style="margin:15px 0 0"><span class="tag">${escapeModule(module.duracion || `${structure.lecciones.length} lecciones`)}</span><span class="tag">${structure.lecciones.length} lecciones</span><span class="tag">${quizCount} preguntas</span></div></div><div class="module-number" aria-hidden="true">${moduleIconMarkup(module.icono)}</div></div></section>
    <nav class="module-nav" aria-label="Secciones del módulo"><a href="#sobre-modulo">Presentación</a><a href="#lecciones">Lecciones</a><a href="#materiales">Material y documentación</a><a href="#reto">Reto adicional</a><a href="#foro-del-modulo">Foro del módulo</a><a href="${quizUrl}">Quiz</a></nav>
    <section class="section" id="sobre-modulo" style="padding-top:24px"><div class="section-heading"><div><div class="eyebrow accent">El tema</div><h2>${escapeModule(structure.presentacion.titulo || `Sobre ${module.titulo}`)}</h2></div></div><article class="content-block"><p>${escapeModule(structure.presentacion.descripcion || 'El mentor añadirá aquí la presentación y el contexto del tema.')}</p>${structure.presentacion.ejemplo ? `<pre class="code-sample"><code>${escapeModule(structure.presentacion.ejemplo)}</code></pre>` : ''}</article></section>
    <section class="section" id="lecciones"><div class="section-heading"><div><div class="eyebrow accent">Aprende paso a paso</div><h2>Lecciones del módulo</h2></div><a class="arrow-link" href="${quizUrl}">Comenzar quiz →</a></div><div class="lesson-list">${lessons}</div></section>
    <section class="section" id="materiales"><div class="section-heading"><div><div class="eyebrow accent">Recursos</div><h2>Material y documentación</h2></div></div><div class="resource-grid">${materials || '<article class="content-block">El mentor añadirá materiales y referencias para explorar.</article>'}</div></section>
    <section class="section" id="reto"><div class="challenge-layout"><article class="challenge-feature"><div class="eyebrow">Práctica adicional</div><h3>Reto del módulo</h3><p>${escapeModule(challenge)}</p>${pdf}</article><aside class="side-feature"><strong>${structure.quiz.secciones.length} secciones · ${quizCount} preguntas</strong><p>Responde a tu ritmo y revisa la explicación de cada respuesta.</p><a class="arrow-link" href="${quizUrl}">Ir al quiz →</a></aside></div></section>
    <section class="section forum-module-section" id="foro-del-modulo" data-module-forum="${escapeModule(module.slug)}"><div class="section-heading"><div><div class="eyebrow accent">COMUNIDAD</div><h2>Foro de ${escapeModule(module.titulo)}</h2><p class="lead">Comparte dudas, ideas y soluciones con otros coders y mentores.</p></div></div><div data-module-forum-compose></div><div class="forum-feed" data-module-forum-feed><article class="content-block forum-empty">Cargando conversaciones…</article></div><p class="account-message" data-module-forum-message role="status"></p></section>`;
  document.dispatchEvent(new CustomEvent('fightcode:module-loaded', { detail: { slug: module.slug } }));
}

loadModulePage().catch(error => { moduleRoot.innerHTML = `<section class="content-block"><h1>No pudimos abrir este módulo</h1><p>${escapeModule(error.message)}</p><a class="arrow-link" href="../paginas/ruta_aprendizaje.html">Volver a la ruta →</a></section>`; });
