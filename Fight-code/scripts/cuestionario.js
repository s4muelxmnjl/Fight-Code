let sections = FIGHTCODE.sections;
let questions = sections.flatMap((section, sectionIndex) =>
  section.questions.map(question => ({ ...question, sectionIndex }))
);
let moduleSlug = 'python-basico';
let moduleTitle = 'Python Básico';
let reflectionPrompts = ['¿Qué aprendiste durante el curso?', '¿Qué problemáticas o dificultades encontraste durante el curso?'];
let answers = Array(questions.length).fill(null);
const startScreen = document.querySelector('#quizStart');
const quizRun = document.querySelector('#quizRun');
const reflectionForm = document.querySelector('#reflectionForm');
const resultPanel = document.querySelector('#quizResult');
const quizSections = document.querySelector('#quizSections');
const finishButton = document.querySelector('#finishQuiz');
const startButton = document.querySelector('#startQuiz');

async function loadManagedQuiz(slug) {
  startButton.disabled = true;
  const response = await fetch(`/api/modulos/${encodeURIComponent(slug)}`, { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar el quiz.');
  const module = data.modulo;
  moduleSlug = module.slug;
  moduleTitle = module.titulo;
  sections = module.estructura.quiz.secciones.map(section => ({
    title: section.titulo,
    questions: section.preguntas.map(question => ({ q: question.pregunta, options: question.opciones }))
  }));
  questions = sections.flatMap((section, sectionIndex) => section.questions.map(question => ({ ...question, sectionIndex })));
  answers = Array(questions.length).fill(null);
  reflectionPrompts = module.estructura.quiz.reflexiones;
  const total = questions.length;
  document.title = `Quiz ${moduleTitle} — FIGHT+ CODE`;
  document.querySelector('.page-hero h1').textContent = `Quiz ${moduleTitle}`;
  document.querySelector('.page-hero .lead').textContent = `${total} preguntas distribuidas en ${sections.length} secciones. Al final, comparte tu reflexión sobre lo aprendido.`;
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) breadcrumb.lastElementChild.textContent = moduleTitle;
  document.querySelector('.page-hero .eyebrow').textContent = `Evaluación · ${moduleTitle}`;
  document.querySelector('#quizStart .card-icon').textContent = String(total);
  document.querySelector('#quizStart h2').textContent = `Tu recorrido de ${moduleTitle}`;
  document.querySelector('#quizStart > p').textContent = `Explora las ${sections.length} secciones a tu ritmo. Al terminar podrás revisar tu resultado.`;
  document.querySelector('.quiz-overview').innerHTML = `<li>${sections.length} secciones</li><li>${total} preguntas</li><li>2 respuestas abiertas</li>`;
  document.querySelector('#questionCount').textContent = `0 de ${total} respondidas`;
  document.querySelector('#quizProgress').max = total;
  document.querySelector('#quizSectionTrack').innerHTML = sections.map((section, index) => `<span class="quiz-section-step" data-section="${index}" aria-label="Sección ${index + 1}: ${escapeHtml(section.title)}">${String(index + 1).padStart(2, '0')}</span>`).join('');
  const reflectionLabels = reflectionForm.querySelectorAll('label');
  if (reflectionLabels[0]) reflectionLabels[0].textContent = `1. ${reflectionPrompts[0]}`;
  if (reflectionLabels[1]) reflectionLabels[1].textContent = `2. ${reflectionPrompts[1]}`;
  document.querySelector('#quizRun .quiz-progress-header .eyebrow').textContent = moduleTitle.toUpperCase();
  document.querySelector('.quiz-finish p').textContent = `Responde las ${total} preguntas para ver tu resultado.`;
  startButton.disabled = false;
}

const requestedModule = new URLSearchParams(location.search).get('modulo');
if (requestedModule) {
  loadManagedQuiz(requestedModule).catch(error => {
    const notice = document.createElement('p');
    notice.className = 'account-message is-error';
    notice.textContent = error.message;
    document.querySelector('#quizStart').append(notice);
    startButton.disabled = true;
  });
} else {
  fetch('/api/modulos/python-basico', { credentials: 'same-origin' }).then(response => {
    if (response.ok) location.replace('cuestionario.html?modulo=python-basico');
  }).catch(() => {});
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function renderQuiz() {
  quizSections.innerHTML = sections.map((section, sectionIndex) => {
    const sectionQuestions = questions.filter(question => question.sectionIndex === sectionIndex);
    return `<section class="quiz-section-card" aria-labelledby="quiz-section-${sectionIndex}">
      <header class="quiz-section-heading"><span class="quiz-section-number">${String(sectionIndex + 1).padStart(2, '0')}</span>
        <div><span class="eyebrow accent">SECCIÓN ${sectionIndex + 1} · ${sectionQuestions.length} PREGUNTAS</span><h3 id="quiz-section-${sectionIndex}">${escapeHtml(section.title.replace(/^Sección \d+ · /, ''))}</h3></div>
        <span class="quiz-section-score" data-score="${sectionIndex}">0 / ${sectionQuestions.length}</span>
      </header>
      ${sectionQuestions.map((question, localIndex) => {
        const index = questions.indexOf(question);
        return `<article class="quiz-question-card" data-question="${index}">
          <div class="quiz-question-meta"><span>Pregunta ${localIndex + 1}</span><span>+1 punto</span></div>
          <h4>${escapeHtml(question.q)}</h4>
          <div class="quiz-options">${question.options.map((option, optionIndex) => `<button type="button" class="quiz-option" data-question="${index}" data-index="${optionIndex}">${escapeHtml(option)}</button>`).join('')}</div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('');

  quizSections.querySelectorAll('.quiz-option').forEach(button => {
    button.addEventListener('click', () => {
      const questionIndex = Number(button.dataset.question);
      if (answers[questionIndex] !== null) return;
      answers[questionIndex] = Number(button.dataset.index);
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
      button.closest('.quiz-options').querySelectorAll('.quiz-option').forEach(option => { option.disabled = true; });
      updateProgress();
    });
  });
}

function updateProgress() {
  const answered = answers.filter(answer => answer !== null).length;
  document.querySelector('#questionCount').textContent = `${answered} de ${questions.length} respondidas`;
  document.querySelector('#quizProgress').value = answered;
  document.querySelectorAll('#quizSectionTrack .quiz-section-step').forEach((step, index) => {
    const sectionAnswered = questions.filter(question => question.sectionIndex === index)
      .every(question => answers[questions.indexOf(question)] !== null);
    step.classList.toggle('is-complete', sectionAnswered);
    step.classList.toggle('is-current', !sectionAnswered && answers.some((answer, questionIndex) =>
      questions[questionIndex].sectionIndex === index && answer !== null));
    const score = document.querySelector(`[data-score="${index}"]`);
    if (score) score.textContent = `${questions.filter(question => question.sectionIndex === index && answers[questions.indexOf(question)] !== null).length} / ${sections[index].questions.length}`;
  });
  const complete = answered === questions.length;
  finishButton.disabled = !complete;
  document.querySelector('#quizHint').textContent = complete
    ? '¡Todo respondido! Ya puedes ver tu resultado.'
    : `Llevas ${answered} de ${questions.length}. Puedes responder las secciones en cualquier orden.`;
}

function beginQuiz() {
  startScreen.hidden = true;
  quizRun.hidden = false;
  renderQuiz();
  updateProgress();
}

document.querySelector('#startQuiz').addEventListener('click', beginQuiz);
finishButton.addEventListener('click', () => {
  if (answers.some(answer => answer === null)) return;
  quizRun.hidden = true;
  reflectionForm.hidden = false;
  reflectionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

reflectionForm.addEventListener('submit', event => {
  event.preventDefault();
  const learned = escapeHtml(document.querySelector('#learnedAnswer').value.trim());
  const difficulty = escapeHtml(document.querySelector('#challengeAnswer').value.trim());
  const resultPayload = {
    modulo: moduleSlug,
    respuestas: answers.map(Number),
    aprendizaje: document.querySelector('#learnedAnswer').value.trim(),
    dificultades: document.querySelector('#challengeAnswer').value.trim()
  };
  const submitButton = reflectionForm.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  const saveNotice = document.createElement('p');
  saveNotice.className = 'account-save-notice';
  saveNotice.textContent = 'Calculando y guardando tu resultado…';
  reflectionForm.append(saveNotice);
  fetch('/api/resultados', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resultPayload)
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.setItem('fightcode_pending_result', JSON.stringify(resultPayload));
        saveNotice.innerHTML = `${escapeHtml(data.error || 'Inicia sesión para guardar tu resultado.')} <a class="arrow-link" href="cuenta.html">Iniciar sesión o crear cuenta →</a>`;
      } else saveNotice.textContent = data.error || 'No se pudo guardar el resultado. Inténtalo más tarde.';
      if (submitButton) submitButton.disabled = false;
      return;
    }
    sessionStorage.removeItem('fightcode_pending_result');
    const { correctas: correct, incorrectas: incorrect, total, porcentaje: percent } = data;
    const motivation = correct >= Math.ceil(total * 0.92)
      ? '¡Increíble trabajo! Tienes una base firme para seguir construyendo proyectos.'
      : correct >= Math.ceil(total * 0.72)
        ? '¡Vas por muy buen camino! Ya tienes bases sólidas; sigue practicando para ganar confianza.'
        : correct >= Math.ceil(total * 0.52)
          ? 'Cada acierto muestra lo que ya has aprendido. Repasa las secciones y vuelve a intentarlo: el progreso se construye practicando.'
          : 'Aprender a programar también es equivocarse y volver a probar. Revisa el módulo, practica con calma y verás cómo cada intento te acerca más.';
    reflectionForm.hidden = true;
    resultPanel.hidden = false;
    resultPanel.innerHTML = `
      <div class="eyebrow accent">Resultado de ${escapeHtml(moduleTitle)}</div>
      <h2>${percent}% · ${correct} de ${total} correctas</h2>
      <div class="result-counts"><div><strong>${correct}</strong><span>Correctas</span></div><div><strong>${incorrect}</strong><span>Incorrectas</span></div><div><strong>${total}</strong><span>Total</span></div></div>
      <div class="callout">${motivation}</div><h3>Tu reflexión</h3>
      <p><strong>${escapeHtml(reflectionPrompts[0])}</strong><br>${learned}</p><p><strong>${escapeHtml(reflectionPrompts[1])}</strong><br>${difficulty}</p>
      <a class="button" href="${moduleSlug === 'python-basico' ? '../modulos/python_basico.html' : `../modulos/modulo.html?slug=${encodeURIComponent(moduleSlug)}`}">Volver al módulo →</a>
      <button class="button outline" id="restartQuiz">Intentar de nuevo</button>`;
    resultPanel.querySelector('#restartQuiz').addEventListener('click', () => location.reload());
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }).catch(() => {
    sessionStorage.setItem('fightcode_pending_result', JSON.stringify(resultPayload));
    saveNotice.innerHTML = 'No se pudo conectar con la base de datos. <a class="arrow-link" href="cuenta.html">Iniciar sesión o reintentar →</a>';
    if (submitButton) submitButton.disabled = false;
  });
});
