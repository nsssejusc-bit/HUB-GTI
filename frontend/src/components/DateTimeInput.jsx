import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import DateInput from "./DateInput";

/**
 * DateTimeInput
 * value   : ISO string "YYYY-MM-DDTHH:MM" (or full ISO / empty string)
 * onChange : called with "YYYY-MM-DDTHH:MM" or ""
 */
export default function DateTimeInput({ value, onChange, className = "" }) {
  // ── parse value ────────────────────────────────────────────────────────────
  const dateStr = value ? value.slice(0, 10) : "";
  const rawTime = value && value.length >= 16 ? value.slice(11, 16) : "";
  const [hh, mm] = rawTime ? rawTime.split(":") : ["", ""];

  // ── time popover state ─────────────────────────────────────────────────────
  const [open, setOpen]         = useState(false);
  const [timeText, setTimeText] = useState(rawTime);
  const popRef   = useRef(null);
  const btnRef   = useRef(null);
  const inputRef = useRef(null);

  // focus text input when popover opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // sync timeText when value changes externally
  useEffect(() => {
    setTimeText(rawTime);
  }, [rawTime]);

  // close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── helpers ────────────────────────────────────────────────────────────────
  function emit(date, time) {
    if (!date || !time) { onChange(""); return; }
    onChange(`${date}T${time}`);
  }

  function handleDateChange(d) {
    emit(d, rawTime || "08:00");
    if (d && !rawTime) setTimeText("08:00");
  }

  function handleHour(h) {
    const m = mm || "00";
    const t = `${String(h).padStart(2, "0")}:${m}`;
    setTimeText(t);
    emit(dateStr || "", t);
  }

  function handleMinute(m) {
    const h = hh || "08";
    const t = `${h}:${String(m).padStart(2, "0")}`;
    setTimeText(t);
    emit(dateStr || "", t);
  }

  function handleTimeText(e) {
    const raw = e.target.value.replace(/[^\d:]/g, "").slice(0, 5);
    let masked = raw.replace(/\D/g, "").slice(0, 4);
    if (masked.length > 2) masked = masked.slice(0, 2) + ":" + masked.slice(2);
    setTimeText(masked);
    if (/^\d{2}:\d{2}$/.test(masked)) {
      const [h, m] = masked.split(":").map(Number);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) emit(dateStr, masked);
    }
  }

  const hours   = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Date picker */}
      <DateInput value={dateStr} onChange={handleDateChange} className="flex-1 min-w-0" />

      {/* Time picker trigger */}
      <div className="relative shrink-0">
        <button
          ref={btnRef}
          type="button"
          onClick={() => dateStr && setOpen((o) => !o)}
          disabled={!dateStr}
          title={!dateStr ? "Selecione a data primeiro" : undefined}
          className={`flex items-center gap-1.5 field-input w-[90px] justify-between transition ${
            open ? "ring-2 ring-brand-500 border-brand-500" : ""
          } ${!dateStr ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Clock size={13} className={rawTime ? "text-brand-500" : "text-slate-400"} />
          <span className={`text-sm font-mono ${rawTime ? "text-slate-700 dark:text-gray-200" : "text-slate-400"}`}>
            {rawTime || "HH:MM"}
          </span>
        </button>

        {/* Popover — always rendered, animated with opacity/scale */}
        <div
          ref={popRef}
          className={`absolute z-50 mt-1 right-0 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl p-3 w-64 transition-all duration-150 ease-out origin-top-right ${
            open
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          {/* Text input for fast typing */}
          <div className="mb-3">
            <label className="text-[11px] text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1 block">
              Digitar horário
            </label>
            <input
              ref={inputRef}
              type="text"
              value={timeText}
              onChange={handleTimeText}
              placeholder="HH:MM"
              maxLength={5}
              inputMode="numeric"
              className="field-input text-center font-mono text-sm w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Hours */}
            <div>
              <div className="text-[11px] text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1">Hora</div>
              <div className="grid grid-cols-4 gap-0.5 max-h-36 overflow-y-auto">
                {hours.map((h) => {
                  const active = parseInt(hh) === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHour(h)}
                      className={`rounded-lg py-1 text-xs font-mono font-medium transition ${
                        active
                          ? "bg-brand-600 text-white"
                          : "hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300"
                      }`}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <div className="text-[11px] text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1">Minuto</div>
              <div className="grid grid-cols-2 gap-0.5">
                {minutes.map((m) => {
                  const active = parseInt(mm) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinute(m)}
                      className={`rounded-lg py-1.5 text-xs font-mono font-medium transition ${
                        active
                          ? "bg-brand-600 text-white"
                          : "hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300"
                      }`}
                    >
                      :{String(m).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold py-1.5 transition"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
