import { Fragment, useState, useCallback, useContext, useEffect } from 'react';
import {
  Platform,
  Text,
  SafeAreaView,
  KeyboardAvoidingView,
  View,
  Image,
  Pressable,
  Keyboard,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Video from 'react-native-video';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSignUp, useSignIn, useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { PhoneCodeFactor } from '@clerk/types';
import { phone } from 'phone';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '@barz/mobile/src/ui/Button';
import TextField from '@barz/mobile/src/ui/TextField';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import DeveloperModeActivator from '@barz/mobile/src/components/DeveloperModeActivator';
import useAppState from '@barz/mobile/src/lib/use-app-state';
import openWebAuthSession from '@barz/mobile/src/lib/open-web-auth-session';
import { UserDataContext } from '@barz/mobile/src/user-data';

import BarzLogo from '@barz/mobile/src/components/BarzLogo';
import { DeveloperModeCache } from '@barz/mobile/src/lib/cache';

import OnboardingContext from './context';
// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';

// @ts-ignore
import greeterVideoSource from '@barz/mobile/src/assets/greeter.mp4';
import { BarzAPI } from '@barz/mobile/src/lib/api';
import { DEMO_PHONE_NUMBER, FACEBOOK_AUTH_ENABLED } from '@barz/mobile/src/config';

const styles = StyleSheet.create({
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    // width,
    // height,
  },

  wrapper: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  keyboardAvoidingView: {
    position: 'relative',
    width: '100%',
  },

  movingGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    // width,
    // height,
    zIndex: 1,
  },

  logInFormWrapper: {
    width: '100%',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 16,
    zIndex: 2,
  },

  logInIntroText: {
    ...Typography.Body1Bold,
    color: Color.White,
  },

  loginOAuthButtonWrapper: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
});

const LoginEnterPhone: React.FunctionComponent<
  PageProps<'Onboarding > Enter Phone'> & {
    loading: boolean;
    onChangeLoading: (newLoading: boolean) => void;
    needsToViewAutoGeneratedRapName: boolean;
  }
