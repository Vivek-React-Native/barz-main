import { Alert, StyleSheet, View, Text, BackHandler, useWindowDimensions } from 'react-native';
import { useEffect, useRef, useContext, useState, useCallback } from 'react';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';
import { StatusBar } from 'expo-status-bar';
import { createMachine, interpret, InterpreterStatus, assign } from 'xstate';
import { useAuth } from '@clerk/clerk-expo';
import { useKeepAwake } from 'expo-keep-awake';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';

import TwilioVideo, {
  ImperativeInterface,
  Participant as TwilioParticipant,
  LocalParticipantView,
  RemoteParticipantView,
} from '@barz/twilio-video';
import {
  LocalParticipantView as MockLocalParticipantView,
  RemoteParticipantView as MockRemoteParticipantView,
} from '@barz/twilio-video/src/mockParticipantViews';

import { BarzAPI } from '@barz/mobile/src/lib/api';
import delay from '@barz/mobile/src/lib/delay';
import { Color } from '@barz/mobile/src/ui/tokens';
import { BattleWithParticipants, BattleParticipant } from '@barz/mobile/src/lib/api';
import {
  BattleStateMachineEvent,
  BattleStateMachineContext,
  BattleStateMachineTypestate,
} from '@barz/mobile/src/lib/state-machine';
import { PusherContext } from '@barz/mobile/src/pusher';
import { LinearGradient } from 'expo-linear-gradient';

import BattleContext, { BattleContextData, EMPTY_CONTEXT_DATA } from './context';
// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';

import {
  TWILIO_VIDEO_RECONNECT_INTERVAL_MILLISECONDS,
  TWILIO_VIDEO_BATTLE_SUMMARY_PAGE_MAX_TIME_MILLISECONDS,
} from './constants';
import { useCountdownSeconds } from './utils';

import BattleHeader from './components/BattleHeader';
import CoinTossScreen from './components/CoinTossScreen';
import BattleSummaryScreen from './components/BattleSummaryScreen';
import FullScreenMessage from './components/FullScreenMessage';
import IsNotConnectedToInternetMessage from './components/IsNotConnectedToInternetMessage';
import OpponentNotConnectedToInternetMessage from './components/OpponentNotConnectedToInternetMessage';
import MutedIndicator from './components/MutedIndicator';
import ClocksRunOutText from './components/ClocksRunOutText';
import BattleOverText from './components/BattleOverText';
import YoureUpText from './components/YoureUpText';
import TheirTurnText from './components/TheirTurnText';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    // width
    // height
    zIndex: 99,
  },

  muteIndicator: {
    position: 'absolute',
    bottom: 48,
    right: 16,
    width: 40,
    height: 40,
    zIndex: 999999,
  },

  insetVideoContainer: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    // width: lowerLeftVideoWidthPx,
    // height: lowerLeftVideoHeightPx,
    overflow: 'hidden',
    backgroundColor: Color.Black,
    borderWidth: 1,
    borderColor: Color.Black,
    zIndex: 999999,
  },
  insetVideoContainerOutline: {
    borderColor: Color.Brand.Yellow,
  },

  insetVideoContainerMuteIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
  },
});

