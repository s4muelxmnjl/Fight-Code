(() => {
  const list = document.querySelector('#coderMeetingList');
  if (!list) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatDate = value => {
    const date = new Date(`${String(value || '').replace(' ', 'T')}-05:00`);
    return Number.isNaN(date.getTime()) ? 'Fecha por confirmar' : new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  fetch('/api/reuniones', { credentials: 'same-origin' })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la agenda.');
      return data.reuniones || [];
    })
    .then(reuniones => {
      if (!reuniones.length) {
        list.innerHTML = '<article class="meeting-empty"><strong>Tu agenda está despejada.</strong><span>Cuando un mentor programe una sesión, aparecerá aquí con su enlace de acceso.</span></article>';
        return;
      }
      list.innerHTML = reuniones.map((meeting, index) => {
        const start = new Date(`${String(meeting.inicia_en).replace(' ', 'T')}-05:00`);
        const end = new Date(`${String(meeting.termina_en).replace(' ', 'T')}-05:00`);
        const day = Number.isNaN(start.getTime()) ? '—' : start.getDate();
        const month = Number.isNaN(start.getTime()) ? '' : new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(start);
        const endTime = Number.isNaN(end.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(end);
        return `<article class="meeting-card" style="--meeting-order:${index}">
          <div class="meeting-date"><span>FECHA</span><strong>${escapeHtml(day)}</strong><small>${escapeHtml(month)}</small></div>
          <div class="meeting-copy"><span class="eyebrow accent">${escapeHtml(formatDate(meeting.inicia_en))}</span><h3>${escapeHtml(meeting.titulo)}</h3><p>${escapeHtml(meeting.descripcion || 'Sesión de acompañamiento para coders.')}</p><small>Con ${escapeHtml(`${meeting.mentor_nombre || ''} ${meeting.mentor_apellido || ''}`.trim() || 'tu mentor')} · hasta ${escapeHtml(endTime)}</small></div>
          <a class="button" href="${escapeHtml(meeting.enlace_meet)}" target="_blank" rel="noopener noreferrer">Entrar a Meet ↗</a>
        </article>`;
      }).join('');
    })
    .catch(error => {
      list.innerHTML = `<article class="meeting-empty is-error"><strong>No se pudo cargar la agenda.</strong><span>${escapeHtml(error.message)}</span></article>`;
    });
})();
