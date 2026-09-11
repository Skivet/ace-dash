const API_BASE = '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export async function getHealth() {
  return apiFetch('/api/health');
}

export async function getSessions() {
  return apiFetch('/api/sessions');
}

export async function getSession(id) {
  return apiFetch(`/api/sessions/${id}`);
}

export async function getDrivers() {
  return apiFetch('/api/drivers');
}

export async function getTracks() {
  return apiFetch('/api/tracks');
}

export async function getClubStats() {
  return apiFetch('/api/club/stats');
}

export async function getClubRecords(trackName, layout) {
  return apiFetch(`/api/club/records?track=${encodeURIComponent(trackName)}&layout=${encodeURIComponent(layout)}`);
}

export async function getCarRecords(trackName, layout) {
  return apiFetch(`/api/club/car-records?track=${encodeURIComponent(trackName)}&layout=${encodeURIComponent(layout)}`);
}

export async function getRecentSessions() {
  return apiFetch('/api/club/recent-sessions');
}

export async function getTrackRecords(trackName, layout) {
  return apiFetch(`/api/tracks/${encodeURIComponent(`${trackName}|${layout}`)}`);
}

export async function getCarDrillDown(carModel) {
  return apiFetch(`/api/cars/${encodeURIComponent(carModel)}`);
}

export async function getDriverDrillDown(driverId) {
  return apiFetch(`/api/drivers/${encodeURIComponent(driverId)}`);
}
