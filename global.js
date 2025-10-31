console.log("global.js loaded");

function $$(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }

/* ---------- NAV ---------- */
const pages = [
  { url: '',          title: 'Home'    },
  { url: 'projects/', title: 'Projects'},
  { url: 'contact/',  title: 'Contact' },
  { url: 'cv/',       title: 'CV'      },
  { url: 'https://github.com/tatiii27', title: 'GitHub' },
];

const nav = document.createElement('nav');
document.body.prepend(nav);

// Detect if we’re local dev or deployed under /portfolio/
const BASE_PATH =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '/' : '/portfolio/';

for (const p of pages){
  const a = document.createElement('a');
  a.href = p.url.startsWith('http') ? p.url : BASE_PATH + p.url;
  a.textContent = p.title;
  const isExternal = a.host !== location.host;
  if (isExternal){ a.target = '_blank'; a.rel = 'noopener'; }
  nav.append(a);
  a.classList.toggle('current', a.host === location.host && a.pathname === location.pathname);
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
const KEY = 'colorScheme';

function setColorScheme(v){
  document.documentElement.style.setProperty('color-scheme', v);
  themeSelect.value = v;
}
if (KEY in localStorage){ setColorScheme(localStorage[KEY]); }
else {
  const cs = getComputedStyle(document.documentElement).colorScheme || 'light dark';
  setColorScheme(cs.includes('light') && cs.includes('dark') ? 'light dark' : cs);
}
themeSelect.addEventListener('input', e=>{
  const v = e.target.value;
  setColorScheme(v);
  localStorage[KEY] = v;
});

/* ---------- EXPORTS: data helpers & renderers ---------- */
export async function fetchJSON(url, opts={}){
  const res = await fetch(url, { cache: 'no-store', ...opts });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Render one or more projects */
export function renderProjects(projects, container, headingLevel='h2'){
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

    const h = document.createElement(tag);
    h.textContent = proj?.year ? `${proj.title ?? 'Untitled'} (${proj.year})` : (proj?.title ?? 'Untitled');
    article.appendChild(h);

    if (proj?.image){
      const img = document.createElement('img');
      img.src = proj.image;
      img.alt = proj.title ?? '';
      img.loading = 'lazy';
      article.appendChild(img);
    }

    if (proj?.description){
      const p = document.createElement('p');
      p.textContent = proj.description;
      article.appendChild(p);
    }

    if (proj?.href){
      const a = document.createElement('a');
      a.href = proj.href; a.style.textDecoration = 'none'; a.style.color = 'inherit';
      a.appendChild(article);
      container.appendChild(a);
    }else{
      container.appendChild(article);
    }
  }
}

/** Update “Projects (N)” */
export function updateProjectsCount(n, selector='.projects-title'){
  const el = document.querySelector(selector);
  if (!el) return;
  const base = el.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
  el.textContent = `${base} (${n})`;
}

/** GitHub user data */
export async function fetchGitHubData(username){
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}
