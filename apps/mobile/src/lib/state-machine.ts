import { StateMachine, Interpreter } from 'xstate';
import { Battle, BattleParticipant } from './api';

// FIXME: import this type from the server package!
export type BattleStateMachineEvent =
  | { type: 'MOVE_TO_NEXT_PARTICIPANT'; uuid: string }
  | { type: 'MOVE_TO_NEXT_ROUND'; uuid: string }
  | { type: 'BATTLE_COMPLETE'; uuid: string };

// FIXME: import this type from the server package!
export type BattleStateMachineTypestate =
  | { value: 'CREATED'; context: BattleStateMachineContext }
  | { value: 'COIN_TOSS'; context: BattleStateMachineContext }
  | { value: 'READY'; context: BattleStateMachineContext }
  | { value: 'WARM_UP'; context: BattleStateMachineContext }
  | { value: 'BATTLE'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_NEXT_BATTLER'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_NEXT_ROUND'; context: BattleStateMachineContext }
  | { value: 'SUMMARY'; context: BattleStateMachineContext }
  | { value: 'TRANSITION_TO_SUMMARY'; context: BattleStateMachineContext }
  | { value: 'COMPLETE'; context: BattleStateMachineContext };

// FIXME: import this type from the server package!
export type BattleStateMachineContext = {
  version: 1;
  battleId: Battle['id'];

  activeRoundIndex: number;
  totalNumberOfRounds: number;

  currentParticipantIndex: number;
  participantIds: Array<BattleParticipant['id']>;

  nextMessageUuid: string | null;
  acknowlegedMessageUuids: Array<string>;
};

// FIXME: import this type from the server package!
export type BattleStateMachine = StateMachine<
  BattleStateMachineContext,
  any,
  BattleStateMachineEvent,
  BattleStateMachineTypestate
>;

// FIXME: import this type from the server package!
export type BattleStateMachineInterpreter = Interpreter<
  BattleStateMachineContext,
  any,
  BattleStateMachineEvent,
  BattleStateMachineTypestate,
  any
>;
