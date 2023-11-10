import { Fragment, useState, useContext, useEffect } from 'react';
import { Text, SafeAreaView, View, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { UserDataContext } from '@barz/mobile/src/user-data';

import Button from '@barz/mobile/src/ui/Button';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { ArrowRight as IconArrowRight } from '@barz/mobile/src/ui/icons';
import { FixMe } from '@barz/mobile/src/lib/fixme';

import { UserProfileAvatarImageUpload } from '@barz/mobile/src/components/UserProfile';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';
import { doesUserNeedToFillOutBio } from './IntroSlideshow';

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  inner: {
    width: '100%',
    flexDirection: 'column',
    flexShrink: 1,
    gap: 40,
    alignItems: 'center',
    top: '20%',
  },

  header: {
    ...Typography.Heading1,
    color: Color.White,
    textAlign: 'center',
  },
  profileImageWrapper: {
    gap: 24,
    width: '100%',
    alignItems: 'center',
  },
  profileImageAssociatedUserName: {
    ...Typography.Heading4,
    color: Color.White,
  },

  actionButtonWrapper: {
    paddingLeft: 16,
    paddingRight: 16,
    width: '100%',
    position: 'absolute',
    bottom: 48,
  },
});

const IntroUploadAvatar: React.FunctionComponent<PageProps<'Battle > Upload Avatar'>> = ({
  navigation,
  route,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const [userMe, updateUserMe] = useContext(UserDataContext);

  const { matchingScreenParams } = route.params;

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [imageLoading, setImageLoading] = useState(false);

  const onChangeAvatarImageUrl = async (uri: string | null) => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setImageLoading(true);

    try {
      let fileOrNull: File | null = null;

      if (uri) {
        const fileName = uri.split('/').at(-1) || '';
        const imageResponse = await fetch(uri, { method: 'HEAD' });
        const mimeType = imageResponse.headers.get('content-type');

        // NOTE: it turns out that calling user.setProfileImage does not work in expo due
        // to (it seems like) issues with the File / Blob / FileData implementation. More about this
        // issue can be found here: https://github.com/clerkinc/javascript/issues/1085
        //
        // I was thinking this wasn't going to work, but then stumbled across this technique
        // which WORKED which I am kinda shocked by: https://stackoverflow.com/a/68196895/4115328
        // But it's kinda a hack, and if they fix this properly in the clerk library, it would
        // be good to use a supported mechanism...
        fileOrNull = {
          name: fileName,
          uri,
          type: mimeType,
        } as FixMe;
      }

      // First, store whether the avatar image is enabled or not
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          avatarImageUploaded: uri ? true : false,
        },
      });

      // And then upload the correct image
      await user.setProfileImage({
        file: fileOrNull,
      });
    } catch (err: any) {
      showMessage({
        message: 'Error updating profile image:',
        description: JSON.stringify(err, null, 2),
        type: 'warning',
      });
      setImageLoading(false);
      return;
    }

    setImageUrl(uri);

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
          profileImageUrl: uri,
        },
      };
    });

    setImageLoading(false);
  };

  return (
    <Fragment>
      <StatusBar style="light" />
      <SafeAreaView style={styles.wrapper} testID="battle-intro-upload-avatar-wrapper">
        <View style={styles.inner}>
          <Text style={styles.header}>
            Upload your {'\n'}
            avatar <Text style={{ color: Color.Red.Dark10 }}>*</Text>
          </Text>

          <View style={styles.profileImageWrapper}>
            <View testID="battle-intro-upload-avatar-image">
              <UserProfileAvatarImageUpload
                profileImageUrl={imageUrl}
                size={140}
                loading={imageLoading}
                onChangeImageUrl={onChangeAvatarImageUrl}
              />
            </View>
            <Text style={styles.profileImageAssociatedUserName}>
              {userMe.status === 'COMPLETE' ? userMe.data.name : null}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtonWrapper}>
          <Button
            size={56}
            width="100%"
            type="primary"
            onPress={() => {
              if (userMe.status !== 'COMPLETE') {
                return;
              }

              if (doesUserNeedToFillOutBio(userMe.data)) {
                navigation.navigate('Battle > Complete Bio', { matchingScreenParams });
              } else {
                navigation.navigate('Battle > Matching', matchingScreenParams);
              }
            }}
            disabled={imageUrl === null || imageLoading}
            trailing={(color) => <IconArrowRight color={color} />}
            testID="battle-intro-upload-avatar-next-button"
          >
            {imageLoading ? 'Loading...' : 'Next'}
          </Button>
        </View>
      </SafeAreaView>
    </Fragment>
  );
};

export default IntroUploadAvatar;
