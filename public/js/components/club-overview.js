import { formatTime, formatTimeDelta, formatDateTime } from '../formatters.js';

export function createClubOverview(container, stats, tracks, records, recentSessions) {
  container.innerHTML = '';

  const statsGrid = document.createElement('div');
  statsGrid.className = 'kpi-strip';
  statsGrid.className += ' kpi-strip--5';

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

  container.appendChild(statsGrid);

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
    container.appendChild(recordsPanel);
  } else {
    const empty = document.createElement('div');
    empty.className = 'panel';
    const explanation = stats.totalValidLaps > 0
      ? 'No outright records for the selected track and layout. Select a different track from the selector above, or import more sessions to build the record book.'
      : 'No valid lap records yet. Import ACE result files to build the club record book.';
    empty.innerHTML = `<p class="empty-state">${explanation}</p>`;
    container.appendChild(empty);
  }

  if (recentSessions && recentSessions.length > 0) {
    const history = createSessionHistory(recentSessions);
    container.appendChild(history);
  }
}

function createSessionHistory(sessions) {
  const section = document.createElement('section');
  section.className = 'session-history';
  section.setAttribute('aria-label', 'Recent sessions');

  const title = document.createElement('h3');
  title.className = 'session-history__title';
  title.textContent = 'RECENT SESSIONS';
  section.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'session-history__list';

  for (const s of sessions) {
    const li = document.createElement('li');
    li.className = 'session-history__item';

    const meta = document.createElement('div');
    meta.className = 'session-history__meta-row';

    const track = document.createElement('span');
    track.className = 'session-history__track';
    track.textContent = `${s.track?.name || 'Unknown'} — ${s.track?.layout || 'Unknown'}`;

    const details = document.createElement('span');
    details.className = 'session-history__details';
    details.textContent = `${s.session?.type || '—'} · ${s.entriesCount || 0} drivers · ${s.validLapCount ?? 0} valid laps`;

    const date = document.createElement('span');
    date.className = 'session-history__date';
    date.textContent = s.source?.importedAt ? formatDateTime(s.source.importedAt) : '—';

    meta.appendChild(track);
    meta.appendChild(details);
    meta.appendChild(date);
    li.appendChild(meta);
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
}
