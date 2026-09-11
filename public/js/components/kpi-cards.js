import { formatTime, formatTimeDelta, formatGap } from '../formatters.js';

const VALID_LAP_FLAG = 2;

function isValidLap(lap) {
  return lap?.flags === VALID_LAP_FLAG && Number.isFinite(lap.timeMs) && lap.timeMs > 0;
}

export function createKpiCards(session) {
  const container = document.createElement('section');
  container.className = 'kpi-strip';
  container.setAttribute('aria-label', 'Key performance indicators');

  const classifiedCount = (session.entries || []).filter(e => e.bestLapMs !== null).length;

  const invalidCount = session.invalidLapCount || 0;
  const validCount = session.validLapCount || 0;

  const cards = [
    {
      label: 'BEST LAP',
      value: session.bestLapMs !== null ? formatTime(session.bestLapMs) : '—',
      detail: session.bestLapMs !== null ? getBestLapDriver(session) : '',
    },
    {
      label: 'VALID LAPS',
      value: String(validCount),
      detail: invalidCount > 0
        ? `${invalidCount} invalid lap${invalidCount > 1 ? 's' : ''} excluded`
        : classifiedCount > 0 ? `${classifiedCount} driver${classifiedCount > 1 ? 's' : ''} with laps` : '',
    },
    {
      label: 'BEST IMPROVEMENT',
      value: session.largestImprovementMs !== null ? formatTimeDelta(session.largestImprovementMs) : '—',
      detail: session.largestImprovementMs !== null ? getImprovementDriver(session) : '',
    },
    {
      label: 'LEADER GAP',
      value: getLeaderGapValue(session),
      detail: getLeaderGapDetail(session),
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
    const validLaps = entry.laps.filter(l => isValidLap(l));
    if (validLaps.length >= 2) {
      const sorted = [...validLaps].sort((a, b) => a.timeMs - b.timeMs);
      const improvement = sorted[sorted.length - 1].timeMs - sorted[0].timeMs;
      if (improvement === session.largestImprovementMs) {
        bestDriver = entry.driver.nickname;
        break;
      }
    }
  }
  return bestDriver;
}

function getLeaderGapValue(session) {
  if (!session.entries || session.leaderGapMs === null) return '—';
  const classified = session.entries.filter(e => e.bestLapMs !== null);
  if (classified.length < 2) return '—';
  if (session.leaderGapMs === 0) return 'TIE';
  return formatTimeDelta(session.leaderGapMs);
}

function getLeaderGapDetail(session) {
  if (!session.entries || session.leaderGapMs === null) return '';
  const classified = session.entries.filter(e => e.bestLapMs !== null);
  if (classified.length < 2) return '';
  if (session.leaderGapMs === 0) return 'TIED LEADER';
  return 'P1 to P2';
}
