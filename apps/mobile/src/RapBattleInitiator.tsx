import * as React from 'react';
import { Fragment, useState, useRef, useCallback, useEffect, useContext, useMemo } from 'react';
import { StyleSheet, View, Pressable, Image, Text, FlatList, ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { UserDataContext } from '@barz/mobile/src/user-data';
import { PendingChallengesDataContext } from '@barz/mobile/src/pending-challenges-data';
import { useFocusEffect } from '@react-navigation/native';
import Button from '@barz/mobile/src/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { Lock as IconLock } from '@barz/mobile/src/ui/icons';
import requestCameraAndMicPermissions, {
  showCameraAndMicPermissionDeniedAlert,
} from '@barz/mobile/src/lib/request-camera-mic-permissions';
import InfiniteScrollFlatList from '@barz/mobile/src/components/InfiniteScrollFlatList';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';
import { BattleMatchingModeDebugCache } from '@barz/mobile/src/lib/cache';
import {
  doesUserNeedsRapTag,
  doesUserNeedsAvatarImage,
  doesUserNeedToFillOutBio,
} from '@barz/mobile/src/features/battle/IntroSlideshow';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
// @ts-ignore
import rapBattleIntroSource from '@barz/mobile/src/assets/rap-battle-intro.png';
// @ts-ignore
import rapBattleIntroEnabledSource from '@barz/mobile/src/assets/rap-battle-intro-enabled.png';
// @ts-ignore
import challengeIntroEnabledSource from '@barz/mobile/src/assets/challenge-intro-enabled.png';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '@barz/mobile/src/features/battle';

import TwilioVideo, {
  ImperativeInterface,
  // Participant as TwilioParticipant,
  LocalParticipantView,
  RemoteParticipantView,
} from '@barz/twilio-video';
import { BarzAPI, Challenge, User } from '@barz/mobile/src/lib/api';
import { FixMe } from '@barz/mobile/src/lib/fixme';
const RapBattleTest: React.FunctionComponent<{ onDisconnect: () => void }> = ({ onDisconnect }) => {
  const twilioVideoRef = useRef<ImperativeInterface | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Array<[string, string]>>([]);

  const { getToken } = useAuth();
  const identity = useMemo(() => Math.random().toString(), []);
  const roomName = 'test';

  useEffect(() => {
    const run = async () => {
      if (!twilioVideoRef.current) {
        return;
      }
      const twilioToken = await BarzAPI.getDebugTwilioToken(getToken, roomName, identity);

      // Connect to the twilio video room!
      const startLocalVideoResult = await twilioVideoRef.current.startLocalVideo();
      if (!startLocalVideoResult.success) {
        showMessage({
          message: 'Error connecting to camera:',
          description: startLocalVideoResult.error,
          type: 'warning',
        });
        return;
      }
      console.log('START LOCAL VIDEO RESULT:', startLocalVideoResult);
      twilioVideoRef.current.setLocalVideoEnabled(true, 'front');
      // ref.current.toggleSoundSetup(true);

      const startLocalAudioResult = await twilioVideoRef.current.startLocalAudio();
      if (!startLocalAudioResult.success) {
        showMessage({
          message: 'Error connecting to microphone:',
          description: startLocalAudioResult.error,
          type: 'warning',
        });
        return;
      }
      console.log('START LOCAL AUDIO RESULT:', startLocalAudioResult);

      // console.log('LOCAL AUDIO INITIALIZED?:', twilioVideoRef.current.isLocalAudioInitialized());

      twilioVideoRef.current.publishLocalVideo();
      twilioVideoRef.current.publishLocalAudio();
      twilioVideoRef.current.publishLocalData();

      twilioVideoRef.current.connect({
        accessToken: twilioToken,
        roomName,
        enableNetworkQualityReporting: true,
        enableVideo: true,
        enableAudio: true,
      });
    };

    run().catch((err) => {
      console.error(err);
    });
  }, [identity, roomName]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TwilioVideo
        ref={twilioVideoRef}
        autoInitializeCamera={false}
        onRoomDidConnect={(e) => console.log('roomDidConnect', e)}
        onRoomDidDisconnect={(e) => console.log('roomDidDisconnect', e)}
        onRoomDidFailToConnect={(e) => console.log('roomDidDisconnect', e)}
        onParticipantAddedVideoTrack={(data) => {
          console.log('participantAddedVideoTrack', data);
          setRemoteParticipants((p) => [...p, [data.participant.sid, data.track.trackSid]]);
        }}
        onParticipantRemovedVideoTrack={(data) => {
          console.log('participantRemovedVideoTrack', data);
          setRemoteParticipants((p) => p.filter(([k, _v]) => k !== data.participant.sid));
        }}
        onRoomParticipantDidDisconnect={(data) => {
          console.log('roomParticipantDidDisconnect', data);
          setRemoteParticipants((p) => p.filter(([k, _v]) => k !== data.participant.sid));
        }}
        onLocalAudioChanged={(e) => {
          console.log('localAudioChanged', e);
        }}
        onParticipantEnabledAudioTrack={(data) => {
          console.log('participantEnabledAudioTrack', data);
        }}
        onParticipantDisabledAudioTrack={(data) => {
          console.log('participantDisabledAudioTrack', data);
        }}
        onDataTrackMessageReceived={({ message, trackSid }) => {
          console.log('dataTrackMessageReceived', message, trackSid);
        }}
      />

      <View style={{ width: 220, height: 220, backgroundColor: 'red' }}>
        <LocalParticipantView enabled scaleType="fill" style={{ width: 40, height: 40 }} />
      </View>
      {remoteParticipants.map(([sid, trackSid]) => (
        <View style={{ width: 220, height: 220, backgroundColor: 'green' }} key={trackSid}>
          <RemoteParticipantView
            enabled
            scaleType="fill"
            remoteParticipantSid={sid}
            remoteParticipantTrackSid={trackSid}
            style={{ width: 40, height: 40 }}
          />
        </View>
      ))}

      <Button
        onPress={async () => {
          if (!twilioVideoRef.current) {
            alert("couldn't find twilioVideoRef.current");
            return;
          }

          const { error, fileUrl, cacheHit } =
            await twilioVideoRef.current.downloadMusicFromURLAndMakeActive(
              // 'https://filter-off-mobile305d3de419994885b86f43bfc1374bmobile-prod.s3.amazonaws.com/etc/quiet3.mp3',
              'https://barz-assets.s3.amazonaws.com/rob-initial-beats-oct-12/beat-001.mp3',
            );
          alert(`Error: ${error}, File URL: ${fileUrl}, Cache Hit: ${cacheHit}`);

          if (error) {
            alert(error);
          } else {
            // Set the volume of the backing media track
            twilioVideoRef.current.setMusicVolume(0.5);

            // Start backing track playback
            twilioVideoRef.current.playMusic();
          }
        }}
      >
        Music
      </Button>

      <Button
        onPress={async () => {
          if (!twilioVideoRef.current) {
            alert("couldn't find twilioVideoRef.current");
            return;
          }

          const { error, fileUrl, cacheHit } =
            await twilioVideoRef.current.downloadMusicFromURLAndMakeActive(
              'https://barz-assets.s3.amazonaws.com/rob-initial-beats-oct-12/beat-002.mp3',
            );
          alert(`Error: ${error}, File URL: ${fileUrl}, Cache Hit: ${cacheHit}`);

          if (error) {
            alert(error);
          } else {
            // Set the volume of the backing media track
            twilioVideoRef.current.setMusicVolume(0.5);

            // Start backing track playback
            twilioVideoRef.current.playMusic();
          }
        }}
      >
        Music #2
      </Button>

      <Button
        onPress={() => {
          if (!twilioVideoRef.current) {
            alert("couldn't find twilioVideoRef.current");
            return;
          }
          twilioVideoRef.current.stopMusic();
        }}
      >
        Stop Music
      </Button>
      <Button
        onPress={() => {
          twilioVideoRef?.current?.disconnect();
          onDisconnect();
        }}
      >
        Disconnect
      </Button>
    </ScrollView>
  );
};

const PendingChallengesList: React.FunctionComponent<{
  onNavigateToUserProfile: (userId: User) => void;
  onNavigateToChallenge: (challenge: Challenge) => void;
}> = ({ onNavigateToUserProfile, onNavigateToChallenge }) => {
  const { getToken } = useAuth();

  const [userMe] = useContext(UserDataContext);
  const [pendingChallenges, setPendingChallenges, onFetchNextChallengesPage] = useContext(
    PendingChallengesDataContext,
  );

  const onCancelChallenge = useCallback(
    async (challenge: Challenge) => {
      setPendingChallenges((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          ...old,
          data: old.data.map((item) => {
            if (item.id === challenge.id) {
              return { ...item, cancelInProgress: true };
            } else {
              return item;
            }
          }),
        };
      });

      try {
        await BarzAPI.cancelChallenge(getToken, challenge.id);
      } catch (err: FixMe) {
        console.error(`Error cancelling challenge ${challenge.id}: ${err}`);
        showMessage({
          message: 'Error cancelling challenge!',
          type: 'warning',
        });

        setPendingChallenges((old) => {
          if (old.status !== 'COMPLETE') {
            return old;
          }

          return {
            ...old,
            data: old.data.map((item) => {
              if (item.id === challenge.id) {
                return { ...item, cancelInProgress: false };
              } else {
                return item;
              }
            }),
          };
        });
        return;
      }

      // Do an optimistic update to remove the challenge from the challenges list, now that is no
      // longer pending
      setPendingChallenges((old) => {
        if (
          old.status === 'IDLE' ||
          old.status === 'LOADING_INITIAL_PAGE' ||
          old.status === 'LOADING_NEW_PAGE' ||
          old.status === 'ERROR'
        ) {
          return old;
        }

        const newData = old.data.filter(
          (existingChallenge) => existingChallenge.id !== challenge.id,
        );

        return {
          ...old,
          total: old.total - (old.data.length - newData.length),
          data: newData,
        };
      });
    },
    [setPendingChallenges, getToken],
  );

  if (userMe.status !== 'COMPLETE') {
    return null;
  }

  switch (pendingChallenges.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      return (
        <View style={styles.container}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>Loading...</Text>
        </View>
      );

    case 'ERROR':
      return (
        <View style={styles.container}>
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
              Error loading pending challenges!
            </Text>
          </View>
        </View>
      );

    case 'COMPLETE':
    case 'LOADING_NEW_PAGE':
      if (pendingChallenges.data.length === 0) {
        return null;
      } else {
        return (
          <Fragment>
            <View style={styles.challengesSection}>
              <Text
                style={{ ...Typography.Heading4SemiBold, color: Color.White, paddingBottom: 20 }}
              >
                Challenges
              </Text>
              <InfiniteScrollFlatList
                data={pendingChallenges.data.sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                keyExtractor={(user) => user.id}
                renderItem={({ item }) => {
                  const challengeCreatedByMe = item.createdByUserId === userMe.data.id;
                  const userToShow = challengeCreatedByMe
                    ? item.challengedUser
                    : item.createdByUser;
                  return (
                    <View
                      style={styles.pendingChallengesWrapper}
                      testID="battle-pending-challenge-wrapper"
                    >
                      <View style={styles.pendingChallengesHeader}>
                        <AvatarImage
                          profileImageUrl={userToShow.profileImageUrl}
                          size={36}
                          onPress={() => onNavigateToUserProfile(userToShow)}
                        />
                        <View style={styles.pendingChallengesHeaderTextWrapper}>
                          <Text style={{ ...Typography.Body1Bold, color: Color.White }}>
                            {userToShow.name}
                          </Text>
                          <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>
                            {challengeCreatedByMe
                              ? 'Challenge pending'
                              : 'is challenging you to a battle'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.pendingChallengesFooter}>
                        <Button
                          type="primaryAccent"
                          width={0}
                          flexGrow={1}
                          flexShrink={1}
                          disabled={item.cancelInProgress}
                          onPress={() => onNavigateToChallenge(item)}
                          testID={
                            challengeCreatedByMe
                              ? 'battle-pending-challenge-waiting-room-button'
                              : 'battle-pending-challenge-accept-button'
                          }
                        >
                          {challengeCreatedByMe ? 'Waiting Room' : 'Accept'}
                        </Button>
                        <Button
                          width={0}
                          flexGrow={1}
                          flexShrink={1}
                          type="secondary"
                          disabled={item.cancelInProgress}
                          onPress={() => onCancelChallenge(item)}
                          testID={
                            challengeCreatedByMe
                              ? 'battle-pending-challenge-cancel-challenge-button'
                              : 'battle-pending-challenge-decline-button'
                          }
                        >
                          {challengeCreatedByMe ? 'Cancel Challenge' : 'Decline'}
                        </Button>
                      </View>
                    </View>
                  );
                }}
                nestedScrollEnabled
                allDataHasBeenFetched={
                  pendingChallenges.status === 'COMPLETE' && !pendingChallenges.nextPageAvailable
                }
                fetchingNextPage={pendingChallenges.status === 'LOADING_NEW_PAGE'}
                onFetchNextPage={onFetchNextChallengesPage}
              />
            </View>

            {/* This allows detox to determine programatically how many users are in the list */}
            {/*
            <Text
              style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, zIndex: 9999 }}
              // testID="profile-followers-user-count"
            >
              {pendingChallenges.data.length}
            </Text>
            */}
          </Fragment>
        );
      }
  }
};

const RapBattleInitiatorChoice: React.FunctionComponent<{
  backgroundImageSource: FixMe;
  testID?: string;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}> = ({ backgroundImageSource, testID, disabled, onPress, children }) => {
  return (
    <PressableChangesOpacity
      style={styles.rapBattleWrapper}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
    >
      <Image
        source={backgroundImageSource}
        resizeMode="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          aspectRatio: 1,
          height: 300,
        }}
      />
      <LinearGradient
        style={styles.rapBattleInitiatorChoiceGradient}
        colors={['rgba(0, 0, 0, 0)', 'rgba(20, 20, 20, 0.6)']}
        locations={[0.4792, 1]}
        pointerEvents="none"
      />
      <View style={styles.rapBattleInitiatorChoiceContent}>{children}</View>
    </PressableChangesOpacity>
  );
};

