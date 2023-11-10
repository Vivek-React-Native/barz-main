import { Fragment, useState, useContext, useCallback, useEffect } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  Pressable,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { UserDataContext } from '@barz/mobile/src/user-data';

import Button from '@barz/mobile/src/ui/Button';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { ArrowRight as IconArrowRight } from '@barz/mobile/src/ui/icons';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import generateHandleFromRapperName from '@barz/mobile/src/lib/rapper-name';

import RapperNameField from '@barz/mobile/src/components/RapperNameField';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';
import { doesUserNeedsAvatarImage, doesUserNeedToFillOutBio } from './IntroSlideshow';

const styles = StyleSheet.create({
  wrapper: {
    height: '100%',
    paddingLeft: 16,
    paddingRight: 16,
  },

  header: {
    ...Typography.Heading1,
    color: Color.White,
    marginTop: 16,
  },
  body: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
  },
  rapperNameFieldWrapper: {
    paddingTop: 12,
  },
});

const IntroCreateRapTag: React.FunctionComponent<PageProps<'Battle > Create Rap Tag'>> = ({
  navigation,
  route,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();

  const { matchingScreenParams } = route.params;

  const [userMe, updateUserMe] = useContext(UserDataContext);

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  // If the user is signed in already, redirect them to later in the process if there is metadata
  // they still have not entered
  const userNeedsAvatarImage = isSignedIn ? doesUserNeedsAvatarImage(user) : true;
  const userNeedsToFillOutBio =
    userMe.status === 'COMPLETE' ? doesUserNeedToFillOutBio(userMe.data) : true;
  const onMoveToNextPage = useCallback(() => {
    if (!isSignedIn) {
      return;
    }

    if (userNeedsAvatarImage) {
      navigation.push('Battle > Upload Avatar', { matchingScreenParams });
    } else if (userNeedsToFillOutBio) {
      navigation.push('Battle > Complete Bio', { matchingScreenParams });
    } else {
      navigation.push('Battle > Matching', matchingScreenParams);
    }
  }, [isSignedIn, userNeedsAvatarImage, userNeedsToFillOutBio, matchingScreenParams]);

  const onSetName = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setLoading(true);

    const userUpdate: Parameters<typeof user.update>[0] = {
      unsafeMetadata: {
        ...user.unsafeMetadata,
        rapperNameChangedFromDefault: true,
      },
    };

    // If there was no name entered, then skip setting a new username / rapper name value
    if (name.length === 0) {
      try {
        await user.update(userUpdate);
      } catch (err: any) {
        console.log(`Error marking rap tag as set:`, err);
        showMessage({
          message: 'Error marking rap tag as set!',
          type: 'info',
        });
      }

      setLoading(false);
      onMoveToNextPage();
      return;
    }

    let generatedUsername: string;
    let success = false;

    for (let index = 0; index < 10; index += 1) {
      generatedUsername = generateHandleFromRapperName(name, index);
      try {
        const result = await user.update({
          ...userUpdate,
          username: generatedUsername,
          unsafeMetadata: {
            ...userUpdate.unsafeMetadata,
            rapperName: name,
          },
        });
        console.log('Set username result:', result);
        success = true;
        break;
      } catch (err: any) {
        // If the username has already been taken, try the next username
        if (err.errors.find((e: FixMe) => e.code === 'form_identifier_exists')) {
          continue;
        }

        console.log(`Error setting username and rapperName:`, err);
        showMessage({
          message: 'Error setting username and rapperName!',
          type: 'info',
        });
      }
    }

    setLoading(false);

    if (!success) {
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

    onMoveToNextPage();
  }, [isLoaded, isSignedIn, user, setLoading, name, updateUserMe, onMoveToNextPage]);

  if (userMe.status !== 'COMPLETE') {
    return (
      <Fragment>
        <StatusBar style="light" />
        <SafeAreaView testID="battle-intro-create-name-page">
          <Text style={styles.header}>User not initialized!</Text>
        </SafeAreaView>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <StatusBar style="light" />
      <SafeAreaView testID="battle-intro-create-rap-tag-wrapper">
        <Pressable style={styles.wrapper} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView style={{ gap: 24 }}>
            <Text style={styles.header}>Create Rap Tag</Text>
            <Text style={styles.body}>
              Your generated rap tag is{' '}
              <Text
                style={{
                  ...Typography.Body1Bold,
                  color: Color.White,
                }}
              >
                {userMe.data.name}
              </Text>
              . Feel free to change it something that's more your style. You can change it any time.
            </Text>
            <View style={styles.rapperNameFieldWrapper}>
              <RapperNameField
                value={name}
                placeholder={userMe.data.name || ''}
                onChangeText={(name) => setName(name)}
                testID="battle-intro-create-rap-tag-input"
              />
            </View>
            <Button
              flexGrow={1}
              size={48}
              type="primary"
              onPress={onSetName}
              disabled={loading}
              testID="battle-intro-create-rap-tag-continue-button"
              trailing={(color) => <IconArrowRight color={color} />}
            >
              {loading ? 'Loading...' : 'Continue'}
            </Button>
          </KeyboardAvoidingView>
        </Pressable>
      </SafeAreaView>
    </Fragment>
  );
};

export default IntroCreateRapTag;
