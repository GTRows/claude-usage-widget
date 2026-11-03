function createTrayFrameImage(nativeImage, frame, platform) {
  if (platform === 'darwin' && frame.nativeTextOnly) return nativeImage.createEmpty();
  const image = nativeImage.createFromDataURL(frame.dataURL);
  if (platform !== 'darwin' || image.isEmpty()) return image;
  const retina = nativeImage.createEmpty();
  retina.addRepresentation({
    scaleFactor: 2,
    dataURL: image.resize({ width: 32, height: 32, quality: 'best' }).toDataURL(),
  });
  retina.setTemplateImage(Boolean(frame.template));
  return retina;
}

function createMacTrayPlaceholder(nativeImage) {
  const pixels = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const radius = Math.hypot(x - 15.5, y - 15.5);
      const coverage = Math.max(0, Math.min(1, Math.min(12 - radius, radius - 9) + 0.5));
      pixels[(y * 32 + x) * 4 + 3] = Math.round(coverage * 255);
    }
  }
  const image = nativeImage.createFromBitmap(pixels, { width: 32, height: 32, scaleFactor: 2 });
  image.setTemplateImage(true);
  return image;
}

module.exports = { createTrayFrameImage, createMacTrayPlaceholder };
