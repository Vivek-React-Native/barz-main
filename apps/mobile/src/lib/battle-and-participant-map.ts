import { BattleWithParticipants, BattleParticipant } from '@barz/mobile/src/lib/api';

// A BattleAndParticipantMap is a two level map, with the top level being a series of battle ids, and
// the inner level containing a series of participant ids. A BattleAndParticipantMap can map to
// any sort of metadata that is individual to a participant within a battle.
type BattleAndParticipantMap<T> = Map<
  BattleWithParticipants['id'],
  Map<BattleParticipant['id'], T>
>;

const BattleAndParticipantMap = {
  create<T>(): BattleAndParticipantMap<T> {
    return new Map();
  },

  has<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
  ): boolean {
    const participants = mapping.get(battleId);
    if (typeof participants === 'undefined') {
      return false;
    }

    return participants.has(participantId);
  },

  get<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
  ): T | null {
    const participants = mapping.get(battleId);
    if (typeof participants === 'undefined') {
      return null;
    }

    const result = participants.get(participantId);
    if (typeof result === 'undefined') {
      return null;
    }

    return result;
  },

  getOrDefault<T, D>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    defaultValue: D,
  ): T | D {
    const participants = mapping.get(battleId);
    if (typeof participants === 'undefined') {
      return defaultValue;
    }

    const result = participants.get(participantId);
    if (typeof result === 'undefined') {
      return defaultValue;
    }

    return result;
  },

  set<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    value: T,
  ): BattleAndParticipantMap<T> {
    const participants = mapping.get(battleId);

    let participantsCopy: Map<BattleParticipant['id'], T>;
    if (participants) {
      // Make a copy of the existing value found
      participantsCopy = new Map(participants);
    } else {
      // Make a new value, nothing has been stored under this value before!
      participantsCopy = new Map();
    }

    participantsCopy.set(participantId, value);

    const mappingCopy = new Map(mapping);
    mappingCopy.set(battleId, participantsCopy);
    return mappingCopy;
  },

  update<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    cb: (old: T) => T,
  ): BattleAndParticipantMap<T> {
    const participants = mapping.get(battleId);
    if (typeof participants === 'undefined') {
      return mapping;
    }
    const oldValue = participants.get(participantId);
    if (typeof oldValue === 'undefined') {
      return mapping;
    }

    let participantsCopy: Map<BattleParticipant['id'], T>;
    if (participants) {
      // Make a copy of the existing value found
      participantsCopy = new Map(participants);
    } else {
      // Make a new value, nothing has been stored under this value before!
      participantsCopy = new Map();
    }

    participantsCopy.set(participantId, cb(oldValue));

    const mappingCopy = new Map(mapping);
    mappingCopy.set(battleId, participantsCopy);
    return mappingCopy;
  },

  // Update the item, but don't do nothing if it doesn't exist
  upsert<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    cb: (old: T | undefined) => T,
  ): BattleAndParticipantMap<T> {
    const participants = mapping.get(battleId);

    let participantsCopy: Map<BattleParticipant['id'], T>;
    if (participants) {
      // Make a copy of the existing value found
      participantsCopy = new Map(participants);
    } else {
      // Make a new value, nothing has been stored under this value before!
      participantsCopy = new Map();
    }

    const oldValue = participantsCopy.get(participantId);
    participantsCopy.set(participantId, cb(oldValue));

    const mappingCopy = new Map(mapping);
    mappingCopy.set(battleId, participantsCopy);
    return mappingCopy;
  },

  delete<T>(
    mapping: BattleAndParticipantMap<T>,
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
  ): BattleAndParticipantMap<T> {
    const participants = mapping.get(battleId);

    let participantsCopy: Map<BattleParticipant['id'], T>;
    if (participants) {
      // Make a copy of the existing value found
      participantsCopy = new Map(participants);
    } else {
      // The value doesn't exist, so therefore the key to delete must not exist
      return mapping;
    }

    participantsCopy.delete(participantId);

    const mappingCopy = new Map(mapping);
    mappingCopy.set(battleId, participantsCopy);
    return mappingCopy;
  },
};

export default BattleAndParticipantMap;
