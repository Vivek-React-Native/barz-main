import { Fragment, useState, useContext, useMemo, useEffect } from 'react';
import { Text, SafeAreaView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useUser, useAuth } from '@clerk/clerk-expo';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { UserDataContext } from '@barz/mobile/src/user-data';

import { BarzAPI } from '@barz/mobile/src/lib/api';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import generateHandleFromRapperName from '@barz/mobile/src/lib/rapper-name';

import { VideoCacheContext } from '@barz/mobile/src/video-cache';

import OnboardingContext, { EMPTY_CONTEXT_DATA, OnboardingContextData } from './context';
import LoginEnterPhone from './LoginEnterPhone';
import LoginVerifyCode from './LoginVerifyCode';
import CreateRapNameIntro from './CreateRapNameIntro';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import HeaderBackButton from '@barz/mobile/src/ui/HeaderBackButton';

// The below logic implements a typescript-friendly way to expose the prop type data to each screen
// within the feature
// ref: https://stackoverflow.com/a/75142476/4115328
export type BattleStackParamList = {
  'Onboarding > Enter Phone': undefined;
  'Onboarding > Verify Code': undefined;
  'Onboarding > Create Rap Name Intro': undefined;

  // FIXME: this route navigates to the developer mode feature
  'Developer Mode > Visible': undefined;
};

export interface PageProps<T extends keyof BattleStackParamList> {
  navigation: NativeStackNavigationProp<BattleStackParamList, T>;
}

const Stack = createNativeStackNavigator<BattleStackParamList>();

const styles = StyleSheet.create({
  loadingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  loadingText: {
    ...Typography.Body1,
    color: Color.Gray.Dark8,
  },
});

