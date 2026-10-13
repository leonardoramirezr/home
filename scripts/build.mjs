// Genera el sitio estático (_site/index.html) con enlaces a los repositorios
// del propietario que tienen GitHub Pages activado.
//
// Se ejecuta en GitHub Actions: el token solo vive en el runner y nunca se
// escribe en los archivos generados. El HTML resultante es 100% estático.
//
// Variables de entorno:
//   GITHUB_TOKEN       Token para la API (el GITHUB_TOKEN del workflow basta
//                      para repos públicos).
//   PAGES_OWNER        Usuario cuyos repos se listan (por defecto, dueño del repo actual).
//   GITHUB_REPOSITORY  owner/repo actual; se excluye a sí mismo de la lista.
//   INCLUDE_PRIVATE    "true" si el token es un PAT del usuario con acceso a
//                      repos privados (usa /user/repos en lugar de /users/:owner/repos).
//   MOCK_REPOS_FILE    Ruta a un JSON con repos de ejemplo (pruebas locales sin red).
//   OUT_DIR            Directorio de salida (por defecto "_site").

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";


const API = "https://api.github.com";
const token = process.env.GITHUB_TOKEN || "";
const currentRepo = process.env.GITHUB_REPOSITORY || "";
const owner = process.env.PAGES_OWNER || currentRepo.split("/")[0];
const includePrivate = process.env.INCLUDE_PRIVATE === "true";
const outDir = process.env.OUT_DIR || "_site";

if (!owner) {
  console.error("Define PAGES_OWNER o GITHUB_REPOSITORY.");
  process.exit(1);
}

async function gh(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${owner}-home-builder`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res;
}

async function listRepos() {
  if (process.env.MOCK_REPOS_FILE) {
    return JSON.parse(await readFile(process.env.MOCK_REPOS_FILE, "utf8"));
  }
  const base = includePrivate
    ? `/user/repos?affiliation=owner&visibility=all`
    : `/users/${encodeURIComponent(owner)}/repos?type=owner`;
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await gh(`${base}&per_page=100&page=${page}&sort=pushed`);
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

// URL pública de Pages. Con un token que tenga permiso de lectura de Pages en
// el repo, la API devuelve la URL real (incluido dominio personalizado). Si no
// (p. ej. GITHUB_TOKEN, que solo tiene acceso a este repo), se usa la URL por
// defecto; GitHub redirige a un dominio personalizado si está configurado.
async function pagesUrl(repo) {
  if (!process.env.MOCK_REPOS_FILE) {
    try {
      const res = await gh(`/repos/${repo.full_name}/pages`);
      if (res.ok) {
        const info = await res.json();
        if (info.html_url) return info.html_url;
      }
    } catch {
      // se ignora y se usa la URL por defecto
    }
  }
  const user = repo.owner.login.toLowerCase();
  if (repo.name.toLowerCase() === `${user}.github.io`) {
    return `https://${user}.github.io/`;
  }
  return `https://${user}.github.io/${repo.name}/`;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function card(site) {
  const href = safeHttpUrl(site.url);
  if (!href) return "";
  const meta = [
    site.language && `<span>${esc(site.language)}</span>`,
    site.archived && `<span class="tag">archivado</span>`,
    site.fork && `<span class="tag">fork</span>`,
  ]
    .filter(Boolean)
    .join("");
  return `
      <li>
        <a class="card" href="${esc(href)}">
          <span class="name">${esc(site.name)}</span>
          ${site.description ? `<span class="desc">${esc(site.description)}</span>` : ""}
          <span class="url">${esc(href.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span>
          ${meta ? `<span class="meta">${meta}</span>` : ""}
        </a>
        <a class="source" href="${esc(site.repoUrl)}" aria-label="Código de ${esc(site.name)}">código</a>
      </li>`;
}

