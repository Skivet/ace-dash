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
