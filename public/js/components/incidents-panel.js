import { formatTime, formatTimeDelta } from '../formatters.js';

const PENALTY_TYPE_LABELS = {
  'PenaltyType_Warning': 'Warning',
  'PenaltyType_MP_TeleportToPit': 'Teleport to pits',
  'PenaltyType_Disqualification': 'Disqualification',
  'PenaltyType_DriveThrough': 'Drive-through',
  'PenaltyType_StopAndGo': 'Stop-and-go',
  'PenaltyType_TimePenalty': 'Time penalty',
};

const INVESTIGATION_TYPE_LABELS = {
  'InvestigationType_Speeding': 'Pit-lane speeding',
  'InvestigationType_WrongWay': 'Wrong-way',
  'InvestigationType_RaceCarCut': 'Track cut',
};

function formatEnumLabel(value, map) {
  if (!value) return '—';
  if (map[value]) return map[value];
  const parts = value.split('_');
  if (parts.length <= 1) return value;
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function hasPenalties(session) {
  return (session.entries || []).some(e => (e.penalties || []).length > 0);
}

function hasContacts(session) {
  return (session.entries || []).some(e => e.contacts.sampleCount > 0);
}

function createPenaltyRow(penalty, entry) {
  const row = document.createElement('div');
  row.className = 'incidents-penalties__penalty-row';

  const identity = document.createElement('div');
  identity.className = 'incidents-penalties__penalty-identity';

  const driver = document.createElement('span');
  driver.className = 'incidents-penalties__penalty-driver';
  driver.textContent = entry.driver.nickname;

  const car = document.createElement('span');
  car.className = 'incidents-penalties__penalty-car';
  car.textContent = entry.car.model;

  identity.appendChild(driver);
  identity.appendChild(car);

  const investigation = document.createElement('div');
  investigation.className = 'incidents-penalties__penalty-detail';
  investigation.textContent = formatEnumLabel(penalty.investigation, INVESTIGATION_TYPE_LABELS);

  const penaltyType = document.createElement('div');
  penaltyType.className = 'incidents-penalties__penalty-type';
  penaltyType.textContent = formatEnumLabel(penalty.type, PENALTY_TYPE_LABELS);

  const timeMs = document.createElement('div');
  timeMs.className = 'incidents-penalties__penalty-time';
  timeMs.textContent = penalty.penaltyTimeMs > 0 ? formatTimeDelta(penalty.penaltyTimeMs) : '—';

  const lapCount = document.createElement('div');
  lapCount.className = 'incidents-penalties__penalty-lap';
  lapCount.textContent = penalty.givenLapCount > 0 ? `Lap ${penalty.givenLapCount}` : '—';

  const sessionTime = document.createElement('div');
  sessionTime.className = 'incidents-penalties__penalty-session-time';
  sessionTime.textContent = penalty.givenSessionTimeMs > 0 ? formatTimeDelta(penalty.givenSessionTimeMs) : '—';

  const state = document.createElement('div');
  state.className = 'incidents-penalties__penalty-state';
  if (penalty.clearedSessionTimeMs > 0) {
    state.className += ' incidents-penalties__penalty-state--cleared';
    state.textContent = 'Cleared';
  } else {
    state.className += ' incidents-penalties__penalty-state--pending';
    state.textContent = 'Pending';
  }

  row.appendChild(identity);
  row.appendChild(investigation);
  row.appendChild(penaltyType);
  row.appendChild(timeMs);
  row.appendChild(lapCount);
  row.appendChild(sessionTime);
  row.appendChild(state);
  return row;
}

export function createIncidentsPanel(session) {
  const hasAny = hasPenalties(session) || hasContacts(session);

  if (!hasAny) {
    return null;
  }

  const details = document.createElement('details');
  details.className = 'incidents-disclosure';

  const summary = document.createElement('summary');
  summary.className = 'incidents-disclosure__summary';

  const penaltyCount = (session.entries || []).flatMap(e => e.penalties || []).length;
  const contactCount = (session.entries || []).filter(e => e.contacts.sampleCount > 0).length;

  const parts = [];
  if (penaltyCount > 0) parts.push(`${penaltyCount} penalty${penaltyCount > 1 ? 's' : ''}`);
  if (contactCount > 0) parts.push('contact data available');
  summary.textContent = `Incidents & Penalties\n${parts.join(' · ')}`;
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', 'false');

  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'incidents-disclosure__body';

  if (hasPenalties(session)) {
    const penSection = document.createElement('div');
    penSection.className = 'incidents-subsection';

    const penTitle = document.createElement('h4');
    penTitle.className = 'incidents-subsection__title';
    penTitle.textContent = 'PENALTIES';
    penSection.appendChild(penTitle);

    const penList = document.createElement('div');
    penList.className = 'incidents-penalties__list';

    const penHeader = document.createElement('div');
    penHeader.className = 'incidents-penalties__header';

    const penHeaders = [
      { text: 'DRIVER / CAR', className: 'incidents-penalties__col-identity' },
      { text: 'INVESTIGATION', className: 'incidents-penalties__col-investigation' },
      { text: 'TYPE', className: 'incidents-penalties__col-type' },
      { text: 'TIME', className: 'incidents-penalties__col-time' },
      { text: 'LAP', className: 'incidents-penalties__col-lap' },
      { text: 'SESSION TIME', className: 'incidents-penalties__col-session-time' },
      { text: 'STATE', className: 'incidents-penalties__col-state' },
    ];

    for (const h of penHeaders) {
      const el = document.createElement('div');
      el.className = h.className;
      el.textContent = h.text;
      penHeader.appendChild(el);
    }
    penList.appendChild(penHeader);

    for (const entry of session.entries) {
      for (const penalty of entry.penalties) {
        penList.appendChild(createPenaltyRow(penalty, entry));
      }
    }

    penSection.appendChild(penList);
    body.appendChild(penSection);
  }

  if (hasContacts(session)) {
    const contactSection = document.createElement('div');
    contactSection.className = 'incidents-subsection';

    const contactTitle = document.createElement('h4');
    contactTitle.className = 'incidents-subsection__title';
    contactTitle.textContent = 'CONTACT DATA';
    contactSection.appendChild(contactTitle);

    const entriesWithContacts = session.entries
      .filter(e => e.contacts.sampleCount > 0)
      .sort((a, b) => b.contacts.maximumImpactKmh - a.contacts.maximumImpactKmh);

    const contactList = document.createElement('div');
    contactList.className = 'incidents-contacts__list';

    for (const entry of entriesWithContacts) {
      const c = entry.contacts;
      const row = document.createElement('div');
      row.className = 'incidents-contacts__row';

      const identity = document.createElement('div');
      identity.className = 'incidents-contacts__identity';

      const driver = document.createElement('span');
      driver.className = 'incidents-contacts__driver';
      driver.textContent = entry.driver.nickname;

      const car = document.createElement('span');
      car.className = 'incidents-contacts__car';
      car.textContent = entry.car.model;

      identity.appendChild(driver);
      identity.appendChild(car);

      const impact = document.createElement('div');
      impact.className = 'incidents-contacts__impact';
      impact.textContent = c.maximumImpactKmh > 0 ? `${c.maximumImpactKmh.toFixed(1)} km/h` : '—';

      const samples = document.createElement('div');
      samples.className = 'incidents-contacts__samples';
      samples.textContent = `${c.sampleCount} samples`;

      const damaging = document.createElement('div');
      damaging.className = 'incidents-contacts__damaging';
      damaging.textContent = `${c.damagingSampleCount} damaging`;

      row.appendChild(identity);
      row.appendChild(impact);
      row.appendChild(samples);
      row.appendChild(damaging);
      contactList.appendChild(row);
    }

    contactSection.appendChild(contactList);

    const note = document.createElement('p');
    note.className = 'incidents-contacts__note';
    note.textContent = 'Contact records are sampled data points, not necessarily unique incidents. Sustained contact can produce many samples.';
    contactSection.appendChild(note);

    body.appendChild(contactSection);
  }

  details.appendChild(body);
  return details;
}
