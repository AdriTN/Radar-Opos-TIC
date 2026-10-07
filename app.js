// Radar Opos TIC · interfaz. Sin dependencias. Datos: data/*.json generados a diario por GitHub Actions.
import { sumarHabiles } from "./scripts/lib/festivos.mjs";
import { generarICS, datosEvento } from "./scripts/lib/ics.mjs";

/* ============ utilidades ============ */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const url = (u) => (/^(https?:|webcal:)\/\//i.test(u || "") ? u : "#");
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const HOY = iso(new Date());
const dif = (f) => Math.round((new Date(f + "T12:00:00") - new Date(HOY + "T12:00:00")) / 86400000);
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmt = (f) => { const [y, m, d] = f.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const rel = (n) => (n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n > 0 ? `en ${n} días` : `hace ${-n} días`);
const eur = (n) => (n == null ? "—" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR" }));
const corto = (p, n = 64) => {
  let t = String(p.titulo).replace(/^(Gobierno de Canarias|AGE|Canarias)\s·\s/, "").split(" · ")[0].replace(/^[^.]{3,90}\.-\s*/, "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  cmp: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const ico = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

const ESTADOS = { abierto: "Plazo abierto", proximo: "Próximamente", en_curso: "En curso", cerrado: "Cerrado" };
const ORDEN = { abierto: 0, proximo: 1, en_curso: 2, cerrado: 3 };
const MI_ESTADO = { pendiente: "Sin decidir", valorando: "Valorando", inscrito: "Inscrito/a", admitido: "Admitido/a", presentado: "Presentado/a al examen", aprobado1: "Aprobé el 1.er ejercicio", enlista: "En la lista final / bolsa", descartado: "Descartado" };

/* ============ datos ============ */
const D = { seed: { procesos: [], bolsas: [], fuentes: [] }, auto: { items: [] }, watch: { paginas: {} }, retrib: { ambitos: {} }, hist: { convocatorias: {}, resultados: {} }, histSeed: { convocatorias: [] }, salud: { fuentes: {} }, seedDatos: {}, miRemoto: null, festivos: {} };
function fusionarFest(...fuentes) {
  const out = {};
  for (const src of fuentes) for (const [a, v] of Object.entries(src || {})) for (const amb of ["ES", "CAN"]) {
    const x = v?.[amb]; if (!x) continue; out[a] ||= {}; out[a][amb] ||= { anadir: [], quitar: [] };
    out[a][amb].anadir = [...new Set([...out[a][amb].anadir, ...(x.anadir || [])])]; out[a][amb].quitar = [...new Set([...out[a][amb].quitar, ...(x.quitar || [])])];
  }
  return out;
}
async function cargar() {
  const g = (n, def) => fetch(`data/${n}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : def)).catch(() => def);
  const [seed, auto, watch, retrib, hist, histSeed, salud, seedDatos, mi, festOfi, festMan] = await Promise.all([
    g("seed.json", null), g("auto.json", D.auto), g("watch.json", D.watch), g("retribuciones.json", D.retrib), g("historico.json", D.hist),
    g("historico-seed.json", D.histSeed), g("salud.json", D.salud), g("seed-datos.json", {}), g("mi-situacion.json", null), g("festivos-oficiales.json", { anios: {} }), g("festivos-extra.json", {})]);
  if (seed) D.seed = seed; D.cargaOk = !!seed;
  Object.assign(D, { auto, watch, retrib, hist, histSeed, salud, seedDatos, miRemoto: mi, festivos: fusionarFest(festOfi?.anios, festMan) });
}

/* ============ mi situación (local + sincronizada con GitHub) ============ */
const Sit = {
  data: JSON.parse(lsGet("sit", '{"version":1,"procesos":{}}')), estado: "local", timer: null,
  cfg() { return { repo: lsGet("gh_repo", ""), token: lsGet("gh_token", ""), rama: lsGet("gh_rama", "master") }; },
  conectada() { const c = this.cfg(); return !!(c.repo && c.token); },
  get(id) { return this.data.procesos[id] || {}; },
  set(id, patch) {
    this.data.procesos[id] = { ...this.get(id), ...patch, actualizado: new Date().toISOString() };
    this.data.actualizado = new Date().toISOString(); lsSet("sit", JSON.stringify(this.data));
    clearTimeout(this.timer); if (this.conectada()) { this.estado = "pendiente"; this.timer = setTimeout(() => this.push(), 1500); }
    pintarSync();
  },
  fusionar(a, b) { // gana la edición más reciente de cada proceso
    const out = { version: 1, procesos: { ...(a?.procesos || {}) } };
    for (const [k, v] of Object.entries(b?.procesos || {})) if (!out.procesos[k] || (v.actualizado || "") > (out.procesos[k].actualizado || "")) out.procesos[k] = v;
    out.actualizado = [a?.actualizado, b?.actualizado].filter(Boolean).sort().pop() || null; return out;
  },
  async api(met, cuerpo) {
    const c = this.cfg();
    const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/data/mi-situacion.json${met === "GET" ? `?ref=${encodeURIComponent(c.rama)}` : ""}`, {
      method: met, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${c.token}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    return r.json();
  },
  dec: (b64) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)))),
  enc: (o) => { const b = new TextEncoder().encode(JSON.stringify(o, null, 1) + "\n"); let s = ""; b.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); },
  async pull() {
    if (this.conectada()) { const r = await this.api("GET"); this.sha = r.sha; this.data = this.fusionar(this.data, this.dec(r.content)); }
    else if (D.miRemoto) this.data = this.fusionar(this.data, D.miRemoto);
    lsSet("sit", JSON.stringify(this.data));
  },
  async push(reintento = true) {
    if (!this.conectada()) return;
    this.estado = "sincronizando"; pintarSync();
    try {
      if (!this.sha) await this.pull();
      const c = this.cfg();
      const r = await this.api("PUT", { message: "Mi situación (Radar)", content: this.enc(this.data), sha: this.sha, branch: c.rama });
      this.sha = r.content.sha; this.estado = "ok";
    } catch (e) {
      if (reintento && (e.status === 409 || e.status === 422)) { this.sha = null; await this.pull().catch(() => {}); return this.push(false); }
      this.estado = "error"; this.error = e.message;
    }
    pintarSync();
  },
  async iniciar() {
    try { await this.pull(); if (this.conectada()) this.estado = "ok"; } catch (e) { this.estado = "error"; this.error = e.message; }
    pintarSync();
  },
};
function pintarSync() {
  const el = $("#sync"); if (!el) return;
  const m = { local: ["Solo local", ""], pendiente: ["Cambios sin enviar", "busy"], sincronizando: ["Sincronizando…", "busy"], ok: ["Sincronizado", "ok"], error: [`Error de sincronización`, "bad"] }[Sit.estado];
  el.textContent = m[0]; el.className = "sync " + m[1]; el.title = Sit.error || "";
}

/* ============ modelo unificado de procesos ============ */
function plazoSeed(p, sd) {
  const cierre = (p.fechas || []).find((f) => f.fecha && /cierra la inscripci/i.test(f.etiqueta));
  if (cierre) return { fin: cierre.fecha, fuente: "texto" };
  if (sd?.plazo?.fin) return sd.plazo;
  if (p.fechaPublicacion) return { dias: 20, tipo: "habiles", desde: p.fechaPublicacion, fin: sumarHabiles(p.fechaPublicacion, 20, p.ambito || "ES", D.festivos), fuente: "estimado" };
  return null;
}
function estadoDe(p) {
  let ini = null, fin = null;
  (p.fechas || []).forEach((f) => { if (!f.fecha) return; if (/abre la inscripci/i.test(f.etiqueta)) ini = f.fecha; if (/cierra la inscripci/i.test(f.etiqueta)) fin = f.fecha; });
  fin = fin || p.plazo?.fin;
  if (ini && fin) { if (dif(ini) > 0) return "proximo"; if (dif(fin) >= 0) return "abierto"; }
  else if (fin && p.auto) return dif(fin) >= 0 ? "abierto" : "cerrado";
  return p.estado === "abierto" && fin && dif(fin) < 0 ? "en_curso" : p.estado;
}
function construir() {
  const lista = [];
  for (const p of D.seed.procesos || []) {
    const sd = D.seedDatos[p.id], plazo = plazoSeed(p, sd);
    const tieneFin = (p.fechas || []).some((f) => /cierra la inscripci|fin del plazo/i.test(f.etiqueta));
    const fechas = [...(p.fechas || [])];
    if (plazo?.fin && !tieneFin) fechas.push({ fecha: plazo.fin, etiqueta: `Fin del plazo de solicitudes${plazo.fuente === "estimado" ? " (estimado)" : ""}` });
    const o = p.oficial || {}, a = sd?.datos || {};
    const q = { ...p, fechas, plazo, datos: { plazas: o.plazas ?? (a.plazas?.length ? a.plazas.join(" · ") : p.plazas), tasas: o.tasas ?? a.tasas, titulacion: o.titulacion ?? a.titulacion, inscripcionUrl: o.inscripcionUrl ?? a.enlaces?.[0] ?? (p.enlaces || []).find((e) => e.tipo === "inscripcion")?.url, fuente: o.fuente || (sd ? "Texto de la convocatoria" : null), verificado: o.verificado || sd?.actualizado } };
    q._e = estadoDe(q); lista.push(q);
  }
  for (const it of D.auto.items || []) {
    if (it.tipo !== "convocatoria") continue;
    const d = it.datos || {}, pl = it.plazo;
    const q = { id: it.id, auto: true, titulo: it.titulo, admin: it.admin, ambito: it.ambito, grupo: d.grupo || "—", acceso: "—", plazo: pl, fuente: it.fuente,
      resumen: `Detectada en el ${it.fuente} el ${fmt(it.fecha)}.` + (it.revisarAnexo ? " Es una convocatoria conjunta de varios cuerpos: revisa el anexo I por si incluye Tecnologías de la Información." : ""),
      fechas: [{ fecha: it.fecha, etiqueta: `Publicada en el ${it.fuente}` }, ...(pl?.fin ? [{ fecha: pl.fin, etiqueta: `Fin del plazo de solicitudes${pl.fuente === "estimado" ? " (estimado)" : ""}` }] : [])],
      enlaces: [{ tipo: "bases", texto: `Bases en el ${it.fuente}`, url: it.url }, ...(it.pdf ? [{ tipo: "pdf", texto: "PDF", url: it.pdf.startsWith("http") ? it.pdf : `https://www.boe.es${it.pdf}` }] : [])],
      datos: { plazas: d.plazas?.join(" · "), tasas: d.tasas, titulacion: d.titulacion, inscripcionUrl: d.enlaces?.[0], fuente: `${it.fuente} (lectura automática)`, verificado: D.auto.generado?.slice(0, 10) } };
    q._e = estadoDe(q); lista.push(q);
  }
  return lista;
}
function sueldoDe(p) {
  const g = String(p.grupo || "").match(/^(A1|A2|B|C1|C2)$/)?.[1]; if (!g) return null;
  const R = D.retrib.ambitos || {}; const pref = p.ambito === "CAN" ? ["CAN", "AGE"] : ["AGE"];
  for (const k of pref) { const t = R[k]?.sueldos?.grupos?.[g]; if (t) return { ...t, grupo: g, url: R[k].sueldos.url, anio: R[k].sueldos.anio, verificado: R[k].sueldos.verificado, origen: k }; }
  return null;
}
function hitos(procesos, soloSigo) {
  const out = [];
  procesos.forEach((p) => { if (soloSigo && !Sit.get(p.id).sigo) return; (p.fechas || []).forEach((f) => { if (f.fecha && dif(f.fecha) >= 0) out.push({ f: f.fecha, e: f.etiqueta, p }); }); });
  return out.sort((a, b) => (a.f < b.f ? -1 : 1));
}


/* ============ calendario: añadir directamente (con tu consentimiento en cada acción) ============ */
const eventoDe = (p, f) => {
  const url = p.datos?.inscripcionUrl || p.enlaces?.[0]?.url;
  const extra = [`${p.admin} · grupo ${p.grupo}`, p.datos?.plazas && `${p.datos.plazas}`].filter(Boolean).join("\n");
  return { uid: `${p.id}-${f.fecha}-${f.etiqueta}`.replace(/\W+/g, "-"), fecha: f.fecha, url, ...datosEvento(f.etiqueta, corto(p, 60), url, extra) };
};
const eventosFuturos = (p) => (p.fechas || []).filter((f) => f.fecha && dif(f.fecha) >= 0).map((f) => eventoDe(p, f));
const diaSig = (f) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const plantillaGoogle = (e) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.resumen)}&dates=${e.fecha.replaceAll("-", "")}/${diaSig(e.fecha).replaceAll("-", "")}&details=${encodeURIComponent(e.descripcion)}${e.url ? `&location=${encodeURIComponent(e.url)}` : ""}`;
// Al móvil (Android o iOS): se entrega un .ics por la hoja de compartir del sistema y el propio calendario del teléfono pide confirmar y añade todo.
async function enviarAlCalendario(evs, icsUrl) {
  const txt = generarICS(evs, new Date().toISOString()), nombre = "radar-opos-tic.ics";
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && icsUrl) { // iPhone/iPad: un enlace https real a un .ics hace que Safari ofrezca "Añadir todo" al Calendario
    const abs = new URL(icsUrl, location.href).href;
    // App instalada: la web no puede abrir un .ics, así que se entrega con webcal:// y lo recoge la app Calendario. En Safari: https y «Añadir todo».
    aviso(navigator.standalone ? "Pulsa «Suscribirse» en la ventana de Calendario" : "Pulsa «Añadir todo» en la ventana de Calendario");
    location.href = navigator.standalone ? abs.replace(/^https?:/, "webcal:") : abs; return;
  }
  if (matchMedia("(pointer:coarse)").matches && navigator.share) {
    const f = new File([txt], nombre, { type: "text/calendar" });
    if (!navigator.canShare || navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: "Fechas de Radar Opos TIC" }); aviso("Elige tu app de Calendario para añadirlas"); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = nombre; a.click();
  aviso("Abre el archivo descargado para añadirlo a tu calendario");
}
let gTok = null, gExp = 0, gCli = null;
const gId = () => lsGet("g_client", "");
const cargarGIS = () => new Promise((ok, ko) => { if (window.google?.accounts?.oauth2) return ok(); const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = ok; s.onerror = () => ko(new Error("No se pudo cargar Google")); document.head.appendChild(s); });
async function gToken(forzar) {
  if (gTok && Date.now() < gExp && !forzar) return gTok;
  await cargarGIS();
  return new Promise((ok, ko) => {
    gCli ||= google.accounts.oauth2.initTokenClient({ client_id: gId(), scope: "https://www.googleapis.com/auth/calendar.events", callback: () => {}, error_callback: (e) => ko(new Error(e.type || "cancelado")) });
    gCli.callback = (r) => { if (r.error) return ko(new Error(r.error)); gTok = r.access_token; gExp = Date.now() + (r.expires_in - 60) * 1000; ok(gTok); };
    gCli.requestAccessToken({ prompt: gTok ? "" : "consent" });
  });
}
async function gInsertar(evs) {
  let nuevos = 0, repetidos = 0, tok = await gToken();
  const api = (u, o = {}) => fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${u}`, { ...o, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" } });
  for (const e of evs) {
    let r = await api(`?maxResults=1&privateExtendedProperty=${encodeURIComponent("radarUid=" + e.uid)}`);
    if (r.status === 401) { tok = await gToken(true); r = await api(`?maxResults=1&privateExtendedProperty=${encodeURIComponent("radarUid=" + e.uid)}`); }
    if (!r.ok) throw new Error(`Google ${r.status}`);
    if ((await r.json()).items?.length) { repetidos++; continue; }
    const cuerpo = { summary: e.resumen, description: e.descripcion, start: { date: e.fecha }, end: { date: diaSig(e.fecha) }, colorId: e.color, transparency: "transparent",
      source: { title: "Radar Opos TIC", url: location.href.split("#")[0] }, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 9540 }, { method: "popup", minutes: 900 }] }, extendedProperties: { private: { radarUid: e.uid } } };
    const w = await api("", { method: "POST", body: JSON.stringify(cuerpo) });
    if (!w.ok) throw new Error(`Google ${w.status}`);
    nuevos++;
  }
  return { nuevos, repetidos };
}
async function anadirACalendario(evs, icsUrl) {
  if (!evs.length) return aviso("No hay fechas futuras que añadir");
  if (!gId()) return enviarAlCalendario(evs, icsUrl); // calendario del móvil (Android o iOS)
  if (evs.length > 1 && !confirm(`Se añadirán ${evs.length} eventos a tu Google Calendar (con avisos 7 días y 1 día antes). ¿Continuar?`)) return;
  try { const r = await gInsertar(evs); aviso(`Calendario: ${r.nuevos} añadido(s)${r.repetidos ? `, ${r.repetidos} ya estaban` : ""}`); }
  catch (e) { aviso(`No se pudo añadir: ${e.message}. Probando con la plantilla…`); if (evs.length === 1) window.open(plantillaGoogle(evs[0]), "_blank", "noopener"); }
}

