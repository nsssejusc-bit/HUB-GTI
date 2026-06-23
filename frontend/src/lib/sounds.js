let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

// Som suave de mensagem nova (ping simples)
export function playNewMessage() {
  try {
    const ac = getCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.35);
  } catch {}
}

// Som de alerta de chamado novo (dois tons ascendentes)
export function playNewTicket() {
  try {
    const ac = getCtx();
    [520, 780].forEach((freq, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {}
}
