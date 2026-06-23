let _ctx = null;

function getCtx() {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Temas de som ───────────────────────────────────────────────────────────────

function playSinos() {
  const ac = getCtx();
  // C5 E5 G5 C6 — acorde maior ascendente, sino suave
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = "sine"; osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.22;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    osc.start(t); osc.stop(t + 0.75);
  });
}

function playClassico() {
  const ac = getCtx();
  // G4 B4 E5 G5 — campainha de quatro notas
  [392, 494, 659, 784].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = "sine"; osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.28;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
    gain.gain.setValueAtTime(0.28, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.start(t); osc.stop(t + 0.65);
  });
}

function playAlerta() {
  const ac = getCtx();
  // 3 pares ascendentes em onda quadrada — urgente
  [[440, 554], [554, 659], [659, 880]].forEach(([f1, f2], i) => {
    const t = ac.currentTime + i * 0.34;
    [f1, f2].forEach((freq, j) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const nt = t + j * 0.15;
      gain.gain.setValueAtTime(0.15, nt);
      gain.gain.exponentialRampToValueAtTime(0.001, nt + 0.27);
      osc.start(nt); osc.stop(nt + 0.27);
    });
  });
}

function playMelodia() {
  const ac = getCtx();
  // G4 A4 B4 D5 E5 D5 B4 — frase pentatônica em onda triangular
  [392, 440, 494, 587, 659, 587, 494].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = "triangle"; osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.setValueAtTime(0.22, t + 0.12);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.28);
    osc.start(t); osc.stop(t + 0.3);
  });
}

// ── Catálogo de temas ──────────────────────────────────────────────────────────

export const SOUND_THEMES = [
  { id: "sinos",      label: "Sinos",      desc: "Sinos suaves e ascendentes (4 notas)",  play: playSinos    },
  { id: "classico",   label: "Clássico",   desc: "Campainha clássica de 4 notas",          play: playClassico },
  { id: "alerta",     label: "Alerta",     desc: "Tom urgente em pares ascendentes",        play: playAlerta   },
  { id: "melodia",    label: "Melodia",    desc: "Frase pentatônica suave em 7 notas",      play: playMelodia  },
  { id: "silencioso", label: "Silencioso", desc: "Sem som — apenas notificações visuais",   play: () => {}     },
];

const STORAGE_KEY = "hd_notif_sound";
const DEFAULT_THEME = "sinos";

export function getSelectedThemeId() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
}

export function setSelectedThemeId(id) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function playNotification() {
  const themeId = getSelectedThemeId();
  const theme = SOUND_THEMES.find((t) => t.id === themeId);
  if (!theme) return;
  try { theme.play(); } catch {}
}

// Aliases mantêm compatibilidade com SocketContext sem alterá-lo
export const playNewMessage = playNotification;
export const playNewTicket  = playNotification;
export const playApproval   = playNotification;
