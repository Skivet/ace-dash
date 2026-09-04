function groupSessionsByDate(sessions) {
  const today = new Date().toLocaleDateString(undefined);
  const groups = new Map();
  for (const s of sessions) {
    const d = new Date(s.source.importedAt);
    const label = d.toLocaleDateString(undefined) === today ? 'TODAY' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(s);
  }
  return groups;
}

export function createSessionHeader(session, sessions, onSelect) {
  const header = document.createElement('header');
  header.className = 'session-header';

  const topBar = document.createElement('div');
  topBar.className = 'session-header__top';

  const logo = document.createElement('h1');
  logo.className = 'session-header__logo';
  logo.textContent = 'ACE Session Analytics';

  const status = document.createElement('span');
  status.className = 'session-header__status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = '● Ready';

  topBar.appendChild(logo);
  topBar.appendChild(status);

  const contextBar = document.createElement('div');
  contextBar.className = 'session-header__context';

  const trackInfo = document.createElement('div');
  trackInfo.className = 'session-header__track-info';

  const trackName = document.createElement('h2');
  trackName.className = 'session-header__track';
  trackName.textContent = session.track.name;

  const trackMeta = document.createElement('div');
  trackMeta.className = 'session-header__meta';
  trackMeta.textContent = `${session.track.layout} / ${session.session.type}`;

  trackInfo.appendChild(trackName);
  trackInfo.appendChild(trackMeta);

  const rightSide = document.createElement('div');
  rightSide.className = 'session-header__right';

  const dateInfo = document.createElement('time');
  dateInfo.className = 'session-header__date';
  dateInfo.setAttribute('datetime', session.source.importedAt);
  dateInfo.textContent = new Date(session.source.importedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const selector = document.createElement('select');
  selector.className = 'session-header__selector';
  selector.setAttribute('aria-label', 'Select session');

  const grouped = groupSessionsByDate(sessions);
  for (const [dateLabel, group] of grouped) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = dateLabel;
    for (const s of group) {
      const opt = document.createElement('option');
      opt.value = s.id;
      const d = new Date(s.source.importedAt);
      opt.textContent = `${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}  ${s.session.type}  ${s.track.name}  ${s.entriesCount} drivers`;
      if (s.id === session.id) opt.selected = true;
      optgroup.appendChild(opt);
    }
    selector.appendChild(optgroup);
  }

  selector.addEventListener('change', () => {
    const selected = sessions.find(s => s.id === selector.value);
    if (selected && onSelect) onSelect(selected);
  });

  rightSide.appendChild(dateInfo);
  rightSide.appendChild(selector);

  contextBar.appendChild(trackInfo);
  contextBar.appendChild(rightSide);

  header.appendChild(topBar);
  header.appendChild(contextBar);

  return header;
}
