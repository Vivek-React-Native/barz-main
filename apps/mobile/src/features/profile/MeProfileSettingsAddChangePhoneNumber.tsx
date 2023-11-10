import * as React from 'react';
import { useContext, useState, useCallback } from 'react';
import { showMessage } from 'react-native-flash-message';
import {
  KeyboardAvoidingView,
  SafeAreaView,
  StyleSheet,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { PhoneNumberResource } from '@clerk/types';
import { phone } from 'phone';

import { FixMe } from '@barz/mobile/src/lib/fixme';
import Button from '@barz/mobile/src/ui/Button';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import TextField from '@barz/mobile/src/ui/TextField';
import { ArrowRight as IconArrowRight } from '@barz/mobile/src/ui/icons';
import { UserDataContext } from '@barz/mobile/src/user-data';
import VerificationCodeBox from '@barz/mobile/src/components/VerificationCodeBox';

import { PageProps } from '.';

const styles = StyleSheet.create({
  wrapper: {
    padding: 8,
    height: '100%',
    gap: 16,
  },

  verificationCodeIntroHeader: {
    ...Typography.Heading1,
    color: Color.White,
    marginTop: 24,
    marginLeft: 8,
  },
  verificationCodeIntroBody: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
    marginTop: 8,
  },
  verificationCodeForm: {
    gap: 24,
    marginTop: 48,
  },

  verificationCodeResendForm: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  verificationCodeResendFormIntro: {
    ...Typography.Body2,
    color: Color.Gray.Dark11,
  },
});

// This component contains a sub-workflow that can be selected from within the "settings" page that
// allows a user to change the phone number associated with their account.
const MeProfileSettingsChangePhoneNumber: React.FunctionComponent<
  PageProps<'Profile > Settings > Phone Number Settings > Add/Change Phone Number'>
