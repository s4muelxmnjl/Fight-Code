const adminMessage = document.querySelector('#adminMessage');
const attendanceForm = document.querySelector('#attendanceForm');
const contentForm = document.querySelector('#contentForm');
const moduleForm = document.querySelector('#moduleForm');
let activeMentorId = null;
let previousVisit = '';
let allQuizResults = [];
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
document.querySelector('#attendanceDate').value = localDate;
document.querySelector('#adminToday').textContent = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(new Date());

const moduleSections = [...moduleForm.querySelectorAll('fieldset.module-editor-block')].map((fieldset, index) => {
  const legend = fieldset.querySelector('legend');
  const details = document.createElement('details');
  details.className = 'module-editor-block';
  details.id = `module-editor-section-${index + 1}`;
  details.open = index === 0;
  const summary = document.createElement('summary');
  summary.className = 'module-editor-section-title';
  summary.textContent = legend?.textContent || `Sección ${index + 1}`;
  details.append(summary);
  [...fieldset.childNodes].forEach(node => { if (node !== legend) details.append(node); });
  fieldset.replaceWith(details);
  return details;
});

const moduleSectionControls = document.createElement('div');
moduleSectionControls.className = 'module-section-controls';
moduleSectionControls.innerHTML = '<div><strong>Secciones del módulo</strong><span id="moduleSectionState" aria-live="polite"></span></div><div class="module-section-actions"><button class="button outline tiny" type="button" id="expandModuleSections">Desplegar todo</button><button class="button outline tiny" type="button" id="collapseModuleSections">Contraer todo</button></div><nav class="module-section-nav" aria-label="Ir a una sección del editor"></nav>';
moduleForm.querySelector('.account-muted')?.after(moduleSectionControls);
const moduleSectionNav = moduleSectionControls.querySelector('.module-section-nav');
moduleSections.forEach((section, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'module-section-link';
  button.textContent = section.querySelector('summary').textContent;
  button.addEventListener('click', () => {
    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateModuleSectionState();
  });
  moduleSectionNav.append(button);
  section.addEventListener('toggle', updateModuleSectionState);
});

function updateModuleSectionState() {
  const openCount = moduleSections.filter(section => section.open).length;
  document.querySelector('#moduleSectionState').textContent = `${openCount} de ${moduleSections.length} secciones desplegadas`;
  moduleSections.forEach((section, index) => {
    const button = moduleSectionNav.children[index];
    button.classList.toggle('is-open', section.open);
    button.setAttribute('aria-expanded', String(section.open));
  });
}

document.querySelector('#expandModuleSections').addEventListener('click', () => {
  moduleSections.forEach(section => { section.open = true; });
  updateModuleSectionState();
});
document.querySelector('#collapseModuleSections').addEventListener('click', () => {
  moduleSections.forEach(section => { section.open = false; });
  updateModuleSectionState();
});
updateModuleSectionState();
moduleForm.addEventListener('invalid', event => {
  event.target.closest('details.module-editor-block')?.setAttribute('open', '');
}, true);

