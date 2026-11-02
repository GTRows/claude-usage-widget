export function buildMacTrayFrame(document, label, percent, style) {
  const rounded = Math.round(Math.max(0, Math.min(100, percent)));
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  if (style === 'ring') {
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(16, 16, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(16, 16, 11, -Math.PI / 2, -Math.PI / 2 + rounded / 100 * Math.PI * 2);
    ctx.stroke();
  } else if (style === 'bar') {
    ctx.globalAlpha = 0.3;
    ctx.fillRect(4, 11, 24, 10);
    ctx.globalAlpha = 1;
    ctx.fillRect(4, 11, 24 * rounded / 100, 10);
  } else if (style === 'dot') {
    ctx.beginPath();
    ctx.arc(16, 16, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  return {
    dataURL: canvas.toDataURL('image/png'),
    nativeTextOnly: !['ring', 'bar', 'dot'].includes(style),
    template: true,
    title: `${rounded}%`,
    tooltip: `${label}: ${rounded}%`,
    duration: 2600,
  };
}
