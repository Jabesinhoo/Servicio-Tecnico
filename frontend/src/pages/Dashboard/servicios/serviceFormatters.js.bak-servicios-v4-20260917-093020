export const formatDateOnly = (value) => {
  if (!value) return '—';
  const text = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

export const formatTime = (value) =>
  value ? String(value).slice(0, 5) : '—';

export const money = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(number);
};

export const technicianName = (item) => {
  if (!item) return '—';
  return (
    [item.nombre1, item.nombre2, item.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    item.usuario ||
    '—'
  );
};

export const bogotaDateInput = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
