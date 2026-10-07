// Lee tablas de retribuciones oficiales a partir del texto de un PDF (pdftotext -layout).
// Cada dato se valida (rangos y orden lógico). Si no valida, NO se publica: se conserva el valor anterior y se avisa.
import { numES } from "./util.mjs";

const NUM = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;

export function parsearSueldos(texto) {
  const grupos = ["A1", "A2", "B", "C1", "C2"];
  const filas = {};
  for (const g of grupos) {
    const re = new RegExp(String.raw`^\s*${g}\b[^\n\d]{0,40}((?:${NUM}[ \t]*){2,})`, "m");
    const m = texto.match(re);
    if (m) filas[g] = (m[1].match(new RegExp(NUM, "g")) || []).map(numES);
  }
  const rango = { A1: [900, 2500], A2: [800, 2200], B: [700, 2000], C1: [600, 1800], C2: [500, 1500] };
  const res = {};
  for (const g of Object.keys(filas)) {
    const [sueldo, trienio] = filas[g];
    if (!(sueldo >= rango[g][0] && sueldo <= rango[g][1]) || !(trienio > 0 && trienio < sueldo)) return { ok: false, motivo: `Valores fuera de rango en ${g}: ${filas[g].slice(0, 2)}` };
    res[g] = { sueldoMensual: sueldo, trienioMensual: trienio, todos: filas[g] };
  }
  const orden = grupos.filter((g) => res[g]);
  if (orden.length < 4) return { ok: false, motivo: `Solo se encontraron ${orden.length} grupos` };
  for (let i = 1; i < orden.length; i++) if (res[orden[i]].sueldoMensual >= res[orden[i - 1]].sueldoMensual) return { ok: false, motivo: "El orden A1>A2>B>C1>C2 no se cumple" };
  return { ok: true, sueldos: res };
}

export function parsearComplementoDestino(texto) {
  const niveles = {};
  for (const linea of texto.split("\n")) {
    const m = linea.match(new RegExp(String.raw`^\s*(\d{1,2})\s+(${NUM})\s*$`));
    if (m) { const n = Number(m[1]); if (n >= 1 && n <= 30 && !niveles[n]) niveles[n] = numES(m[2]); }
  }
  const ks = Object.keys(niveles).map(Number).sort((a, b) => b - a);
  if (ks.length < 20) return { ok: false, motivo: `Solo ${ks.length} niveles` };
  for (let i = 1; i < ks.length; i++) if (niveles[ks[i]] >= niveles[ks[i - 1]]) return { ok: false, motivo: "Niveles no decrecientes" };
  if (niveles[30] < 600 || niveles[30] > 2500) return { ok: false, motivo: "Nivel 30 fuera de rango" };
  return { ok: true, niveles };
}
