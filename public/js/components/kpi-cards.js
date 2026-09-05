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
      label: 'COMPLETED LAPS',
      value: String(session.completedLapCount),
      detail: session.entriesCount > 0 ? `${session.entriesCount} driver${session.entriesCount > 1 ? 's' : ''}` : '',
    },
    {
      label: 'BEST IMPROVEMENT',
      value: session.largestImprovementMs !== null ? formatTimeDelta(session.largestImprovementMs) : '—',
      detail: session.largestImprovementMs !== null ? getImprovementDriver(session) : '',
    },
    {
      label: 'TOP IMPACT',
      value: formatSpeed(session.maxImpactKmh),
      detail: session.maxImpactKmh > 0 ? getTopImpactDriver(session) : '',
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

function getImprovementDriver(session) {
  if (!session.entries || session.largestImprovementMs === null) return '';
  let bestDriver = '';
  for (const entry of session.entries) {
    if (entry.laps.length >= 2) {
      const sorted = [...entry.laps].sort((a, b) => a.timeMs - b.timeMs);
      const improvement = sorted[sorted.length - 1].timeMs - sorted[0].timeMs;
      if (improvement === session.largestImprovementMs) {
        bestDriver = entry.driver.nickname;
        break;
      }
    }
  }
  return bestDriver;
}

function getTopImpactDriver(session) {
  if (!session.entries || session.maxImpactKmh <= 0) return '';
  const entry = session.entries.find(e => e.contacts.maximumImpactKmh === session.maxImpactKmh);
  return entry ? entry.driver.nickname : '';
}