const OnboardingFeature: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();

  const { isSignedIn: authIsSignedIn, getToken } = useAuth();
  const [userMe, updateUserMe] = useContext(UserDataContext);

  const videoCacheContext = useContext(VideoCacheContext);
  if (!videoCacheContext) {
    throw new Error(
      '[OnboardingFeature] Unable to get context data! Was OnboardingFeature rendered outside of VideoCacheContext?',
    );
  }

  const [userMeDataInitiallyFetched, setUserMeDataInitiallyFetched] = useState(false);

  const [enterPhoneLoading, setEnterPhoneLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [markAutoGeneratedRapNameAsViewedLoading, setMarkAutoGeneratedRapNameAsViewedLoading] =
    useState(false);

  const isOnboardingComplete =
    isSignedIn && userMeDataInitiallyFetched
      ? // Either the user must have a phone number
        user.hasVerifiedPhoneNumber ||
        // Or the user must have an external account linked via oauth
        user.externalAccounts.find((account) => account.verification?.status === 'verified')
      : false;

  // Make sure that if the user hasn't yet changed their rap name, that they have viewed the screen
  // that tells them a rap name has been autogenerated prior to finishing up the onboarding
  // workflow.
  const needsToViewAutoGeneratedRapName =
    isSignedIn && userMe.status === 'COMPLETE'
      ? !user.unsafeMetadata.rapperNameChangedFromDefault
      : false;
  const hasViewedAutoGeneratedRapNameIfNeeded =
    isSignedIn && needsToViewAutoGeneratedRapName
      ? user.unsafeMetadata.defaultRapperNameViewed
      : true;

  const [onboardingContextData, setOnboardingContextData] =
    useState<OnboardingContextData>(EMPTY_CONTEXT_DATA);
  const onboardingContextValue = useMemo(
    () => ({
      onboardingContextData,
      setOnboardingContextData,
    }),
    [onboardingContextData, setOnboardingContextData],
  );

  // If fetching user data from the server failed (likely due to the webhook not arriving), reset
  // `loading` so that a user can press "verify" again and attempt to fetch user data again
  useEffect(() => {
    if (!authIsSignedIn) {
      return;
    }
    if (userMeDataInitiallyFetched) {
      return;
    }

    switch (userMe.status) {
      case 'COMPLETE':
        // Once the user data has been initially fetched, then block this effect from running again
        setUserMeDataInitiallyFetched(true);
        break;

      case 'ERROR':
        // Disable the loading state so that a user can press "verify" again to attempt to log in a
        // second time
        setEnterPhoneLoading(false);
        setVerifyLoading(false);

        showMessage({
          message: 'Error getting user data from server!',
          description: 'Try again in a few minutes...',
          type: 'warning',
        });
        break;
    }
  }, [isSignedIn, userMeDataInitiallyFetched, setUserMeDataInitiallyFetched, userMe.status]);

  // Once the user is logged in, set a default rap tag and username
  //
  // NOTE: it's possible that this logic may not run if a user force quits the app / looses internet
  // in the middle of the onboarding workflow. Think through this to make sure it doesn't result
  // in problems.
  useEffect(() => {
    const run = async () => {
      if (!authIsSignedIn) {
        return;
      }
      if (!user) {
        return;
      }
      if (!userMeDataInitiallyFetched) {
        return;
      }
      if (!getToken) {
        return;
      }

      // If the username / rapper name are already set, then skip the below
      // It should only run if these values haven't been set yet
      if (user.username || user.unsafeMetadata.rapperName) {
        return;
      }

      let name: string;
      let generatedUsername: string;
      let success = false;

      for (let index = 0; index < 10; index += 1) {
        try {
          name = await BarzAPI.getPregeneratedRandomRapTag(getToken);
        } catch (err: FixMe) {
          console.log(`Error generating rap tag - attempt ${index}: ${err.stack}`);
          continue;
        }

        generatedUsername = generateHandleFromRapperName(name);

        try {
          const result = await user.update({
            username: generatedUsername,
            unsafeMetadata: {
              ...user.unsafeMetadata,
              rapperName: name,
              rapperNameChangedFromDefault: false,
            },
          });
          console.log('Set username result:', result);
          success = true;
          break;
        } catch (err: FixMe) {
          // If the username has already been taken, try another username
          if (err.errors.find((e: FixMe) => e.code === 'form_identifier_exists')) {
            console.log(`Username ${generatedUsername} already taken!`);
            continue;
          }

          console.log('Error setting username:', err);
          showMessage({
            message: 'Error setting default rap tag!',
            type: 'warning',
          });
          success = false;
          break;
        }
      }

      if (!success) {
        console.log('Error setting initial rap tag for user!');
        return;
      }

      // Optimisitally update the user me data
      //
      // NOTE: doing this by refetching the data from the server won't necesarily work because clerk
      // is feeding the api service data over a webhook, and there is a certain amount of latency
      // inherint in that process. Making another request to the server would cause that request and
      // the webhook process I just outlined to get into a "race" and it is undefined who would win.
      updateUserMe((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: {
            ...old.data,
            handle: generatedUsername,
            name,
          },
        };
      });
    };
    run();
  }, [authIsSignedIn, user, userMeDataInitiallyFetched, getToken, updateUserMe]);

  // When the user logs out, reset `userMeDataInitiallyFetched` for the next login attempt
  useEffect(() => {
    if (userMeDataInitiallyFetched && !isSignedIn) {
      setUserMeDataInitiallyFetched(false);
    }
  }, [userMeDataInitiallyFetched, isSignedIn, setUserMeDataInitiallyFetched]);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.loadingWrapper}>
        <Text style={styles.loadingText}>Loading clerk...</Text>
      </SafeAreaView>
    );
  }

  if (isSignedIn && isOnboardingComplete && hasViewedAutoGeneratedRapNameIfNeeded) {
    // The user successfully completed the onboarding workflow and is now signed in
    return <Fragment>{children}</Fragment>;
  }

  return (
    <OnboardingContext.Provider value={onboardingContextValue}>
      <Stack.Navigator>
        <Stack.Screen
          name="Onboarding > Enter Phone"
          options={{ headerShown: false, orientation: 'portrait' }}
        >
          {(props) => (
            <LoginEnterPhone
              {...props}
              loading={enterPhoneLoading}
              onChangeLoading={setEnterPhoneLoading}
              needsToViewAutoGeneratedRapName={needsToViewAutoGeneratedRapName}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="Onboarding > Verify Code"
          options={{
            orientation: 'portrait',
            headerTitle: '',
            headerLeft: () => <HeaderBackButton />,
          }}
        >
          {(props) => (
            <LoginVerifyCode
              {...props}
              loading={verifyLoading}
              onChangeLoading={setVerifyLoading}
              needsToViewAutoGeneratedRapName={needsToViewAutoGeneratedRapName}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="Onboarding > Create Rap Name Intro"
          options={{
            orientation: 'portrait',
            headerShown: false,
          }}
        >
          {(props) => (
            <CreateRapNameIntro
              {...props}
              nextLoading={markAutoGeneratedRapNameAsViewedLoading}
              onPressNext={async () => {
                if (!isSignedIn) {
                  return;
                }

                setMarkAutoGeneratedRapNameAsViewedLoading(true);

                try {
                  const result = await user.update({
                    unsafeMetadata: {
                      ...user.unsafeMetadata,
                      defaultRapperNameViewed: true,
                    },
                  });
                  console.log('Store `defaultRapperNameViewed` result:', result);
                } catch (err: FixMe) {
                  console.log('Error storing `defaultRapperName` viewed:', err);
                  showMessage({
                    message: 'Error logging default rapper name viewed!',
                    type: 'warning',
                  });
                }

                setMarkAutoGeneratedRapNameAsViewedLoading(false);
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};

export default OnboardingFeature;