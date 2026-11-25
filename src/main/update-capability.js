function updateCapability({ packaged, platform, environment = {}, signature = '', windowsPublisher }) {
  if (!packaged) return { supported: false, reason: 'development' };
  if (platform === 'win32') {
    if (environment.PORTABLE_EXECUTABLE_FILE || environment.PORTABLE_EXECUTABLE_DIR) {
      return { supported: false, reason: 'portable' };
    }
    return windowsPublisher ? { supported: true, reason: null } : { supported: false, reason: 'unsigned-windows' };
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
