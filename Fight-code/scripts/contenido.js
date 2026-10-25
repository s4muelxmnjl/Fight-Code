window.FIGHTCODE = {
  route: {
    id: 'python-basico',
    title: 'Python Básico',
    level: 'Inicial',
    duration: '5 secciones · 25 preguntas',
    summary: 'Un primer recorrido por Python: sintaxis, datos, decisiones, ciclos y funciones. Aprende las bases y ponlas en práctica.',
    lessons: [
      {
        title: '1. Conociendo Python',
        description: 'Qué es Python, dónde se utiliza y cómo leer y ejecutar tus primeros comandos.',
        concepts: ['Lenguaje de propósito general', 'Intérprete y ejecución', 'print()', 'Comentarios con #']
      },
      {
        title: '2. Variables y tipos de datos',
        description: 'Guarda información y reconoce los tipos de datos más utilizados.',
        concepts: ['Variables y asignación', 'int y float', 'str y bool', 'type() y conversión']
      },
      {
        title: '3. Operadores y decisiones',
        description: 'Compara valores y controla el flujo de un programa con condiciones.',
        concepts: ['Operadores aritméticos', 'Comparaciones', 'and, or y not', 'if, elif y else']
      },
      {
        title: '4. Colecciones y ciclos',
        description: 'Agrupa datos y repite instrucciones para automatizar tareas.',
        concepts: ['Listas y posiciones', 'for y range()', 'while', 'break y continue']
      },
      {
        title: '5. Funciones y depuración',
        description: 'Organiza tu código en funciones, recibe datos y encuentra errores.',
        concepts: ['def y parámetros', 'return', 'Alcance básico', 'Errores y lectura de mensajes']
      }
    ]
  },
  sections: [
    {
      title: 'Sección 1 · Primeros pasos con Python',
      questions: [
        { q: '¿Qué es Python?', options: ['Un lenguaje de programación de propósito general', 'Un navegador web', 'Una base de datos', 'Un sistema operativo'], wrongWhy: "Son otras herramientas; Python es un lenguaje.", why: 'Python es un lenguaje de programación utilizado para crear distintos tipos de software.' },
        { q: '¿Qué función muestra un mensaje en la consola?', options: ['show()', 'print()', 'write.line()', 'console()'], wrongWhy: "No son la función estándar para mostrar datos.", why: 'print() muestra texto o valores en la salida del programa.' },
        { q: '¿Qué símbolo inicia un comentario de una línea?', options: ['//', '<!--', '#', '**'], wrongWhy: "Son sintaxis de otros lenguajes u operadores.", why: 'En Python, el símbolo # inicia un comentario de una línea.' },
        { q: '¿Qué suele hacer el intérprete de Python?', options: ['Ejecuta instrucciones Python', 'Dibuja imágenes automáticamente', 'Reemplaza el teclado', 'Convierte el monitor en servidor'], wrongWhy: "El intérprete ejecuta código; no realiza esas tareas.", why: 'El intérprete lee y ejecuta el código Python.' },
        { q: '¿Cuál es una instrucción válida para mostrar Hola?', options: ['print("Hola")', 'echo = Hola', 'show("Hola")', 'Hola.print'], wrongWhy: "No usan la sintaxis print() válida.", why: 'La llamada print("Hola") muestra la cadena Hola.' }
      ]
    },
    {
      title: 'Sección 2 · Variables y tipos de datos',
      questions: [
        { q: '¿Qué valor tiene la variable edad después de edad = 16?', options: ['El texto edad', 'El número 16', 'Una función', 'Un valor vacío'], wrongWhy: "edad es la variable; 16 es su valor.", why: 'El operador = asigna el valor de la derecha a la variable de la izquierda.' },
        { q: '¿Qué tipo de dato representa "Hola"?', options: ['int', 'bool', 'str', 'float'], wrongWhy: "Hola entre comillas es str, es decir, texto.", why: 'Los textos entre comillas son cadenas de caracteres (str).' },
        { q: '¿Qué tipo de dato representa 3.5?', options: ['float', 'str', 'bool', 'list'], wrongWhy: "3.5 es un número decimal: float.", why: 'Los números con parte decimal se representan como float.' },
        { q: '¿Cuál de estos valores es booleano?', options: ['"True"', '1.0', 'True', '"False"'], wrongWhy: "True y False sin comillas son bool.", why: 'True y False, sin comillas, son los valores booleanos de Python.' },
        { q: '¿Qué devuelve type(7)?', options: ['El tipo del valor 7', 'El doble de 7', 'El texto "7"', 'Una lista con 7'], wrongWhy: "type() devuelve int; no transforma el dato.", why: 'type() permite consultar el tipo de un objeto; en este caso, int.' }
      ]
    },
    {
      title: 'Sección 3 · Operadores y condiciones',
      questions: [
        { q: '¿Qué resultado produce 8 // 3?', options: ['2', '2.66…', '1', '24'], wrongWhy: "// divide y elimina la parte decimal.", why: '// realiza división entera y descarta la parte decimal.' },
        { q: '¿Qué operador comprueba si dos valores son iguales?', options: ['=', '==', '!=', '>='], wrongWhy: "= asigna; == compara igualdad.", why: '== compara igualdad. Un solo = se usa para asignar.' },
        { q: '¿Qué palabra inicia una condición en Python?', options: ['when', 'if', 'check', 'case'], wrongWhy: "if inicia las condiciones en Python.", why: 'if introduce una condición; puede acompañarse de elif y else.' },
        { q: '¿Qué operador lógico exige que ambas condiciones sean verdaderas?', options: ['or', 'not', 'and', 'in'], wrongWhy: "and exige que ambas condiciones sean verdaderas.", why: 'and devuelve verdadero cuando las dos expresiones son verdaderas.' },
        { q: '¿Qué palabra permite revisar una condición alternativa?', options: ['elif', 'otherwise', 'then', 'next'], wrongWhy: "elif evalúa una condición alternativa.", why: 'elif permite evaluar otra condición si las anteriores fueron falsas.' }
      ]
    },
    {
      title: 'Sección 4 · Listas y ciclos',
      questions: [
        { q: '¿Qué estructura permite guardar varios elementos en orden?', options: ['list', 'bool', 'float', 'if'], wrongWhy: "list almacena varios elementos en orden.", why: 'Una lista almacena una secuencia ordenada de elementos.' },
        { q: '¿Cuál es el índice del primer elemento de una lista?', options: ['1', '-1', '0', 'Depende del tamaño'], wrongWhy: "El primer índice de una lista es 0.", why: 'La indexación de listas en Python comienza en 0.' },
        { q: '¿Qué ciclo suele usarse para recorrer elementos de una lista?', options: ['for', 'if', 'def', 'try'], wrongWhy: "for recorre los elementos de una secuencia.", why: 'for permite recorrer los elementos de una secuencia.' },
        { q: '¿Qué genera range(4)?', options: ['Los valores 0, 1, 2 y 3', 'Los valores 1, 2, 3 y 4', 'Solo el número 4', 'Una lista vacía'], wrongWhy: "range(4) produce valores del 0 al 3.", why: 'range(4) produce una secuencia desde 0 hasta antes de 4.' },
        { q: '¿Qué palabra detiene un ciclo inmediatamente?', options: ['stop', 'break', 'exitloop', 'return'], wrongWhy: "break detiene el ciclo actual.", why: 'break termina el ciclo que se está ejecutando.' }
      ]
    },
    {
      title: 'Sección 5 · Funciones y depuración',
      questions: [
        { q: '¿Qué palabra se usa para definir una función?', options: ['func', 'function', 'def', 'make'], wrongWhy: "def declara funciones en Python.", why: 'Las funciones se definen con def, seguido del nombre y los paréntesis.' },
        { q: '¿Para qué sirve return en una función?', options: ['Para devolver un resultado', 'Para repetir el programa', 'Para imprimir siempre el resultado', 'Para crear una variable global'], wrongWhy: "return devuelve un valor; no lo imprime.", why: 'return entrega el resultado de la función al lugar desde donde se llamó.' },
        { q: '¿Qué es un parámetro?', options: ['Un dato que una función recibe', 'Un tipo de error', 'Una palabra reservada para ciclos', 'Una librería externa'], wrongWhy: "Un parámetro es un dato que recibe la función.", why: 'Los parámetros permiten que una función reciba datos de entrada.' },
        { q: '¿Qué indica normalmente un SyntaxError?', options: ['Un problema en la sintaxis del código', 'Que el computador no tiene internet', 'Que la variable es una lista', 'Que el programa terminó correctamente'], wrongWhy: "SyntaxError indica un error en la sintaxis.", why: 'SyntaxError indica que Python no puede interpretar la forma escrita del código.' },
        { q: '¿Qué práctica ayuda a encontrar un error?', options: ['Leer el mensaje y revisar la línea señalada', 'Borrar todo el programa', 'Cambiar todos los nombres', 'Ignorar el mensaje'], wrongWhy: "El mensaje de error da pistas sobre la causa y la línea.", why: 'El mensaje de error suele indicar el tipo de problema y dónde comenzar a revisar.' }
      ]
    }
  ],
  docs: [
    { title: 'Tutorial oficial de Python', category: 'Aprendizaje', description: 'Introducción guiada a la sintaxis y las capacidades del lenguaje.', url: 'https://docs.python.org/3/tutorial/' },
    { title: 'Referencia del lenguaje', category: 'Referencia', description: 'Sintaxis y semántica del lenguaje Python.', url: 'https://docs.python.org/3/reference/' },
    { title: 'Funciones incorporadas', category: 'Referencia', description: 'Funciones y tipos disponibles sin importar módulos adicionales.', url: 'https://docs.python.org/3/library/functions.html' },
    { title: 'Tipos de datos y estructuras', category: 'Datos', description: 'Números, cadenas, listas y otras estructuras de datos.', url: 'https://docs.python.org/3/tutorial/datastructures.html' },
    { title: 'Control de flujo', category: 'Lógica', description: 'Condiciones, ciclos y otras herramientas para controlar la ejecución.', url: 'https://docs.python.org/3/tutorial/controlflow.html' },
    { title: 'Errores y excepciones', category: 'Depuración', description: 'Identifica errores de sintaxis y aprende a manejar excepciones.', url: 'https://docs.python.org/3/tutorial/errors.html' },
    { title: 'Módulos y paquetes', category: 'Organización', description: 'Divide programas y reutiliza funcionalidades mediante módulos.', url: 'https://docs.python.org/3/tutorial/modules.html' },
    { title: 'Biblioteca estándar', category: 'Referencia', description: 'Explora los módulos incluidos con Python.', url: 'https://docs.python.org/3/library/' },
    { title: 'Entornos virtuales (venv)', category: 'Herramientas', description: 'Crea entornos aislados para instalar dependencias por proyecto.', url: 'https://docs.python.org/3/library/venv.html' },
    { title: 'Guía de estilo PEP 8', category: 'Buenas prácticas', description: 'Convenciones de estilo para escribir código Python legible.', url: 'https://peps.python.org/pep-0008/' },
    { title: 'Empaquetar e instalar proyectos', category: 'Herramientas', description: 'Guía oficial de empaquetado del ecosistema Python.', url: 'https://packaging.python.org/en/latest/tutorials/installing-packages/' }
  ]
};
