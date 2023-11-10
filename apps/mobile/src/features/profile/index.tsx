import * as React from 'react';
import { View, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { Fragment, useContext, useState, useCallback, useEffect } from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Close as IconClose } from '@barz/mobile/src/ui/icons';
import { Color } from '@barz/mobile/src/ui/tokens';

import { FixMe } from '@barz/mobile/src/lib/fixme';
import {
  User,
  BattleRecording,
  FavoriteArtist,
  FavoriteTrack,
  BarzAPI,
  RoughLocation,
} from '@barz/mobile/src/lib/api';
import HeaderBackButton from '@barz/mobile/src/ui/HeaderBackButton';
import HeaderButton from '@barz/mobile/src/ui/HeaderButton';
import { UserDataContext } from '@barz/mobile/src/user-data';

import Profile from './Profile';
import MeProfileSettings from './MeProfileSettings';
import MeProfileSettingsPhoneNumberSettings from './MeProfileSettingsPhoneNumberSettings';
import MeProfileSettingsChangePhoneNumber from './MeProfileSettingsAddChangePhoneNumber';
import ProfileBattleViewer from './ProfileBattleViewer';
import ProfileFollowingFollowers from './ProfileFollowingFollowers';
import MeProfileSettingsOAuthProviderSettings from './MeProfileSettingsOAuthProviderSettings';
import MeProfileFavoriteTrackPicker from './MeProfileFavoriteTrackPicker';
import MeProfileFavoriteArtistPicker from './MeProfileFavoriteArtistPicker';
import MeProfileRoughLocationPicker from './MeProfileRoughLocationPicker';

// The below logic implements a typescript-friendly way to expose the prop type data to each screen
// within the feature
// ref: https://stackoverflow.com/a/75142476/4115328
export type ProfileStackParamList = {
  'Profile > View': {
    userId: User['id'];
  };
  'Profile > Settings': undefined;
  'Profile > Settings > OAuth Provider Settings': {
    title: string;
    providerName: 'google' | 'facebook' | 'apple';
  };
  'Profile > Settings > Phone Number Settings': undefined;
  'Profile > Settings > Phone Number Settings > Add/Change Phone Number': undefined;
  'Profile > Favorite Artist Picker': undefined;
  'Profile > Favorite Track Picker': undefined;
  'Profile > Rough Location Picker': undefined;

  'Profile > Battle Viewer': {
    userId: User['id'];
    startingAtBattleId: BattleRecording['battleId'];
    battleRecordings: Array<BattleRecording>;
  };

  'Profile > Following Followers': {
    userId: User['id'];
    initialTab: 'FOLLOWING' | 'FOLLOWERS';
  };

  // FIXME: this route navigates to the developer mode feature
  'Developer Mode > Visible': undefined;
};

export type PageProps<T extends keyof ProfileStackParamList> = NativeStackScreenProps<
  ProfileStackParamList,
  T