const RapBattleInitiator: React.FunctionComponent<{
  // NOTE: this `navigation` prop needs to be able to navigate to the battle views, this is kinda a
  // sloppy tay to acheve the types required to make that happen
  navigation: PageProps<'Battle > Initial'>['navigation'];
}> = ({ navigation }) => {
  const [testVideoCallEnabled, setTestVideoCallEnabled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      BattleMatchingModeDebugCache.getTestVideoCallEnabled().then((enabled) => {
        setTestVideoCallEnabled(enabled);
      });
    }, [setTestVideoCallEnabled]),
  );

  const [randomMatchModeEnabled, setRandomMatchModeEnabled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      BattleMatchingModeDebugCache.getRandomMatchModeEnabled().then((enabled) => {
        setRandomMatchModeEnabled(enabled);
      });
    }, [setRandomMatchModeEnabled]),
  );

  const { isSignedIn, user } = useUser();
  const [userMe] = useContext(UserDataContext);

  const [waitingForPermissions, setWaitingForPermissions] = useState(false);
  const onFindOpponent = useCallback(
    async (matchingAlgorithm: 'RANDOM' | 'DEFAULT') => {
      if (!isSignedIn) {
        return;
      }
      if (userMe.status !== 'COMPLETE') {
        return;
      }
      setWaitingForPermissions(true);

      // Before letting the user enter the battle workflow, make sure they have granted
      // microphone + camera access
      let result;
      try {
        result = await requestCameraAndMicPermissions();
      } catch (err) {
        showMessage({
          message: 'Error requesting camera and mic permissions!',
          description: `Aborting battle... ${err}`,
          type: 'warning',
        });
        setWaitingForPermissions(false);
        return;
      }
      if (!result) {
        setWaitingForPermissions(false);
        showCameraAndMicPermissionDeniedAlert();
        return;
      }

      setWaitingForPermissions(false);

      const matchingScreenParams = { type: 'MATCH' as const, matchingAlgorithm };

      // Make sure the user has seen the intro slideshow at least once, and show it if not
      if (!user.unsafeMetadata.battleIntroSlideshowViewed) {
        navigation.push('Battle > Intro Slideshow', { matchingScreenParams });
        return;
      }

      // Make sure all the required user information is filled out before the user can battle
      if (doesUserNeedsRapTag(user)) {
        navigation.push('Battle > Create Rap Tag', { matchingScreenParams });
        return;
      }
      if (doesUserNeedsAvatarImage(user)) {
        navigation.push('Battle > Upload Avatar', { matchingScreenParams });
        return;
      }
      if (doesUserNeedToFillOutBio(userMe.data)) {
        navigation.push('Battle > Complete Bio', { matchingScreenParams });
        return;
      }

      // If the user is all set up, then start battling!
      navigation.push('Battle > Matching', matchingScreenParams);
    },
    [setWaitingForPermissions, isSignedIn, user, userMe, navigation.push],
  );

  const rapBattleButtonState = useMemo(() => {
    if (waitingForPermissions) {
      return 'LOADING';
    }
    if (
      isSignedIn &&
      userMe.status === 'COMPLETE' &&
      user.unsafeMetadata.battleIntroSlideshowViewed &&
      (doesUserNeedsRapTag(user) ||
        doesUserNeedsAvatarImage(user) ||
        doesUserNeedToFillOutBio(userMe.data))
    ) {
      return 'FILL_OUT_PROFILE';
    } else {
      return 'FIND_OPPONENT';
    }
  }, [waitingForPermissions, isSignedIn, userMe, user]);

  const [testActive, setTestActive] = useState(false);
  if (testActive) {
    return <RapBattleTest onDisconnect={() => setTestActive(false)} />;
  }

  const data = [
    'RAP_BATTLE' as const,
    'CHALLENGE' as const,
    'FIND_OPPONENT_RANDOMLY' as const,
    'TEST_VIDEO_CALL' as const,
    'PENDING_CHALLENGE_LIST' as const,
  ];
  if (!randomMatchModeEnabled) {
    data.splice(data.indexOf('FIND_OPPONENT_RANDOMLY'), 1);
  }
  if (!testVideoCallEnabled) {
    data.splice(data.indexOf('TEST_VIDEO_CALL'), 1);
  }

  return (
    <View style={styles.container} testID="rap-battle-initiator-container">
      <StatusBar style="light" />
      <FlatList
        style={{ width: '100%', paddingHorizontal: 16 }}
        nestedScrollEnabled
        data={data}
        keyExtractor={(n) => n}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => {
          switch (item) {
            case 'RAP_BATTLE':
              return (
                <RapBattleInitiatorChoice
                  testID="battle-find-opponent-button"
                  onPress={() => onFindOpponent('DEFAULT')}
                  disabled={waitingForPermissions}
                  backgroundImageSource={
                    rapBattleButtonState === 'FILL_OUT_PROFILE'
                      ? rapBattleIntroSource
                      : rapBattleIntroEnabledSource
                  }
                >
                  {rapBattleButtonState === 'FILL_OUT_PROFILE' ? (
                    <View style={styles.rapBattleLockIcon}>
                      <IconLock size={24} color={Color.White} />
                    </View>
                  ) : null}

                  <Text style={{ ...Typography.Heading5, color: Color.White }}>Rap Battle</Text>
                  {rapBattleButtonState === 'LOADING' ? (
                    <Text style={{ ...Typography.Body1, color: Color.Gray.Dark12 }}>
                      Loading...
                    </Text>
                  ) : null}
                  {rapBattleButtonState === 'FIND_OPPONENT' ? (
                    <Text style={{ ...Typography.Body1, color: Color.Gray.Dark12 }}>
                      Jump into a 1v1 vs. an online opponent
                    </Text>
                  ) : null}
                  {rapBattleButtonState === 'FILL_OUT_PROFILE' ? (
                    <Text style={{ ...Typography.Body1, color: Color.Gray.Dark12, paddingTop: 2 }}>
                      Fill out your Rapper Name, Avatar, and bio to start a 1v1 vs. an online
                      opponent
                    </Text>
                  ) : null}
                  {rapBattleButtonState === 'FILL_OUT_PROFILE' ? (
                    <View style={{ marginTop: 8 }}>
                      <Button
                        type="primary"
                        size={32}
                        disabled={waitingForPermissions}
                        onPress={() => onFindOpponent('DEFAULT')}
                      >
                        Fill out Profile to Battle
                      </Button>
                    </View>
                  ) : null}
                </RapBattleInitiatorChoice>
              );
            case 'CHALLENGE':
              return (
                <RapBattleInitiatorChoice
                  testID="battle-challenge-opponent-button"
                  backgroundImageSource={challengeIntroEnabledSource}
                  onPress={() => navigation.push('Battle > Challenge Search For User')}
                >
                  <Text style={{ ...Typography.Heading5, color: Color.White }}>Challenge</Text>
                  <Text style={{ ...Typography.Body1, color: Color.Gray.Dark12, marginTop: 2 }}>
                    Search up a friend by username and send them an invite to a public or private
                    battle
                  </Text>
                </RapBattleInitiatorChoice>
              );
            case 'FIND_OPPONENT_RANDOMLY':
              return (
                <Button
                  type="secondary"
                  size={48}
                  width="100%"
                  onPress={() => onFindOpponent('RANDOM')}
                  disabled={waitingForPermissions}
                >
                  {waitingForPermissions ? 'Loading...' : 'Find Opponent Randomly'}
                </Button>
              );
            case 'TEST_VIDEO_CALL':
              return (
                <Button
                  type="secondary"
                  size={48}
                  width="100%"
                  onPress={async () => {
                    const result = await requestCameraAndMicPermissions();
                    if (!result) {
                      return;
                    }

                    setWaitingForPermissions(false);
                    setTestActive(true);
                  }}
                >
                  Test Video Call
                </Button>
              );

            case 'PENDING_CHALLENGE_LIST':
              return (
                <PendingChallengesList
                  onNavigateToUserProfile={(user) => {
                    // FIXME: there needs to be a profile view within the battle feature as well!
                    // This right now moves the user to the home tab
                    (navigation.navigate as FixMe)('Profile > View', { userId: user.id });
                  }}
                  onNavigateToChallenge={async (challenge) => {
                    // Before letting the user enter the waiting room, make sure they have granted
                    // microphone + camera access
                    let result;
                    try {
                      result = await requestCameraAndMicPermissions();
                    } catch (err) {
                      showMessage({
                        message: 'Error requesting camera and mic permissions!',
                        description: `${err}`,
                        type: 'warning',
                      });
                      return;
                    }
                    if (!result) {
                      showCameraAndMicPermissionDeniedAlert();
                      return;
                    }

                    navigation.push('Battle > Matching', {
                      type: 'CHALLENGE',
                      resumeExisting: true,
                      challenge,
                    });
                  }}
                />
              );
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    alignItems: 'center',
    // justifyContent: 'center',
    gap: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: Color.Gray.Dark1,
  },

  rapBattleWrapper: {
    overflow: 'hidden',
    height: 200,
    width: '100%',

    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },

  rapBattleInitiatorChoiceContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    alignContent: 'flex-end',
    justifyContent: 'flex-end',
    gap: 2,
    padding: 16,
    zIndex: 3,
  },

  rapBattleInitiatorChoiceGradient: {
    display: 'flex',
    height: '100%',
    width: '100%',
    zIndex: 2,
    position: 'absolute',
  },

  rapBattleLockIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },

  challengesSection: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 32,
    paddingBottom: 32,
  },

  pendingChallengesWrapper: {
    width: '100%',
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  pendingChallengesHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  pendingChallengesHeaderTextWrapper: {
    gap: 2,
  },
  pendingChallengesFooter: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default RapBattleInitiator;
