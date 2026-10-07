import { aArray, sinTildes, limpiarMarcado } from "./util.mjs";
import { sumarHabiles } from "./festivos.mjs";
import { extraerDatos } from "./texto.mjs";

export function esTIC(titulo, palabras) {
  const t = sinTildes(titulo);
  return palabras.some((p) => {
    const q = sinTildes(p);
    return q.length <= 3 ? new RegExp(`\\b${q}\\b`).test(t) : t.includes(q);
  });
}

export function clasificar(titulo) {
  const t = sinTildes(titulo);
  if (/fiestas laborales|calendario laboral/.test(t)) return "festivos";
  if (/oferta de empleo publico/.test(t)) return "oep";
  if (/lista(s)? de empleo|bolsa(s)? de (empleo|trabajo|interinos)|listas? de reserva|funcionarios? interinos|personal interino/.test(t)) return "bolsa";
  if (/admitidos|excluidos|lista (provisional|definitiva)|relacion de aprobados|aprobados/.test(t)) return "listas";
  if (/por la que se convoca|se convocan|convocatoria|bases (de la|para la|reguladoras)/.test(t) && !/tribunal|calificaci|resultado/.test(t)) return "convocatoria";
  if (/tribunal|calificaci|fecha|lugar|ejercicio|examen|resultado/.test(t)) return "tramite";
  if (/correccion de errores/.test(t)) return "correccion";
  return "otros";
}

export function ambitoValido(departamento, titulo, cfg) {
  const d = sinTildes(departamento || ""), t = sinTildes(titulo || "");
  const regiones = cfg.regionesLocales.map(sinTildes);
  const menciona = regiones.some((r) => t.includes(r) || d.includes(r));
  if (d.includes("canarias")) return { ok: true, admin: "Canarias", ambito: "CAN" };
  if (d.includes("administracion local")) return menciona ? { ok: true, admin: "Local (Canarias)", ambito: "CAN" } : { ok: false };
  if (/^comunidad (autonoma|de|foral)|^principado|^region de|^junta de|^generalitat|^gobierno de/.test(d)) return { ok: false };
  if (cfg.incluirAGE && /^ministerio|administracion general|^presidencia|^jefatura|^cortes|^tribunal|^consejo|^agencia|^instituto/.test(d)) return { ok: true, admin: "AGE", ambito: "ES" };
  return menciona ? { ok: true, admin: "Canarias", ambito: "CAN" } : { ok: false };
}

export function extraerItems(json, codigos = ["2B"]) {
  const out = [], set = new Set(codigos.map(String));
  for (const diario of aArray(json?.data?.sumario?.diario))
    for (const sec of aArray(diario?.seccion)) {
      if (!set.has(String(sec?.codigo).toUpperCase())) continue;
      for (const dep of aArray(sec?.departamento)) {
        const todos = [...aArray(dep?.item), ...aArray(dep?.epigrafe).flatMap((e) => aArray(e?.item))];
        for (const it of todos) if (it?.identificador && it?.titulo) out.push({ seccion: String(sec.codigo), departamento: dep.nombre || "", ...it });
      }
    }
  return out;
}

// Devuelve items relevantes de un sumario diario del BOE.
export function procesarDia(json, fechaISO, cfg) {
  const res = [];
  for (const it of extraerItems(json, ["2B", "3"])) {
    const tipo = clasificar(it.titulo);
    if (it.seccion === "3") {
      if (tipo !== "festivos") continue; // en la sección III solo nos interesa el calendario de fiestas
    } else {
      if (!esTIC(it.titulo, cfg.palabrasTIC)) continue;
    }
    const amb = it.seccion === "3" ? { ok: true, admin: "AGE", ambito: "ES" } : ambitoValido(it.departamento, it.titulo, cfg);
    if (!amb.ok) continue;
    res.push({
      id: it.identificador, fuente: "BOE", fecha: fechaISO, tipo, admin: amb.admin, ambito: amb.ambito,
      organismo: it.departamento, titulo: String(it.titulo).replace(/\s+/g, " ").trim(),
      url: `https://www.boe.es/diario_boe/txt.php?id=${it.identificador}`, pdf: it.url_pdf?.texto || null,
      xml: `https://www.boe.es/diario_boe/xml.php?id=${it.identificador}`,
    });
  }
  return res;
}

// Calcula el plazo a partir de los datos extraídos del texto. 'oficial' si el texto lo dice; 'estimado' si no.
export function calcularPlazo(item, datos, extra = {}) {
  const base = datos?.plazo;
  if (base?.fin) return { fin: base.fin, fuente: "texto" };
  if (base?.dias && base.tipo === "habiles") return { dias: base.dias, tipo: "habiles", desde: item.fecha, fin: sumarHabiles(item.fecha, base.dias, item.ambito, extra), fuente: "texto" };
  if (base?.dias) { const d = new Date(item.fecha + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + base.dias); return { dias: base.dias, tipo: "naturales", desde: item.fecha, fin: d.toISOString().slice(0, 10), fuente: "texto" }; }
  return { dias: 20, tipo: "habiles", desde: item.fecha, fin: sumarHabiles(item.fecha, 20, item.ambito, extra), fuente: "estimado" };
}

export const textoDeXmlBoe = (xml) => limpiarMarcado(String(xml).match(/<texto[\s\S]*<\/texto>/i)?.[0] || xml);
export const datosDeTexto = extraerDatos;
