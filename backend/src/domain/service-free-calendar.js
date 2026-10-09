'use strict';

// All members travel together: reserve a common interval, without personal shifts.
function chooseFreeSlot({ start, duration, ids, busy = [], days = 45 }) {
  const initial = new Date(start).getTime();
  const length = Number(duration) * 60000;
  if (!Number.isFinite(initial) || !Number.isFinite(length) || length <= 0) return null;
  const limit = initial + days * 86400000;
  let cursor = Math.ceil(initial / 900000) * 900000;
  while (cursor + length <= limit) {
    const conflicts = busy.filter(block => ids.includes(block.technician_id) &&
      new Date(block.start_at).getTime() < cursor + length &&
      new Date(block.end_at).getTime() > cursor);
    if (!conflicts.length) return { startAt: new Date(cursor).toISOString(), endAt: new Date(cursor + length).toISOString() };
    cursor = Math.ceil(Math.max(...conflicts.map(block => new Date(block.end_at).getTime())) / 900000) * 900000;
  }
  return null;
}
module.exports = { chooseFreeSlot };
