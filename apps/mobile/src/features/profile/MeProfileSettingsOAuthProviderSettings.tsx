import * as React from 'react';
import { useState } from 'react';
import { showMessage } from 'react-native-flash-message';
import { useUser } from '@clerk/clerk-expo';
import { Alert, Text, ScrollView, SafeAreaView, StyleSheet, View, Image } from 'react-native';

import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import ListItem from '@barz/mobile/src/ui/ListItem';

import { User as IconUser } from '@barz/mobile/src/ui/icons';

import { PageProps } from '.';

const styles = StyleSheet.create({
  scrollWrapper: {
    height: '100%',
    width: '100%',
  },
  centerWrapper: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  externalUserWrapper: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  externalUserAvaterImage: {
    width: 64,
    height: 64,
    backgroundColor: Color.Gray.Dark5,

    alignItems: 'center',
    justifyContent: 'center',
  },
  externalUserDetails: {
    gap: 4,
    justifyContent: 'center',
  },
});

const MeProfileSettingsOAuthProviderSettings: React.FunctionComponent<
  PageProps<'Profile > Settings > OAuth Provider Settings'>
> = ({ navigation, route }) => {
  const { isSignedIn, user } = useUser();

  const [loading, setLoading] = useState(false);

  const clerkProviderSettings = isSignedIn
    ? user.externalAccounts.find(
        (account) =>
          account.provider === route.params?.providerName &&
          account.verification?.status === 'verified',
      )
    : null;

  const phoneNumber = isSignedIn ? user.primaryPhoneNumber?.phoneNumber : null;

  const otherExternalAuthProvidersAreNotConfigured = isSignedIn
    ? user.externalAccounts
        .filter((account) => account !== clerkProviderSettings)
        .every((account) => account.verification?.status !== 'verified')
    : true;

  if (!clerkProviderSettings) {
    return (
      <SafeAreaView testID="profile-oauth-provider-settings-wrapper">
        <View style={styles.centerWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>
            {`Unknown provider ${route.params?.title || 'unset'}`}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="profile-oauth-provider-settings-wrapper">
      <ScrollView style={styles.scrollWrapper}>
        <View style={styles.externalUserWrapper}>
          {clerkProviderSettings.avatarUrl ? (
            <Image
              style={styles.externalUserAvaterImage}
              source={{ uri: clerkProviderSettings.avatarUrl }}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.externalUserAvaterImage}>
              {/* TODO: maybe make this a provider specific icon? */}
              <IconUser size={32} color={Color.Gray.Dark10} />
            </View>
          )}
          <View style={styles.externalUserDetails}>
            <Text style={{ ...Typography.Body1Bold, color: Color.White }}>
              {route.params?.title}
            </Text>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark10 }}>
              {clerkProviderSettings.emailAddress}
            </Text>
          </View>
        </View>

        <ListItem
          type="danger"
          onPress={() => {
            if (!clerkProviderSettings) {
              return;
            }

            Alert.alert(
              'Are you sure?',
              `This will remove your ${route.params?.title} account from Barz`,
              [
                {
                  text: 'Remove',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await clerkProviderSettings.destroy();
                      navigation.goBack();
                      showMessage({
                        message: 'Detached auth provider!',
                        type: 'success',
                      });
                    } catch (err) {
                      console.log(
                        `Detaching oauth provider ${route.params?.providerName} failed: ${err}`,
                      );
                      showMessage({
                        message: 'Failed to detach auth provider!',
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
              ],
            );
          }}
          disabled={loading || (otherExternalAuthProvidersAreNotConfigured && !phoneNumber)}
          testID="profile-oauth-provider-settings-detach"
        >
          {loading ? 'Unassociating account...' : 'Unassociate Account'}
        </ListItem>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MeProfileSettingsOAuthProviderSettings;
