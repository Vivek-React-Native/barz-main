import * as React from 'react';
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, View, Text } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useUser } from '@clerk/clerk-expo';

import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import ListItem from '@barz/mobile/src/ui/ListItem';

import { PageProps } from '.';

const styles = StyleSheet.create({
  wrapper: {
    padding: 8,
    height: '100%',
    gap: 16,
  },

  centeredWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  phoneNumberIntroHeader: {
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

const MeProfileSettingsPhoneNumberSettings: React.FunctionComponent<
  PageProps<'Profile > Settings > Phone Number Settings'>
> = ({ navigation }) => {
  const { isSignedIn, user } = useUser();
  const [loading, setLoading] = useState(false);

  const phoneNumber = isSignedIn ? user.primaryPhoneNumber?.phoneNumber : null;

  const externalAuthProvidersAreNotConfigured = isSignedIn
    ? user.externalAccounts.every((account) => account.verification?.status !== 'verified')
    : true;

  if (!phoneNumber) {
    return (
      <SafeAreaView>
        <View style={styles.centeredWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>
            No phone number attached to account
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <View style={styles.wrapper} testID="profile-phone-number-settings-wrapper">
        <Text style={styles.phoneNumberIntroHeader}>{phoneNumber}</Text>

        <ListItem
          onPress={() =>
            navigation.push('Profile > Settings > Phone Number Settings > Add/Change Phone Number')
          }
          testID="profile-phone-number-settings-change-phone-number"
          disabled={loading}
        >
          Change Phone Number
        </ListItem>

        <ListItem
          type="danger"
          disabled={loading || externalAuthProvidersAreNotConfigured}
          testID="profile-phone-number-settings-remove-phone-number"
          onPress={() => {
            Alert.alert('Are you sure?', `This will remove your phone number from Barz`, [
              {
                text: 'Remove',
                onPress: async () => {
                  if (!isSignedIn || !user.primaryPhoneNumber) {
                    return;
                  }

                  setLoading(true);
                  try {
                    await user.primaryPhoneNumber.destroy();
                    navigation.goBack();
                    showMessage({
                      message: 'Removed phone number!',
                      type: 'success',
                    });
                  } catch (err) {
                    console.log(`Removing phone number failed: ${err}`);
                    showMessage({
                      message: 'Failed to remove phone number!',
                      description: JSON.stringify(data),
                      type: 'warning',
                    });
                  } finally {
                    setLoading(false);
                  }
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {},
              },
            ]);
          }}
        >
          {loading ? 'Removing Phone Number...' : 'Remove Phone Number'}
        </ListItem>
      </View>
    </SafeAreaView>
  );
};

export default MeProfileSettingsPhoneNumberSettings;
