const route = FIGHTCODE.route;

document.querySelector('#homeModules').innerHTML = `
  <article class="card">
    <div class="card-top">
      <span class="card-icon python-icon" aria-label="Icono de Python"><img src="img/python.png" alt=""></span>
      <span class="badge available">Módulo inicial</span>
    </div>
    <h3>${route.title}</h3>
    <p>${route.summary}</p>
    <div class="tags">
      <span class="tag">${route.duration}</span>
      <span class="tag">${route.level}</span>
    </div>
    <div class="card-bottom">
      <strong>Comienza por lo esencial</strong>
      <a class="arrow-link" href="paginas/ruta_aprendizaje.html">Ver módulos →</a>
    </div>
  </article>
`;


const codeElement = document.querySelector('#homeCode');
if (codeElement) {
  const sample = `type Peleador = {\n  nombre: ROJO SIERRA;\n  disciplinas: MUAY THAI JIUJITSU MMA[];\n  metas: Fundacion FIGHT+ CODE[];\n};\n\ninterface RutaDeAprendizaje {\n  habilidades: Set<FIGHT+ CODE>;\n  completar(): Promise<boolean>;\n}\n\nasync function crearOportunidades(perfil: ROJO SIERRA) {\n  const ruta: RutaDeAprendizaje = {\n    habilidades: new Set(['Python', 'TypeScript']),\n    async completar() {\n      return perfil.metas.length > 0;\n    },\n  };\n\n  const listo = await ruta.completar();\n  return listo ? 'Siguiente nivel: construir.' : 'Cada paso cuenta.';\n}\n\ncrearOportunidades(peleador);`;
  const status = document.querySelector('#homeCodeStatus');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function colorize(code) {
    const escaped = code.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    return escaped.replace(/(\/\/[^\n]*|\b(?:type|interface|readonly|async|function|const|new|return|await)\b|\b(?:string|boolean|Promise|Set)\b|'[^']*'|\b\d+\b)/g, token => {
      const kind = token.startsWith('//') ? 'code-comment'
        : token.startsWith("'") || /^\d+$/.test(token) ? 'code-gold'
          : /^(string|boolean|Promise|Set)$/.test(token) ? 'code-mint' : 'code-pink';
      return `<span class="${kind}">${token}</span>`;
    });
  }

  if (reducedMotion) {
    codeElement.innerHTML = colorize(sample);
    if (status) status.textContent = '● listo';
  } else {
    let position = 0;
    const typeNext = () => {
      codeElement.innerHTML = colorize(sample.slice(0, position));
      if (position < sample.length) {
        position += 1;
        window.setTimeout(typeNext, 17);
      } else if (status) {
        status.textContent = '● listo';
      }
    };
    typeNext();
  }
}