function escapeAdmin(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function moduleIconMarkup(value) {
  const icon = String(value ?? '');
  if (/^\/api\/modulos\/icono\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(icon)) return `<img class="module-icon-image" src="${icon}" alt="">`;
  return escapeAdmin(icon || '</>');
}

async function adminApi(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('is-error', error);
}

function syncContentModuleControl(clearWhenUnavailable = false) {
  const select = document.querySelector('#contentModule');
  if (clearWhenUnavailable && document.querySelector('#contentChannel').value !== 'comunidad') select.value = '';
  select.disabled = false;
  document.querySelector('#contentModuleHint').textContent = select.value
    ? 'Se publicará como conversación de Comunidad y también aparecerá dentro del módulo elegido.'
    : 'Elige un módulo para mostrar esta conversación también dentro de él; si lo dejas vacío, será un foro general.';
}

document.querySelector('#contentChannel').addEventListener('change', () => syncContentModuleControl(true));
document.querySelector('#contentModule').addEventListener('change', event => {
  if (event.target.value) document.querySelector('#contentChannel').value = 'comunidad';
  syncContentModuleControl();
});
contentForm.addEventListener('reset', () => window.setTimeout(() => syncContentModuleControl(), 0));
syncContentModuleControl();

function showPanel(name) {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const active = tab.dataset.target === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
}

async function loadSummary() {
  const { resumen } = await adminApi('/api/admin/resumen');
  document.querySelector('#summaryCoders').textContent = resumen.coders;
  document.querySelector('#summaryQuizzes').textContent = resumen.quizzes;
  document.querySelector('#summaryPresent').textContent = resumen.presentes;
  document.querySelector('#summaryPosts').textContent = resumen.publicaciones;
}

async function loadCoders() {
  const { coders } = await adminApi('/api/admin/coders');
  const now = Date.now();
  coders.forEach(coder => {
    const inactive = now - new Date(String(coder.ultima_actividad).replace(' ', 'T')).getTime() > 14 * 86400000;
    coder.seguimiento = [inactive ? 'Inactivo' : '', Number(coder.quizzes) > 0 && Number(coder.mejor_puntaje) < 60 ? 'Reforzar puntaje' : ''].filter(Boolean).join(' · ');
  });
  document.querySelector('#codersTable').innerHTML = coders.length ? coders.map(coder => `<tr>
    <td>${escapeAdmin(coder.nombre)}${coder.seguimiento ? `<small><span class="followup-tag">${escapeAdmin(coder.seguimiento)}</span></small>` : ''}</td><td>${escapeAdmin(coder.correo)}</td><td>${escapeAdmin(coder.creado_en)}</td>
    <td>${coder.quizzes}</td><td>${coder.mejor_puntaje}%</td><td><div class="admin-content-actions"><button class="button outline tiny" type="button" data-reset-password="${coder.id}" data-user-role="coder" data-user-name="${escapeAdmin(coder.nombre)}" data-user-email="${escapeAdmin(coder.correo)}">Generar clave</button><button class="button outline tiny danger-button" type="button" data-delete-user="${coder.id}" data-user-role="coder" data-user-name="${escapeAdmin(coder.nombre)}" data-user-email="${escapeAdmin(coder.correo)}">Eliminar</button></div></td></tr>`).join('') : '<tr><td colspan="6">Todavía no hay coders registrados.</td></tr>';
  const select = document.querySelector('#attendanceCoder');
  const selected = select.value;
  select.innerHTML = '<option value="">Selecciona una persona</option>' + coders.map(coder => `<option value="${coder.id}">${escapeAdmin(coder.nombre)} · ${escapeAdmin(coder.correo)}</option>`).join('');
  if (coders.some(coder => String(coder.id) === selected)) select.value = selected;
  renderFollowupAlerts(coders);
}

function renderFollowupAlerts(coders) {
  const now = Date.now();
  const alerts = coders.flatMap(coder => {
    const age = now - new Date(String(coder.ultima_actividad).replace(' ', 'T')).getTime();
    const stale = Number.isFinite(age) && age > 14 * 86400000;
    const reasons = [];
    if (stale) reasons.push('Sin actividad en 14 días');
    if (Number(coder.quizzes) > 0 && Number(coder.mejor_puntaje) < 60) reasons.push(`Puntaje bajo · ${coder.mejor_puntaje}%`);
    return reasons.length ? [{ ...coder, reasons }] : [];
  });
  document.querySelector('#alertCount').textContent = alerts.length;
  const list = document.querySelector('#followupAlerts');
  list.innerHTML = alerts.length ? alerts.slice(0, 5).map(coder => `<button type="button" class="admin-alert-item" data-alert-coder="${escapeAdmin(coder.nombre)}"><span class="admin-alert-avatar">${escapeAdmin(coder.nombre.slice(0,1).toUpperCase())}</span><span><strong>${escapeAdmin(coder.nombre)}</strong><small>${escapeAdmin(coder.reasons.join(' · '))}</small></span><b>→</b></button>`).join('') : '<p class="admin-no-alerts"><span>✓</span> No hay alertas de seguimiento por ahora.</p>';
  list.querySelectorAll('[data-alert-coder]').forEach(button => button.addEventListener('click', () => {
    showPanel('coders');
    const filter = document.querySelector('[data-filter-table="codersTable"]');
    filter.value = button.dataset.alertCoder;
    filter.dispatchEvent(new Event('input'));
    document.querySelector('.admin-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

async function loadMentores() {
  const { mentores } = await adminApi('/api/admin/mentores');
  document.querySelector('#mentoresTable').innerHTML = mentores.length ? mentores.map(mentor => `<tr>
    <td>${escapeAdmin(`${mentor.nombre} ${mentor.apellido || ''}`.trim())}</td><td>${escapeAdmin(mentor.identificacion || '—')}</td>
    <td>${escapeAdmin(mentor.correo)}</td><td>${escapeAdmin(mentor.creado_en)}</td><td><div class="admin-content-actions"><button class="button outline tiny" type="button" data-reset-password="${mentor.id}" data-user-role="mentor" data-user-name="${escapeAdmin(`${mentor.nombre} ${mentor.apellido || ''}`.trim())}" data-user-email="${escapeAdmin(mentor.correo)}">Generar clave</button><button class="button outline tiny danger-button" type="button" data-delete-user="${mentor.id}" data-user-role="mentor" data-user-name="${escapeAdmin(`${mentor.nombre} ${mentor.apellido || ''}`.trim())}" data-user-email="${escapeAdmin(mentor.correo)}">Eliminar</button></div></td></tr>`).join('') : '<tr><td colspan="5">Todavía no hay maestros registrados.</td></tr>';
}

async function resetUserPassword(button) {
  const name = button.dataset.userName;
  const roleLabel = button.dataset.userRole === 'mentor' ? 'maestro' : 'coder';
  if (!window.confirm(`¿Generar una nueva clave temporal para ${roleLabel} ${name} (${button.dataset.userEmail})? La clave actual dejará de funcionar y se cerrarán sus sesiones. La nueva clave solo se mostrará una vez.`)) return;

  button.disabled = true;
  try {
    const { clave_temporal: temporaryPassword } = await adminApi(`/api/admin/usuarios/${encodeURIComponent(button.dataset.resetPassword)}/clave-temporal`, {
      method: 'POST', body: JSON.stringify({}),
    });
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(temporaryPassword);
        copied = true;
      }
    } catch (_) {}
    if (copied) window.alert(`Clave temporal copiada para ${name}. Compártela de forma segura; no podrás volver a consultarla.`);
    else window.prompt(`Copia y entrega de forma segura la nueva clave temporal de ${name}. Solo se muestra esta vez:`, temporaryPassword);
    await loadAudit();
    message(adminMessage, `Se generó una clave temporal para ${name}. La clave anterior ya no funciona.`);
  } catch (error) {
    message(adminMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function deleteUserAccount(button) {
  const role = button.dataset.userRole;
  const name = button.dataset.userName;
  const email = button.dataset.userEmail;
  const roleLabel = role === 'mentor' ? 'maestro' : 'coder';
  const consequence = role === 'mentor'
    ? ' Sus módulos, publicaciones, reuniones y asistencias se conservarán y pasarán a tu cuenta. No se puede eliminar el último maestro.'
    : ' Se eliminarán también sus resultados, asistencias, comentarios y sesiones.';
  if (!window.confirm(`¿Eliminar la cuenta de ${roleLabel} ${name} (${email})? Esta acción no se puede deshacer.${consequence}`)) return;

  button.disabled = true;
  try {
    await adminApi(`/api/admin/usuarios/${encodeURIComponent(button.dataset.deleteUser)}`, { method: 'DELETE' });
    await refreshAll();
    message(adminMessage, `La cuenta de ${roleLabel} ${name} fue eliminada.`);
  } catch (error) {
    message(adminMessage, error.message, true);
    button.disabled = false;
  }
}

document.addEventListener('click', event => {
  const resetButton = event.target.closest('[data-reset-password]');
  if (resetButton) { resetUserPassword(resetButton); return; }
  const button = event.target.closest('[data-delete-user]');
  if (button) deleteUserAccount(button);
});

function meetingDate(value, options = {}) {
  const normalized = `${String(value || '').replace(' ', 'T')}-05:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', ...options }).format(date);
}

async function loadMeetings() {
  const { reuniones } = await adminApi('/api/admin/reuniones');
  const list = document.querySelector('#mentorMeetingList');
  list.innerHTML = reuniones.length ? reuniones.map(meeting => {
    const date = new Date(`${String(meeting.inicia_en).replace(' ', 'T')}-05:00`);
    const day = Number.isNaN(date.getTime()) ? '—' : date.getDate();
    const month = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date);
    return `<article class="meeting-card"><div class="meeting-date"><span>FECHA</span><strong>${escapeAdmin(day)}</strong><small>${escapeAdmin(month)}</small></div><div class="meeting-copy"><span class="eyebrow accent">${escapeAdmin(meetingDate(meeting.inicia_en))}</span><h3>${escapeAdmin(meeting.titulo)}</h3><p>${escapeAdmin(meeting.descripcion || 'Sesión de acompañamiento para coders.')}</p><small>Termina: ${escapeAdmin(meetingDate(meeting.termina_en))}</small></div><a class="button outline small" href="${escapeAdmin(meeting.enlace_meet)}" target="_blank" rel="noopener noreferrer">Abrir Meet ↗</a></article>`;
  }).join('') : '<article class="meeting-empty"><strong>Aún no hay reuniones programadas.</strong><span>Al crear una, aparecerá aquí y en la agenda de los coders.</span></article>';
}

async function loadResults() {
  const table = document.querySelector('#resultsTable');
  table.innerHTML = '<tr><td colspan="4">Cargando resultados…</td></tr>';
  try {
    const { resultados } = await adminApi('/api/admin/resultados');
    allQuizResults = resultados;
    renderQuizTrend(resultados);
    const moduleFilter = document.querySelector('#resultModuleFilter');
    const selectedModule = moduleFilter.value;
    const modules = [...new Set(resultados.map(result => result.modulo))];
    moduleFilter.innerHTML = '<option value="">Todos los módulos</option>' + modules.map(module => `<option value="${escapeAdmin(module)}">${escapeAdmin(module.replaceAll('-', ' '))}</option>`).join('');
    moduleFilter.value = modules.includes(selectedModule) ? selectedModule : '';
    renderResultsTable();
  } catch (error) {
    document.querySelector('#quizTrend').innerHTML = `<p class="account-muted">${escapeAdmin(error.message)}</p>`;
    table.innerHTML = `<tr><td colspan="4">No se pudieron cargar los resultados: ${escapeAdmin(error.message)}</td></tr>`;
  }
}

function renderResultsTable() {
  const module = document.querySelector('#resultModuleFilter').value;
  const from = document.querySelector('#resultFromFilter').value;
  const to = document.querySelector('#resultToFilter').value;
  const search = document.querySelector('[data-filter-table="resultsTable"]').value.trim().toLocaleLowerCase('es');
  const filtered = allQuizResults.filter(result => {
    const day = String(result.creado_en).slice(0, 10);
    return (!module || result.modulo === module) && (!from || day >= from) && (!to || day <= to) &&
      (!search || `${result.coder_nombre} ${result.coder_correo}`.toLocaleLowerCase('es').includes(search));
  });
  document.querySelector('#resultsFilterCount').textContent = `${filtered.length} de ${allQuizResults.length} resultados`;
  document.querySelector('#resultsTable').innerHTML = filtered.length ? filtered.map(result => `<tr>
    <td>${escapeAdmin(result.coder_nombre)}<small>${escapeAdmin(result.coder_correo)}</small></td>
    <td>${escapeAdmin(result.modulo.replaceAll('-', ' '))}</td><td><strong>${result.correctas}/${result.total} · ${result.porcentaje}%</strong><small>${result.incorrectas} incorrectas</small></td>
    <td><small>${escapeAdmin(result.creado_en)}</small><details><summary>Reflexiones</summary><p><b>Aprendió:</b> ${escapeAdmin(result.reflexion_aprendizaje || 'Sin respuesta')}</p><p><b>Dificultades:</b> ${escapeAdmin(result.reflexion_dificultades || 'Sin respuesta')}</p></details></td></tr>`).join('') : '<tr><td colspan="4">No hay resultados con esos filtros.</td></tr>';
}

async function loadModuleProgress() {
  const { progreso } = await adminApi('/api/admin/progreso-modulos');
  const list = document.querySelector('#moduleProgress');
  if (!progreso.length) {
    list.innerHTML = '<p class="account-muted">Aún no hay módulos completados. Los avances aparecerán aquí.</p>';
    return;
  }
  list.innerHTML = progreso.map(item => {
    const total = Number(item.total_coders);
    const done = Number(item.coders_completaron);
    const width = total ? Math.round(done / total * 100) : 0;
    return `<article class="module-progress-row"><div class="module-progress-title"><strong>${escapeAdmin(item.titulo)}</strong><span>${done}/${total} coders · promedio ${Number(item.promedio) || 0}%</span></div><div class="module-progress-track"><i style="width:${width}%"></i></div></article>`;
  }).join('');
}

function renderQuizTrend(results) {
  const trend = document.querySelector('#quizTrend');
  const latest = results.slice(0, 7).reverse();
  if (!latest.length) {
    trend.innerHTML = '<p class="account-muted">Cuando los coders completen quizzes, aquí verás su rendimiento reciente.</p>';
    document.querySelector('#spotlightResult').innerHTML = '<strong>Aún no hay resultados</strong><p>Comparte el primer módulo para iniciar el seguimiento.</p>';
    return;
  }
  trend.innerHTML = latest.map(result => `<div class="quiz-trend-item" title="${escapeAdmin(result.coder_nombre)} · ${result.porcentaje}%"><div class="quiz-trend-bar-wrap"><span>${Number(result.porcentaje)}%</span><i style="--bar-height:${Math.max(7, Number(result.porcentaje))}%"></i></div><small>${escapeAdmin((result.coder_nombre || 'Coder').split(' ')[0])}</small></div>`).join('');
  const best = results.reduce((winner, item) => Number(item.porcentaje) > Number(winner.porcentaje) ? item : winner, results[0]);
  document.querySelector('#spotlightResult').innerHTML = `<strong>${escapeAdmin(best.coder_nombre)} <span>${Number(best.porcentaje)}%</span></strong><p>Mejor puntaje reciente · ${escapeAdmin(best.modulo.replaceAll('-', ' '))}</p>`;
}

const attendanceLabels = { presente: 'Presente', ausente: 'Falta', tarde: 'Llegó tarde', justificada: 'Justificada' };
async function loadAttendance() {
  const { asistencias } = await adminApi('/api/admin/asistencia');
  document.querySelector('#attendanceTable').innerHTML = asistencias.length ? asistencias.map(item => `<tr>
    <td>${escapeAdmin(item.fecha)}</td><td>${escapeAdmin(item.coder_nombre)}</td><td><span class="attendance-badge state-${item.estado}">${attendanceLabels[item.estado] || escapeAdmin(item.estado)}</span></td>
    <td>${escapeAdmin(item.nota || '—')}</td><td>${escapeAdmin(item.mentor_nombre)}</td>
    <td><button class="button outline tiny" type="button" data-edit-attendance="${item.id}" data-coder="${item.coder_id}" data-date="${escapeAdmin(item.fecha)}" data-state="${escapeAdmin(item.estado)}" data-note="${escapeAdmin(item.nota)}">Editar</button></td></tr>`).join('') : '<tr><td colspan="6">No hay asistencias registradas.</td></tr>';
  document.querySelectorAll('[data-edit-attendance]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#attendanceId').value = button.dataset.editAttendance;
    document.querySelector('#attendanceCoder').value = button.dataset.coder;
    document.querySelector('#attendanceDate').value = button.dataset.date;
    document.querySelector('#attendanceState').value = button.dataset.state;
    document.querySelector('#attendanceNote').value = button.dataset.note;
    document.querySelector('#attendanceMessage').textContent = 'Editando registro. Al guardar se actualizará ese día.';
    attendanceForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
}

async function loadContent() {
  const { contenido } = await adminApi('/api/admin/contenido');
  const list = document.querySelector('#contentList');
  list.innerHTML = contenido.length ? contenido.map(item => `<article class="admin-content-card">
    <div><span class="eyebrow accent">${item.canal === 'comunidad' ? 'COMUNIDAD · CON COMENTARIOS' : 'ANUNCIOS · SIN COMENTARIOS'}${item.modulo_slug ? ` · MÓDULO ${escapeAdmin(item.modulo_slug)}` : ''} · ${item.publicado ? 'PUBLICADO' : 'BORRADOR'}</span><h3>${escapeAdmin(item.titulo)}</h3><p>${escapeAdmin(item.cuerpo || 'Sin descripción')}</p>${item.url ? `<a href="${escapeAdmin(item.url)}" target="_blank" rel="noopener noreferrer">${escapeAdmin(item.url)}</a>` : ''}<small>Actualizado ${escapeAdmin(item.actualizado_en)}</small></div>
    <div class="admin-content-actions"><button class="button outline tiny" type="button" data-edit-content="${item.id}">Editar</button><button class="button outline tiny danger-button" type="button" data-delete-content="${item.id}">Eliminar</button></div>
  </article>`).join('') : '<article class="content-block">Aún no hay materiales ni avisos.</article>';
  contenido.forEach(item => {
    list.querySelector(`[data-edit-content="${item.id}"]`)?.addEventListener('click', () => {
      document.querySelector('#contentId').value = item.id;
      document.querySelector('#contentTitle').value = item.titulo;
      document.querySelector('#contentType').value = item.tipo;
      document.querySelector('#contentChannel').value = item.canal || 'anuncios';
      document.querySelector('#contentModule').value = item.modulo_slug || '';
      syncContentModuleControl();
      document.querySelector('#contentBody').value = item.cuerpo;
      document.querySelector('#contentUrl').value = item.url;
      document.querySelector('#contentPublished').checked = Boolean(item.publicado);
      document.querySelector('#saveContentButton').textContent = 'Guardar cambios';
      document.querySelector('#contentMessage').textContent = 'Editando contenido.';
      contentForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    list.querySelector(`[data-delete-content="${item.id}"]`)?.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar “${item.titulo}”?`)) return;
      try { await adminApi(`/api/admin/contenido/${item.id}`, { method: 'DELETE' }); await refreshAll(); }
      catch (error) { message(adminMessage, error.message, true); }
    });
  });
}

const moduleList = document.querySelector('#moduleList');
const lessonsEditor = document.querySelector('#moduleLessons');
const materialsEditor = document.querySelector('#moduleMaterials');
const resourcesEditor = document.querySelector('#moduleResources');
const quizSectionsEditor = document.querySelector('#moduleQuizSections');

function lessonCard(lesson = {}) {
  return `<article class="module-editor-card" data-lesson>
    <div class="module-editor-card-heading"><strong>Lección</strong><button class="button outline tiny danger-button" type="button" data-remove-lesson>Eliminar</button></div>
    <label>Título</label><input data-lesson-title maxlength="140" required value="${escapeAdmin(lesson.titulo || '')}" placeholder="Nombre de la lección">
    <label>Descripción</label><textarea data-lesson-description rows="3" maxlength="3000" required placeholder="Explica qué se enseña en esta lección.">${escapeAdmin(lesson.descripcion || '')}</textarea>
    <label>Conceptos clave (uno por línea)</label><textarea data-lesson-concepts rows="3" placeholder="Concepto 1&#10;Concepto 2">${escapeAdmin((lesson.conceptos || []).join('\n'))}</textarea>
  </article>`;
}

function resourceCard(item = {}, kind = 'material') {
  return `<article class="module-editor-card module-resource-editor" data-${kind}>
    <div class="module-editor-card-heading"><strong>${kind === 'material' ? 'Material' : 'Documentación'}</strong><button class="button outline tiny danger-button" type="button" data-remove-resource>Eliminar</button></div>
    <label>Nombre del recurso</label><input data-resource-title maxlength="180" value="${escapeAdmin(item.titulo || '')}" placeholder="Título del material o referencia">
    <label>Descripción</label><textarea data-resource-description rows="2" maxlength="3000" placeholder="Qué incluye o para qué sirve.">${escapeAdmin(item.descripcion || '')}</textarea>
    <label>Enlace (opcional)</label><input data-resource-url type="url" maxlength="1000" value="${escapeAdmin(item.url || '')}" placeholder="https://...">
  </article>`;
}

function questionCard(question = {}) {
  const options = Array.isArray(question.opciones) && question.opciones.length >= 2 ? question.opciones : ['', '', '', ''];
  return `<article class="module-question-editor" data-question-editor>
    <div class="module-editor-card-heading"><strong>Pregunta</strong><button class="button outline tiny danger-button" type="button" data-remove-question>Eliminar pregunta</button></div>
    <label>Enunciado</label><textarea data-question-prompt rows="2" maxlength="2000" required placeholder="Escribe una pregunta clara sobre el contenido de esta sección.">${escapeAdmin(question.pregunta || '')}</textarea>
    <div class="module-options-editor">${options.map((option, index) => `<div class="module-option-editor"><label>Opción ${index + 1}</label><div><input data-question-option value="${escapeAdmin(option)}" maxlength="500" required placeholder="Respuesta posible"><button class="button outline tiny danger-button" type="button" data-remove-option aria-label="Eliminar opción ${index + 1}" ${options.length <= 2 ? 'disabled' : ''}>×</button></div></div>`).join('')}</div>
    <button class="button outline tiny" type="button" data-add-option ${options.length >= 8 ? 'disabled' : ''}>＋ Añadir opción</button>
    <label>Cuál opción es la correcta</label><select data-question-answer>${options.map((_, index) => `<option value="${index}" ${Number(question.correcta || 0) === index ? 'selected' : ''}>Opción ${index + 1}</option>`).join('')}</select>
    <label>Explicación cuando acierta</label><textarea data-question-why rows="2" maxlength="2000" required placeholder="Explica brevemente por qué esa respuesta es correcta.">${escapeAdmin(question.explicacion || '')}</textarea>
    <label>Explicación cuando se equivoca</label><textarea data-question-wrong rows="2" maxlength="2000" required placeholder="Aclara el error y orienta hacia la respuesta adecuada.">${escapeAdmin(question.explicacion_incorrecta || '')}</textarea>
  </article>`;
}

function quizSectionCard(section = {}) {
  const questions = Array.isArray(section.preguntas) && section.preguntas.length ? section.preguntas : [{}];
  return `<article class="module-quiz-editor" data-quiz-section>
    <div class="module-editor-card-heading"><strong>Sección del quiz</strong><button class="button outline tiny danger-button" type="button" data-remove-quiz-section>Eliminar sección</button></div>
    <label>Título de sección</label><input data-section-title maxlength="140" required value="${escapeAdmin(section.titulo || '')}" placeholder="Ej. Conceptos y sintaxis">
    <div data-questions-list>${questions.map(questionCard).join('')}</div>
    <button class="button outline small" type="button" data-add-question>＋ Añadir pregunta</button>
  </article>`;
}

function collectModuleForm() {
  const readResources = container => [...container.querySelectorAll('.module-resource-editor')].map(card => ({
    titulo: card.querySelector('[data-resource-title]').value.trim(),
    descripcion: card.querySelector('[data-resource-description]').value.trim(),
    url: card.querySelector('[data-resource-url]').value.trim()
  })).filter(item => item.titulo || item.descripcion || item.url);
  const lessons = [...lessonsEditor.querySelectorAll('[data-lesson]')].map(card => ({
    titulo: card.querySelector('[data-lesson-title]').value.trim(),
    descripcion: card.querySelector('[data-lesson-description]').value.trim(),
    conceptos: card.querySelector('[data-lesson-concepts]').value.split('\n').map(text => text.trim()).filter(Boolean)
  }));
  const sections = [...quizSectionsEditor.querySelectorAll('[data-quiz-section]')].map(section => ({
    titulo: section.querySelector('[data-section-title]').value.trim(),
    preguntas: [...section.querySelectorAll('[data-question-editor]')].map(card => ({
      pregunta: card.querySelector('[data-question-prompt]').value.trim(),
      opciones: [...card.querySelectorAll('[data-question-option]')].map(input => input.value.trim()),
      correcta: Number(card.querySelector('[data-question-answer]').value),
      explicacion: card.querySelector('[data-question-why]').value.trim(),
      explicacion_incorrecta: card.querySelector('[data-question-wrong]').value.trim()
    }))
  }));
  return {
    slug: document.querySelector('#moduleSlug').value.trim(),
    titulo: document.querySelector('#moduleName').value.trim(),
    resumen: document.querySelector('#moduleSummary').value.trim(),
    nivel: document.querySelector('#moduleLevel').value.trim(),
    duracion: document.querySelector('#moduleDuration').value.trim(),
    icono: document.querySelector('#moduleIcon').value.trim() || document.querySelector('#moduleIconText').value.trim(),
    publicado: document.querySelector('#modulePublished').checked,
    estructura: {
      presentacion: {
        titulo: document.querySelector('#moduleIntroTitle').value.trim(),
        descripcion: document.querySelector('#moduleIntroDescription').value.trim(),
        ejemplo: document.querySelector('#moduleExample').value.trim()
      },
      lecciones: lessons,
      materiales: readResources(materialsEditor),
      recursos: readResources(resourcesEditor),
      reto: { descripcion: document.querySelector('#moduleChallenge').value.trim(), pdf: document.querySelector('#modulePdf').value.trim() },
      quiz: { secciones: sections, reflexiones: [document.querySelector('#moduleReflectionOne').value.trim(), document.querySelector('#moduleReflectionTwo').value.trim()] }
    }
  };
}

function setModuleForm(module = null) {
  moduleForm.reset();
  moduleSections.forEach((section, index) => { section.open = index === 0; });
  updateModuleSectionState();
  moduleForm.hidden = false;
  document.querySelector('#moduleId').value = module?.id || '';
  document.querySelector('#moduleFormEyebrow').textContent = module ? 'EDITAR MÓDULO' : 'PLANTILLA DE MÓDULO';
  document.querySelector('#moduleFormTitle').textContent = module ? `Editar ${module.titulo}` : 'Nuevo módulo';
  document.querySelector('#saveModuleButton').textContent = module ? 'Guardar cambios' : 'Crear módulo';
  document.querySelector('#moduleName').value = module?.titulo || '';
  document.querySelector('#moduleSlug').value = module?.slug || '';
  document.querySelector('#moduleSummary').value = module?.resumen || '';
  document.querySelector('#moduleLevel').value = module?.nivel || 'Inicial';
  document.querySelector('#moduleDuration').value = module?.duracion || '';
  const savedIcon = module?.icono || '</>';
  const iconIsImage = /^\/api\/modulos\/icono\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(savedIcon);
  document.querySelector('#moduleIcon').value = iconIsImage ? savedIcon : '';
  document.querySelector('#moduleIconText').value = iconIsImage ? '' : savedIcon;
  document.querySelector('#moduleIconImage').value = '';
  document.querySelector('#moduleIconPreview').hidden = !iconIsImage;
  document.querySelector('#moduleIconPreviewImage').src = iconIsImage ? savedIcon : '';
  document.querySelector('#moduleIconMessage').textContent = '';
  document.querySelector('#modulePublished').checked = Boolean(module?.publicado);
  const structure = module?.estructura || {};
  const intro = structure.presentacion || {};
  document.querySelector('#moduleIntroTitle').value = intro.titulo || '';
  document.querySelector('#moduleIntroDescription').value = intro.descripcion || '';
  document.querySelector('#moduleExample').value = intro.ejemplo || '';
  document.querySelector('#moduleChallenge').value = structure.reto?.descripcion || '';
  document.querySelector('#modulePdf').value = structure.reto?.pdf || '';
  document.querySelector('#moduleReflectionOne').value = structure.quiz?.reflexiones?.[0] || '';
  document.querySelector('#moduleReflectionTwo').value = structure.quiz?.reflexiones?.[1] || '';
  lessonsEditor.innerHTML = (structure.lecciones?.length ? structure.lecciones : [{}]).map(lessonCard).join('');
  materialsEditor.innerHTML = (structure.materiales || []).map(item => resourceCard(item, 'material')).join('');
  resourcesEditor.innerHTML = (structure.recursos || []).map(item => resourceCard(item, 'resource')).join('');
  quizSectionsEditor.innerHTML = (structure.quiz?.secciones?.length ? structure.quiz.secciones : [{ preguntas: [{}] }]).map(quizSectionCard).join('');
  document.querySelector('#moduleMessage').textContent = '';
  moduleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function builtInPythonModuleCard() {
  return `<article class="admin-module-card">
    <div class="admin-module-icon">PY</div><div class="admin-module-copy"><span class="eyebrow accent">MÓDULO BASE · INTEGRADO · INICIAL</span><h3>Python Básico</h3><p>Un primer recorrido por Python: sintaxis, datos, decisiones, ciclos y funciones. Aprende las bases y ponlas en práctica.</p><small>5 lecciones · 5 secciones · 25 preguntas</small></div>
    <div class="admin-content-actions"><a class="button outline tiny" href="../modulos/python_basico.html" target="_blank" rel="noopener">Abrir módulo</a><button class="button tiny" type="button" data-edit-built-in-module>Editar módulo</button></div></article>`;
}

// Mantiene visible el módulo base incluso si esta página se abre sin el servidor API.
moduleList.innerHTML = builtInPythonModuleCard();

function builtInPythonModulePayload() {
  const source = window.FIGHTCODE;
  if (!source?.route?.lessons?.length || !source?.sections?.length) {
    throw new Error('No se pudo preparar el contenido original de Python Básico.');
  }
  const answerKey = [0, 1, 2, 0, 0, 1, 2, 0, 2, 0, 0, 1, 1, 2, 0, 0, 2, 0, 0, 1, 2, 0, 0, 0, 0];
  let questionIndex = 0;
  return {
    slug: source.route.id,
    titulo: source.route.title,
    resumen: source.route.summary,
    nivel: source.route.level,
    duracion: source.route.duration,
    icono: 'PY',
    publicado: true,
    estructura: {
      presentacion: {
        titulo: '¿Qué es Python?',
        descripcion: 'Python es un lenguaje de programación de propósito general, conocido por una sintaxis legible. Se utiliza para automatizar tareas, crear aplicaciones web, analizar datos, desarrollar herramientas y explorar inteligencia artificial. En Python, la indentación organiza los bloques de código. Las variables se crean al asignarles un valor, y no es necesario declarar previamente su tipo.',
        ejemplo: 'nombre = "Alex"\nprint(f"Hola, {nombre}!")'
      },
      lecciones: source.route.lessons.map(lesson => ({
        titulo: lesson.title,
        descripcion: lesson.description,
        conceptos: lesson.concepts
      })),
      materiales: [{
        titulo: 'Repositorio de curso Python',
        descripcion: 'Notebooks con sesiones de introducción, variables, control de flujo, estructuras de datos, funciones y un proyecto final para Google Colab.',
        url: 'https://github.com/afreydev/curso-python'
      }],
      recursos: source.docs.map(item => ({
        titulo: item.title,
        descripcion: `${item.category} · ${item.description}`,
        url: item.url
      })),
      reto: {
        descripcion: 'Descarga cinco retos guiados: calculadora, juego de adivinanza, agenda de tareas, conversor y analizador de palabras.',
        pdf: '/documentos/retos_python_basico.pdf'
      },
      quiz: {
        secciones: source.sections.map(section => ({
          titulo: section.title,
          preguntas: section.questions.map(question => ({
            pregunta: question.q,
            opciones: question.options,
            correcta: answerKey[questionIndex++],
            explicacion: question.why,
            explicacion_incorrecta: question.wrongWhy
          }))
        })),
        reflexiones: ['¿Qué aprendiste durante el curso?', '¿Qué problemáticas o dificultades encontraste durante el curso?']
      }
    }
  };
}

async function loadModules() {
  const moduleSelect = document.querySelector('#contentModule');
  const selectedModule = moduleSelect.value;
  const builtInFallback = [{ slug: 'python-basico', titulo: 'Python Básico' }];
  // Deja una opción útil desde el primer render, incluso si la API tarda o no está disponible.
  moduleSelect.innerHTML = '<option value="">Foro general</option>' + builtInFallback.map(module => `<option value="${module.slug}">${module.titulo}</option>`).join('');
  syncContentModuleControl();

  let modulos;
  try {
    const response = await adminApi('/api/admin/modulos');
    modulos = Array.isArray(response.modulos) ? response.modulos : [];
  } catch (error) {
    moduleList.innerHTML = `${builtInPythonModuleCard()}<p class="account-muted" role="status">No se pudieron cargar los demás módulos. ${escapeAdmin(error.message)}. Verifica que el servidor y la base de datos estén disponibles.</p>`;
    moduleList.querySelector('[data-edit-built-in-module]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await adminApi('/api/admin/modulos', { method: 'POST', body: JSON.stringify(builtInPythonModulePayload()) });
      } catch (saveError) {
        if (!saveError.message.includes('Ya existe un módulo con ese identificador')) {
          message(adminMessage, saveError.message, true);
          button.disabled = false;
          return;
        }
      }
      try {
        const refreshedModules = await loadModules();
        const pythonModule = refreshedModules.find(module => module.slug === 'python-basico');
        if (!pythonModule) throw new Error('No se pudo abrir Python Básico para editar.');
        setModuleForm(pythonModule);
      } catch (refreshError) { message(adminMessage, refreshError.message, true); }
      finally { button.disabled = false; }
    });
    return builtInFallback;
  }

  const hasPythonModule = modulos.some(module => module.slug === 'python-basico');
  const moduleOptions = hasPythonModule ? modulos : [...modulos, { slug: 'python-basico', titulo: 'Python Básico' }];
  moduleSelect.innerHTML = '<option value="">Foro general</option>' + moduleOptions.map(module => `<option value="${escapeAdmin(module.slug)}">${escapeAdmin(module.titulo)}</option>`).join('');
  moduleSelect.value = selectedModule;
  syncContentModuleControl();
  const builtInPythonModule = hasPythonModule ? '' : builtInPythonModuleCard();
  const storedModules = modulos.map(module => `<article class="admin-module-card">
    <div class="admin-module-icon">${moduleIconMarkup(module.icono)}</div><div class="admin-module-copy"><span class="eyebrow accent">${module.publicado ? 'VISIBLE PARA CODERS' : 'BORRADOR PRIVADO'} · ${escapeAdmin(module.nivel)}</span><h3>${escapeAdmin(module.titulo)}</h3><p>${escapeAdmin(module.resumen || 'Sin resumen')}</p><small>${module.estructura.lecciones.length} lecciones · ${module.estructura.quiz.secciones.length} secciones · ${module.estructura.quiz.secciones.reduce((sum, section) => sum + section.preguntas.length, 0)} preguntas</small></div>
    <div class="admin-content-actions"><a class="button outline tiny" href="../modulos/modulo.html?slug=${encodeURIComponent(module.slug)}" target="_blank" rel="noopener">Vista previa</a><button class="button outline tiny" type="button" data-edit-module="${module.id}">Editar</button><button class="button outline tiny danger-button" type="button" data-delete-module="${module.id}">Eliminar</button></div></article>`).join('');
  moduleList.innerHTML = builtInPythonModule + storedModules || '<article class="content-block">Aún no hay módulos creados. Usa la plantilla para publicar el primero.</article>';
  for (const module of modulos) {
    moduleList.querySelector(`[data-edit-module="${module.id}"]`)?.addEventListener('click', () => setModuleForm(module));
    moduleList.querySelector(`[data-delete-module="${module.id}"]`)?.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar el módulo “${module.titulo}”? Esta acción no se puede deshacer.`)) return;
      try { await adminApi(`/api/admin/modulos/${module.id}`, { method: 'DELETE' }); await Promise.all([loadModules(), loadAudit()]); }
      catch (error) { message(adminMessage, error.message, true); }
    });
  }
  moduleList.querySelector('[data-edit-built-in-module]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      try {
        await adminApi('/api/admin/modulos', { method: 'POST', body: JSON.stringify(builtInPythonModulePayload()) });
      } catch (error) {
        if (!error.message.includes('Ya existe un módulo con ese identificador')) throw error;
      }
      const refreshedModules = await loadModules();
      const pythonModule = refreshedModules.find(module => module.slug === 'python-basico');
      if (!pythonModule) throw new Error('No se pudo abrir Python Básico para editar.');
      setModuleForm(pythonModule);
      message(document.querySelector('#moduleMessage'), 'Python Básico está listo para editar. Al guardar, los cambios se reflejarán para los coders.');
    } catch (error) {
      message(adminMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  return modulos;
}

document.querySelector('#moduleName').addEventListener('input', event => {
  const slug = document.querySelector('#moduleSlug');
  if (!slug.dataset.touched) slug.value = event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
});
document.querySelector('#moduleSlug').addEventListener('input', event => { event.target.dataset.touched = '1'; });
document.querySelector('#newModuleButton').addEventListener('click', () => {
  delete document.querySelector('#moduleSlug').dataset.touched;
  setModuleForm();
});
document.querySelector('#addLessonButton').addEventListener('click', () => lessonsEditor.insertAdjacentHTML('beforeend', lessonCard()));
document.querySelector('#addMaterialButton').addEventListener('click', () => materialsEditor.insertAdjacentHTML('beforeend', resourceCard({}, 'material')));
document.querySelector('#addResourceButton').addEventListener('click', () => resourcesEditor.insertAdjacentHTML('beforeend', resourceCard({}, 'resource')));
document.querySelector('#addQuizSectionButton').addEventListener('click', () => quizSectionsEditor.insertAdjacentHTML('beforeend', quizSectionCard({ preguntas: [{}] })));
document.querySelector('#cancelModuleEdit').addEventListener('click', () => { moduleForm.hidden = true; });
document.querySelector('#cancelModuleEditBottom').addEventListener('click', () => { moduleForm.hidden = true; });
document.querySelector('#moduleIconImage').addEventListener('change', async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const notice = document.querySelector('#moduleIconMessage');
  const preview = document.querySelector('#moduleIconPreview');
  const previewImage = document.querySelector('#moduleIconPreviewImage');
  const submitButton = document.querySelector('#saveModuleButton');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    event.currentTarget.value = '';
    message(notice, 'Usa una imagen JPG, PNG o WebP de hasta 4 MB.', true);
    return;
  }
  const localPreview = URL.createObjectURL(file);
  previewImage.src = localPreview;
  preview.hidden = false;
  submitButton.disabled = true;
  message(notice, 'Subiendo imagen…');
  try {
    const body = new FormData();
    body.append('icono_imagen', file);
    const response = await fetch('/api/admin/modulos/icono', { method: 'POST', credentials: 'same-origin', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo subir la imagen.');
    document.querySelector('#moduleIcon').value = result.icono;
    document.querySelector('#moduleIconText').value = '';
    previewImage.src = result.icono;
    message(notice, 'Imagen lista. Guarda el módulo para aplicar el cambio.');
  } catch (error) {
    preview.hidden = true;
    previewImage.removeAttribute('src');
    message(notice, error.message, true);
  } finally {
    URL.revokeObjectURL(localPreview);
    submitButton.disabled = false;
  }
});
document.querySelector('#removeModuleIcon').addEventListener('click', () => {
  document.querySelector('#moduleIcon').value = '';
  document.querySelector('#moduleIconImage').value = '';
  document.querySelector('#moduleIconPreviewImage').removeAttribute('src');
  document.querySelector('#moduleIconPreview').hidden = true;
  message(document.querySelector('#moduleIconMessage'), 'Se usará el símbolo de texto al guardar.');
});
moduleForm.addEventListener('click', event => {
  const target = event.target;
  if (target.closest('[data-remove-lesson]')) target.closest('[data-lesson]')?.remove();
  if (target.closest('[data-remove-resource]')) target.closest('.module-resource-editor')?.remove();
  if (target.closest('[data-remove-quiz-section]')) target.closest('[data-quiz-section]')?.remove();
  if (target.closest('[data-remove-question]')) target.closest('[data-question-editor]')?.remove();
  if (target.closest('[data-add-question]')) target.closest('[data-quiz-section]').querySelector('[data-questions-list]').insertAdjacentHTML('beforeend', questionCard());
  if (target.closest('[data-add-option]')) {
    const question = target.closest('[data-question-editor]');
    const existing = [...question.querySelectorAll('[data-question-option]')];
    if (existing.length >= 8) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'module-option-editor';
    wrapper.innerHTML = `<label>Opción ${existing.length + 1}</label><div><input data-question-option maxlength="500" required placeholder="Respuesta posible"><button class="button outline tiny danger-button" type="button" data-remove-option aria-label="Eliminar opción">×</button></div>`;
    question.querySelector('.module-options-editor').append(wrapper);
    const answer = question.querySelector('[data-question-answer]');
    answer.insertAdjacentHTML('beforeend', `<option value="${existing.length}">Opción ${existing.length + 1}</option>`);
    question.querySelectorAll('[data-remove-option]').forEach(button => { button.disabled = false; });
    if (existing.length + 1 >= 8) target.closest('[data-add-option]').disabled = true;
  }
  if (target.closest('[data-remove-option]')) {
    const question = target.closest('[data-question-editor]');
    const option = target.closest('.module-option-editor');
    const removedIndex = [...question.querySelectorAll('.module-option-editor')].indexOf(option);
    if (question.querySelectorAll('.module-option-editor').length <= 2) return;
    option.remove();
    const answer = question.querySelector('[data-question-answer]');
    const selected = Number(answer.value);
    answer.innerHTML = [...question.querySelectorAll('[data-question-option]')].map((_, index) => `<option value="${index}" ${index === Math.max(0, selected > removedIndex ? selected - 1 : selected === removedIndex ? 0 : selected) ? 'selected' : ''}>Opción ${index + 1}</option>`).join('');
    question.querySelectorAll('.module-option-editor label').forEach((label, index) => { label.textContent = `Opción ${index + 1}`; });
    question.querySelectorAll('[data-remove-option]').forEach(button => { button.disabled = question.querySelectorAll('[data-question-option]').length <= 2; });
    question.querySelector('[data-add-option]').disabled = false;
  }
});
moduleForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.querySelector('#moduleId').value;
  const save = document.querySelector('#saveModuleButton');
  save.disabled = true;
  try {
    await adminApi(id ? `/api/admin/modulos/${id}` : '/api/admin/modulos', { method: id ? 'PUT' : 'POST', body: JSON.stringify(collectModuleForm()) });
    moduleForm.hidden = true;
    message(adminMessage, id ? 'Cambios del módulo guardados.' : 'Módulo creado desde la plantilla.');
    await Promise.all([loadModules(), loadAudit()]);
  } catch (error) { message(document.querySelector('#moduleMessage'), error.message, true); }
  finally { save.disabled = false; }
});

async function loadAudit() {
  const { eventos, consultado_en } = await adminApi('/api/admin/bitacora');
  const labels = { cuenta_creada: 'Se registró', usuario_eliminado: 'Eliminó una cuenta', clave_temporal_generada: 'Generó una clave temporal', inicio_sesion: 'Inició sesión', inicio_sesion_fallido: 'Acceso fallido', cierre_sesion: 'Cerró sesión', quiz_completado: 'Completó un quiz', asistencia_registrada: 'Registró asistencia', asistencia_actualizada: 'Actualizó asistencia', asistencia_lote_registrada: 'Marcó asistencia del grupo', comentario_foro_creado: 'Participó en una conversación', foro_conversacion_creada: 'Inició una conversación en un módulo', contenido_creado: 'Publicó contenido', contenido_editado: 'Editó contenido', contenido_eliminado: 'Eliminó contenido', modulo_creado: 'Creó un módulo', modulo_editado: 'Editó un módulo', modulo_eliminado: 'Eliminó un módulo' };
  const recent = previousVisit ? eventos.filter(event => String(event.creado_en) > previousVisit).slice(0, 5) : eventos.slice(0, 5);
  document.querySelector('#recentActivity').innerHTML = recent.length ? recent.map(event => `<article class="admin-recent-item"><i class="admin-recent-mark"></i><span><strong>${escapeAdmin(labels[event.accion] || event.accion)}</strong><small>${escapeAdmin(event.actor_nombre)} · ${escapeAdmin(event.objetivo || 'plataforma')}</small></span><time>${escapeAdmin(String(event.creado_en).slice(11,16))}</time></article>`).join('') : '<p class="admin-no-alerts"><span>✓</span> No hay actividad nueva desde tu última visita.</p>';
  if (activeMentorId) {
    try { localStorage.setItem(`fightcode_admin_last_visit_${activeMentorId}`, consultado_en); } catch (_) {}
  }
  document.querySelector('#auditList').innerHTML = eventos.length ? eventos.map(event => {
    let details = {};
    try { details = JSON.parse(event.detalles); } catch (_) {}
    const detailText = Object.entries(details).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ');
    return `<article class="admin-log-entry"><time>${escapeAdmin(event.creado_en)}</time><div><strong>${escapeAdmin(labels[event.accion] || event.accion)}</strong><span>${escapeAdmin(event.actor_nombre)} · ${escapeAdmin(event.objetivo)}</span>${detailText ? `<small>${escapeAdmin(detailText)}</small>` : ''}</div></article>`;
  }).join('') : '<article class="content-block">La bitácora todavía está vacía.</article>';
}

async function refreshAll() {
  try {
    await Promise.all([loadSummary(), loadCoders(), loadMentores(), loadResults(), loadModuleProgress(), loadAttendance(), loadContent(), loadModules(), loadAudit(), loadMeetings()]);
    message(adminMessage, 'Información actualizada.');
  } catch (error) {
    message(adminMessage, error.message, true);
  }
}

document.querySelectorAll('.admin-tab').forEach(tab => tab.addEventListener('click', () => {
  showPanel(tab.dataset.target);
  if (tab.dataset.target === 'modulos') loadModules().catch(error => message(adminMessage, error.message, true));
  if (tab.dataset.target === 'resultados') loadResults();
  if (tab.dataset.target === 'reuniones') loadMeetings().catch(error => message(adminMessage, error.message, true));
}));
document.querySelectorAll('[data-refresh]').forEach(button => button.addEventListener('click', refreshAll));
document.querySelector('#refreshDashboard').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.classList.add('is-loading');
  await refreshAll();
  button.disabled = false;
  button.classList.remove('is-loading');
});
document.querySelectorAll('[data-open-panel]').forEach(button => button.addEventListener('click', () => {
  const target = button.dataset.openPanel;
  showPanel(target);
  if (target === 'resultados') loadResults();
  if (target === 'modulos') loadModules().catch(error => message(adminMessage, error.message, true));
  document.querySelector('.admin-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
document.querySelectorAll('[data-filter-table]').forEach(input => input.addEventListener('input', () => {
  if (input.dataset.filterTable === 'resultsTable') { renderResultsTable(); return; }
  const body = document.getElementById(input.dataset.filterTable);
  const query = input.value.trim().toLocaleLowerCase('es');
  const rows = [...body.querySelectorAll('tr')].filter(row => !row.querySelector('[colspan]'));
  let visible = 0;
  rows.forEach(row => {
    const match = row.textContent.toLocaleLowerCase('es').includes(query);
    row.hidden = !match;
    if (match) visible++;
  });
  body.querySelector('.filter-empty')?.remove();
  if (rows.length && visible === 0) body.insertAdjacentHTML('beforeend', '<tr class="filter-empty"><td colspan="8">No hay coincidencias con esa búsqueda.</td></tr>');
}));
['resultModuleFilter','resultFromFilter','resultToFilter'].forEach(id => document.querySelector(`#${id}`).addEventListener('change', renderResultsTable));
document.querySelector('#clearResultFilters').addEventListener('click', () => {
  document.querySelector('#resultModuleFilter').value = '';
  document.querySelector('#resultFromFilter').value = '';
  document.querySelector('#resultToFilter').value = '';
  document.querySelector('[data-filter-table="resultsTable"]').value = '';
  renderResultsTable();
});
attendanceForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = attendanceForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await adminApi('/api/admin/asistencia', { method: 'POST', body: JSON.stringify({
      coder_id: document.querySelector('#attendanceCoder').value,
      fecha: document.querySelector('#attendanceDate').value,
      estado: document.querySelector('#attendanceState').value,
      nota: document.querySelector('#attendanceNote').value
    }) });
    attendanceForm.reset();
    document.querySelector('#attendanceId').value = '';
    document.querySelector('#attendanceDate').value = localDate;
    message(document.querySelector('#attendanceMessage'), 'Asistencia guardada.');
    await Promise.all([loadAttendance(), loadSummary(), loadAudit()]);
  } catch (error) { message(document.querySelector('#attendanceMessage'), error.message, true); }
  finally { submit.disabled = false; }
});

