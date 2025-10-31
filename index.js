import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

/* Latest 3 projects on home */
(async () => {
  const container = document.querySelector('.projects');
  if (!container) return;

  try {
    const all = await fetchJSON('./lib/projects.json');   // relative to index.html
    const latest = Array.isArray(all) ? all.slice(0, 3) : [];
    renderProjects(latest, container, 'h3');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="msg-error">Could not load projects (check console & the path <code>./lib/projects.json</code>).</p>`;
  }
})();

/* Optional: GitHub stats (simple, text + bars) */
(async () => {
  const box = document.querySelector('#profile-stats');
  if (!box) return;

  try {
    const u = await fetchGitHubData('tatiii27');
    box.innerHTML = `
      <h2>GitHub Profile</h2>
      <dl class="profile-grid">
        <dt>Public Repos</dt><dd>${u.public_repos}</dd>
        <dt>Public Gists</dt><dd>${u.public_gists}</dd>
        <dt>Followers</dt><dd>${u.followers}</dd>
        <dt>Following</dt><dd>${u.following}</dd>
      </dl>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:.75rem">
        <div class="statbar"><span style="width:${Math.min(u.public_repos, 30)/30*100}%"></span></div>
        <div class="statbar"><span style="width:${Math.min(u.public_gists, 30)/30*100}%"></span></div>
        <div class="statbar"><span style="width:${Math.min(u.followers, 100)/100*100}%"></span></div>
        <div class="statbar"><span style="width:${Math.min(u.following, 100)/100*100}%"></span></div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    box.innerHTML = `<p class="msg-error">Could not load GitHub profile.</p>`;
  }
})();
