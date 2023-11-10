import { useEffect, useCallback, useMemo, useState, useRef, useContext } from 'react';
import VersionNumber from 'react-native-version-number';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import { Challenge as IconChallenge } from '@barz/mobile/src/ui/icons';

import { PusherContext } from '@barz/mobile/src/pusher';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { BarzAPI, Battle, BattleParticipant, Challenge } from '@barz/mobile/src/lib/api';
import requestCameraAndMicPermissions, {
  showCameraAndMicPermissionDeniedAlert,
} from '@barz/mobile/src/lib/request-camera-mic-permissions';
import { UserDataContext } from '@barz/mobile/src/user-data';
import { PendingChallengesDataContext } from '@barz/mobile/src/pending-challenges-data';

import BattleContext, { EMPTY_CONTEXT_DATA } from './context';
// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';
import { useCountdownSeconds } from './utils';
import {
  TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS,
  TWILIO_VIDEO_BATTLE_MATCHING_PAGE_MAX_TIME_MILLISECONDS,
  TWILIO_VIDEO_BATTLE_CHALLGNE_PUBLIC_PRIVATE_MAX_TIME_MILLISECONDS,
} from './constants';
import OpponentFoundScreen from './components/OpponentFoundScreen';
import BattlePrivacyScreen from './components/BattlePrivacyScreen';

