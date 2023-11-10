import * as React from 'react';
import {
  Participant as TwilioParticipant,
  Publication as TwilioPublication,
} from '@barz/twilio-video';

import {
  BattleWithParticipants,
  BattleParticipant,
  Challenge,
  StateMachineDefinition,
  UserInContextOfUserMe,
} from '@barz/mobile/src/lib/api';

import {
  BattleStateMachine,
  BattleStateMachineInterpreter,
  BattleStateMachineTypestate,
  BattleStateMachineEvent,
} from '@barz/mobile/src/lib/state-machine';

export const EMPTY_CONTEXT_DATA: BattleContextData = {
  participant: null,
  battle: null,
  challenge: null,
  stateMachineDefinition: null,
  beat: null,
  projectedOutcome: null,

  opponentParticipant: null,
  userAssociatedWithOpponentParticipant: { status: 'IDLE' },

  // Set when the challenge is being left - this disables onscreen elements while loading
  cancellingChallengeInProgress: false,

  // Set when the battle is being left - this disables onscreen elements while loading
  leavingBattleInProgress: false,

  // The twilio token is used to connect to twilio video and establish the video call session
  twilioToken: null,

  // Store state about the currently connected twilio video room / twilio participants / etc
  twilioVideo: { status: 'IDLE' },
  remoteParticipantVideoTracks: new Map(),
  localAudioMuted: true,
  remoteParticipantAudioMuted: new Map(),
  // lastDisconnected: null,

  isConnectedToInternet: true,

  // The state machine which when initialized, starts running the `stateMachineDefinition` logic
  machine: null,
  service: null,
  battleFinishedInitializing: false,
  battleCompleted: false,
  eventsToSend: [],

  twilioVideoConnectedAt: null,
  lastCheckedInAt: null,
  currentState: null,
  currentContext: null,
};

export type BattleContextData = {
  participant: BattleParticipant | null;
  battle: BattleWithParticipants | null;
  challenge: Challenge | null;
  stateMachineDefinition: StateMachineDefinition | null;
  beat: { id: string; beatUrl: string } | null;
  projectedOutcome: {
    startingScore: number;
    projectedScores: {
      win: number;
      loss: number;
      tie: number;
    };
  } | null;

  opponentParticipant: BattleParticipant | null;
  userAssociatedWithOpponentParticipant:
    | { status: 'IDLE' }
    | { status: 'LOADING' }
    | { status: 'COMPLETE'; data: UserInContextOfUserMe }
    | { status: 'ERROR' };

  // Set when the challenge is being left - this disables onscreen elements while loading
  cancellingChallengeInProgress: boolean;

  // Set when the battle is being left - this disables onscreen elements while loading
  leavingBattleInProgress: boolean;

  // The twilio token is used to connect to twilio video and establish the video call session
  twilioToken: string | null;

  // Store state about the currently connected twilio video room / twilio participants / etc
  twilioVideo:
    | { status: 'IDLE' }
    | { status: 'CONNECTING' }
    | { status: 'FETCHING_LATEST_STATE_MACHINE_EVENTS' }
    | { status: 'FAILED_TO_CONNECT'; error: string | null }
    | {
        status: 'CONNECTED';
        roomSid: string;
        participants: Array<TwilioParticipant>;
        localParticipant: TwilioParticipant;
      }
    | { status: 'DISCONNECTING' }
    | {
        status: 'DISCONNECTED';
        error: string | null;
        isReconnecting: boolean;
      };
  remoteParticipantVideoTracks: Map<TwilioParticipant['sid'], TwilioPublication['trackSid']>;
  localAudioMuted: boolean;
  remoteParticipantAudioMuted: Map<TwilioParticipant['sid'], boolean>;
  // lastDisconnected: {
  //   at: Date;
  //   musicPlaybackOffsetInSeconds: number | null;
  // } | null;

  isConnectedToInternet: boolean;

  // The state machine which when initialized, starts running the `stateMachineDefinition` logic
  machine: BattleStateMachine | null;
  service: BattleStateMachineInterpreter | null;
  battleFinishedInitializing: boolean;
  battleCompleted: boolean;
  eventsToSend: Array<BattleStateMachineEvent>;

  twilioVideoConnectedAt: Date | null;

  // Store when the last check in occurred
  lastCheckedInAt: Date | null;
  currentState: BattleStateMachineTypestate['value'] | null;
  currentContext: BattleStateMachineTypestate['context'] | null;
};

const BattleContext = React.createContext<{
  battleContextData: BattleContextData;
  setBattleContextData: (updater: (old: BattleContextData) => BattleContextData) => void;
}>({
  battleContextData: EMPTY_CONTEXT_DATA,
  setBattleContextData: () => {},
});

export default BattleContext;
