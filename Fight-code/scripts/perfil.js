const profileForm = document.querySelector('#profileForm');
const photoForm = document.querySelector('#photoForm');
const photoInput = document.querySelector('#profilePhotoInput');
const photoMessage = document.querySelector('#photoMessage');
const profileMessage = document.querySelector('#profileMessage');
const avatarImage = document.querySelector('#profileAvatar');
const avatarFallback = document.querySelector('#profileAvatarFallback');
let currentUser = null;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('is-error', isError);
}

function showAvatar(url, user) {
  const initials = `${user.nombre?.trim().charAt(0) || ''}${user.apellido?.trim().charAt(0) || ''}`.toUpperCase() || 'FC';
  avatarFallback.textContent = initials;
  if (url) {
    avatarImage.src = url;
    avatarImage.hidden = false;
    avatarFallback.hidden = true;
    document.querySelector('#removePhotoButton').hidden = false;
  } else {
    avatarImage.removeAttribute('src');
    avatarImage.hidden = true;
    avatarFallback.hidden = false;
    document.querySelector('#removePhotoButton').hidden = true;
  }
  document.dispatchEvent(new CustomEvent('fightcode:avatar-updated', { detail: { foto: url } }));
}

function fillProfile(user) {
  currentUser = user;
  profileForm.elements.nombre.value = user.nombre || '';
  profileForm.elements.apellido.value = user.apellido || '';
  profileForm.elements.identificacion.value = user.identificacion || '';
  profileForm.elements.correo.value = user.correo || '';
  document.querySelector('#profileRole').textContent = user.rol === 'mentor' ? 'CUENTA DE MAESTRO' : 'CUENTA CODER';
  document.querySelector('#profileTitle').textContent = `Hola, ${user.nombre}`;
  document.querySelector('#profileEmailDisplay').textContent = user.correo;
  if (user.rol === 'mentor') {
    const link = document.querySelector('#learningLink');
    link.href = 'administracion.html';
    link.textContent = 'Ir al panel de maestro →';
  }
  showAvatar(user.foto, user);
}

function addText(parent, tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

async function loadActivity() {
  const target = document.querySelector('#profileStats');
  try {
    const { resultados } = await api('/api/resultados');
    target.replaceChildren();
    if (!resultados.length) {
      addText(target, 'p', 'Aún no tienes quizzes guardados. Completa un módulo y aquí verás tus resultados.', 'account-muted');
      return;
    }
    const best = Math.max(...resultados.map(item => Number(item.porcentaje) || 0));
    const summary = document.createElement('div');
    summary.className = 'profile-result-summary';
    addText(summary, 'strong', `${best}%`, 'profile-result-best');
    addText(summary, 'span', `Mejor puntaje · ${resultados.length} quiz${resultados.length === 1 ? '' : 'zes'} completado${resultados.length === 1 ? '' : 's'}`);
    target.append(summary);
    const list = document.createElement('div');
    list.className = 'profile-result-list';
    resultados.forEach(item => {
      const article = document.createElement('article');
      article.className = 'profile-result-item';
      const header = document.createElement('div');
      addText(header, 'strong', String(item.modulo).replaceAll('-', ' '));
      addText(header, 'b', `${item.correctas}/${item.total} · ${item.porcentaje}%`);
      article.append(header);
      addText(article, 'small', item.creado_en);
      const details = document.createElement('details');
      addText(details, 'summary', 'Ver reflexiones');
      addText(details, 'p', `¿Qué aprendiste? ${item.reflexion_aprendizaje || 'Sin respuesta'}`);
      addText(details, 'p', `¿Qué dificultades encontraste? ${item.reflexion_dificultades || 'Sin respuesta'}`);
      article.append(details);
      list.append(article);
    });
    target.append(list);
  } catch (error) { target.textContent = error.message; }
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  document.querySelector('#savePhotoButton').disabled = !file;
  showMessage(photoMessage, file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : '');
});

photoForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#savePhotoButton');
  const file = photoInput.files?.[0];
  if (!file) return;
  button.disabled = true;
  try {
    const body = new FormData();
    body.append('foto', file);
    const response = await fetch('/api/perfil/foto', { method: 'POST', credentials: 'same-origin', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo subir la imagen.');
    currentUser.foto = result.foto;
    showAvatar(result.foto, currentUser);
    photoInput.value = '';
    showMessage(photoMessage, 'Foto de perfil actualizada.');
  } catch (error) { showMessage(photoMessage, error.message, true); }
  finally { button.disabled = !photoInput.files?.[0]; }
});

document.querySelector('#removePhotoButton').addEventListener('click', async () => {
  try {
    await api('/api/perfil/foto/eliminar', { method: 'POST', body: '{}' });
    currentUser.foto = null;
    showAvatar(null, currentUser);
    showMessage(photoMessage, 'Foto eliminada.');
  } catch (error) { showMessage(photoMessage, error.message, true); }
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = profileForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await api('/api/perfil', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(profileForm))) });
    fillProfile({ ...currentUser, ...result.usuario });
    profileForm.elements.clave_actual.value = '';
    profileForm.elements.clave.value = '';
    showMessage(profileMessage, 'Tus datos quedaron actualizados.');
  } catch (error) { showMessage(profileMessage, error.message, true); }
  finally { button.disabled = false; }
});

document.querySelector('#logoutButton').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await api('/api/cerrar-sesion', { method: 'POST', body: '{}' }); location.assign('/paginas/cuenta.html'); }
  catch (error) { showMessage(profileMessage, error.message, true); button.disabled = false; }
});

api('/api/sesion').then(data => {
  if (!data.autenticado) {
    location.replace(`/paginas/cuenta.html?next=${encodeURIComponent('/paginas/perfil.html')}`);
    return;
  }
  fillProfile(data.usuario);
  loadActivity();
  const pendingError = sessionStorage.getItem('fightcode_pending_error');
  if (pendingError) {
    showMessage(profileMessage, `Los cambios de cuenta están disponibles. Resultado pendiente sin guardar: ${pendingError}`, true);
    sessionStorage.removeItem('fightcode_pending_error');
  } else if (sessionStorage.getItem('fightcode_result_saved')) {
    sessionStorage.removeItem('fightcode_result_saved');
    showMessage(profileMessage, 'Tu resultado pendiente quedó guardado.');
  }
}).catch(() => showMessage(profileMessage, 'No se pudo cargar tu cuenta. Inténtalo de nuevo.', true));