> = ({ navigation }) => {
  const { isSignedIn, user } = useUser();

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');

  const [createdPhoneNumber, setCreatedPhoneNumber] = useState<PhoneNumberResource | null>(null);

  const [_userMe, updateUserMe] = useContext(UserDataContext);

  // Sends the initial phone number code to the user
  const onSendVerificationCodeToPhoneNumber = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    // Make sure what the user entered is a valid phone number
    const formattedPhoneNumberResult = phone(phoneNumber);
    if (!formattedPhoneNumberResult.isValid) {
      showMessage({
        message: `The value ${phoneNumber} is not a valid phone number!`,
        type: 'info',
      });
      return;
    }

    let phoneNumberResource = user.phoneNumbers.find(
      (p) => p.phoneNumber === formattedPhoneNumberResult.phoneNumber,
    );

    setLoading(true);
    try {
      if (!phoneNumberResource) {
        phoneNumberResource = await user.createPhoneNumber({ phoneNumber });
        await phoneNumberResource.prepareVerification();
      } else {
        await phoneNumberResource.prepareVerification();
      }
    } catch (err: FixMe) {
      if (err.errors.find((e: FixMe) => e.code === 'form_identifier_exists')) {
        // FIXME: does this leak information about other users?
        showMessage({
          message: 'This phone number is already in use!',
          type: 'info',
        });
        setLoading(false);
        return;
      }
      console.log(`Sending verification code to phone number ${phoneNumber} failed: ${err}`);
      showMessage({
        message: `Sending verification code to phone number ${phoneNumber} failed!`,
        type: 'warning',
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    setCreatedPhoneNumber(phoneNumberResource);
  }, [phoneNumber, user, isSignedIn, setLoading, setCreatedPhoneNumber]);

  // Sends a new phone number code to the user
  const onResendCode = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }
    if (!createdPhoneNumber) {
      return;
    }

    setResendLoading(true);
    try {
      await createdPhoneNumber.prepareVerification();
    } catch (err: FixMe) {
      console.log(`Resending verification code to phone number ${phoneNumber} failed: ${err}`);
      showMessage({
        message: `Failed to resend code to phone number ${phoneNumber}!`,
        type: 'warning',
      });
    } finally {
      setResendLoading(false);
    }
  }, [isSignedIn, phoneNumber, createdPhoneNumber, setResendLoading]);

  // This verifies the phone number code that the user entered was correct
  const onPressVerify = useCallback(
    async (code: string) => {
      if (!isSignedIn) {
        return;
      }
      if (!createdPhoneNumber) {
        return;
      }

      setLoading(true);
      try {
        // Attempt to verify the phone number
        await createdPhoneNumber.attemptVerification({ code });

        // Adjust the user to have the new phone number as the default one
        await user.update({
          primaryPhoneNumberId: createdPhoneNumber.id,
        });

        // Delete all phone numbers that are NOT the phone number that was just added
        await Promise.all(
          user.phoneNumbers
            .filter((pn) => pn.id !== createdPhoneNumber.id)
            .map((pn) => pn.destroy()),
        );
      } catch (err: FixMe) {
        console.log(`Verifying phone number ${phoneNumber} failed: ${err}`);
        showMessage({
          message: `Failed to verify phone number ${phoneNumber}!`,
          type: 'warning',
        });
        setLoading(false);
        return;
      }
      setLoading(false);

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
            phoneNumber: createdPhoneNumber.phoneNumber,
          },
        };
      });

      // Once complete, navigate back to the settings page
      navigation.navigate('Profile > Settings');
    },
    [navigation, user, isSignedIn, phoneNumber, createdPhoneNumber, setLoading],
  );

  const onSubmitCode = useCallback(
    (code: string) => {
      setCode(code);
      onPressVerify(code);
    },
    [setCode, onPressVerify],
  );

  if (!createdPhoneNumber) {
    return (
      <SafeAreaView testID="profile-settings-change-phone-number-enter-number-wrapper">
        <KeyboardAvoidingView>
          <Pressable style={styles.wrapper} onPress={Keyboard.dismiss}>
            <Text style={styles.verificationCodeIntroHeader}>Phone Number</Text>

            <TextField
              type="clear"
              size={56}
              autoCapitalize="none"
              autoFocus
              value={phoneNumber}
              placeholder="eg, +1-555-555-5555"
              onChangeText={(phoneNumber) => setPhoneNumber(phoneNumber)}
              keyboardType="phone-pad"
              testID="profile-settings-change-phone-number-enter-number-input-field"
            />

            <Button
              size={56}
              type="primary"
              onPress={onSendVerificationCodeToPhoneNumber}
              disabled={loading || phoneNumber.length === 0}
              testID="profile-settings-change-phone-number-enter-number-submit"
            >
              {loading ? 'Loading...' : 'Verify Phone Number'}
            </Button>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  } else {
    return (
      <SafeAreaView testID="profile-settings-change-phone-number-verify-wrapper">
        <KeyboardAvoidingView>
          <Pressable onPress={Keyboard.dismiss} style={styles.wrapper}>
            <Text style={styles.verificationCodeIntroHeader}>Enter 6-digit code</Text>
            <Text style={styles.verificationCodeIntroBody}>
              We send a 6 digit code to you at {createdPhoneNumber.phoneNumber}
            </Text>

            <View style={styles.verificationCodeForm}>
              <VerificationCodeBox
                code={code}
                onChangeCode={setCode}
                numberOfCharacters={6}
                autoFocus
                onSubmitCode={onSubmitCode}
                testID="profile-settings-change-phone-number-verify"
              />

              <View style={styles.verificationCodeResendForm}>
                <Text style={styles.verificationCodeResendFormIntro}>Didn't receive code?</Text>
                {!loading ? (
                  <Button
                    size={32}
                    type="text"
                    color={Color.Brand.Yellow}
                    onPress={onResendCode}
                    disabled={loading || resendLoading}
                  >
                    {resendLoading ? 'Resending...' : 'Resend code'}
                  </Button>
                ) : null}
              </View>

              <Button
                size={56}
                type="secondary"
                onPress={() => onPressVerify(code)}
                disabled={code.length !== 6 || loading}
                trailing={(color) => <IconArrowRight color={color} />}
              >
                {loading ? 'Loading...' : 'Verify Code'}
              </Button>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
};

export default MeProfileSettingsChangePhoneNumber;
