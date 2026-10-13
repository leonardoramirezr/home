# home

Página de inicio en GitHub Pages con enlaces a todos los repositorios de
[leonardoramirezr](https://github.com/leonardoramirezr) que tienen GitHub Pages
activado. La lista se descubre automáticamente desde la API de GitHub, sin
instalar ni modificar nada en los otros repositorios.

## Cómo funciona

1. El workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) se ejecuta
   en cada push a `main`, una vez al día (cron) y manualmente (`workflow_dispatch`).
2. [`scripts/build.mjs`](scripts/build.mjs) consulta `GET /users/{owner}/repos`, filtra
   los que tienen `has_pages: true` (excluyendo este repo) y genera un
   `_site/index.html` **estático**.
3. `actions/deploy-pages` publica el artefacto.

## Por qué "GitHub Actions" y no "Deploy from a branch"

| | GitHub Actions (elegido) | Deploy from a branch |
|---|---|---|
| Descubrir repos | En el build, en el servidor | O se hace en el navegador, o hay que commitear el HTML generado |
| Tokens | Solo en el runner; el HTML final no contiene secretos | Si el navegador llama a la API: límite de 60 req/h por IP y cualquier token quedaría expuesto |
| Actualización | Cron diario sin commits | Requiere un bot que haga commits (historial ruidoso, permiso `contents: write`) |
| Permisos | `contents: read`, `pages: write`, `id-token: write` (OIDC) | — |

## Configuración (una sola vez)

En **Settings → Pages → Build and deployment → Source** elige **GitHub Actions**.

### Token opcional

No hace falta ningún token para repos públicos: se usa el `GITHUB_TOKEN`
efímero del workflow. Solo si quieres incluir repos **privados** con Pages
o resolver **dominios personalizados** exactos, crea un fine-grained PAT de
solo lectura (Repository access: *All repositories*; permisos: *Metadata: read*
y *Pages: read*) y guárdalo como secreto de Actions `HOME_PAGES_TOKEN`.

## Probar en local

```sh
PAGES_OWNER=leonardoramirezr GITHUB_REPOSITORY=leonardoramirezr/home node scripts/build.mjs
open _site/index.html
```
