import * as React from 'react';
import { useState, useCallback, useContext } from 'react';
import { showMessage } from 'react-native-flash-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth, useUser, useSignIn } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as FileSystem from 'expo-file-system';
import { Text, ScrollView, SafeAreaView, StyleSheet, View } from 'react-native';
import VersionNumber from 'react-native-version-number';
import * as Updates from 'expo-updates';

import DeveloperModeActivator from '@barz/mobile/src/components/DeveloperModeActivator';
import { DeveloperModeCache } from '@barz/mobile/src/lib/cache';
import { VideoCacheContext } from '@barz/mobile/src/video-cache';
import openWebAuthSession from '@barz/mobile/src/lib/open-web-auth-session';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import ListItem from '@barz/mobile/src/ui/ListItem';
import ListItemContainer from '@barz/mobile/src/ui/ListItemContainer';
import { FACEBOOK_AUTH_ENABLED } from '@barz/mobile/src/config';

import { FixMe } from '@barz/mobile/src/lib/fixme';
import { ChevronRight as IconChevronRight } from '@barz/mobile/src/ui/icons';

import { PageProps } from '.';

const styles = StyleSheet.create({
  scrollWrapper: {
    height: '100%',
    width: '100%',
  },
});

// This components renders the "Settings" page that can be accessed by pressing a button on a user's
// own profile.
//
// This page exposes lesser used configuration options for the application, and is where a developer
// can go to enable developer mode when the app is logged in.
const MeProfileSettings: React.FunctionComponent<PageProps<'Profile > Settings'>> = ({
  navigation,
}) => {
  const { signOut } = useAuth();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { user } = useUser();

  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      DeveloperModeCache.isEnabled().then((enabled) => {
        setDeveloperModeEnabled(enabled);
      });
    }, [setDeveloperModeEnabled]),
  );

  const videoCacheContext = useContext(VideoCacheContext);

  const onNavigateToDeveloperMode = useCallback(
    () => navigation.navigate('Developer Mode > Visible'),
    [navigation],
  );

  const phoneNumber = user?.primaryPhoneNumber?.phoneNumber || null;

  const googleAccountEmailAddress =
    user?.externalAccounts.find(
      (account) => account.provider === 'google' && account.verification?.status === 'verified',
    )?.emailAddress || null;
  const facebookAccountEmailAddress =
    user?.externalAccounts.find(
      (account) => account.provider === 'facebook' && account.verification?.status === 'verified',
    )?.emailAddress || null;
  const appleAccountEmailAddress =
    user?.externalAccounts.find(
      (account) => account.provider === 'apple' && account.verification?.status === 'verified',
    )?.emailAddress || null;

  const [oAuthSignInLoading, setOAuthSignInInProgress] = useState<
    'google' | 'facebook' | 'apple' | null
  >(null);
  const onAttachNewOAuthProviderAccount = useCallback(
    async (providerName: 'google' | 'facebook' | 'apple') => {
      if (!user) {
        return;
      }
      if (!isSignInLoaded) {
        return;
      }

      const strategy = {
        google: 'oauth_google' as const,
        facebook: 'oauth_facebook' as const,
        apple: 'oauth_apple' as const,
      }[providerName];

      setOAuthSignInInProgress(providerName);
      try {
        // Adapted from the useOAuth clerk code here:
        // https://github.com/clerkinc/javascript/blob/96cc1921cac20442f19510137ee0100df5f8a0f4/packages/expo/src/useOAuth.ts#L34

        // Create a redirect url for the current platform and environment.
        //
        // This redirect URL needs to be whitelisted for your Clerk production instance via
        // https://clerk.dev/docs/reference/backend-api/tag/Redirect-URLs#operation/CreateRedirectURL
        //
        // For more information go to:
        // https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturi
        const oauthRedirectUrl = AuthSession.makeRedirectUri({
          native: 'barz://oauth-redirect',
          scheme: 'barz',
          path: 'oauth-redirect',
        });

        const externalAccount = await user.createExternalAccount({
          strategy,
          redirectUrl: oauthRedirectUrl,
        });
        if (!externalAccount.verification) {
          return;
        }
        const externalVerificationRedirectURL =
          externalAccount.verification.externalVerificationRedirectURL;

        // Opens up the web browser to allow a user to sign in
        const authSessionResult = await openWebAuthSession(
          externalVerificationRedirectURL!.toString(),
          oauthRedirectUrl,
        );

        const type = authSessionResult.type;
        const url = (authSessionResult as FixMe).url as string | undefined;

        // TODO: Check all the possible AuthSession results
        // https://docs.expo.dev/versions/latest/sdk/auth-session/#returns-7
        if (type === 'cancel') {
          // If cancel was pressed, bail out early
          return;
        }
        if (type !== 'success') {
          throw new Error(`Clerk authSessionResult.type was not "success", found "${type}"`);
        }

        // After signing in to the new oauth provider, reload the clerk user locally to show the new
        // oauth connection
        const params = url ? new URL(url).searchParams : null;
        const rotatingTokenNonce = params ? params.get('rotating_token_nonce') || '' : '';
        await user.reload({ rotatingTokenNonce });

        // Make sure that the account is "verified" and let the user know if not
        const updatedExternalAccount = user.externalAccounts.find(
          (account) => account.verification?.strategy === strategy,
        );
        if (
          updatedExternalAccount &&
          updatedExternalAccount.verification?.status === 'unverified'
        ) {
          if (updatedExternalAccount.verification.error) {
            // Clerk couldn't associate the account for a known reason
            // and generated an error message.
            //
            // Example of when this happens: a user tries to associate an oauth account with an
            // account but it is already associated with a different account
            const errorMessage = updatedExternalAccount.verification.error.longMessage;
            showMessage({
              message: 'Error associating user account with Clerk:',
              description: `${errorMessage}`,
              type: 'info',
            });
          } else {
            showMessage({
              message: 'Unable to verify external account!',
              type: 'info',
            });
          }
        }
      } catch (err: FixMe) {
        if (
          err.errors &&
          err.errors.find((e: FixMe) => e.code === 'identifier_already_signed_in')
        ) {
          showMessage({
            message: 'You are already signed in somewhere else!',
            type: 'warning',
          });
          return;
        }
        console.log(`Logging in via oauth failed: ${err}`);
        showMessage({
          message: 'Failed to sign in to account!',
          type: 'warning',
        });
      } finally {
        setOAuthSignInInProgress(null);
      }
    },
    [isSignInLoaded, signIn, user, setOAuthSignInInProgress],
  );

  return (
    <SafeAreaView testID="profile-settings-wrapper">
      <ScrollView style={styles.scrollWrapper}>
        <ListItemContainer>
          <ListItem
            onPress={() => {
              if (phoneNumber) {
                navigation.navigate('Profile > Settings > Phone Number Settings');
              } else {
                navigation.navigate(
                  'Profile > Settings > Phone Number Settings > Add/Change Phone Number',
                );
              }
            }}
            testID={
              phoneNumber
                ? 'profile-settings-phone-number-settings'
                : 'profile-settings-add-phone-number'
            }
            trailingLabel={phoneNumber || 'Add'}
            trailing={(color) => <IconChevronRight color={color} />}
          >
            Phone Number
          </ListItem>

          <ListItem
            onPress={() => {
              if (googleAccountEmailAddress) {
                navigation.navigate('Profile > Settings > OAuth Provider Settings', {
                  providerName: 'google',
                  title: 'Google',
                });
              } else {
                onAttachNewOAuthProviderAccount('google');
              }
            }}
            disabled={oAuthSignInLoading !== null}
            testID="profile-settings-oauth-google-settings"
            trailingLabel={
              googleAccountEmailAddress ||
              (oAuthSignInLoading
                ? `${oAuthSignInLoading === 'google' ? 'Loading...' : ''}`
                : 'Attach')
            }
            trailing={(color) => <IconChevronRight color={color} />}
          >
            Google
          </ListItem>
          {FACEBOOK_AUTH_ENABLED ? (
            <ListItem
              onPress={() => {
                if (facebookAccountEmailAddress) {
                  navigation.navigate('Profile > Settings > OAuth Provider Settings', {
                    providerName: 'facebook',
                    title: 'Facebook',
                  });
                } else {
                  onAttachNewOAuthProviderAccount('facebook');
                }
              }}
              disabled={oAuthSignInLoading !== null}
              testID="profile-settings-oauth-facebook-settings"
              trailingLabel={
                facebookAccountEmailAddress ||
                (oAuthSignInLoading
                  ? `${oAuthSignInLoading === 'facebook' ? 'Loading...' : ''}`
                  : 'Attach')
              }
              trailing={(color) => <IconChevronRight color={color} />}
            >
              Facebook
            </ListItem>
          ) : null}
          <ListItem
            onPress={() => {
              if (appleAccountEmailAddress) {
                navigation.navigate('Profile > Settings > OAuth Provider Settings', {
                  providerName: 'apple',
                  title: 'Apple',
                });
              } else {
                onAttachNewOAuthProviderAccount('apple');
              }
            }}
            disabled={oAuthSignInLoading !== null}
            testID="profile-settings-oauth-apple-settings"
            trailingLabel={
              appleAccountEmailAddress ||
              (oAuthSignInLoading
                ? `${oAuthSignInLoading === 'apple' ? 'Loading...' : ''}`
                : 'Attach')
            }
            trailing={(color) => <IconChevronRight color={color} />}
          >
            Apple
          </ListItem>

          <ListItem
            onPress={() => {
              if (!videoCacheContext) {
                showMessage({
                  message: 'No video cache context!',
                  type: 'info',
                });
                return;
              }
              videoCacheContext
                .listCachedVideos()
                .then((cachedVideoFiles) => {
                  if (cachedVideoFiles.length === 0) {
                    return false;
                  } else {
                    return Promise.all(
                      cachedVideoFiles.map(([_b, _p, file]) => FileSystem.deleteAsync(file.uri)),
                    ).then(() => true);
                  }
                })
                .then((hadVideos) => {
                  if (hadVideos) {
                    showMessage({
                      message: 'Cleared all cached videos!',
                      type: 'info',
                    });
                  } else {
                    showMessage({
                      message: 'No videos cached!',
                      type: 'info',
                    });
                  }
                })
                .catch((err) => {
                  console.error('Error clearing video cache:', err.stack);
                  showMessage({
                    message: 'Error clearing video cache!',
                    type: 'info',
                  });
                });
            }}
          >
            Clear Video Cache
          </ListItem>

          <ListItem
            onPress={async () => {
              try {
                const update = await Updates.checkForUpdateAsync();
                console.log('Expo Update Response:', update);

                if (update.isAvailable) {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                }
              } catch (error) {
                // You can also add an alert() to see the error message in case of an error when fetching updates.
                showMessage({
                  message: 'Error fetching latest Expo update:',
                  description: `${error}`,
                  type: 'warning',
                });
              }
            }}
          >
            Fetch updates
          </ListItem>

          {developerModeEnabled ? (
            <ListItem
              onPress={onNavigateToDeveloperMode}
              trailing={(color) => <IconChevronRight color={color} />}
            >
              Developer Mode
            </ListItem>
          ) : null}

          <ListItem type="danger" onPress={() => signOut()} testID="profile-settings-sign-out">
            Log out
          </ListItem>
        </ListItemContainer>

        <View style={{ flexDirection: 'row-reverse' }}>
          <Text
            style={{ ...Typography.Body1, color: Color.Gray.Dark10, marginTop: 32, marginRight: 8 }}
          >
            v{VersionNumber.appVersion}, build {VersionNumber.buildVersion}
          </Text>
        </View>
      </ScrollView>

      {/*
      This component renders two invisible buttons on the lower left and lower right of the
      screen. When pressed in the right order, they enable developer mode.
      */}
      <DeveloperModeActivator onActivateDeveloperMode={onNavigateToDeveloperMode} />
    </SafeAreaView>
  );
};

export default MeProfileSettings;