document.querySelector('#markAllPresent').addEventListener('click', async event => {
  const date = document.querySelector('#attendanceDate').value;
  if (!date) { message(document.querySelector('#attendanceMessage'), 'Elige la fecha de asistencia.', true); return; }
  if (!window.confirm(`¿Marcar a todos los coders como presentes el ${date}? Se actualizarán los registros existentes de ese día.`)) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await adminApi('/api/admin/asistencia/lote', { method: 'POST', body: JSON.stringify({ fecha: date }) });
    message(document.querySelector('#attendanceMessage'), `${result.cantidad} coders marcados como presentes. Puedes corregir las excepciones en el historial.`);
    await Promise.all([loadAttendance(), loadSummary(), loadAudit()]);
  } catch (error) { message(document.querySelector('#attendanceMessage'), error.message, true); }
  finally { button.disabled = false; }
});

contentForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.querySelector('#contentId').value;
  const button = document.querySelector('#saveContentButton');
  button.disabled = true;
  const payload = {
    titulo: document.querySelector('#contentTitle').value,
    tipo: document.querySelector('#contentType').value,
    canal: document.querySelector('#contentChannel').value,
    modulo_slug: document.querySelector('#contentModule').value,
    cuerpo: document.querySelector('#contentBody').value,
    url: document.querySelector('#contentUrl').value,
    publicado: document.querySelector('#contentPublished').checked
  };
  try {
    await adminApi(id ? `/api/admin/contenido/${id}` : '/api/admin/contenido', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    contentForm.reset();
    document.querySelector('#contentId').value = '';
    document.querySelector('#contentPublished').checked = true;
    button.textContent = 'Publicar contenido';
    message(document.querySelector('#contentMessage'), id ? 'Cambios guardados.' : 'Contenido creado.');
    await Promise.all([loadContent(), loadSummary(), loadAudit()]);
  } catch (error) { message(document.querySelector('#contentMessage'), error.message, true); }
  finally { button.disabled = false; }
});

