import { formatTime } from '../formatters.js';

export function createLapChart(session) {
  const section = document.createElement('section');
  section.className = 'panel lap-chart';
  section.setAttribute('aria-label', 'Completed laps');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'COMPLETED LAPS';
  section.appendChild(title);

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
    }))
  );

  const maxTime = Math.max(...allLaps.map(l => l.timeMs));
  const minTime = Math.min(...allLaps.map(l => l.timeMs));
  const range = maxTime - minTime || 1000;
  const baseline = minTime - range * 0.05;
  const scale = 100 / (maxTime - baseline);

  const chart = document.createElement('div');
  chart.className = 'lap-chart__bars';

  for (const lap of allLaps) {
    const row = document.createElement('div');
    row.className = 'lap-chart__row';

    const label = document.createElement('span');
    label.className = 'lap-chart__label' + (lap.timeMs === session.bestLapMs ? ' lap-chart__label--best' : '');
    label.textContent = `${lap.driverNickname} L${lap.lapNumber}`;

    const barWrapper = document.createElement('div');
    barWrapper.className = 'lap-chart__bar-wrapper';

    const bar = document.createElement('div');
    bar.className = 'lap-chart__bar' + (lap.timeMs === session.bestLapMs ? ' lap-chart__bar--best' : '');
    const pct = Math.max(2, (lap.timeMs - baseline) * scale);
    bar.style.width = `${pct}%`;
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label',
      `${lap.driverNickname}, Lap ${lap.lapNumber}: ${formatTime(lap.timeMs)}`
    );

    const timeLabel = document.createElement('span');
    timeLabel.className = 'lap-chart__time' + (lap.timeMs === session.bestLapMs ? ' lap-chart__time--best' : '');
    timeLabel.textContent = formatTime(lap.timeMs);

    const flagLabel = document.createElement('span');
    flagLabel.className = 'lap-chart__flag';
    flagLabel.textContent = `flag ${lap.flags}`;
    flagLabel.setAttribute('title', 'Flag value — meaning not yet verified');

    barWrapper.appendChild(bar);
    barWrapper.appendChild(timeLabel);
    barWrapper.appendChild(flagLabel);

    row.appendChild(label);
    row.appendChild(barWrapper);
    chart.appendChild(row);
  }

  const baselineLabel = document.createElement('div');
  baselineLabel.className = 'lap-chart__baseline';
  baselineLabel.textContent = `Baseline: ${formatTime(Math.round(baseline))}`;

  const screenReaderNote = document.createElement('p');
  screenReaderNote.className = 'sr-only';
  screenReaderNote.textContent = 'Lap times shown as horizontal bars. Flag values 1 and 2 are raw ACE values whose meanings are not yet verified.';

  section.appendChild(chart);
  section.appendChild(baselineLabel);
  section.appendChild(screenReaderNote);

  return section;
}
