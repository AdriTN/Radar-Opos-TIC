// Genera un calendario iCalendar (suscribible) con las fechas de los procesos seguidos.
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const plegar = (l) => (l.length <= 74 ? l : l.match(/.{1,73}/g).join("\r\n "));
const dia = (iso) => iso.replaceAll("-", "");
const sig = (iso) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replaceAll("-", ""); };

// Aspecto de cada tipo de fecha (emoji + color de Google Calendar + categoría). Se usa en servidor y en la app.
export function decorarEvento(etiqueta) {
  const t = String(etiqueta).toLowerCase();
  if (/fin del plazo|cierra la inscripci/.test(t)) return { emoji: "⏰", color: "11", cat: "Plazo" };
  if (/ejercicio|examen|prueba/.test(t)) return { emoji: "📝", color: "9", cat: "Examen" };
  if (/abre la inscripci/.test(t)) return { emoji: "🟢", color: "10", cat: "Inscripción" };
  if (/lista|aprobados|resultado|nota/.test(t)) return { emoji: "📋", color: "5", cat: "Resultados" };
  if (/public|convocatoria|oep|aprobada/.test(t)) return { emoji: "📣", color: "8", cat: "Publicación" };
  return { emoji: "📅", color: "7", cat: "Fecha" };
}
export function datosEvento(etiqueta, titulo, url, extra = "") {
  const d = decorarEvento(etiqueta), t = String(titulo);
  const corto = t.length > 45 ? t.slice(0, 44) + "…" : t;
  const largo = t.length > 110 ? t.slice(0, 109) + "…" : t;
  const linea = String(extra).split("\n").filter(Boolean).slice(0, 2).join(" · ");
  return { resumen: corto ? `${d.emoji} ${etiqueta} · ${corto}` : `${d.emoji} ${etiqueta}`, categoria: d.cat, color: d.color,
    descripcion: [largo, linea, url].filter(Boolean).join("\n") };
}

export function generarICS(eventos, ahoraISO, nombre = "Radar oposiciones TIC") {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radar-Opos-TIC//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(nombre)}`, "X-WR-TIMEZONE:Atlantic/Canary", "REFRESH-INTERVAL;VALUE=DURATION:PT12H"];
  const stamp = ahoraISO.replace(/[-:]/g, "").replace(/\.\d+/, "");
  for (const e of eventos) {
    L.push("BEGIN:VEVENT", `UID:${e.uid}@radar-opos-tic`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dia(e.fecha)}`, `DTEND;VALUE=DATE:${sig(e.fecha)}`,
      `SUMMARY:${esc(e.resumen)}`, ...(e.descripcion ? [`DESCRIPTION:${esc(e.descripcion)}`] : []), ...(e.url ? [`URL:${e.url}`] : []), ...(e.categoria ? [`CATEGORIES:${esc(e.categoria)}`] : []), "TRANSP:TRANSPARENT");
    // Avisos: 7 días antes a las 09:00 y la víspera a las 09:00
    for (const t of ["-P6DT15H", "-PT15H"]) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.resumen)}`, `TRIGGER:${t}`, "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(plegar).join("\r\n") + "\r\n";
}
