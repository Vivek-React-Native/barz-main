import * as WebBrowser from 'expo-web-browser';

export default async (externalVerificationRedirectURL: string, oauthRedirectUrl: string) => {
  // Adapted from the useOAuth clerk code here:
  // https://github.com/clerkinc/javascript/blob/96cc1921cac20442f19510137ee0100df5f8a0f4/packages/expo/src/useOAuth.ts#L34

  const authSessionResult = await WebBrowser.openAuthSessionAsync(
    externalVerificationRedirectURL,
    oauthRedirectUrl,
  );

  return authSessionResult;
};
