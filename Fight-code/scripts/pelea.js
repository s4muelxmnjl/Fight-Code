(() => {
  const $ = selector => document.querySelector(selector);
  const game = $('#fightGame');
  if (!game) return;
  const sizeButton = $('#toggleFightSize');

  const ui = {
    player: $('#fighterPlayer'), opponent: $('#fighterOpponent'), playerHealth: $('#playerHealth'), opponentHealth: $('#opponentHealth'),
    playerSprite: $('#playerSprite'), playerPortrait: $('#playerPortrait'), playerNameHud: $('#playerNameHud'), playerArenaLabel: $('#playerArenaLabel'),
    characterPicker: $('#fightCharacterPicker'), characterTagline: $('#characterTagline'), characterPreviewImage: $('#selectedCharacterPreview'),
    characterPreviewName: $('#selectedCharacterName'), characterPreviewQuote: $('#characterPreviewQuote'),
    characterSkill: $('#selectedCharacterSkill'), characterSkillDescription: $('#selectedCharacterSkillDescription'),
    playerHp: $('#playerHp'), opponentHp: $('#opponentHp'), playerDamage: $('#playerDamage'), opponentDamage: $('#opponentDamage'),
    round: $('#fightRound'), timer: $('#fightTimer'), call: $('#fightCall'), announcer: $('#fightAnnouncer'), intro: $('#fightIntro'),
    playerScore: $('#fightPlayerScore'), opponentScore: $('#fightOpponentScore'),
    result: $('#fightResult'), resultLabel: $('#fightResultLabel'), resultTitle: $('#fightResultTitle'), resultCopy: $('#fightResultCopy'),
    ranking: $('#fightRankingList'), rankingNote: $('#fightRankingNote'), music: $('#fightMusic'), difficulty: $('#fightDifficulty'),
    playerBubble: $('#playerBubble'), opponentBubble: $('#opponentBubble'), specialButton: $('#fightSpecial')
  };
  const state = { status: 'ready', round: 1, time: 45, playerHp: 100, opponentHp: 100, playerDamage: 0, opponentDamage: 0, playerX: 24, opponentX: 76, playerBlocking: false, opponentBlocking: false, lastAttack: 0, skillReadyAt: 0, empoweredAttack: false, opponentStunnedUntil: 0, playerShieldUntil: 0, playerDodgeUntil: 0, audio: null, musicBus: null, sfxBus: null, musicOn: false, musicTimer: null, musicStep: 0, noiseBuffer: null, timers: [], saved: false, difficulty: 'normal', characterId: 'rojo-sierra' };
  const CHARACTERS = {
    'rojo-sierra': { name: 'ROJO SIERRA', image: 'img/luchadores/rojo-sierra-fightmma.png', style: 'EL CODER CAMPEÓN DEL RING', tagline: 'Cada round es una nueva oportunidad.', intro: '¡FIGHT+! A pelear.', selectionLine: '¡FIGHT+! La estrategia también pega.', callouts: ['¡Round a round!', '¡FIGHT+!', 'Respira, calcula y conecta.', '¡Siguiente nivel!'], pain: ['¡Eso no estaba en el plan!', 'Me sacudo y vuelvo al round.', '¡Sigo firme en el ring!'], miss: 'Ese golpe quedó en borrador.', skill: { name: 'Combo FIGHT+', type: 'power', cooldown: 12000, description: 'Potencia tu próximo golpe conectado.' } },
    angel: { name: 'ANGEL', image: 'img/luchadores/arena/angel.webp', style: 'DEV · DEPURADOR', tagline: 'Depura, compila y conecta.', intro: 'Código listo: que empiece el build.', selectionLine: '¡Bug detectado: rival sin pruebas unitarias!', callouts: ['¡Bug detectado: guardia abierta!', 'Mi combo pasó QA.', '¡Compila y conecta!', 'Desplegando uppercut…'], pain: ['Ese golpe rompió producción.', 'Registro un bug y sigo.', '¡Reinicio la guardia!'], miss: 'Ese golpe no pasó las pruebas.', skill: { name: 'Depurar rival', type: 'stun', cooldown: 15000, description: 'Interrumpe al rival durante 2 segundos.' } },
    brates: { name: 'BRATES', image: 'img/luchadores/arena/brates.webp', style: 'GRAPPLER · CONTROL', tagline: 'Control, base, paciencia.', intro: 'Base firme. Voy por el control.', selectionLine: 'Primero la posición; luego el ataque.', callouts: ['Primero la posición; luego el ataque.', 'Cierro la guardia, ¡sin salida!', 'Te leí el movimiento.', 'La técnica también presiona.'], pain: ['Buen intento; todavía tengo base.', 'Me ajusto y busco el escape.', '¡No cedo la posición!'], miss: 'Sin control, ese intento no cuenta.', skill: { name: 'Recuperar base', type: 'heal', cooldown: 14000, description: 'Recupera hasta 24 puntos de salud.' } },
    cris: { name: 'CRIS', image: 'img/luchadores/arena/cris.webp', style: 'GRAPPLER · PRECISIÓN', tagline: 'Ritmo fino. Golpe preciso.', intro: 'Ritmo listo. ¡Vamos al round!', selectionLine: '¡Ritmo, distancia y precisión!', callouts: ['¡No pierdas el compás!', 'Un golpe limpio cambia el round.', 'Ritmo, distancia y precisión.', '¡Ese jab cayó a tiempo!'], pain: ['Me moviste el ritmo, nada más.', 'Respiro y recupero distancia.', 'El siguiente entra más limpio.'], miss: 'Ese golpe se salió del compás.', skill: { name: 'Paso relámpago', type: 'dodge', cooldown: 13000, description: 'Avanza y esquiva los golpes durante 2 segundos.' } },
    pipe: { name: 'PIPE', image: 'img/luchadores/arena/pipe.webp', style: 'CODER FAIXA PRETA · OSS', tagline: 'Oss!! Técnica antes que fuerza.', intro: 'Oss!!', selectionLine: 'Oss!!', callouts: ['Oss!!', 'Respeta el tatami.', 'Técnica antes que fuerza.', '¡La guardia no se regala!'], pain: ['Oss!! Me recupero y sigo.', 'El tatami todavía es mío.', 'Buena presión; busco el escape.'], miss: 'Oss!! Ese ángulo no era.', skill: { name: 'Guardia Oss', type: 'shield', cooldown: 15000, description: 'Reduce mucho el daño recibido durante 4 segundos.' } }
  };
  const DIFFICULTIES = {
    facil: { dealt: 1.15, received: .82, blockMultiplier: .36, aiDelay: 1700, aiJitter: 500, aiBlockChance: .12, aiTelegraph: 360, approachSpeed: 3.1, label: 'Fácil' },
    normal: { dealt: .95, received: 1.12, blockMultiplier: .4, aiDelay: 1450, aiJitter: 420, aiBlockChance: .16, aiTelegraph: 310, approachSpeed: 3.5, label: 'Normal' },
    medio: { dealt: .84, received: 1.34, blockMultiplier: .45, aiDelay: 1230, aiJitter: 360, aiBlockChance: .2, aiTelegraph: 270, approachSpeed: 3.9, label: 'Medio' },
    dificil: { dealt: .74, received: 1.58, blockMultiplier: .5, aiDelay: 1050, aiJitter: 300, aiBlockChance: .24, aiTelegraph: 230, approachSpeed: 4.3, label: 'Difícil' }
  };
  const ATTACKS = {
    jab: { label: 'Jab', damage: 4, cooldown: 380, range: 28, animation: 'is-jabbing' },
    heavy: { label: 'Golpe fuerte', damage: 7, cooldown: 780, range: 34, animation: 'is-heavy' },
    kick: { label: 'Patada', damage: 8, cooldown: 850, range: 37, animation: 'is-kicking' },
    elbow: { label: 'Codo', damage: 6, cooldown: 680, range: 27, animation: 'is-elbowing' },
    knee: { label: 'Rodilla', damage: 7, cooldown: 760, range: 29, animation: 'is-kneeing' }
  };
  const KEYS = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', w: 'jump', arrowup: 'jump', j: 'jab', k: 'heavy', o: 'kick', i: 'elbow', u: 'knee', l: 'block', e: 'special' };

  function say(text) { ui.announcer.textContent = text; }
  function syncFightSizeButton() {
    const expanded = document.fullscreenElement === game || game.classList.contains('is-expanded');
    sizeButton.setAttribute('aria-pressed', String(expanded));
    sizeButton.setAttribute('aria-label', expanded ? 'Minimizar el minijuego' : 'Agrandar el minijuego a pantalla completa');
    sizeButton.textContent = expanded ? '↙ Minimizar' : '⛶ Agrandar';
  }
  async function toggleFightSize() {
    if (document.fullscreenElement === game) {
      await document.exitFullscreen?.();
      game.classList.remove('is-expanded');
    } else if (document.fullscreenElement) {
      game.classList.toggle('is-expanded');
    } else if (!game.classList.contains('is-expanded') && game.requestFullscreen) {
      try {
        await game.requestFullscreen();
        game.classList.remove('is-expanded');
      } catch (_) {
        game.classList.add('is-expanded');
      }
    } else {
      game.classList.remove('is-expanded');
    }
    syncFightSizeButton();
  }
  sizeButton.addEventListener('click', toggleFightSize);
  document.addEventListener('fullscreenchange', syncFightSizeButton);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && game.classList.contains('is-expanded') && document.fullscreenElement !== game) {
      game.classList.remove('is-expanded');
      syncFightSizeButton();
    }
  });
  function selectedCharacter() { return CHARACTERS[state.characterId] || CHARACTERS['rojo-sierra']; }
  function randomLine(lines) { return lines[Math.floor(Math.random() * lines.length)]; }
  function selectCharacter(id, announce = false) {
    const character = CHARACTERS[id];
    if (!character) return;
    state.characterId = id;
    ui.playerSprite.src = character.image;
    ui.playerSprite.alt = `${character.name}, peleador de FIGHT+ CODE`;
    ui.playerPortrait.src = character.image;
    ui.playerPortrait.alt = '';
    ui.playerNameHud.textContent = character.name;
    ui.playerArenaLabel.textContent = character.name;
    ui.characterTagline.textContent = `${character.style} · ${character.tagline}`;
    ui.characterPreviewImage.src = character.image;
    ui.characterPreviewImage.alt = character.name;
    ui.characterPreviewName.textContent = character.name;
    ui.characterSkill.textContent = character.skill.name;
    ui.characterSkillDescription.textContent = character.skill.description;
    ui.characterPreviewQuote.textContent = character.selectionLine;
    ui.characterPreviewQuote.classList.remove('quote-pop');
    void ui.characterPreviewQuote.offsetWidth;
    ui.characterPreviewQuote.classList.add('quote-pop');
    updateSpecialButton();
    if (announce) say(character.selectionLine);
    ui.characterPicker.querySelectorAll('[data-character]').forEach(button => {
      const active = button.dataset.character === id;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try { localStorage.setItem('fightcode-fighter', id); } catch (_) {}
  }
  function initCharacterPicker() {
    ui.characterPicker.innerHTML = Object.entries(CHARACTERS).map(([id, character]) => `<button class="fight-character-card" type="button" data-character="${id}" aria-pressed="false"><span class="fight-character-art"><img src="${character.image}" alt="" loading="lazy" decoding="async"></span><strong>${character.name}</strong><small>${character.style}</small></button>`).join('');
    ui.characterPicker.querySelectorAll('[data-character]').forEach(button => button.addEventListener('click', () => selectCharacter(button.dataset.character, true)));
    let savedCharacter = 'rojo-sierra';
    try { savedCharacter = localStorage.getItem('fightcode-fighter') || savedCharacter; } catch (_) {}
    selectCharacter(savedCharacter);
  }
  function schedule(callback, delay) { const id = window.setTimeout(callback, delay); state.timers.push(id); return id; }
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }
  function setFighterPosition() {
    ui.player.style.setProperty('--fighter-x', `${state.playerX}%`);
    ui.opponent.style.setProperty('--fighter-x', `${state.opponentX}%`);
  }
  function updateHud() {
    ui.playerHealth.style.width = `${Math.max(0,state.playerHp)}%`;
    ui.opponentHealth.style.width = `${Math.max(0,state.opponentHp)}%`;
    ui.playerHp.textContent = Math.ceil(state.playerHp);
    ui.opponentHp.textContent = Math.ceil(state.opponentHp);
    ui.playerDamage.textContent = `Daño ${String(state.playerDamage).padStart(3,'0')}`;
    ui.opponentDamage.textContent = `Daño ${String(state.opponentDamage).padStart(3,'0')}`;
    ui.playerScore.textContent = String(state.playerDamage).padStart(3,'0');
    ui.opponentScore.textContent = String(state.opponentDamage).padStart(3,'0');
    ui.round.textContent = `RONDA ${Math.min(state.round,3)} / 3`;
    ui.timer.textContent = `00:${String(Math.max(0,state.time)).padStart(2,'0')}`;
    ui.call.textContent = state.status === 'fight' ? 'FIGHT!' : state.status === 'intermission' ? 'BREAK' : state.status === 'ended' ? 'FINAL' : 'READY';
    updateSpecialButton();
    setFighterPosition();
  }
  function updateSpecialButton() {
    if (!ui.specialButton) return;
    const skill = selectedCharacter().skill;
    const remaining = Math.max(0, state.skillReadyAt - performance.now());
    ui.specialButton.disabled = state.status !== 'fight' || remaining > 0;
    ui.specialButton.innerHTML = remaining > 0 ? `${skill.name} · ${Math.ceil(remaining / 1000)}s` : `${skill.name} <kbd>E</kbd>`;
    ui.specialButton.title = skill.description;
    ui.specialButton.setAttribute('aria-label', `${skill.name}: ${skill.description}${remaining > 0 ? ` Disponible en ${Math.ceil(remaining / 1000)} segundos` : ''}`);
  }
  function initAudio() {
    if (!state.audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      state.audio = new Context();
      state.musicBus = state.audio.createGain(); state.musicBus.gain.value = .48;
      state.sfxBus = state.audio.createGain(); state.sfxBus.gain.value = .8;
      state.musicBus.connect(state.audio.destination); state.sfxBus.connect(state.audio.destination);
      const noise = state.audio.createBuffer(1, state.audio.sampleRate, state.audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      state.noiseBuffer = noise;
    }
    state.audio.resume?.();
    if (state.musicOn && !state.musicTimer) {
      state.musicStep = 0;
      playMusicStep();
      state.musicTimer = window.setInterval(playMusicStep, 125);
    } else if (!state.musicOn && state.musicTimer) {
      clearInterval(state.musicTimer); state.musicTimer = null;
    }
    ui.music.setAttribute('aria-pressed', String(state.musicOn));
    ui.music.textContent = state.musicOn ? '♫ Música: encendida' : '♫ Música: apagada';
  }
  function playMusicStep() {
    if (!state.audio || !state.musicOn) return;
    const step = state.musicStep++ % 16;
    const now = state.audio.currentTime;
    const bassNotes = [55,0,55,0,65.41,0,73.42,0,49,0,49,0,65.41,0,73.42,0];
    const note = bassNotes[step];
    if (note) {
      const bass = state.audio.createOscillator(), gain = state.audio.createGain();
      bass.type = 'sawtooth'; bass.frequency.setValueAtTime(note, now);
      bass.frequency.exponentialRampToValueAtTime(note * .72, now + .12);
      gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(.11, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + .15);
      bass.connect(gain); gain.connect(state.musicBus); bass.start(now); bass.stop(now + .16);
    }
    if (step === 0 || step === 8) kickDrum(true);
    if (step === 4 || step === 12) snareDrum(true);
    if (step % 2 === 0) hiHat(true);
    if (step === 14) arcadeAccent();
  }
  function kickDrum(music = false) {
    if (!state.audio) return;
    const now = state.audio.currentTime, osc = state.audio.createOscillator(), gain = state.audio.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(125, now); osc.frequency.exponentialRampToValueAtTime(42, now + .14);
    gain.gain.setValueAtTime(music ? .22 : .42, now); gain.gain.exponentialRampToValueAtTime(.001, now + .16);
    osc.connect(gain); gain.connect(music ? state.musicBus : state.sfxBus); osc.start(now); osc.stop(now + .17);
  }
  function snareDrum(music = false) {
    if (!state.audio) return;
    const now = state.audio.currentTime, source = state.audio.createBufferSource(), filter = state.audio.createBiquadFilter(), gain = state.audio.createGain();
    source.buffer = state.noiseBuffer; filter.type = 'highpass'; filter.frequency.value = 1300;
    gain.gain.setValueAtTime(music ? .075 : .16, now); gain.gain.exponentialRampToValueAtTime(.001, now + .12);
    source.connect(filter); filter.connect(gain); gain.connect(music ? state.musicBus : state.sfxBus); source.start(now); source.stop(now + .13);
  }
  function hiHat(music = false) {
    if (!state.audio) return;
    const now = state.audio.currentTime, source = state.audio.createBufferSource(), filter = state.audio.createBiquadFilter(), gain = state.audio.createGain();
    source.buffer = state.noiseBuffer; filter.type = 'highpass'; filter.frequency.value = 7500;
    gain.gain.setValueAtTime(music ? .022 : .05, now); gain.gain.exponentialRampToValueAtTime(.001, now + .035);
    source.connect(filter); filter.connect(gain); gain.connect(music ? state.musicBus : state.sfxBus); source.start(now); source.stop(now + .04);
  }
  function arcadeAccent() {
    if (!state.audio) return;
    const now = state.audio.currentTime;
    [392,523.25,659.25].forEach((frequency, index) => {
      const osc = state.audio.createOscillator(), gain = state.audio.createGain();
      osc.type = 'square'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now + index * .035); gain.gain.linearRampToValueAtTime(.035, now + index * .035 + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + .17);
      osc.connect(gain); gain.connect(state.musicBus); osc.start(now + index * .035); osc.stop(now + .18);
    });
  }
  function hitSound(strong = false) {
    if (!state.audio) return;
    kickDrum(false); if (strong) snareDrum(false); else hiHat(false);
    const osc = state.audio.createOscillator(), gain = state.audio.createGain(), now = state.audio.currentTime;
    osc.type = 'triangle'; osc.frequency.setValueAtTime(strong ? 135 : 205, now); osc.frequency.exponentialRampToValueAtTime(62, now + .09);
    gain.gain.setValueAtTime(strong ? .22 : .13, now); gain.gain.exponentialRampToValueAtTime(.001, now + .11);
    osc.connect(gain); gain.connect(state.sfxBus); osc.start(now); osc.stop(now + .12);
  }
  function criticalGrunt() {
    if (!state.audio) return;
    const now = state.audio.currentTime, voice = state.audio.createOscillator(), formant = state.audio.createBiquadFilter(), gain = state.audio.createGain();
    voice.type = 'sawtooth'; voice.frequency.setValueAtTime(145, now); voice.frequency.exponentialRampToValueAtTime(78, now + .28);
    formant.type = 'bandpass'; formant.frequency.value = 520; formant.Q.value = 1.4;
    gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(.18, now + .025); gain.gain.exponentialRampToValueAtTime(.001, now + .3);
    voice.connect(formant); formant.connect(gain); gain.connect(state.sfxBus); voice.start(now); voice.stop(now + .31);
    snareDrum(false);
  }
  const OPPONENT_LINES = ['¡Buen golpe!', '¿Eso es todo?', '¡Sigo aquí!', '¡No me detengo!'];
  function bubble(element, text, pain = false) {
    if (!element) return;
    const phrase = text || (pain ? randomLine(selectedCharacter().pain) : randomLine(selectedCharacter().callouts));
    element.textContent = phrase; element.classList.toggle('is-pain', pain); element.hidden = false;
    element.classList.remove('bubble-pop'); void element.offsetWidth; element.classList.add('bubble-pop');
    if (element._hideTimer) clearTimeout(element._hideTimer);
    element._hideTimer = window.setTimeout(() => { element.hidden = true; }, 1250);
  }
  function animate(element, className, duration = 310) {
    element.classList.remove(className); void element.offsetWidth; element.classList.add(className);
    schedule(() => element.classList.remove(className), duration);
  }
  function startGame() {
    clearTimers();
    state.status = 'fight'; state.round = 1; state.time = 45; state.playerHp = 100; state.opponentHp = 100;
    state.playerDamage = 0; state.opponentDamage = 0; state.playerX = 24; state.opponentX = 76; state.saved = false;
    state.playerBlocking = false; state.opponentBlocking = false; state.difficulty = ui.difficulty.value;
    state.skillReadyAt = 0; state.empoweredAttack = false; state.opponentStunnedUntil = 0; state.playerShieldUntil = 0; state.playerDodgeUntil = 0;
    ui.intro.hidden = true; ui.result.hidden = true; ui.player.classList.remove('is-blocking', 'is-shielded'); ui.opponent.classList.remove('is-blocking');
    state.musicOn = true; initAudio(); updateHud(); say(selectedCharacter().intro);
    bubble(ui.playerBubble, selectedCharacter().intro);
    state.clock = window.setInterval(() => {
      if (state.status !== 'fight') return;
      state.time -= 1; updateHud();
      if (state.time <= 0) finishRound();
    }, 1000);
    aiTurn();
  }
  function move(direction) {
    if (state.status !== 'fight') return;
    const next = state.playerX + (direction === 'right' ? 5 : -5);
    state.playerX = Math.max(7,Math.min(53,next));
    animate(ui.player,'is-stepping',180); updateHud();
  }
  function jump() {
    if (state.status !== 'fight') return;
    animate(ui.player,'is-jumping',460); say('¡Buen desplazamiento!');
  }
  function playerAttack(type = 'jab') {
    if (state.status !== 'fight') return;
    const attack = ATTACKS[type];
    const now = performance.now();
    if (now - state.lastAttack < attack.cooldown) return;
    state.lastAttack = now;
    animate(ui.player,attack.animation,460); bubble(ui.playerBubble, randomLine(selectedCharacter().callouts));
    const distance = state.opponentX - state.playerX;
    if (distance > attack.range) { say(selectedCharacter().miss); return; }
    const rawDamage = attack.damage * DIFFICULTIES[state.difficulty].dealt * (state.empoweredAttack ? 1.8 : 1);
    state.empoweredAttack = false;
    const damage = Math.max(1,Math.round(rawDamage * (state.opponentBlocking ? .35 : (0.88 + Math.random()*.24))));
    state.opponentHp = Math.max(0,state.opponentHp-damage); state.playerDamage += damage;
    hitSound(type !== 'jab'); animate(ui.opponent,'is-hit',360); bubble(ui.opponentBubble, OPPONENT_LINES[Math.floor(Math.random() * OPPONENT_LINES.length)]); state.opponentBlocking = false; ui.opponent.classList.remove('is-blocking');
    say(state.opponentHp === 0 ? `¡${attack.label}! ${damage} de daño. ¡KO!` : `${attack.label}: ${damage} de daño.`);
    updateHud(); if (state.opponentHp <= 0) finishFight('victoria','ko');
  }
  function holdBlock(on) {
    state.playerBlocking = on && state.status === 'fight';
    ui.player.classList.toggle('is-blocking',state.playerBlocking);
    if (state.playerBlocking) say('Guardia alta: reduces el daño recibido.');
  }
  function damagePlayer(rawDamage, type) {
    if (performance.now() < state.playerDodgeUntil) { say('¡Paso relámpago! Esquivaste el ataque.'); return; }
    const mode = DIFFICULTIES[state.difficulty];
    const shielded = performance.now() < state.playerShieldUntil;
    const reduction = Math.min(state.playerBlocking ? mode.blockMultiplier : 1, shielded ? .25 : 1);
    const amount = Math.max(1,Math.round(rawDamage * mode.received * reduction));
    state.playerHp = Math.max(0,state.playerHp-amount); state.opponentDamage += amount;
    animate(ui.player,'is-hit',360); hitSound(type !== 'jab');
    const critical = amount >= 8 || state.playerHp <= 30;
    if (critical) { criticalGrunt(); bubble(ui.playerBubble, randomLine(selectedCharacter().pain), true); }
    else bubble(ui.playerBubble, randomLine(selectedCharacter().pain), true);
    updateHud();
    say(state.playerHp === 0 ? '¡KO! La IA cierra el combate.' : `${shielded ? 'Guardia Oss' : state.playerBlocking ? 'Bloqueo parcial' : type}: recibes ${amount} de daño.`);
    if (state.playerHp <= 0) finishFight('derrota','ko');
  }
  function useCharacterSkill() {
    if (state.status !== 'fight') return;
    const now = performance.now(), skill = selectedCharacter().skill;
    if (now < state.skillReadyAt) { say(`${skill.name}: disponible en ${Math.ceil((state.skillReadyAt - now) / 1000)} s.`); return; }
    if (skill.type === 'heal' && state.playerHp >= 100) { say('Tu salud ya está completa; guarda la recuperación para después.'); return; }
    state.skillReadyAt = now + skill.cooldown;
    if (skill.type === 'power') {
      state.empoweredAttack = true;
      say('¡Combo FIGHT+ activado! Tu siguiente golpe conectado hará más daño.');
    } else if (skill.type === 'stun') {
      state.opponentStunnedUntil = now + 2000;
      say('¡Depuración completa! Rival interrumpido por 2 segundos.');
      bubble(ui.playerBubble, 'Bug detectado. Rival en pausa.');
      animate(ui.opponent, 'is-hit', 360);
    } else if (skill.type === 'heal') {
      const recovered = Math.min(24, 100 - state.playerHp);
      state.playerHp += recovered;
      say(`¡Base recuperada! +${recovered} de salud.`);
      bubble(ui.playerBubble, 'Base firme. Recupero y sigo.');
    } else if (skill.type === 'dodge') {
      state.playerDodgeUntil = now + 2000;
      state.playerX = Math.min(53, state.playerX + 12);
      say('¡Paso relámpago! Avanzas y esquivas durante 2 segundos.');
      bubble(ui.playerBubble, '¡Ritmo, distancia y precisión!');
      animate(ui.player, 'is-stepping', 360);
    } else if (skill.type === 'shield') {
      state.playerShieldUntil = now + 4000;
      say('¡Guardia Oss! Daño reducido durante 4 segundos.');
      bubble(ui.playerBubble, 'Oss!! Guardia firme.');
      ui.player.classList.add('is-shielded');
      schedule(() => { if (performance.now() >= state.playerShieldUntil) ui.player.classList.remove('is-shielded'); }, 4100);
    }
    updateHud();
  }
  function aiTurn() {
    if (state.status !== 'fight') return;
    if (performance.now() < state.opponentStunnedUntil) {
      schedule(aiTurn, Math.max(200, state.opponentStunnedUntil - performance.now()));
      return;
    }
    const mode = DIFFICULTIES[state.difficulty];
    const distance = state.opponentX - state.playerX;
    if (distance > 31) {
      state.opponentX = Math.max(48,state.opponentX - (mode.approachSpeed + Math.random()*2.1));
      state.opponentBlocking = false; ui.opponent.classList.remove('is-blocking'); updateHud();
      say('Conor avanza para cerrar la distancia.');
    } else if (Math.random() < mode.aiBlockChance) {
      state.opponentBlocking = true; ui.opponent.classList.add('is-blocking'); say('Conor cubre su guardia.');
      schedule(() => { state.opponentBlocking=false; ui.opponent.classList.remove('is-blocking'); },550);
    } else {
      state.opponentBlocking = false; ui.opponent.classList.remove('is-blocking');
      const roll = Math.random();
      const type = roll < .28 ? 'jab' : roll < .52 ? 'heavy' : roll < .73 ? 'kick' : roll < .89 ? 'elbow' : 'knee';
      const attack = ATTACKS[type];
      animate(ui.opponent,attack.animation,460); bubble(ui.opponentBubble, ['¡Voy con todo!', '¡Ahí va!', '¡Te tengo!'][Math.floor(Math.random() * 3)]);
      const baseDamage = type === 'jab' ? 3 : type === 'heavy' ? 5 : type === 'kick' ? 6 : type === 'knee' ? 5 : 4;
      say(`¡Conor prepara ${attack.label.toLowerCase()}!`);
      schedule(() => { if (state.status === 'fight' && performance.now() >= state.opponentStunnedUntil) damagePlayer(baseDamage,attack.label); },mode.aiTelegraph);
    }
    schedule(aiTurn,mode.aiDelay + Math.random()*mode.aiJitter);
  }
  function finishRound() {
    if (state.status !== 'fight') return;
    state.status = 'intermission'; state.playerBlocking=false; ui.player.classList.remove('is-blocking');
    if (state.round >= 3) {
      if (state.playerDamage === state.opponentDamage) finishFight('empate','empate');
      else finishFight(state.playerDamage > state.opponentDamage ? 'victoria' : 'derrota','decision');
      return;
    }
    say(`Fin del round ${state.round}. Respira: comienza el siguiente en breve.`); ui.call.textContent = 'BREAK';
    schedule(() => {
      if (state.status !== 'intermission') return;
      state.round += 1; state.time = 45; state.playerHp = 100; state.opponentHp = 100; state.status = 'fight';
      say(`¡Round ${state.round}! ¡A pelear!`); updateHud(); aiTurn();
    },2200);
  }
  async function finishFight(outcome,method) {
    if (state.status === 'ended') return;
    state.status = 'ended'; state.playerBlocking=false; ui.player.classList.remove('is-blocking');
    if (state.clock) clearInterval(state.clock); clearTimers();
    const damageGap = Math.abs(state.playerDamage-state.opponentDamage);
    ui.resultLabel.textContent = outcome === 'empate' ? 'COMBATE IGUALADO' : outcome === 'victoria' ? `${selectedCharacter().name} GANA` : 'CONOR MCGREGOR GANA';
    ui.resultTitle.textContent = method === 'ko' ? (outcome === 'victoria' ? 'Victoria por KO' : 'Derrota por KO') : method === 'empate' || outcome === 'empate' ? 'Empate por decisión' : outcome === 'victoria' ? 'Victoria por decisión' : 'Derrota por decisión';
    ui.resultCopy.textContent = `${state.playerDamage} de daño a favor · ${state.opponentDamage} recibido · Diferencia ${damageGap}. ${method === 'decision' ? 'Gana quien conectó más daño en los 3 rounds.' : ''}`;
    ui.result.hidden = false; ui.call.textContent='FINAL';
    if (!state.saved) {
      state.saved = true;
      try {
        const response = await fetch('/api/pelea/resultado',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({resultado:outcome,metodo:method,dano:state.playerDamage})});
        const data=await response.json().catch(()=>({}));
        if (!response.ok) throw new Error(data.error || 'No se pudo guardar tu combate.');
        ui.resultCopy.textContent += ` Registro actualizado: ${data.registro.victorias}V · ${data.registro.derrotas}D · ${data.registro.empates}E.`;
        await loadRanking();
      } catch (error) { ui.resultCopy.textContent += ` ${backendErrorMessage(error)}`; }
    }
  }
  function exitGame() {
    clearTimers(); if (state.clock) clearInterval(state.clock);
    state.status='ready'; state.playerBlocking=false; state.opponentBlocking=false;
    ui.player.classList.remove('is-blocking', 'is-shielded'); ui.opponent.classList.remove('is-blocking');
    state.round=1; state.time=45; state.playerHp=100; state.opponentHp=100; state.playerDamage=0; state.opponentDamage=0; state.playerX=24; state.opponentX=76;
    state.musicOn=false; initAudio();
    ui.result.hidden=true; ui.intro.hidden=false; say('Elige tu estrategia.'); updateHud();
  }
  function doAction(action) {
    if (action==='left'||action==='right') move(action);
    if (action==='jump') jump();
    if (ATTACKS[action]) playerAttack(action);
    if (action==='block') holdBlock(true);
    if (action==='special') useCharacterSkill();
  }
  document.addEventListener('keydown',event=>{
    const action=KEYS[event.key.toLowerCase()]; if(!action || event.repeat) return;
    if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)) return;
    event.preventDefault(); doAction(action);
  });
  document.addEventListener('keyup',event=>{ if(KEYS[event.key.toLowerCase()]==='block') holdBlock(false); });
  document.querySelectorAll('[data-fight-action]').forEach(button=>{
    const action=button.dataset.fightAction;
    button.addEventListener('pointerdown',event=>{
      event.preventDefault(); button.dataset.pointerActive='true'; button.dataset.skipClick='true';
      try { button.setPointerCapture(event.pointerId); } catch {}
      button.classList.add('is-pressed'); doAction(action);
      if(action==='left'||action==='right') { const id=window.setInterval(()=>move(action),120); button.dataset.repeatTimer=id; }
    });
    const release=event=>{
      if(button.dataset.pointerActive!=='true')return;
      button.dataset.pointerActive='false'; button.classList.remove('is-pressed');
      if(action==='block')holdBlock(false);
      if(button.dataset.repeatTimer){clearInterval(Number(button.dataset.repeatTimer));delete button.dataset.repeatTimer;}
      if(event?.type==='pointercancel'||event?.type==='lostpointercapture')delete button.dataset.skipClick;
    };
    button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{
      if(button.dataset.skipClick==='true'){delete button.dataset.skipClick;return;}
      if(event.detail!==0)return;
      if(action==='block'){holdBlock(true);schedule(()=>holdBlock(false),450);}
      else doAction(action);
    });
  });
  $('#playFight').addEventListener('click',startGame); $('#rematchFight').addEventListener('click',startGame);
  $('#exitFight').addEventListener('click',exitGame); $('#exitFightMain').addEventListener('click',exitGame);
  ui.music.addEventListener('click',()=>{state.musicOn=!state.musicOn;initAudio();});
  $('#refreshFightRanking').addEventListener('click',loadRanking);

  async function loadRanking() {
    ui.ranking.innerHTML='<li class="fight-ranking-empty">Cargando el ranking…</li>';
    try {
      const response=await fetch('/api/pelea/ranking',{credentials:'same-origin'}); const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'No se pudo cargar el ranking.');
      if(!data.ranking.length){ui.ranking.innerHTML='<li class="fight-ranking-empty">Aún no hay peleas registradas. ¡Sé quien inaugure el ranking!</li>';return;}
      ui.ranking.innerHTML=data.ranking.map((row,index)=>`<li><span class="fight-rank-name"><b class="fight-rank-position">${String(index+1).padStart(2,'0')}</b><strong>${escapeText(row.nombre)}</strong></span><span>${row.victorias}</span><span>${row.derrotas}</span><span>${row.empates}</span><span class="fight-rank-points">${row.puntos}</span></li>`).join('');
    } catch(error) {
      ui.ranking.innerHTML=`<li class="fight-ranking-empty">${escapeText(backendErrorMessage(error))}</li>`;
      ui.rankingNote.textContent='El ranking requiere el sitio servido por PHP y una conexión activa con MariaDB.';
    }
  }
  function backendErrorMessage(error) {
    if (location.protocol === 'file:') return 'Abre la web desde http://127.0.0.1:8765; los archivos locales no pueden conectarse con el ranking.';
    if (error instanceof TypeError || /failed to fetch|networkerror/i.test(error?.message ?? '')) return 'No se pudo conectar con el servidor. Comprueba que PHP y MariaDB estén activos.';
    return error?.message || 'No se pudo conectar con el servidor.';
  }
  function escapeText(value) { return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  initCharacterPicker();
  updateHud(); loadRanking();
})();
