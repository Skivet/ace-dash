import { formatTime } from '../formatters.js';

export function createLeaderboard(session) {
  const section = document.createElement('section');
  section.className = 'panel leaderboard';
  section.setAttribute('aria-label', 'Leaderboard');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'LEADERBOARD';
  section.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'leaderboard__list';
  list.setAttribute('role', 'list');

  const classified = (session.driverSummaries || []).filter(driver => driver.hasValidLap);
  const unclassified = (session.driverSummaries || []).filter(driver => !driver.hasValidLap);

  for (let i = 0; i < classified.length; i++) {
    const entry = classified[i];

    const li = document.createElement('li');
    li.className = 'leaderboard__row';
    if (entry.isLeader) li.className += ' leaderboard__row--best';

    const posSpan = document.createElement('span');
    posSpan.className = 'leaderboard__pos';
    if (entry.isLeader && entry.isTied) {
      posSpan.textContent = 'TIED';
    } else {
      posSpan.textContent = String(entry.rank);
    }

    const identity = document.createElement('div');
    identity.className = 'leaderboard__identity';

    const driverSpan = document.createElement('span');
    driverSpan.className = 'leaderboard__driver';
    driverSpan.textContent = entry.driverName;

    const carSpan = document.createElement('span');
    carSpan.className = 'leaderboard__car';
    carSpan.textContent = entry.carName;

    identity.appendChild(driverSpan);
    identity.appendChild(carSpan);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'leaderboard__time';
    timeSpan.textContent = formatTime(entry.bestValidLapMs);

    li.appendChild(posSpan);
    li.appendChild(identity);
    li.appendChild(timeSpan);
    list.appendChild(li);

  }

  for (const entry of unclassified) {
    const li = document.createElement('li');
    li.className = 'leaderboard__row leaderboard__row--no-lap';

    const posSpan = document.createElement('span');
    posSpan.className = 'leaderboard__pos';
    posSpan.textContent = entry.validLapCount > 0 ? '—' : 'NV';

    const identity = document.createElement('div');
    identity.className = 'leaderboard__identity';

    const driverSpan = document.createElement('span');
    driverSpan.className = 'leaderboard__driver';
    driverSpan.textContent = entry.driverName;

    const carSpan = document.createElement('span');
    carSpan.className = 'leaderboard__car';
    carSpan.textContent = entry.carName;

    identity.appendChild(driverSpan);
    identity.appendChild(carSpan);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'leaderboard__time';
    timeSpan.textContent = entry.invalidLapCount > 0 ? 'NO VALID LAP' : '—';

    li.appendChild(posSpan);
    li.appendChild(identity);
    li.appendChild(timeSpan);
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
}
