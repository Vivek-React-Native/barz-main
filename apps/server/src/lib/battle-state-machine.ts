import { createMachine } from 'xstate';
import { Interpreter } from 'xstate';
import { BattleWithParticipants } from './battle.ts';

export type BattleStateMachineEvent =
  | { type: 'MOVE_TO_NEXT_PARTICIPANT' }
  | { type: 'MOVE_TO_NEXT_ROUND' }
  | { type: 'BATTLE_COMPLETE' };

export type BattleStateMachineTypestate =
  | { value: 'CREATED'; context: BattleStateMachineContext }
  | { value: 'COIN_TOSS'; context: BattleStateMachineContext }
  | { value: 'READY'; context: BattleStateMachineContext }
  | { value: 'WAITING'; context: BattleStateMachineContext }
  | { value: 'WARM_UP'; context: BattleStateMachineContext }
  | { value: 'BATTLE'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_NEXT_BATTLER'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_NEXT_ROUND'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_SUMMARY'; context: BattleStateMachineContext }
  | { value: 'SUMMARY'; context: BattleStateMachineContext }
  | { value: 'COMPLETE'; context: BattleStateMachineContext };

export const STATES_THAT_CAN_SWITCH_ACTIVE_BATTLER: Array<BattleStateMachineTypestate['value']> = [
  'TRANSITION_TO_NEXT_BATTLER',
  'TRANSITION_TO_NEXT_ROUND',
  'TRANSITION_TO_SUMMARY',
];

function create(battle: BattleWithParticipants) {
  return createMachine<
    BattleStateMachineContext,
    BattleStateMachineEvent,
    BattleStateMachineTypestate
  >(
    {
      id: 'Rap Battle',
      initial: 'CREATED',
      context: generateInitialContext(battle),
      predictableActionArguments: true,
      states: {
        CREATED: {
          entry: ['muteLocalAudio'],
          always: {
            target: 'COIN_TOSS',
          },
        },
        COIN_TOSS: {
          exit: ['muteLocalAudio'],
          after: {
            10_000: {
              target: 'READY',
              // "actions": ["setFirstRoundToCurrent"],
            },
          },
        },
        READY: {
          always: [
            {
              target: 'WARM_UP',
              cond: 'isThisParticipantActive',
            },
            {
              target: 'WAITING',
              cond: 'isThisParticipantNotActive',
            },
            {
              target: 'TRANSITION_TO_SUMMARY',
              cond: 'isBattleComplete',
            },
          ],
        },
        WAITING: {
          on: {
            MOVE_TO_NEXT_PARTICIPANT: {
              target: 'TRANSITION_TO_NEXT_BATTLER',
              actions: ['moveToNextParticipant', 'addAcknowledgedMessageToContext'],
            },
            MOVE_TO_NEXT_ROUND: {
              target: 'TRANSITION_TO_NEXT_ROUND',
              actions: ['moveToNextRound', 'addAcknowledgedMessageToContext'],
            },
            BATTLE_COMPLETE: {
              target: 'TRANSITION_TO_SUMMARY',
              actions: ['addAcknowledgedMessageToContext'],
            },
          },
        },
        WARM_UP: {
          entry: ['unmuteLocalAudio', 'startPlayingBeat'],
          after: {
            [battle.warmupLengthSeconds * 1000]: {
              target: 'BATTLE',
            },
          },
        },
        BATTLE: {
          exit: ['muteLocalAudio'],
          after: {
            [(battle.turnLengthSeconds - battle.warmupLengthSeconds) * 1000]: [
              {
                target: 'TRANSITION_TO_NEXT_BATTLER',
                cond: 'shouldMoveToNextParticipant',
                actions: [
                  'generateNextMessageUuid',
                  'broadcastMoveToNextParticipant',
                  'moveToNextParticipant',
                ],
              },
              {
                target: 'TRANSITION_TO_NEXT_ROUND',
                cond: 'shouldMoveToNextRound',
                actions: ['generateNextMessageUuid', 'broadcastMoveToNextRound', 'moveToNextRound'],
              },
              {
                target: 'TRANSITION_TO_SUMMARY',
                cond: 'isBattleComplete',
                actions: ['generateNextMessageUuid', 'broadcastBattleComplete'],
              },
            ],
          },
        },
        TRANSITION_TO_NEXT_BATTLER: {
          after: {
            1_000: {
              target: 'READY',
            },
          },
        },
        TRANSITION_TO_NEXT_ROUND: {
          after: {
            1_000: {
              target: 'READY',
            },
          },
        },
        TRANSITION_TO_SUMMARY: {
          after: {
            1_000: {
              target: 'SUMMARY',
            },
          },
        },
        SUMMARY: {
          always: {
            target: 'COMPLETE',
          },
        },
        COMPLETE: { type: 'final' },
      },
    },
    {
      actions: {
        // NOTE: these actions have been moved to @barz/mobile
      },
    },
  );
}

function generateInitialContext(battle: BattleWithParticipants) {
  return {
    version: 1,
    battleId: battle.id,

    activeRoundIndex: 0,
    totalNumberOfRounds: battle.numberOfRounds,

    currentParticipantIndex: 0,
    participantIds: battle.participants
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .map((p) => p.id),

    nextMessageUuid: null as string | null,
    acknowlegedMessageUuids: [] as Array<string>,
  };
}

type BattleStateMachine = ReturnType<typeof create>;
export type BattleStateMachineContext = ReturnType<typeof generateInitialContext>;

export type BattleStateMachineState = BattleStateMachine['initialState'];
export type BattleStateMachineInterpreter = Interpreter<
  BattleStateMachineContext,
  any,
  BattleStateMachineEvent,
  BattleStateMachineTypestate
>;

const BattleStateMachine = {
  create,
};

export default BattleStateMachine;
