import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ejecutar } from "../scripts/update.mjs";
import { sumarHabiles } from "../scripts/lib/festivos.mjs";
import { ajustesDeFiestas, nacional, seccion } from "../scripts/lib/fiestas.mjs";
import { datosEvento, decorarEvento } from "../scripts/lib/ics.mjs";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const TEXTO_FIESTAS = `Resolución de 14 de octubre de 2026, por la que se publica la relación de fiestas laborales para el año 2027.
Fiestas nacionales: 1 de enero, 6 de enero, 26 de marzo, 1 de mayo, 15 de agosto, 12 de octubre, 1 de noviembre, 6 de diciembre, 8 de diciembre, 25 de diciembre.
Canarias
1 de enero, 6 de enero, 25 de marzo, 26 de marzo, 1 de mayo, 30 de mayo, 15 de agosto, 12 de octubre, 1 de noviembre, 8 de diciembre, 25 de diciembre, 3 de mayo.
Cantabria
28 de julio, 15 de septiembre`;

test("ajustesDeFiestas solo añade festivos laborables y desconfía de lo raro", () => {
  const r = ajustesDeFiestas(nacional(TEXTO_FIESTAS), seccion(TEXTO_FIESTAS, "Canarias"), 2027);
  assert.deepEqual(r.ajustes.CAN.anadir, ["2027-05-03"]); assert.deepEqual(r.ajustes.ES.anadir, []);
  const raro = ajustesDeFiestas(null, "1 de enero, 2 de enero, 3 de enero", 2027);
  assert.deepEqual(raro.ajustes, {}); assert.ok(raro.avisos.length > 0);
  const demasiados = ajustesDeFiestas(null, TEXTO_FIESTAS + " 2 de febrero, 3 de febrero, 4 de febrero, 5 de febrero, 8 de febrero", 2027);
  assert.deepEqual(demasiados.ajustes, {});
});

test("decoración de eventos de calendario", () => {
  assert.equal(decorarEvento("Fin del plazo de solicitudes").color, "11");
  assert.equal(decorarEvento("Primer ejercicio").emoji, "📝");
  const e = datosEvento("Segundo ejercicio", "Cuerpo GSI", "https://x.es");
  assert.match(e.resumen, /^📝 Segundo ejercicio · Cuerpo GSI/); assert.match(e.descripcion, /https:\/\/x.es/);
});

const sumario = { data: { sumario: { diario: { seccion: [{ codigo: "3", departamento: [{ nombre: "MINISTERIO DE TRABAJO Y ECONOMÍA SOCIAL", item: { identificador: "BOE-A-2026-80001", titulo: "Resolución de 14 de octubre de 2026, por la que se publica la relación de fiestas laborales para el año 2027." } }] }] } } } };
function red() {
  return { async get(url, o = {}) {
    if (url.includes("/sumario/20261014")) return sumario;
    if (url.includes("/sumario/")) return o.aceptar404 ? null : (() => { throw new Error("404"); })();
    if (url.includes("xml.php")) return `<documento><texto><p>${TEXTO_FIESTAS.replace(/\n/g, "</p><p>")}</p></texto></documento>`;
    if (/boc\//.test(url) && url.includes("index")) return null;
    if (url.endsWith(".pdf")) throw new Error("sin pdf");
    return "<html>x</html>";
  } };
}
async function preparar(seed, mi) {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-auto-"));
  await mkdir(path.join(dir, "data"));
  await copyFile(path.join(AQUI, "../config.json"), path.join(dir, "config.json"));
  await writeFile(path.join(dir, "data/seed.json"), JSON.stringify(seed));
  if (mi) await writeFile(path.join(dir, "data/mi-situacion.json"), JSON.stringify(mi));
  return dir;
}
const j = async (d, n) => JSON.parse(await readFile(path.join(d, "data", n), "utf8"));

test("el calendario oficial de fiestas se aplica solo y cambia los plazos siguientes", async () => {
  const dir = await preparar({ procesos: [] });
  await ejecutar({ raiz: dir, red: red(), pdf: async () => "", ahora: new Date("2026-10-14T05:00:00Z") });
  const of = await j(dir, "festivos-oficiales.json");
  assert.deepEqual(of.anios["2027"].CAN.anadir, ["2027-05-03"]);
  const md = await readFile(path.join(dir, "data/nuevos.md"), "utf8");
  assert.match(md, /festivos.*ya aplicado/);
  assert.equal((await j(dir, "salud.json")).fuentes["fiestas:BOE-A-2026-80001"].ok, true);
  // el festivo ya forma parte del cálculo de plazos
  const extra = { 2027: { CAN: { anadir: of.anios["2027"].CAN.anadir } } };
  assert.notEqual(sumarHabiles("2027-04-30", 1, "CAN", extra), sumarHabiles("2027-04-30", 1, "CAN", {}));
});

test("recordatorios automáticos: solo de lo que sigues y respetando tu estado", async () => {
  const seed = { procesos: [
    { id: "a", titulo: "Proceso A", estado: "en_curso", fechas: [{ fecha: "2026-10-10", etiqueta: "Primer ejercicio" }, { fecha: "2026-10-10", etiqueta: "Fin del plazo de solicitudes" }], enlaces: [{ url: "https://a.es" }] },
    { id: "b", titulo: "Proceso B", estado: "en_curso", fechas: [{ fecha: "2026-10-10", etiqueta: "Primer ejercicio" }], enlaces: [] },
    { id: "c", titulo: "Proceso C", estado: "en_curso", fechas: [{ fecha: "2026-10-08", etiqueta: "Fin del plazo de solicitudes" }], enlaces: [] }] };
  const mi = { procesos: { a: { sigo: true, estado: "pendiente" }, c: { sigo: true, estado: "inscrito" } } };
  const dir = await preparar(seed, mi);
  const r = await ejecutar({ raiz: dir, red: red(), pdf: async () => "", ahora: new Date("2026-10-07T05:00:00Z") });
  const md = await readFile(path.join(dir, "data/nuevos.md"), "utf8");
  assert.match(md, /recordatorio.*Primer ejercicio es en 3 días.*Proceso A/);
  assert.match(md, /recordatorio.*Fin del plazo de solicitudes es en 3 días.*Proceso A/);
  assert.doesNotMatch(md, /Proceso B/);          // no lo sigues
  assert.doesNotMatch(md, /Proceso C/);          // ya estás inscrito: no se recuerda el fin de plazo
  assert.ok(r.avisos >= 2);
  const ics = await readFile(path.join(dir, "data/calendario.ics"), "utf8");
  assert.match(ics, /Proceso A/); assert.doesNotMatch(ics, /Proceso B/);
});
