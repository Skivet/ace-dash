import { formatDateTime, formatDate } from '../formatters.js';

export function createSessionHistory(sessions, onSelect, selectedId) {
  const section = document.createElement('section');
  section.className = 'session-history';
  section.setAttribute('aria-label', 'Session history');

  const title = document.createElement('h3');
  title.className = 'session-history__title';
  title.textContent = 'SESSION HISTORY';
  section.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'session-history__list';

  const validSessions = sessions.filter(s =>
    (s.track?.name || '').length > 0 ||
    (s.session?.type || '').length > 0 ||
    (s.completedLapCount || 0) > 0
  );

  for (const s of validSessions) {
    const li = document.createElement('li');
    li.className = 'session-history__item';

    const button = document.createElement('button');
    button.className = 'session-history__btn';
    button.setAttribute('aria-label', `View session: ${s.track?.name || 'Unknown'}, ${s.session?.type || 'Unknown'}, ${formatDateTime(s.source?.importedAt)}`);
    if (s.id === selectedId) {
      button.setAttribute('aria-selected', 'true');
    }

    const date = document.createElement('span');
    date.className = 'session-history__date';
    date.textContent = s.source?.importedAt ? formatDate(s.source.importedAt) : '—';

    const track = document.createElement('span');
    track.className = 'session-history__track';
    track.textContent = `${s.track?.name || 'Unknown'} · ${s.track?.layout || 'Unknown'}`;

    const validLapCount = s.validLapCount ?? 0;
    const invalidLapCount = s.invalidLapCount ?? 0;
    const meta = document.createElement('span');
    meta.className = 'session-history__meta';
    meta.textContent = `${s.session?.type || '—'} · ${s.entriesCount || 0} drivers · ${validLapCount} valid laps`;

    if (invalidLapCount > 0) {
      const invalidSpan = document.createElement('span');
      invalidSpan.className = 'session-history__invalid';
      invalidSpan.textContent = `${invalidLapCount} invalid`;
      meta.appendChild(invalidSpan);
    }

    if (s.bestLapMs !== null) {
      const best = document.createElement('span');
      best.className = 'session-history__best';
      best.textContent = `${s.bestDriverNickname || '—'}  ${formatBestLap(s.bestLapMs)}`;
      meta.appendChild(best);
    } else if (validLapCount === 0 && (s.completedLapCount || 0) > 0) {
      const noValid = document.createElement('span');
      noValid.className = 'session-history__no-valid';
      noValid.textContent = 'NO VALID LAPS';
      meta.appendChild(noValid);
    }

    button.appendChild(date);
    button.appendChild(track);
    button.appendChild(meta);
    li.appendChild(button);
    button.addEventListener('click', () => onSelect(s));
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
}

function formatBestLap(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms - minutes * 60000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(5, '0')}`;
}
