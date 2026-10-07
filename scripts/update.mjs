// Radar de Oposiciones TIC · actualizador diario (Node 20+, sin dependencias npm).
// Lee BOE (API abierta), BOC (índices HTML), tablas oficiales de retribuciones (PDF) y vigila páginas oficiales.
// Salidas en data/: auto.json, watch.json, salud.json, retribuciones.json, historico.json, seed-datos.json,
// calendario.ics y nuevos.md (aviso para el Issue de GitHub).
import { readFile, writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ymd, limpiarMarcado } from "./lib/util.mjs";
import { procesarDia, calcularPlazo, textoDeXmlBoe } from "./lib/boe.mjs";
import { extraerDatos, extraerNotaCorte } from "./lib/texto.mjs";
import { urlIndice, parsearIndice, filtrarBOC, fechaDeIndice } from "./lib/boc.mjs";
import { parsearSueldos, parsearComplementoDestino } from "./lib/retribuciones.mjs";
import { generarICS, datosEvento } from "./lib/ics.mjs";
import { ajustesDeFiestas, nacional, seccion } from "./lib/fiestas.mjs";

const execFileP = promisify(execFile);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "RadarOposTIC/2.0 (seguimiento personal de convocatorias públicas; 1 consulta diaria por fuente)";

export const TIPOS_AVISO = ["convocatoria", "oep", "listas", "bolsa", "pagina", "festivos", "recordatorio"];
const REC_DIAS = [7, 3, 1, 0];                         // días de antelación de los recordatorios automáticos
const YA_HECHO = ["inscrito", "admitido", "presentado"]; // con estos estados no se recuerda el fin de plazo
const difDias = (a, b) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);

function fusionarFestivos(...fuentes) {
  const out = {};
  for (const src of fuentes) for (const [anio, v] of Object.entries(src || {})) for (const amb of ["ES", "CAN"]) {
    const x = v?.[amb]; if (!x) continue;
    out[anio] ||= {}; out[anio][amb] ||= { anadir: [], quitar: [] };
    out[anio][amb].anadir = [...new Set([...out[anio][amb].anadir, ...(x.anadir || [])])];
    out[anio][amb].quitar = [...new Set([...out[anio][amb].quitar, ...(x.quitar || [])])];
  }
  return out;
}

async function leer(ruta, def) { try { return JSON.parse(await readFile(ruta, "utf8")); } catch { return def; } }

