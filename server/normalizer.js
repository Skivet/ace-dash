/**
 * Normalizes raw ACE results JSON into the dashboard session model.
 */

const VALID_LAP_FLAG = 2;

function isValidLap(lap) {
  return lap?.flags === VALID_LAP_FLAG && Number.isFinite(lap.timeMs) && lap.timeMs > 0;
}

/**
 * Parses a session timestamp from a filename containing the pattern
 * results_YYYYMMDD_HHMMSS_<session-type>.json.
 * The pattern may appear anywhere in the filename (tolerant of prefixes).
 * Returns an ISO 8601 string representing the parsed wall-clock time
 * interpreted as server-local time, or null if no timestamp is found.
 */
function parseTimestampFromFilename(filename) {
  if (typeof filename !== 'string') return null;
  const match = filename.match(/results_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const ms = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10),
  );
  if (isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

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

function normalizeLap(lap, sequence) {
  const driverKey = compositeId(lap.driver_key);
  const carKey = compositeId(lap.car_key);
  const timeMs = normalizeTime(lap.time);
  return {
    carKey,
    driverKey,
    timeMs,
    flags: lap.flags,
    isValid: isValidLap({ flags: lap.flags, timeMs }),
    sequence,
  };
}

function getLargestConsecutiveValidImprovement(laps) {
  let largestImprovementMs = null;
  for (let i = 1; i < laps.length; i++) {
    const previous = laps[i - 1];
    const current = laps[i];
    if (!isValidLap(previous) || !isValidLap(current)) continue;
    const improvementMs = previous.timeMs - current.timeMs;
    if (improvementMs > 0 && (largestImprovementMs === null || improvementMs > largestImprovementMs)) {
      largestImprovementMs = improvementMs;
    }
  }
  return largestImprovementMs;
}

function deriveSessionMetrics(session) {
  const seenEntryIds = new Set();
  const entries = (session.entries || []).filter(entry => {
    if (seenEntryIds.has(entry.id)) return false;
    seenEntryIds.add(entry.id);
    return true;
  });
  session.entries = entries;

  for (const entry of entries) {
    entry.laps = (entry.laps || []).map((lap, index) => ({
      ...lap,
      number: lap.number ?? index + 1,
      sequence: lap.sequence ?? index,
      isValid: isValidLap(lap),
    }));
    entry.validLaps = entry.laps.filter(isValidLap);
    entry.invalidLaps = entry.laps.filter(lap => !isValidLap(lap));
    entry.validLapCount = entry.validLaps.length;
    entry.invalidLapCount = entry.invalidLaps.length;
    entry.hasValidLap = entry.validLapCount > 0;
    entry.bestValidLapMs = entry.hasValidLap ? Math.min(...entry.validLaps.map(lap => lap.timeMs)) : null;
    entry.fastestInvalidLapMs = entry.invalidLaps.length > 0
      ? Math.min(...entry.invalidLaps.map(lap => lap.timeMs))
      : null;
    entry.validAverageLapMs = entry.hasValidLap
      ? Math.round(entry.validLaps.reduce((sum, lap) => sum + lap.timeMs, 0) / entry.validLapCount)
      : null;
    entry.validLapRangeMs = entry.validLapCount >= 2
      ? Math.max(...entry.validLaps.map(lap => lap.timeMs)) - Math.min(...entry.validLaps.map(lap => lap.timeMs))
      : null;
    entry.largestValidImprovementMs = getLargestConsecutiveValidImprovement(
      [...entry.laps].sort((a, b) => a.sequence - b.sequence),
    );
  }

  const driverMap = new Map();
  for (const entry of entries) {
    const key = entry.driver.id;
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        driverId: key,
        driverName: entry.driver.nickname,
        entries: [],
        laps: [],
      });
    }
    const driver = driverMap.get(key);
    driver.entries.push(entry);
    driver.laps.push(...entry.laps.map(lap => ({ ...lap, entryId: entry.id, car: entry.car })));
  }

  const driverSummaries = [...driverMap.values()].map(driver => {
    driver.laps.sort((a, b) => a.sequence - b.sequence);
    const validLaps = driver.laps.filter(isValidLap);
    const invalidLaps = driver.laps.filter(lap => !isValidLap(lap));
    const bestValidLapMs = validLaps.length > 0 ? Math.min(...validLaps.map(lap => lap.timeMs)) : null;
    const bestLap = validLaps.find(lap => lap.timeMs === bestValidLapMs);
    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      entryId: bestLap?.entryId ?? driver.entries[0]?.id ?? '',
      carId: bestLap?.car.id ?? driver.entries[0]?.car.id ?? '',
      carName: bestLap?.car.model ?? driver.entries[0]?.car.model ?? '',
      validLaps,
      invalidLaps,
      validLapCount: validLaps.length,
      invalidLapCount: invalidLaps.length,
      hasValidLap: validLaps.length > 0,
      bestValidLapMs,
      fastestInvalidLapMs: invalidLaps.length > 0 ? Math.min(...invalidLaps.map(lap => lap.timeMs)) : null,
      validAverageLapMs: validLaps.length > 0
        ? Math.round(validLaps.reduce((sum, lap) => sum + lap.timeMs, 0) / validLaps.length)
        : null,
      validLapRangeMs: validLaps.length >= 2
        ? Math.max(...validLaps.map(lap => lap.timeMs)) - Math.min(...validLaps.map(lap => lap.timeMs))
        : null,
      largestValidImprovementMs: getLargestConsecutiveValidImprovement(driver.laps),
    };
  });

  driverSummaries.sort((a, b) => {
    if (a.bestValidLapMs !== null && b.bestValidLapMs !== null) return a.bestValidLapMs - b.bestValidLapMs;
    if (a.bestValidLapMs !== null) return -1;
    if (b.bestValidLapMs !== null) return 1;
    return a.driverName.localeCompare(b.driverName);
  });

  const rankedDrivers = driverSummaries.filter(driver => driver.hasValidLap);
  const leaderBestLapMs = rankedDrivers[0]?.bestValidLapMs ?? null;
  for (let i = 0; i < rankedDrivers.length; i++) {
    const driver = rankedDrivers[i];
    driver.rank = i === 0 || driver.bestValidLapMs !== rankedDrivers[i - 1].bestValidLapMs
      ? i + 1
      : rankedDrivers[i - 1].rank;
    driver.isTied = rankedDrivers.some((other, otherIndex) =>
      otherIndex !== i && other.bestValidLapMs === driver.bestValidLapMs
    );
    driver.gapToLeaderMs = driver.bestValidLapMs - leaderBestLapMs;
    driver.isLeader = driver.bestValidLapMs === leaderBestLapMs;
  }
  for (const driver of driverSummaries.filter(driver => !driver.hasValidLap)) {
    driver.rank = null;
    driver.isTied = false;
    driver.gapToLeaderMs = null;
    driver.isLeader = false;
  }
  for (const entry of entries) {
    entry.gapToLeaderMs = entry.bestValidLapMs !== null && leaderBestLapMs !== null
      ? entry.bestValidLapMs - leaderBestLapMs
      : null;
    entry.isLeader = entry.bestValidLapMs !== null && entry.bestValidLapMs === leaderBestLapMs;
  }

  const allLaps = entries.flatMap(entry => entry.laps);
  const validLaps = allLaps.filter(isValidLap);
  const invalidLaps = allLaps.filter(lap => !isValidLap(lap));
  session.validLaps = validLaps;
  session.invalidLaps = invalidLaps;
  session.validLapCount = validLaps.length;
  session.invalidLapCount = invalidLaps.length;
  session.hasValidLap = validLaps.length > 0;
  session.bestValidLapMs = session.hasValidLap ? Math.min(...validLaps.map(lap => lap.timeMs)) : null;
  session.fastestInvalidLapMs = invalidLaps.length > 0 ? Math.min(...invalidLaps.map(lap => lap.timeMs)) : null;
  session.validAverageLapMs = session.hasValidLap
    ? Math.round(validLaps.reduce((sum, lap) => sum + lap.timeMs, 0) / validLaps.length)
    : null;
  session.validLapRangeMs = validLaps.length >= 2
    ? Math.max(...validLaps.map(lap => lap.timeMs)) - Math.min(...validLaps.map(lap => lap.timeMs))
    : null;
  session.driverSummaries = driverSummaries;
  session.rankedDriverCount = rankedDrivers.length;
  session.leaderGapMs = rankedDrivers.length >= 2
    ? rankedDrivers[1].bestValidLapMs - rankedDrivers[0].bestValidLapMs
    : null;

  const improvingDrivers = driverSummaries.filter(driver => driver.largestValidImprovementMs !== null);
  improvingDrivers.sort((a, b) => b.largestValidImprovementMs - a.largestValidImprovementMs);
  session.largestValidImprovementMs = improvingDrivers[0]?.largestValidImprovementMs ?? null;
  session.largestValidImprovementDriverId = improvingDrivers[0]?.driverId ?? null;
  session.largestImprovementMs = session.largestValidImprovementMs;
  session.paceSummary = driverSummaries.map(driver => ({
    entryId: driver.entryId,
    driverId: driver.driverId,
    driverName: driver.driverName,
    carName: driver.carName,
    validLapCount: driver.validLapCount,
    invalidLapCount: driver.invalidLapCount,
    hasValidLap: driver.hasValidLap,
    bestValidLapMs: driver.bestValidLapMs,
    fastestInvalidLapMs: driver.fastestInvalidLapMs,
    validAverageLapMs: driver.validAverageLapMs,
    validLapRangeMs: driver.validLapRangeMs,
    gapToLeaderMs: driver.gapToLeaderMs,
    isLeader: driver.isLeader,
  }));

  return session;
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
  const entryIds = new Set();
  const len = Math.max(driverStandings.length, carStandings.length);
  for (let i = 0; i < len; i++) {
    const driverKey = compositeId(driverStandings[i]);
    const carKey = compositeId(carStandings[i]?.car_id);
    if (!driverKey || !carKey) continue;

    const driver = driverMap.get(driverKey);
    const car = carMap.get(carKey);
    if (!driver || !car) continue;

    const entryId = `${driverKey}:${carKey}`;
    if (entryIds.has(entryId)) continue;
    entryIds.add(entryId);
    const entryLaps = lapsRaw
      .map(normalizeLap)
      .filter(l => l.driverKey === driverKey && l.carKey === carKey && l.timeMs > 0);

    const bestLapMs = entryLaps.length > 0 ? Math.min(...entryLaps.map(l => l.timeMs)) : null;
    const validLaps = entryLaps.filter(l => l.isValid);
    const validLapCount = validLaps.length;
    const invalidLapCount = entryLaps.length - validLapCount;
    const bestValidLapMs = validLaps.length > 0 ? Math.min(...validLaps.map(l => l.timeMs)) : null;
    const completedLapCount = entryLaps.length;
    const averageLapMs = completedLapCount > 0 ? Math.round(entryLaps.reduce((sum, l) => sum + l.timeMs, 0) / completedLapCount) : null;
    const lapRangeMs = completedLapCount >= 2 ? Math.max(...entryLaps.map(l => l.timeMs)) - Math.min(...entryLaps.map(l => l.timeMs)) : null;

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
        isValid: l.isValid,
      })),
      bestLapMs,
      bestValidLapMs,
      validLapCount,
      invalidLapCount,
      completedLapCount,
      averageLapMs,
      lapRangeMs,
      contacts: aggregateContacts(collisions, carKey),
    });
  }

  const penaltiesMap = buildPenaltiesMap(penaltyCollection);
  for (const entry of entries) {
    entry.penalties = penaltiesMap[entry.car.id] || [];
  }

  const allLaps = entries.flatMap(e => e.laps);
  const completedLapCount = allLaps.length;
  const bestLapMs = allLaps.length > 0 ? Math.min(...allLaps.map(l => l.timeMs)) : null;
  const validLapCount = allLaps.filter(l => l.isValid).length;
  const invalidLapCount = completedLapCount - validLapCount;

  entries.sort((a, b) => {
    if (a.bestLapMs !== null && b.bestLapMs !== null) return a.bestLapMs - b.bestLapMs;
    if (a.bestLapMs !== null) return -1;
    if (b.bestLapMs !== null) return 1;
    return 0;
  });

  const classifiedEntries = entries.filter(e => e.bestLapMs !== null);
  const leaderGapMs = classifiedEntries.length >= 2 ? classifiedEntries[1].bestLapMs - classifiedEntries[0].bestLapMs : null;
  const leaderBestLapMs = classifiedEntries.length > 0 ? classifiedEntries[0].bestLapMs : null;

  for (const entry of entries) {
    entry.gapToLeaderMs = entry.bestLapMs !== null && leaderBestLapMs !== null ? entry.bestLapMs - leaderBestLapMs : null;
    entry.isLeader = entry.bestLapMs === leaderBestLapMs;
  }

  const paceSummary = classifiedEntries.map(e => ({
    entryId: e.id,
    driverName: e.driver.nickname,
    carName: e.car.model,
    completedLapCount: e.completedLapCount,
    bestLapMs: e.bestLapMs,
    averageLapMs: e.averageLapMs,
    rangeMs: e.lapRangeMs,
    gapToLeaderMs: e.gapToLeaderMs,
    isLeader: e.isLeader,
  }));

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
    paceSummary,
    bestLapMs,
    completedLapCount,
    validLapCount,
    invalidLapCount,
    largestImprovementMs,
    maxImpactKmh,
    leaderGapMs,
  };

  return deriveSessionMetrics(normalized);
}

export { normalize, deriveSessionMetrics, compositeId, parseTimestampFromFilename, isValidLap, VALID_LAP_FLAG };
