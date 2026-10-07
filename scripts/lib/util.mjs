// Utilidades puras (sin dependencias de Node: también se pueden importar desde el navegador).
export const aArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
export const sinTildes = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const ymd = (d) => d.toISOString().slice(0, 10);
export const parseISO = (iso) => new Date(iso + "T12:00:00Z");
export const sumarDias = (iso, n) => { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

export const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const mesNum = (nombre) => MESES.indexOf(sinTildes(nombre)) + 1;

// "1.234,56" -> 1234.56
export const numES = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));

const NUMEROS = { uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10, quince:15, veinte:20, treinta:30, cuarenta:40 };
export const palabraANumero = (p) => { const t = sinTildes(p); return /^\d+$/.test(t) ? Number(t) : NUMEROS[t] ?? null; };

// HTML/XML -> texto plano legible
export function limpiarMarcado(s) {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<\/(p|div|li|h\d|tr|br)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
