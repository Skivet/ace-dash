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

  for (const s of sessions) {
    const li = document.createElement('li');
    li.className = 'session-history__item';

    const button = document.createElement('button');
    button.className = 'session-history__btn';
    button.setAttribute('aria-label', `View session: ${s.track.name}, ${s.session.type}, ${formatDateTime(s.source.importedAt)}`);
    if (s.id === selectedId) {
      button.setAttribute('aria-selected', 'true');
    }

    const date = document.createElement('span');
    date.className = 'session-history__date';
    date.textContent = formatDate(s.source.importedAt);

    const track = document.createElement('span');
    track.className = 'session-history__track';
    track.textContent = `${s.track.name} · ${s.track.layout}`;

    const meta = document.createElement('span');
    meta.className = 'session-history__meta';
    meta.textContent = `${s.session.type} · ${s.entriesCount} drivers · ${s.completedLapCount} laps`;

    if (s.bestLapMs !== null) {
      const best = document.createElement('span');
      best.className = 'session-history__best';
      best.textContent = `${s.bestDriverNickname}  ${formatBestLap(s.bestLapMs)}`;
      meta.appendChild(best);
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
