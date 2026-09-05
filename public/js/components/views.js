export function createLoadingState() {
  const container = document.createElement('div');
  container.className = 'dashboard-shell';
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading');

  const appBar = document.createElement('div');
  appBar.className = 'app-bar';
  appBar.innerHTML = `<h1 class="app-bar__brand skeleton-line skeleton-line--short" aria-hidden="true"></h1>`;
  container.appendChild(appBar);

  const header = document.createElement('header');
  header.className = 'session-header';
  header.innerHTML = `
    <div class="session-header__context">
      <div class="session-header__track-info">
        <h2 class="session-header__track skeleton-line skeleton-line--long" aria-hidden="true"></h2>
        <div class="session-header__meta skeleton-line skeleton-line--short" aria-hidden="true"></div>
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
    card.innerHTML = `
      <div class="skeleton-line skeleton-line--short" aria-hidden="true"></div>
      <div class="skeleton-line skeleton-line--medium" aria-hidden="true"></div>
      <div class="skeleton-line skeleton-line--short" aria-hidden="true" style="width:50%"></div>
    `;
    kpi.appendChild(card);
  }
  container.appendChild(kpi);

  const main = document.createElement('div');
  main.className = 'session-grid';
  main.innerHTML = `
    <section class="panel panel--skeleton" aria-hidden="true">
      <div class="skeleton-line skeleton-line--short" aria-hidden="true"></div>
      <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px;margin-bottom:8px"></div>
      <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px;margin-bottom:8px"></div>
      <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px"></div>
    </section>
    <div class="session-grid__right">
      <section class="panel panel--skeleton" aria-hidden="true">
        <div class="skeleton-line skeleton-line--short" aria-hidden="true"></div>
        <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px;margin-bottom:8px"></div>
        <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px;margin-bottom:8px"></div>
        <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px"></div>
      </section>
      <section class="panel panel--skeleton" aria-hidden="true">
        <div class="skeleton-line skeleton-line--short" aria-hidden="true"></div>
        <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px;margin-bottom:8px"></div>
        <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:16px"></div>
      </section>
    </div>
  `;
  container.appendChild(main);

  const history = document.createElement('section');
  history.className = 'session-history';
  history.setAttribute('aria-hidden', 'true');
  history.innerHTML = `
    <div class="skeleton-line skeleton-line--short" aria-hidden="true"></div>
    <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:14px;margin-bottom:6px"></div>
    <div class="skeleton-line skeleton-line--long" aria-hidden="true" style="height:14px"></div>
  `;
  container.appendChild(history);

  return container;
}

export function createEmptyState() {
  const container = document.createElement('div');
  container.className = 'dashboard-shell';
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
  container.className = 'dashboard-shell';
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
