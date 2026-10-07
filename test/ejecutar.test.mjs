import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ejecutar } from "../scripts/update.mjs";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const sumario = { data: { sumario: { diario: { seccion: [{ codigo: "2B", departamento: [
  { nombre: "MINISTERIO PARA LA TRANSFORMACIÓN DIGITAL Y DE LA FUNCIÓN PÚBLICA", item: { identificador: "BOE-A-2026-90001", titulo: "Resolución de 1 de octubre de 2026, por la que se convoca proceso selectivo para ingreso en el Cuerpo de Gestión de Sistemas e Informática." } },
] }] } } } };
const xml = `<documento><texto><p>El plazo de presentación de solicitudes será de veinte días hábiles contados a partir del día siguiente al de la publicación.</p><p>Los derechos de examen serán de 31,10 euros. Se convocan 120 plazas de acceso libre. Subgrupo A2.</p></texto></documento>`;
const indice = `<h2>Miércoles 7 de octubre de 2026</h2><a href="https://sede.gobiernodecanarias.org/boc/boc-a-2026-170-2001.pdf">Dirección General de la Función Pública.- Resolución por la que se convocan pruebas selectivas de personal funcionario de carrera, por el sistema general de acceso libre.</a>`;
const sueldos = "A1 1.328,66 51,16\nA2 1.148,77 41,66\nB 1.004,16 36,57\nC1 862,71 31,50\nC2 718,06 21,45\n";
const es = (n) => n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cd = Array.from({ length: 30 }, (_, i) => `${30 - i}  ${es(1200 - i * 35)}`).join("\n");

function crearRed(pagina = "v1") {
  return { async get(url, o = {}) {
    if (url.includes("/sumario/20261005")) return sumario;
    if (url.includes("/sumario/")) return o.aceptar404 ? null : (() => { throw new Error("404"); })();
    if (url.includes("xml.php")) return xml;
    if (/boc\/2026\/170\/index/.test(url)) return indice;
    if (/boc\/2026\/17[1-9]\/index/.test(url) || /boc\/2027/.test(url)) return null;
    if (/boc\/2026\/170\/2001\.html/.test(url)) return "<p>El plazo será de veinte (20) días hábiles a partir del día siguiente. Tasa: derechos de examen 15,00 euros.</p>";
    if (url.endsWith(".pdf")) return Buffer.from(url.includes("Cuant") ? "CD" : url.includes("Retribuciones-") ? "CAN" : "SUELDOS");
    if (url.includes("RetribucionesPersonalFuncionario.aspx")) return `<a href="/x/A%C3%91O%202026/Retribuciones%20del%20personal%20funcionario%202026.pdf">r</a><a href="/x/Cuant%C3%ADas%20retributivas%202026.pdf">c</a>`;
    return `<html><body>Página ${pagina}</body></html>`;
  } };
}
const pdf = async (b) => (b.toString() === "CD" ? cd : sueldos);

async function preparar() {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-test-"));
  await mkdir(path.join(dir, "data"));
  await copyFile(path.join(AQUI, "../config.json"), path.join(dir, "config.json"));
  await writeFile(path.join(dir, "data/seed.json"), JSON.stringify({ procesos: [{ id: "p1", titulo: "Proceso 1", estado: "en_curso", boeId: "BOE-A-2025-25938", fechaPublicacion: "2025-12-18", fechas: [{ fecha: "2026-10-20", etiqueta: "Primer ejercicio" }], enlaces: [] }] }));
  return dir;
}
const j = async (d, n) => JSON.parse(await readFile(path.join(d, "data", n), "utf8"));
const ahora = new Date("2026-10-07T05:00:00Z");

test("ejecución completa con fuentes simuladas", async () => {
  const dir = await preparar();
  const r = await ejecutar({ raiz: dir, red: crearRed(), pdf, ahora });
  const auto = await j(dir, "auto.json");
  const boe = auto.items.find((i) => i.id === "BOE-A-2026-90001");
  assert.equal(boe.tipo, "convocatoria");
  assert.equal(boe.plazo.fuente, "texto"); assert.equal(boe.plazo.fin, "2026-11-03"); // 20 hábiles desde 5/10/2026, sin contar el festivo del 12/10
  assert.deepEqual(boe.datos.tasas, [31.1]); assert.equal(boe.datos.grupo, "A2");
  const boc = auto.items.find((i) => i.fuente === "BOC");
  assert.equal(boc.revisarAnexo, true); assert.equal(boc.plazo.fuente, "texto"); assert.equal(boc.plazo.fin, "2026-11-05"); // 20 hábiles desde el 7/10/2026
  assert.deepEqual(auto.boc, { anio: 2026, num: 170 });
  const ret = await j(dir, "retribuciones.json");
  assert.equal(ret.ambitos.AGE.sueldos.grupos.A1.sueldoMensual, 1328.66);
  assert.equal(Object.keys(ret.ambitos.AGE.complementoDestino.niveles).length, 30);
  const sd = await j(dir, "seed-datos.json");
  assert.equal(sd.p1.plazo.fin, "2026-01-20");
  const hist = await j(dir, "historico.json");
  assert.ok(hist.convocatorias["BOE-A-2026-90001"]);
  assert.match(await readFile(path.join(dir, "data/calendario.ics"), "utf8"), /Primer ejercicio/);
  const salud = await j(dir, "salud.json");
  assert.equal(salud.fuentes.boe.ok, true); assert.equal(salud.fuentes.boc.ok, true);
  assert.ok(r.avisos >= 2);
  assert.match(await readFile(path.join(dir, "data/nuevos.md"), "utf8"), /revisa el anexo/);
});

test("segunda ejecución: sin duplicados, detecta cambio de página y conserva retribuciones si falla la validación", async () => {
  const dir = await preparar();
  await ejecutar({ raiz: dir, red: crearRed("v1"), pdf, ahora });
  const pdfRoto = async () => "texto sin tablas";
  const r2 = await ejecutar({ raiz: dir, red: crearRed("v2"), pdf: pdfRoto, ahora: new Date("2026-10-08T05:00:00Z") });
  const auto = await j(dir, "auto.json");
  assert.equal(auto.items.filter((i) => i.id === "BOE-A-2026-90001").length, 1);
  const watch = await j(dir, "watch.json");
  assert.ok(Object.values(watch.paginas).every((p) => p.cambio));
  const ret = await j(dir, "retribuciones.json");
  assert.equal(ret.ambitos.AGE.sueldos.grupos.A1.sueldoMensual, 1328.66); // se conserva
  const salud = await j(dir, "salud.json");
  assert.equal(salud.fuentes["retrib:age:sueldos"].ok, false); assert.equal(salud.fuentes["retrib:age:sueldos"].fallosSeguidos, 1);
  assert.ok(r2.errores.length > 0);
});
