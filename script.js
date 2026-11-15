const USER = "esdrasfurmanovicz";
const SELF = `${USER}.github.io`;
const CACHE_KEY = "hub-repos-v1";
const CACHE_MS = 10 * 60 * 1000;

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const search = document.getElementById("search");
const sort = document.getElementById("sort");
const countEl = document.getElementById("count");
let repos = [];

async function fetchRepos() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (c && Date.now() - c.t < CACHE_MS) return c.data;
  } catch {}

  const all = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&sort=updated`
    );
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: all })); } catch {}
  return all;
}

function pagesUrl(r) {
  return r.homepage && /^https?:\/\//.test(r.homepage)
    ? r.homepage
    : `https://${USER}.github.io/${r.name}/`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function render() {
  const q = search.value.trim().toLowerCase();
  const list = repos
    .filter(r => !q || `${r.name} ${r.description ?? ""} ${(r.topics || []).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort.value === "name") return a.name.localeCompare(b.name);
      if (sort.value === "stars") return b.stargazers_count - a.stargazers_count;
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });

  grid.innerHTML = list.map(r => `
    <article class="card">
      <h2>${esc(r.name)}</h2>
      <p>${esc(r.description || "Sem descrição.")}</p>
      ${r.topics?.length ? `<div class="topics">${r.topics.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="meta">
        ${r.language ? `<span>● ${esc(r.language)}</span>` : ""}
        ${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ""}
        <span>Atualizado ${new Date(r.pushed_at).toLocaleDateString("pt-BR")}</span>
      </div>
      <div class="actions">
        <a class="btn primary" href="${esc(pagesUrl(r))}">Abrir</a>
        <a class="btn" href="${esc(r.html_url)}">Código</a>
      </div>
    </article>`).join("");

  statusEl.hidden = list.length > 0;
  if (!list.length) { statusEl.hidden = false; statusEl.textContent = "Nenhum projeto encontrado."; }
  countEl.textContent = `${repos.length} projeto(s) com Pages`;
}

(async () => {
  try {
    const data = await fetchRepos();
    repos = data.filter(r => r.has_pages && !r.fork && !r.archived && r.name.toLowerCase() !== SELF);
    render();
  } catch (e) {
    statusEl.textContent = "Não foi possível carregar os projetos (limite da API do GitHub?). Tente de novo em alguns minutos.";
    console.error(e);
  }
})();

search.addEventListener("input", render);
sort.addEventListener("change", render);
