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

  for (const entry of session.entries) {
    const row = document.createElement('div');
    row.className = 'pace-summary__row' + (entry.bestLapMs === session.bestLapMs ? ' pace-summary__row--leader' : '');

    const driverCell = document.createElement('div');
    driverCell.className = 'pace-summary__col-driver';

    const driverName = document.createElement('span');
    driverName.className = 'pace-summary__driver';
    driverName.textContent = entry.driver.nickname;

    const carName = document.createElement('span');
    carName.className = 'pace-summary__car';
    carName.textContent = entry.car.model;

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
    gapCell.textContent = entry.bestLapMs !== null ? formatGap(entry.gapToBestMs) : '—';

    const avgCell = document.createElement('div');
    avgCell.className = 'pace-summary__col-avg';
    avgCell.textContent = entry.averageLapMs !== null ? formatTime(entry.averageLapMs) : '—';

    const rangeCell = document.createElement('div');
    rangeCell.className = 'pace-summary__col-range';
    rangeCell.textContent = entry.lapRangeMs !== null ? formatLapRange(entry.lapRangeMs) : '—';

    row.appendChild(driverCell);
    row.appendChild(lapsCell);
    row.appendChild(bestCell);
    row.appendChild(gapCell);
    row.appendChild(avgCell);
    row.appendChild(rangeCell);
    table.appendChild(row);
  }

  section.appendChild(table);

  const mobileContainer = document.createElement('div');
  mobileContainer.className = 'pace-summary__mobile';

  for (const entry of session.entries) {
    const card = document.createElement('div');
    card.className = 'pace-summary__mobile-card' + (entry.bestLapMs === session.bestLapMs ? ' pace-summary__mobile-card--leader' : '');

    const header = document.createElement('div');
    header.className = 'pace-summary__mobile-header';

    const driverName = document.createElement('span');
    driverName.className = 'pace-summary__mobile-driver';
    driverName.textContent = entry.driver.nickname;

    const carName = document.createElement('span');
    carName.className = 'pace-summary__mobile-car';
    carName.textContent = entry.car.model;

    header.appendChild(driverName);
    header.appendChild(carName);
    card.appendChild(header);

    const metrics = document.createElement('div');
    metrics.className = 'pace-summary__mobile-metrics';

    const metricsData = [
      { label: 'BEST', value: entry.bestLapMs !== null ? formatTime(entry.bestLapMs) : '—', cls: '' },
      { label: 'GAP', value: entry.bestLapMs !== null ? formatGap(entry.gapToBestMs) : '—', cls: 'pace-summary__mobile-metric-value--gap' },
      { label: 'AVERAGE', value: entry.averageLapMs !== null ? formatTime(entry.averageLapMs) : '—', cls: '' },
      { label: 'RANGE', value: entry.lapRangeMs !== null ? formatLapRange(entry.lapRangeMs) : '—', cls: '' },
      { label: 'LAPS', value: String(entry.completedLapCount), cls: '' },
    ];

    for (const m of metricsData) {
      const metric = document.createElement('div');
      metric.className = 'pace-summary__mobile-metric';

      const label = document.createElement('span');
      label.className = 'pace-summary__mobile-metric-label';
      label.textContent = m.label;

      const value = document.createElement('span');
      value.className = 'pace-summary__mobile-metric-value ' + m.cls;
      value.textContent = m.value;

      metric.appendChild(label);
      metric.appendChild(value);
      metrics.appendChild(metric);
    }

    card.appendChild(metrics);
    mobileContainer.appendChild(card);
  }

  section.appendChild(mobileContainer);
  return section;
}