function render(sites, generatedAt) {
  const list = sites.length
    ? `<ul class="grid">${sites.map(card).join("")}\n    </ul>`
    : `<p class="empty">Todavía no hay repositorios con GitHub Pages.</p>`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; manifest-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${esc(owner)} · Proyectos</title>
  <meta name="description" content="Sitios publicados con GitHub Pages por ${esc(owner)}.">
  <link rel="icon" href="icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="icon.png">
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <style>
    :root {
      --bg: #f7f7f5; --surface: #ffffff; --text: #1c1c1a; --muted: #6b6b66;
      --border: #e3e3de; --accent: #2f6feb; --tag: #efefea;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111214; --surface: #1a1b1e; --text: #ececea; --muted: #9a9a94;
        --border: #2a2b2f; --accent: #6ea0ff; --tag: #26272b;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    main { max-width: 960px; margin: 0 auto; padding: 56px 16px calc(env(safe-area-inset-bottom) + 40px); }
    header h1 { margin: 0; font-size: 2rem; letter-spacing: -0.02em; }
    header p { margin: 6px 0 32px; color: var(--muted); }
    header a { color: inherit; }
    .grid {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .grid li { position: relative; }
    .card {
      display: flex; flex-direction: column; gap: 6px; height: 100%;
      padding: 18px 18px 16px; border: 1px solid var(--border); border-radius: 12px;
      background: var(--surface); color: inherit; text-decoration: none;
      transition: border-color .15s, transform .15s;
    }
    .card:hover, .card:focus-visible { border-color: var(--accent); transform: translateY(-1px); }
    .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .name { font-weight: 600; font-size: 1.05rem; padding-right: 56px; overflow-wrap: anywhere; }
    .desc { color: var(--muted); font-size: .92rem; }
    .url { color: var(--accent); font-size: .85rem; overflow-wrap: anywhere; margin-top: auto; }
    .meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: .78rem; color: var(--muted); }
    .tag { background: var(--tag); border-radius: 999px; padding: 0 8px; }
    .source {
      position: absolute; top: 18px; right: 18px; font-size: .78rem;
      color: var(--muted); text-decoration: none;
    }
    .source:hover { color: var(--accent); text-decoration: underline; }
    .empty { color: var(--muted); }
    .reload {
      display: block; width: 100%; margin-top: 32px; padding: 14px 16px;
      border: 1px solid var(--border); border-radius: 12px;
      background: var(--surface); color: var(--text); text-align: center;
      font-weight: 600; text-decoration: none;
    }
    .reload:hover, .reload:focus-visible { border-color: var(--accent); }
    .reload:active { transform: scale(.99); }
    footer { margin-top: 40px; color: var(--muted); font-size: .8rem; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${esc(owner)}</h1>
      <p>Proyectos publicados con GitHub Pages · <a href="https://github.com/${esc(owner)}">github.com/${esc(owner)}</a></p>
    </header>
    ${list}
    <a class="reload" href="./">Actualizar</a>
    <footer>Actualizado automáticamente el ${esc(generatedAt)} UTC.</footer>
  </main>
</body>
</html>
`;
}

const repos = await listRepos();
const self = currentRepo.toLowerCase();
const candidates = repos.filter(
  (r) =>
    r.has_pages &&
    r.owner?.login?.toLowerCase() === owner.toLowerCase() &&
    r.full_name.toLowerCase() !== self,
);

const sites = await Promise.all(
  candidates.map(async (r) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    archived: r.archived,
    fork: r.fork,
    repoUrl: r.html_url,
    pushedAt: r.pushed_at,
    url: await pagesUrl(r),
  })),
);

// Activos primero, luego por actividad reciente.
sites.sort(
  (a, b) =>
    Number(Boolean(a.archived)) - Number(Boolean(b.archived)) ||
    String(b.pushedAt).localeCompare(String(a.pushedAt)),
);

const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), render(sites, generatedAt));
await writeFile(join(outDir, ".nojekyll"), "");
await writeFile(
  join(outDir, "manifest.webmanifest"),
  JSON.stringify({
    name: `${owner} · Proyectos`,
    short_name: owner,
    start_url: "./",
    scope: "./",
    display: "standalone",
    icons: [{ src: "icon.png", sizes: "1024x1024", type: "image/png" }],
  }, null, 2),
);
const logoDir = new URL("../assets/logo/", import.meta.url);
await copyFile(new URL("icon.svg", logoDir), join(outDir, "icon.svg"));
await copyFile(new URL("icon.png", logoDir), join(outDir, "icon.png"));
console.log(`${sites.length} sitio(s) con Pages:`);
for (const s of sites) console.log(` - ${s.name}: ${s.url}`);
