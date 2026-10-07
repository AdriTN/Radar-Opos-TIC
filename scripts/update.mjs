// Radar de Oposiciones TIC — actualizador diario (Node 20+, sin dependencias).
// 1) Escanea el sumario del BOE (sección II.B "Oposiciones y concursos") y guarda lo relacionado con TIC.
// 2) Vigila páginas oficiales y marca cuándo cambian.
// Salidas: data/auto.json, data/watch.json y (si hay novedades) data/nuevos.md
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const f = (...p) => path.join(RAIZ, ...p);
const UA = "RadarOposicionesTIC/1.0 (uso personal; +https://github.com)";

// ---------- utilidades puras (se testean en test/) ----------
export const aArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function esTIC(titulo, palabras) {
  const t = sinTildes(titulo);
  return palabras.some((p) => {
    const q = sinTildes(p);
    return q.length <= 3 ? new RegExp(`\\b${q}\\b`).test(t) : t.includes(q);
  });
}

export function clasificar(titulo) {
  const t = sinTildes(titulo);
  if (/oferta de empleo publico/.test(t)) return "oep";
  if (/por la que se convoca|convocatoria|se convocan|bases (de la|para la)|bases reguladoras/.test(t) &&
      !/lista|admitid|tribunal|calificaci|resultado/.test(t)) return "convocatoria";
  if (/admitidos|excluidos|lista (provisional|definitiva)|relacion de aprobados|aprobados/.test(t)) return "listas";
  if (/tribunal|calificaci|fecha|lugar|ejercicio|examen|resultado/.test(t)) return "tramite";
  if (/correccion de errores/.test(t)) return "correccion";
  return "otros";
}

export function ambitoValido(departamento, titulo, cfg) {
  const d = sinTildes(departamento || "");
  const t = sinTildes(titulo || "");
  const local = d.includes("administracion local");
  const otraCCAA = /^comunidad autonoma|^comunidad (de|foral)|^principado|^region de|^junta de/.test(d) &&
    !d.includes("canarias");
  const regiones = cfg.regionesLocales.map(sinTildes);
  const mencionaRegion = regiones.some((r) => t.includes(r) || d.includes(r));
  if (d.includes("canarias")) return { ok: true, admin: "Canarias" };
  if (local) return mencionaRegion ? { ok: true, admin: "Local (Canarias)" } : { ok: false };
  if (otraCCAA) return { ok: false };
  if (cfg.incluirAGE && (d.startsWith("ministerio") || d.includes("administracion general") ||
      d.includes("presidencia") || d.includes("jefatura") || d.includes("cortes") || d.includes("tribunal")))
    return { ok: true, admin: "AGE" };
  return mencionaRegion ? { ok: true, admin: "Canarias" } : { ok: false };
}

// Suma n días hábiles (lunes-viernes; no descuenta festivos, por eso es una estimación).
export function sumarHabiles(isoFecha, n) {
  const d = new Date(isoFecha + "T12:00:00Z");
  let c = 0;
  while (c < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) c++;
  }
  return d.toISOString().slice(0, 10);
}

// Recorre el JSON del sumario del BOE y devuelve los items de la sección 2B con su departamento.
export function extraerItems2B(json) {
  const salida = [];
  const sumario = json?.data?.sumario;
  for (const diario of aArray(sumario?.diario)) {
    for (const seccion of aArray(diario?.seccion)) {
      if (String(seccion?.codigo).toUpperCase() !== "2B") continue;
      for (const dep of aArray(seccion?.departamento)) {
        const itemsDirectos = aArray(dep?.item);
        const porEpigrafe = aArray(dep?.epigrafe).flatMap((e) => aArray(e?.item));
        for (const it of [...itemsDirectos, ...porEpigrafe]) {
          if (!it?.identificador || !it?.titulo) continue;
          salida.push({ departamento: dep.nombre || "", ...it });
        }
      }
    }
  }
  return salida;
}

export function procesarDia(json, fechaISO, cfg) {
  const res = [];
  for (const it of extraerItems2B(json)) {
    if (!esTIC(it.titulo, cfg.palabrasTIC)) continue;
    const amb = ambitoValido(it.departamento, it.titulo, cfg);
    if (!amb.ok) continue;
    const tipo = clasificar(it.titulo);
    const item = {
      id: it.identificador,
      fecha: fechaISO,
      tipo,
      admin: amb.admin,
      organismo: it.departamento,
      titulo: it.titulo.replace(/\s+/g, " ").trim(),
      url: `https://www.boe.es/diario_boe/txt.php?id=${it.identificador}`,
      pdf: it.url_pdf?.texto || null,
    };
    if (tipo === "convocatoria") item.plazoEstimado = sumarHabiles(fechaISO, 20);
    res.push(item);
  }
  return res;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const compacto = (iso) => iso.replaceAll("-", "");

// ---------- red ----------
async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (r.status === 404) return null; // domingos / días sin BOE
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
}

