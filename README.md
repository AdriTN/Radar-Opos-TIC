# Radar Opos TIC

App web instalable (móvil y PC) con convocatorias, plazos, bolsas de empleo, comparador de plazas con retribuciones oficiales e histórico de oposiciones de informática: AGE, Gobierno de Canarias y Gran Canaria. Se actualiza sola cada día con GitHub Actions. Sin API de pago ni servidor.

## Qué hace

- **Inicio**: próxima fecha, avisos que te afectan (plazos que vencen, convocatorias generales que pueden incluir TI, páginas oficiales que cambiaron), tus procesos y novedades.
- **Procesos**: fichas con calendario, datos oficiales (plazas, tasa, titulación, sueldo base), botón de inscripción y *mi situación* (sigo / inscrito / nota / notas).
- **Comparar**: hasta 4 procesos en columnas; cada dato indica su fuente y fecha.
- **Bolsas**: listas de empleo de Canarias y vigilancia de interinos de la AGE.
- **Histórico**: convocatorias anteriores con plazas, tasas, notas de corte y resultados.
- **Calendario**: enlace de suscripción (.ics) y botón para añadir fechas directamente a tu calendario (Google Calendar con tu permiso, o .ics para Apple/Outlook), con emoji y color por tipo y avisos 7 días y 1 día antes.
- **Fuentes y salud**: qué lecturas funcionan y cuáles fallan.

## Cómo se actualiza

`scripts/update.mjs` se ejecuta cada día en GitHub Actions:

1. **BOE**: API abierta del sumario (secciones II.B y III). Filtra TIC en AGE, Canarias y provincia de Las Palmas, lee el texto y extrae plazo, plazas, tasas y titulación. El plazo se calcula con días hábiles reales (sin sábados, domingos ni festivos).
2. **BOC**: lee el índice de cada número. Las convocatorias generales de Función Pública (que no nombran la especialidad) se marcan “revisa el anexo”.
3. **Retribuciones**: descubre y lee los PDF oficiales de Hacienda (AGE) y de la Consejería de Hacienda de Canarias. Cada tabla pasa una validación (rangos y orden A1>A2>B>C1>C2, niveles decrecientes); si falla, se conserva el último dato válido y se avisa.
4. **Páginas vigiladas** (`config.json`): detecta cambios en las fichas del INAP, Función Pública y Canarias.
5. Genera `data/calendario.ics`, acumula `data/historico.json` y escribe `data/salud.json`.
6. **Recordatorios automáticos**: de lo que sigues, abre un Issue cuando faltan 7, 3, 1 o 0 días para un plazo o examen (no recuerda el fin de plazo si ya figuras como inscrito). También avisa de convocatorias, listas, bolsas y cambios en páginas oficiales. GitHub Mobile te lo notifica.
7. **Festivos**: cuando el BOE (o el BOC) publica el calendario de fiestas del año siguiente, se lee, se valida (solo se aceptan festivos laborables nuevos y pocos) y se aplica solo a todos los plazos. Si algo no cuadra, no se aplica y te lo dice.

## Puesta en marcha

0. El workflow se ejecuta al subir cambios a **master**, cada día a las ~06:17 y a mano desde Actions.
1. Crea un repositorio **público** (Pages en privado exige plan de pago) llamado `Radar-Opos-TIC` y sube esta carpeta a `master`.
2. *Settings → Pages → Source: GitHub Actions*.
3. *Actions → Actualizar radar y publicar → Run workflow* (primera lectura; tarda unos minutos porque recorre ~45 días de BOE y los números recientes del BOC).
4. Abre la URL de Pages en el móvil y añádela a la pantalla de inicio.
5. Instala GitHub Mobile y activa las notificaciones del repositorio.

## Añadir fechas directo a Google Calendar (opcional)

Sin configurar nada, cada fecha tiene un botón que abre el evento ya relleno en Google Calendar (guardas con un toque) y otro para descargar un `.ics`. Para que se añadan directamente, con color, avisos y sin duplicados, y pidiéndote permiso en cada acción: crea un ID de cliente OAuth (tipo *Aplicación web*, origen = la URL de tu Pages) con la API de Google Calendar activada y pégalo en *Ajustes*.

## Sincronizar “mi situación” entre dispositivos

En la app: *Ajustes → Sincronizar*. Crea un token fino de GitHub limitado a este repositorio con permiso **Contents: Read and write** y pégalo, junto con `usuario/Radar-Opos-TIC`, en cada dispositivo. Los datos se guardan en `data/mi-situacion.json`. Al ser un repositorio público, **no escribas datos sensibles** en las notas.

## Mantenimiento

- Procesos manuales y verificados: `data/seed.json` (añade `boeId` o `bocUrl` y `fechaPublicacion` para que el radar lea plazo, tasas y titulación del texto oficial).
- Festivos: se calculan con las reglas oficiales (nacionales y Canarias) y se completan solos con el calendario oficial de cada año. `data/festivos-extra.json` queda solo para casos manuales (festivos locales).
- Palabras clave, regiones y páginas vigiladas: `config.json`.
- Tests: `node --test test/update.test.mjs test/ejecutar.test.mjs test/automatico.test.mjs`.

## Límites conocidos

- No hay API del BOP de Las Palmas: sus convocatorias locales llegan por el extracto del BOE.
- La jornada (continua o partida) la fija el puesto, no la convocatoria, así que no se puede leer de forma oficial en el proceso selectivo.
- Las lecturas del BOC y de los PDF de retribuciones dependen del formato de cada web; si cambia, la sección *Fuentes y salud* lo mostrará y la app seguirá con el último dato válido.
