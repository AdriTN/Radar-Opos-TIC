import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { procesarDia, sumarHabiles, clasificar, esTIC } from "../scripts/update.mjs";

const cfg = JSON.parse(readFileSync(new URL("../config.json", import.meta.url)));

// Forma simplificada del sumario del BOE: item como objeto suelto o lista, epígrafe como objeto o lista.
const sumario = {
  data: { sumario: { diario: { seccion: [
    { codigo: "1", departamento: [] },
    { codigo: "2B", departamento: [
      { nombre: "MINISTERIO PARA LA TRANSFORMACIÓN DIGITAL Y DE LA FUNCIÓN PÚBLICA", epigrafe: {
        nombre: "Cuerpos y escalas", item: [
          { identificador: "BOE-A-2026-90001", titulo: "Resolución de 1 de octubre de 2026, de la Secretaría de Estado de Función Pública, por la que se convoca proceso selectivo para ingreso en el Cuerpo de Gestión de Sistemas e Informática de la Administración del Estado.", url_pdf: { texto: "/boe/dias/2026/10/05/pdfs/BOE-A-2026-90001.pdf" } },
          { identificador: "BOE-A-2026-90002", titulo: "Resolución por la que se convoca proceso selectivo de Cuerpo de Bibliotecas." },
        ] } },
      { nombre: "ADMINISTRACIÓN LOCAL", item: { identificador: "BOE-A-2026-90003", titulo: "Resolución de 2 de octubre de 2026, del Ayuntamiento de Telde (Las Palmas), referente a la convocatoria para proveer una plaza de Técnico de Informática." } },
      { nombre: "ADMINISTRACIÓN LOCAL", item: { identificador: "BOE-A-2026-90004", titulo: "Resolución del Ayuntamiento de Valladolid, referente a la convocatoria para proveer una plaza de Técnico de Informática." } },
      { nombre: "COMUNIDAD AUTÓNOMA DE ANDALUCÍA", item: { identificador: "BOE-A-2026-90005", titulo: "Resolución por la que se convoca una plaza de Analista Programador." } },
      { nombre: "COMUNIDAD AUTÓNOMA DE CANARIAS", item: { identificador: "BOE-A-2026-90006", titulo: "Resolución por la que se publica la lista provisional de admitidos del Cuerpo de Técnicos en Tecnologías de la Información." } },
    ] },
  ] } } },
};

test("filtra por TIC y ámbito, y clasifica", () => {
  const r = procesarDia(sumario, "2026-10-05", cfg);
  assert.deepEqual(r.map((x) => x.id), ["BOE-A-2026-90001", "BOE-A-2026-90003", "BOE-A-2026-90006"]);
  assert.equal(r[0].tipo, "convocatoria");
  assert.equal(r[0].admin, "AGE");
  assert.equal(r[1].admin, "Local (Canarias)");
  assert.equal(r[2].tipo, "listas");
  assert.equal(r[0].plazoEstimado, "2026-11-02"); // 20 hábiles desde lunes 5/10/2026
});

test("sumarHabiles salta fines de semana", () => {
  assert.equal(sumarHabiles("2026-10-02", 1), "2026-10-05"); // viernes -> lunes
  assert.equal(sumarHabiles("2026-10-05", 5), "2026-10-12");
});

test("esTIC no confunde siglas cortas", () => {
  assert.equal(esTIC("Plaza de técnico TIC", cfg.palabrasTIC), true);
  assert.equal(esTIC("Plaza de Auxiliar de Biblioteca", cfg.palabrasTIC), false);
});

test("clasificar", () => {
  assert.equal(clasificar("Oferta de empleo público para 2026"), "oep");
  assert.equal(clasificar("Resolución por la que se convoca proceso"), "convocatoria");
  assert.equal(clasificar("Tribunal calificador: fecha del primer ejercicio"), "tramite");
});