>;

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// This hook is extracted out of `useCalculateProfileScreens` so that the battle intro process can
// show the bio edit screen with a duplicate version of all the same backing state as the regular
// profile view.
export const useCalculateProfileBioFormState = (
  setMode?: (mode: 'VIEW' | 'EDIT' | 'EDIT_BIO') => void,
) => {
  const [userMe, updateUserMe] = useContext(UserDataContext);
  const { getToken } = useAuth();

  const [workingUserSavingBioDataToApi, setWorkingUserSavingBioDataToApi] = useState(false);

  // These state values represent the fields within the bio edit page
  const [workingUserMeIntro, setWorkingUserMeIntro] = useState('');
  const userMeDataIntro = userMe.status === 'COMPLETE' ? userMe.data.intro : '';
  useEffect(() => {
    setWorkingUserMeIntro(userMeDataIntro);
  }, [userMeDataIntro]);

  const [workingUserMeRoughLocation, setWorkingUserMeRoughLocation] =
    useState<RoughLocation | null>(null);
  const userMeDataLocationName = userMe.status === 'COMPLETE' ? userMe.data.locationName : '';
  const userMeDataLocationLatitude =
    userMe.status === 'COMPLETE' ? userMe.data.locationLatitude : null;
  const userMeDataLocationLongitude =
    userMe.status === 'COMPLETE' ? userMe.data.locationLongitude : null;
  useEffect(() => {
    if (!userMeDataLocationName) {
      setWorkingUserMeRoughLocation(null);
      return;
    }
    if (
      typeof userMeDataLocationLongitude === 'undefined' ||
      typeof userMeDataLocationLatitude === 'undefined'
    ) {
      setWorkingUserMeRoughLocation({
        name: userMeDataLocationName,
        latitude: null,
        longitude: null,
      });
      return;
    }
    setWorkingUserMeRoughLocation({
      name: userMeDataLocationName,
      latitude: userMeDataLocationLatitude,
      longitude: userMeDataLocationLongitude,
    });
  }, [userMeDataLocationName, userMeDataLocationLatitude, userMeDataLocationLongitude]);

  const [workingUserMeFavoriteRapper, setWorkingUserMeFavoriteRapper] =
    useState<FavoriteArtist | null>(null);
  const userMeDataFavoriteRapperSpotifyId =
    userMe.status === 'COMPLETE' ? userMe.data.favoriteRapperSpotifyId : '';
  const userMeDataFavoriteRapperName =
    userMe.status === 'COMPLETE' ? userMe.data.favoriteRapperName : '';
  useEffect(() => {
    if (!userMeDataFavoriteRapperName) {
      setWorkingUserMeFavoriteRapper(null);
      return;
    }
    setWorkingUserMeFavoriteRapper({
      id: userMeDataFavoriteRapperSpotifyId,
      name: userMeDataFavoriteRapperName,
    });
  }, [userMeDataFavoriteRapperSpotifyId, userMeDataFavoriteRapperSpotifyId]);

  const [workingUserMeFavoriteSong, setWorkingUserMeFavoriteSong] = useState<FavoriteTrack | null>(
    null,
  );
  const userMeDataFavoriteSongSpotifyId =
    userMe.status === 'COMPLETE' ? userMe.data.favoriteSongSpotifyId : '';
  const userMeDataFavoriteSongName =
    userMe.status === 'COMPLETE' ? userMe.data.favoriteSongName : '';
  const userMeDataFavoriteSongArtistName =
    userMe.status === 'COMPLETE' ? userMe.data.favoriteSongArtistName : '';
  useEffect(() => {
    if (!userMeDataFavoriteSongName) {
      setWorkingUserMeFavoriteSong(null);
      return;
    }
    setWorkingUserMeFavoriteSong({
      id: userMeDataFavoriteSongSpotifyId,
      name: userMeDataFavoriteSongName,
      artistName: userMeDataFavoriteSongArtistName,
    });
  }, [
    userMeDataFavoriteSongSpotifyId,
    userMeDataFavoriteSongSpotifyId,
    userMeDataFavoriteSongArtistName,
  ]);

  const [workingUserMeInstagramHandle, setWorkingUserMeInstagramHandle] = useState('');
  const userMeDataInstagramHandle = userMe.status === 'COMPLETE' ? userMe.data.instagramHandle : '';
  useEffect(() => {
    setWorkingUserMeInstagramHandle(userMeDataInstagramHandle || '');
  }, [userMeDataInstagramHandle]);

  const [workingUserMeSoundcloudHandle, setWorkingUserMeSoundcloudHandle] = useState('');
  const userMeDataSoundcloudHandle =
    userMe.status === 'COMPLETE' ? userMe.data.soundcloudHandle : '';
  useEffect(() => {
    setWorkingUserMeSoundcloudHandle(userMeDataSoundcloudHandle || '');
  }, [userMeDataSoundcloudHandle]);

  // These bits of state are used to send data from the favorite rapper / favorite track pickers
  // back to the edit bio view.
  const [favoriteSongSearchText, setFavoriteSongSearchText] = useState('');
  const [[pickFavoriteSongResolve, pickFavoriteSongReject], setPickFavoriteSongResolveReject] =
    useState<[((value: FavoriteTrack | null) => void) | null, ((err: Error) => void) | null]>([
      null,
      null,
    ]);
  const [favoriteArtistSearchText, setFavoriteArtistSearchText] = useState('');
  const [
    [pickFavoriteArtistResolve, pickFavoriteArtistReject],
    setPickFavoriteArtistResolveReject,
  ] = useState<[((value: FavoriteArtist | null) => void) | null, ((err: Error) => void) | null]>([
    null,
    null,
  ]);
  const [roughLocationSearchText, setRoughLocationSearchText] = useState('');
  const [[pickRoughLocationResolve, pickRoughLocationReject], setPickRoughLocationResolveReject] =
    useState<[((value: RoughLocation | null) => void) | null, ((err: Error) => void) | null]>([
      null,
      null,
    ]);

  const onSaveWorkingUserBioDataToApi = useCallback(async () => {
    if (userMe.status !== 'COMPLETE') {
      return;
    }
    setWorkingUserSavingBioDataToApi(true);

    const updatedFields = {
      intro: workingUserMeIntro,
      locationName: workingUserMeRoughLocation?.name || null,
      locationLatitude: workingUserMeRoughLocation?.latitude || null,
      locationLongitude: workingUserMeRoughLocation?.longitude || null,
      favoriteRapperName: workingUserMeFavoriteRapper?.name || null,
      favoriteRapperSpotifyId: workingUserMeFavoriteRapper?.id || null,
      favoriteSongName: workingUserMeFavoriteSong?.name || null,
      favoriteSongSpotifyId: workingUserMeFavoriteSong?.id || null,
      favoriteSongArtistName: workingUserMeFavoriteSong?.artistName || null,
      instagramHandle:
        workingUserMeInstagramHandle.length > 0 ? workingUserMeInstagramHandle : null,
      soundcloudHandle:
        workingUserMeSoundcloudHandle.length > 0 ? workingUserMeSoundcloudHandle : null,
    };

    try {
      await BarzAPI.updateUserById(getToken, userMe.data.id, updatedFields);
    } catch (err: any) {
      console.error('Error updating user bio details:', err);
      showMessage({
        message: 'Error updating user bio details!',
        type: 'warning',
      });
      return;
    } finally {
      setWorkingUserSavingBioDataToApi(false);
    }

    if (setMode) {
      setMode('VIEW');
    }

    // Optimisitally update the user me data to take into account the data just sent to the server
    //
    // NOTE: since this data isn't going to clerk, there isn't a "lag" that this would fix, it just
    // keeps all the user me state in sync across the app
    updateUserMe((old) => {
      if (old.status !== 'COMPLETE') {
        return old;
      }

      return {
        ...old,
        data: {
          ...old.data,
          ...updatedFields,
        },
      };
    });
  }, [
    workingUserMeIntro,
    workingUserMeRoughLocation,
    workingUserMeFavoriteRapper,
    workingUserMeFavoriteSong,
    workingUserMeInstagramHandle,
    workingUserMeSoundcloudHandle,
  ]);

  return {
    workingUserSavingBioDataToApi,
    setWorkingUserSavingBioDataToApi,

    workingUserMeIntro,
    setWorkingUserMeIntro,
    workingUserMeRoughLocation,
    setWorkingUserMeRoughLocation,
    workingUserMeFavoriteRapper,
    setWorkingUserMeFavoriteRapper,
    workingUserMeFavoriteSong,
    setWorkingUserMeFavoriteSong,
    workingUserMeInstagramHandle,
    setWorkingUserMeInstagramHandle,
    workingUserMeSoundcloudHandle,
    setWorkingUserMeSoundcloudHandle,

    favoriteSongSearchText,
    setFavoriteSongSearchText,
    pickFavoriteSongResolve,
    pickFavoriteSongReject,
    setPickFavoriteSongResolveReject,

    favoriteArtistSearchText,
    setFavoriteArtistSearchText,
    pickFavoriteArtistResolve,
    pickFavoriteArtistReject,
    setPickFavoriteArtistResolveReject,

    roughLocationSearchText,
    setRoughLocationSearchText,
    pickRoughLocationResolve,
    pickRoughLocationReject,
    setPickRoughLocationResolveReject,

    onSaveWorkingUserBioDataToApi,
  };
};

