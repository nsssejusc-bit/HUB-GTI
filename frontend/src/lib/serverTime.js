import { useEffect, useRef, useState } from "react";
import { api } from "./api";

// Offset between server clock and client clock (server - client, in ms)
let cachedOffset = 0;
let offsetFetched = false;

export async function fetchServerOffset() {
  if (offsetFetched) return cachedOffset;
  try {
    const before = Date.now();
    const { data } = await api.get("/time");
    const rtt = Date.now() - before;
    cachedOffset = data.now - (before + Math.round(rtt / 2));
    offsetFetched = true;
  } catch {
    cachedOffset = 0;
  }
  return cachedOffset;
}

// Returns current server time in ms
export function serverNow() {
  return Date.now() + cachedOffset;
}

// Hook: fetches offset on mount, then ticks every `intervalMs` to trigger re-renders
export function useServerTick(intervalMs = 60000) {
  const [tick, setTick] = useState(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchServerOffset().then(() => setTick((n) => n + 1));
    }
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
