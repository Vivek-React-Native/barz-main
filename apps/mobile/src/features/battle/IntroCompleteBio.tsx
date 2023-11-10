import { Fragment, useContext } from 'react';
import { View, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserDataContext } from '@barz/mobile/src/user-data';
import UserProfile from '@barz/mobile/src/components/UserProfile';
import { UserMe, FavoriteArtist, FavoriteTrack, RoughLocation } from '@barz/mobile/src/lib/api';

import Button from '@barz/mobile/src/ui/Button';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';

const IntroCompleteBio: React.FunctionComponent<
  PageProps<'Battle > Complete Bio'> & {
    workingUserSavingBioDataToApi: boolean;
    workingUserMeIntro: UserMe['intro'];
    onChangeWorkingUserMeIntro: (newIntro: UserMe['intro']) => void;
    workingUserMeRoughLocation: RoughLocation | null;
    onChangeWorkingUserMeRoughLocation: (newRoughLocation: RoughLocation | null) => void;
    workingUserMeFavoriteRapper: FavoriteArtist | null;
    onChangeWorkingUserMeFavoriteRapper: (newFavoriteRapper: FavoriteArtist | null) => void;
    workingUserMeFavoriteSong: FavoriteTrack | null;
    onChangeWorkingUserMeFavoriteSong: (newFavoriteTrack: FavoriteTrack | null) => void;
    workingUserMeInstagramHandle: string;
    onChangeWorkingUserMeInstagramHandle: (newHandle: string) => void;
    workingUserMeSoundcloudHandle: string;
    onChangeWorkingUserMeSoundcloudHandle: (soundcloudHandle: string) => void;

    onSaveWorkingUserBioDataToApi: () => Promise<void>;

    onPickFavoriteArtist: () => Promise<FavoriteArtist | null>;
    onPickFavoriteSong: () => Promise<FavoriteTrack | null>;
    onPickRoughLocation: () => Promise<RoughLocation | null>;
  }
> = ({
  navigation,
  route,

  workingUserSavingBioDataToApi,
  workingUserMeIntro,
  onChangeWorkingUserMeIntro,
  workingUserMeRoughLocation,
  onChangeWorkingUserMeRoughLocation,
  workingUserMeFavoriteRapper,
  onChangeWorkingUserMeFavoriteRapper,
  workingUserMeFavoriteSong,
  onChangeWorkingUserMeFavoriteSong,
  workingUserMeInstagramHandle,
  onChangeWorkingUserMeInstagramHandle,
  workingUserMeSoundcloudHandle,
  onChangeWorkingUserMeSoundcloudHandle,

  onSaveWorkingUserBioDataToApi,

  onPickFavoriteArtist,
  onPickFavoriteSong,
  onPickRoughLocation,
}) => {
  const { matchingScreenParams } = route.params;

  const [userMe] = useContext(UserDataContext);

  const areAllRequiredBioFieldsFilledOut =
    workingUserMeIntro.length > 0 &&
    workingUserMeRoughLocation &&
    workingUserMeFavoriteRapper &&
    workingUserMeFavoriteSong;

  if (userMe.status !== 'COMPLETE') {
    return null;
  }

  return (
    <Fragment>
      <StatusBar style="light" />
      <SafeAreaView testID="battle-intro-complete-bio-wrapper">
        <UserProfile
          user={userMe.data}
          mode="EDIT_BIO"
          workingUserSavingToClerk={false}
          workingUserMeName=""
          onChangeWorkingUserMeName={() => {}}
          workingUserMeHandle=""
          onChangeWorkingUserMeHandle={() => {}}
          workingUserSavingImageToClerk={false}
          onChangeWorkingUserMeProfileImageUrl={() => {}}
          workingUserSavingBioDataToApi={workingUserSavingBioDataToApi}
          workingUserMeIntro={workingUserMeIntro}
          onChangeWorkingUserMeIntro={onChangeWorkingUserMeIntro}
          workingUserMeRoughLocation={workingUserMeRoughLocation}
          onChangeWorkingUserMeRoughLocation={onChangeWorkingUserMeRoughLocation}
          workingUserMeFavoriteRapper={workingUserMeFavoriteRapper}
          onChangeWorkingUserMeFavoriteRapper={onChangeWorkingUserMeFavoriteRapper}
          workingUserMeFavoriteSong={workingUserMeFavoriteSong}
          onChangeWorkingUserMeFavoriteSong={onChangeWorkingUserMeFavoriteSong}
          workingUserMeInstagramHandle={workingUserMeInstagramHandle}
          onChangeWorkingUserMeInstagramHandle={onChangeWorkingUserMeInstagramHandle}
          workingUserMeSoundcloudHandle={workingUserMeSoundcloudHandle}
          onChangeWorkingUserMeSoundcloudHandle={onChangeWorkingUserMeSoundcloudHandle}
          showRequiredToBattleFieldMarkers={true}
          onPickFavoriteArtist={onPickFavoriteArtist}
          onPickFavoriteSong={onPickFavoriteSong}
          onPickRoughLocation={onPickRoughLocation}
          onNavigateToBattlePlayer={() => {}}
          onNavigateToFollowingFollowersPage={() => {}}
        />

        <View style={{ position: 'absolute', bottom: 48, left: 16, right: 16 }}>
          <Button
            size={56}
            disabled={!areAllRequiredBioFieldsFilledOut || workingUserSavingBioDataToApi}
            testID="battle-intro-complete-bio-done-button"
            onPress={() => {
              onSaveWorkingUserBioDataToApi().then(() => {
                // Once the bio data is saved, move finally into the battle workflow proper!
                navigation.push('Battle > Profile Preview', { matchingScreenParams });
              });
            }}
          >
            {workingUserSavingBioDataToApi ? 'Loading...' : 'Done'}
          </Button>
        </View>
      </SafeAreaView>
    </Fragment>
  );
};

export default IntroCompleteBio;
