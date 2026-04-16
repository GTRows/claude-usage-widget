// Claude peak-hour throttle (effective 2026-03-26, ongoing).
// Free/Pro/Max 5-hour session limits drain faster during weekday peak hours.
// Anthropic's window: 5-11 AM PT / 8 AM-2 PM ET / 1-7 PM GMT (BST), which
// is the single UTC window 12:00-18:00 Mon-Fri. Weekly limits unchanged.

const DEFAULT_THROTTLE = {
  id: 'claude-peak-throttle-2026',
  label: 'Claude peak throttle',
  peakWindowUTC: { startHour: 12, endHour: 18 },
  peakDaysUTC: [1, 2, 3, 4, 5],
};

function isInPeakWindow(now, throttle) {
  const t = throttle || DEFAULT_THROTTLE;
  const d = new Date(now);
  const day = d.getUTCDay();
  if (!t.peakDaysUTC.includes(day)) return false;
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const startMin = t.peakWindowUTC.startHour * 60;
  const endMin = t.peakWindowUTC.endHour * 60;
  return minutes >= startMin && minutes < endMin;
}

function computeNextTransition(now, throttle) {
  const t = throttle || DEFAULT_THROTTLE;
  const d = new Date(now);
  const startMin = t.peakWindowUTC.startHour * 60;
  const endMin = t.peakWindowUTC.endHour * 60;

  if (isInPeakWindow(now, t)) {
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    end.setUTCMinutes(endMin);
    return end.getTime();
  }

  const candidate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  candidate.setUTCMinutes(startMin);

  for (let i = 0; i < 14; i += 1) {
    if (candidate.getTime() > now && t.peakDaysUTC.includes(candidate.getUTCDay())) {
      return candidate.getTime();
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    candidate.setUTCHours(0, 0, 0, 0);
    candidate.setUTCMinutes(startMin);
  }
  return null;
}

function getPeakThrottleStatus(now, throttle) {
  const t = throttle || DEFAULT_THROTTLE;
  const inPeak = isInPeakWindow(now, t);
  return {
    id: t.id,
    label: t.label,
    isThrottled: inPeak,
    nextTransitionAt: computeNextTransition(now, t),
    peakWindowUTC: t.peakWindowUTC,
    peakDaysUTC: t.peakDaysUTC.slice(),
  };
}

module.exports = {
  DEFAULT_THROTTLE,
  isInPeakWindow,
  computeNextTransition,
  getPeakThrottleStatus,
};
