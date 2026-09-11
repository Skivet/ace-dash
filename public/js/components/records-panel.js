import { formatTime, formatTimeDelta, formatDateTime } from '../formatters.js';

export function createRecordsPanel(records, trackName, layoutName, onSessionSelect) {
  const section = document.createElement('section');
  section.className = 'panel records-panel';
  section.setAttribute('aria-label', 'Overall club records');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'OVERALL RECORDS';
  section.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'records-panel__subtitle';
  subtitle.textContent = `${trackName} — ${layoutName}`;
  section.appendChild(subtitle);

  if (records.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No valid lap records for this track/layout.';
    section.appendChild(empty);
    return section;
  }

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

  const outrightBest = records[0]?.bestLapMs || null;
  for (const r of records) {
    const row = document.createElement('div');
    row.className = 'records-table__row' + (r.isOutrightRecord ? ' records-table__row--record' : '');

    const rankEl = document.createElement('div');
    rankEl.className = 'records-table__col-rank';
    rankEl.textContent = String(r.rank);
    if (r.isTied) {
      rankEl.className += ' records-table__col-rank--tied';
      rankEl.textContent += ' T';
    }

    const driverEl = document.createElement('div');
    driverEl.className = 'records-table__col-driver';
    driverEl.textContent = r.driverName;
    if (onSessionSelect) {
      driverEl.style.cursor = 'pointer';
      driverEl.addEventListener('click', () => {
        const session = currentSessions?.find(s => s.id === r.sessionId);
        if (session && onSessionSelect) onSessionSelect(session);
      });
    }

    const carEl = document.createElement('div');
    carEl.className = 'records-table__col-car';
    carEl.textContent = r.carModel;
    if (onSessionSelect) {
      carEl.style.cursor = 'pointer';
      carEl.addEventListener('click', () => {
        const session = currentSessions?.find(s => s.id === r.sessionId);
        if (session && onSessionSelect) onSessionSelect(session);
      });
    }

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

  section.appendChild(table);
  return section;
}

export function createCarRecordsPanel(carRecords, outrightBest, onSessionSelect) {
  const section = document.createElement('section');
  section.className = 'panel car-records-panel';
  section.setAttribute('aria-label', 'Records by car');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'FASTEST BY CAR';
  section.appendChild(title);

  if (carRecords.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No valid lap records for any car at this track.';
    section.appendChild(empty);
    return section;
  }

  const table = document.createElement('div');
  table.className = 'records-table';

  const header = document.createElement('div');
  header.className = 'records-table__header';

  const headers = [
    { text: 'CAR', className: 'records-table__col-car' },
    { text: 'RECORD', className: 'records-table__col-time' },
    { text: 'DRIVER', className: 'records-table__col-driver' },
    { text: 'GAP', className: 'records-table__col-gap' },
    { text: 'VALID', className: 'records-table__col-laps' },
    { text: 'SESSIONS', className: 'records-table__col-sessions' },
  ];

  for (const h of headers) {
    const el = document.createElement('div');
    el.className = h.className;
    el.textContent = h.text;
    header.appendChild(el);
  }
  table.appendChild(header);

  for (const r of carRecords) {
    const row = document.createElement('div');
    row.className = 'records-table__row' + (r.isOutrightRecord ? ' records-table__row--record' : '');

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

    const lapsEl = document.createElement('div');
    lapsEl.className = 'records-table__col-laps';
    lapsEl.textContent = String(r.validLapCount || 0);

    const sessionsEl = document.createElement('div');
    sessionsEl.className = 'records-table__col-sessions';
    sessionsEl.textContent = String(r.sessionCount || 1);

    row.appendChild(carEl);
    row.appendChild(timeEl);
    row.appendChild(driverEl);
    row.appendChild(gapEl);
    row.appendChild(lapsEl);
    row.appendChild(sessionsEl);
    table.appendChild(row);
  }

  section.appendChild(table);
  return section;
}