// Generate the screens in this view out of band of the `ProfileFeature` component so that they
// can ALSO be injected into the home feature.
//
// NOTE: this cannot be a component, unfortunately, because <Stack.Navigator> only Stack.Screen,
// Stack.Group, or Fragment as direct decendants.
export const useCalculateProfileScreens = (): React.ReactNode => {
  const [userMe, updateUserMe] = useContext(UserDataContext);
  const { isLoaded, isSignedIn, user } = useUser();

  const [mode, setMode] = useState<'VIEW' | 'EDIT' | 'EDIT_BIO'>('VIEW');

  const [followingFollowersActiveTab, setFollowingFollowersActiveTab] = useState<
    'FOLLOWING' | 'FOLLOWERS'
  >('FOLLOWING');

  // ---------------------------------------------------------------------------
  // EDIT USER PROFILE HOOKS:
  // ---------------------------------------------------------------------------
  // These state values represent the fields within the profile edit page
  const [workingUserMeName, setWorkingUserMeName] = useState('');
  const [workingUserMeHandle, setWorkingUserMeHandle] = useState('');

  const userMeDataName = userMe.status === 'COMPLETE' ? userMe.data.name : null;
  useEffect(() => {
    setWorkingUserMeName(userMeDataName || '');
  }, [userMeDataName]);

  const userMeDataHandle = userMe.status === 'COMPLETE' ? userMe.data.handle : '';
  useEffect(() => {
    setWorkingUserMeHandle(userMeDataHandle || '');
  }, [userMeDataHandle]);

  const [workingUserSavingToClerk, setWorkingUserSavingToClerk] = useState(false);
  const [workingUserSavingImageToClerk, setWorkingUserSavingImageToClerk] = useState(false);
  const onSaveWorkingUserMeHandleAndRapperNameToClerk = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setWorkingUserSavingToClerk(true);

    // If the user changed their rapper name from the default, then set a flag on the user in clerk
    let rapperNameChangedFromDefault = true;
    if (!user.unsafeMetadata.rapperNameChangedFromDefault) {
      rapperNameChangedFromDefault = user.unsafeMetadata.rapperName !== workingUserMeName;
    }

    try {
      const result = await user.update({
        username: workingUserMeHandle,
        unsafeMetadata: {
          ...user.unsafeMetadata,
          rapperName: workingUserMeName,
          rapperNameChangedFromDefault,
        },
      });
      console.log('Set username result:', result);
    } catch (err: any) {
      showMessage({
        message: 'Error updating user details:',
        description: JSON.stringify(err, null, 2),
        type: 'warning',
      });
      return;
    } finally {
      setWorkingUserSavingToClerk(false);
    }

    setMode('VIEW');

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
          handle: workingUserMeHandle,
          name: workingUserMeName,
        },
      };
    });
  }, [workingUserMeName, workingUserMeHandle]);

  // ---------------------------------------------------------------------------
  // EDIT BIO HOOKS:
  // ---------------------------------------------------------------------------
  const {
    workingUserSavingBioDataToApi,
    setWorkingUserSavingBioDataToApi,

    workingUserMeIntro,
    setWorkingUserMeIntro,
    workingUserMeRoughLocation,
    setWorkingUserMeRoughLocation,
    workingUserMeFavoriteRapper,
    setWorkingUserMeFavoriteRapper,
    workingUserMeFavoriteSong,
    setWorkingUserMeFavoriteSong,
    workingUserMeInstagramHandle,
    setWorkingUserMeInstagramHandle,
    workingUserMeSoundcloudHandle,
    setWorkingUserMeSoundcloudHandle,

    favoriteSongSearchText,
    setFavoriteSongSearchText,
    pickFavoriteSongResolve,
    pickFavoriteSongReject,
    setPickFavoriteSongResolveReject,

    favoriteArtistSearchText,
    setFavoriteArtistSearchText,
    pickFavoriteArtistResolve,
    pickFavoriteArtistReject,
    setPickFavoriteArtistResolveReject,

    roughLocationSearchText,
    setRoughLocationSearchText,
    pickRoughLocationResolve,
    pickRoughLocationReject,
    setPickRoughLocationResolveReject,

    onSaveWorkingUserBioDataToApi,
  } = useCalculateProfileBioFormState(setMode);

  return (
    <Fragment>
      {/* The "Profile" screen will show a user's profile */}
      <Stack.Screen
        name="Profile > View"
        options={({ route }) => {
          // Show the back button if a specific user id was specified
          //
          // FIXME: this is kinda a hurestic and may not hold up over time, potentially
          // revisit this later?

          let headerLeft = () => (route?.params?.userId ? <HeaderBackButton /> : null);

          if (mode !== 'VIEW') {
            const cancelButton = (
              <HeaderButton
                onPress={() => setMode('VIEW')}
                testID="user-profile-cancel"
                leading={<IconClose color={Color.White} />}
                trailingSpace
              />
            );
            headerLeft = () => cancelButton;
          }

          let title: string;
          switch (mode) {
            case 'VIEW':
              title = '';
              break;
            case 'EDIT':
              title = 'Edit Profile';
              break;
            case 'EDIT_BIO':
              title = 'Edit Bio';
              break;
          }

          return {
            title,
            headerTransparent: mode === 'VIEW',
            headerRight: () => {
              switch (mode) {
                case 'EDIT':
                  return (
                    <HeaderButton
                      disabled={workingUserSavingToClerk || workingUserMeName.length === 0}
                      onPress={onSaveWorkingUserMeHandleAndRapperNameToClerk}
                      testID="user-profile-save"
                      leadingSpace
                    >
                      {workingUserSavingToClerk ? 'Saving...' : 'Save'}
                    </HeaderButton>
                  );
                case 'EDIT_BIO':
                  return (
                    <HeaderButton
                      disabled={mode !== 'EDIT_BIO' || workingUserSavingBioDataToApi}
                      onPress={onSaveWorkingUserBioDataToApi}
                      testID="profile-bio-edit-save"
                      leadingSpace
                    >
                      {workingUserSavingBioDataToApi ? 'Saving...' : 'Save'}
                    </HeaderButton>
                  );
                case 'VIEW':
                  return null;
              }
            },
            headerLeft,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            orientation: 'portrait',
          };
        }}
      >
        {(props) => (
          <Profile
            {...props}
            mode={mode}
            onEnterEditMode={() => setMode('EDIT')}
            onEnterBioEditMode={() => setMode('EDIT_BIO')}
            workingUserSavingToClerk={workingUserSavingToClerk}
            workingUserMeName={workingUserMeName}
            onChangeWorkingUserMeName={setWorkingUserMeName}
            workingUserMeHandle={workingUserMeHandle}
            onChangeWorkingUserMeHandle={setWorkingUserMeHandle}
            workingUserSavingImageToClerk={workingUserSavingImageToClerk}
            onChangeWorkingUserMeProfileImageUrl={async (uri) => {
              if (!isLoaded || !isSignedIn) {
                return;
              }
              if (userMe.status !== 'COMPLETE') {
                return;
              }

              setWorkingUserSavingImageToClerk(true);

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
                //
                // NOTE: if this request fails, it's possible that the `setProfileImage` below may not
                // run. This isn't a really big deal, since this flag being set means that the avatar
                // image won't be stored in the barz server database.
                await user.update({
                  unsafeMetadata: {
                    ...user.unsafeMetadata,
                    avatarImageUploaded: fileOrNull ? true : false,
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
                setWorkingUserSavingImageToClerk(false);
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
                    profileImageUrl: uri,
                  },
                };
              });
              setWorkingUserSavingImageToClerk(false);
            }}
            workingUserSavingBioDataToApi={workingUserSavingBioDataToApi}
            workingUserMeIntro={workingUserMeIntro}
            onChangeWorkingUserMeIntro={setWorkingUserMeIntro}
            workingUserMeRoughLocation={workingUserMeRoughLocation}
            onChangeWorkingUserMeRoughLocation={setWorkingUserMeRoughLocation}
            workingUserMeFavoriteRapper={workingUserMeFavoriteRapper}
            onChangeWorkingUserMeFavoriteRapper={setWorkingUserMeFavoriteRapper}
            workingUserMeFavoriteSong={workingUserMeFavoriteSong}
            onChangeWorkingUserMeFavoriteSong={setWorkingUserMeFavoriteSong}
            workingUserMeInstagramHandle={workingUserMeInstagramHandle}
            onChangeWorkingUserMeInstagramHandle={setWorkingUserMeInstagramHandle}
            workingUserMeSoundcloudHandle={workingUserMeSoundcloudHandle}
            onChangeWorkingUserMeSoundcloudHandle={setWorkingUserMeSoundcloudHandle}
            onNavigateToSettingsPage={() => {
              props.navigation.navigate('Profile > Settings');
            }}
            onNavigateToChallengePage={(userId) => {
              props.navigation.push('Battle > Matching', {
                type: 'CHALLENGE',
                resumeExisting: false,
                userToChallengeId: userId,
              });
            }}
            onNavigateToBattlePlayer={(battleId, battleRecordings, userId) => {
              props.navigation.push('Profile > Battle Viewer', {
                userId,
                startingAtBattleId: battleId,
                battleRecordings,
              });
            }}
            onNavigateToFollowingFollowersPage={(userId, initialTab) => {
              props.navigation.push('Profile > Following Followers', { userId, initialTab });
            }}
            onPickFavoriteSong={async () => {
              setFavoriteSongSearchText('');

              const promise = new Promise<FavoriteTrack | null>((resolve, reject) => {
                // Set the callbacks into state that the favorite track picker can access
                setPickFavoriteSongResolveReject([resolve, reject]);

                // Navigate to the favorite track picker
                props.navigation.push('Profile > Favorite Track Picker');
              });

              // After a success or failure, clear the callbacks
              promise
                .then(() => {
                  setPickFavoriteSongResolveReject([null, null]);
                })
                .catch(() => {
                  setPickFavoriteSongResolveReject([null, null]);
                });

              return promise;
            }}
            onPickFavoriteArtist={async () => {
              setFavoriteArtistSearchText('');

              const promise = new Promise<FavoriteArtist | null>((resolve, reject) => {
                // Set the callbacks into state that the favorite track picker can access
                setPickFavoriteArtistResolveReject([resolve, reject]);

                // Navigate to the favorite track picker
                props.navigation.push('Profile > Favorite Artist Picker');
              });

              // After a success or failure, clear the callbacks
              promise
                .then(() => {
                  setPickFavoriteArtistResolveReject([null, null]);
                })
                .catch(() => {
                  setPickFavoriteArtistResolveReject([null, null]);
                });

              return promise;
            }}
            onPickRoughLocation={async () => {
              setRoughLocationSearchText('');

              const promise = new Promise<RoughLocation | null>((resolve, reject) => {
                // Set the callbacks into state that the favorite track picker can access
                setPickRoughLocationResolveReject([resolve, reject]);

                // Navigate to the favorite track picker
                props.navigation.push('Profile > Rough Location Picker');
              });

              // After a success or failure, clear the callbacks
              promise
                .then(() => {
                  setPickRoughLocationResolveReject([null, null]);
                })
                .catch(() => {
                  setPickRoughLocationResolveReject([null, null]);
                });

              return promise;
            }}
          />
        )}
      </Stack.Screen>

      {/* The "Battle Viewer" screen will let a user view a battle that they have selected */}
      <Stack.Screen
        name="Profile > Battle Viewer"
        options={{
          headerShown: false,
          orientation: 'portrait',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={ProfileBattleViewer}
      />

      {/* The "Following Followers" screen will let a user view all the other users who follow them and who they follow*/}
      <Stack.Screen
        name="Profile > Following Followers"
        options={{
          title: followingFollowersActiveTab === 'FOLLOWING' ? 'Following' : 'Followers',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {(props) => (
          <ProfileFollowingFollowers
            {...props}
            activeTab={followingFollowersActiveTab}
            onChangeActiveTab={setFollowingFollowersActiveTab}
          />
        )}
      </Stack.Screen>

      {/* The "Settings" screen will show more in depth settings about a user */}
      <Stack.Screen
        name="Profile > Settings"
        options={{
          title: 'Settings',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={MeProfileSettings}
      />

      {/* The "OAuth Provider Settings" screen will show details that allow one to configure how */}
      {/* an oauth provider is set up, and disable it */}
      <Stack.Screen
        name="Profile > Settings > OAuth Provider Settings"
        options={({ route }) => ({
          title: `${route.params?.title} Settings`,
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
        component={MeProfileSettingsOAuthProviderSettings}
      />

      {/* The "Phone Number Settings" screen allows a user to view their phone number and either change or remove it */}
      <Stack.Screen
        name="Profile > Settings > Phone Number Settings"
        options={{
          title: 'Phone Number Settings',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={MeProfileSettingsPhoneNumberSettings}
      />

      {/* The "Change Phone Number" screen allows a user to start to enter a new phone number */}
      <Stack.Screen
        name="Profile > Settings > Phone Number Settings > Add/Change Phone Number"
        options={{
          title: '',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={MeProfileSettingsChangePhoneNumber}
      />

      {/* The "Favorite Track Picker" screen allows a user to select a new favorite track on their bio */}
      <Stack.Screen
        name="Profile > Favorite Track Picker"
        options={({ navigation }) => ({
          title: 'Favorite Song',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerRight: () => (
            <HeaderButton
              onPress={() => {
                setWorkingUserMeFavoriteSong(
                  favoriteSongSearchText.length > 0
                    ? {
                        name: favoriteSongSearchText,
                        artistName: null,
                        id: null,
                      }
                    : null,
                );
                navigation.goBack();
              }}
              testID={
                favoriteSongSearchText.length > 0
                  ? 'user-bio-edit-favorite-track-picker-done'
                  : 'user-bio-edit-favorite-track-picker-clear'
              }
              leadingSpace
            >
              {favoriteSongSearchText.length > 0 ? 'Done' : 'Clear'}
            </HeaderButton>
          ),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        {(props) => (
          <MeProfileFavoriteTrackPicker
            {...props}
            onResolve={pickFavoriteSongResolve}
            onReject={pickFavoriteSongReject}
            searchText={favoriteSongSearchText}
            onChangeSearchText={setFavoriteSongSearchText}
          />
        )}
      </Stack.Screen>

      {/* The "Favorite Artist Picker" screen allows a user to select a new favorite artist on their bio */}
      <Stack.Screen
        name="Profile > Favorite Artist Picker"
        options={({ navigation }) => ({
          title: 'Favorite Rapper',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerRight: () => (
            <HeaderButton
              onPress={() => {
                setWorkingUserMeFavoriteRapper(
                  favoriteArtistSearchText.length > 0
                    ? {
                        name: favoriteArtistSearchText,
                        id: null,
                      }
                    : null,
                );
                navigation.goBack();
              }}
              testID={
                favoriteArtistSearchText.length > 0
                  ? 'user-bio-edit-favorite-artist-picker-done'
                  : 'user-bio-edit-favorite-artist-picker-clear'
              }
              leadingSpace
            >
              {favoriteArtistSearchText.length > 0 ? 'Done' : 'Clear'}
            </HeaderButton>
          ),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        {(props) => (
          <MeProfileFavoriteArtistPicker
            {...props}
            onResolve={pickFavoriteArtistResolve}
            onReject={pickFavoriteArtistReject}
            searchText={favoriteArtistSearchText}
            onChangeSearchText={setFavoriteArtistSearchText}
          />
        )}
      </Stack.Screen>

      {/* The "Rough Location Picker" screen allows a user to select a new rough location on their bio */}
      <Stack.Screen
        name="Profile > Rough Location Picker"
        options={({ navigation }) => ({
          title: 'Location',
          orientation: 'portrait',
          headerLeft: () => <HeaderBackButton />,
          headerRight: () => (
            <HeaderButton
              onPress={() => {
                setWorkingUserMeRoughLocation(
                  roughLocationSearchText.length > 0
                    ? {
                        name: roughLocationSearchText,
                        latitude: null,
                        longitude: null,
                      }
                    : null,
                );
                navigation.goBack();
              }}
              testID={
                roughLocationSearchText.length > 0
                  ? 'user-bio-edit-rough-location-picker-done'
                  : 'user-bio-edit-rough-location-picker-clear'
              }
              leadingSpace
            >
              {roughLocationSearchText.length > 0 ? 'Done' : 'Clear'}
            </HeaderButton>
          ),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        {(props) => (
          <MeProfileRoughLocationPicker
            {...props}
            onResolve={pickRoughLocationResolve}
            onReject={pickRoughLocationReject}
            searchText={roughLocationSearchText}
            onChangeSearchText={setRoughLocationSearchText}
          />
        )}
      </Stack.Screen>
    </Fragment>
  );
};

const ProfileFeature: React.FunctionComponent = () => {
  const profileScreensJsx = useCalculateProfileScreens();
  return <Stack.Navigator>{profileScreensJsx}</Stack.Navigator>;
};

export default ProfileFeature;
