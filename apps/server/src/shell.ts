import repl from 'repl';

console.log(`> // Auto imports:`);

console.log(`> import prisma from './lib/prisma.ts';`);
import prisma from './lib/prisma.ts';
(global as any).prisma = prisma;

console.log(`> import Battle from './lib/battle.ts';`);
import Battle from './lib/battle.ts';
(global as any).Battle = Battle;

console.log(`> import BattleParticipant from './lib/battle-participant.ts';`);
import BattleParticipant from './lib/battle-participant.ts';
(global as any).BattleParticipant = BattleParticipant;

console.log(`> import User from './lib/user.ts';`);
import User from './lib/user.ts';
(global as any).User = User;

console.log(`> import BattleComment from './lib/battle-comment.ts';`);
import BattleComment from './lib/battle-comment.ts';
(global as any).BattleComment = BattleComment;

console.log(`> import Challenge from './lib/challenge.ts';`);
import Challenge from './lib/challenge.ts';
(global as any).Challenge = Challenge;

console.log(
  `> import { BeatsObjectStorage, RecordingsObjectStorage } from './lib/object-storage.ts';`,
);
import { BeatsObjectStorage, RecordingsObjectStorage } from './lib/object-storage.ts';
(global as any).BeatsObjectStorage = BeatsObjectStorage;
(global as any).RecordingsObjectStorage = RecordingsObjectStorage;

console.log('> // End auto imports');
const instance = repl.start();
instance.setupHistory('./.barz-shell-history', (error) => {
  if (error) {
    console.error('Error configuring repl history!', error);
  }
});
instance.addListener('close', () => {
  process.exit(0);
});
