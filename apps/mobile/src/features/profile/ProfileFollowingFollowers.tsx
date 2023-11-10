import * as React from 'react';
import { useState, useEffect, useRef, useContext, useCallback, Fragment } from 'react';
import { View, SafeAreaView, Text, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@clerk/clerk-expo';
import Button from '@barz/mobile/src/ui/Button';
import ListItem from '@barz/mobile/src/ui/ListItem';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PusherContext } from '@barz/mobile/src/pusher';
import { BarzAPI, User, UserInContextOfUserMe } from '@barz/mobile/src/lib/api';
import {
  InfiniteScrollListState,
  fetchInitialPage,
  fetchNextPage,
} from '@barz/mobile/src/lib/infinite-scroll-list';
import { UserDataContext } from '@barz/mobile/src/user-data';
// import { FixMe } from '@barz/mobile/src/lib/fixme';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import InfiniteScrollFlatList from '@barz/mobile/src/components/InfiniteScrollFlatList';
import { SegmentedControl, SegmentedControlOption } from '@barz/mobile/src/ui/SegmentedControl';
import { ListItemDivider } from '@barz/mobile/src/ui/ListItemContainer';

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Color.Gray.Dark1,
  },
  safeWrapper: StyleSheet.absoluteFillObject,
  innerWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    gap: 16,
  },
  scrollWrapper: {
    height: '100%',
    width: '100%',
  },
  textWrapper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    height: '100%',
  },
});

const ProfileFollowingFollowersUserItem: React.FunctionComponent<{
  user: UserInContextOfUserMe;
  testID?: string;
  isUserMe: boolean;
  followUnFollowLoading: boolean;
  onPress: () => void;
  onFollow: () => void;
  onUnFollow: () => void;
}> = ({ user, testID, isUserMe, followUnFollowLoading, onPress, onFollow, onUnFollow }) => {
  let actionButton: React.ReactNode | null = null;
  if (!isUserMe) {
    actionButton = user.computedIsBeingFollowedByUserMe ? (
      <Button
        size={32}
        type="secondary"
        disabled={followUnFollowLoading}
        onPress={onUnFollow}
        testID={`${testID}-user-item-${user.id}-unfollow`}
      >
        Following
      </Button>
    ) : (
      <Button
        size={32}
        type="outlineAccent"
        disabled={followUnFollowLoading}
        onPress={onFollow}
        testID={`${testID}-user-item-${user.id}-follow`}
      >
        Follow
      </Button>
    );
  }

  return (
    <ListItem
      testID={`${testID}-user-item-${user.id}`}
      onPress={onPress}
      leading={() => (
        <View style={{ paddingRight: 16 }}>
          <AvatarImage profileImageUrl={user.profileImageUrl} />
        </View>
      )}
      trailing={() => actionButton}
      description={`@${user.handle}`}
    >
      {user.name || ''}
    </ListItem>
  );
};

const ProfileFollowingFollowers: React.FunctionComponent<
  PageProps<'Profile > Following Followers'> & {
    activeTab: 'FOLLOWERS' | 'FOLLOWING';
    onChangeActiveTab: (newTab: 'FOLLOWERS' | 'FOLLOWING') => void;
  }
