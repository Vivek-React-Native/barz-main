import { useState, useEffect, useContext, useCallback, useRef, Fragment } from 'react';
import { View, SafeAreaView, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import useAppState from '@barz/mobile/src/lib/use-app-state';

import {
  BarzAPI,
  BattleWithParticipants,
  BattleParticipant,
  BattleRecording,
} from '@barz/mobile/src/lib/api';
// import useAppState from '@barz/mobile/src/lib/use-app-state';
import { UserDataContext } from '@barz/mobile/src/user-data';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import { BattleViewerActiveFeedCache } from '@barz/mobile/src/lib/cache';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import BattleListPlayer from '@barz/mobile/src/components/BattleListPlayer';
import { VideoFeedSwitcherControl } from '@barz/mobile/src/components/BattleListPlayerControls';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '@barz/mobile/src/features/home';
import BarzLoading from '../../components/BarzLoading';

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  safeWrapper: StyleSheet.absoluteFillObject,
  innerWrapper: {
    position: 'relative',
  },
  topLoadingIndicator: {
    position: 'absolute',
    top: 64,
    left: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 999,
  },
});

const Home: React.FunctionComponent<PageProps<'Home > Initial'>> = ({ navigation }) => {
  const { getToken } = useAuth();
  const [userMe] = useContext(UserDataContext);

  const [initialLastViewedBattleId, setInitialLastViewedBattleId] = useState<
    BattleWithParticipants['id'] | null
  >(null);

  // `activeFeed` is a filter that controls the type of data shown in the home page list
  const [activeFeed, setActiveFeed] = useState<'FOLLOWING' | 'TRENDING'>('TRENDING');
  const [activeFeedLoaded, setActiveFeedLoaded] = useState(false);
  useEffect(() => {
    BattleViewerActiveFeedCache.getActiveFeed().then((savedFeed) => {
      setActiveFeed(savedFeed);
      setActiveFeedLoaded(true);
    });
  }, [setActiveFeed, setActiveFeedLoaded]);

  // When the component mounts, fetch a list of battles on the home page
  const [homePageBattleRecordings, setHomePageBattleRecordings] = useState<
    | { status: 'IDLE' }
    | { status: 'LOADING_INITIAL_PAGE' }
    | { status: 'INITIAL_PAGE_ERROR'; error: Error }
    | {
        status: 'COMPLETE';
        isReloadingData: boolean;
        nextLastBattleId: BattleWithParticipants['id'];
        data: Array<BattleRecording>;
        pageNumber: number;
      }
    | {
        status: 'LOADING_NEW_PAGE';
        data: Array<BattleRecording>;
        pageNumber: number;
        lastBattleId: BattleWithParticipants['id'];
      }
    | {
        status: 'REFRESHING_OLD_BATTLE';
        nextLastBattleId: BattleWithParticipants['id'];
        data: Array<BattleRecording>;
        pageNumber: number;

        battleIdBeingRefreshed: BattleWithParticipants['id'];
      }
  >({ status: 'IDLE' });

  const onFetchInitialPageOfBattles = useCallback(
    (hasEffectUnmounted: () => boolean = () => false, feed = activeFeed) => {
      if (userMe.status !== 'COMPLETE') {
        return;
      }
      if (!activeFeedLoaded) {
        return;
      }

      // Store the last viewed battle id in the componenet state so that EVEN if it changes on the
      // user in the future, if the user scrolls up to the very top of the battle list, the last
      // battle id pointer will be reset to this value.
      setInitialLastViewedBattleId(userMe.data.lastViewedBattleId);

      setHomePageBattleRecordings((old) => {
        if (old.status === 'COMPLETE') {
          return { ...old, isReloadingData: true };
        } else {
          return { status: 'LOADING_INITIAL_PAGE' };
        }
      });

      BarzAPI.getHomeFeedPage(getToken, userMe.data.lastViewedBattleId, feed)
        .then((data) => {
          if (hasEffectUnmounted()) {
            return;
          }
          setHomePageBattleRecordings({
            status: 'COMPLETE',
            isReloadingData: false,
            nextLastBattleId: data.nextLastBattleId,
            data: data.results,
            pageNumber: 1,
          });
        })
        .catch((error) => {
          setHomePageBattleRecordings({ status: 'INITIAL_PAGE_ERROR', error });
        });
    },
    [
      setHomePageBattleRecordings,
      userMe,
      setInitialLastViewedBattleId,
      getToken,
      activeFeed,
      activeFeedLoaded,
    ],
  );

  const onChangeActiveFeed = useCallback(
    async (newFeed: 'FOLLOWING' | 'TRENDING') => {
      setActiveFeed(newFeed);
      onFetchInitialPageOfBattles(undefined, newFeed);

      await BattleViewerActiveFeedCache.setActiveFeed(newFeed);
    },
    [setActiveFeed, onFetchInitialPageOfBattles],
  );

  // When the page initially becomes focused, fetch the list of battles
  useFocusEffect(
    useCallback(() => {
      if (userMe.status !== 'COMPLETE') {
        return;
      }

      // Only refetch data if it's not already loaded
      if (homePageBattleRecordings.status !== 'IDLE') {
        return;
      }

      let complete = false;
      onFetchInitialPageOfBattles(() => complete);
    }, [homePageBattleRecordings.status, onFetchInitialPageOfBattles]),
  );

  // When the user taps the "home" tab icon, reload the view and fetch all battles again
  useEffect(() => {
    // More info on this technique: https://reactnavigation.org/docs/navigation-events#navigationaddlistener
    const tabs = navigation.getParent('tabs' as FixMe);
    if (!tabs) {
      return;
    }

    const unsubscribe = tabs.addListener('tabPress' as FixMe, () => {
      onFetchInitialPageOfBattles();
    });

    return unsubscribe;
  }, [navigation, onFetchInitialPageOfBattles]);

  const onFetchNextPageOfBattles = useCallback(
    async (feed = activeFeed) => {
      if (homePageBattleRecordings.status !== 'COMPLETE') {
        return;
      }

      const nextLastBattleId = homePageBattleRecordings.nextLastBattleId;
      if (!nextLastBattleId) {
        // There are no more pages of data to fetch!
        return;
      }

      const originalState = homePageBattleRecordings;

      setHomePageBattleRecordings((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          status: 'LOADING_NEW_PAGE',
          data: homePageBattleRecordings.data,
          pageNumber: homePageBattleRecordings.pageNumber,
          lastBattleId: homePageBattleRecordings.nextLastBattleId,
        };
      });

      BarzAPI.getHomeFeedPage(getToken, nextLastBattleId, feed)
        .then((newData) => {
          setHomePageBattleRecordings((old) => {
            if (old.status !== 'LOADING_NEW_PAGE') {
              return old;
            }

            return {
              status: 'COMPLETE',
              isReloadingData: false,
              nextLastBattleId: newData.nextLastBattleId,
              data: [...old.data, ...newData.results],
              pageNumber: old.pageNumber + 1,
            };
          });
        })
        .catch((error) => {
          console.log(
            `Error fetching home page battles page ${homePageBattleRecordings.pageNumber} (last battle of ${homePageBattleRecordings.nextLastBattleId}): ${error}`,
          );
          showMessage({
            message: 'Error fetching more battles!',
            type: 'info',
          });
          setHomePageBattleRecordings(originalState);
        });
    },
    [homePageBattleRecordings, setHomePageBattleRecordings, getToken, activeFeed],
  );

  // When the user leaves the screen after the battle video has started playing (ie, viewing a user
  // profile), then stop the video playback.
  const [isFocused, setIsFocused] = useState(true);
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, setIsFocused]);

  // When the user backgrounds the app during battle playback, stop the video playback
  const appState = useAppState();
  const [isInForeground, setIsInForeground] = useState(true);
  useEffect(() => {
    switch (appState) {
      case 'inactive':
      case 'background':
        setIsInForeground(false);
        break;
      default:
        setIsInForeground(true);
        break;
    }
  }, [appState, setIsInForeground]);

  const isVisible = isFocused && isInForeground;

  // If the signed urls are out of date in a given battle, refetching the battle can refresh them
  const [numberOfTimesBattleRecordingRefetched, setNumberOfTimesBattleRecordingRefetched] =
    useState<Map<BattleWithParticipants['id'], number>>(new Map());

  const onRefetchBattleRecordingForBattle = useCallback(
    (battleId: BattleWithParticipants['id']) => {
      console.log('REFETCH!', battleId, homePageBattleRecordings);
      if (homePageBattleRecordings.status !== 'COMPLETE') {
        return;
      }

      // Make sure that the battle isn't being refetched infinitely over and over
      const refetchCounter = numberOfTimesBattleRecordingRefetched.get(battleId) || 0;
      if (refetchCounter > 3) {
        showMessage({
          message: `Could not get recording data for battle ${battleId} after trying three times!`,
          type: 'warning',
        });
        console.log(
          `Error getting recording data for battle ${battleId} after trying three times!`,
        );
        return;
      }

      // Increment the refetch counter
      setNumberOfTimesBattleRecordingRefetched((old) => {
        const newValue = new Map(old);
        newValue.set(battleId, refetchCounter + 1);
        return newValue;
      });

      const originalState = homePageBattleRecordings;

      setHomePageBattleRecordings((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          status: 'REFRESHING_OLD_BATTLE',
          data: homePageBattleRecordings.data,
          pageNumber: homePageBattleRecordings.pageNumber,
          nextLastBattleId: homePageBattleRecordings.nextLastBattleId,

          battleIdBeingRefreshed: battleId,
        };
      });

      BarzAPI.getBattleRecording(getToken, battleId)
        .then((updatedBattleRecording) => {
          // Reset the refetch counter for the battle
          setNumberOfTimesBattleRecordingRefetched((old) => {
            const newValue = new Map(old);
            newValue.set(battleId, 0);
            return newValue;
          });

          setHomePageBattleRecordings((old) => {
            if (old.status !== 'REFRESHING_OLD_BATTLE') {
              return old;
            }

            console.log('REFETCH COMPLETE!', battleId, updatedBattleRecording);

            return {
              status: 'COMPLETE',
              isReloadingData: false,
              nextLastBattleId: old.nextLastBattleId,
              data: old.data.map((existingBattleRecording) => {
                if (existingBattleRecording.battleId === battleId) {
                  return updatedBattleRecording;
                } else {
                  return existingBattleRecording;
                }
              }),
              pageNumber: old.pageNumber,
            };
          });
        })
        .catch((error) => {
          console.log(
            `Error refreshing battle recording data for battle with id of ${battleId}: ${error}`,
          );
          showMessage({
            message: 'Error refreshing battle data!',
            type: 'info',
          });
          setHomePageBattleRecordings(originalState);
        });
    },
    [getToken, homePageBattleRecordings],
  );

  const onChangeVisibleBattleIndex = useCallback(
    (index: number, timeSpentWatchingBattleInMilliseconds: number | null) => {
      if (homePageBattleRecordings.status !== 'COMPLETE') {
        return;
      }

      let battleRecordingBattleId: BattleRecording['battleId'] | null = null;
      let lastBattleRecordingBattleId: BattleRecording['battleId'];
      if (index <= 0) {
        if (initialLastViewedBattleId === null) {
          return;
        }
        lastBattleRecordingBattleId = initialLastViewedBattleId;
      } else {
        battleRecordingBattleId = homePageBattleRecordings.data[index].battleId;
        lastBattleRecordingBattleId = homePageBattleRecordings.data[index - 1].battleId;
      }

      // FIRST: relaod the battle recording that just became active, to make sure that the battle
      // recording is up to date - things like up to date vote totals / etc
      if (battleRecordingBattleId) {
        onRefetchBattleRecordingForBattle(battleRecordingBattleId);
      }

      // SECOND: mark the previous battle as viewed for analyticsl purposes
      BarzAPI.markBattleViewComplete(
        getToken,
        lastBattleRecordingBattleId,
        timeSpentWatchingBattleInMilliseconds,
      ).catch((err) => {
        console.log(`Error marking battle ${lastBattleRecordingBattleId} as viewed: ${err}`);
        showMessage({
          message: 'Error marking battle as viewed!',
          type: 'info',
        });
      });
    },
    [homePageBattleRecordings, getToken],
  );

  const onUpdateParticipantUser = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      userData: BattleParticipant['user'],
    ) => {
      setHomePageBattleRecordings((old) => {
        if (
          old.status !== 'COMPLETE' &&
          old.status !== 'REFRESHING_OLD_BATTLE' &&
          old.status !== 'LOADING_NEW_PAGE'
        ) {
          return old;
        }

        return {
          ...old,
          data: old.data.map((battleRecording) => {
            if (battleRecording.battleId !== battleId) {
              return battleRecording;
            }
            return {
              ...battleRecording,
              participants: battleRecording.participants.map((participant) => {
                if (participant.id !== participantId) {
                  return participant;
                }
                return {
                  ...participant,
                  user: { ...participant.user, ...userData },
                };
              }),
            };
          }),
        };
      });
    },
    [setHomePageBattleRecordings],
  );

  const onChangeComputedTotalVoteAmountForParticipants = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      newComputedTotalVoteAmounts: Map<BattleParticipant['id'], number>,
    ) => {
      setHomePageBattleRecordings((old) => {
        if (
          old.status !== 'COMPLETE' &&
          old.status !== 'REFRESHING_OLD_BATTLE' &&
          old.status !== 'LOADING_NEW_PAGE'
        ) {
          return old;
        }

        return {
          ...old,
          data: old.data.map((battleRecording) => {
            if (battleRecording.battleId !== battleId) {
              return battleRecording;
            }
            return {
              ...battleRecording,
              participants: battleRecording.participants.map((participant) => {
                const newComputedTotalVoteAmount = newComputedTotalVoteAmounts.get(participant.id);
                if (typeof newComputedTotalVoteAmount === 'undefined') {
                  return participant;
                }
                return {
                  ...participant,
                  computedTotalVoteAmount: newComputedTotalVoteAmount,
                };
              }),
            };
          }),
        };
      });
    },
    [setHomePageBattleRecordings],
  );

  const onChangeCommentTotal = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      newCommentTotal: BattleRecording['battleCommentTotal'],
    ) => {
      setHomePageBattleRecordings((old) => {
        if (
          old.status !== 'COMPLETE' &&
          old.status !== 'REFRESHING_OLD_BATTLE' &&
          old.status !== 'LOADING_NEW_PAGE'
        ) {
          return old;
        }

        return {
          ...old,
          data: old.data.map((battleRecording) => {
            if (battleRecording.battleId !== battleId) {
              return battleRecording;
            }
            return {
              ...battleRecording,
              battleCommentTotal: newCommentTotal,
            };
          }),
        };
      });
    },
    [setHomePageBattleRecordings],
  );

  const videoFeedSwitcherControl = (
    <VideoFeedSwitcherControl
      feed={activeFeed}
      onChangeFeed={onChangeActiveFeed}
      testID="home-feed-switcher"
      disabled={
        !activeFeedLoaded ||
        // Only enable the video feed switcher once the feed has finished loading
        // Users should not be allowed to change the feed while it is loading
        (homePageBattleRecordings.status !== 'LOADING_NEW_PAGE' &&
          homePageBattleRecordings.status !== 'REFRESHING_OLD_BATTLE' &&
          homePageBattleRecordings.status !== 'COMPLETE')
      }
    />
  );

  switch (homePageBattleRecordings.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      return (
        <Fragment>
          <StatusBar style="light" />
          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                {videoFeedSwitcherControl}
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexGrow: 1,
                    backgroundColor: 'black', // NOTE: this needs to be "black", not Colors.Black, to match the tab bar
                  }}
                  testID="home"
                >
                  <BarzLoading />
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
    case 'INITIAL_PAGE_ERROR':
      return (
        <Fragment>
          <StatusBar style="light" />
          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                {videoFeedSwitcherControl}
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexGrow: 1,
                    backgroundColor: 'black', // NOTE: this needs to be "black", not Colors.Black, to match the tab bar
                  }}
                  testID="home"
                >
                  <Text style={{ ...Typography.Body1, color: Color.White }}>
                    Error loading battles!
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
    case 'LOADING_NEW_PAGE':
    case 'REFRESHING_OLD_BATTLE':
    case 'COMPLETE':
      return (
        <Fragment>
          <StatusBar style="light" />

          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                {homePageBattleRecordings.status === 'COMPLETE' &&
                homePageBattleRecordings.isReloadingData ? (
                  <View style={styles.topLoadingIndicator}>
                    <ActivityIndicator size="large" />
                  </View>
                ) : null}
                <BattleListPlayer
                  testID="home-battle-list"
                  additionalGlobalOverlay={videoFeedSwitcherControl}
                  battleRecordings={homePageBattleRecordings.data}
                  isVisible={isVisible}
                  loadingNextPageOfBattles={homePageBattleRecordings.status === 'LOADING_NEW_PAGE'}
                  onFetchNextPageOfBattles={onFetchNextPageOfBattles}
                  onChangeVisibleBattleIndex={onChangeVisibleBattleIndex}
                  onVisitUserProfile={(userId) => {
                    navigation.navigate('Profile > View', { userId });
                  }}
                  onChangeCommentTotal={onChangeCommentTotal}
                  onErrorLoadingBattleVideo={onRefetchBattleRecordingForBattle}
                  onRefetchInitialPageOfBattles={() => onFetchInitialPageOfBattles()}
                  // When a user data update is pushed from the server, make sure the update is
                  // reflected in the interface
                  onUpdateParticipantUser={onUpdateParticipantUser}
                  // When the total number of votes for the battle changes, make sure that new vote
                  // total is reflected in the interface
                  onChangeComputedTotalVoteAmountForParticipants={
                    onChangeComputedTotalVoteAmountForParticipants
                  }
                />
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
  }
};

export default Home;
