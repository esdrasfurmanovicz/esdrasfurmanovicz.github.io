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

/* ---------- Estatísticas ---------- */
const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", HTML: "#e34c26", CSS: "#563d7c",
  PHP: "#4F5D95", Python: "#3572A5", Java: "#b07219", "C#": "#178600", C: "#555555",
  "C++": "#f34b7d", Blade: "#f7523f", Vue: "#41b883", Shell: "#89e051", SCSS: "#c6538c",
  Lua: "#000080", Go: "#00ADD8", Rust: "#dea584", Dart: "#00B4AB", Kotlin: "#A97BFF",
};
const colorOf = l => LANG_COLORS[l] || "#8b949e";

async function cached(key, ttl, fn) {
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    if (c && Date.now() - c.t < ttl) return c.data;
  } catch {}
  const data = await fn();
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch {}
  return data;
}

const api = async path => {
  const res = await fetch(`https://api.github.com${path}`);
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json();
};

function ago(date) {
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d < 30 ? `há ${d} dia(s)` : new Date(date).toLocaleDateString("pt-BR");
}

function describeEvent(e) {
  const repo = e.repo.name.split("/")[1];
  switch (e.type) {
    case "PushEvent": {
      const msg = e.payload.commits?.slice(-1)[0]?.message?.split("\n")[0];
      return { text: `Push em ${repo}`, sub: msg };
    }
    case "CreateEvent": return { text: `Criou ${e.payload.ref_type} em ${repo}`, sub: e.payload.ref };
    case "WatchEvent": return { text: `Favoritou ${repo}` };
    case "ForkEvent": return { text: `Fez fork de ${repo}` };
    case "IssuesEvent": return { text: `${e.payload.action} issue em ${repo}`, sub: e.payload.issue?.title };
    case "PullRequestEvent": return { text: `${e.payload.action} PR em ${repo}`, sub: e.payload.pull_request?.title };
    default: return null;
  }
}

async function renderStats(allRepos) {
  const own = allRepos.filter(r => !r.fork);
  const [user, events, langs] = await Promise.all([
    cached("hub-user-v1", CACHE_MS, () => api(`/users/${USER}`)),
    cached("hub-events-v1", CACHE_MS, () => api(`/users/${USER}/events/public?per_page=30`)).catch(() => []),
    cached("hub-langs-v1", 60 * 60 * 1000, async () => {
      const total = {};
      const results = await Promise.all(own.map(r => api(`/repos/${USER}/${r.name}/languages`).catch(() => ({}))));
      results.forEach(o => Object.entries(o).forEach(([k, v]) => (total[k] = (total[k] || 0) + v)));
      return total;
    }).catch(() => ({})),
  ]);

  const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
  const years = ((Date.now() - new Date(user.created_at)) / 31557600000).toFixed(1).replace(".", ",");
  const topics = new Set(own.flatMap(r => r.topics || [])).size;
  const lastPush = own.map(r => r.pushed_at).sort().pop();
  const pushes30 = events.filter(e => e.type === "PushEvent").length;

  const tiles = [
    [user.public_repos, "repositórios públicos"],
    [allRepos.filter(r => r.has_pages).length, "sites no Pages"],
    [stars, "estrelas recebidas"],
    [user.followers, "seguidores"],
    [`${years} anos`, "no GitHub"],
    [pushes30, "pushes recentes"],
    [lastPush ? ago(lastPush) : "—", "último push"],
    [topics, "tópicos usados"],
  ];
  document.getElementById("tiles").innerHTML = tiles
    .map(([v, l]) => `<div class="tile"><b>${esc(v)}</b><span>${l}</span></div>`).join("");

  const sum = Object.values(langs).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(langs).filter(([, v]) => v / sum >= 0.001).sort((a, b) => b[1] - a[1]);
  document.getElementById("langbar").innerHTML = sorted
    .map(([l, v]) => `<i title="${esc(l)}" style="width:${(v / sum) * 100}%;background:${colorOf(l)}"></i>`).join("");
  document.getElementById("langlist").innerHTML = sorted.slice(0, 8)
    .map(([l, v]) => `<li><span class="dot" style="background:${colorOf(l)}"></span>${esc(l)}<span class="pct">${((v / sum) * 100).toFixed(1)}%</span></li>`).join("")
    || "<li>Sem dados.</li>";

  const act = events.map(e => ({ e, d: describeEvent(e) })).filter(x => x.d).slice(0, 6);
  document.getElementById("activity").innerHTML = act
    .map(({ e, d }) => `<li>${esc(d.text)}${d.sub ? `<small>${esc(d.sub)}</small>` : ""}<small>${ago(e.created_at)}</small></li>`).join("")
    || "<li>Sem atividade recente.</li>";

  document.getElementById("stats").hidden = false;
}

(async () => {
  try {
    const data = await fetchRepos();
    repos = data.filter(r => r.has_pages && !r.fork && !r.archived && r.name.toLowerCase() !== SELF);
    render();
    renderStats(data).catch(e => console.error("stats:", e));
  } catch (e) {
    statusEl.textContent = "Não foi possível carregar os projetos (limite da API do GitHub?). Tente de novo em alguns minutos.";
    console.error(e);
  }
})();

search.addEventListener("input", render);
sort.addEventListener("change", render);