export const BattlingScreen: React.FunctionComponent<{
  battle: BattleWithParticipants;
  participant: Omit<BattleParticipant, 'battleId'>;
  currentState: BattleContextData['currentState'];
  isConnectedToInternet: BattleContextData['isConnectedToInternet'];
  remoteParticipantVideoTracks: BattleContextData['remoteParticipantVideoTracks'];
  remoteParticipantAudioMuted: BattleContextData['remoteParticipantAudioMuted'];
  localAudioMuted: boolean;

  opponentParticipant?: Omit<BattleParticipant, 'battleId'>;
  activeParticipant?: Omit<BattleParticipant, 'battleId'>;

  showMockParticipantViews?: boolean;

  onLeaveButtonPressed: (onAlertDismissed?: () => void) => void;
  onLeaveBattleDueToLossOfNetworkConnection: () => void;
}> = ({
  battle,
  participant,
  currentState,
  isConnectedToInternet,
  remoteParticipantVideoTracks,
  remoteParticipantAudioMuted,
  localAudioMuted,
  opponentParticipant,
  activeParticipant,
  showMockParticipantViews = false,
  onLeaveButtonPressed,
  onLeaveBattleDueToLossOfNetworkConnection,
}) => {
  const LocalParticipantViewComponent = showMockParticipantViews
    ? MockLocalParticipantView
    : LocalParticipantView;
  const RemoteParticipantViewComponent = showMockParticipantViews
    ? MockRemoteParticipantView
    : RemoteParticipantView;

  const { width, height } = useWindowDimensions();
  const lowerLeftVideoWidthPx = 160;
  const lowerLeftVideoHeightPx = lowerLeftVideoWidthPx;

  // When the warm up state is initially transitioned into, show a message on the screen
  const [isInFirstFewSecondsOfWarmUp, setIsInFirstFewSecondsOfWarmUp] = useState(false);
  useEffect(() => {
    if (currentState !== 'WARM_UP') {
      setIsInFirstFewSecondsOfWarmUp(false);
      return;
    }

    setIsInFirstFewSecondsOfWarmUp(true);
    let id: NodeJS.Timeout | null = setTimeout(() => {
      setIsInFirstFewSecondsOfWarmUp(false);
      id = null;
    }, 3000);

    return () => {
      if (id !== null) {
        clearTimeout(id);
      }
    };
  }, [currentState]);

  // When the warm up state is initially transitioned into, show a message on the screen
  const [isInFirstFewSecondsOfOpponentWarmUp, setIsInFirstFewSecondsOfOpponentWarmUp] =
    useState(false);
  useEffect(() => {
    if (opponentParticipant?.currentState !== 'WARM_UP') {
      setIsInFirstFewSecondsOfOpponentWarmUp(false);
      return;
    }

    setIsInFirstFewSecondsOfOpponentWarmUp(true);
    let id: NodeJS.Timeout | null = setTimeout(() => {
      setIsInFirstFewSecondsOfOpponentWarmUp(false);
      id = null;
    }, 3000);

    return () => {
      if (id !== null) {
        clearTimeout(id);
      }
    };
  }, [opponentParticipant?.currentState]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {Array.from(remoteParticipantVideoTracks)
        .slice(0, 1)
        .map(([sid, trackSid]) => (
          <View key={trackSid}>
            <RemoteParticipantViewComponent
              enabled
              scaleType="fill"
              remoteParticipantSid={sid}
              remoteParticipantTrackSid={trackSid}
              style={{ width, height }}
            />
          </View>
        ))}

      {/*
      FIXME: `rgba(0,0,0,0.01)` is working around an android issue where when the color is fully
      transparent, android renders the gradients as big black rectangles
      */}
      <LinearGradient
        style={[styles.gradient, { width, height }]}
        colors={['black', 'rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.01)']}
        locations={[0, 0.15, 0.25]}
      />
      <LinearGradient
        style={[styles.gradient, { width, height }]}
        colors={['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.7)', 'black']}
        locations={[0.75, 0.9, 1]}
      />

      {isInFirstFewSecondsOfWarmUp ? <YoureUpText /> : null}

      {isInFirstFewSecondsOfOpponentWarmUp ? <TheirTurnText /> : null}

      {currentState === 'TRANSITION_TO_NEXT_BATTLER' ? <ClocksRunOutText /> : null}

      {currentState === 'TRANSITION_TO_NEXT_ROUND' ? (
        <FullScreenMessage>Move to next round</FullScreenMessage>
      ) : null}

      {currentState === 'TRANSITION_TO_SUMMARY' ? <BattleOverText /> : null}

      {!isConnectedToInternet ? (
        <IsNotConnectedToInternetMessage
          // NOTE: Because the user does not have an internet connection at this point, calling
          // `onLeaveBattle` here would not work since that makes a request to the server to
          // terminate the battle, and that request will fail since the user is offline.
          //
          // So, just go back to the summary page. The server will auto terminate the battle after
          // the same duration anyway so all OTHER participants should end up on the summary page.
          onLeaveBattleDueToLossOfNetworkConnection={onLeaveBattleDueToLossOfNetworkConnection}
        />
      ) : null}

      {opponentParticipant?.connectionStatus !== 'ONLINE' && isConnectedToInternet ? (
        <OpponentNotConnectedToInternetMessage />
      ) : null}

      {opponentParticipant?.appState === 'background' ? (
        <FullScreenMessage>{`Your opponent has backgrounded their app.`}</FullScreenMessage>
      ) : null}

      <BattleHeader
        activeParticipant={activeParticipant}
        opponentParticipant={opponentParticipant}
        battle={battle}
        onLeaveBattle={onLeaveButtonPressed}
      />

      <View style={styles.muteIndicator}>
        {/* FIXME: the remove participant muted state is somewhat unreliable, so use */}
        {/* drive whether this is muted or not based off the state machine */}
        {/* This has tradeoffs! See hre for more info: https://linear.app/barz/issue/PRO-299/[battle]-the-mute-indicator-states-for-the-first-user-in-the-battle */}
        <MutedIndicator muted={activeParticipant?.id === participant.id} />
        {/* <MutedIndicator muted={remoteParticipantAudioMuted.get(sid)} /> */}
      </View>

      <View
        style={[
          styles.insetVideoContainer,
          activeParticipant?.id !== participant.id &&
          activeParticipant?.currentState &&
          ['WARM_UP', 'BATTLE'].includes(activeParticipant?.currentState)
            ? styles.insetVideoContainerOutline
            : {},
          {
            width: lowerLeftVideoWidthPx,
            height: lowerLeftVideoHeightPx,
          },
        ]}
      >
        <LocalParticipantViewComponent
          enabled
          scaleType="fill"
          style={{ width: lowerLeftVideoWidthPx, height: lowerLeftVideoHeightPx }}
        />

        <View style={styles.insetVideoContainerMuteIndicator}>
          <MutedIndicator muted={localAudioMuted} />
        </View>
      </View>
    </View>
  );
};

