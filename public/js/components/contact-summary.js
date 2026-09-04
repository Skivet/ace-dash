import { formatSpeed } from '../formatters.js';

export function createContactSummary(session) {
  const section = document.createElement('section');
  section.className = 'panel contact-summary';
  section.setAttribute('aria-label', 'Contact summary');

  const title = document.createElement('h3');
  title.className = 'panel__title';
  title.textContent = 'CONTACT SUMMARY';
  section.appendChild(title);

  const entries = session.entries.filter(e => e.contacts.sampleCount > 0);
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No contact samples recorded.';
    section.appendChild(empty);
    return section;
  }

  const table = document.createElement('table');
  table.className = 'contact-summary__table';
  table.setAttribute('summary', 'Contact sample statistics per car');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Driver</th>
      <th scope="col">Car</th>
      <th scope="col">Samples</th>
      <th scope="col">Damaging</th>
      <th scope="col">Max Impact</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const entry of entries) {
    const tr = document.createElement('tr');
    const c = entry.contacts;

    const tdDriver = document.createElement('td');
    tdDriver.textContent = entry.driver.nickname;
    tr.appendChild(tdDriver);

    const tdCar = document.createElement('td');
    tdCar.textContent = entry.car.model;
    tr.appendChild(tdCar);

    const tdSamples = document.createElement('td');
    tdSamples.textContent = String(c.sampleCount);
    tr.appendChild(tdSamples);

    const tdDamaging = document.createElement('td');
    tdDamaging.textContent = String(c.damagingSampleCount);
    tr.appendChild(tdDamaging);

    const tdImpact = document.createElement('td');
    tdImpact.className = c.maximumImpactKmh > 100 ? 'contact-summary__impact--high' : '';
    tdImpact.textContent = formatSpeed(c.maximumImpactKmh);
    tr.appendChild(tdImpact);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  const note = document.createElement('p');
  note.className = 'contact-summary__note';
  note.textContent = 'Collision records are sampled contact data points, not necessarily unique incidents. Sustained contact can produce many samples.';
  section.appendChild(note);

  return section;
}
