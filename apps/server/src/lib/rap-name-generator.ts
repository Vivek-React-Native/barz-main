import prisma from './prisma.ts';

const PREFIX_WORDS: Array<string> = [
  "Action",
  "Backpack",
  "Big",
  "Billionaire",
  "Childish",
  "Chilly",
  "Cold",
  "Docta",
  "Inspectah",
  "King",
  "Lil",
  "Money",
  "OG",
  "Poppa",
  "Queen",
  "Saucin",
  "Slim",
  "Trill",
  "Trippi",
  "Young",
];

const REST_WORDS: Array<string> = [
  'Assassin',
  'Bandit',
  'Bard',
  'Battle',
  'Beat',
  'Berserker',
  'Blaze',
  'Blazer',
  'Breaker',
  'Breakneck',
  'Butcher',
  'Cadence',
  'Champion',
  'Chorus',
  'Cipher',
  'Commander',
  'Conductor',
  'Conqueror',
  'Crusader',
  'Cyclone',
  'Cypher',
  'Eclipse',
  'Emcee',
  'Enigma',
  'Executioner',
  'Falcon',
  'Fighter',
  'Flamethrower',
  'Flow',
  'Forge',
  'Freestyle',
  'Frenzy',
  'Fury',
  'Gladiator',
  'Groove',
  'Lacerator',
  'Legionnaire',
  'Loomer',
  'Luminary',
  'Lyric',
  'Magician',
  'Magus',
  'Marauder',
  'Marksman',
  'Mauler',
  'Maverick',
  'Mercenary',
  'Metaphor',
  'Meter',
  'Metrical',
  'Mic',
  'Paladin',
  'Phenom',
  'Pioneer',
  'Punchline',
  'Punchline',
  'Raider',
  'Rampager',
  'Ranger',
  'Ranger',
  'Rap',
  'Raptor',
  'Reckoner',
  'Recluse',
  'Renegade',
  'Revolutionist',
  'Rhyme',
  'Rhythm',
  'Ripper',
  'Ritualist',
  'Rockstar',
  'Ronin',
  'Ruler',
  'Saboteur',
  'Samurai',
  'Scribe',
  'Sentinel',
  'Serpent',
  'Shogun',
  'Slam',
  'Slang',
  'Slayer',
  'Sniper',
  'Sorcerer',
  'Soundwave',
  'Sphinx',
  'Spitfire',
  'Synapse',
  'Vandal',
  'Vanguard',
  'Vendetta',
  'Verbal',
  'Verse',
  'Vigilante',
  'Viper',
  'Virtuoso',
  'Voyager',
  'Warchief',
  'Warlock',
  'Warrior',
  'Wizard',
  'Wordplay',
];

function randomWord(wordList=REST_WORDS) {
  return wordList[Math.round(Math.random() * wordList.length - 1)];
}

function randomWordExcluding(words: Array<string>, wordList=REST_WORDS) {
  let word = randomWord(wordList);
  while (words.includes(word)) {
    word = randomWord(wordList);
  }
  return word;
}

function generateName(numberOfWords = 3) {
  let nameParts = [];
  for (let i = 0; i < numberOfWords; i += 1) {
    const wordList = i === 0 ? PREFIX_WORDS : REST_WORDS;
    const part = randomWordExcluding(nameParts, wordList);
    nameParts.push(part);
  }
  return nameParts.join(' ');
}

export default async function generateNameNotAlreadyInUsersTable(numberOfWords = 2) {
  let name = generateName(numberOfWords);
  let suffixNumber: number | null = null;

  while (true) {
    const assembledName = `${name}${suffixNumber !== null ? ` ${suffixNumber}` : ''}`;
    const matchingUser = await prisma.user.findFirst({ where: { name: assembledName } });
    if (!matchingUser) {
      return assembledName;
    }

    if (suffixNumber) {
      suffixNumber += 1;
    } else {
      suffixNumber = 1;
    }
  }
}
