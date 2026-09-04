import { formatTime } from '../formatters.js';

export function createLeaderboard(session) {
  const section = document.createElement('section');
  section.className = 'panel leaderboard';
  section.setAttribute('aria-label', 'Leaderboard');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'LEADERBOARD';
  section.appendChild(title);

  const table = document.createElement('table');
  table.className = 'leaderboard__table';
  table.setAttribute('summary', 'Driver standings by best lap time');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Pos</th>
      <th scope="col">Driver</th>
      <th scope="col">Car</th>
      <th scope="col" aria-label="Best lap time">Best Lap</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const classified = session.entries.filter(e => e.bestLapMs !== null);
  const unclassified = session.entries.filter(e => e.bestLapMs === null);

  let pos = 1;
  for (const entry of classified) {
    const tr = document.createElement('tr');
    if (entry.bestLapMs === session.bestLapMs) tr.className = 'leaderboard__row--best';

    const tdPos = document.createElement('td');
    tdPos.className = 'leaderboard__pos';
    tdPos.textContent = String(pos);
    tr.appendChild(tdPos);

    const tdDriver = document.createElement('td');
    tdDriver.className = 'leaderboard__driver';
    tdDriver.textContent = entry.driver.nickname;
    tr.appendChild(tdDriver);

    const tdCar = document.createElement('td');
    tdCar.className = 'leaderboard__car';
    tdCar.textContent = entry.car.model;
    tr.appendChild(tdCar);

    const tdTime = document.createElement('td');
    tdTime.className = 'leaderboard__time';
    tdTime.textContent = formatTime(entry.bestLapMs);
    tr.appendChild(tdTime);

    tbody.appendChild(tr);
    pos++;
  }

  for (const entry of unclassified) {
    const tr = document.createElement('tr');
    tr.className = 'leaderboard__row--no-lap';

    const tdPos = document.createElement('td');
    tdPos.className = 'leaderboard__pos';
    tdPos.textContent = '—';
    tr.appendChild(tdPos);

    const tdDriver = document.createElement('td');
    tdDriver.className = 'leaderboard__driver';
    tdDriver.textContent = entry.driver.nickname;
    tr.appendChild(tdDriver);

    const tdCar = document.createElement('td');
    tdCar.className = 'leaderboard__car';
    tdCar.textContent = entry.car.model;
    tr.appendChild(tdCar);

    const tdTime = document.createElement('td');
    tdTime.className = 'leaderboard__time';
    tdTime.textContent = '—';
    tr.appendChild(tdTime);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}