const Matching: React.FunctionComponent<PageProps<'Battle > Matching'>> = ({
  navigation,
  route,
}) => {
  const { getToken } = useAuth();
  const { battleContextData, setBattleContextData } = useContext(BattleContext);
  const pusher = useContext(PusherContext);

  const [userMe] = useContext(UserDataContext);

  const [_pendingChallenges, setPendingChallenges] = useContext(PendingChallengesDataContext);

  const [isReadyForBattle, setIsReadyForBattle] = useState(false);

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
      };
    }, [setFocused]),
  );

  // Navigates back to the initial battle screen, and resets the local battle context
  //
  // This doesn't actually make a request to "leave" the battle on the server, since once the battle
  // starts, the user is navigated to the Battle screen.
  const navigateBackToInitialView = useCallback(() => {
    navigation.navigate('Battle > Initial');

    // After navigating, reset the state
    setBattleContextData(() => EMPTY_CONTEXT_DATA);
  }, []);

  const matchingAlgorithm = route.params.type === 'MATCH' ? route.params.matchingAlgorithm : null;

  // First, when in MATCH mode, create a participant so that we can be matched in a battle
  useEffect(() => {
    if (route.params.type !== 'MATCH') {
      return;
    }
    if (!matchingAlgorithm) {
      return;
    }

    BarzAPI.createParticipant(getToken, matchingAlgorithm)
      .then((participant) => {
        setBattleContextData((old) => ({ ...old, participant }));
      })
      .catch((err) => {
        showMessage({
          message: err,
          type: 'info',
        });
      });
  }, [getToken, route.params.type, matchingAlgorithm]);

  // When in CHALLENGE mode and challenging a new user, create a new challenge and store that into
  // the battle context
  const routeParamsUserToChallengeId =
    route.params.type === 'CHALLENGE' && !route.params.resumeExisting
      ? route.params.userToChallengeId
      : null;
  useEffect(() => {
    if (route.params.type !== 'CHALLENGE') {
      return;
    }
    if (!routeParamsUserToChallengeId) {
      return;
    }
    if (!focused) {
      return;
    }

    BarzAPI.createChallenge(getToken, routeParamsUserToChallengeId)
      .then((challenge) => {
        setBattleContextData((old) => ({ ...old, challenge }));

        // Add the challenge to the pending challenges list, so it shows up in the list of pending
        // challenges
        setPendingChallenges((old) => {
          if (
            old.status === 'IDLE' ||
            old.status === 'LOADING_INITIAL_PAGE' ||
            old.status === 'LOADING_NEW_PAGE' ||
            old.status === 'ERROR'
          ) {
            return old;
          }

          let challengeUpdated = false;
          const newData = old.data.map((existingChallenge) => {
            if (existingChallenge.id === challenge.id) {
              challengeUpdated = true;
              return {
                ...existingChallenge,
                ...challenge,
              };
            } else {
              return existingChallenge;
            }
          });

          return {
            ...old,
            total: challengeUpdated ? old.total : old.total + 1,
            data: challengeUpdated
              ? newData
              : [...newData, { ...challenge, cancelInProgress: false }],
          };
        });
      })
      .catch((err) => {
        console.error(`Error creating challenge: ${err}`);
        showMessage({
          message: 'Error creating challenge!',
          type: 'warning',
        });
        navigation.navigate('Battle > Initial');
      });
  }, [getToken, route.params.type, focused, routeParamsUserToChallengeId, setPendingChallenges]);

  // When in CHALLENGE mode and resuming a pre-existing challenge, sset the challenge into the
  // battle context when the page initially is shown
  const routeParamsChallenge =
    route.params.type === 'CHALLENGE' && route.params.resumeExisting
      ? route.params.challenge
      : null;
  useEffect(() => {
    if (route.params.type !== 'CHALLENGE') {
      return;
    }
    if (!focused) {
      return;
    }

    setBattleContextData((old) => ({ ...old, challenge: routeParamsChallenge }));

    if (!routeParamsChallenge) {
      return;
    }

    BarzAPI.checkinChallenge(getToken, routeParamsChallenge.id).catch((err) => {
      console.error(`Error checking in: ${err}`);
    });
  }, [getToken, route.params.type, focused, routeParamsChallenge]);

  // When in CHALLENGE mode, when leaving the waiting room, send a request to the server to let the
  // server know
  const battleContextDataChallengeId = battleContextData.challenge
    ? battleContextData.challenge.id
    : null;
  const battleContextDataChallengeStatusRef = useRef<Challenge['status'] | null>(null);
  useEffect(() => {
    battleContextDataChallengeStatusRef.current = battleContextData.challenge
      ? battleContextData.challenge.status
      : null;
  }, [battleContextData.challenge]);
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (route.params.type !== 'CHALLENGE') {
          return;
        }
        if (!battleContextDataChallengeId) {
          return;
        }

        // If the challenge is not pending, then don't attempt to leave it, because we are now
        // beyond it in the workflow
        if (battleContextDataChallengeStatusRef.current !== 'PENDING') {
          return;
        }

        BarzAPI.leaveChallenge(getToken, battleContextDataChallengeId).catch((err) => {
          // NOTE: it's possible that leaving the challenge may fail if it's cancelled or
          // otherwise in an unusual state. Leaving is best effort anyways and if it doesn't
          // work, the check in timestamp will quickly get old enough to no longer be valid anyway
          console.log(`WARNING: Error leaving challenge: ${err}`);
        });
      };
    }, [getToken, route.params.type, battleContextDataChallengeId]),
  );

  // When in CHALLENGE mode, subscribe to the challenge in the battle context and listen for updates.
  const userMeDataId = userMe.status === 'COMPLETE' ? userMe.data.id : null;
  useEffect(() => {
    if (route.params.type !== 'CHALLENGE') {
      return;
    }
    if (!battleContextDataChallengeId) {
      return;
    }
    if (!focused) {
      return;
    }
    if (!pusher) {
      return;
    }
    if (!userMeDataId) {
      return;
    }

    let challengeSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userMeDataId}-challenges`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);
          switch (event.eventName) {
            case 'challenge.update':
              const challenge: Challenge = payload;
              if (challenge.id === battleContextDataChallengeId) {
                // console.log('UPDATE:', payload);
                setBattleContextData((old) => ({ ...old, challenge: payload }));
              }
              break;

            // When requested, check in to the challenge to tell the server that this client is still
            // responsive.
            case 'challenge.requestCheckIn':
              const challengeId: Challenge['id'] = payload.challengeId;
              if (challengeId !== battleContextDataChallengeId) {
                break;
              }

              BarzAPI.checkinChallenge(getToken, battleContextDataChallengeId).catch((err) => {
                console.error(`Error checking in: ${err}`);
              });
              break;
          }
        },
      })
      .then((channel) => {
        challengeSubscription = channel;
      });

    return () => {
      if (challengeSubscription) {
        challengeSubscription.unsubscribe();
      }
    };
  }, [getToken, route.params.type, focused, pusher, userMeDataId, battleContextDataChallengeId]);

  // When in CHALLENGE mode, if the challenge gets cancelled, then let the user know and bring them
  // out of the waiting room
  useEffect(() => {
    if (route.params.type !== 'CHALLENGE') {
      return;
    }
    if (!battleContextData.challenge) {
      return;
    }
    if (battleContextData.challenge.status !== 'CANCELLED') {
      return;
    }
    if (userMe.status !== 'COMPLETE') {
      return;
    }
    if (battleContextData.challenge.cancelledByUserId === userMe.data.id) {
      // Skip showing the cancellation alert if the user themselves cancelled the battle
      return;
    }
    showMessage({
      message: 'The challenge was cancelled by the other user.',
      type: 'info',
    });

    navigateBackToInitialView();
  }, [route.params.type, battleContextData.challenge, navigateBackToInitialView, userMe]);

  // When in MATCH mode, once the participant is assigned a battle, then fetch the associated battle
  // When in CHALLENGE mode, once the challenge has started, then fetch the associated battle
  const battleContextDataParticipantBattleId = battleContextData.participant
    ? battleContextData.participant.battleId
    : null;
  const battleContextDataChallengeBattleId = battleContextData.challenge
    ? battleContextData.challenge.battleId
    : null;
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!userMeDataId) {
      return;
    }

    let battleId: Battle['id'];
    switch (route.params.type) {
      case 'MATCH': {
        if (!battleContextDataParticipantBattleId) {
          return;
        }
        battleId = battleContextDataParticipantBattleId;
        break;
      }
      case 'CHALLENGE': {
        if (!battleContextDataChallengeBattleId) {
          return;
        }
        battleId = battleContextDataChallengeBattleId;
        break;
      }
    }

    // Remove any challenges associated with the given battle id, if they exist, since
    // the challenge is no longer pending if it has a battle assigned
    setPendingChallenges((old) => {
      if (
        old.status === 'IDLE' ||
        old.status === 'LOADING_INITIAL_PAGE' ||
        old.status === 'LOADING_NEW_PAGE' ||
        old.status === 'ERROR'
      ) {
        return old;
      }

      const newData = old.data.filter((c) => c.battleId !== battleId);

      return {
        ...old,
        total: old.total - (old.data.length - newData.length),
        data: newData,
      };
    });

    BarzAPI.getBattleById(getToken, battleId)
      .then((battle) => {
        setBattleContextData((old) => ({ ...old, battle }));

        let participantId: BattleParticipant['id'];

        // When starting a challenge, the "participant" field isn't yet set with the participant
        // because the "challenge" field was used to manage state up until now.
        //
        // So get the participant from the battle that is the right one based off of the logged in
        // user and store that too
        switch (route.params.type) {
          case 'CHALLENGE': {
            const participant = battle.participants.find((p) => p.userId === userMeDataId) || null;
            if (participant) {
              participantId = participant.id;
              setBattleContextData((old) => ({
                ...old,
                participant: { ...participant, battleId },
              }));
              break;
            } else {
              console.error(
                `Unable to find participant for user ${userMeDataId} in battle ${battle.id}`,
              );
              showMessage({
                message: 'Unable to find participant for logged in user in the battle!',
                type: 'info',
              });
              navigateBackToInitialView();
              return;
            }
          }
          case 'MATCH': {
            if (battleContextData.participant) {
              participantId = battleContextData.participant.id;
              break;
            } else {
              throw new Error(
                'After fetching battle from server, battleContextData.participant is null, but route.params.type is MATCH. This should be impossible!',
              );
            }
          }
        }

        // Figure out the other participant and store that into the battle context
        // This is used to figure out what user should be shown on the opponent details page
        const opponentParticipant = battle.participants.find((p) => p.id !== participantId);
        if (opponentParticipant) {
          setBattleContextData((old) => ({
            ...old,
            opponentParticipant: { ...opponentParticipant, battleId: battleId },
          }));
        }
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching battle:',
          description: `${err}`,
          type: 'info',
        });
      });

    BarzAPI.getBeatForBattle(getToken, battleId)
      .then((beat) => {
        setBattleContextData((old) => ({ ...old, beat }));
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching battle beat:',
          description: `${err}`,
          type: 'info',
        });
      });

    BarzAPI.getStateMachineDefinitionForBattle(
      getToken,
      battleId,
      VersionNumber.appVersion,
      VersionNumber.buildVersion,
    )
      .then((stateMachineDefinition) => {
        setBattleContextData((old) => ({ ...old, stateMachineDefinition }));
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching state machine definition:',
          description: `${err}`,
          type: 'info',
        });
      });

    BarzAPI.getProjectedOutcomeForBattle(getToken, battleId)
      .then((projectedOutcome) => {
        setBattleContextData((old) => ({ ...old, projectedOutcome }));
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching battle projected outcome:',
          description: `${err}`,
          type: 'info',
        });
      });
  }, [
    getToken,
    userMeDataId,
    route.params.type,
    focused,
    battleContextDataParticipantBattleId,
    battleContextDataChallengeBattleId,
    navigateBackToInitialView,
    setPendingChallenges,
  ]);

  // Once the battle loads and the opponent participant is known, get the full user details
  const opponentParticipantUserId = battleContextData.opponentParticipant
    ? battleContextData.opponentParticipant.userId
    : null;
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!opponentParticipantUserId) {
      return;
    }

    setBattleContextData((old) => ({
      ...old,
      userAssociatedWithOpponentParticipant: { status: 'LOADING' },
    }));

    BarzAPI.getUser(getToken, opponentParticipantUserId)
      .then((data) => {
        setBattleContextData((old) => ({
          ...old,
          userAssociatedWithOpponentParticipant: { status: 'COMPLETE', data },
        }));
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching user {opponentParticipantUserId}:',
          description: `${err}`,
          type: 'warning',
        });

        setBattleContextData((old) => ({
          ...old,
          userAssociatedWithOpponentParticipant: { status: 'ERROR' },
        }));
      });
  }, [focused, opponentParticipantUserId]);

  const onBeginBattle = useCallback(() => {
    if (!battleContextData.participant) {
      return;
    }

    // Fetch the twilio token after pressing ready to try to make sure that by the time the battle
    // screen uses it, it hasn't expired yet
    BarzAPI.getTwilioTokenForParticipant(getToken, battleContextData.participant.id)
      .then((twilioToken) => {
        setBattleContextData((old) => ({ ...old, twilioToken }));
        navigation.navigate('Battle > Battle');
      })
      .catch((err) => {
        showMessage({
          message: 'Error fetching twilio token:',
          description: `${err}`,
          type: 'warning',
        });
      });
  }, [battleContextData.participant?.id, getToken]);

  // Once all participants become ready for battle, navigate to the battle view!
  const allOtherParticipantsReadyForBattle = battleContextData.battle
    ? battleContextData.battle.participants
        .filter((p) => p.id !== battleContextData.participant?.id)
        .every((p) => p.readyForBattleAt)
    : false;
  useEffect(() => {
    if (isReadyForBattle && allOtherParticipantsReadyForBattle) {
      onBeginBattle();
    }
  }, [allOtherParticipantsReadyForBattle, isReadyForBattle, onBeginBattle]);

  // When "ready" is pressed, let the server know that this participant is ready to start battling
  const onReadyPress = useCallback(async () => {
    if (!battleContextData.battle || !battleContextData.participant) {
      showMessage({
        message: 'Error: battle or participant is undefined!',
        type: 'info',
      });
      return;
    }
    const participantId = battleContextData.participant.id;
    const battle = battleContextData.battle;

    // Before marking the user as ready for battle, make sure they have granted camera and
    // microphone access.
    //
    // NOTE: the user _should_ already have media permissions - at the very beginning of the battle
    // workflow, this was verified. But, it's possible that in the middle of the battle, a user
    // could have gone into their settings app and disabled camera / microphone permissions, then
    // came back into the battle workflow. This is probably overkill, but safeguards against a
    // TOCTOU sort of issue...
    const mediaPermissionsAvailable = await (async () => {
      let result;
      try {
        result = await requestCameraAndMicPermissions();
      } catch (err) {
        showMessage({
          message: 'Error requesting camera and mic permissions!',
          description: `Aborting battle... ${err}`,
          type: 'warning',
        });
        return false;
      }
      if (!result) {
        showCameraAndMicPermissionDeniedAlert();
        return false;
      }

      return true;
    })();
    if (!mediaPermissionsAvailable) {
      // NOTE: it's not that big of a deal if this request fails, since if it does, the battle will
      // eventually be terminated due to inactivity on the server anyway...
      BarzAPI.leaveBattle(
        getToken,
        battleContextData.participant.id,
        'MEDIA_PERMISSIONS_NOT_GRANTED',
      );

      navigateBackToInitialView();
      return;
    }

    try {
      await BarzAPI.markParticipantReadyForBattle(getToken, battleContextData.participant.id);
    } catch (err) {
      console.log(`Error making participant ready for battle: ${err}`);
      showMessage({
        message: 'Error making participant ready for battle',
        type: 'info',
      });
      return;
    }

    setIsReadyForBattle(true);

    // Are all other participants ready for battle? If so, start the battle!
    if (
      battle.participants.filter((p) => p.id !== participantId).every((p) => p.readyForBattleAt)
    ) {
      onBeginBattle();
    }
  }, [onBeginBattle, battleContextData, getToken, navigateBackToInitialView]);

  // Allows the user to request a given challenge-created battle to be public or private.
  const onRequestPrivacyLevel = useCallback(
    async (privacyLevel: Battle['computedPrivacyLevel']) => {
      if (!battleContextData.participant) {
        return;
      }
      const participantId = battleContextData.participant.id;

      // Optimistically update the privacy state locally
      let previousRequestedPrivacyLevel: BattleParticipant['requestedBattlePrivacyLevel'] = null;
      setBattleContextData((old) => {
        if (old.participant) {
          previousRequestedPrivacyLevel = old.participant.requestedBattlePrivacyLevel;
        }

        const updatedParticipants =
          old.battle?.participants.map((p) => {
            if (p.id === participantId) {
              return {
                ...p,
                requestedBattlePrivacyLevel: privacyLevel,
                // Reset "readyForBattleAt" since the user must press that AFTER making a privacy selection
                readyForBattleAt: null,
              };
            } else {
              return p;
            }
          }) || [];

        return {
          ...old,

          participant: old.participant
            ? {
                ...old.participant,
                requestedBattlePrivacyLevel: privacyLevel,
                // Reset "readyForBattleAt" since the user must press that AFTER making a privacy selection
                readyForBattleAt: null,
              }
            : old.participant,

          battle: old.battle
            ? {
                ...old.battle,
                computedPrivacyLevel: updatedParticipants.every(
                  (p) => p.requestedBattlePrivacyLevel === 'PUBLIC',
                )
                  ? 'PUBLIC'
                  : 'PRIVATE',
                participants: updatedParticipants,
              }
            : old.battle,
        };
      });

      // If the user changes their privacy setting, they are not yet ready for battle
      setIsReadyForBattle(false);

      try {
        await BarzAPI.requestBattlePrivacyLevel(getToken, participantId, privacyLevel);
      } catch (err) {
        console.log(`Error requesting privacy level: ${err}`);
        showMessage({
          message: 'Error requesting battle privacy level!',
          type: 'info',
        });

        // Undo the optimistic update if the request fails
        setBattleContextData((old) => ({
          ...old,

          participant: old.participant
            ? {
                ...old.participant,
                requestedBattlePrivacyLevel: previousRequestedPrivacyLevel,
              }
            : old.participant,

          battle: old.battle
            ? {
                ...old.battle,
                participants: old.battle.participants.map((p) => {
                  if (p.id === participantId) {
                    return { ...p, requestedBattlePrivacyLevel: previousRequestedPrivacyLevel };
                  } else {
                    return p;
                  }
                }),
              }
            : old.battle,
        }));
        return;
      }
    },
    [battleContextData, getToken, setIsReadyForBattle],
  );

  // If a match has not been made yet, and the given participant has been made inactive, then go
  // back to the main page
  const isBattleParticipantInactive =
    typeof battleContextData.participant?.madeInactiveAt === 'string';
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (battleContextData.battle) {
      return;
    }
    if (!isBattleParticipantInactive) {
      return;
    }
    if (battleContextData.participant?.madeInactiveReason === 'UNKNOWN') {
      showMessage({
        message: 'Matching was terminated!',
        description: 'Is your network connection poor?',
        type: 'warning',
      });
    } else {
      showMessage({
        message: 'Matching was terminated!',
        description: `Reason: ${battleContextData.participant?.madeInactiveReason}`,
        type: 'warning',
      });
    }

    navigateBackToInitialView();
  }, [
    battleContextData.battle,
    battleContextData.participant,
    isBattleParticipantInactive,
    navigateBackToInitialView,
    focused,
  ]);

  // If a match has been made and the battle becomes inactive due to it being terminated by another
  // participant, then go back to the main page
  const isBattleInactive = typeof battleContextData.battle?.madeInactiveAt === 'string';
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!isBattleInactive) {
      return;
    }

    showMessage({
      message: 'The matched participant terminated the battle.',
      description: `Reason: ${battleContextData.battle?.madeInactiveReason}`,
      type: 'warning',
    });

    navigateBackToInitialView();
  }, [isBattleInactive, battleContextData.battle, navigateBackToInitialView, focused]);

  // When the local internet connection is lost, go back to the initial page
  const [disconnectCountdownSeconds, disconnectCountdownComplete] = useCountdownSeconds(
    TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS / 1000,
    !battleContextData.isConnectedToInternet,
  );
  useEffect(() => {
    if (!focused) {
      return;
    }

    if (disconnectCountdownComplete) {
      navigateBackToInitialView();
    }
  }, [navigation, focused, disconnectCountdownComplete, navigateBackToInitialView]);

  // Start counting down once the matching page becomes visible. Once the countdown has completed,
  // then start the battle.
  const readyCountdownEnabled = Boolean(focused && battleContextData.battle);
  const readyCountdownLengthMilliseconds = useMemo(() => {
    if (battleContextDataChallengeId) {
      return TWILIO_VIDEO_BATTLE_CHALLGNE_PUBLIC_PRIVATE_MAX_TIME_MILLISECONDS;
    } else {
      return TWILIO_VIDEO_BATTLE_MATCHING_PAGE_MAX_TIME_MILLISECONDS;
    }
  }, [battleContextDataChallengeId]);
  const [readyCountdownSeconds, readyCountdownComplete] = useCountdownSeconds(
    readyCountdownLengthMilliseconds / 1000,
    readyCountdownEnabled,
  );
  const [automaticReadyRequestTriggered, setAutomaticReadyRequestTriggered] = useState(false);
  useEffect(() => {
    if (!readyCountdownEnabled) {
      return;
    }
    if (automaticReadyRequestTriggered) {
      return;
    }
    if (readyCountdownComplete) {
      onReadyPress();
      setAutomaticReadyRequestTriggered(true);
    }
  }, [
    readyCountdownEnabled,
    readyCountdownComplete,
    onReadyPress,
    automaticReadyRequestTriggered,
    setAutomaticReadyRequestTriggered,
  ]);

  const currentState = useMemo(() => {
    if (!battleContextData.isConnectedToInternet) {
      return { type: 'NOT_ONLINE' as const };
    }

    switch (route.params.type) {
      case 'CHALLENGE':
        if (!battleContextData.challenge) {
          return { type: 'CHALLENGE_CREATING_CHALLENGE' as const };
        }
        if (!battleContextData.challenge.battleId) {
          return {
            type: 'CHALLENGE_WAITING_ROOM' as const,
            challenge: battleContextData.challenge,
          };
        }
        if (!battleContextData.participant) {
          return { type: 'CHALLENGE_LOADING_PARTICIPANT' as const };
        }
        if (!isReadyForBattle) {
          return {
            type: 'CHALLENGE_BATTLE_PRIVACY' as const,
            participant: battleContextData.participant,
            opponentParticipant: battleContextData.opponentParticipant,
            battle: battleContextData.battle,
          };
        }
        return {
          type: 'CHALLENGE_READY_FOR_BATTLE' as const,
          participant: battleContextData.participant,
          opponentParticipant: battleContextData.opponentParticipant,
          battle: battleContextData.battle,
        };

      case 'MATCH':
        if (!battleContextData.participant) {
          return { type: 'MATCHING_CREATING_PARTICIPANT' as const };
        }
        if (!battleContextData.battle) {
          return {
            type: 'MATCHING_SEARCHING_FOR_OPPONENT' as const,
            participant: battleContextData.participant,
          };
        }

        if (!isReadyForBattle) {
          return {
            type: 'MATCHING_OPPONENT_FOUND' as const,
            participant: battleContextData.participant,
            opponentParticipant: battleContextData.opponentParticipant,
            userAssociatedWithOpponentParticipant:
              battleContextData.userAssociatedWithOpponentParticipant,
            battle: battleContextData.battle,
            projectedOutcome: battleContextData.projectedOutcome,
          };
        }
        return {
          type: 'MATCHING_READY_FOR_BATTLE' as const,
          participant: battleContextData.participant,
          opponentParticipant: battleContextData.opponentParticipant,
          userAssociatedWithOpponentParticipant:
            battleContextData.userAssociatedWithOpponentParticipant,
          battle: battleContextData.battle,
          projectedOutcome: battleContextData.projectedOutcome,
        };
    }
  }, [route.params.type, battleContextData]);

  switch (currentState.type) {
    case 'NOT_ONLINE':
      return (
        <View style={styles.container} testID="battle-matching-container">
          <StatusBar style="light" />
          <View style={styles.inner}>
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              You have lost your internet connection, trying to reconnect to server... If you don't
              rejoin{' '}
              {disconnectCountdownComplete ? 'soon' : `in ${disconnectCountdownSeconds} seconds`},
              you'll automatically forfeit the battle.
            </Text>
          </View>
        </View>
      );
    case 'CHALLENGE_CREATING_CHALLENGE':
      return (
        <View style={styles.container}>
          <StatusBar style="light" />
          <Text style={{ ...Typography.Body1, color: Color.Gray.Dark10 }}>
            Creating challenge...
          </Text>
        </View>
      );
    case 'CHALLENGE_WAITING_ROOM':
      return (
        <View style={styles.container} testID="battle-challenge-waiting-room-container">
          <StatusBar style="light" />
          <View style={{ ...styles.messageWrapper }}>
            <IconChallenge size={36} />
            <Text
              style={{
                ...Typography.Heading3,
                color: Color.White,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              Invitation sent
            </Text>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark10, textAlign: 'center' }}>
              We sent{' '}
              <Text style={{ ...Typography.Body1Bold, color: Color.White }}>
                {battleContextData.challenge?.challengedUser.name}
              </Text>{' '}
              an invitation, the battle will start when they accept
            </Text>
          </View>
        </View>
      );
    case 'CHALLENGE_LOADING_PARTICIPANT':
      return (
        <View style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.messageWrapper}>
            <ActivityIndicator size={'large'} />
            <Text style={{ ...Typography.Heading3, color: Color.White, textAlign: 'center' }}>
              Loading Participant
            </Text>
          </View>
        </View>
      );
    case 'CHALLENGE_BATTLE_PRIVACY':
    case 'CHALLENGE_READY_FOR_BATTLE':
      return (
        <BattlePrivacyScreen
          battle={currentState.battle || null}
          participant={currentState.participant || null}
          opponentParticipant={currentState.opponentParticipant || null}
          onRequestPrivacyLevel={onRequestPrivacyLevel}
          onReadyPress={onReadyPress}
          isReadyForBattle={currentState.type === 'CHALLENGE_READY_FOR_BATTLE'}
          readyCountdownComplete={readyCountdownComplete}
          readyCountdownSeconds={readyCountdownSeconds}
        />
      );
    case 'MATCHING_CREATING_PARTICIPANT':
      return (
        <View style={styles.container} testID="battle-matching-container">
          <StatusBar style="light" />
          <Text style={{ ...Typography.Body1, color: Color.Gray.Dark10 }}>
            Creating participant...
          </Text>
        </View>
      );
    case 'MATCHING_SEARCHING_FOR_OPPONENT':
      return (
        <View style={styles.container} testID="battle-matching-container">
          <StatusBar style="light" />
          <View style={styles.messageWrapper}>
            <ActivityIndicator size={'large'} />
            <Text style={{ ...Typography.Heading3, color: Color.White, textAlign: 'center' }}>
              Searching for {matchingAlgorithm === 'RANDOM' ? 'a random' : 'an'} opponent...
            </Text>
          </View>
          {currentState.participant.initialMatchFailed ? (
            <View
              style={{
                position: 'absolute',
                bottom: 64,
                left: 24,
                right: 24,
                borderWidth: 1,
                borderColor: Color.White,
                justifyContent: 'center',
                padding: 8,
              }}
              testID="battle-matching-initial-match-failed"
            >
              <Text style={{ ...Typography.Body1, color: Color.White }}>
                Initial match failed, still looking...
              </Text>
            </View>
          ) : null}
        </View>
      );
    case 'MATCHING_OPPONENT_FOUND':
    case 'MATCHING_READY_FOR_BATTLE':
      return (
        <OpponentFoundScreen
          opponentParticipant={currentState.opponentParticipant}
          userAssociatedWithOpponentParticipant={currentState.userAssociatedWithOpponentParticipant}
          onReadyPress={onReadyPress}
          isReadyForBattle={currentState.type === 'MATCHING_READY_FOR_BATTLE'}
          readyCountdownComplete={readyCountdownComplete}
          readyCountdownSeconds={readyCountdownSeconds}
          projectedOutcome={currentState.projectedOutcome}
        />
      );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    paddingHorizontal: 48,
    gap: 8,
  },
  messageWrapper: {
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  inner: {
    width: 320,
  },
  bottomReadyButtonContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
  },
});

export default Matching;
