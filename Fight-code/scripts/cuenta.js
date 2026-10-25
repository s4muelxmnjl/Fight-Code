const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const loginMessage = document.querySelector('#loginMessage');
const registerMessage = document.querySelector('#registerMessage');
const loginTab = document.querySelector('#loginTab');
const registerTab = document.querySelector('#registerTab');
const registerRole = document.querySelector('#registerRole');
const mentorCodeField = document.querySelector('#mentorCodeField');
const mentorCode = document.querySelector('#mentorCode');
const loginRole = document.querySelector('#loginRole');

function destinationFor(user) {
  if (user?.rol === 'coder') return '/index.html';
  const requested = new URLSearchParams(location.search).get('next');
  if (requested) {
    try {
      const target = new URL(requested, location.origin);
      if (target.origin === location.origin && !['/paginas/cuenta.html', '/paginas/perfil.html'].includes(target.pathname)) {
        if (target.pathname === '/paginas/administracion.html' && user.rol !== 'mentor') return '/paginas/ruta_aprendizaje.html';
        return target.pathname + target.search + target.hash;
      }
    } catch (_) {}
  }
  return '/paginas/perfil.html';
}

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

function setTab(mode) {
  const registering = mode === 'register';
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  loginTab.classList.toggle('is-active', !registering);
  registerTab.classList.toggle('is-active', registering);
  loginTab.setAttribute('aria-selected', String(!registering));
  registerTab.setAttribute('aria-selected', String(registering));
  showMessage(loginMessage, '');
  showMessage(registerMessage, '');
}

async function submitForm(form, messageElement, endpoint) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.classList.add('is-loading');
  try {
    const payload = Object.fromEntries(new FormData(form));
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    const pending = sessionStorage.getItem('fightcode_pending_result');
    if (pending) {
      try {
        await api('/api/resultados', { method: 'POST', body: pending });
        sessionStorage.removeItem('fightcode_pending_result');
        sessionStorage.setItem('fightcode_result_saved', '1');
      } catch (error) {
        sessionStorage.setItem('fightcode_pending_error', error.message);
      }
    }
    location.assign(destinationFor(data.usuario));
  } catch (error) { showMessage(messageElement, error.message, true); }
  finally { button.disabled = false; button.classList.remove('is-loading'); }
}

function updateRoleCopy() {
  document.querySelector('#loginRoleNote').textContent = loginRole.value === 'mentor'
    ? 'Accede al espacio para acompañar y gestionar la formación.'
    : 'Accede a tu ruta, módulos y resultados de aprendizaje.';
  document.querySelector('#registerRoleNote').textContent = registerRole.value === 'mentor'
    ? 'Usa una invitación de un solo uso que te haya compartido un maestro.'
    : 'Crea una cuenta de coder para entrar a la ruta y guardar tus resultados.';
}

loginTab.addEventListener('click', () => setTab('login'));
registerTab.addEventListener('click', () => setTab('register'));
loginForm.addEventListener('submit', event => { event.preventDefault(); submitForm(loginForm, loginMessage, '/api/iniciar-sesion'); });
registerForm.addEventListener('submit', event => { event.preventDefault(); submitForm(registerForm, registerMessage, '/api/registro'); });
registerRole.addEventListener('change', () => {
  const isMentor = registerRole.value === 'mentor';
  mentorCodeField.hidden = !isMentor;
  mentorCode.required = isMentor;
  updateRoleCopy();
});
loginRole.addEventListener('change', updateRoleCopy);
updateRoleCopy();

api('/api/sesion').then(({ autenticado, usuario }) => {
  if (autenticado) location.replace(destinationFor(usuario));
  else if (sessionStorage.getItem('fightcode_pending_error')) {
    showMessage(loginMessage, `La cuenta está activa, pero el resultado pendiente no se guardó: ${sessionStorage.getItem('fightcode_pending_error')}`, true);
    sessionStorage.removeItem('fightcode_pending_error');
  } else if (sessionStorage.getItem('fightcode_pending_result')) setTab('login');
  if (sessionStorage.getItem('fightcode_result_saved')) {
    sessionStorage.removeItem('fightcode_result_saved');
    showMessage(loginMessage, 'Tu resultado pendiente se guardó en tu cuenta.');
  }
}).catch(() => showMessage(loginMessage, 'No se pudo conectar con cuentas. Revisa la configuración de PHP y MySQL.', true));