const Battle: React.FunctionComponent<PageProps<'Battle > Battle'>> = ({ navigation }) => {
  useKeepAwake();

  const { getToken } = useAuth();
  const { battleContextData, setBattleContextData } = useContext(BattleContext);
  if (
    !battleContextData.battle ||
    !battleContextData.participant ||
    !battleContextData.stateMachineDefinition ||
    !battleContextData.beat ||
    !battleContextData.twilioToken
  ) {
    throw new Error(
      'This battle is missing participant, battle, state machine information, beat, or twilio token!',
    );
  }

  const twilioVideoRef = useRef<ImperativeInterface | null>(null);

  const twilioVideoReconnectionIntervalId = useRef<NodeJS.Timer | null>(null);

  const {
    battle,
    participant,
    currentState,
    isConnectedToInternet,
    stateMachineDefinition,
    beat,
    twilioToken,
    twilioVideo,
    remoteParticipantVideoTracks,
    remoteParticipantAudioMuted,
    localAudioMuted,
  } = battleContextData;

  const opponentParticipant = battle.participants.find((p) => p.id !== participant.id);
  const activeParticipant = battle.participants.find((p) => p.currentState !== 'WAITING');
  const firstParticipant = battle.participants.sort(
    (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
  )[0];

  // This function handles sending a message to other peers in the battle via twilio video's data
  // track. If it doesn't successfully send the message the first time, it will retry sending until
  // it is sent successfully.
  const sendEventOnDataTrack = useCallback((payload: BattleStateMachineEvent) => {
    setBattleContextData((old) => ({
      ...old,
      eventsToSend: [...old.eventsToSend, payload],
    }));
  }, []);
  useEffect(() => {
    const sendEventsToOtherParticipantsAndServer = async () => {
      if (!twilioVideoRef.current) {
        return;
      }
      if (!twilioVideoRef.current.isConnected()) {
        return;
      }
      if (battleContextData.eventsToSend.length === 0) {
        return;
      }

      for (const payload of battleContextData.eventsToSend) {
        // Send the message peer to peer to other participants in the battle
        twilioVideoRef.current.sendString(JSON.stringify(payload));

        // Also log the event to the server, so it knows about it for robustness purposes in case a
        // participant looses internet connectivity and needs to catch back up again
        try {
          await BarzAPI.publishStateMachineEvent(getToken, participant.id, payload.uuid, payload);
        } catch (err) {
          console.error(`Error publishing state machine event: ${err}`);
          continue;
        }

        // NOTE: the assumption is that if the request to the server succeeded, then it's highly
        // likely that the peer to peer message succeeded as well.

        // Once the event has been sent to the server successfully, then remove it from the list of
        // events that need to be sent.
        setBattleContextData((old) => ({
          ...old,
          eventsToSend: old.eventsToSend.filter((event) => event.uuid !== payload.uuid),
        }));
      }

      // Check in with the api, giving it the latest current context value with the payload uuid in it
      const now = new Date();
      const videoStreamOffsetMilliseconds = battleContextData.twilioVideoConnectedAt
        ? now.getTime() - battleContextData.twilioVideoConnectedAt.getTime()
        : null;
      await BarzAPI.checkinParticipant(
        getToken,
        participant.id,
        videoStreamOffsetMilliseconds,
        battleContextData.currentState || undefined,
        battleContextData.currentContext || undefined,
      ).catch((err) => {
        console.error(`Error checking in participant ${participant.id}: ${err}`);
      });
    };

    sendEventsToOtherParticipantsAndServer();

    const intervalId = setInterval(sendEventsToOtherParticipantsAndServer, 1000);
    return () => clearInterval(intervalId);
  }, [battleContextData.eventsToSend, battleContextData.twilioVideoConnectedAt, getToken]);

  const createBattleStateMachine = useCallback(
    (
      // NOTE: battleContextData.twilioVideoConnectedAt cannot be used here because the state hasn't
      // been updated yet to include this value when `createBattleStateMachine` is run!
      twilioVideoConnectedAt: Date,

      initialState?: BattleStateMachineTypestate['value'],
      initialContext?: BattleStateMachineTypestate['context'],
    ) => {
      let definition = stateMachineDefinition;
      if (initialState) {
        definition = { ...definition, initial: initialState };
      }
      if (initialContext) {
        definition = { ...definition, context: initialContext };
      }

      // Set up the state machine using the state machine definition that was downloaded
      const machine = createMachine<
        BattleStateMachineContext,
        BattleStateMachineEvent,
        BattleStateMachineTypestate
      >(definition, {
        guards: {
          isThisParticipantActive: (context) => {
            return context.participantIds[context.currentParticipantIndex] === participant.id;
          },
          isThisParticipantNotActive: (context) => {
            return context.participantIds[context.currentParticipantIndex] !== participant.id;
          },
          shouldMoveToNextParticipant: (context) => {
            return context.currentParticipantIndex < context.participantIds.length - 1;
          },
          shouldMoveToNextRound: (context) => {
            return context.activeRoundIndex < context.totalNumberOfRounds - 1;
          },
          isBattleComplete: (context) => {
            return (
              context.activeRoundIndex === context.totalNumberOfRounds - 1 &&
              context.currentParticipantIndex === context.participantIds.length - 1
            );
          },
        },
        actions: {
          setFirstRoundToCurrent: assign({
            activeRoundIndex: 0,
            currentParticipantIndex: 0,
          }),
          stopLocalVideo: () => {
            if (!twilioVideoRef.current) {
              return;
            }
            twilioVideoRef.current.setLocalVideoEnabled(false, 'front');
          },
          startLocalVideo: () => {
            if (!twilioVideoRef.current) {
              return;
            }
            twilioVideoRef.current.setLocalVideoEnabled(true, 'front');
          },
          muteLocalAudio: () => {
            if (!twilioVideoRef.current) {
              return;
            }
            twilioVideoRef.current.stopMusic();
            twilioVideoRef.current.setLocalAudioEnabled(false);
          },
          unmuteLocalAudio: () => {
            if (!twilioVideoRef.current) {
              return;
            }
            twilioVideoRef.current.setLocalAudioEnabled(true);
          },
          startPlayingBeat: () => {
            if (!twilioVideoRef.current) {
              return;
            }

            // Set the volume of the backing media track
            twilioVideoRef.current.setMusicVolume(0.5);

            // Start backing track playback
            twilioVideoRef.current.playMusic();
          },

          moveToNextParticipant: assign((context) => ({
            currentParticipantIndex: context.currentParticipantIndex + 1,
          })),
          moveToNextRound: assign((context) => ({
            activeRoundIndex: context.activeRoundIndex + 1,
            currentParticipantIndex: 0,
          })),

          // Before sending a message, store its uuid locally, so that we know that this message has
          // already been processed and can ensure that messages are processed EXACTLY once
          generateNextMessageUuid: assign((context) => {
            const uuid = uuidv4();
            return {
              nextMessageUuid: uuid,
              acknowlegedMessageUuids: [...context.acknowlegedMessageUuids, uuid],
            };
          }),
          broadcastMoveToNextParticipant: (context) => {
            if (context.nextMessageUuid === null) {
              console.warn(
                'Unable to send MOVE_TO_NEXT_PARTICIPANT message - context.nextMessageUuid is null!',
              );
              return;
            }
            sendEventOnDataTrack({
              type: 'MOVE_TO_NEXT_PARTICIPANT',
              uuid: context.nextMessageUuid,
            });
          },
          broadcastMoveToNextRound: (context) => {
            if (context.nextMessageUuid === null) {
              console.warn(
                'Unable to send MOVE_TO_NEXT_ROUND message - context.nextMessageUuid is null!',
              );
              return;
            }
            sendEventOnDataTrack({ type: 'MOVE_TO_NEXT_ROUND', uuid: context.nextMessageUuid });
          },
          broadcastBattleComplete: (context) => {
            if (context.nextMessageUuid === null) {
              console.warn(
                'Unable to send BATTLE_COMPLETE message - context.nextMessageUuid is null!',
              );
              return;
            }
            sendEventOnDataTrack({ type: 'BATTLE_COMPLETE', uuid: context.nextMessageUuid });
          },

          // After processing a message, add its uuid into the acknowlegedMessageUuids list so that it
          // won't be processed again
          addAcknowledgedMessageToContext: assign({
            acknowlegedMessageUuids: (context, event) => [
              ...context.acknowlegedMessageUuids,
              event.uuid,
            ],
          }),
        },
      });

      const service = interpret(machine);

      service.onTransition((state) => {
        const now = new Date();
        console.log(`In state: ${state.value}`);

        const currentState = state.value as BattleStateMachineTypestate['value'];
        const currentContext = state.context;

        setBattleContextData((old) => ({
          ...old,
          lastCheckedInAt: now,
          currentState,
          currentContext,
        }));

        // Every state machine update, let the server know about it, both for observability, and so
        // that if state machine execution gets interrupted for any reason, the system can recover by
        // looking at the current state, context, and events that were sent up to the server
        BarzAPI.checkinParticipant(
          getToken,
          participant.id,
          now.getTime() - twilioVideoConnectedAt.getTime(),
          currentState,
          currentContext,
        ).catch((err) => {
          console.error(`Error checking in participant ${participant.id}: ${err}`);
        });

        // Once the state machine completes, the battle is done, so go to the summary page
        if (state.done) {
          service.stop();

          // Unmute local audio at the end, so players can talk to each other
          if (twilioVideoRef.current) {
            twilioVideoRef.current.setLocalAudioEnabled(true);
          }

          // Mark the battle as complete, which should render the summary page
          setBattleContextData((old) => ({ ...old, battleCompleted: true }));
        }
      });

      return { machine, service };
    },
    [stateMachineDefinition, setBattleContextData, getToken],
  );

  const connectToTwilioVideo = useCallback(async () => {
    if (!twilioVideoRef.current) {
      return;
    }

    // NOTE: media permissions should at this point already have been granted earlier on in the
    // battle workflow, so don't ask for permissions again

    setBattleContextData((old) => ({
      ...old,
      twilioVideo: { status: 'CONNECTING' },
    }));

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

    twilioVideoRef.current.publishLocalVideo();
    twilioVideoRef.current.publishLocalAudio();
    twilioVideoRef.current.publishLocalData();

    twilioVideoRef.current.connect({
      accessToken: twilioToken,
      roomName: battle.twilioRoomName,
      enableNetworkQualityReporting: true,
      enableVideo: true,
      enableAudio: true,
    });
  }, [battle.twilioRoomName, twilioToken]);

  // Step 1: Connect to twilio video when the component mounts
  useEffect(() => {
    // if (battleContextData.battleCompleted) {
    //   return;
    // }

    connectToTwilioVideo().catch((err) => alert(`Error connecting to twilio video: ${err.stack}`));

    return () => {
      // Stop the state machine, if it is currently running
      if (
        battleContextData.service &&
        battleContextData.service.status === InterpreterStatus.Running
      ) {
        battleContextData.service.stop();
      }

      // Disconnect from twilio video if the connection process has been at least been started
      // FIXME: this may not have the right semantics? Investigate this further.
      if (twilioVideoRef.current && twilioVideoRef.current.isConnected()) {
        setBattleContextData((old) => ({
          ...old,
          twilioVideo: { status: 'DISCONNECTING' },
        }));
        twilioVideoRef.current.disconnect();
      }
    };
  }, [connectToTwilioVideo]);

  // Step 2: Once connected to twilio video, kick off the battle!
  const onTwilioVideoConnected = useCallback(
    async (data: {
      roomName: string;
      roomSid: string;
      participants: Array<TwilioParticipant>;
      localParticipant: TwilioParticipant;
    }) => {
      const now = new Date();
      if (!twilioVideoRef.current) {
        return;
      }

      // If the video disconnected / reconnected and the battle has already been completed, then skip
      // all the battle initialization logic.
      if (battleContextData.battleCompleted) {
        return;
      }

      // Start with the audio muted
      twilioVideoRef.current.setLocalAudioEnabled(false);

      // If there is reconnection logic going on in the background, terminate that - we're connected
      // now!
      if (twilioVideoReconnectionIntervalId.current) {
        clearInterval(twilioVideoReconnectionIntervalId.current);
        twilioVideoReconnectionIntervalId.current = null;

        // If this connect event is actually a reconnection (ie, the internet went down briefly, and is
        // now back), then fetch any missed peer to peer events from the server and replay them
        if (battleContextData.currentContext && battleContextData.service) {
          // If there was music playing before the disconnect occured, re-start playing that music
          // if (
          //   battleContextData.lastDisconnected &&
          //   battleContextData.lastDisconnected.musicPlaybackOffsetInSeconds !== null
          // ) {
          //   // Figure out how many seconds have gone by since the disconnect occured, and offset the
          //   // music track by that amount so that the new audio playback is "lined up" with the old
          //   // audio playback.
          //   const disconnectedDurationInSeconds = (
          //     new Date().getTime() - battleContextData.lastDisconnected.at.getTime()
          //   ) / 1000;

          //   twilioVideoRef.current.playMusicStartingAtSeconds(
          //     battleContextData.lastDisconnected.musicPlaybackOffsetInSeconds +
          //     disconnectedDurationInSeconds
          //   );
          // }

          // Update the state to say that we are connected!
          setBattleContextData((old) => ({
            ...old,
            twilioVideo: {
              status: 'CONNECTED',
              roomSid: data.roomSid,
              participants: data.participants,
              localParticipant: data.localParticipant,
            },
            twilioVideoConnectedAt: now,
          }));
          return;
        }
      }

      const { machine, service } = createBattleStateMachine(now);

      // Update the state to say that we are connected!
      setBattleContextData((old) => ({
        ...old,
        machine,
        service,
        twilioVideo: {
          status: 'CONNECTED',
          roomSid: data.roomSid,
          participants: data.participants,
          localParticipant: data.localParticipant,
        },
        twilioVideoConnectedAt: now,
        // lastDisconnected: null,
      }));

      // Load backing beat for the battle
      // Try three times, and if it still won't work, then terminate the battle
      //
      // NOTE: do this before the state machine starts, so it is guaranteed that the
      // beats music track is loaded into the native code before the state machine starts.
      for (let retryCount = 0; retryCount < 3; retryCount += 1) {
        try {
          // FIXME: The `downloadMusicFromURLAndMakeActive` native function crashes when passed a url
          // that is invalid / cannot be fetched. This is not good and needs to be fixed. As a
          // workaround for the time being though, make a no-op request to the url to make sure it
          // exists / things seem to be working before passing it into `downloadMusicFromURLAndMakeActive`.
          const response = await fetch(beat.beatUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' }, // This should request one byte of data
          });
          if (!response.ok) {
            throw new Error(
              `Unable to fetch HEAD ${beat.beatUrl}, received status ${response.status}`,
            );
          }

          const { error, fileUrl, cacheHit } =
            await twilioVideoRef.current.downloadMusicFromURLAndMakeActive(
              beat.beatUrl,
              // 'https://filter-off-mobile305d3de419994885b86f43bfc1374bmobile-prod.s3.amazonaws.com/etc/quiet3.mp3'
              // 'https://accessible-sheet.surge.sh/quiet3.mp3'
              // 'https://accessible-sheet.surge.sh/Humbeats%20-%20U%20All%20Alone.mp3'
              // 'https://accessible-sheet.surge.sh/Humbeats%20-%20Wrong%20Place%20Wrong%20Time.mp3'
              // 'https://accessible-sheet.surge.sh/uallalonequiet.mp3'
            );
          if (error) {
            throw new Error('Error downloading beat: ' + error);
          }
          showMessage({
            message: `Starting battle with fileUrl: ${fileUrl} cacheHit: ${cacheHit}`,
            duration: 5000,
          });
          break;
        } catch (err) {
          if (retryCount === 2) {
            showMessage({
              message: 'Unable to fetch backing beat!',
              description: 'Terminating battle...',
              type: 'warning',
            });
            disconnectAndNavigateBackToInitialView();
            return;
          }
          console.error(
            `Error fetching backing music: ${err} - retrying in 1000ms... (retry ${
              retryCount + 1
            })`,
          );
          await delay(1000);
        }
      }
      console.log('FINISHED DOWNLOADING BEAT!');

      // Start the state machine, which starts the battle!
      service.start();

      // Now with the state machine running, in the background, perform further initialization in
      // parallel

      // Send the twilio video / audio / data track ids to the server
      //
      // Other participants in the battle can use this information to associate participants within
      // twilio with battle participants in the api
      const videoTrackSid =
        data.localParticipant.videoTrackSids.length > 0
          ? data.localParticipant.videoTrackSids[0]
          : null;
      const audioTrackSid =
        data.localParticipant.audioTrackSids.length > 0
          ? data.localParticipant.audioTrackSids[0]
          : null;
      const dataTrackSid =
        data.localParticipant.dataTrackSids.length > 0
          ? data.localParticipant.dataTrackSids[0]
          : null;
      // Try three times, and if it still won't work, then terminate the battle
      for (let retryCount = 0; retryCount < 3; retryCount += 1) {
        try {
          await BarzAPI.storeTwilioTrackIds(
            getToken,
            participant.id,
            // FIXME: in the ios simulator, there is no video track due to the device not having a camera
            videoTrackSid || 'NO VIDEO',
            audioTrackSid,
            // FIXME: for some reason the data track sid isn't being outputted by the native code properly
            dataTrackSid || 'UNKNOWN',
          );
          break;
        } catch (err) {
          if (retryCount === 2) {
            showMessage({
              message: 'Error storing twilio track ids!',
              description: `Terminating battle... ${err}`,
              type: 'warning',
            });
            disconnectAndNavigateBackToInitialView();
            return;
          }
          console.error(
            `Error storing twilio track ids: ${err} - retrying in 1000ms... (retry ${
              retryCount + 1
            })`,
          );
          await delay(1000);
        }
      }

      setBattleContextData((old) => ({ ...old, battleFinishedInitializing: true }));
    },
    [
      stateMachineDefinition,
      beat,
      sendEventOnDataTrack,
      createBattleStateMachine,
      battleContextData.service,
      participant.id,
      getToken,
    ],
  );

  const navigateBackToInitialView = useCallback(() => {
    navigation.navigate('Battle > Initial');

    // After navigating, reset the state
    setBattleContextData(() => EMPTY_CONTEXT_DATA);
  }, [setBattleContextData]);

  const disconnectAndGoToSummary = useCallback(() => {
    if (!twilioVideoRef.current) {
      return;
    }

    // Remove any in flight reconnection intervals
    if (twilioVideoReconnectionIntervalId.current) {
      clearInterval(twilioVideoReconnectionIntervalId.current);
    }

    // Stop the state machine, if it is currently running
    if (
      battleContextData.service &&
      battleContextData.service.status === InterpreterStatus.Running
    ) {
      battleContextData.service.stop();
    }

    // Stop all twilio video related background stuff
    twilioVideoRef.current.stopMusic();
    twilioVideoRef.current.setLocalAudioEnabled(false);
    twilioVideoRef.current.unpublishLocalVideo();
    twilioVideoRef.current.stopLocalVideo();
    twilioVideoRef.current.unpublishLocalAudio();
    twilioVideoRef.current.stopLocalAudio();

    // Go to the summary page, if not there already
    setBattleContextData((old) => ({ ...old, battleCompleted: true }));
  }, [battleContextData.service]);

  // When called, clean up after twilio video and leave the battle workflow
  const disconnectAndNavigateBackToInitialView = useCallback(() => {
    if (!twilioVideoRef.current) {
      return;
    }
    disconnectAndGoToSummary();

    // After officially leaving the battle, disconnect from the twilio video call if need be
    if (twilioVideoRef.current.isConnected()) {
      setShouldNavigateAfterDisconnect(true);
      setBattleContextData((old) => ({
        ...old,
        twilioVideo: { status: 'DISCONNECTING' },
      }));
      twilioVideoRef.current.disconnect();
      // NOTE: at this point onRoomDidConnect is eventually fired, which THAT then calls
      // navigateBackToInitialView()
    } else {
      navigateBackToInitialView();
    }
  }, [disconnectAndGoToSummary]);

  const attemptToReconnectToTwilioVideo = useCallback(() => {
    if (twilioVideoReconnectionIntervalId.current) {
      clearInterval(twilioVideoReconnectionIntervalId.current);
      twilioVideoReconnectionIntervalId.current = null;
    }

    // If the battle was not completed intentionally, then aggressively attempt to reconnect
    twilioVideoReconnectionIntervalId.current = setInterval(() => {
      console.log('RECONNECT: attempt to reconnect to twilio video');
      connectToTwilioVideo();
    }, TWILIO_VIDEO_RECONNECT_INTERVAL_MILLISECONDS);
  }, [connectToTwilioVideo]);

  const [shouldNavigateAfterDisconnect, setShouldNavigateAfterDisconnect] = useState(false);
  const onTwilioVideoDisconnected = useCallback(
    (data: { roomName: string; roomSid: string; error: string | null }) => {
      setBattleContextData((old) => {
        if (!twilioVideoRef.current) {
          return old;
        }

        return {
          ...old,
          twilioVideo: {
            status: 'DISCONNECTED',
            error: data.error,
            isReconnecting: !shouldNavigateAfterDisconnect,
          },
          // lastDisconnected: {
          //   at: new Date(),
          //   musicPlaybackOffsetInSeconds: twilioVideoRef.current.getMusicPlaybackPosition(),
          // },
        };
      });

      // If the battle was completed intentionally (ie, due to a user clicking "leave"),
      // navigate back to the main app!
      if (shouldNavigateAfterDisconnect) {
        navigateBackToInitialView();
        return;
      }

      // If the battle was not completed intentionally, then aggressively attempt to reconnect
      attemptToReconnectToTwilioVideo();
    },
    [shouldNavigateAfterDisconnect, attemptToReconnectToTwilioVideo],
  );

  // The local participant muting or unmuting their audio should update the context state
  const onLocalAudioChanged = useCallback(
    (data: { audioEnabled: boolean }) => {
      setBattleContextData((old) => ({
        ...old,
        localAudioMuted: !data.audioEnabled, // ("Muted" and "Enabled" are inverses)
      }));
    },
    [setBattleContextData],
  );

  // When a new event is received either over the webrtc data track, OR via pusher from the server,
  // send it to the state machine
  const onBattleEventReceived = useCallback(
    (payload: BattleStateMachineEvent) => {
      if (
        !battleContextData.machine ||
        !battleContextData.service ||
        !battleContextData.currentContext
      ) {
        return;
      }
      if (battleContextData.service.status !== InterpreterStatus.Running) {
        return;
      }

      if (battleContextData.currentContext.acknowlegedMessageUuids.includes(payload.uuid)) {
        console.log(`WARNING: received duplicate state machine event ${payload.uuid}, skipping...`);
        return;
      }

      switch (payload.type) {
        case 'MOVE_TO_NEXT_PARTICIPANT':
        case 'MOVE_TO_NEXT_ROUND':
        case 'BATTLE_COMPLETE':
          battleContextData.service.send(payload);
          break;

        default:
          break;
      }
    },
    [battleContextData.machine, battleContextData.service, battleContextData.currentContext],
  );

  // Listen for battle state machine events from pusher, and if one is received, then send it to the
  // state machine to be processed.
  //
  // NOTE: state machine events are sent from both the server as well as peer to peer over webrtc
  // and are expected to be processed with at least once semantics (ie, the same message might be
  // sent multiple times via different transports)
  const pusher = useContext(PusherContext);
  const battleId = battleContextData.battle ? battleContextData.battle.id : null;
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!battleId) {
      return;
    }

    let eventSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battle-${battleId}-events`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);
          switch (event.eventName) {
            case 'battle.event':
              onBattleEventReceived(payload);
              break;
          }
        },
      })
      .then((channel) => {
        eventSubscription = channel;
      });

    return () => {
      if (eventSubscription) {
        eventSubscription.unsubscribe();
      }
    };
  }, [pusher, battleId, onBattleEventReceived]);

  // When called, disconnect from the battle
  const onLeaveBattle = useCallback(
    (shouldNavigateBackToInitialView: boolean) => {
      if (!twilioVideoRef.current) {
        return;
      }
      if (!battleContextData.participant) {
        return;
      }

      setBattleContextData((old) => ({
        ...old,
        leavingBattleInProgress: true,
      }));

      // If there is a battle active, then make sure the battle serverside is
      // invalidated prior to going back. This is important so that all
      // clients can be forced out of the battle.
      BarzAPI.leaveBattle(getToken, battleContextData.participant.id)
        .then(() => {
          setBattleContextData((old) => ({
            ...old,
            leavingBattleInProgress: false,
          }));

          if (shouldNavigateBackToInitialView) {
            disconnectAndNavigateBackToInitialView();
          } else {
            disconnectAndGoToSummary();
          }
        })
        .catch((err) => {
          setBattleContextData((old) => ({
            ...old,
            leavingBattleInProgress: false,
          }));

          showMessage({
            message: 'Error leaving battle:',
            description: `${err}`,
            type: 'warning',
          });
        });
    },
    [disconnectAndNavigateBackToInitialView, disconnectAndGoToSummary, getToken],
  );

  // When the user presses the "Leave" button, confirm to make sure the user REALLY wants to leave
  // the battle before forfeiting.
  const onLeaveButtonPressed = useCallback(
    (onAlertDismissed?: () => void) => {
      Alert.alert('Are you sure?', 'Leaving the battle will forfeit.', [
        {
          text: 'Leave',
          onPress: () => {
            if (onAlertDismissed) {
              onAlertDismissed();
            }
            onLeaveBattle(false);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            if (onAlertDismissed) {
              onAlertDismissed();
            }
          },
        },
      ]);
    },
    [onLeaveBattle],
  );

  // If the battle becomes inactive due to it being terminated, then stop the battle and go to the
  // "complete" page
  useEffect(() => {
    if (!twilioVideoRef.current) {
      return;
    }
    if (!battle.madeInactiveAt) {
      return;
    }
    if (battleContextData.battleCompleted) {
      return;
    }
    showMessage({
      message: 'The battle was terminated.',
      description: `Reason: ${battle.madeInactiveReason}`,
      type: 'warning',
    });

    disconnectAndGoToSummary();
  }, [battle]);

  // If the user presses the "back" button on Android, then prompt the user to leave the battle
  useEffect(() => {
    let alertVisible = false;
    const backAction = () => {
      if (alertVisible) {
        return true;
      }

      alertVisible = true;
      onLeaveButtonPressed(() => {
        alertVisible = false;
      });

      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', backAction);
    };
  }, [onLeaveButtonPressed]);

  // Once on the summary page, start counting down and bring the user back to the main page
  // automatically after a set duration
  const [summaryCountdownSeconds, summaryCountdownComplete] = useCountdownSeconds(
    TWILIO_VIDEO_BATTLE_SUMMARY_PAGE_MAX_TIME_MILLISECONDS / 1000,
    battleContextData.battleCompleted,
  );
  useEffect(() => {
    if (summaryCountdownComplete) {
      disconnectAndNavigateBackToInitialView();
    }
  }, [summaryCountdownComplete, disconnectAndNavigateBackToInitialView]);

  const twilioVideoComponent = (
    <TwilioVideo
      ref={twilioVideoRef}
      autoInitializeCamera={false}
      onRoomDidConnect={onTwilioVideoConnected}
      onRoomDidDisconnect={onTwilioVideoDisconnected}
      onRoomDidFailToConnect={(data) => {
        setBattleContextData((old) => ({
          ...old,
          twilioVideo: { status: 'FAILED_TO_CONNECT', error: data.error },
        }));
      }}
      onParticipantAddedVideoTrack={(data) => {
        // Store the twilio video track sid into the state so that it can be used to render the
        // repote participant view later on
        setBattleContextData((old) => {
          return {
            ...old,
            remoteParticipantVideoTracks: new Map([
              ...Array.from(old.remoteParticipantVideoTracks),
              [data.participant.sid, data.track.trackSid],
            ]),

            // Audio tracks start unmuted when they are initially created
            remoteParticipantAudioMuted: new Map([
              ...Array.from(old.remoteParticipantAudioMuted),
              [data.participant.sid, false],
            ]),
          };
        });
      }}
      onParticipantRemovedVideoTrack={(data) => {
        // Remove the twilio video track sid from the state, if it is in there, so that the remote
        // participant video view unmounts
        setBattleContextData((old) => {
          return {
            ...old,
            remoteParticipantVideoTracks: new Map(
              Array.from(old.remoteParticipantVideoTracks).filter(
                ([k, _v]) => k !== data.participant.sid,
              ),
            ),
            remoteParticipantAudioMuted: new Map(
              Array.from(old.remoteParticipantAudioMuted).filter(
                ([k, _v]) => k !== data.participant.sid,
              ),
            ),
          };
        });
      }}
      onRoomParticipantDidDisconnect={(data) => {
        // When a remote participant disconnects, remove all video tracks associated with that
        // connection
        setBattleContextData((old) => {
          return {
            ...old,
            remoteParticipantVideoTracks: new Map(
              Array.from(old.remoteParticipantVideoTracks).filter(
                ([k, _v]) => k !== data.participant.sid,
              ),
            ),
            remoteParticipantAudioMuted: new Map(
              Array.from(old.remoteParticipantAudioMuted).filter(
                ([k, _v]) => k !== data.participant.sid,
              ),
            ),
          };
        });
      }}
      onLocalAudioChanged={onLocalAudioChanged}
      // The remote participant muting or unmuting their audio should update the context state
      onParticipantEnabledAudioTrack={(data) => {
        setBattleContextData((old) => {
          return {
            ...old,
            remoteParticipantAudioMuted: new Map([
              ...Array.from(old.remoteParticipantAudioMuted),
              [data.participant.sid, false], // audio enabled means not muted (false)
            ]),
          };
        });
      }}
      onParticipantDisabledAudioTrack={(data) => {
        setBattleContextData((old) => {
          return {
            ...old,

            // Audio tracks start unmuted when they are initially created
            remoteParticipantAudioMuted: new Map([
              ...Array.from(old.remoteParticipantAudioMuted),
              [data.participant.sid, true], // audio disabled means muted (true)
            ]),
          };
        });
      }}
      onDataTrackMessageReceived={({ message, trackSid }) => {
        // alert(`RECEIVED: ${message} ${JSON.stringify([!battleContextData.machine, !battleContextData.service, !battleContextData.currentContext])}`)
        if (!battleContextData.service) {
          return;
        }
        if (battleContextData.service.status !== InterpreterStatus.Running) {
          console.log(
            `WARNING: Event ${message} from track ${trackSid} was received, but the state machine is not running!`,
          );
          return;
        }

        const payload = JSON.parse(message);
        onBattleEventReceived(payload);
      }}
    />
  );

  if (battleContextData.battleCompleted) {
    return (
      <View style={StyleSheet.absoluteFill}>
        {twilioVideoComponent}

        <BattleSummaryScreen
          battle={battleContextData.battle}
          leavingBattleInProgress={battleContextData.leavingBattleInProgress}
          twilioVideoStatus={twilioVideo.status}
          onLeaveBattle={() => onLeaveBattle(true)}
        />
      </View>
    );
  }

  // Show the "coin toss" while the battle is initializing
  if (
    activeParticipant?.currentState === 'CREATED' ||
    activeParticipant?.currentState === 'COIN_TOSS' ||
    !battleContextData.battleFinishedInitializing
  ) {
    return (
      <View style={StyleSheet.absoluteFill}>
        {twilioVideoComponent}

        {!isConnectedToInternet ? (
          <IsNotConnectedToInternetMessage
            // NOTE: Because the user does not have an internet connection at this point, calling
            // `onLeaveBattle` here would not work since that makes a request to the server to
            // terminate the battle, and that request will fail since the user is offline.
            //
            // So, just go back to the summary page. The server will auto terminate the battle after
            // the same duration anyway so all OTHER participants should end up on the summary page.
            onLeaveBattleDueToLossOfNetworkConnection={disconnectAndGoToSummary}
          />
        ) : null}

        <CoinTossScreen
          battle={battleContextData.battle}
          firstParticipant={firstParticipant}
          remoteParticipantVideoTracks={remoteParticipantVideoTracks}
          isConnectedToInternet={isConnectedToInternet}
          onLeaveBattle={() => onLeaveBattle(false)}
        />
      </View>
    );
  }

  if (twilioVideo.status !== 'CONNECTED') {
    return (
      <View style={styles.container}>
        {twilioVideoComponent}
        <Text style={{ color: 'white' }}>Connecting to twilio: {twilioVideo.status}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {twilioVideoComponent}

      <BattlingScreen
        battle={battle}
        participant={participant}
        currentState={currentState}
        isConnectedToInternet={isConnectedToInternet}
        remoteParticipantVideoTracks={remoteParticipantVideoTracks}
        remoteParticipantAudioMuted={remoteParticipantAudioMuted}
        localAudioMuted={localAudioMuted}
        opponentParticipant={opponentParticipant}
        activeParticipant={activeParticipant}
        onLeaveButtonPressed={onLeaveButtonPressed}
        onLeaveBattleDueToLossOfNetworkConnection={disconnectAndGoToSummary}
      />
    </View>
  );
};

export default Battle;
