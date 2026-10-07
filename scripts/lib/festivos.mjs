// Días hábiles según el art. 30 de la Ley 39/2015: no cuentan sábados, domingos ni festivos.
// Los festivos se calculan con las reglas oficiales; los traslados a lunes que decida cada año el
// Estado o Canarias se añaden en data/festivos-extra.json (ver README). Sin dependencias.
import { parseISO, ymd } from "./util.mjs";

export function pascua(anio) { // Gregoriano (algoritmo de Meeus/Jones/Butcher)
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}
const fmt = (d) => ymd(d);
const mas = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const f = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function festivosNacionales(a) {
  const p = pascua(a);
  return [f(a,1,1), f(a,1,6), fmt(mas(p,-2)), f(a,5,1), f(a,8,15), f(a,10,12), f(a,11,1), f(a,12,6), f(a,12,8), f(a,12,25)];
}
export function festivosCanarias(a) {
  const p = pascua(a);
  return [...festivosNacionales(a), fmt(mas(p,-3)), f(a,5,30)]; // + Jueves Santo y Día de Canarias
}
// extra: { "2026": { "ES": { "anadir": ["2026-11-02"], "quitar": [] }, "CAN": {...} } }
export function esFestivo(iso, ambito = "ES", extra = {}) {
  const a = Number(iso.slice(0, 4));
  const base = ambito === "CAN" ? festivosCanarias(a) : festivosNacionales(a);
  const ex = extra?.[a]?.[ambito] || {};
  const set = new Set([...base, ...(ex.anadir || [])]);
  (ex.quitar || []).forEach((x) => set.delete(x));
  return set.has(iso);
}
export function esHabil(iso, ambito = "ES", extra = {}) {
  const w = parseISO(iso).getUTCDay();
  return w !== 0 && w !== 6 && !esFestivo(iso, ambito, extra);
}
// n días hábiles contados a partir del día siguiente a `desdeISO` (el día 1 es el siguiente hábil).
export function sumarHabiles(desdeISO, n, ambito = "ES", extra = {}) {
  let d = parseISO(desdeISO), c = 0;
  while (c < n) { d = mas(d, 1); if (esHabil(ymd(d), ambito, extra)) c++; }
  return ymd(d);
}
export function sumarNaturales(desdeISO, n) { return ymd(mas(parseISO(desdeISO), n)); }
