import { formatTime } from '../formatters.js';

export function createLapChart(session) {
  const section = document.createElement('section');
  section.className = 'panel lap-chart';
  section.setAttribute('aria-label', 'Completed laps');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'VALID LAPS';
  section.appendChild(title);

  const validCount = session.validLapCount || 0;
  const invalidCount = session.invalidLapCount || 0;
  const titleDetail = document.createElement('span');
  titleDetail.className = 'panel__title-detail';
  titleDetail.textContent = invalidCount > 0 ? `${validCount} valid · ${invalidCount} invalid` : `${validCount} valid`;
  title.after(titleDetail);

  if (session.completedLapCount === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No completed laps in this session.';
    section.appendChild(empty);
    return section;
  }

  const allLaps = session.entries.flatMap(e =>
    e.laps.map(l => ({
      driverNickname: e.driver.nickname,
      carModel: e.car.model,
      lapNumber: l.number,
      timeMs: l.timeMs,
      flags: l.flags,
      isValid: l.isValid,
    }))
  );

  const validLaps = allLaps.filter(lap => lap.isValid);
  const maxTime = validLaps.length > 0 ? Math.max(...validLaps.map(l => l.timeMs)) : null;
  const minTime = validLaps.length > 0 ? Math.min(...validLaps.map(l => l.timeMs)) : null;
  const range = validLaps.length > 0 ? maxTime - minTime || 1000 : null;
  const baseline = validLaps.length > 0 ? minTime - range * 0.05 : null;
  const scale = validLaps.length > 0 ? 100 / (maxTime - baseline) : null;

  const chart = document.createElement('div');
  chart.className = 'lap-chart__bars';

  for (const lap of allLaps) {
    const row = document.createElement('div');
    row.className = 'lap-chart__row' + (!lap.isValid ? ' lap-chart__row--invalid' : '');

    const label = document.createElement('span');
    label.className = 'lap-chart__label' + (lap.isValid && lap.timeMs === session.bestValidLapMs ? ' lap-chart__label--best' : '');
    label.textContent = `${lap.driverNickname} L${lap.lapNumber}`;

    const barWrapper = document.createElement('div');
    barWrapper.className = 'lap-chart__bar-wrapper';

    const bar = document.createElement('div');
    bar.className = 'lap-chart__bar' + (lap.isValid && lap.timeMs === session.bestValidLapMs ? ' lap-chart__bar--best' : '') + (!lap.isValid ? ' lap-chart__bar--invalid' : '');
    const pct = lap.isValid ? Math.min(100, Math.max(2, (lap.timeMs - baseline) * scale)) : 18;
    bar.style.width = `${pct}%`;
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label',
      `${lap.driverNickname}, Lap ${lap.lapNumber}: ${formatTime(lap.timeMs)}${!lap.isValid ? ' (invalid)' : ''}`
    );

    const timeLabel = document.createElement('span');
    timeLabel.className = 'lap-chart__time' + (lap.isValid && lap.timeMs === session.bestValidLapMs ? ' lap-chart__time--best' : '');
    timeLabel.textContent = formatTime(lap.timeMs);

    const flagLabel = document.createElement('span');
    flagLabel.className = 'lap-chart__flag';
    flagLabel.textContent = lap.isValid ? 'VALID' : 'INVALID';

    barWrapper.appendChild(bar);
    barWrapper.appendChild(timeLabel);
    barWrapper.appendChild(flagLabel);

    row.appendChild(label);
    row.appendChild(barWrapper);
    chart.appendChild(row);
  }

  const baselineLabel = document.createElement('div');
  baselineLabel.className = 'lap-chart__baseline';
  baselineLabel.textContent = baseline === null ? 'Baseline: NO VALID LAP' : `Baseline: ${formatTime(Math.round(baseline))}`;

  const screenReaderNote = document.createElement('p');
  screenReaderNote.className = 'sr-only';
  screenReaderNote.textContent = 'Lap times shown as horizontal bars. Valid laps are marked VALID; invalid laps are marked INVALID and dimmed.';

  section.appendChild(chart);
  section.appendChild(baselineLabel);
  section.appendChild(screenReaderNote);

  return section;
}
