function updateCapability({ packaged, platform, environment = {}, signature = '' }) {
  if (!packaged) return { supported: false, reason: 'development' };
  if (platform === 'win32') {
    return environment.PORTABLE_EXECUTABLE_FILE || environment.PORTABLE_EXECUTABLE_DIR
      ? { supported: false, reason: 'portable' } : { supported: true, reason: null };
  }
  if (platform === 'darwin') {
    const signed = /^Authority=Developer ID Application:/m.test(signature)
      && /^TeamIdentifier=(?!not set$)\S+$/m.test(signature) && !/^Signature=adhoc/m.test(signature);
    return { supported: signed, reason: signed ? null : 'unsigned-mac' };
  }
  if (platform === 'linux' && environment.APPIMAGE) return { supported: true, reason: null };
  return { supported: false, reason: 'package-manager' };
}
module.exports = { updateCapability };
