const MESSAGES = {
  LOCAL_PROFILE_INVALID: 'Choose a supported local CLI profile directory.',
  LOCAL_CREDENTIALS_UNAVAILABLE: 'Local credentials are unavailable. Sign in using the original CLI profile.',
  LOCAL_CREDENTIALS_INVALID: 'Unsupported local credentials. Sign in using the original CLI profile.',
  LOCAL_AUTH_EXPIRED: 'Local authentication expired. Sign in using the original CLI profile.',
  PROVIDER_REDIRECT: 'Provider redirects are not allowed.',
  PROVIDER_NETWORK_ERROR: 'Unable to fetch provider usage.',
  PROVIDER_TIMEOUT: 'Provider usage request timed out.',
  PROVIDER_INVALID_RESPONSE: 'Provider returned an invalid usage response.',
  PROVIDER_HTTP_ERROR: 'Provider usage request failed.',
  PROVIDER_RATE_LIMITED: 'Provider usage is temporarily rate limited.',
};

function providerError(code, status) {
  const error = new Error(MESSAGES[code]);
  error.code = code;
  if (Number.isInteger(status)) error.status = status;
  return error;
}

module.exports = { providerError };
