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

  const metrics = document.createElement('div');
  metrics.className = 'contact-summary__metrics';

  for (const entry of entries) {
    const c = entry.contacts;
    const metric = document.createElement('div');
    metric.className = 'contact-summary__metric';

    const driver = document.createElement('div');
    driver.className = 'contact-summary__driver';
    driver.textContent = entry.driver.nickname;

    const impact = document.createElement('div');
    impact.className = 'contact-summary__impact';
    if (c.maximumImpactKmh > 120) {
      impact.className += ' contact-summary__impact--critical';
    } else if (c.maximumImpactKmh > 80) {
      impact.className += ' contact-summary__impact--warning';
    } else {
      impact.className += ' contact-summary__impact--neutral';
    }
    impact.textContent = formatSpeed(c.maximumImpactKmh);

    const car = document.createElement('div');
    car.className = 'contact-summary__car';
    car.textContent = `#${entry.car.number} · ${c.damagingSampleCount} damaging samples`;

    metric.appendChild(driver);
    metric.appendChild(impact);
    metric.appendChild(car);
    metrics.appendChild(metric);
  }

  section.appendChild(metrics);

  const note = document.createElement('p');
  note.className = 'contact-summary__note';
  note.textContent = 'Collision records are sampled contact data points, not necessarily unique incidents. Sustained contact can produce many samples.';
  section.appendChild(note);

  return section;
}
