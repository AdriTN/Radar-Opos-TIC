// Lee el calendario oficial de fiestas laborales (BOE/BOC) y lo convierte en ajustes para festivos.mjs.
// Regla de seguridad: solo se AÑADEN festivos que caen en día laborable y que no estaban ya previstos
// (traslados a lunes, festivos propios del año). Nunca se quita ninguno, y si el resultado es raro no se aplica.
import { sinTildes, MESES } from "./util.mjs";
import { festivosNacionales, festivosCanarias } from "./festivos.mjs";

const CCAA = ["Andalucía", "Aragón", "Principado de Asturias", "Asturias", "Illes Balears", "Islas Baleares", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunitat Valenciana", "Comunidad Valenciana", "Extremadura", "Galicia", "La Rioja", "Comunidad de Madrid", "Región de Murcia", "Navarra", "País Vasco", "Ceuta", "Melilla", "Canarias"];

export function fechasEn(texto, anio) {
  const t = sinTildes(texto).replace(/\s+/g, " ");
  const out = new Set();
  const re = new RegExp(String.raw`\b(\d{1,2})\s+de\s+(${MESES.join("|")})(?:\s+de\s+(\d{4}))?`, "g");
  let m;
  while ((m = re.exec(t))) {
    if (m[3] && Number(m[3]) !== anio) continue;      // fechas con otro año (p. ej. la de la resolución) se ignoran
    const mes = MESES.indexOf(m[2]) + 1;
    out.add(`${anio}-${String(mes).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`);
  }
  return out;
}

// Texto de la sección de una comunidad: desde su nombre hasta el siguiente nombre de otra comunidad.
export function seccion(texto, nombre) {
  const t = String(texto);
  const re = new RegExp(`(^|\\n|\\s)${nombre}\\b`, "i");
  const m = re.exec(t);
  if (!m) return null;
  const resto = t.slice(m.index + m[0].length);
  let fin = resto.length;
  for (const otro of CCAA) {
    if (sinTildes(otro) === sinTildes(nombre)) continue;
    const r = new RegExp(`(^|\\n)\\s*${otro}\\b`, "i").exec(resto);
    if (r && r.index < fin) fin = r.index;
  }
  return resto.slice(0, fin);
}

// Parte nacional: desde el principio hasta el primer encabezado de comunidad autónoma.
export function nacional(texto) {
  const t = String(texto); let fin = t.length;
  for (const c of CCAA) { const r = new RegExp(`(^|\\n)\\s*${c}\\b`, "i").exec(t); if (r && r.index < fin) fin = r.index; }
  return t.slice(0, fin);
}

const esLaborable = (iso) => { const w = new Date(iso + "T12:00:00Z").getUTCDay(); return w !== 0 && w !== 6; };

// Devuelve { ES: {anadir}, CAN: {anadir}, avisos: [] } o { error }.
export function ajustesDeFiestas(textoNacional, textoCanarias, anio) {
  const avisos = [];
  const res = {};
  const baseES = new Set(festivosNacionales(anio)), baseCAN = new Set(festivosCanarias(anio));
  const intento = (clave, texto, base) => {
    if (!texto) return;
    const fechas = fechasEn(texto, anio);
    if (fechas.size < 6) { avisos.push(`${clave}: solo ${fechas.size} fechas reconocidas; no se aplica`); return; }
    const coincidentes = [...base].filter((d) => fechas.has(d)).length;
    if (coincidentes < 5) { avisos.push(`${clave}: coincide con ${coincidentes} festivos esperados; formato no reconocido, no se aplica`); return; }
    const anadir = [...fechas].filter((d) => !base.has(d) && esLaborable(d)).sort();
    if (anadir.length > 4) { avisos.push(`${clave}: ${anadir.length} festivos nuevos, demasiados para fiarse; no se aplica`); return; }
    res[clave] = { anadir };
  };
  intento("ES", textoNacional, baseES);
  intento("CAN", textoCanarias, baseCAN);
  return { ajustes: res, avisos };
}
