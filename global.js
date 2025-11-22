// global.js — site bootstrap + helpers
console.log("global.js loaded");

/* ========== tiny helpers ========== */
function $$(sel, ctx = document){ return Array.from(ctx.querySelectorAll(sel)); }

/* ========== NAV ========== */
const pages = [
  { url: '',            title: 'Home'     },
  { url: 'projects/',   title: 'Projects' },
  { url: 'meta/',       title: 'Meta'      },
  { url: 'contact/',    title: 'Contact'  },
  { url: 'cv/',         title: 'CV'       },
  { url: 'https://github.com/tatiii27', title: 'GitHub' },
];

// Detect if we’re local dev or deployed under /portfolio/
const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
const BASE_PATH = isLocal ? '/' : '/portfolio/';

const nav = document.createElement('nav');
document.body.prepend(nav);

// build links
for (const p of pages){
  const a = document.createElement('a');
  a.href = p.url.startsWith('http') ? p.url : (BASE_PATH + p.url);
  a.textContent = p.title;

  // external?
  const isExternal = new URL(a.href, location.href).host !== location.host;
  if (isExternal){ a.target = '_blank'; a.rel = 'noopener'; }

  nav.append(a);

  // mark current page (normalize trailing slashes)
  if (!isExternal){
    const linkPath = new URL(a.href, location.href).pathname.replace(/\/+$/, '/') || '/';
    const herePath = location.pathname.replace(/\/+$/, '/') || '/';
    const isCurrent = linkPath === herePath;
    a.classList.toggle('current', isCurrent);
    if (isCurrent) a.setAttribute('aria-current', 'page');
  }
}

/* theme picker */
nav.insertAdjacentHTML('beforeend', `
  <label class="color-scheme">
    Theme:
    <select id="theme-select">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`);

const themeSelect = document.getElementById('theme-select');
const THEME_KEY = 'colorScheme';

function setColorScheme(v){
  document.documentElement.style.setProperty('color-scheme', v);
  if (themeSelect) themeSelect.value = v;
}

// initialize theme
if (THEME_KEY in localStorage){
  setColorScheme(localStorage[THEME_KEY]);
}else{
  const cs = getComputedStyle(document.documentElement).colorScheme || 'light dark';
  setColorScheme(cs.includes('light') && cs.includes('dark') ? 'light dark' : cs);
}

// persist on change
themeSelect?.addEventListener('input', e => {
  const v = e.target.value;
  setColorScheme(v);
  localStorage[THEME_KEY] = v;
});

/* ========== EXPORTS: data helpers & renderers ========== */
export async function fetchJSON(url, opts = {}){
  const res = await fetch(url, { cache: 'no-store', ...opts });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

export function renderProjects(projects, container, headingLevel = 'h2'){
  if (!(container instanceof HTMLElement)) return;
  const tag = /^h[1-6]$/i.test(headingLevel) ? headingLevel : 'h2';
  const list = Array.isArray(projects) ? projects : (projects ? [projects] : []);
  container.innerHTML = '';

  if (list.length === 0){
    const p = document.createElement('p');
    p.textContent = 'No projects to display yet.';
    container.appendChild(p);
    return;
  }

  for (const proj of list){
    const article = document.createElement('article');

    // Title
    const h = document.createElement(tag);
    h.textContent = proj?.title ?? 'Untitled';
    article.appendChild(h);

    // Optional thumbnail
    if (proj?.image){
      const img = document.createElement('img');
      img.src = proj.image;
      img.alt = proj.title ?? '';
      img.loading = 'lazy';
      article.appendChild(img);
    }

    // Description + year (grouped)
    if (proj?.description || proj?.year){
      const wrap = document.createElement('div');
      wrap.className = 'card__textblock';

      if (proj?.description){
        const p = document.createElement('p');
        p.className = 'card__desc';
        p.textContent = proj.description;
        wrap.appendChild(p);
      }

      if (proj?.year){
        const y = document.createElement('p');
        y.className = 'proj-year';
        y.textContent = proj.year;
        y.setAttribute('aria-label', 'Year');
        wrap.appendChild(y);
      }

      article.appendChild(wrap);
    }

    // Link wrapper
    if (proj?.href){
      const a = document.createElement('a');
      a.href = proj.href;
      a.style.textDecoration = 'none';
      a.style.color = 'inherit';
      a.appendChild(article);
      container.appendChild(a);
    }else{
      container.appendChild(article);
    }
  }
}

/** Update “Projects (N)” in a heading */
export function updateProjectsCount(n, selector = '.projects-title'){
  const el = document.querySelector(selector);
  if (!el) return;
  const base = el.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
  el.textContent = `${base} (${n})`;
}

/** GitHub user data (robust, no-cache, clearer errors) */
export async function fetchGitHubData(username){
  const url = `https://api.github.com/users/${encodeURIComponent(username)}?t=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    cache: 'no-store',
    mode: 'cors'
  });

  if (!res.ok){
    let msg = '';
    try { msg = (await res.json())?.message || ''; } catch {}
    throw new Error(`GitHub API ${res.status}${msg ? ` — ${msg}` : ''}`);
  }
  return res.json();
}