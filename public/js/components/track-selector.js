export function createTrackSelector(tracks, selectedTrack, selectedLayout, onSelect) {
  const container = document.createElement('div');
  container.className = 'track-selector';

  const label = document.createElement('label');
  label.className = 'track-selector__label';
  label.textContent = 'TRACK';

  const select = document.createElement('select');
  select.className = 'track-selector__select';
  select.setAttribute('aria-label', 'Select track and layout');

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'All tracks';
  select.appendChild(defaultOpt);

  for (const t of tracks) {
    const opt = document.createElement('option');
    opt.value = `${t.name}|${t.layout}`;
    opt.textContent = `${t.name} — ${t.layout} (${t.sessionCount})`;
    if (selectedTrack === t.name && selectedLayout === t.layout) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const val = select.value;
    if (!val) {
      onSelect(null, null);
      return;
    }
    const sep = val.indexOf('|');
    onSelect(val.slice(0, sep), val.slice(sep + 1));
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}
