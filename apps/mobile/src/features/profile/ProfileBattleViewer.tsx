import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { View, SafeAreaView, Text, StyleSheet } from 'react-native';
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
// import { FixMe } from '@barz/mobile/src/lib/fixme';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import BattleListPlayer from '@barz/mobile/src/components/BattleListPlayer';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  safeWrapper: StyleSheet.absoluteFillObject,
  innerWrapper: {
    position: 'relative',
  },
});

const ProfileBattleViewer: React.FunctionComponent<PageProps<'Profile > Battle Viewer'>> = ({
  navigation,
  route,
}) => {
  const { userId, startingAtBattleId, battleRecordings } = route.params;

  const name = useMemo(() => {
    return `user-profile-${userId}-battle-viewer-${uuidv4()}`;
  }, [userId]);

  const visibleBattleRecording = useMemo(() => {
    return battleRecordings.find((recording) => recording.battleId === startingAtBattleId) || null;
  }, [battleRecordings, startingAtBattleId]);

  const { getToken } = useAuth();

  // When the component mounts, fetch a list of battles on the home page
  const [battleViewerBattleRecordings, setBattleViewerBattleRecordings] = useState<
    | { status: 'IDLE' }
    | { status: 'NOT_FOUND' }
    | {
        status: 'COMPLETE';
        battleRecordingsPropValue: [BattleRecording];
      }
    | {
        status: 'REFRESHING';
        battleRecordingsPropValue: [BattleRecording];
      }
  >({ status: 'IDLE' });

  useFocusEffect(
    useCallback(() => {
      if (!visibleBattleRecording) {
        setBattleViewerBattleRecordings({ status: 'NOT_FOUND' });
        return;
      }

      setBattleViewerBattleRecordings({
        status: 'COMPLETE',
        battleRecordingsPropValue: [visibleBattleRecording],
      });
    }, [battleRecordings]),
  );

  // // FIRST: relaod the battle recording that just became active, to make sure that the battle
  // // recording is up to date - things like up to date vote totals / etc
  // if (battleRecordingBattleId) {
  //   onRefetchBattleRecordingForBattle(battleRecordingBattleId);
  // }

  // When the user first views the screen, start tracking how long the are on the screen for.
  //
  // And then when the user navigates away from the screen, send an event to the server registering
  // that they viewed the battle for a given amount of milliseconds
  useEffect(() => {
    if (!visibleBattleRecording) {
      return;
    }

    let pageBecameFocusedAt: Date | null = null;
    const unsubscribeFocus = navigation.addListener('focus', () => {
      pageBecameFocusedAt = new Date();
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      if (!pageBecameFocusedAt) {
        return;
      }

      const now = new Date();
      const timeSpentWatchingBattleInMilliseconds = now.getTime() - pageBecameFocusedAt.getTime();

      BarzAPI.markBattleViewComplete(
        getToken,
        visibleBattleRecording.battleId,
        timeSpentWatchingBattleInMilliseconds,
      ).catch((err) => {
        console.log(`Error marking battle ${visibleBattleRecording.battleId} as viewed: ${err}`);
        showMessage({
          message: 'Error marking battle as viewed!',
          type: 'warning',
        });
      });
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, visibleBattleRecording]);

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
      console.log('REFETCH!', battleId, battleViewerBattleRecordings);
      if (battleViewerBattleRecordings.status !== 'COMPLETE') {
        return;
      }

      // Make sure that the battle isn't being refetched infinitely over and over
      const refetchCounter = numberOfTimesBattleRecordingRefetched.get(battleId) || 0;
      if (refetchCounter > 3) {
        console.log(
          `Error getting recording data for battle ${battleId} after trying three times!`,
        );
        showMessage({
          message: `Could not get recording data for battle ${battleId} after trying three times!`,
          type: 'warning',
        });
        return;
      }

      // Increment the refetch counter
      setNumberOfTimesBattleRecordingRefetched((old) => {
        const newValue = new Map(old);
        newValue.set(battleId, refetchCounter + 1);
        return newValue;
      });

      const originalState = battleViewerBattleRecordings;

      setBattleViewerBattleRecordings((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          status: 'REFRESHING',
          battleRecordingsPropValue: battleViewerBattleRecordings.battleRecordingsPropValue,
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

          setBattleViewerBattleRecordings((old) => {
            if (old.status !== 'REFRESHING') {
              return old;
            }

            console.log('REFETCH COMPLETE!', battleId, updatedBattleRecording);

            return {
              status: 'COMPLETE',
              battleRecordingsPropValue: [updatedBattleRecording],
            };
          });
        })
        .catch((error) => {
          console.log(
            `Error refreshing battle recording data for battle with id of ${battleId}: ${error}`,
          );
          showMessage({
            message: 'Error refreshing battle data!',
            type: 'warning',
          });
          setBattleViewerBattleRecordings(originalState);
        });
    },
    [getToken, battleViewerBattleRecordings],
  );

  const onUpdateParticipantUser = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      userData: BattleParticipant['user'],
    ) => {
      setBattleViewerBattleRecordings((old) => {
        if (old.status === 'IDLE' || old.status === 'NOT_FOUND') {
          return old;
        }

        if (old.battleRecordingsPropValue[0].battleId !== battleId) {
          return old;
        }

        return {
          ...old,
          battleRecordingsPropValue: [
            {
              ...old.battleRecordingsPropValue[0],
              participants: old.battleRecordingsPropValue[0].participants.map((participant) => {
                if (participant.id !== participantId) {
                  return participant;
                }
                return {
                  ...participant,
                  user: { ...participant.user, ...userData },
                };
              }),
            },
          ],
        };
      });
    },
    [setBattleViewerBattleRecordings],
  );

  const onChangeComputedTotalVoteAmountForParticipants = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      newComputedTotalVoteAmounts: Map<BattleParticipant['id'], number>,
    ) => {
      setBattleViewerBattleRecordings((old) => {
        if (old.status === 'IDLE' || old.status === 'NOT_FOUND') {
          return old;
        }

        if (old.battleRecordingsPropValue[0].battleId !== battleId) {
          return old;
        }

        return {
          ...old,
          battleRecordingsPropValue: [
            {
              ...old.battleRecordingsPropValue[0],
              participants: old.battleRecordingsPropValue[0].participants.map((participant) => {
                const newComputedTotalVoteAmount = newComputedTotalVoteAmounts.get(participant.id);
                if (typeof newComputedTotalVoteAmount === 'undefined') {
                  return participant;
                }
                return {
                  ...participant,
                  computedTotalVoteAmount: newComputedTotalVoteAmount,
                };
              }),
            },
          ],
        };
      });
    },
    [setBattleViewerBattleRecordings],
  );

  const onChangeCommentTotal = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      newCommentTotal: BattleRecording['battleCommentTotal'],
    ) => {
      setBattleViewerBattleRecordings((old) => {
        if (old.status !== 'COMPLETE' && old.status !== 'REFRESHING') {
          return old;
        }

        if (old.battleRecordingsPropValue[0].battleId !== battleId) {
          return old;
        }

        return {
          ...old,
          battleRecordingsPropValue: [
            {
              ...old.battleRecordingsPropValue[0],
              battleCommentTotal: newCommentTotal,
            },
          ],
        };
      });
    },
    [setBattleViewerBattleRecordings],
  );

  switch (battleViewerBattleRecordings.status) {
    case 'IDLE':
      return (
        <Fragment>
          <StatusBar style="light" />
          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexGrow: 1,
                    backgroundColor: 'black', // NOTE: this needs to be "black", not Colors.Black, to match the tab bar
                  }}
                >
                  <Text style={{ ...Typography.Body1, color: Color.White }}>Loading...</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
    case 'NOT_FOUND':
      return (
        <Fragment>
          <StatusBar style="light" />
          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexGrow: 1,
                    backgroundColor: 'black', // NOTE: this needs to be "black", not Colors.Black, to match the tab bar
                  }}
                >
                  <Text style={{ ...Typography.Body1, color: Color.White }}>Battle not found!</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
    case 'REFRESHING':
    case 'COMPLETE':
      return (
        <Fragment>
          <StatusBar style="light" />

          <View style={styles.wrapper}>
            <SafeAreaView style={styles.safeWrapper}>
              <View style={styles.innerWrapper}>
                <BattleListPlayer
                  name={name}
                  testID="profile-viewer"
                  battleRecordings={battleViewerBattleRecordings.battleRecordingsPropValue}
                  isVisible={isVisible}
                  onVisitUserProfile={(userId) => {
                    navigation.push('Profile > View', { userId });
                  }}
                  onChangeCommentTotal={onChangeCommentTotal}
                  onErrorLoadingBattleVideo={onRefetchBattleRecordingForBattle}
                  // When a user data update is pushed from the server, make sure the update is
                  // reflected in the interface
                  onUpdateParticipantUser={onUpdateParticipantUser}
                  // When the total number of votes for the battle changes, make sure that new vote
                  // total is reflected in the interface
                  onChangeComputedTotalVoteAmountForParticipants={
                    onChangeComputedTotalVoteAmountForParticipants
                  }
                  onNavigateBackwards={() => navigation.goBack()}
                />
              </View>
            </SafeAreaView>
          </View>
        </Fragment>
      );
  }
};

export default ProfileBattleViewer;
