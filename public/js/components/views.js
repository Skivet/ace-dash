export function createLoadingState() {
  const container = document.createElement('div');
  container.className = 'dashboard';
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading');

  const header = document.createElement('header');
  header.className = 'session-header session-header--skeleton';
  header.innerHTML = `
    <div class="session-header__top">
      <h1 class="session-header__logo" aria-hidden="true"></h1>
      <span class="session-header__status" aria-hidden="true"></span>
    </div>
    <div class="session-header__context">
      <div class="session-header__track-info">
        <h2 class="session-header__track" aria-hidden="true"></h2>
        <div class="session-header__meta" aria-hidden="true"></div>
      </div>
    </div>
  `;
  container.appendChild(header);

  const kpi = document.createElement('section');
  kpi.className = 'kpi-strip';
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('article');
    card.className = 'kpi-card kpi-card--skeleton';
    card.setAttribute('aria-hidden', 'true');
    container.appendChild(card);
  }

  const main = document.createElement('main');
  main.className = 'dashboard__main';
  main.innerHTML = `
    <section class="panel panel--skeleton" aria-hidden="true"><div class="panel__title"></div><div class="panel__body"></div></section>
    <section class="panel panel--skeleton" aria-hidden="true"><div class="panel__title"></div><div class="panel__body"></div></section>
  `;
  container.appendChild(main);

  return container;
}

export function createEmptyState() {
  const container = document.createElement('div');
  container.className = 'dashboard';
  container.setAttribute('aria-label', 'No sessions');

  const empty = document.createElement('main');
  empty.className = 'empty-state empty-state--full';
  empty.innerHTML = `
    <h2>No sessions imported</h2>
    <p>Place ACE results JSON files into the results directory to begin importing sessions.</p>
    <p>The dashboard reads completed-session exports only — it does not connect to live telemetry.</p>
  `;
  container.appendChild(empty);
  return container;
}

export function createErrorState(message) {
  const container = document.createElement('div');
  container.className = 'dashboard';
  container.setAttribute('aria-label', 'Error');

  const error = document.createElement('main');
  error.className = 'error-state';
  error.innerHTML = `
    <h2>Unable to load sessions</h2>
    <p>${escapeHtml(message)}</p>
  `;
  container.appendChild(error);
  return container;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