> = ({ navigation, route, activeTab, onChangeActiveTab }) => {
  const { userId, initialTab } = route.params;

  const { getToken } = useAuth();
  const [userMe] = useContext(UserDataContext);

  // Store the active tab state to control which list is currently visible
  useFocusEffect(useCallback(() => onChangeActiveTab(initialTab), [initialTab]));

  // When the component mounts, fetch a list of following / followed users
  //
  // NOTE: these lists are BOTH fetched when one visits the page so that it's faster for a user if
  // they switch the tab - the second list is already loaded!
  const [followers, setFollowers] = useState<InfiniteScrollListState<UserInContextOfUserMe>>({
    status: 'IDLE',
  });
  const followersUserIdSetRef = useRef<Set<User['id']>>(new Set());
  useEffect(() => {
    fetchInitialPage(setFollowers, async (page) => {
      const response = await BarzAPI.getFollowers(getToken, userId, page);

      // Store a list of all user ids in the list in a ref, so that if a new user is pushed via the
      // pusher socket, it shows up in the list
      for (const user of response.results) {
        followersUserIdSetRef.current.add(user.id);
      }

      return response;
    });
  }, [setFollowers, userId, getToken]);
  const onFetchNextFollowersPage = useCallback(async () => {
    return fetchNextPage(
      followers,
      setFollowers,
      async (page) => {
        const response = await BarzAPI.getFollowers(getToken, userId, page);

        // Store a list of all user ids in the list in a ref, so that if a new user is pushed via the
        // pusher socket, it shows up in the list
        for (const user of response.results) {
          followersUserIdSetRef.current.add(user.id);
        }

        return response;
      },
      (error, page) => {
        console.log(`Error fetching followers page ${page} for user ${userId}: ${error}`);
        showMessage({
          message: 'Error fetching more followers!',
          type: 'warning',
        });
      },
    );
  }, [followers, setFollowers, userId, getToken]);

  const [following, setFollowing] = useState<InfiniteScrollListState<UserInContextOfUserMe>>({
    status: 'IDLE',
  });
  const followingUserIdSetRef = useRef<Set<User['id']>>(new Set());
  useEffect(() => {
    fetchInitialPage(setFollowing, async (page) => {
      const response = await BarzAPI.getFollowing(getToken, userId, page);

      // Store a list of all user ids in the list in a ref, so that if a new user is pushed via the
      // pusher socket, it shows up in the list
      for (const user of response.results) {
        followingUserIdSetRef.current.add(user.id);
      }

      return response;
    });
  }, [setFollowing, userId, getToken]);
  const onFetchNextFollowingPage = useCallback(async () => {
    return fetchNextPage(
      following,
      setFollowing,
      async (page) => {
        const response = await BarzAPI.getFollowing(getToken, userId, page);

        // Store a list of all user ids in the list in a ref, so that if a new user is pushed via the
        // pusher socket, it shows up in the list
        for (const user of response.results) {
          followingUserIdSetRef.current.add(user.id);
        }

        return response;
      },
      (error, page) => {
        console.log(`Error fetching following page ${page} for user ${userId}: ${error}`);
        showMessage({
          message: 'Error fetching more following!',
          type: 'warning',
        });
      },
    );
  }, [following, setFollowing, userId, getToken]);

  // Once the user data is loaded, listen for changes pushed via pusher
  const pusher = useContext(PusherContext);
  const userMeDataId = userMe.status === 'COMPLETE' ? userMe.data.id : null;
  useEffect(() => {
    if (!userMeDataId) {
      return;
    }
    if (!pusher) {
      return;
    }

    // When the "user me" is followed or follows somebody else, keep the state of the "follow" /
    // "unfollow" buttons up to date.
    let userFollowsSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userMeDataId}-follows`,
        onEvent: async (event: PusherEvent) => {
          const payload: {
            userId: UserInContextOfUserMe['id'];
            followsUserId: UserInContextOfUserMe['id'];
          } = JSON.parse(event.data);

          switch (event.eventName) {
            case 'userFollow.create': {
              // Fetch the user data from the server, if it is needed
              let newFollowingUserData: UserInContextOfUserMe | null = null;
              if (!followingUserIdSetRef.current.has(payload.followsUserId)) {
                try {
                  newFollowingUserData = await BarzAPI.getUser(getToken, payload.followsUserId);
                } catch (err) {
                  console.error(`Error fetching user ${payload.followsUserId}: ${err}`);
                  showMessage({
                    message: `Error fetching user ${payload.followsUserId}`,
                    type: 'warning',
                  });
                  return;
                }
                followingUserIdSetRef.current.add(newFollowingUserData.id);
              }
              setFollowing((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                // If the user was newly pushed, add it to the list
                if (
                  newFollowingUserData &&
                  !old.data.find((user) => user.id === newFollowingUserData?.id)
                ) {
                  if (newFollowingUserData.id === userMeDataId) {
                    // Don't add the "user me" user to the following list
                    return old;
                  }
                  return {
                    ...old,
                    data: [...old.data, newFollowingUserData],
                  };
                }

                // Otherwise update an existing user
                return {
                  ...old,
                  data: old.data.map((user) => {
                    if (user.id === payload.followsUserId) {
                      return {
                        ...user,
                        computedIsBeingFollowedByUserMe: true,
                      };
                    } else {
                      return user;
                    }
                  }),
                };
              });

              // Fetch the user data from the server, if it is needed
              let newFollowersUserData: UserInContextOfUserMe | null = null;
              if (!followersUserIdSetRef.current.has(payload.followsUserId)) {
                try {
                  newFollowersUserData = await BarzAPI.getUser(getToken, payload.userId);
                } catch (err) {
                  console.error(`Error fetching user ${payload.userId}: ${err}`);
                  showMessage({
                    message: `Error fetching user ${payload.userId}`,
                    type: 'warning',
                  });
                  return;
                }
                followersUserIdSetRef.current.add(newFollowersUserData.id);
              }
              setFollowers((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                // If the user was newly pushed, add it to the list
                if (
                  newFollowersUserData &&
                  !old.data.find((user) => user.id === newFollowersUserData?.id)
                ) {
                  return {
                    ...old,
                    data: [...old.data, newFollowersUserData],
                  };
                }

                // Otherwise update an existing user
                return {
                  ...old,
                  data: old.data.map((user) => {
                    if (user.id === payload.followsUserId) {
                      return {
                        ...user,
                        computedIsBeingFollowedByUserMe: true,
                      };
                    } else {
                      return user;
                    }
                  }),
                };
              });
              break;
            }

            case 'userFollow.delete': {
              setFollowing((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                // If the userMe user is being unfollowed, then remove them from the list
                // This user is special because it does not have a follow/unfollow button
                if (payload.followsUserId === userMeDataId) {
                  followingUserIdSetRef.current.delete(payload.followsUserId);
                  return {
                    ...old,
                    data: old.data.filter((user) => user.id !== payload.followsUserId),
                  };
                }

                return {
                  ...old,
                  // NOTE: instead of removing the user from the list, just mark the user as no
                  // longer being followed. This matches the behavior of other social media apps
                  // and means that if you want to re-follow the user, you can do that by pressing
                  // the button immediately.
                  //
                  // But if this decision needs to be reverted in the future, then this is where
                  // the user would be removed from the list instead of updating it.
                  data: old.data.map((user) => {
                    if (user.id === payload.followsUserId) {
                      return {
                        ...user,
                        computedIsBeingFollowedByUserMe: false,
                      };
                    } else {
                      return user;
                    }
                  }),
                };
              });
              setFollowers((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }

                // If the userMe user is being unfollowed, then remove them from the list
                // This user is special because it does not have a follow/unfollow button
                if (payload.followsUserId === userMeDataId) {
                  followersUserIdSetRef.current.delete(payload.followsUserId);
                  return {
                    ...old,
                    data: old.data
                      .filter((user) => user.id !== payload.followsUserId)
                      .filter((user) => user.id !== payload.userId),
                  };
                }

                return {
                  ...old,
                  // NOTE: instead of removing the user from the list, just mark the user as no
                  // longer being followed. This matches the behavior of other social media apps
                  // and means that if you want to re-follow the user, you can do that by pressing
                  // the button immediately.
                  //
                  // But if this decision needs to be reverted in the future, then this is where
                  // the user would be removed from the list instead of updating it.
                  data: old.data
                    .map((user) => {
                      if (user.id === payload.followsUserId) {
                        return {
                          ...user,
                          computedIsBeingFollowedByUserMe: false,
                        };
                      } else {
                        return user;
                      }
                    })
                    .filter((user) => user.id !== payload.userId),
                };
              });
              break;
            }
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
  }, [userMeDataId]);

  const [followUnFollowLoadingUserIds, setFollowUnfollowLoadingUserIds] = useState<
    Set<UserInContextOfUserMe['id']>
  >(new Set());

  const onFollow = useCallback(
    async (userIdToFollow: UserInContextOfUserMe['id']) => {
      setFollowUnfollowLoadingUserIds((oldSet) => {
        const newSet = new Set(oldSet);
        newSet.add(userIdToFollow);
        return newSet;
      });

      try {
        await BarzAPI.followUser(getToken, userIdToFollow);
      } catch (err) {
        console.error(`Error following user ${userIdToFollow}: ${err}`);
        showMessage({
          message: 'Error following user!',
          type: 'warning',
        });
        return;
      } finally {
        setFollowUnfollowLoadingUserIds((oldSet) => {
          const newSet = new Set(oldSet);
          newSet.delete(userIdToFollow);
          return newSet;
        });
      }

      setFollowing((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: old.data.map((user) => {
            if (user.id === userIdToFollow) {
              return {
                ...user,

                // NOTE: this is an optimistic update, the server value will be overwritten on top of
                // this once the `userFollow.create` pusher event is received
                computedIsBeingFollowedByUserMe: true,
              };
            } else {
              return user;
            }
          }),
        };
      });
      setFollowers((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: old.data.map((user) => {
            if (user.id === userIdToFollow) {
              return {
                ...user,

                // NOTE: this is an optimistic update, the server value will be overwritten on top of
                // this once the `userFollow.create` pusher event is received
                computedIsBeingFollowedByUserMe: true,
              };
            } else {
              return user;
            }
          }),
        };
      });
    },
    [getToken, following.status, setFollowing],
  );

  const onUnFollow = useCallback(
    async (userIdToUnFollow: UserInContextOfUserMe['id']) => {
      setFollowUnfollowLoadingUserIds((oldSet) => {
        const newSet = new Set(oldSet);
        newSet.add(userIdToUnFollow);
        return newSet;
      });

      try {
        await BarzAPI.unfollowUser(getToken, userIdToUnFollow);
      } catch (err) {
        console.error(`Error following user ${userIdToUnFollow}: ${err}`);
        showMessage({
          message: 'Error following user!',
          type: 'warning',
        });
        return;
      } finally {
        setFollowUnfollowLoadingUserIds((oldSet) => {
          const newSet = new Set(oldSet);
          newSet.delete(userIdToUnFollow);
          return newSet;
        });
      }

      setFollowing((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: old.data.map((user) => {
            if (user.id === userIdToUnFollow) {
              return {
                ...user,

                // NOTE: this is an optimistic update, the server value will be overwritten on top of
                // this once the `userFollow.delete` pusher event is received
                computedIsBeingFollowedByUserMe: false,
              };
            } else {
              return user;
            }
          }),
        };
      });
      setFollowers((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: old.data.map((user) => {
            if (user.id === userIdToUnFollow) {
              return {
                ...user,

                // NOTE: this is an optimistic update, the server value will be overwritten on top of
                // this once the `userFollow.delete` pusher event is received
                computedIsBeingFollowedByUserMe: false,
              };
            } else {
              return user;
            }
          }),
        };
      });
    },
    [getToken, following.status, setFollowing],
  );

  let followersNode: React.ReactNode | null = null;
  switch (followers.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      followersNode = (
        <View style={styles.innerWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>Loading...</Text>
        </View>
      );
      break;

    case 'ERROR':
      followersNode = (
        <View style={styles.innerWrapper}>
          <View
            style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
            }}
          >
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              Error loading followers!
            </Text>
          </View>
        </View>
      );
      break;

    case 'COMPLETE':
    case 'LOADING_NEW_PAGE':
      if (followers.data.length === 0) {
        followersNode = (
          <View style={styles.textWrapper}>
            <Text style={{ ...Typography.Heading5, color: Color.White }}>No Followers</Text>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11 }}>
              Nobody follows this user.
            </Text>
          </View>
        );
      } else {
        followersNode = (
          <Fragment>
            <InfiniteScrollFlatList
              testID="profile-followers-wrapper"
              data={followers.data}
              keyExtractor={(user) => user.id}
              ItemSeparatorComponent={ListItemDivider}
              renderItem={({ item }) => (
                <ProfileFollowingFollowersUserItem
                  user={item}
                  testID="profile-followers"
                  onPress={() => navigation.push('Profile > View', { userId: item.id })}
                  isUserMe={userMe.status === 'COMPLETE' ? item.id === userMe.data.id : false}
                  followUnFollowLoading={followUnFollowLoadingUserIds.has(item.id)}
                  onFollow={() => onFollow(item.id)}
                  onUnFollow={() => onUnFollow(item.id)}
                />
              )}
              allDataHasBeenFetched={
                followers.status === 'COMPLETE' && !followers.nextPageAvailable
              }
              fetchingNextPage={followers.status === 'LOADING_NEW_PAGE'}
              onFetchNextPage={onFetchNextFollowersPage}
            />

            {/* <ListItemContainer>
              {followers.data.map((item) => (
                <ProfileFollowingFollowersUserItem
                  user={item}
                  testID="profile-followers"
                  onPress={() => navigation.push('Profile > View', { userId: item.id })}
                  isUserMe={userMe.status === 'COMPLETE' ? item.id === userMe.data.id : false}
                  followUnFollowLoading={followUnFollowLoadingUserIds.has(item.id)}
                  onFollow={() => onFollow(item.id)}
                  onUnFollow={() => onUnFollow(item.id)}
                />
              ))}
            </ListItemContainer> */}

            {/* This allows detox to determine programatically how many users are in the list */}
            <Text
              style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, zIndex: 9999 }}
              testID="profile-followers-user-count"
            >
              {followers.data.length}
            </Text>
          </Fragment>
        );
      }
      break;
  }

  let followingNode: React.ReactNode | null = null;
  switch (following.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      followingNode = (
        <View style={styles.innerWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>Loading...</Text>
        </View>
      );
      break;

    case 'ERROR':
      followingNode = (
        <View style={styles.innerWrapper}>
          <View
            style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
            }}
          >
            <Text style={{ ...Typography.Heading5, color: Color.White }}>
              Error loading following!
            </Text>
          </View>
        </View>
      );
      break;

    case 'COMPLETE':
    case 'LOADING_NEW_PAGE':
      if (following.data.length === 0) {
        followingNode = (
          <View style={styles.textWrapper}>
            <Text style={{ ...Typography.Heading5, color: Color.White }}>None Following</Text>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11 }}>
              This user isn't following anyone.
            </Text>
          </View>
        );
      } else {
        followingNode = (
          <Fragment>
            <InfiniteScrollFlatList
              testID="profile-following-wrapper"
              data={following.data}
              keyExtractor={(user) => user.id}
              ItemSeparatorComponent={ListItemDivider}
              renderItem={({ item }) => (
                <ProfileFollowingFollowersUserItem
                  user={item}
                  testID="profile-following"
                  onPress={() => navigation.push('Profile > View', { userId: item.id })}
                  isUserMe={userMe.status === 'COMPLETE' ? item.id === userMe.data.id : false}
                  followUnFollowLoading={followUnFollowLoadingUserIds.has(item.id)}
                  onFollow={() => onFollow(item.id)}
                  onUnFollow={() => onUnFollow(item.id)}
                />
              )}
              allDataHasBeenFetched={
                following.status === 'COMPLETE' && !following.nextPageAvailable
              }
              fetchingNextPage={following.status === 'LOADING_NEW_PAGE'}
              onFetchNextPage={onFetchNextFollowingPage}
            />

            {/* This allows detox to determine programatically how many users are in the list */}
            <Text
              style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, zIndex: 9999 }}
              testID="profile-following-user-count"
            >
              {following.data.length}
            </Text>
          </Fragment>
        );
      }
      break;
  }

  return (
    <Fragment>
      <StatusBar style="light" />
      <View style={styles.wrapper}>
        <SafeAreaView style={styles.safeWrapper}>
          <View style={{ flexDirection: 'row' }}>
            <SegmentedControl>
              <SegmentedControlOption
                type="text"
                text="Followers"
                active={activeTab === 'FOLLOWERS'}
                onPressAction={() => onChangeActiveTab('FOLLOWERS')}
              />
              <SegmentedControlOption
                type="text"
                text="Following"
                active={activeTab === 'FOLLOWING'}
                onPressAction={() => onChangeActiveTab('FOLLOWING')}
              />
            </SegmentedControl>
          </View>

          {activeTab === 'FOLLOWING' ? followingNode : null}
          {activeTab === 'FOLLOWERS' ? followersNode : null}
        </SafeAreaView>
      </View>
    </Fragment>
  );
};

export default ProfileFollowingFollowers;
