import { formatTime, formatGap, formatLapRange } from '../formatters.js';

export function createPaceSummary(session) {
  const section = document.createElement('section');
  section.className = 'panel pace-summary';
  section.setAttribute('aria-label', 'Pace summary');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'PACE SUMMARY';
  section.appendChild(title);

  const table = document.createElement('div');
  table.className = 'pace-summary__table';

  const header = document.createElement('div');
  header.className = 'pace-summary__header';

  const headers = [
    { text: 'DRIVER / CAR', className: 'pace-summary__col-driver' },
    { text: 'LAPS', className: 'pace-summary__col-laps' },
    { text: 'BEST', className: 'pace-summary__col-best' },
    { text: 'GAP', className: 'pace-summary__col-gap' },
    { text: 'AVG', className: 'pace-summary__col-avg' },
    { text: 'RANGE', className: 'pace-summary__col-range' },
  ];

  for (const h of headers) {
    const el = document.createElement('div');
    el.className = h.className;
    el.textContent = h.text;
    header.appendChild(el);
  }
  table.appendChild(header);

  const paceEntries = session.paceSummary || [];

  for (const entry of paceEntries) {
    const row = document.createElement('div');
    row.className = 'pace-summary__row' + (entry.isLeader ? ' pace-summary__row--leader' : '');

    const driverCell = document.createElement('div');
    driverCell.className = 'pace-summary__col-driver';

    const driverName = document.createElement('span');
    driverName.className = 'pace-summary__driver';
    driverName.textContent = entry.driverName;

    const carName = document.createElement('span');
    carName.className = 'pace-summary__car';
    carName.textContent = entry.carName;

    driverCell.appendChild(driverName);
    driverCell.appendChild(carName);

    const lapsCell = document.createElement('div');
    lapsCell.className = 'pace-summary__col-laps';
    lapsCell.textContent = String(entry.completedLapCount);

    const bestCell = document.createElement('div');
    bestCell.className = 'pace-summary__col-best';
    bestCell.textContent = entry.bestLapMs !== null ? formatTime(entry.bestLapMs) : '—';

    const gapCell = document.createElement('div');
    gapCell.className = 'pace-summary__col-gap';
    gapCell.textContent = entry.gapToLeaderMs !== null ? formatGap(entry.gapToLeaderMs) : '—';

    const avgCell = document.createElement('div');
    avgCell.className = 'pace-summary__col-avg';
    avgCell.textContent = entry.averageLapMs !== null ? formatTime(entry.averageLapMs) : '—';

    const rangeCell = document.createElement('div');
    rangeCell.className = 'pace-summary__col-range';
    rangeCell.textContent = entry.rangeMs !== null ? formatLapRange(entry.rangeMs) : '—';

    row.appendChild(driverCell);
    row.appendChild(lapsCell);
    row.appendChild(bestCell);
    row.appendChild(gapCell);
    row.appendChild(avgCell);
    row.appendChild(rangeCell);
    table.appendChild(row);
  }

  section.appendChild(table);
  return section;
}