export class Red {
  constructor(fetchFn = globalThis.fetch) { this.f = fetchFn; }
  async get(url, { json = false, binario = false, aceptar404 = false } = {}) {
    const r = await this.f(url, { headers: { "User-Agent": UA, ...(json ? { Accept: "application/json" } : {}) }, redirect: "follow", signal: AbortSignal.timeout(45000) });
    if (r.status === 404 && aceptar404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (json) return r.json();
    if (binario) return Buffer.from(await r.arrayBuffer());
    return new TextDecoder("utf-8").decode(await r.arrayBuffer());
  }
}

async function pdfATexto(buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-"));
  try {
    const p = path.join(dir, "doc.pdf");
    await writeFile(p, buffer);
    const { stdout } = await execFileP("pdftotext", ["-layout", p, "-"], { maxBuffer: 50 * 1024 * 1024 });
    return stdout;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

class Salud {
  constructor(previo, ahoraISO) { this.p = previo?.fuentes || {}; this.n = {}; this.t = ahoraISO; }
  reg(id, nombre, ok, detalle = "") {
    const a = this.p[id] || {};
    this.n[id] = { nombre, ok, detalle: String(detalle).slice(0, 200), revisada: this.t,
      ultimoOk: ok ? this.t : a.ultimoOk || null, fallosSeguidos: ok ? 0 : (a.fallosSeguidos || 0) + 1 };
  }
  json() { return { generado: this.t, fuentes: this.n }; }
}

export async function ejecutar({ raiz = RAIZ, red = new Red(), pdf = pdfATexto, ahora = new Date() } = {}) {
  const f = (...p) => path.join(raiz, ...p);
  const cfg = await leer(f("config.json"), null);
  if (!cfg) throw new Error("Falta config.json");
  const hoy = ymd(ahora), anio = ahora.getUTCFullYear();
  const festManual = await leer(f("data", "festivos-extra.json"), {});
  const festOfi = await leer(f("data", "festivos-oficiales.json"), { anios: {} });
  let extraFestivos = fusionarFestivos(festOfi.anios, festManual);
  const seed = await leer(f("data", "seed.json"), { procesos: [] });
  const auto = await leer(f("data", "auto.json"), { items: [], diasEscaneados: [], boc: null });
  const watch = await leer(f("data", "watch.json"), { paginas: {} });
  const retribPrev = await leer(f("data", "retribuciones.json"), { ambitos: {} });
  const historico = await leer(f("data", "historico.json"), { convocatorias: {}, resultados: {} });
  const saludPrev = await leer(f("data", "salud.json"), { fuentes: {} });
  const mi = await leer(f("data", "mi-situacion.json"), { procesos: {} });
  const salud = new Salud(saludPrev, ahora.toISOString());
  const nuevos = [];
  let presupuestoDocs = cfg.maxDocumentosPorEjecucion;
  const conocidos = new Set(auto.items.map((i) => i.id));

  // ---------- 1) BOE ----------
  const primeraVez = auto.diasEscaneados.length === 0;
  const dias = primeraVez ? cfg.lookbackDiasPrimeraVez : cfg.lookbackDiasNormal;
  let boeOk = 0, boeFallo = 0, boeUltimoError = "";
  const candidatos = [];
  for (let k = dias; k >= 0; k--) {
    const iso = ymd(new Date(ahora.getTime() - k * 86400000));
    if (k > 1 && auto.diasEscaneados.includes(iso)) continue;
    try {
      const json = await red.get(`https://www.boe.es/datosabiertos/api/boe/sumario/${iso.replaceAll("-", "")}`, { json: true, aceptar404: true });
      if (json) for (const it of procesarDia(json, iso, cfg)) if (!conocidos.has(it.id)) { candidatos.push(it); conocidos.add(it.id); }
      if (!auto.diasEscaneados.includes(iso)) auto.diasEscaneados.push(iso);
      boeOk++;
    } catch (e) { boeFallo++; boeUltimoError = `${iso}: ${e.message}`; }
  }
  salud.reg("boe", "BOE · sumario diario (API abierta)", boeFallo === 0, boeFallo ? `${boeFallo} días fallidos; último ${boeUltimoError}` : `${boeOk} días leídos`);

  // ---------- 2) BOC ----------
  if (cfg.boc?.activo) {
    let { anio: ba, num: bn } = auto.boc || {};
    let tope = cfg.boc.maxPorEjecucion;
    if (!ba) { ba = cfg.boc.bootstrap.anio; bn = cfg.boc.bootstrap.desde - 1; tope = cfg.boc.bootstrap.max; }
    let leidos = 0, error = "";
    while (tope-- > 0) {
      let html = null, sigAnio = ba, sigNum = bn + 1;
      try {
        html = await red.get(urlIndice(sigAnio, sigNum), { aceptar404: true });
        if (!html && ahora.getUTCFullYear() > ba) { sigAnio = ba + 1; sigNum = 1; html = await red.get(urlIndice(sigAnio, sigNum), { aceptar404: true }); }
      } catch (e) { error = e.message; break; }
      if (!html || !/boc-a-\d{4}-\d{3}-\d+\.pdf/.test(html)) break; // aún no publicado
      const fecha = fechaDeIndice(html) || hoy;
      for (const it of filtrarBOC(parsearIndice(html), fecha, cfg)) if (!conocidos.has(it.id)) { candidatos.push(it); conocidos.add(it.id); }
      ba = sigAnio; bn = sigNum; leidos++;
    }
    auto.boc = { anio: ba, num: bn };
    salud.reg("boc", "BOC · índice de cada número", !error, error || `${leidos} números nuevos (último ${ba}/${String(bn).padStart(3, "0")})`);
  }

  // ---------- 3) Texto de convocatorias/listas/bolsas nuevas ----------
  async function textoDe(it) {
    if (it.fuente === "BOE") return textoDeXmlBoe(await red.get(it.xml));
    return limpiarMarcado(await red.get(it.url));
  }
  // Calendario oficial de fiestas: se aplica solo, antes de calcular ningún plazo.
  for (const it of candidatos.filter((c) => c.tipo === "festivos")) {
    const anioF = Number((it.titulo.match(/20\d\d/g) || []).pop());
    try {
      if (!anioF) throw new Error("no se reconoce el año en el título");
      const texto = await textoDe(it);
      const r = ajustesDeFiestas(it.fuente === "BOE" ? nacional(texto) : null, it.fuente === "BOE" ? seccion(texto, "Canarias") : texto, anioF);
      const aplicados = Object.keys(r.ajustes);
      festOfi.anios[anioF] = { ...(festOfi.anios[anioF] || {}), ...r.ajustes, verificado: hoy, fuente: [...new Set([...(festOfi.anios[anioF]?.fuente || []), it.id])] };
      it.aplicado = aplicados.length > 0; it.detalleFiestas = r.avisos.join(" · ");
      salud.reg(`fiestas:${it.id}`, `Calendario de fiestas ${anioF} (${it.fuente})`, aplicados.length > 0, r.avisos.join(" · ") || `aplicado: ${aplicados.join(", ")}`);
    } catch (e) { it.aplicado = false; salud.reg(`fiestas:${it.id}`, `Calendario de fiestas ${anioF || "?"} (${it.fuente})`, false, e.message); }
  }
  extraFestivos = fusionarFestivos(festOfi.anios, festManual);

  for (const it of candidatos) {
    if (it.tipo === "festivos") { auto.items.push(it); nuevos.push(it); continue; }
    if (["convocatoria", "bolsa", "listas"].includes(it.tipo) && presupuestoDocs-- > 0) {
      try {
        const texto = await textoDe(it);
        it.datos = extraerDatos(texto);
        if (it.tipo === "convocatoria") it.plazo = calcularPlazo(it, it.datos, extraFestivos);
        if (it.tipo === "listas") { const nc = extraerNotaCorte(texto); if (nc != null) it.datos.notaCorte = nc; }
      } catch (e) { it.errorTexto = e.message; if (it.tipo === "convocatoria") it.plazo = calcularPlazo(it, null, extraFestivos); }
    } else if (it.tipo === "convocatoria") it.plazo = calcularPlazo(it, null, extraFestivos);
    auto.items.push(it); nuevos.push(it);
    if (it.tipo === "convocatoria") historico.convocatorias[it.id] = { id: it.id, fecha: it.fecha, admin: it.admin, titulo: it.titulo, url: it.url, plazas: it.datos?.plazas || [], tasas: it.datos?.tasas || [], grupo: it.datos?.grupo || null, fuente: it.fuente };
    if (it.tipo === "listas" && it.datos?.notaCorte != null) historico.resultados[it.id] = { id: it.id, fecha: it.fecha, admin: it.admin, titulo: it.titulo, url: it.url, notaCorte: it.datos.notaCorte, fuente: it.fuente };
  }
  const limite = ymd(new Date(ahora.getTime() - cfg.conservarDias * 86400000));
  auto.items = auto.items.filter((i) => i.fecha >= limite).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  auto.diasEscaneados = auto.diasEscaneados.filter((d) => d >= limite).sort();
  auto.generado = ahora.toISOString();

  // ---------- 4) Datos oficiales de los procesos del seed (con boeId / bocUrl) ----------
  const seedDatos = {};
  for (const p of seed.procesos || []) {
    if (!p.boeId && !p.bocUrl) continue;
    try {
      const texto = p.boeId ? textoDeXmlBoe(await red.get(`https://www.boe.es/diario_boe/xml.php?id=${p.boeId}`)) : limpiarMarcado(await red.get(p.bocUrl));
      const datos = extraerDatos(texto);
      const fechaPub = p.fechaPublicacion;
      seedDatos[p.id] = { datos, actualizado: hoy, plazo: fechaPub ? calcularPlazo({ fecha: fechaPub, ambito: p.ambito || "ES" }, datos, extraFestivos) : null };
      salud.reg(`seed:${p.id}`, `Texto oficial · ${p.id}`, true, "leído");
    } catch (e) { salud.reg(`seed:${p.id}`, `Texto oficial · ${p.id}`, false, e.message); }
  }

  // ---------- 5) Retribuciones oficiales ----------
  const retrib = { generado: ahora.toISOString(), ambitos: { ...(retribPrev.ambitos || {}) } };
  for (const src of cfg.retribuciones || []) {
    const prev = retrib.ambitos[src.ambito] || {};
    const nuevo = { ...prev, nombre: src.nombre };
    for (const [clave, def, parse] of [["sueldos", src.sueldos, parsearSueldos], ["complementoDestino", src.complementoDestino, parsearComplementoDestino]]) {
      if (!def) continue;
      const id = `retrib:${src.id}:${clave}`;
      let ok = false, detalle = "";
      for (const a of [anio, anio - 1]) {
        try {
          let url = (def.urlDirecta || "").replaceAll("{anio}", a);
          if (src.indice && def.patronEnlace) {
            const html = await red.get(src.indice);
            const re = new RegExp(def.patronEnlace.replaceAll("{anio}", a), "i");
            for (const m of html.matchAll(/href=["']([^"']+\.pdf)["']/gi)) {
              if (re.test(decodeURIComponent(m[1]))) { url = new URL(m[1], src.indice).href; break; }
            }
          }
          const texto = await pdf(await red.get(url, { binario: true }));
          const r = parse(texto);
          if (!r.ok) { detalle = `${a}: ${r.motivo}`; continue; }
          nuevo[clave] = { ...(r.sueldos ? { grupos: r.sueldos } : { niveles: r.niveles }), anio: a, url, verificado: hoy };
          ok = true; break;
        } catch (e) { detalle = `${a}: ${e.message}`; }
      }
      salud.reg(id, `${src.nombre} · ${clave === "sueldos" ? "sueldo base" : "complemento de destino"}`, ok, ok ? "validado" : `${detalle} (se conserva el último dato válido)`);
    }
    retrib.ambitos[src.ambito] = nuevo;
  }

  // ---------- 6) Páginas vigiladas ----------
  for (const p of cfg.paginasVigiladas) {
    const previo = watch.paginas[p.id] || {};
    try {
      const txt = limpiarMarcado(await red.get(p.url));
      const h = createHash("sha256").update(txt.replace(/\s+/g, " ")).digest("hex").slice(0, 16);
      const cambio = previo.hash && previo.hash !== h;
      watch.paginas[p.id] = { nombre: p.nombre, url: p.url, hash: h, revisada: ahora.toISOString(), cambio: cambio ? ahora.toISOString() : previo.cambio || null };
      if (cambio) nuevos.push({ tipo: "pagina", titulo: `Ha cambiado la página: ${p.nombre}`, url: p.url, fecha: hoy });
      salud.reg(`pagina:${p.id}`, `Página · ${p.nombre}`, true, "leída");
    } catch (e) {
      watch.paginas[p.id] = { ...previo, nombre: p.nombre, url: p.url, revisada: ahora.toISOString(), error: e.message };
      salud.reg(`pagina:${p.id}`, `Página · ${p.nombre}`, false, e.message);
    }
  }
  watch.generado = ahora.toISOString();

  // ---------- 7) Calendario .ics y recordatorios automáticos ----------
  const sigo = Object.entries(mi.procesos || {}).filter(([, v]) => v?.sigo).map(([k]) => k);
  const todos = []; // todas las fechas de todos los procesos conocidos
  for (const p of seed.procesos || []) {
    const url = (p.enlaces || [])[0]?.url, pl = seedDatos[p.id]?.plazo?.fin;
    for (const fe of p.fechas || []) if (fe.fecha) todos.push({ pid: p.id, titulo: p.titulo, url, fecha: fe.fecha, etiqueta: fe.etiqueta, cerrado: p.estado === "cerrado" });
    if (pl && !(p.fechas || []).some((x) => x.fecha === pl)) todos.push({ pid: p.id, titulo: p.titulo, url, fecha: pl, etiqueta: "Fin del plazo de solicitudes", cerrado: p.estado === "cerrado" });
  }
  for (const it of auto.items) if (it.tipo === "convocatoria" && it.plazo?.fin)
    todos.push({ pid: it.id, titulo: it.titulo, url: it.url, fecha: it.plazo.fin, etiqueta: `Fin del plazo${it.plazo.fuente === "estimado" ? " (estimado)" : ""}`, cerrado: false });
  const hace14 = ymd(new Date(ahora.getTime() - 14 * 86400000));
  const eventos = todos.filter((t) => t.fecha >= hace14 && (sigo.length ? sigo.includes(t.pid) : !t.cerrado))
    .map((t) => ({ uid: `${t.pid}-${t.fecha}-${t.etiqueta}`.replace(/\W+/g, "-"), fecha: t.fecha, url: t.url, ...datosEvento(t.etiqueta, t.titulo, t.url) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  await writeFile(f("data", "calendario.ics"), generarICS(eventos, ahora.toISOString()));
  // Archivos .ics por proceso y de todos: enlaces https reales para que iPhone ofrezca "Añadir todo" al Calendario
  await mkdir(f("data", "ics"), { recursive: true });
  const evDe = (t) => ({ uid: `${t.pid}-${t.fecha}-${t.etiqueta}`.replace(/\W+/g, "-"), fecha: t.fecha, url: t.url, ...datosEvento(t.etiqueta, t.titulo, t.url) });
  const vivos = todos.filter((t) => !t.cerrado && t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  await writeFile(f("data", "ics", "todas.ics"), generarICS(vivos.map(evDe), ahora.toISOString()));
  const porId = {}; for (const t of vivos) (porId[t.pid] ||= []).push(t);
  for (const [pid, ts] of Object.entries(porId)) await writeFile(f("data", "ics", pid.replace(/\W+/g, "-") + ".ics"), generarICS(ts.map(evDe), ahora.toISOString()));
  // Recordatorios: sin intervención tuya. Solo de lo que sigues y cuando faltan 7, 3, 1 o 0 días.
  for (const t of todos) {
    const n = difDias(t.fecha, hoy); if (!REC_DIAS.includes(n) || !sigo.includes(t.pid)) continue;
    const st = mi.procesos?.[t.pid]?.estado;
    if (st === "descartado" || (/plazo|cierra/i.test(t.etiqueta) && YA_HECHO.includes(st))) continue;
    nuevos.push({ tipo: "recordatorio", fecha: hoy, url: t.url || "", titulo: `${datosEvento(t.etiqueta, "").resumen.split(" · ")[0]} ${n === 0 ? "es HOY" : n === 1 ? "es MAÑANA" : `es en ${n} días`} (${t.fecha}) · ${t.titulo}`.slice(0, 220) });
  }

  // ---------- 8) Escritura ----------
  auto.errores = Object.values(salud.n).filter((s) => !s.ok).map((s) => `${s.nombre}: ${s.detalle}`);
  const w = (n, o) => writeFile(f("data", n), JSON.stringify(o, null, 1) + "\n");
  await Promise.all([w("auto.json", auto), w("watch.json", watch), w("salud.json", salud.json()), w("retribuciones.json", retrib), w("historico.json", historico), w("seed-datos.json", seedDatos), w("festivos-oficiales.json", { generado: ahora.toISOString(), anios: festOfi.anios })]);

  const rel = nuevos.filter((n) => TIPOS_AVISO.includes(n.tipo));
  const md = rel.map((n) => `- **${n.tipo}** · ${n.fecha} · ${n.url ? `[${n.titulo}](${n.url})` : n.titulo}${n.tipo === "festivos" ? (n.aplicado ? " · ya aplicado a los plazos automáticamente" : ` · NO se pudo aplicar solo (${n.detalleFiestas || "ver Fuentes y salud"}); revisa data/festivos-extra.json`) : ""}${n.plazo ? ` · plazo hasta ${n.plazo.fin} (${n.plazo.fuente})` : ""}${n.revisarAnexo ? " · revisa el anexo: puede incluir Tecnologías de la Información" : ""}`).join("\n");
  await writeFile(f("data", "nuevos.md"), md ? md + "\n" : "");
  return { nuevos: nuevos.length, avisos: rel.length, errores: auto.errores, eventos: eventos.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ejecutar().then((r) => { console.log(`Novedades: ${r.nuevos} (avisos ${r.avisos}) · eventos en el calendario: ${r.eventos} · errores: ${r.errores.length}`); r.errores.forEach((e) => console.warn("  ! " + e)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
