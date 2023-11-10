import { Fragment, useContext } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserDataContext } from '@barz/mobile/src/user-data';
import { UserProfileBioDetails, UserProfileHeader } from '@barz/mobile/src/components/UserProfile';

import Button from '@barz/mobile/src/ui/Button';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  bottomButtonWrapper: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    gap: 16,
  },
});

const IntroProfilePreview: React.FunctionComponent<PageProps<'Battle > Profile Preview'>> = ({
  navigation,
  route,
}) => {
  const { matchingScreenParams } = route.params;

  const [userMe] = useContext(UserDataContext);

  if (userMe.status !== 'COMPLETE') {
    return null;
  }

  return (
    <Fragment>
      <StatusBar style="light" />
      <SafeAreaView testID="battle-intro-profile-preview-wrapper">
        <ScrollView contentContainerStyle={styles.wrapper}>
          <UserProfileHeader user={userMe.data} />
          <View style={{ height: 32 }} />
          <UserProfileBioDetails user={userMe.data} isOwnProfile={false} />
        </ScrollView>

        <View style={styles.bottomButtonWrapper}>
          <Button
            size={56}
            type="primaryAccent"
            testID="battle-intro-profile-preview-done-button"
            onPress={() => navigation.push('Battle > Matching', matchingScreenParams)}
          >
            Looks good, let's battle!
          </Button>
          <Button
            size={56}
            type="secondary"
            testID="battle-intro-profile-preview-cancel-button"
            onPress={() => navigation.navigate('Battle > Initial')}
          >
            Maybe later
          </Button>
        </View>
      </SafeAreaView>
    </Fragment>
  );
};

export default IntroProfilePreview;
