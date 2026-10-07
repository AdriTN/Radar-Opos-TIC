// Boletín Oficial de Canarias: no tiene API; se lee el índice HTML de cada número
// (https://www.gobiernodecanarias.org/boc/AAAA/NNN/index.html) y se enumeran los números en orden.
import { limpiarMarcado, sinTildes } from "./util.mjs";
import { esTIC, clasificar } from "./boe.mjs";

export const urlIndice = (anio, num) => `https://www.gobiernodecanarias.org/boc/${anio}/${String(num).padStart(3, "0")}/index.html`;
export const urlHtml = (anio, num, disp) => `https://www.gobiernodecanarias.org/boc/${anio}/${String(num).padStart(3, "0")}/${disp}.html`;

// Extrae [{anio, num, disp, titulo, pdf}] de un índice. Tolerante: busca enlaces a boc-a-AAAA-NNN-DDD.pdf.
export function parsearIndice(html) {
  const items = new Map();
  const re = /<a\b[^>]*href=["']([^"']*boc-a-(\d{4})-(\d{3})-(\d+)\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, href, anio, num, disp, interior] = m;
    const titulo = limpiarMarcado(interior).replace(/\s+/g, " ").trim();
    const clave = `${anio}-${num}-${disp}`;
    const previo = items.get(clave);
    if (!previo || titulo.length > previo.titulo.length) items.set(clave, { anio: Number(anio), num: Number(num), disp: Number(disp), titulo, pdf: href.startsWith("http") ? href : `https://sede.gobiernodecanarias.org${href}` });
  }
  return [...items.values()].filter((i) => i.titulo.length > 25); // descarta enlaces tipo "Descargar"
}

const GENERICA = /por la que se convocan?\b.*(pruebas selectivas|proceso selectivo|oposici)|convocatoria.*(pruebas selectivas|proceso selectivo)/i;

export function filtrarBOC(items, fechaISO, cfg) {
  const out = [];
  for (const it of items) {
    const tipo = clasificar(it.titulo);
    const tic = esTIC(it.titulo, cfg.palabrasTIC);
    const funcionPublica = /funci[oó]n p[uú]blica/i.test(it.titulo.split(".-")[0] || "");
    // Las convocatorias generales de Función Pública no nombran la especialidad: se revisan por si el anexo incluye TI.
    const generica = funcionPublica && GENERICA.test(it.titulo) && !tic;
    if (/fiestas laborales|calendario (de fiestas|laboral)/i.test(it.titulo)) {
      out.push({ id: `BOC-A-${it.anio}-${String(it.num).padStart(3, "0")}-${it.disp}`, fuente: "BOC", fecha: fechaISO, tipo: "festivos", admin: "Canarias", ambito: "CAN", organismo: "BOC", titulo: it.titulo.replace(/\s+/g, " ").trim(), url: urlHtml(it.anio, it.num, it.disp), pdf: it.pdf });
      continue;
    }
    if (!tic && !generica) continue;
    if (!["convocatoria", "bolsa", "listas", "tramite", "oep", "correccion"].includes(tipo) && !generica) continue;
    out.push({
      id: `BOC-A-${it.anio}-${String(it.num).padStart(3, "0")}-${it.disp}`, fuente: "BOC", fecha: fechaISO,
      tipo: generica ? "convocatoria" : tipo, admin: "Canarias", ambito: "CAN",
      organismo: (it.titulo.split(".-")[0] || "").trim().slice(0, 120),
      titulo: it.titulo.replace(/\s+/g, " ").trim(), url: urlHtml(it.anio, it.num, it.disp), pdf: it.pdf,
      revisarAnexo: generica || undefined,
    });
  }
  return out;
}

// Fecha del número a partir del texto de la portada: "Martes 24 de marzo de 2026".
export function fechaDeIndice(html) {
  const t = sinTildes(limpiarMarcado(html));
  const m = t.match(/(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de (\d{4})/);
  if (!m) return null;
  const mes = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"].indexOf(m[2]) + 1;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
