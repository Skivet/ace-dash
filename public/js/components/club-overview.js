import { formatTime, formatTimeDelta, formatDateTime } from '../formatters.js';

export function createClubOverview(container, stats, tracks, records) {
  container.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'dashboard-shell';

  const appBar = document.createElement('div');
  appBar.className = 'app-bar';

  const brand = document.createElement('h1');
  brand.className = 'app-bar__brand';
  brand.textContent = 'BENTOCLUB';

  const subtitle = document.createElement('span');
  subtitle.className = 'app-bar__status';
  subtitle.textContent = 'Club timing and session history';

  appBar.appendChild(brand);
  appBar.appendChild(subtitle);
  shell.appendChild(appBar);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'kpi-strip';

  const statCards = [
    {
      label: 'VALID LAPS',
      value: String(stats.totalValidLaps),
      detail: stats.totalInvalidLaps > 0 ? `${stats.totalInvalidLaps} invalid laps` : '',
    },
    {
      label: 'ACTIVE DRIVERS',
      value: String(stats.activeDrivers),
      detail: '',
    },
    {
      label: 'CARS DRIVEN',
      value: String(stats.carsDriven),
      detail: '',
    },
    {
      label: 'TRACKS / LAYOUTS',
      value: String(stats.tracksRepresented),
      detail: '',
    },
    {
      label: 'TOTAL SESSIONS',
      value: String(stats.totalSessions),
      detail: stats.mostRecentSession ? formatDateTime(stats.mostRecentSession.importedAt) : '',
    },
  ];

  for (const card of statCards) {
    const el = document.createElement('article');
    el.className = 'kpi-card';

    const labelEl = document.createElement('span');
    labelEl.className = 'kpi-card__label';
    labelEl.textContent = card.label;

    const valueEl = document.createElement('strong');
    valueEl.className = 'kpi-card__value';
    valueEl.textContent = card.value;

    const detailEl = document.createElement('span');
    detailEl.className = 'kpi-card__detail';
    detailEl.textContent = card.detail;

    el.appendChild(labelEl);
    el.appendChild(valueEl);
    el.appendChild(detailEl);
    statsGrid.appendChild(el);
  }

  shell.appendChild(statsGrid);

  const mainGrid = document.createElement('div');
  mainGrid.className = 'session-grid';

  if (records && records.length > 0) {
    const recordsPanel = document.createElement('section');
    recordsPanel.className = 'panel records-panel';
    recordsPanel.setAttribute('aria-label', 'Overall club records');

    const title = document.createElement('h3');
    title.className = 'panel__title';
    title.textContent = 'OUTRIGHT RECORDS';
    recordsPanel.appendChild(title);

    const table = document.createElement('div');
    table.className = 'records-table';

    const header = document.createElement('div');
    header.className = 'records-table__header';

    const headers = [
      { text: 'RANK', className: 'records-table__col-rank' },
      { text: 'DRIVER', className: 'records-table__col-driver' },
      { text: 'CAR', className: 'records-table__col-car' },
      { text: 'BEST LAP', className: 'records-table__col-time' },
      { text: 'GAP', className: 'records-table__col-gap' },
      { text: 'DATE', className: 'records-table__col-date' },
    ];

    for (const h of headers) {
      const el = document.createElement('div');
      el.className = h.className;
      el.textContent = h.text;
      header.appendChild(el);
    }
    table.appendChild(header);

    const limit = Math.min(records.length, 20);
    for (let i = 0; i < limit; i++) {
      const r = records[i];
      const row = document.createElement('div');
      row.className = 'records-table__row' + (r.isOutrightRecord ? ' records-table__row--record' : '');

      const rankEl = document.createElement('div');
      rankEl.className = 'records-table__col-rank';
      rankEl.textContent = String(r.rank);

      const driverEl = document.createElement('div');
      driverEl.className = 'records-table__col-driver';
      driverEl.textContent = r.driverName;

      const carEl = document.createElement('div');
      carEl.className = 'records-table__col-car';
      carEl.textContent = r.carModel;

      const timeEl = document.createElement('div');
      timeEl.className = 'records-table__col-time';
      timeEl.textContent = formatTime(r.bestLapMs);

      const gapEl = document.createElement('div');
      gapEl.className = 'records-table__col-gap';
      if (r.isOutrightRecord) {
        gapEl.textContent = '—';
        gapEl.className += ' records-table__col-gap--record';
      } else {
        gapEl.textContent = r.gapToOutrightMs !== null ? `+${(r.gapToOutrightMs / 1000).toFixed(3)} s` : '—';
      }

      const dateEl = document.createElement('div');
      dateEl.className = 'records-table__col-date';
      dateEl.textContent = formatDateTime(r.importedAt);

      row.appendChild(rankEl);
      row.appendChild(driverEl);
      row.appendChild(carEl);
      row.appendChild(timeEl);
      row.appendChild(gapEl);
      row.appendChild(dateEl);
      table.appendChild(row);
    }

    if (records.length > 20) {
      const more = document.createElement('p');
      more.className = 'records-table__more';
      more.textContent = `Showing ${limit} of ${records.length} records`;
      table.appendChild(more);
    }

    recordsPanel.appendChild(table);
    mainGrid.appendChild(recordsPanel);

    const rightPanel = document.createElement('div');
    rightPanel.className = 'session-grid__right';

    if (tracks.length > 0) {
      const topCarsPanel = document.createElement('section');
      topCarsPanel.className = 'panel car-records-panel';
      topCarsPanel.setAttribute('aria-label', 'Fastest car records');

      const carTitle = document.createElement('h3');
      carTitle.className = 'panel__title';
      carTitle.textContent = 'FASTEST BY CAR';
      topCarsPanel.appendChild(carTitle);

      const carTable = document.createElement('div');
      carTable.className = 'records-table';

      const carHeader = document.createElement('div');
      carHeader.className = 'records-table__header';

      const carHeaders = [
        { text: 'CAR', className: 'records-table__col-car' },
        { text: 'RECORD', className: 'records-table__col-time' },
        { text: 'DRIVER', className: 'records-table__col-driver' },
        { text: 'GAP', className: 'records-table__col-gap' },
      ];

      for (const h of carHeaders) {
        const el = document.createElement('div');
        el.className = h.className;
        el.textContent = h.text;
        carHeader.appendChild(el);
      }
      carTable.appendChild(carHeader);

      const outrightBest = records[0]?.bestLapMs || null;
      for (const r of records) {
        const row = document.createElement('div');
        row.className = 'records-table__row';

        const carEl = document.createElement('div');
        carEl.className = 'records-table__col-car';
        carEl.textContent = r.carModel;

        const timeEl = document.createElement('div');
        timeEl.className = 'records-table__col-time';
        timeEl.textContent = formatTime(r.bestLapMs);

        const driverEl = document.createElement('div');
        driverEl.className = 'records-table__col-driver';
        driverEl.textContent = r.driverName;

        const gapEl = document.createElement('div');
        gapEl.className = 'records-table__col-gap';
        if (r.isOutrightRecord) {
          gapEl.textContent = '—';
          gapEl.className += ' records-table__col-gap--record';
        } else {
          gapEl.textContent = r.gapToOutrightMs !== null ? `+${(r.gapToOutrightMs / 1000).toFixed(3)} s` : '—';
        }

        row.appendChild(carEl);
        row.appendChild(timeEl);
        row.appendChild(driverEl);
        row.appendChild(gapEl);
        carTable.appendChild(row);
      }

      topCarsPanel.appendChild(carTable);
      rightPanel.appendChild(topCarsPanel);
    }

    mainGrid.appendChild(rightPanel);
  } else {
    const empty = document.createElement('div');
    empty.className = 'panel';
    empty.innerHTML = '<p class="empty-state">No records yet. Import ACE results to build the club record book.</p>';
    mainGrid.appendChild(empty);
  }

  shell.appendChild(mainGrid);
  container.appendChild(shell);
}
