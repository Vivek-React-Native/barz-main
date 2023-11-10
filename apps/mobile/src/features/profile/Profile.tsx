import * as React from 'react';
import { useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { Text, SafeAreaView, View, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PusherContext } from '@barz/mobile/src/pusher';
import {
  BarzAPI,
  User,
  UserMe,
  BattleRecording,
  UserInContextOfUserMe,
  FavoriteArtist,
  FavoriteTrack,
  RoughLocation,
} from '@barz/mobile/src/lib/api';
import { UserDataContext } from '@barz/mobile/src/user-data';
import UserProfile from '@barz/mobile/src/components/UserProfile';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import Button from '@barz/mobile/src/ui/Button';

import { PageProps } from '.';

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    height: '100%',
    marginLeft: 16,
    marginRight: 16,
  },
});

// This component renders the user profile page, which shows information about the user specified by
// the `userId` route param.
const Profile: React.FunctionComponent<
  PageProps<'Profile > View'> & {
    mode: 'VIEW' | 'EDIT' | 'EDIT_BIO';
    onEnterEditMode: () => void;
    onEnterBioEditMode: () => void;

    workingUserSavingToClerk: boolean;
    workingUserMeName: User['name'];
    onChangeWorkingUserMeName: (newName: string) => void;
    workingUserMeHandle: User['handle'];
    onChangeWorkingUserMeHandle: (newHandle: string) => void;
    workingUserSavingImageToClerk: boolean;
    onChangeWorkingUserMeProfileImageUrl: (newImageUrl: User['profileImageUrl']) => void;

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

    onNavigateToSettingsPage: () => void;
    onNavigateToChallengePage: (userId: User['id']) => void;
    onNavigateToBattlePlayer: (
      battleId: BattleRecording['battleId'],
      battleRecordings: Array<BattleRecording>,
      userId: User['id'],
    ) => void;
    onNavigateToFollowingFollowersPage: (
      userId: User['id'],
      initialView: 'FOLLOWING' | 'FOLLOWERS',
    ) => void;
    onPickFavoriteSong: () => Promise<FavoriteTrack | null>;
    onPickFavoriteArtist: () => Promise<FavoriteArtist | null>;
    onPickRoughLocation: () => Promise<RoughLocation | null>;
  }
