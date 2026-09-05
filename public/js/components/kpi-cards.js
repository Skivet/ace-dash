import { formatTime, formatTimeDelta, formatGap } from '../formatters.js';

export function createKpiCards(session) {
  const container = document.createElement('section');
  container.className = 'kpi-strip';
  container.setAttribute('aria-label', 'Key performance indicators');

  const classifiedCount = (session.entries || []).filter(e => e.bestLapMs !== null).length;

  const cards = [
    {
      label: 'BEST LAP',
      value: session.bestLapMs !== null ? formatTime(session.bestLapMs) : '—',
      detail: session.bestLapMs !== null ? getBestLapDriver(session) : '',
    },
    {
      label: 'COMPLETED LAPS',
      value: String(session.completedLapCount),
      detail: classifiedCount > 0 ? `${classifiedCount} driver${classifiedCount > 1 ? 's' : ''} with laps` : '',
    },
    {
      label: 'BEST IMPROVEMENT',
      value: session.largestImprovementMs !== null ? formatTimeDelta(session.largestImprovementMs) : '—',
      detail: session.largestImprovementMs !== null ? getImprovementDriver(session) : '',
    },
    {
      label: 'LEADER GAP',
      value: session.leaderGapMs !== null ? formatTimeDelta(session.leaderGapMs) : '—',
      detail: session.leaderGapMs !== null ? getLeaderGapDetail(session) : 'Need two classified entries',
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

function getLeaderGapDetail(session) {
  if (!session.entries || session.leaderGapMs === null) return '';
  const classified = session.entries.filter(e => e.bestLapMs !== null);
  if (classified.length < 2) return '';
  const p1 = classified[0];
  const p2 = classified[1];
  return `P1 to P2`;
}