> = ({ navigation, loading, onChangeLoading, needsToViewAutoGeneratedRapName }) => {
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();

  const [_userMe, _updateUserMe, forceReloadUserMe] = useContext(UserDataContext);
  const { isSignedIn } = useAuth();

  const { setOnboardingContextData } = useContext(OnboardingContext);
  const { width, height } = useWindowDimensions();

  // Warm up the android browser to improve UX
  // https://docs.expo.dev/guides/authentication/#improving-user-experience
  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // When the page becomes inactive, pause the background video, and play it when the page becomes
  // active again
  //
  // By default, the video seems to stop playing automatically when this component is no longer
  // active (ie, a web view slides up from the bottom of the screen for oauth)
  const [backgroundVideoPaused, setBackgroundVideoPaused] = useState(false);
  const appState = useAppState();
  useEffect(() => {
    switch (appState) {
      case 'inactive':
      case 'background':
        setBackgroundVideoPaused(true);
        break;
      default:
        setBackgroundVideoPaused(false);
        break;
    }
  }, [appState, setBackgroundVideoPaused]);

  // When the verify page is initially shown, make sure that the loading state starts disabled
  useFocusEffect(
    useCallback(() => {
      onChangeLoading(false);
    }, [onChangeLoading]),
  );

  const [phoneNumber, setPhoneNumber] = useState('');

  const onSendAccessCodePress = async () => {
    if (!isSignInLoaded) {
      return;
    }
    // alert(`DEMO PHONE NUMBER: "${phoneNumber}" === "${DEMO_PHONE_NUMBER}"`);

    // This is a special phone number used for apple / google app testers to sign in!
    // Entering this value will cause the app to sign in to an existing demo user account
    if (phoneNumber === DEMO_PHONE_NUMBER) {
      try {
        const data = await BarzAPI.getDemoClerkTicket();
        const completeSignIn = await signIn.create(data);
        await setActive({ session: completeSignIn.createdSessionId });
      } catch (err: FixMe) {
        console.error(`Error signing in to demo clerk account: ${err}`);
        showMessage({
          message: 'Error signing in to demo clerk account!',
          type: 'warning',
        });
      }
      return;
    }

    // Make sure what the user entered is a valid phone number
    const formattedPhoneNumberResult = phone(phoneNumber);
    if (!formattedPhoneNumberResult.isValid) {
      showMessage({
        message: `The value '${phoneNumber}' is not a valid phone number!`,
        type: 'warning',
      });
      return;
    }

    onChangeLoading(true);
    try {
      let shouldSignUp = false;
      let firstPhoneFactor: PhoneCodeFactor;

      // First, attempt to sign in using the phone number
      // ref: https://clerk.com/docs/authentication/custom-flows/email-sms-otp
      try {
        // Kick off the sign-in process, passing the user's authentication identifier. In this case it's their
        // phone number.
        const { supportedFirstFactors } = await signIn.create({
          identifier: formattedPhoneNumberResult.phoneNumber,
        });

        // Find the phoneNumberId from all the available first factors for the current sign in
        const factor = supportedFirstFactors.find((factor): factor is PhoneCodeFactor => {
          return factor.strategy === 'phone_code';
        });
        if (!factor) {
          throw new Error(`No phone_code factor found for user with phone number ${phoneNumber}!`);
        }
        firstPhoneFactor = factor;

        // Prepare first factor verification, specifying the phone code strategy.
        await signIn.prepareFirstFactor({
          strategy: 'phone_code',
          phoneNumberId: firstPhoneFactor.phoneNumberId,
        });
      } catch (err: FixMe) {
        console.log('ERRORS:', err.errors);
        if (err.errors.find((e: FixMe) => e.code === 'identifier_already_signed_in')) {
          showMessage({
            message: 'You are already signed in somewhere else!',
            type: 'info',
          });
          return;
        }
        console.log(
          `Sign in for phone number ${phoneNumber} failed, so signing up instead: ${err}`,
        );
        shouldSignUp = true;
      }

      // If signing in with the phone number fails, then try to sign up instead
      if (shouldSignUp) {
        if (!isSignUpLoaded) {
          return;
        }

        try {
          // Kick off the sign-up process, passing the user's phone number.
          await signUp.create({ phoneNumber });

          // Prepare phone number verification. An SMS message will be sent to the user with a one-time
          // verification code.
          await signUp.preparePhoneNumberVerification();
        } catch (err: FixMe) {
          showMessage({
            message: 'Error signing up:',
            description: JSON.stringify(err, null, 2),
            type: 'warning',
          });
        }

        setOnboardingContextData((old) => ({
          ...old,
          mode: 'SIGN_UP',
          rawPhoneNumber: formattedPhoneNumberResult.phoneNumber,
        }));
        navigation.navigate('Onboarding > Verify Code');
        return;
      }

      setOnboardingContextData((old) => ({
        ...old,
        mode: 'SIGN_IN',
        rawPhoneNumber: formattedPhoneNumberResult.phoneNumber,
        phoneNumberId: firstPhoneFactor.phoneNumberId,
      }));
      navigation.navigate('Onboarding > Verify Code');
    } finally {
      onChangeLoading(false);
    }
  };

  const onLoginWithOAuthPressed = async (providerName: 'google' | 'facebook' | 'apple') => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return;
    }

    onChangeLoading(true);

    const strategy = {
      google: 'oauth_google' as const,
      facebook: 'oauth_facebook' as const,
      apple: 'oauth_apple' as const,
    }[providerName];

    // If already signed in, then just reload the user data - it must not have arrived at the server
    // yet
    if (isSignedIn) {
      forceReloadUserMe();
      onChangeLoading(false);
      return;
    }

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
      //
      // NOTE: as of october 2023, there is a hack in place to make this work in production. See
      // src/App.tsx for more info.
      const oauthRedirectUrl = AuthSession.makeRedirectUri({
        native: 'barz://oauth-redirect',
        scheme: 'barz',
        path: 'oauth-redirect',
      });

      await signIn.create({ strategy, redirectUrl: oauthRedirectUrl });

      const { externalVerificationRedirectURL } = signIn.firstFactorVerification;

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
        onChangeLoading(false);
        return;
      }
      if (type !== 'success') {
        throw new Error(`Clerk authSessionResult.type was not "success", found "${type}"`);
      }

      const params = url ? new URL(url).searchParams : null;
      const rotatingTokenNonce = params ? params.get('rotating_token_nonce') || '' : '';
      await signIn.reload({ rotatingTokenNonce });

      const { status, firstFactorVerification } = signIn;

      let createdSessionId: string | null = null;

      if (status === 'complete') {
        createdSessionId = signIn.createdSessionId!;
      } else if (firstFactorVerification.status === 'transferable') {
        await signUp.create({ transfer: true });
        createdSessionId = signUp.createdSessionId || '';
      }

      console.log('\n\nSIGN IN:', signIn);
      console.log('\n\nSIGN UP:', signUp);

      if (!createdSessionId) {
        throw new Error('createdSessionId was falsey!');
      }

      // Sign the newly created user in
      setActive({ session: createdSessionId });
    } catch (err: FixMe) {
      if (err.errors && err.errors.find((e: FixMe) => e.code === 'identifier_already_signed_in')) {
        showMessage({
          message: 'You are already signed in somewhere else!',
          type: 'info',
        });
        onChangeLoading(false);
        return;
      }
      console.log(`Logging in via oauth failed: ${err}`);
      showMessage({
        message: 'Failed to sign in:',
        description: `${err}`,
        type: 'warning',
      });
      onChangeLoading(false);
      return;
    }

    // After signing in successfully, reload the user data. Note that `loading` is still true
    // here - once the user has successfully been reloaded, the root onboarding view will see that
    // the user has logged in and render the main app content rather than the onboarding workflow
    forceReloadUserMe();
  };

  // If the auto generated rap name screen needs to be shown at the very end, then show it
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!needsToViewAutoGeneratedRapName) {
      return;
    }
    navigation.push('Onboarding > Create Rap Name Intro');
  }, [focused, needsToViewAutoGeneratedRapName]);

  // Because this is the first page a user sees when they visit the app, this screen provides a way
  // to activate developer mode!
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  const updateDeveloperModeVisible = useCallback(() => {
    DeveloperModeCache.isEnabled().then((enabled) => {
      setDeveloperModeEnabled(enabled);
    });
  }, [setDeveloperModeEnabled]);
  useFocusEffect(updateDeveloperModeVisible);
  useEffect(updateDeveloperModeVisible, []);

  const onNavigateToDeveloperMode = useCallback(
    () => navigation.navigate('Developer Mode > Visible'),
    [navigation],
  );

  const bottomForm = (
    <Fragment>
      {/* NOTE: this gradient slides up when the user opens the keyboard */}
      <LinearGradient
        style={[styles.movingGradient, { width, height }]}
        colors={['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.5)', 'black']}
        locations={[0, 0.5, 1]}
      />

      <View style={styles.logInFormWrapper}>
        <Text style={styles.logInIntroText}>Continue with Phone</Text>
        <TextField
          size={56}
          type="clear"
          autoCapitalize="none"
          value={phoneNumber}
          placeholder="eg, +1-555-555-5555"
          onChangeText={(phoneNumber) => setPhoneNumber(phoneNumber)}
          keyboardType="phone-pad"
          testID="onboarding-phone-number-input"
        />

        <Button
          width="100%"
          size={56}
          type="primaryAccent"
          onPress={onSendAccessCodePress}
          disabled={loading || phoneNumber.length === 0}
          testID="onboarding-verify-phone-number-button"
        >
          {phoneNumber === DEMO_PHONE_NUMBER
            ? 'Sign in to Demo'
            : loading
            ? 'Loading...'
            : 'Send me an access code'}
        </Button>

        <View style={styles.loginOAuthButtonWrapper}>
          <Button
            size={56}
            type="outline"
            onPress={() => onLoginWithOAuthPressed('google')}
            testID="onboarding-sign-in-google"
            disabled={loading}
            flexGrow={1}
            leading={
              <Image
                source={require('../../images/social-media/Google.png')}
                style={{ width: 22, height: 22 }}
              />
            }
          />
          {FACEBOOK_AUTH_ENABLED ? (
            <Button
              size={56}
              type="outline"
              onPress={() => onLoginWithOAuthPressed('facebook')}
              testID="onboarding-sign-in-facebook"
              disabled={loading}
              flexGrow={1}
              leading={
                <Image
                  source={require('../../images/social-media/Facebook.png')}
                  style={{ width: 22, height: 22 }}
                />
              }
            />
          ) : null}
          <Button
            size={56}
            type="outline"
            onPress={() => onLoginWithOAuthPressed('apple')}
            testID="onboarding-sign-in-apple"
            disabled={loading}
            flexGrow={1}
            leading={
              <Image
                source={require('../../images/social-media/Apple.png')}
                style={{ width: 22, height: 22 }}
              />
            }
          />
        </View>

        {developerModeEnabled ? (
          <Button width="100%" size={56} type="text" onPress={onNavigateToDeveloperMode}>
            Developer Mode
          </Button>
        ) : null}
      </View>
    </Fragment>
  );

  return (
    <Fragment>
      <StatusBar style="light" />

      <Video
        source={greeterVideoSource}
        resizeMode="cover"
        repeat
        paused={backgroundVideoPaused}
        style={[styles.backgroundVideo, { width, height }]}
      />

      <Pressable
        onPress={Keyboard.dismiss}
        style={styles.wrapper}
        testID="onboarding-enter-phone-page"
      >
        <SafeAreaView style={{ zIndex: 2 }}>
          <View style={{ paddingTop: 32 }}>
            <BarzLogo />
          </View>
        </SafeAreaView>

        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView behavior="position" style={styles.keyboardAvoidingView}>
            {bottomForm}
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.keyboardAvoidingView}>{bottomForm}</View>
        )}
      </Pressable>

      {/*
      This component renders two invisible buttons on the lower left and lower right of the
      screen. When pressed in the right order, they enable developer mode.
      */}
      <DeveloperModeActivator showOnTop onActivateDeveloperMode={onNavigateToDeveloperMode} />
    </Fragment>
  );
};

export default LoginEnterPhone;