document.querySelector('#cancelAttendanceEdit').addEventListener('click', () => {
  document.querySelector('#attendanceId').value = '';
  document.querySelector('#attendanceDate').value = localDate;
});
document.querySelector('#cancelContentEdit').addEventListener('click', () => {
  document.querySelector('#contentId').value = '';
  document.querySelector('#contentChannel').value = 'anuncios';
  document.querySelector('#contentPublished').checked = true;
  document.querySelector('#saveContentButton').textContent = 'Publicar contenido';
});

document.querySelector('#createMentorInvite').addEventListener('click', async event => {
  const button = event.currentTarget;
  const notice = document.querySelector('#mentorInviteNotice');
  button.disabled = true;
  try {
    const { invitacion, expira_dias } = await adminApi('/api/admin/invitaciones', { method: 'POST', body: '{}' });
    notice.textContent = `Código de un solo uso (vence en ${expira_dias} días). Cópialo ahora; no volverá a mostrarse: ${invitacion}`;
    notice.classList.remove('is-error');
  } catch (error) { message(notice, error.message, true); }
  finally { button.disabled = false; }
});

const meetingForm = document.querySelector('#meetingForm');
const meetingStartInput = document.querySelector('#meetingStart');
const meetingEndInput = document.querySelector('#meetingEnd');
const asLocalInput = date => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
};
const defaultMeetingStart = new Date(Date.now() + 60 * 60_000);
defaultMeetingStart.setMinutes(0, 0, 0);
meetingStartInput.min = asLocalInput(new Date());
meetingStartInput.value = asLocalInput(defaultMeetingStart);
const defaultMeetingEnd = new Date(defaultMeetingStart.getTime() + 60 * 60_000);
meetingEndInput.min = meetingStartInput.value;
meetingEndInput.value = asLocalInput(defaultMeetingEnd);
meetingStartInput.addEventListener('change', () => {
  meetingEndInput.min = meetingStartInput.value;
  if (!meetingEndInput.value || meetingEndInput.value <= meetingStartInput.value) {
    meetingEndInput.value = asLocalInput(new Date(new Date(meetingStartInput.value).getTime() + 60 * 60_000));
  }
});
meetingForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#saveMeetingButton');
  button.disabled = true;
  try {
    await adminApi('/api/admin/reuniones', { method: 'POST', body: JSON.stringify({
      titulo: document.querySelector('#meetingTitle').value,
      descripcion: document.querySelector('#meetingDescription').value,
      inicia_en: meetingStartInput.value,
      termina_en: meetingEndInput.value,
      enlace_meet: document.querySelector('#meetingLink').value
    }) });
    meetingForm.reset();
    const nextStart = new Date(Date.now() + 60 * 60_000);
    nextStart.setMinutes(0, 0, 0);
    meetingStartInput.value = asLocalInput(nextStart);
    meetingEndInput.value = asLocalInput(new Date(nextStart.getTime() + 60 * 60_000));
    meetingStartInput.min = asLocalInput(new Date());
    meetingEndInput.min = meetingStartInput.value;
    message(document.querySelector('#meetingMessage'), 'Reunión programada. Ya aparece en la agenda de los coders.');
    await loadMeetings();
  } catch (error) { message(document.querySelector('#meetingMessage'), error.message, true); }
  finally { button.disabled = false; }
});

adminApi('/api/sesion').then(data => {
  if (!data.autenticado || data.usuario.rol !== 'mentor') {
    location.replace('/paginas/cuenta.html?next=%2Fpaginas%2Fadministracion.html');
    return;
  }
  activeMentorId = data.usuario.id;
  try { previousVisit = localStorage.getItem(`fightcode_admin_last_visit_${activeMentorId}`) || ''; } catch (_) { previousVisit = ''; }
  refreshAll();
}).catch(error => message(adminMessage, error.message, true));
