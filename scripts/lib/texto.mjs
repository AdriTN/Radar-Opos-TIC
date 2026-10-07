// Extrae datos útiles del texto (ya limpio) de una convocatoria: plazo, plazas, tasas, titulación, enlaces.
import { sinTildes, mesNum, palabraANumero, numES } from "./util.mjs";

export function extraerPlazo(texto) {
  const t = String(texto).replace(/\s+/g, " ");
  const re = /plazo (?:de presentaci[oó]n de (?:las )?solicitudes |para (?:la )?presentaci[oó]n de (?:las )?solicitudes )?(?:ser[aá]|es|ser[aá] de)?\s*(?:de|:)?\s*([\p{L}\d]+)(?:\s*\((\d+)\))?\s+d[ií]as\s+(h[aá]biles|naturales)/iu;
  const m = t.match(re);
  if (m) {
    const dias = m[2] ? Number(m[2]) : palabraANumero(m[1]);
    if (dias) {
      const ctx = t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 120);
      return { dias, tipo: /h[aá]biles/i.test(m[3]) ? "habiles" : "naturales", desdeSiguiente: /a partir del d[ií]a siguiente|siguiente al de (?:la )?publicaci[oó]n/i.test(ctx) };
    }
  }
  const h = t.match(/hasta el (\d{1,2}) de (\p{L}+) de (\d{4})/iu);
  if (h && mesNum(h[2])) return { fin: `${h[3]}-${String(mesNum(h[2])).padStart(2, "0")}-${String(h[1]).padStart(2, "0")}` };
  return null;
}

export function extraerTasas(texto) {
  const t = String(texto).replace(/\s+/g, " ");
  const out = [];
  const re = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|euros)/gi;
  let m;
  while ((m = re.exec(t))) {
    const ctx = sinTildes(t.slice(Math.max(0, m.index - 160), m.index));
    if (/derechos de examen|tasa|importe/.test(ctx)) { const v = numES(m[1]); if (!out.includes(v)) out.push(v); }
  }
  return out.slice(0, 4);
}

export function extraerPlazas(texto) {
  const t = String(texto).replace(/\s+/g, " ");
  const out = [];
  const re = /(\d{1,3}(?:\.\d{3})*)\s+plazas?(?:\s+(?:de|por)\s+(?:el\s+)?(?:acceso|turno|sistema)?\s*([\p{L} ]{3,30}))?/giu;
  let m;
  while ((m = re.exec(t)) && out.length < 4) out.push(m[0].trim().slice(0, 60));
  return out;
}

export function extraerTitulacion(texto) {
  const t = String(texto).replace(/\s+/g, " ");
  const m = t.match(/[^.]{0,120}(?:titulaci[oó]n|estar en posesi[oó]n d(?:el|e un) t[ií]tulo|t[ií]tulo (?:universitario )?de )[^.]{0,220}\./i);
  return m ? m[0].trim().slice(0, 300) : null;
}

export function extraerEnlaces(texto) {
  const urls = String(texto).match(/https?:\/\/[^\s)"'<>]+/gi) || [];
  const buenos = urls.map((u) => u.replace(/[.,;]+$/, "")).filter((u) => /inap|redsara|administracion\.gob|060|sede\.|gobiernodecanarias|grancanaria|ips\./i.test(u));
  return [...new Set(buenos)].slice(0, 4);
}

export function extraerGrupo(texto) {
  const t = String(texto);
  const m = t.match(/\b(?:subgrupo|grupo)\s*[:\-]?\s*(A1|A2|C1|C2)\b/i) || t.match(/\b(A1|A2|C1|C2)\b/);
  return m ? m[1].toUpperCase() : null;
}

export function extraerNotaCorte(texto) {
  const t = String(texto).replace(/\s+/g, " ");
  const m = t.match(/nota\s+(?:m[ií]nima|de corte|de aprobado|m[ií]nima de aprobado)[^\d]{0,60}(\d{1,2}(?:[.,]\d{1,4})?)/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export function extraerDatos(texto) {
  return {
    plazo: extraerPlazo(texto),
    plazas: extraerPlazas(texto),
    tasas: extraerTasas(texto),
    titulacion: extraerTitulacion(texto),
    enlaces: extraerEnlaces(texto),
    grupo: extraerGrupo(texto),
  };
}