> = ({
  route,
  mode,
  onEnterEditMode,
  onEnterBioEditMode,

  workingUserSavingToClerk,
  workingUserMeName,
  onChangeWorkingUserMeName,
  workingUserMeHandle,
  onChangeWorkingUserMeHandle,
  workingUserSavingImageToClerk,
  onChangeWorkingUserMeProfileImageUrl,

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

  onNavigateToSettingsPage,
  onNavigateToChallengePage,
  onNavigateToBattlePlayer,
  onNavigateToFollowingFollowersPage,
  onPickFavoriteArtist,
  onPickRoughLocation,
  onPickFavoriteSong,
}) => {
  const { getToken, signOut } = useAuth();

  const [userMe] = useContext(UserDataContext);
  const userMeDataId = userMe.status === 'COMPLETE' ? userMe.data.id : null;

  const [userData, setUserData] = useState<
    | { status: 'IDLE' }
    | { status: 'LOADING' }
    | { status: 'COMPLETE'; isOwnProfile: false; user: UserInContextOfUserMe }
    | { status: 'COMPLETE'; isOwnProfile: true; user: UserMe }
    | { status: 'ERROR'; error: Error }
  >({ status: 'IDLE' });

  // NOTE: when the user presses the "profile" tab bar icon, route.params will be undefined.
  const profileUserId: User['id'] | null = route?.params?.userId || null;

  // This value indicates whether the given profile that is being looked at is the user's own
  // profile. This either happens when:
  // - The user id being looked at matches the `userMe` user id
  // - The user id is unset - this is what happens when the user taps the "profile" icon on the tab
  //   bar
  const isOwnProfile = useMemo(() => {
    if (!profileUserId) {
      return true;
    }

    return userMeDataId === profileUserId;
  }, [profileUserId, userMeDataId]);

  // When the page loads, fetch the user information from the server
  // NOTE: This useEffect refers to userMe.data, but it should only run when the userMe.data.id
  // value changes. If userMe.data changes, the useEffect after this handles that.
  useEffect(() => {
    let unmounted = false;

    let userMeData: UserMe | null = null;
    if (userMe.status === 'COMPLETE' && isOwnProfile) {
      userMeData = userMe.data;
    }

    // If the user is loading their own profile, then avoid fetching the user data again, since it
    // is already in memory
    let userPromise: Promise<User> | null = null;
    let userId: User['id'] | null = null;
    if (userMeData) {
      userPromise = Promise.resolve(userMeData);
      userId = userMeData.id;
    } else if (profileUserId) {
      userPromise = BarzAPI.getUser(getToken, profileUserId);
      userId = profileUserId;
    }

    if (!userPromise || !userId) {
      setUserData({ status: 'IDLE' });
      return;
    }

    if (userData.status !== 'COMPLETE') {
      setUserData({ status: 'LOADING' });
    }
    BarzAPI.getUser(getToken, userId)
      .then((user) => {
        if (unmounted) {
          return;
        }

        if (userMeData) {
          setUserData({
            status: 'COMPLETE',
            isOwnProfile: true,
            user: { ...userMeData, ...user },
          });
        } else {
          setUserData({
            status: 'COMPLETE',
            isOwnProfile: false,
            user,
          });
        }
      })
      .catch((error) => {
        setUserData({ status: 'ERROR', error });
      });
  }, [isOwnProfile, getToken, userMe.status, userMeDataId, profileUserId]);

  // If the user me data changes after the initial data is loaded, propogate those changes into this view
  // This ensures that changes from userMe.data are syned into the local `userData` state value.
  useEffect(() => {
    if (userMe.status !== 'COMPLETE') {
      return;
    }
    if (!isOwnProfile) {
      return;
    }

    setUserData((old) => {
      if (old.status === 'COMPLETE' && old.isOwnProfile) {
        return { ...old, user: { ...old.user, ...userMe.data } };
      } else {
        return old;
      }
    });
  }, [isOwnProfile, userMe]);

  // Once the user data is loaded, listen for changes pushed via pusher
  const pusher = useContext(PusherContext);
  const userDataId = userData.status === 'COMPLETE' ? userData.user.id : null;
  useEffect(() => {
    if (userMe.status !== 'COMPLETE') {
      return;
    }
    if (isOwnProfile) {
      // Don't subscribe to user updates if looking at ourselves.
      //
      // This is because the global `UserDataContext` listens for updates already, and will
      // listen via pusher automatically within that context. So doing it here again would be duplicative.
      return;
    }
    if (!pusher) {
      return;
    }
    if (!userDataId) {
      return;
    }

    // Listen for updates to raw user fields, and keep the local user data up to date
    let userSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userDataId}`,
        onEvent: (event: PusherEvent) => {
          const payload: User = JSON.parse(event.data);
          switch (event.eventName) {
            case 'user.update':
              console.log('EVENT:', payload);
              setUserData((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                if (old.isOwnProfile) {
                  return {
                    ...old,
                    user: { ...old.user, ...payload },
                  };
                } else {
                  return {
                    ...old,
                    user: { ...old.user, ...payload },
                  };
                }
              });
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        userSubscription = channel;
      });

    return () => {
      if (userSubscription) {
        userSubscription.unsubscribe();
      }
    };
  }, [isOwnProfile, userDataId, profileUserId]);

  // When the given user is followed or follows somebody else, keep the state of the "follow" /
  // "unfollow" button up to date.
  //
  // NOTE: this is not listened for in the global UserDataContext, since it's impossible for a user
  // to follow or unfollow themselves
  // NOTE: this is ALSO not listened to in this component for a user's own profile for the same
  // reason
  useEffect(() => {
    if (userMe.status !== 'COMPLETE') {
      return;
    }
    if (!pusher) {
      return;
    }
    if (isOwnProfile) {
      // A user cannot follow or unfollow themselves
      return;
    }
    if (!userDataId) {
      return;
    }

    let userFollowsSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userDataId}-follows`,
        onEvent: (event: PusherEvent) => {
          const payload: {
            userId: User['id'];
            followsUserId: User['id'];
          } = JSON.parse(event.data);

          switch (event.eventName) {
            case 'userFollow.create':
              if (payload.followsUserId === userMe.data.id) {
                return;
              }

              setUserData((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                if (old.isOwnProfile) {
                  return {
                    ...old,
                    user: {
                      ...old.user,
                      computedIsBeingFollowedByUserMe: true,
                    },
                  };
                } else {
                  return {
                    ...old,
                    user: {
                      ...old.user,
                      computedIsBeingFollowedByUserMe: true,
                    },
                  };
                }
              });
              break;

            case 'userFollow.delete':
              if (payload.followsUserId === userMe.data.id) {
                return;
              }

              setUserData((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                if (old.isOwnProfile) {
                  return {
                    ...old,
                    user: {
                      ...old.user,
                      computedIsBeingFollowedByUserMe: false,
                    },
                  };
                } else {
                  return {
                    ...old,
                    user: {
                      ...old.user,
                      computedIsBeingFollowedByUserMe: false,
                    },
                  };
                }
              });
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        userFollowsSubscription = channel;
      });

    return () => {
      if (userFollowsSubscription) {
        userFollowsSubscription.unsubscribe();
      }
    };
  }, [isOwnProfile, userDataId, profileUserId]);

  const [followUnFollowLoading, setFollowUnfollowLoading] = useState(false);
  const onFollow = useCallback(async () => {
    if (userData.status !== 'COMPLETE') {
      return;
    }

    setFollowUnfollowLoading(true);

    try {
      await BarzAPI.followUser(getToken, userData.user.id);
    } catch (err) {
      console.error(`Error following user ${userData.user.id}: ${err}`);
      showMessage({
        message: 'Error following user!',
        type: 'warning',
      });
      return;
    } finally {
      setFollowUnfollowLoading(false);
    }

    setUserData({
      status: 'COMPLETE',
      // NOTE: this `false` is fine to be hardcoded here because following / unfollowing can
      // only happen if the user to follow isn't themselves
      isOwnProfile: false,
      user: {
        ...userData.user,
        // NOTE: this is an optimistic update, the server value will be overwritten on top of
        // this once the `userFollow.create` pusher event is received
        computedIsBeingFollowedByUserMe: true,

        // NOTE: this is an optimistic update, the server value will be overwritten on top of
        // this once the `user.update` pusher event is received
        computedFollowersCount: userData.user.computedFollowersCount + 1,
      },
    });
  }, [userData, getToken]);
  const onUnFollow = useCallback(async () => {
    if (userData.status !== 'COMPLETE') {
      return;
    }

    setFollowUnfollowLoading(true);

    try {
      await BarzAPI.unfollowUser(getToken, userData.user.id);
    } catch (err) {
      console.error(`Error unfollowing user ${userData.user.id}: ${err}`);
      showMessage({
        message: 'Error unfollowing user!',
        type: 'warning',
      });
      return;
    } finally {
      setFollowUnfollowLoading(false);
    }

    setUserData({
      status: 'COMPLETE',
      // NOTE: this `false` is fine to be hardcoded here because following / unfollowing can
      // only happen if the user to follow isn't themselves
      isOwnProfile: false,
      user: {
        ...userData.user,
        // NOTE: this is an optimistic update, the server value will be overwritten on top of
        // this once the `userFollow.delete` pusher event is received
        computedIsBeingFollowedByUserMe: false,

        // NOTE: this is an optimistic update, the server value will be overwritten on top of
        // this once the `user.update` pusher event is received
        computedFollowersCount: userData.user.computedFollowersCount - 1,
      },
    });
  }, [userData, getToken]);

  switch (userData.status) {
    case 'IDLE':
    case 'LOADING':
      return (
        <SafeAreaView style={{ height: '100%' }}>
          <View style={styles.wrapper}>
            <Text style={{ ...Typography.Body1, color: Color.White }}>Loading</Text>
          </View>
        </SafeAreaView>
      );

    case 'ERROR':
      return (
        <SafeAreaView style={{ height: '100%' }}>
          <View style={styles.wrapper}>
            <Text style={{ ...Typography.Body1, color: Color.White }}>Error loading profile!</Text>
            <Button onPress={() => signOut()}>Sign out</Button>
          </View>
        </SafeAreaView>
      );

    case 'COMPLETE':
      if (userData.isOwnProfile) {
        // When a user is looking at their own profile, then make sure the entire `UserMe` object
        // gets passed, along with all the props that allow the profile to be edited.
        return (
          <SafeAreaView>
            {/*
            Show a gradient so that the UserProfile doesn't look like it's intersecting with
            the status bar as a user scrolls
            */}
            <LinearGradient
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: 48,
                zIndex: 2,
              }}
              colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.001)']}
              locations={[0.4, 1]}
            />
            <UserProfile
              user={userData.user}
              mode={mode}
              onEnterEditMode={onEnterEditMode}
              onEnterBioEditMode={onEnterBioEditMode}
              workingUserSavingToClerk={workingUserSavingToClerk}
              workingUserMeName={workingUserMeName}
              onChangeWorkingUserMeName={onChangeWorkingUserMeName}
              workingUserMeHandle={workingUserMeHandle}
              onChangeWorkingUserMeHandle={onChangeWorkingUserMeHandle}
              workingUserSavingImageToClerk={workingUserSavingImageToClerk}
              onChangeWorkingUserMeProfileImageUrl={onChangeWorkingUserMeProfileImageUrl}
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
              onNavigateToSettingsPage={onNavigateToSettingsPage}
              onNavigateToBattlePlayer={onNavigateToBattlePlayer}
              onNavigateToFollowingFollowersPage={onNavigateToFollowingFollowersPage}
              onNavigateToChallengePage={onNavigateToChallengePage}
              onPickFavoriteSong={onPickFavoriteSong}
              onPickFavoriteArtist={onPickFavoriteArtist}
              onPickRoughLocation={onPickRoughLocation}
            />
          </SafeAreaView>
        );
      } else {
        return (
          <SafeAreaView>
            <UserProfile
              user={userData.user}
              onUnFollow={onUnFollow}
              onFollow={onFollow}
              followUnFollowLoading={followUnFollowLoading}
              onNavigateToBattlePlayer={onNavigateToBattlePlayer}
              onNavigateToFollowingFollowersPage={onNavigateToFollowingFollowersPage}
              onNavigateToChallengePage={onNavigateToChallengePage}
            />
          </SafeAreaView>
        );
      }
  }
};

export default Profile;
