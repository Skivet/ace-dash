import { formatTime, formatTimeDelta, formatSpeed } from '../formatters.js';

export function createKpiCards(session) {
  const container = document.createElement('section');
  container.className = 'kpi-strip';
  container.setAttribute('aria-label', 'Key performance indicators');

  const cards = [
    {
      label: 'BEST LAP',
      value: session.bestLapMs !== null ? formatTime(session.bestLapMs) : '—',
      detail: session.bestLapMs !== null ? getBestLapDriver(session) : '',
    },
    {
      label: 'LAPS',
      value: String(session.completedLapCount),
      detail: session.entriesCount > 0 ? `${session.entriesCount} driver${session.entriesCount > 1 ? 's' : ''}` : '',
    },
    {
      label: 'IMPROVEMENT',
      value: session.largestImprovementMs !== null ? formatTimeDelta(session.largestImprovementMs) : '—',
      detail: session.largestImprovementMs !== null ? 'largest gain' : '',
    },
    {
      label: 'TOP IMPACT',
      value: formatSpeed(session.maxImpactKmh),
      detail: session.maxImpactKmh > 0 ? 'maximum recorded' : '',
    },
  ];

  for (const card of cards) {
    const el = document.createElement('article');
    el.className = 'kpi-card';

    const label = document.createElement('span');
    label.className = 'kpi-card__label';
    label.textContent = card.label;

    const value = document.createElement('strong');
    value.className = 'kpi-card__value';
    value.textContent = card.value;

    const detail = document.createElement('span');
    detail.className = 'kpi-card__detail';
    detail.textContent = card.detail;

    el.appendChild(label);
    el.appendChild(value);
    el.appendChild(detail);
    container.appendChild(el);
  }

  return container;
}

function getBestLapDriver(session) {
  if (!session.entries || session.bestLapMs === null) return '';
  const entry = session.entries.find(e => e.bestLapMs === session.bestLapMs);
  return entry ? entry.driver.nickname : '';
}


