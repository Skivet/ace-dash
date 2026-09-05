export function formatTime(ms) {
  if (ms === null || ms === undefined || ms <= 0) return '—';
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  const seconds = (abs - minutes * 60000) / 1000;
  return `${minutes}:${seconds.toFixed(3).padStart(5, '0')}`;
}

export function formatTimeDelta(ms) {
  if (ms === null || ms === undefined) return '—';
  const abs = Math.abs(ms);
  const seconds = abs / 1000;
  return `${seconds.toFixed(3)} s`;
}

export function formatSessionDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatSessionTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatSessionLabel(isoString, sessionType, driverCount) {
  const date = formatSessionDate(isoString);
  const time = formatSessionTime(isoString);
  const type = sessionType || '';
  const drivers = driverCount > 0 ? `${driverCount} driver${driverCount > 1 ? 's' : ''}` : '';
  const parts = [date, time, type, drivers].filter(Boolean);
  return parts.join(' · ');
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatSpeed(kmh) {
  if (kmh === null || kmh === undefined || kmh <= 0) return '—';
  return `${kmh.toFixed(1)} km/h`;
}

export function formatGap(ms) {
  if (ms === null || ms === undefined || ms === 0) return 'LEADER';
  return `+${(ms / 1000).toFixed(3)} s`;
}

export function formatLapRange(ms) {
  if (ms === null || ms === undefined) return '—';
  return `${(ms / 1000).toFixed(3)} s`;
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