/* ============ estado de la interfaz ============ */
const UI = { fEstado: "todos", fAdmin: "todas", q: "", soloSigo: lsGet("soloSigo", "0") === "1", cmp: null };
let P = [];
const RUTAS = { inicio: ["Inicio", "home"], procesos: ["Procesos", "list"], comparar: ["Comparar", "cmp"], bolsas: ["Bolsas", "bag"], historico: ["Histórico", "hist"], calendario: ["Calendario", "cal"], fuentes: ["Fuentes y salud", "pulse"], ajustes: ["Ajustes", "cog"] };
const TABS = ["inicio", "procesos", "comparar", "calendario"], LATERAL = ["inicio", "procesos", "comparar", "bolsas", "historico", "calendario", "fuentes", "ajustes"];
const SUB = ["fuentes", "ajustes"];
const GRUPO_PROC = [["procesos", "Oposiciones"], ["bolsas", "Bolsas"], ["historico", "Histórico"]];
const segmento = (r) => (GRUPO_PROC.some(([k]) => k === r) ? `<div class="seg solo-movil" role="tablist" aria-label="Sección">${GRUPO_PROC.map(([k, t]) => `<a href="${aRuta(k)}" role="tab" ${k === r ? 'aria-current="page" aria-selected="true"' : ""}>${esc(t)}</a>`).join("")}</div>` : "");
const hayAlertaFuentes = () => Object.values(D.salud.fuentes || {}).some((s) => !s.ok && s.fallosSeguidos >= 3);

