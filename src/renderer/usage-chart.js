export function chartPoints(history, field) {
  return history.filter((sample) => Number.isFinite(sample.timestamp)).map((sample) => ({
    x: sample.timestamp,
    y: Number.isFinite(sample[field]) ? sample[field] : null,
  }));
}