async function hashPagina(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  let html = await r.text();
  html = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
  return createHash("sha256").update(html).digest("hex").slice(0, 16);
}

async function leer(ruta, def) {
  try { return JSON.parse(await readFile(ruta, "utf8")); } catch { return def; }
}

async function main() {
  const cfg = await leer(f("config.json"), null);
  if (!cfg) throw new Error("Falta config.json");
  const ahora = new Date();
  const auto = await leer(f("data", "auto.json"), { items: [], diasEscaneados: [], errores: [] });
  const watch = await leer(f("data", "watch.json"), { paginas: {} });
  const errores = [];
  const nuevos = [];

  // 1) BOE
  const primeraVez = auto.diasEscaneados.length === 0;
  const dias = primeraVez ? cfg.lookbackDiasPrimeraVez : cfg.lookbackDiasNormal;
  const conocidos = new Set(auto.items.map((i) => i.id));
  for (let k = dias; k >= 0; k--) {
    const d = new Date(ahora.getTime() - k * 86400000);
    const iso = ymd(d);
    const esHoy = k === 0;
    // Hoy y ayer se reescanean siempre (el sumario puede publicarse tarde); el resto solo si no se hizo.
    if (!esHoy && k > 1 && auto.diasEscaneados.includes(iso)) continue;
    try {
      const json = await getJSON(`https://www.boe.es/datosabiertos/api/boe/sumario/${compacto(iso)}`);
      if (json) {
        for (const it of procesarDia(json, iso, cfg)) {
          if (!conocidos.has(it.id)) { auto.items.push(it); conocidos.add(it.id); nuevos.push(it); }
        }
      }
      if (!auto.diasEscaneados.includes(iso)) auto.diasEscaneados.push(iso);
    } catch (e) {
      errores.push(`BOE ${iso}: ${e.message}`);
    }
  }
  const limite = ymd(new Date(ahora.getTime() - cfg.conservarDias * 86400000));
  auto.items = auto.items.filter((i) => i.fecha >= limite).sort((a, b) => b.fecha.localeCompare(a.fecha));
  auto.diasEscaneados = auto.diasEscaneados.filter((d) => d >= limite).sort();
  auto.generado = ahora.toISOString();
  auto.errores = errores;

  // 2) Páginas vigiladas
  for (const p of cfg.paginasVigiladas) {
    const previo = watch.paginas[p.id] || {};
    try {
      const h = await hashPagina(p.url);
      watch.paginas[p.id] = {
        nombre: p.nombre, url: p.url, hash: h,
        revisada: ahora.toISOString(),
        cambio: previo.hash && previo.hash !== h ? ahora.toISOString() : previo.cambio || null,
      };
      if (previo.hash && previo.hash !== h) nuevos.push({ tipo: "pagina", titulo: `Ha cambiado la página: ${p.nombre}`, url: p.url, fecha: ymd(ahora) });
    } catch (e) {
      errores.push(`Página ${p.id}: ${e.message}`);
      watch.paginas[p.id] = { ...previo, nombre: p.nombre, url: p.url, revisada: ahora.toISOString(), error: e.message };
    }
  }
  watch.generado = ahora.toISOString();

  await writeFile(f("data", "auto.json"), JSON.stringify(auto, null, 1) + "\n");
  await writeFile(f("data", "watch.json"), JSON.stringify(watch, null, 1) + "\n");

  // 3) Aviso (el workflow abre un Issue; GitHub lo notifica al móvil)
  const relevantes = nuevos.filter((n) => ["convocatoria", "oep", "listas", "pagina"].includes(n.tipo));
  if (relevantes.length) {
    const md = relevantes.map((n) => `- **${n.tipo}** · ${n.fecha} · [${n.titulo}](${n.url})` + (n.plazoEstimado ? ` · plazo aprox. hasta ${n.plazoEstimado}` : "")).join("\n");
    await writeFile(f("data", "nuevos.md"), md + "\n");
  } else {
    await writeFile(f("data", "nuevos.md"), "");
  }
  console.log(`BOE: ${nuevos.filter((n) => n.id).length} novedades · páginas vigiladas: ${cfg.paginasVigiladas.length} · errores: ${errores.length}`);
  errores.forEach((e) => console.warn("  ! " + e));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