function ruta() {
  const h = location.hash.replace(/^#\/?/, ""); const [path, qs] = h.split("?"); const q = new URLSearchParams(qs || "");
  return { r: RUTAS[path] ? path : "inicio", p: q.get("p") };
}
const aRuta = (r, p) => `#/${r}${p ? `?p=${encodeURIComponent(p)}` : ""}`;

/* ============ vistas ============ */
const badgesDe = (p) => `<div class="badges"><span class="b ${p._e}">${esc(ESTADOS[p._e] || p._e)}</span><span class="b">${esc(p.admin)}</span>${p.grupo && p.grupo !== "—" ? `<span class="b">Grupo ${esc(p.grupo)}</span>` : ""}${p.acceso && p.acceso !== "—" ? `<span class="b">${esc(p.acceso)}</span>` : ""}${Sit.get(p.id).sigo ? '<span class="b brand">Sigues</span>' : ""}</div>`;
const sigFecha = (p) => (p.fechas || []).filter((f) => f.fecha && dif(f.fecha) >= 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];
const estrella = (p) => `<button class="star" data-act="seguir" data-id="${esc(p.id)}" aria-pressed="${!!Sit.get(p.id).sigo}" aria-label="${Sit.get(p.id).sigo ? "Dejar de seguir" : "Seguir"} ${esc(corto(p, 40))}">${ico("star")}</button>`;
function tarjeta(p) {
  const s = sigFecha(p), mi = Sit.get(p.id);
  return `<article class="card proc" data-go="${esc(aRuta(ruta().r === "inicio" ? "inicio" : "procesos", p.id))}"><div class="row top"><div class="grow">${badgesDe(p)}<div class="titulo">${esc(corto(p, 110))}</div></div>${estrella(p)}</div>
    ${s ? `<div class="next">Próxima fecha: <b>${esc(s.etiqueta)}</b> · ${esc(fmt(s.fecha))} (${esc(rel(dif(s.fecha)))})</div>` : `<div class="next">${esc(p.fechas?.find((f) => !f.fecha)?.etiqueta || "Sin próximas fechas confirmadas")}${p.fechas?.find((f) => !f.fecha)?.texto ? " · " + esc(p.fechas.find((f) => !f.fecha).texto) : ""}</div>`}
    ${mi.estado && mi.estado !== "pendiente" ? `<div class="next">Mi situación: <b>${esc(MI_ESTADO[mi.estado] || mi.estado)}</b></div>` : ""}</article>`;
}
function hitoFila(h) {
  const n = dif(h.f);
  return `<a class="hito" href="${esc(aRuta("procesos", h.p.id))}" style="text-decoration:none"><div class="dias">${n === 0 ? "Hoy" : n}<small>${n === 0 ? "" : n === 1 ? "día" : "días"}</small></div><div class="t grow"><b>${esc(h.e)}</b><span class="mute small">${esc(fmt(h.f))} · ${esc(corto(h.p, 70))}</span></div></a>`;
}

function vInicio() {
  const sigo = P.filter((p) => Sit.get(p.id).sigo), hs = hitos(P, UI.soloSigo && sigo.length > 0);
  const cuenta = (e) => P.filter((p) => p._e === e).length;
  const avisos = [];
  const mal = Object.values(D.salud.fuentes || {}).filter((s) => !s.ok && s.fallosSeguidos >= 3);
  if (mal.length) avisos.push(`<div class="alert bad">${ico("pulse")}<div><b>${mal.length} fuente(s) llevan días sin leerse.</b> Los datos pueden estar desfasados. <a href="${aRuta("fuentes")}">Ver detalle</a></div></div>`);
  const gen = D.auto.generado?.slice(0, 10);
  if (gen && dif(gen) < -3) avisos.push(`<div class="alert bad">${ico("refresh")}<div>La revisión automática lleva ${-dif(gen)} días sin ejecutarse. Revisa la pestaña Actions del repositorio.</div></div>`);
  if (!D.cargaOk) avisos.push('<div class="alert bad">No se pudieron cargar los datos. Comprueba tu conexión.</div>');
  P.filter((p) => sigo.includes(p) && p.plazo?.fin && dif(p.plazo.fin) >= 0 && dif(p.plazo.fin) <= 10 && !["inscrito", "admitido", "presentado"].includes(Sit.get(p.id).estado))
    .forEach((p) => avisos.push(`<a class="alert" style="text-decoration:none" href="${aRuta("inicio", p.id)}">${ico("cal")}<div><b>El plazo de “${esc(corto(p, 50))}” termina ${esc(rel(dif(p.plazo.fin)))}</b> (${esc(fmt(p.plazo.fin))}) y no figuras como inscrito/a.</div></a>`));
  (D.auto.items || []).filter((i) => i.revisarAnexo && dif(i.fecha) >= -14).forEach((i) => avisos.push(`<a class="alert" style="text-decoration:none" href="${aRuta("inicio", i.id)}">${ico("list")}<div><b>Convocatoria general del ${esc(i.fuente)}:</b> revisa si el anexo incluye Tecnologías de la Información (${esc(fmt(i.fecha))}).</div></a>`));
  Object.values(D.watch.paginas || {}).filter((w) => w.cambio && dif(w.cambio.slice(0, 10)) >= -7).forEach((w) => avisos.push(`<a class="alert" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="${esc(url(w.url))}">${ico("out")}<div><b>Ha cambiado ${esc(w.nombre)}</b> (${esc(rel(dif(w.cambio.slice(0, 10))))}). Ábrela para ver qué hay de nuevo.</div></a>`));
  const prox = hs[0];
  const nov = (D.auto.items || []).filter((i) => ["convocatoria", "bolsa", "listas", "oep"].includes(i.tipo)).slice(0, 6);
  const TIPO = { convocatoria: "Convocatoria", bolsa: "Bolsa/lista de empleo", listas: "Listas", oep: "Oferta de empleo", tramite: "Trámite", festivos: "Calendario de fiestas" };
  return `${avisos.join("")}
  <div class="grid2" style="margin-top:${avisos.length ? 14 : 0}px">
    <section class="card hero"><div class="mute small" style="color:inherit;opacity:.85">${prox ? "Próxima fecha" : "Sin fechas próximas"}</div>
      ${prox ? `<div class="gran">${dif(prox.f) === 0 ? "Hoy" : dif(prox.f)}<span style="font-size:1rem;font-weight:600"> ${dif(prox.f) === 0 ? "" : dif(prox.f) === 1 ? "día" : "días"}</span></div><p><b>${esc(prox.e)}</b><br>${esc(corto(prox.p, 80))} · ${esc(fmt(prox.f))}</p><a class="btn" href="${esc(aRuta("procesos", prox.p.id))}">Ver proceso</a>` : `<p>Cuando haya convocatorias con fechas, aparecerán aquí.</p>`}</section>
    <div class="stats"><a class="stat" href="#/procesos" data-filtro="abierto"><b>${cuenta("abierto")}</b><span>Plazo abierto</span></a><a class="stat" href="#/procesos" data-filtro="proximo"><b>${cuenta("proximo")}</b><span>Próximamente</span></a><a class="stat" href="#/procesos" data-filtro="en_curso"><b>${cuenta("en_curso")}</b><span>En curso</span></a></div>
  </div>
  <h2 class="sec">Mis procesos</h2>
  ${sigo.length ? `<div class="stack">${sigo.map(tarjeta).join("")}</div>` : `<div class="empty">Marca con ★ los procesos que te interesan. Aquí verás su estado y solo recibirás avisos y calendario de esos.</div>`}
  <h2 class="sec">Próximas fechas ${sigo.length ? `<label style="float:right;text-transform:none;letter-spacing:0;font-weight:600"><input type="checkbox" data-act="soloSigo" ${UI.soloSigo ? "checked" : ""}> solo las que sigo</label>` : ""}</h2>
  <div class="card">${hs.length ? hs.slice(0, 6).map(hitoFila).join("") : '<div class="mute">No hay fechas futuras confirmadas.</div>'}</div>
  <h2 class="sec">Novedades detectadas</h2>
  <div class="card list">${nov.length ? nov.map((i) => `<a class="it" ${i.tipo === "convocatoria" ? `href="${esc(aRuta("inicio", i.id))}"` : `target="_blank" rel="noopener noreferrer" href="${esc(url(i.url))}"`}><b>${esc(i.titulo.length > 150 ? i.titulo.slice(0, 149) + "…" : i.titulo)}</b><div class="mute small">${esc(TIPO[i.tipo] || i.tipo)} · ${esc(i.fuente)} · ${esc(fmt(i.fecha))}${i.plazo ? ` · plazo hasta ${esc(fmt(i.plazo.fin))}${i.plazo.fuente === "estimado" ? " (est.)" : ""}` : ""}</div></a>`).join("") : '<div class="mute">Sin novedades TIC recientes. El radar revisa BOE y BOC cada mañana.</div>'}</div>`;
}

function vProcesos() {
  const q = UI.q.toLowerCase();
  const admins = ["todas", ...new Set(P.map((p) => p.admin))];
  const lista = P.filter((p) => (UI.fEstado === "todos" || p._e === UI.fEstado) && (UI.fAdmin === "todas" || p.admin === UI.fAdmin) && (!q || `${p.titulo} ${p.admin} ${p.grupo}`.toLowerCase().includes(q))).sort((a, b) => ORDEN[a._e] - ORDEN[b._e] || (sigFecha(a)?.fecha || "9") .localeCompare(sigFecha(b)?.fecha || "9"));
  const chip = (act, v, t, sel) => `<button class="chip" data-act="${act}" data-v="${esc(v)}" aria-pressed="${sel === v}">${esc(t)}</button>`;
  return `<input class="search" type="search" placeholder="Buscar por cuerpo, grupo o administración" value="${esc(UI.q)}" data-act="buscar" aria-label="Buscar">
  <div class="chips" role="group" aria-label="Estado">${[["todos", "Todos"], ["abierto", "Plazo abierto"], ["proximo", "Próximamente"], ["en_curso", "En curso"], ["cerrado", "Cerrados"]].map(([v, t]) => chip("fEstado", v, t, UI.fEstado)).join("")}</div>
  <div class="chips" role="group" aria-label="Administración">${admins.map((a) => chip("fAdmin", a, a === "todas" ? "Todas las administraciones" : a, UI.fAdmin)).join("")}</div>
  <div class="stack" style="margin-top:6px">${lista.length ? lista.map(tarjeta).join("") : '<div class="empty">Ningún proceso con estos filtros.</div>'}</div>`;
}

function datoFila(k, v, src) { return `<dt>${esc(k)}</dt><dd>${v}${src ? `<span class="src">${esc(src)}</span>` : ""}</dd>`; }
function vDetalle(p) {
  const mi = Sit.get(p.id), d = p.datos || {}, s = sueldoDe(p), sig = sigFecha(p);
  const inscr = d.inscripcionUrl || (p.enlaces || []).find((e) => e.tipo === "inscripcion")?.url;
  const pend = '<span class="pend">pendiente de verificar</span>';
  const tl = (p.fechas || []).slice().sort((a, b) => (a.fecha || "9") .localeCompare(b.fecha || "9")).map((f) => {
    const pas = f.fecha && dif(f.fecha) < 0, es = sig && f.fecha === sig.fecha && f.etiqueta === sig.etiqueta;
    return `<li class="${pas ? "pasado " : ""}${es ? "sig" : ""}"><span class="f">${f.fecha ? esc(fmt(f.fecha)) : "—"}</span><span class="grow">${esc(f.etiqueta)}${f.fecha ? "" : " · " + esc(f.texto || "")}${es ? ` <b>(${esc(rel(dif(f.fecha)))})</b>` : ""}</span>${f.fecha && !pas ? `<button class="btn s" data-act="addcal" data-pid="${esc(p.id)}" data-f="${esc(f.fecha)}" data-e="${esc(f.etiqueta)}" aria-label="Añadir al calendario: ${esc(f.etiqueta)}">${ico("cal")}</button>` : ""}</li>`;
  }).join("");
  const plazoSrc = p.plazo ? (p.plazo.fuente === "texto" ? "Calculado con el texto oficial y festivos" : "Estimación de 20 días hábiles: confirma en las bases") : "";
  return `${badgesDe(p)}<h2 style="margin:10px 0 6px;font-size:1.25rem;line-height:1.3">${esc(p.titulo)}</h2><p style="margin:0 0 14px">${esc(p.resumen || "")}</p>
  <div class="btns" style="margin-bottom:14px">${inscr ? `<a class="btn p" target="_blank" rel="noopener noreferrer" href="${esc(url(inscr))}">Inscribirme ${ico("out")}</a>` : ""}${(p.enlaces || []).filter((l) => l.url !== inscr).map((l, i) => `<a class="btn ${!inscr && i === 0 ? "p" : ""}" target="_blank" rel="noopener noreferrer" href="${esc(url(l.url))}">${esc(l.texto)} ${ico("out")}</a>`).join("")}</div>
  <h2 class="sec">Mi situación</h2>
  <div class="card form"><label class="sw" style="color:var(--ink)"><span>Seguir este proceso</span><input type="checkbox" data-sit="sigo" ${mi.sigo ? "checked" : ""}></label>
    <label>Estado<select data-sit="estado">${Object.entries(MI_ESTADO).map(([k, v]) => `<option value="${k}" ${(mi.estado || "pendiente") === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    <label>Mi nota o puntuación<input data-sit="nota" inputmode="decimal" placeholder="Por ejemplo 26,79 / 50" value="${esc(mi.nota || "")}"></label>
    <label>Notas<textarea data-sit="texto" placeholder="Requisitos pendientes, tasas pagadas…">${esc(mi.texto || "")}</textarea></label>
    <div class="mute small">${Sit.conectada() ? "Se guarda en tu repositorio y se sincroniza entre PC y móvil." : "Solo se guarda en este dispositivo. Conecta GitHub en Ajustes para sincronizar."}</div></div>
  <h2 class="sec">Calendario</h2><div class="card">${tl ? `<ul class="tl">${tl}</ul>` : '<div class="mute">Sin fechas publicadas.</div>'}${eventosFuturos(p).length ? `<div class="btns" style="margin-top:12px"><button class="btn s p" data-act="addcalTodo" data-pid="${esc(p.id)}">${ico("cal")} Añadir todas a mi calendario</button></div>` : ""}${plazoSrc ? `<div class="mute small" style="margin-top:8px">${esc(plazoSrc)}</div>` : ""}</div>
  <h2 class="sec">Datos oficiales</h2>
  <div class="card"><dl class="kv">
    ${datoFila("Plazas", d.plazas ? esc(d.plazas) : "—", d.fuente)}
    ${datoFila("Tasa", d.tasas?.length ? d.tasas.map(eur).join(" / ") : "—", d.fuente)}
    ${datoFila("Titulación", d.titulacion ? esc(d.titulacion) : "—", d.fuente)}
    ${datoFila("Sueldo base", s ? `${eur(s.sueldoMensual)} / mes<span class="src">+ ${eur(s.trienioMensual)} por trienio · sin complementos</span>` : (String(p.grupo).match(/^(A1|A2|B|C1|C2)$/) ? pend : "Depende del cuerpo"), s ? `Retribuciones ${s.anio} (${s.origen === "CAN" ? "Canarias" : "AGE"}), verificado ${fmt(s.verificado)}` : "")}
    ${datoFila("Jornada", p.jornada ? esc(p.jornada) : "—", p.jornada ? "" : "No la fija la convocatoria: depende del puesto que se adjudique")}
  </dl>${p.nota ? `<p class="mute small" style="margin:12px 0 0">${esc(p.nota)}</p>` : ""}${d.verificado ? `<div class="mute small" style="margin-top:8px">Última verificación: ${esc(fmt(d.verificado))}</div>` : ""}</div>`;
}

function vComparar() {
  const cand = P.filter((p) => p._e !== "cerrado" || !p.auto);
  if (!UI.cmp) UI.cmp = cand.filter((p) => /^(A1|A2|C1)$/.test(p.grupo)).slice(0, 3).map((p) => p.id);
  const sel = UI.cmp.map((id) => P.find((p) => p.id === id)).filter(Boolean);
  const fila = (t, f) => `<tr><th scope="row">${t}</th>${sel.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`;
  const sd = (p) => sueldoDe(p);
  const tabla = sel.length ? `<div class="tw"><table class="cmp"><thead><tr><th></th>${sel.map((p) => `<th><a href="${esc(aRuta("comparar", p.id))}" style="text-decoration:none">${esc(corto(p, 60))}</a><div class="badges" style="margin-top:6px"><span class="b ${p._e}">${esc(ESTADOS[p._e])}</span></div></th>`).join("")}</tr></thead><tbody>
    ${fila("Administración", (p) => esc(p.admin))}${fila("Grupo", (p) => esc(p.grupo))}${fila("Acceso", (p) => esc(p.acceso || "—"))}
    ${fila("Plazas", (p) => (p.datos?.plazas ? esc(p.datos.plazas) : "—"))}
    ${fila("Plazo de solicitud", (p) => (p.plazo?.fin ? `${esc(fmt(p.plazo.fin))}<span class="src">${p.plazo.fuente === "texto" ? "calculado con el texto oficial" : "estimado"}</span>` : "—"))}
    ${fila("Tasa", (p) => (p.datos?.tasas?.length ? p.datos.tasas.map(eur).join(" / ") : "—"))}
    ${fila("Titulación", (p) => (p.datos?.titulacion ? esc(p.datos.titulacion) : "—"))}
    ${fila("Sueldo base / mes", (p) => { const s = sd(p); return s ? `<b>${eur(s.sueldoMensual)}</b><span class="src">+ ${eur(s.trienioMensual)}/trienio · ${s.origen === "CAN" ? "Canarias" : "AGE"} ${s.anio}</span>` : (/^(A1|A2|B|C1|C2)$/.test(p.grupo) ? '<span class="pend">pendiente de verificar</span>' : "Según cuerpo"); })}
    ${fila("Jornada", (p) => (p.jornada ? esc(p.jornada) : '<span class="mute">Depende del puesto</span>'))}
    ${fila("Inscripción", (p) => { const u = p.datos?.inscripcionUrl; return u ? `<a target="_blank" rel="noopener noreferrer" href="${esc(url(u))}">Abrir ↗</a>` : "—"; })}
    </tbody></table></div>` : '<div class="empty">Elige hasta 4 procesos para compararlos.</div>';
  const Rr = D.retrib.ambitos || {};
  const pie = ["AGE", "CAN"].map((k) => Rr[k]?.sueldos ? `<a target="_blank" rel="noopener noreferrer" href="${esc(url(Rr[k].sueldos.url))}">${esc(Rr[k].nombre)}</a> (${Rr[k].sueldos.anio}, verificado ${esc(fmt(Rr[k].sueldos.verificado))})` : `${esc(Rr[k]?.nombre || (k === "AGE" ? "Retribuciones AGE" : "Retribuciones Canarias"))}: <span class="pend">aún sin verificar</span>`).join("<br>");
  return `<h2 class="sec">Procesos a comparar (máx. 4)</h2><div class="chips">${cand.map((p) => `<button class="chip" data-act="cmp" data-v="${esc(p.id)}" aria-pressed="${UI.cmp.includes(p.id)}">${esc(corto(p, 34))}</button>`).join("")}</div>${tabla}
  <p class="foot">Sueldos: se leen a diario de las tablas oficiales y solo se publican si pasan una validación; si no, se mantiene el último dato válido o se marca “pendiente de verificar”. El sueldo base no incluye complemento de destino, específico ni trienios.<br>${pie}</p>`;
}

function vBolsas() {
  const det = (D.auto.items || []).filter((i) => i.tipo === "bolsa");
  const bs = (D.seed.bolsas || []).map((b) => { const w = D.watch.paginas?.[b.vigilaPagina]; const mi = Sit.get("bolsa:" + b.id);
    return `<article class="card"><div class="badges"><span class="b">${esc(b.admin)}</span><span class="b ${w?.cambio && dif(w.cambio.slice(0, 10)) >= -7 ? "en_curso" : ""}">${w?.cambio && dif(w.cambio.slice(0, 10)) >= -7 ? "Página actualizada " + esc(rel(dif(w.cambio.slice(0, 10)))) : esc(b.estado || "")}</span>${mi.inscrito ? '<span class="b brand">Inscrito/a</span>' : ""}</div>
    <div class="titulo">${esc(b.titulo)}</div><p style="margin:0 0 10px">${esc(b.resumen)}</p>${b.fuenteDato ? `<p class="mute small" style="margin:0 0 10px">Fuente: ${esc(b.fuenteDato)}</p>` : ""}
    <div class="btns">${(b.enlaces || []).map((l, i) => `<a class="btn ${i === 0 ? "p" : ""}" target="_blank" rel="noopener noreferrer" href="${esc(url(l.url))}">${esc(l.texto)} ${ico("out")}</a>`).join("")}</div>
    <label class="sw" style="margin-top:10px"><span>Estoy inscrito/a en esta bolsa</span><input type="checkbox" data-bolsa="${esc(b.id)}" ${mi.inscrito ? "checked" : ""}></label></article>`; }).join("");
  return `<div class="stack">${bs || '<div class="empty">Sin bolsas configuradas.</div>'}</div>
  <h2 class="sec">Detectado automáticamente</h2><div class="card list">${det.length ? det.map((i) => `<a class="it" target="_blank" rel="noopener noreferrer" href="${esc(url(i.url))}"><b>${esc(i.titulo)}</b><div class="mute small">${esc(i.fuente)} · ${esc(i.admin)} · ${esc(fmt(i.fecha))}</div></a>`).join("") : '<div class="mute">Aún no se ha publicado en el BOE ni en el BOC ninguna lista o bolsa TIC. El radar lo revisa cada día.</div>'}</div>`;
}

function vHistorico() {
  const filas = [...(D.histSeed.convocatorias || []), ...Object.values(D.hist.convocatorias || {})].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const res = Object.values(D.hist.resultados || {}).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pl = (x) => (Array.isArray(x.plazas) ? x.plazas.join(" · ") : x.plazas) || "—";
  return `<p class="mute" style="margin-top:0">${esc(D.histSeed.nota || "")}</p>
  <div class="tw" style="overflow:auto"><table class="hist"><thead><tr><th>Fecha</th><th>Convocatoria</th><th>Plazas</th><th>Tasa</th><th>Nota de corte</th><th>Resultado</th></tr></thead><tbody>
  ${filas.map((x) => `<tr><td>${esc(fmt(x.fecha))}</td><td><a target="_blank" rel="noopener noreferrer" href="${esc(url(x.url))}">${esc(x.titulo)}</a><div class="mute small">${esc(x.admin)} · ${esc(x.fuente || "")}</div></td><td>${esc(pl(x))}</td><td>${x.tasas?.length ? x.tasas.map(eur).join(" / ") : "—"}</td><td>${x.notaCorte != null ? esc(String(x.notaCorte).replace(".", ",")) : "—"}</td><td>${esc(x.resultado || "—")}</td></tr>`).join("")}</tbody></table></div>
  ${res.length ? `<h2 class="sec">Notas de corte detectadas</h2><div class="card list">${res.map((x) => `<a class="it" target="_blank" rel="noopener noreferrer" href="${esc(url(x.url))}"><b>${esc(x.titulo)}</b><div class="mute small">${esc(fmt(x.fecha))} · nota ${esc(String(x.notaCorte).replace(".", ","))}</div></a>`).join("")}</div>` : '<p class="foot">Las notas de corte se añadirán solas cuando el BOE o el BOC publiquen listas que las indiquen; los organismos no siempre las publican.</p>'}`;
}

function vCalendario() {
  const sigo = P.some((p) => Sit.get(p.id).sigo), hs = hitos(P, UI.soloSigo && sigo);
  const base = location.origin + location.pathname.replace(/[^/]*$/, "") + "data/calendario.ics";
  const web = base.replace(/^https?:/, "webcal:");
  const gr = {}; hs.forEach((h) => { const k = h.f.slice(0, 7); (gr[k] ||= []).push(h); });
  return `<div class="card"><div class="titulo" style="margin-top:0">Suscríbete desde tu calendario</div><p class="mute" style="margin:0 0 10px">Un solo enlace que se actualiza solo y trae las fechas de los procesos que sigues (o todas las vigentes si no sigues ninguno), con aviso 7 días y 1 día antes.</p>
  <div class="btns"><a class="btn p" href="${esc(web)}">Suscribirme (Apple/Outlook)</a><a class="btn" target="_blank" rel="noopener noreferrer" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(web)}">Google Calendar</a><button class="btn" data-act="copiar" data-v="${esc(base)}">Copiar enlace</button></div></div>
  <div class="card"><div class="titulo" style="margin-top:0">Añadir directamente a tu calendario</div><p class="mute" style="margin:0 0 10px">Con tu permiso, se añaden ahora mismo las próximas fechas ${sigo ? "de los procesos que sigues, o de todos los vigentes" : "de todos los procesos vigentes"}, con aviso 7 días y 1 día antes. En el móvil se abre tu app de Calendario (Android o iPhone) para que confirmes; si has configurado Google en Ajustes, se añade directo a Google Calendar y sin duplicar.</p>
  <div class="btns">${sigo ? `<button class="btn p" data-act="addcalSigo">${ico("cal")} Añadir las que sigo</button>` : ""}<button class="btn ${sigo ? "" : "p"}" data-act="addcalTodas">${ico("cal")} Añadir todas</button></div></div>
  <h2 class="sec">Próximas fechas ${sigo ? `<label style="float:right;text-transform:none;letter-spacing:0;font-weight:600"><input type="checkbox" data-act="soloSigo" ${UI.soloSigo ? "checked" : ""}> solo las que sigo</label>` : ""}</h2>
  ${Object.keys(gr).length ? Object.entries(gr).map(([k, v]) => `<div class="card" style="margin-bottom:12px"><div class="titulo" style="margin-top:0">${esc(MESL[+k.slice(5) - 1])} ${esc(k.slice(0, 4))}</div>${v.map(hitoFila).join("")}</div>`).join("") : '<div class="empty">No hay fechas futuras.</div>'}`;
}

function vFuentes() {
  const sal = Object.entries(D.salud.fuentes || {});
  const w = Object.values(D.watch.paginas || {});
  return `<h2 class="sec">Estado de las lecturas automáticas</h2><div class="card list">${sal.length ? sal.map(([id, s]) => `<div class="it"><span class="dot ${s.ok ? "" : s.fallosSeguidos >= 3 ? "bad" : "warn"}"></span><b>${esc(s.nombre)}</b><div class="mute small">${s.ok ? "Correcta" : "Fallo"} · ${esc(s.detalle || "")} · última lectura correcta: ${s.ultimoOk ? esc(fmt(s.ultimoOk)) : "nunca"}</div></div>`).join("") : '<div class="mute">Todavía no se ha ejecutado la primera revisión automática.</div>'}</div>
  <h2 class="sec">Páginas oficiales vigiladas</h2><div class="card list">${w.length ? w.map((x) => `<a class="it" target="_blank" rel="noopener noreferrer" href="${esc(url(x.url))}"><b>${esc(x.nombre)} ↗</b><div class="mute small">${x.cambio ? `Cambió ${esc(rel(dif(x.cambio.slice(0, 10))))} · ` : "Sin cambios detectados · "}revisada ${x.revisada ? esc(fmt(x.revisada)) : "—"}</div></a>`).join("") : '<div class="mute">Sin datos todavía.</div>'}</div>
  <h2 class="sec">Fuentes oficiales</h2><div class="card list">${(D.seed.fuentes || []).map((f) => `<a class="it" target="_blank" rel="noopener noreferrer" href="${esc(url(f.url))}"><b>${esc(f.texto)} ↗</b><div class="mute small">${esc(f.grupo)}${f.ayuda ? " · " + esc(f.ayuda) : ""}</div></a>`).join("")}</div>
  <p class="foot">Información orientativa. Antes de inscribirte, confirma siempre plazos y requisitos en las bases oficiales.</p>`;
}

function vAjustes() {
  const c = Sit.cfg(), tema = lsGet("tema", "auto");
  return `<h2 class="sec">Sincronizar “mi situación” entre PC y móvil</h2>
  <div class="card form"><p class="mute" style="margin:0">Se guarda en <code>data/mi-situacion.json</code> de tu repositorio. Crea un token en GitHub (Settings → Developer settings → Fine-grained tokens) limitado a este repositorio con permiso <b>Contents: Read and write</b>, y pégalo aquí en cada dispositivo. <b>Como el repositorio es público, tus notas serían visibles: no escribas datos sensibles.</b></p>
    <label>Repositorio (usuario/nombre)<input data-aj="gh_repo" placeholder="tuusuario/Radar-Opos-TIC" value="${esc(c.repo)}" autocapitalize="off" autocomplete="off"></label>
    <label>Rama<input data-aj="gh_rama" value="${esc(c.rama)}" autocapitalize="off"></label>
    <label>Token<input data-aj="gh_token" type="password" placeholder="github_pat_…" value="${esc(c.token)}" autocomplete="off"></label>
    <div class="btns"><button class="btn p" data-act="probar">Probar y sincronizar</button><button class="btn" data-act="desconectar">Desconectar</button></div>
    <div class="mute small">Estado: <b>${esc($("#sync")?.textContent || "")}</b></div></div>
  <h2 class="sec">Añadir fechas directamente a Google Calendar (opcional)</h2>
  <div class="card form"><p class="mute" style="margin:0">Sin esto, cada fecha se abre ya rellenada en Google Calendar y solo tienes que guardar. Con esto, se añaden con un toque y con aviso incluido, pidiéndote permiso en cada acción. Pasos: en <b>console.cloud.google.com</b> crea un proyecto, activa <b>Google Calendar API</b>, crea un <b>ID de cliente OAuth</b> de tipo <b>Aplicación web</b> con <b>${esc(location.origin)}</b> como origen autorizado, y añádete como usuario de prueba. Pega aquí el ID de cliente. Google avisará de que la app no está verificada: es normal en uso personal.</p>
    <label>ID de cliente de Google<input data-aj="g_client" placeholder="1234567890-abc.apps.googleusercontent.com" value="${esc(gId())}" autocapitalize="off" autocomplete="off"></label></div>
  <h2 class="sec">Apariencia</h2><div class="card"><div class="chips" style="margin-bottom:0">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([v, t]) => `<button class="chip" data-act="tema" data-v="${v}" aria-pressed="${tema === v}">${t}</button>`).join("")}</div></div>
  <h2 class="sec">Avisos en el móvil</h2><div class="card"><p style="margin:0">Cuando el radar detecta una convocatoria nueva, un cambio en una página oficial o el calendario de fiestas del año siguiente, abre un aviso (Issue) en tu repositorio. Instala <b>GitHub Mobile</b>, inicia sesión y activa las notificaciones de este repositorio. Además, suscribe tu calendario desde la sección <a href="${aRuta("calendario")}">Calendario</a>.</p></div>
  <h2 class="sec">Copia de seguridad</h2><div class="card"><div class="btns"><button class="btn" data-act="exportar">Exportar mi situación</button><label class="btn" style="cursor:pointer">Importar<input type="file" accept="application/json" data-act="importar" hidden></label></div></div>`;
}

/* ============ render y eventos ============ */
let toastT;
function aviso(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2600); }
function accionesBarra(r) {
  const f = $("#bFuentes"), a = $("#bAjustes");
  f.innerHTML = ico("pulse") + (hayAlertaFuentes() ? '<i class="punto"></i>' : ""); f.href = aRuta("fuentes"); f.toggleAttribute("aria-current", r === "fuentes");
  a.innerHTML = ico("cog"); a.href = aRuta("ajustes"); a.toggleAttribute("aria-current", r === "ajustes");
}
function navegacion() {
  const { r } = ruta(); const act = (k) => (k === r || (k === "procesos" && GRUPO_PROC.some(([g]) => g === r)) ? 'aria-current="page"' : "");
  $("#tabs").innerHTML = TABS.map((k) => `<a href="${aRuta(k)}" ${act(k)}><span class="pill">${ico(RUTAS[k][1])}</span>${esc(RUTAS[k][0].split(" ")[0])}</a>`).join("");
  $("#side").innerHTML = `<div class="brand"><img src="icon.svg" alt="">Radar Opos TIC</div>${LATERAL.map((k, i) => `${i === 4 ? '<div class="sep"></div>' : ""}<a href="${aRuta(k)}" ${k === r ? 'aria-current="page"' : ""}>${ico(RUTAS[k][1])}${esc(RUTAS[k][0])}</a>`).join("")}<div class="pie">${D.auto.generado ? "Revisión automática: " + esc(fmt(D.auto.generado)) : "Sin revisión automática todavía"}</div>`;
}
let rutaPrev = null;
function render() {
  const { r, p } = ruta(); P = construir();
  document.title = `${RUTAS[r][0]} · Radar Opos TIC`; $("#titulo").textContent = RUTAS[r][0];
  const atras = $("#atras"); atras.hidden = !SUB.includes(r); atras.innerHTML = ico("back"); atras.dataset.go = aRuta("inicio");
  const vista = { inicio: vInicio, procesos: vProcesos, comparar: vComparar, bolsas: vBolsas, historico: vHistorico, calendario: vCalendario, fuentes: vFuentes, ajustes: vAjustes }[r];
  const y = rutaPrev === r ? window.scrollY : 0; rutaPrev = r; const foco = document.activeElement?.dataset?.act === "buscar"; const pos = foco ? document.activeElement.selectionStart : 0;
  $("#vista").innerHTML = segmento(r) + vista(); navegacion(); accionesBarra(r); pintarSync();
  if (foco) { const s = $('[data-act="buscar"]'); s?.focus(); s?.setSelectionRange(pos, pos); }
  const wrap = $("#sheetWrap"); const proc = p && P.find((x) => x.id === p);
  if (proc) { $("#sheet").innerHTML = `<div class="grab"><i></i><button class="ibtn" data-act="cerrar" aria-label="Cerrar">${ico("close")}</button></div>${vDetalle(proc)}`; if (!wrap.classList.contains("on")) { wrap.classList.add("on"); $("#sheet").scrollTop = 0; document.body.style.overflow = "hidden"; } }
  else { wrap.classList.remove("on"); document.body.style.overflow = ""; }
  window.scrollTo(0, y);
}

document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  const a = e.target.closest("[data-act]");
  if (a && a.tagName !== "INPUT") {
    const act = a.dataset.act, v = a.dataset.v, id = a.dataset.id;
    if (act === "seguir") { e.preventDefault(); e.stopPropagation(); const s = !Sit.get(id).sigo; Sit.set(id, { sigo: s }); render(); aviso(s ? "Siguiendo este proceso" : "Dejaste de seguir"); return; }
    if (act === "fEstado") UI.fEstado = v; else if (act === "fAdmin") UI.fAdmin = v;
    else if (act === "cmp") { UI.cmp = UI.cmp.includes(v) ? UI.cmp.filter((x) => x !== v) : [...UI.cmp, v].slice(-4); }
    else if (act === "cerrar") { const { r } = ruta(); location.hash = aRuta(r); return; }
    else if (act === "tema") { lsSet("tema", v); aplicarTema(); }
    else if (act === "copiar") { navigator.clipboard?.writeText(v).then(() => aviso("Enlace copiado"), () => aviso("No se pudo copiar")); return; }
    else if (act === "probar") { Sit.iniciar().then(() => { if (Sit.conectada()) return Sit.push(); }).then(() => { aviso(Sit.estado === "ok" ? "Sincronizado con GitHub" : "No se pudo sincronizar: " + (Sit.error || "")); render(); }); return; }
    else if (act === "desconectar") { ["gh_token", "gh_repo"].forEach((k) => lsSet(k, "")); Sit.estado = "local"; Sit.sha = null; aviso("Desconectado"); }
    else if (act === "addcal" || act === "addcalTodo") {
      const pr = P.find((x) => x.id === a.dataset.pid); if (!pr) return;
      if (act === "addcal") anadirACalendario([eventoDe(pr, { fecha: a.dataset.f, etiqueta: a.dataset.e })]);
      else anadirACalendario(eventosFuturos(pr), `data/ics/${pr.id.replace(/\W+/g, "-")}.ics`);
      return;
    }
    else if (act === "addcalTodas") { anadirACalendario(P.filter((x) => x._e !== "cerrado").flatMap(eventosFuturos), "data/ics/todas.ics"); return; }
    else if (act === "addcalSigo") { const seg = P.filter((x) => Sit.get(x.id).sigo); anadirACalendario(seg.flatMap(eventosFuturos), "data/calendario.ics"); return; }
    else if (act === "exportar") { const b = new Blob([JSON.stringify(Sit.data, null, 1)], { type: "application/json" }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = "mi-situacion.json"; l.click(); return; }
    render(); return;
  }
  if (e.target.closest(".stat[data-filtro]")) { UI.fEstado = e.target.closest(".stat").dataset.filtro; return; }
  if (e.target.id === "scrim") { const { r } = ruta(); location.hash = aRuta(r); return; }
  if (go && !e.target.closest("a,button,input,select,textarea")) location.hash = go.dataset.go;
  if (e.target.closest("#atras")) location.hash = aRuta("inicio");
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.act === "buscar") { UI.q = t.value; render(); }
  else if (t.dataset.sit && t.type !== "checkbox" && t.tagName !== "SELECT") { const { p } = ruta(); if (p) Sit.set(p, { [t.dataset.sit]: t.value }); }
  else if (t.dataset.aj) lsSet(t.dataset.aj, t.value.trim());
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.sit) { const { p } = ruta(); if (p) { Sit.set(p, { [t.dataset.sit]: t.type === "checkbox" ? t.checked : t.value }); render(); } }
  else if (t.dataset.bolsa) { Sit.set("bolsa:" + t.dataset.bolsa, { inscrito: t.checked }); render(); }
  else if (t.dataset.act === "soloSigo") { UI.soloSigo = t.checked; lsSet("soloSigo", t.checked ? "1" : "0"); render(); }
  else if (t.dataset.act === "importar") { t.files[0]?.text().then((x) => { try { Sit.data = Sit.fusionar(Sit.data, JSON.parse(x)); lsSet("sit", JSON.stringify(Sit.data)); if (Sit.conectada()) Sit.push(); render(); aviso("Importado"); } catch { aviso("Archivo no válido"); } }); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#sheetWrap").classList.contains("on")) { const { r } = ruta(); location.hash = aRuta(r); } });
window.addEventListener("hashchange", render);
$("#refrescar").innerHTML = ico("refresh");
$("#refrescar").addEventListener("click", async () => { aviso("Actualizando…"); await cargar(); await Sit.iniciar(); render(); aviso("Datos al día"); });
function aplicarTema() { const t = lsGet("tema", "auto"); if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }
aplicarTema();

await cargar(); render(); Sit.iniciar().then(render);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
