function fitWindowBounds(bounds, area, gap = 8) {
  const width = Math.min(Math.round(bounds.width), Math.max(1, area.width - 2 * gap));
  const height = Math.min(Math.round(bounds.height), Math.max(1, area.height - 2 * gap));
  const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));
  return {
    x: clamp(bounds.x, area.x + gap, area.x + area.width - width - gap),
    y: clamp(bounds.y, area.y + gap, area.y + area.height - height - gap),
    width, height,
  };
}

function trayWindowBounds(bounds, tray, area) {
  const x = tray.x + tray.width / 2 - bounds.width / 2;
  const y = tray.y < area.y + area.height / 2 ? tray.y + tray.height + 8 : tray.y - bounds.height - 8;
  return fitWindowBounds({ ...bounds, x, y }, area);
}

module.exports = { fitWindowBounds, trayWindowBounds };
