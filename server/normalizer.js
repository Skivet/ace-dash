/**
 * Normalizes raw ACE results JSON into the dashboard session model.
 */

function compositeId(value) {
  if (!value || typeof value !== 'object' || typeof value.a !== 'string' || typeof value.b !== 'string') {
    return null;
  }
  return `${value.a}:${value.b}`;
}

function normalizeTime(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value);
  const parsed = Number(value);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed);
}

function normalizeFloat(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (isNaN(parsed)) return 0;
  return parsed;
}

function normalizeLap(lap) {
  const driverKey = compositeId(lap.driver_key);
  const carKey = compositeId(lap.car_key);
  const timeMs = normalizeTime(lap.time);
  return {
    carKey,
    driverKey,
    timeMs,
    flags: lap.flags,
  };
}

function aggregateContacts(collisions, carId) {
  const samples = (collisions || []).filter(c => compositeId(c.car_id) === carId);
  if (samples.length === 0) {
    return { sampleCount: 0, damagingSampleCount: 0, maximumImpactKmh: 0 };
  }
  const maxImpact = Math.max(...samples.map(c => normalizeFloat(c.relative_impact_kmh)));
  const damagingCount = samples.filter(c => c.has_damage === true).length;
  return {
    sampleCount: samples.length,
    damagingSampleCount: damagingCount,
    maximumImpactKmh: maxImpact,
  };
}

function buildPenaltiesMap(penaltyCollection) {
  const map = {};
  const penalties = penaltyCollection?.session_penalties || [];
  for (const entry of penalties) {
    const carId = compositeId(entry.car_id);
    if (!carId) continue;
    const cleared = (entry.cleared_penalties || []).map(p => ({
      type: p.penalty_data?.type,
      penaltyTimeMs: normalizeTime(p.penalty_data?.penalty_time_ms),
      investigation: p.investigation,
      givenLapCount: p.given_lap_count,
      givenSessionTimeMs: normalizeTime(p.given_session_time_ms),
      clearedSessionTimeMs: normalizeTime(p.cleared_session_time_ms),
    }));
    map[carId] = cleared;
  }
  return map;
}

function normalize(raw) {
  const drivers = raw.drivers || [];
  const cars = raw.cars || [];
  const driverStandings = raw.driver_standings || [];
  const carStandings = raw.car_standings || [];
  const lapsRaw = raw.laps || [];
  const collisions = raw.collisions || [];
  const penaltyCollection = raw.penalty_collection || {};

  const driverMap = new Map();
  for (const d of drivers) {
    const id = compositeId(d.guid);
    if (id && !driverMap.has(id)) {
      driverMap.set(id, {
        id,
        nickname: d.nickname || d.first_name || '',
        nation: d.nation || '',
      });
    }
  }

  const carMap = new Map();
  for (const c of cars) {
    const id = compositeId(c.car_id);
    if (id && !carMap.has(id)) {
      carMap.set(id, {
        id,
        model: c.model_displayname || '',
        number: typeof c.race_number === 'number' ? c.race_number : 0,
      });
    }
  }

  const entries = [];
  const len = Math.max(driverStandings.length, carStandings.length);
  for (let i = 0; i < len; i++) {
    const driverKey = compositeId(driverStandings[i]);
    const carKey = compositeId(carStandings[i]?.car_id);
    if (!driverKey || !carKey) continue;

    const driver = driverMap.get(driverKey);
    const car = carMap.get(carKey);
    if (!driver || !car) continue;

    const entryId = `${driverKey}:${carKey}`;
    const entryLaps = lapsRaw
      .map(normalizeLap)
      .filter(l => l.driverKey === driverKey && l.carKey === carKey && l.timeMs > 0);

    const bestLapMs = entryLaps.length > 0 ? Math.min(...entryLaps.map(l => l.timeMs)) : null;

    entries.push({
      id: entryId,
      driver: {
        id: driver.id,
        nickname: driver.nickname,
        nation: driver.nation,
      },
      car: {
        id: car.id,
        model: car.model,
        number: car.number,
      },
      laps: entryLaps.map((l, idx) => ({
        number: idx + 1,
        timeMs: l.timeMs,
        flags: l.flags,
      })),
      bestLapMs,
      contacts: aggregateContacts(collisions, carKey),
    });
  }

  const penaltiesMap = buildPenaltiesMap(penaltyCollection);
  for (const entry of entries) {
    entry.penalties = penaltiesMap[entry.car.id] || [];
  }

  entries.sort((a, b) => {
    if (a.bestLapMs !== null && b.bestLapMs !== null) return a.bestLapMs - b.bestLapMs;
    if (a.bestLapMs !== null) return -1;
    if (b.bestLapMs !== null) return 1;
    return 0;
  });

  const allLaps = entries.flatMap(e => e.laps);
  const completedLapCount = allLaps.length;
  const bestLapMs = allLaps.length > 0 ? Math.min(...allLaps.map(l => l.timeMs)) : null;

  let largestImprovementMs = null;
  for (const entry of entries) {
    if (entry.laps.length >= 2) {
      const sorted = [...entry.laps].sort((a, b) => a.timeMs - b.timeMs);
      const improvement = sorted[sorted.length - 1].timeMs - sorted[0].timeMs;
      if (improvement > 0) {
        if (largestImprovementMs === null || improvement > largestImprovementMs) {
          largestImprovementMs = improvement;
        }
      }
    }
  }

  let maxImpactKmh = 0;
  for (const entry of entries) {
    if (entry.contacts.maximumImpactKmh > maxImpactKmh) {
      maxImpactKmh = entry.contacts.maximumImpactKmh;
    }
  }

  const normalized = {
    id: null,
    source: {
      filename: '',
      importedAt: '',
      fileModifiedAt: '',
    },
    track: {
      name: raw.track_name || '',
      layout: raw.track_layout_name || '',
    },
    session: {
      name: raw.session_name || '',
      type: raw.session_type || '',
      completed: raw.is_completed === true,
      durationMs: normalizeTime(raw.specialization?.base?.session_duration_ms),
    },
    entries,
    bestLapMs,
    completedLapCount,
    largestImprovementMs,
    maxImpactKmh,
  };

  return normalized;
}

export { normalize, compositeId };
