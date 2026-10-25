const additionalChallenges = [
  ['01', 'Calculadora de gastos', 'Pide varios gastos al usuario, suma los valores y muestra el total. Practica números, input() y conversiones.'],
  ['02', 'Adivina el número', 'Crea un juego de intentos con pistas de mayor o menor. Practica ciclos, condiciones y comparación.'],
  ['03', 'Agenda de tareas', 'Guarda tareas en una lista y permite agregarlas o marcarlas como realizadas. Practica listas y ciclos.'],
  ['04', 'Conversor de temperatura', 'Convierte grados entre Celsius y Fahrenheit con funciones reutilizables. Practica parámetros y return.'],
  ['05', 'Analizador de palabras', 'Cuenta palabras y caracteres en un texto. Practica cadenas, listas y funciones.']
];

document.querySelector('#challengeGrid').innerHTML = additionalChallenges.map(([number, title, description]) => `
  <article class="card">
    <div class="card-top">
      <span class="card-icon">${number}</span>
      <span class="badge">Reto adicional</span>
    </div>
    <h3>${title}</h3>
    <p>${description}</p>
    <div class="card-bottom">
      <strong>Guía descargable</strong>
      <a class="arrow-link" href="../documentos/retos_python_basico.pdf" download>Descargar PDF →</a>
    </div>
  </article>
`).join('');
