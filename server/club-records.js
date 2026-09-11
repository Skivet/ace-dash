function normalizedIdentity(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function assignCompetitionRanks(records) {
  for (let i = 0; i < records.length; i++) {
    records[i].rank = i === 0 || records[i].bestLapMs !== records[i - 1].bestLapMs
      ? i + 1
      : records[i - 1].rank;
    records[i].isTied = records.some((record, index) =>
      index !== i && record.bestLapMs === records[i].bestLapMs
    );
  }
}

function computeOverallRecords(sessions, trackName, layoutName) {
  const driverRecords = new Map();

  for (const session of sessions) {
    if (session.track.name !== trackName || session.track.layout !== layoutName) continue;
    for (const entry of session.entries || []) {
      if (entry.bestValidLapMs === null) continue;
      const key = entry.driver.id || normalizedIdentity(entry.driver.nickname);
      const existing = driverRecords.get(key);
      if (!existing || entry.bestValidLapMs < existing.bestLapMs) {
        driverRecords.set(key, {
          driverId: entry.driver.id,
          driverName: entry.driver.nickname,
          carId: entry.car.id,
          carModel: entry.car.model,
          bestLapMs: entry.bestValidLapMs,
          sessionId: session.id,
          sessionName: session.session.name,
          sessionType: session.session.type,
          importedAt: session.source?.importedAt || '',
        });
      }
    }
  }

  const records = [...driverRecords.values()].sort((a, b) => a.bestLapMs - b.bestLapMs);
  assignCompetitionRanks(records);
  const outrightBest = records[0]?.bestLapMs ?? null;
  for (const record of records) {
    record.gapToOutrightMs = outrightBest === null ? null : record.bestLapMs - outrightBest;
    record.isOutrightRecord = record.bestLapMs === outrightBest;
  }
  return records;
}

function computeCarRecords(sessions, trackName, layoutName) {
  const carRecords = new Map();

  for (const session of sessions) {
    if (session.track.name !== trackName || session.track.layout !== layoutName) continue;
    for (const entry of session.entries || []) {
      if (entry.bestValidLapMs === null) continue;
      const key = normalizedIdentity(entry.car.model) || entry.car.id;
      if (!carRecords.has(key)) {
        carRecords.set(key, {
          carId: entry.car.id,
          carModel: entry.car.model,
          bestLapMs: entry.bestValidLapMs,
          driverId: entry.driver.id,
          driverName: entry.driver.nickname,
          sessionId: session.id,
          sessionName: session.session.name,
          sessionType: session.session.type,
          importedAt: session.source?.importedAt || '',
          validLapCount: 0,
          sessionIds: new Set(),
        });
      }

      const record = carRecords.get(key);
      record.validLapCount += entry.validLapCount || 0;
      record.sessionIds.add(session.id);
      if (entry.bestValidLapMs < record.bestLapMs) {
        record.carId = entry.car.id;
        record.carModel = entry.car.model;
        record.bestLapMs = entry.bestValidLapMs;
        record.driverId = entry.driver.id;
        record.driverName = entry.driver.nickname;
        record.sessionId = session.id;
        record.sessionName = session.session.name;
        record.sessionType = session.session.type;
        record.importedAt = session.source?.importedAt || '';
      }
    }
  }

  const records = [...carRecords.values()].map(record => ({
    ...record,
    sessionCount: record.sessionIds.size,
    sessionIds: undefined,
  })).sort((a, b) => a.bestLapMs - b.bestLapMs);
  assignCompetitionRanks(records);
  const outrightBest = records[0]?.bestLapMs ?? null;
  for (const record of records) {
    record.gapToOutrightMs = outrightBest === null ? null : record.bestLapMs - outrightBest;
    record.isOutrightRecord = record.bestLapMs === outrightBest;
  }
  return records;
}

export { computeOverallRecords, computeCarRecords, normalizedIdentity };
