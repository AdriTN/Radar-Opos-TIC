# Radar de oposiciones TIC

Web app (PC y móvil, instalable) con convocatorias, plazos y fechas de oposiciones de informática: AGE, Gobierno de Canarias y Gran Canaria. Se actualiza sola cada día con GitHub Actions. Sin API de pago y sin servidor.

## Cómo funciona

- `data/seed.json`: procesos que sigo a mano (calendario, enlaces, notas). Es lo único que editas tú.
- `scripts/update.mjs`: cada día lee el sumario del BOE (sección II.B), se queda con lo TIC de AGE/Canarias/Las Palmas, calcula el plazo aproximado (20 días hábiles) y vigila las páginas oficiales de `config.json` para avisar cuando cambian.
- `.github/workflows/actualizar.yml`: ejecuta lo anterior a diario, guarda `data/auto.json` y `data/watch.json`, abre un Issue si hay novedades (GitHub te lo notifica en el móvil) y publica la web en GitHub Pages.

## Puesta en marcha (una vez)

1. Crea un repositorio **público** en GitHub (Pages en repos privados exige plan de pago; aquí solo hay información pública) y sube esta carpeta a la rama `main`.
2. En el repo: *Settings → Pages → Source: GitHub Actions*.
3. En *Actions → Actualizar radar y publicar → Run workflow* para la primera ejecución.
4. Abre la URL de Pages en el móvil → menú del navegador → *Añadir a pantalla de inicio*.
5. Activa las notificaciones de GitHub Mobile para el repo si quieres el aviso de novedades.

## Mantenimiento

- Cuando se publique una convocatoria nueva, añade un bloque en `data/seed.json` (copia uno existente). Las fechas con `"fecha": null` se muestran como texto.
- Para ampliar palabras clave, regiones o páginas vigiladas, edita `config.json`.
- Tests: `node --test test/update.test.mjs`.

## Límites conocidos

- El BOE no recoge todo: el BOC y los boletines de Canarias o de la provincia no tienen API estable, así que se vigilan como páginas (te dicen *que* cambió, no *qué*).
- Los plazos “aprox.” no descuentan festivos. Confirma siempre en las bases.
