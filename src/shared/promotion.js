// Claude usage promotion windows (e.g. the March 2026 2x off-peak boost).
// The window for the March 2026 promotion is "outside 8AM-2PM ET /
// 5-11AM PT / 12-6PM GMT on weekdays", which is the single UTC window
// 12:00-18:00 Mon-Fri. End time is March 28 11:59 PM PT (PDT = UTC-7),
// i.e. 2026-03-29 06:59:59 UTC.

const DEFAULT_PROMOTION = {
  id: 'march-2026-2x',
  label: 'Claude 2x usage (Mar 2026)',
  startMs: Date.UTC(2026, 2, 13, 7, 0, 0),
  endMs: Date.UTC(2026, 2, 29, 6, 59, 59),
  peakWindowUTC: { startHour: 12, endHour: 18 },
  peakDaysUTC: [1, 2, 3, 4, 5],
};

function isInPeakWindow(now, promo) {
  const p = promo || DEFAULT_PROMOTION;
  const d = new Date(now);
  const day = d.getUTCDay();
  if (!p.peakDaysUTC.includes(day)) return false;
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const startMin = p.peakWindowUTC.startHour * 60;
  const endMin = p.peakWindowUTC.endHour * 60;
  return minutes >= startMin && minutes < endMin;
}

function computeNextTransition(now, promo) {
  const p = promo || DEFAULT_PROMOTION;
  const d = new Date(now);
  const startMin = p.peakWindowUTC.startHour * 60;
  const endMin = p.peakWindowUTC.endHour * 60;

  if (isInPeakWindow(now, p)) {
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    end.setUTCMinutes(endMin);
    return end.getTime();
  }

  const candidate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  candidate.setUTCMinutes(startMin);

  for (let i = 0; i < 14; i += 1) {
    if (candidate.getTime() > now && p.peakDaysUTC.includes(candidate.getUTCDay())) {
      return candidate.getTime();
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    candidate.setUTCHours(0, 0, 0, 0);
    candidate.setUTCMinutes(startMin);
  }
  return p.endMs;
}

function getPromotionStatus(now, promo) {
  const p = promo || DEFAULT_PROMOTION;
  const base = {
    id: p.id,
    label: p.label,
    startsAt: p.startMs,
    endsAt: p.endMs,
    peakWindowUTC: p.peakWindowUTC,
    peakDaysUTC: p.peakDaysUTC.slice(),
  };
  if (now < p.startMs) {
    return { ...base, state: 'upcoming', isBoost: false, nextTransitionAt: p.startMs };
  }
  if (now >= p.endMs) {
    return { ...base, state: 'ended', isBoost: false, nextTransitionAt: null };
  }
  const inPeak = isInPeakWindow(now, p);
  const nextBoundary = computeNextTransition(now, p);
  return {
    ...base,
    state: 'active',
    isBoost: !inPeak,
    nextTransitionAt: Math.min(nextBoundary, p.endMs),
  };
}

module.exports = {
  DEFAULT_PROMOTION,
  isInPeakWindow,
  computeNextTransition,
  getPromotionStatus,
};
