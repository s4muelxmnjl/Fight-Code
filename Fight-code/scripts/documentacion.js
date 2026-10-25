const grid = document.querySelector('#docGrid');
const filter = document.querySelector('#docFilter');

function renderDocumentation() {
  const documents = FIGHTCODE.docs.filter(item =>
    filter.value === 'all' || item.category === filter.value
  );

  grid.innerHTML = documents.map(item => `
    <article class="resource">
      <span class="resource-icon">↗</span>
      <div>
        <span class="badge">${item.category}</span>
        <h3 style="margin-top:8px">${item.title}</h3>
        <p>${item.description}</p>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
          Abrir documentación →
        </a>
      </div>
    </article>
  `).join('');
}

filter.addEventListener('change', renderDocumentation);
renderDocumentation();
