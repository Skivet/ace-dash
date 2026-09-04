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
  ).sort((a, b) => a.timeMs - b.timeMs);

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
    label.className = 'lap-chart__label';
    label.textContent = `${lap.driverNickname} L${lap.lapNumber}`;

    const barWrapper = document.createElement('div');
    barWrapper.className = 'lap-chart__bar-wrapper';

    const bar = document.createElement('div');
    bar.className = 'lap-chart__bar';
    const pct = Math.max(2, (lap.timeMs - baseline) * scale);
    bar.style.width = `${pct}%`;
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label',
      `${lap.driverNickname}, Lap ${lap.lapNumber}: ${formatTime(lap.timeMs)}`
    );

    const timeLabel = document.createElement('span');
    timeLabel.className = 'lap-chart__time';
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

  const table = document.createElement('table');
  table.className = 'lap-chart__table';
  table.setAttribute('summary', 'All completed laps in chronological order by time');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th scope="col">Driver</th><th scope="col">Lap</th><th scope="col">Time</th><th scope="col">Flag</th></tr>';
  const tbody = document.createElement('tbody');
  for (const lap of allLaps) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = lap.driverNickname;
    const td2 = document.createElement('td'); td2.textContent = `L${lap.lapNumber}`;
    const td3 = document.createElement('td'); td3.textContent = formatTime(lap.timeMs);
    const td4 = document.createElement('td'); td4.textContent = `Unknown (${lap.flags})`;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);

  const screenReaderNote = document.createElement('p');
  screenReaderNote.className = 'sr-only';
  screenReaderNote.textContent = 'Lap times shown as horizontal bars. Flag values 1 and 2 are raw ACE values whose meanings are not yet verified.';

  section.appendChild(chart);
  section.appendChild(baselineLabel);
  section.appendChild(table);
  section.appendChild(screenReaderNote);

  return section;
}
