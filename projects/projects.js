// projects/projects.js
import { fetchJSON, renderProjects, updateProjectsCount } from '../global.js';

(async () => {
  try {
    // load your data (path is from projects/index.html → ../lib/projects.json)
    const data = await fetchJSON('../lib/projects.json');

    // render all projects
    const container = document.querySelector('.projects');
    if (container) renderProjects(data, container, 'h2');

    // "Projects (N)" in the H1
    updateProjectsCount(Array.isArray(data) ? data.length : 0);
  } catch (err) {
    console.error('projects.js error:', err);
    const container = document.querySelector('.projects');
    if (container) {
      container.innerHTML =
        `<p style="color:var(--error, #b00020);">Could not load projects (check console & the path <code>../lib/projects.json</code>).</p>`;
    }
  }
})();
