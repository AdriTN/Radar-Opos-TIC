import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sumarHabiles, esFestivo, pascua } from "../scripts/lib/festivos.mjs";
import { extraerPlazo, extraerTasas, extraerPlazas, extraerNotaCorte, extraerEnlaces, extraerGrupo } from "../scripts/lib/texto.mjs";
import { procesarDia, clasificar, calcularPlazo } from "../scripts/lib/boe.mjs";
import { parsearIndice, filtrarBOC, fechaDeIndice } from "../scripts/lib/boc.mjs";
import { parsearSueldos, parsearComplementoDestino } from "../scripts/lib/retribuciones.mjs";
import { generarICS } from "../scripts/lib/ics.mjs";

const cfg = JSON.parse(readFileSync(new URL("../config.json", import.meta.url)));

test("Pascua y festivos", () => {
  assert.equal(pascua(2026).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(esFestivo("2026-04-03", "ES"), true);           // Viernes Santo
  assert.equal(esFestivo("2026-04-02", "ES"), false);          // Jueves Santo no es nacional
  assert.equal(esFestivo("2026-04-02", "CAN"), true);          // sí en Canarias
  assert.equal(esFestivo("2026-05-30", "CAN"), true);          // Día de Canarias
  assert.equal(esFestivo("2026-11-02", "ES", { 2026: { ES: { anadir: ["2026-11-02"] } } }), true); // traslado manual
});

test("sumarHabiles descuenta fines de semana y festivos (caso real: BOE 30/09/2026 → 29/10/2026)", () => {
  assert.equal(sumarHabiles("2026-09-30", 20, "ES"), "2026-10-29");
  assert.equal(sumarHabiles("2025-12-18", 20, "ES"), "2026-01-20");
  assert.equal(sumarHabiles("2026-10-02", 1), "2026-10-05");
});

test("extraerPlazo", () => {
  assert.deepEqual(extraerPlazo("El plazo de presentación de solicitudes será de veinte días hábiles contados a partir del día siguiente al de la publicación."), { dias: 20, tipo: "habiles", desdeSiguiente: true });
  assert.equal(extraerPlazo("plazo de veinte (20) días hábiles, contados a partir del día siguiente a la publicación").dias, 20);
  assert.equal(extraerPlazo("el plazo será de 10 días naturales").tipo, "naturales");
  assert.equal(extraerPlazo("Las solicitudes se podrán presentar hasta el 29 de octubre de 2026.").fin, "2026-10-29");
  assert.equal(extraerPlazo("sin plazo"), null);
});

test("extraerTasas, plazas, grupo, enlaces, nota", () => {
  const t = "Los derechos de examen serán de 31,10 euros para turno libre y 15,55 euros para promoción interna. Acceso libre: 290 plazas (267 general + 23 discapacidad). Subgrupo A1. Inscripción: https://ips.redsara.es/IPSC/secure/buscarConvocatorias. Cuota 99,99 euros del seguro.";
  assert.deepEqual(extraerTasas(t), [31.1, 15.55]);
  assert.ok(extraerPlazas(t)[0].startsWith("290 plazas"));
  assert.equal(extraerGrupo(t), "A1");
  assert.deepEqual(extraerEnlaces(t), ["https://ips.redsara.es/IPSC/secure/buscarConvocatorias"]);
  assert.equal(extraerNotaCorte("La nota mínima de aprobado se fija en 26,79 puntos."), 26.79);
});

const sumario = { data: { sumario: { diario: { seccion: [
  { codigo: "3", departamento: [{ nombre: "MINISTERIO DE TRABAJO", item: { identificador: "BOE-A-2026-80001", titulo: "Resolución por la que se publica la relación de fiestas laborales para el año 2027." } }] },
  { codigo: "2B", departamento: [
    { nombre: "MINISTERIO PARA LA TRANSFORMACIÓN DIGITAL Y DE LA FUNCIÓN PÚBLICA", epigrafe: { nombre: "x", item: [
      { identificador: "BOE-A-2026-90001", titulo: "Resolución de 1 de octubre de 2026, por la que se convoca proceso selectivo para ingreso en el Cuerpo de Gestión de Sistemas e Informática.", url_pdf: { texto: "/p.pdf" } },
      { identificador: "BOE-A-2026-90002", titulo: "Resolución por la que se convoca proceso selectivo de Cuerpo de Bibliotecas." }] } },
    { nombre: "ADMINISTRACIÓN LOCAL", item: { identificador: "BOE-A-2026-90003", titulo: "Resolución del Ayuntamiento de Telde (Las Palmas), referente a la convocatoria para proveer una plaza de Técnico de Informática." } },
    { nombre: "ADMINISTRACIÓN LOCAL", item: { identificador: "BOE-A-2026-90004", titulo: "Resolución del Ayuntamiento de Valladolid, convocatoria de Técnico de Informática." } },
    { nombre: "COMUNIDAD AUTÓNOMA DE ANDALUCÍA", item: { identificador: "BOE-A-2026-90005", titulo: "Resolución por la que se convoca una plaza de Analista Programador." } },
    { nombre: "MINISTERIO DE HACIENDA", item: { identificador: "BOE-A-2026-90006", titulo: "Resolución por la que se hace pública la lista de empleo de funcionarios interinos del Cuerpo de Gestión de Sistemas e Informática." } },
  ] }] } } } };

test("procesarDia BOE: filtra, clasifica y detecta bolsas y festivos", () => {
  const r = procesarDia(sumario, "2026-10-05", cfg);
  assert.deepEqual(r.map((x) => [x.id, x.tipo, x.admin]), [
    ["BOE-A-2026-80001", "festivos", "AGE"], ["BOE-A-2026-90001", "convocatoria", "AGE"],
    ["BOE-A-2026-90003", "convocatoria", "Local (Canarias)"], ["BOE-A-2026-90006", "bolsa", "AGE"]]);
  assert.equal(clasificar("Tribunal calificador: fecha del primer ejercicio"), "tramite");
});

test("calcularPlazo: oficial (texto) vs estimado", () => {
  const it = { fecha: "2026-09-30", ambito: "ES" };
  assert.deepEqual(calcularPlazo(it, { plazo: { dias: 20, tipo: "habiles" } }), { dias: 20, tipo: "habiles", desde: "2026-09-30", fin: "2026-10-29", fuente: "texto" });
  assert.equal(calcularPlazo(it, null).fuente, "estimado");
});

const indiceBOC = `<html><body><h2>Martes 24 de marzo de 2026</h2>
<h3>948 Consejería de Presidencia</h3><p><a href="https://sede.gobiernodecanarias.org/boc/boc-a-2026-057-948.pdf">Dirección General de la Función Pública.- Resolución de 13 de marzo de 2026, por la que se convocan pruebas selectivas de personal funcionario de carrera de la Administración General de la Comunidad Autónoma de Canarias, para ingresar, por el sistema general de acceso libre, en determinados Cuerpos, Escalas y/o Especialidades.</a> <a href="https://sede.gobiernodecanarias.org/boc/boc-a-2026-057-948.pdf">Descargar</a></p>
<p><a href="/boc/boc-a-2026-057-950.pdf">Universidad de La Laguna.- RESOLUCIÓN por la que se convoca contratación de Profesor Asociado en Ciencias de la Salud.</a></p>
<p><a href="https://sede.gobiernodecanarias.org/boc/boc-a-2026-057-951.pdf">Servicio Canario de la Salud.- Resolución por la que se convoca una lista de empleo de Técnico de Informática del Servicio Canario de la Salud.</a></p></body></html>`;

test("BOC: índice, genéricas de Función Pública y fecha", () => {
  const items = parsearIndice(indiceBOC);
  assert.equal(items.length, 3);
  const r = filtrarBOC(items, fechaDeIndice(indiceBOC), cfg);
  assert.equal(fechaDeIndice(indiceBOC), "2026-03-24");
  assert.deepEqual(r.map((x) => [x.id, x.tipo, !!x.revisarAnexo]), [["BOC-A-2026-057-948", "convocatoria", true], ["BOC-A-2026-057-951", "bolsa", false]]);
  assert.equal(r[0].url, "https://www.gobiernodecanarias.org/boc/2026/057/948.html");
});

const textoSueldos = `
                         SUELDO      UN TRIENIO    SUELDO     UN TRIENIO
GRUPO A1                1.328,66      51,16         1.328,66   51,16
GRUPO A2                1.148,77      41,66         1.148,77   41,66
GRUPO B                 1.004,16      36,57         1.004,16   36,57
GRUPO C1                  862,71      31,50           862,71   31,50
GRUPO C2                  718,06      21,45           718,06   21,45`;
const es = (n) => n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const textoCD = Array.from({ length: 30 }, (_, i) => `   ${30 - i}      ${es(1200 - i * 35)}`).join("\n");

test("Retribuciones: parseo y validación", () => {
  const r = parsearSueldos(textoSueldos.replace(/GRUPO /g, ""));
  assert.equal(r.ok, true);
  assert.equal(r.sueldos.A2.sueldoMensual, 1148.77);
  assert.equal(parsearSueldos("A1 99.999,00 5,00\nA2 1.148,77 41,66").ok, false); // fuera de rango
  const cd = parsearComplementoDestino(textoCD);
  assert.equal(cd.ok, true); assert.equal(Object.keys(cd.niveles).length, 30);
  assert.equal(parsearComplementoDestino("30 1.000,00\n29 1.100,00").ok, false);
});

test("ICS válido con avisos", () => {
  const ics = generarICS([{ uid: "a", fecha: "2026-10-29", resumen: "Fin del plazo, GSI; prueba", url: "https://x.es" }], "2026-10-07T05:00:00.000Z");
  assert.match(ics, /DTSTART;VALUE=DATE:20261029/); assert.match(ics, /DTEND;VALUE=DATE:20261030/);
  assert.match(ics, /SUMMARY:Fin del plazo\\, GSI\; prueba/); assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
