import * as React from 'react';
import { useState, useEffect } from 'react';
import './App.css';
import { ReactSortable as Sortable } from "react-sortablejs";
import Button from './ui/Button';
import TextField from './ui/TextField';
import * as Icons from './ui/icons';
import * as Tokens from './ui/tokens';
import classnames from 'classnames';

import styles from './index.module.css';

import { v4 as uuidv4 } from 'uuid';

type Player = {
  id: string;
  name: string;
  score: number;
}

// const K_FACTOR = 32;
const K_FACTOR = 20;
const EXPONENT_BASE = 10;
const EXPONENT_DENOMINATOR = 400;

const MIN_SCORE = 0;
const MAX_SCORE = 1000000;
function boundScore(score: number, constants: Constants = DEFAULT_CONSTANTS): number {
  if (constants.maxScore !== null && score > constants.maxScore) {
    return constants.maxScore;
  }
  if (constants.minScore !== null && score < constants.minScore) {
    return constants.minScore;
  }

  if (constants.roundPlaces === null) {
    return score;
  }

  const multiplier = Math.pow(10, constants.roundPlaces || 0);
  return Math.round(score * multiplier) / multiplier;
}

type Constants = {
  kFactor: number;
  exponentBase: number;
  exponentDenominator: number;
  minScore: number | null;
  maxScore: number | null;
  roundPlaces: number | null;
};
const CONSTANT_METADATA: { [key in keyof Constants]: [string, boolean] } = {
  kFactor: ['K Factor', false],
  exponentBase: ['Exponent Base', false],
  exponentDenominator: ['Exponent Denominator', false],
  minScore: ['Minimum Score', true],
  maxScore: ['Maximum Score', true],
  roundPlaces: ['Round score to this many places after each battle', true],
};

const DEFAULT_CONSTANTS: Constants = {
  kFactor: K_FACTOR,
  exponentBase: EXPONENT_BASE,
  exponentDenominator: EXPONENT_DENOMINATOR,
  minScore: null,
  maxScore: null,
  roundPlaces: null,
};

const Player = {
  create(name: string, score: number): Player {
    return {
      id: uuidv4(),
      name,
      score,
    };
  },

  // ref: https://mattmazzola.medium.com/understanding-the-elo-rating-system-264572c7a2b4
  computeProbabilityOfWinningAgainst(player: Player, opponent: Player, constants: Constants = DEFAULT_CONSTANTS) {
    const denominator = 1 + Math.pow(
      constants.exponentBase,
      (opponent.score - player.score) / constants.exponentDenominator
    );
    return 1 / denominator;
  },

  executeBattle(player: Player, opponent: Player, resultFromPlayerPerspective: number, constants: Constants = DEFAULT_CONSTANTS): [Player, Player] {
    const resultFromOpponentPerspective = 1 - resultFromPlayerPerspective;

    const playerProbability = Player.computeProbabilityOfWinningAgainst(player, opponent, constants);
    const playerChangeInScore = (constants.kFactor * (resultFromPlayerPerspective - playerProbability));
    const newPlayerScore = boundScore(player.score + playerChangeInScore, constants);

    const opponentProbability = Player.computeProbabilityOfWinningAgainst(opponent, player, constants);
    const opponentChangeInScore = (constants.kFactor * (resultFromOpponentPerspective - opponentProbability));
    const newOpponentScore = boundScore(opponent.score + opponentChangeInScore, constants);

    const newPlayer = { ...player, score: newPlayerScore };
    const newOpponent = { ...opponent, score: newOpponentScore };
    return [newPlayer, newOpponent];
  },
};

// const a = Player.create('a', 10);
// const b = Player.create('b', 10);

// console.log('INITIAL:')
// console.log(a, b);
//
// console.log('FINAL:')
// console.log(...Player.executeBattle(a, b, 1));



type PlayerBattle = {
  id: string;
  enabled: boolean;
  playerOneId: Player['id'] | null;
  playerTwoId: Player['id'] | null;
  result: number;
  playerOneScoreComputed?: number;
  playerTwoScoreComputed?: number;
};
const PlayerBattle = {
  create(
    playerOneId: Player['id'] | null,
    playerTwoId: Player['id'] | null,
    result: number,
  ): PlayerBattle {
    return { id: uuidv4(), enabled: true, playerOneId, playerTwoId, result };
  }
}



function NumberInput({
  value,
  onChange,
  ...props
}: any) {
  const [workingValue, setWorkingValue] = useState<string>(value);
  useEffect(() => setWorkingValue(`${value}`), [value]);
  return <TextField
    {...props}
    value={workingValue}
    onChange={e => setWorkingValue(e.currentTarget.value)}
    onBlur={() => {
      const result = parseFloat(workingValue);
      if (!isNaN(result)) {
        onChange(result);
      } else {
        setWorkingValue(`${value}`);
      }
    }}
    statusColor={!props.disabled && isNaN(parseFloat(workingValue)) ? Tokens.Color.Brand.Red : undefined}
  />;
}

function App() {
  const [players, setPlayers] = useState<Array<Player>>([]);
  const [battles, setBattles] = useState<Array<PlayerBattle>>([]);
  const [constants, setConstants] = useState<Constants>(DEFAULT_CONSTANTS);

  // Read and write to the querystring
  const [queryStringRead, setQueryStringRead] = useState(false);
  useEffect(() => {
    let url = new URL(window.location.href);
    let raw = url.hash.replace(/^\#/, '');
    if (!raw) {
      raw = url.search.replace(/^\?/, '');
    }
    const params = new URLSearchParams(raw);
    const players = params.get('players');
    if (players) {
      setPlayers(JSON.parse(players));
    }
    const battles = params.get('battles');
    if (battles) {
      setBattles(JSON.parse(battles));
    }
    const constants = params.get('constants');
    if (constants) {
      setConstants(JSON.parse(constants));
    }
    setQueryStringRead(true);
  }, []);
  useEffect(() => {
    if (!queryStringRead) {
      return;
    }
    var url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.replace(/^\#/, ''))
    params.set('players', JSON.stringify(players));
    params.set('battles', JSON.stringify(battles));
    params.set('constants', JSON.stringify(constants));
    url.hash = params.toString();
    url.search = ''; // Get rid of old url querystring based parameters, and move them to the hash
    window.history.pushState({}, '', url);
  }, [queryStringRead, players, battles, constants]);

  const intermediates = new Map<PlayerBattle['id'], Map<Player['id'], Player>>();
  const results = new Map<Player['id'], Player>();
  for (const player of players) {
    results.set(player.id, player);
  }

  let nextIntermediateResults = new Map<Player['id'], Player>(Array.from(results));
  for (const battle of battles) {
    intermediates.set(battle.id, nextIntermediateResults);

    if (!battle.enabled) {
      continue;
    }
    if (!battle.playerOneId || !battle.playerTwoId) {
      continue;
    }
    const player = results.get(battle.playerOneId);
    if (!player) {
      console.warn(`Unable to find player ${battle.playerOneId}, skipping battle ${battle.id}!`)
      continue
    }

    const opponent = results.get(battle.playerTwoId);
    if (!opponent) {
      console.warn(`Unable to find player ${battle.playerTwoId}, skipping battle ${battle.id}!`)
      continue
    }

    const [updatedPlayerOne, updatedPlayerTwo] = Player.executeBattle(player, opponent, battle.result, constants);

    results.set(battle.playerOneId, updatedPlayerOne);
    results.set(battle.playerTwoId, updatedPlayerTwo);

    const intermediateResults = new Map<Player['id'], Player>(Array.from(results));
    nextIntermediateResults = intermediateResults;
  }

  return (
    <div className="App">
      <h1>Constants</h1>
      <div className={styles.constants}>
        {Object.entries(constants).map(([key, value]) => {
          const [label, isNullable] = CONSTANT_METADATA[key as keyof typeof constants] as [string, boolean];
          if (isNullable) {
            return (
              <div key={key} className={styles.constant}>
                <strong>{label}:</strong>
                <input
                  checked={value === null}
                  type="radio"
                  onChange={() => setConstants({ ...constants, [key]: null })}
                /> No
                <input
                  checked={value !== null}
                  type="radio"
                  onChange={() => setConstants({ ...constants, [key]: '' })}
                /> Yes
                <NumberInput
                  width={100}
                  disabled={value === null}
                  value={value === null ? '' : value}
                  onChange={(newValue: number) => setConstants({ ...constants, [key]: newValue })}
                />
              </div>
            );
          } else {
            return (
              <div key={key} className={styles.constant}>
                <strong>{label}:</strong>
                <NumberInput
                  width={100}
                  value={value}
                  onChange={(newValue: number) => setConstants({ ...constants, [key]: newValue })}
                />
              </div>
            );
          }
        })}
      </div>
      <h1>Players</h1>
      <div className={styles.appBar}>
        <Button
          type="primaryAccent"
          onClick={() => {
            setPlayers([...players, Player.create('', 0)])
          }}
          leading={color => <Icons.Plus color={color} />}
        >Add Player</Button>
      </div>
      <br />
      <br />
      <div className={styles.playerList}>
        {players.map(player => (
          <div key={player.id} className={styles.player}>
            <div className={styles.playerFormFields}>
              Name: <TextField
                size={26}
                type="boxOutline"
                value={player.name}
                onChange={e => {
                  setPlayers(players.map(
                    p => p.id === player.id ? { ...p, name: e.currentTarget.value } : p
                  ));
                }}
              />
              Initial Score: <NumberInput
                size={26}
                type="boxOutline"
                value={player.score}
                onChange={(newScore: number) => {
                  setPlayers(players.map(
                    p => p.id === player.id ? { ...p, score: newScore } : p
                  ));
                }}
              />
            </div>

            <Button
              onClick={() => {
                setPlayers(players.filter(p => p.id !== player.id))

                // When deleting a player, clear any battle associations
                setBattles(battles.map(
                  b => b.playerOneId === player.id ? { ...b, playerOneId: null } : b
                ).map(
                  b => b.playerTwoId === player.id ? { ...b, playerTwoId: null } : b
                ));
              }}
              leading={color => <Icons.Close size={16} color={color} />}
              color={Tokens.Color.Brand.Red}
              size={26}
              width={26}
            />
          </div>
        ))}
      </div>

      <h1>Battles</h1>
      <p style={{...Tokens.Typography.Body1, lineHeight: 1.5, width: 800, margin: '0px auto', textAlign: 'left'}}>
        A result of <code>1</code> means that the first battler won, and a result of <code>0</code> means that the second battler won.
        Values in between allow one to indicate an output somewhere in between (ie, <code>0.5</code> is a draw)
      </p>
      <br />
      <br />
      <div className={styles.appBar}>
        <Button
          type="primaryAccent"
          onClick={() => {
            setBattles([...battles, PlayerBattle.create(null, null, 0)])
          }}
          leading={color => <Icons.Plus color={color} />}
        >Add Battle</Button>

        {battles.some(b => typeof b.playerOneScoreComputed !== 'undefined' || typeof b.playerTwoScoreComputed !== 'undefined') ? (
          <div className={styles.computedDataNote}>
            <div className={styles.computedDataNoteInner}>
              <span>
                Computed Player Data
                <Icons.Check size={12} color={Tokens.Color.Green.Dark11}/>
                <Icons.Warning size={12} color={Tokens.Color.Red.Dark11}/>
              </span>
              <span>The actual data that was generated when these scores were tabulated on the server</span>
            </div>
            <Button
              size={20}
              type="primary"
              onClick={() => {
                setBattles(battles => battles.map(b => {
                  const newB = { ...b };
                  delete newB.playerOneScoreComputed;
                  delete newB.playerTwoScoreComputed;
                  return newB;
                }));
              }}
              leading={color => <Icons.Close size={16} color={color} />}
            >Clear</Button>
          </div>
        ) : null}
      </div>
      <br />
      <br />
      <div className={styles.battleList}>
        <Sortable
          list={battles}
          setList={setBattles}
        >
          {battles.map((battle, index) => (
            <div key={battle.id} className={styles.battle}>
              <div className={styles.battleResults}>
                {Array.from(intermediates.get(battle.id) || new Map()).map(([playerId, player]) => {
                  let strike = false;
                  let actual: React.ReactNode = null;
                  if (battle.playerOneId === playerId) {
                    actual = battle.playerOneScoreComputed;
                    if (typeof battle.playerOneScoreComputed !== 'undefined' && battle.playerOneScoreComputed !== player.score) {
                      strike = true;
                    }
                  }
                  if (battle.playerTwoId === playerId) {
                    actual = battle.playerTwoScoreComputed;
                    if (typeof battle.playerTwoScoreComputed !== 'undefined' && battle.playerTwoScoreComputed !== player.score) {
                      strike = true;
                    }
                  }

                  return (
                    <div key={playerId} className={styles.battleResult}>
                      <div className={styles.battleResultName}>{player.name}</div>
                      <div className={classnames(styles.battleResultScore, { [styles.strike]: strike })}>
                        {player.score}
                      </div>
                      {actual ? (
                        <div
                          className={styles.battleResultScoreActual}
                          style={{ color: strike ? Tokens.Color.Red.Dark11 : Tokens.Color.Green.Dark11 }}
                        >
                          {actual}
                          {strike ? (
                            <Icons.Warning size={12} color="currentColor" />
                          ) : (
                            <Icons.Check size={12} color="currentColor" />
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className={styles.battleRow}>
                <div className={styles.battleFormFields}>
                  <div className={styles.battleIndex} title={battle.id}>
                    {index+1}) {battle.id.slice(-3)}
                  </div>

                  <select
                    style={{
                      height: 32,
                      border: `1px solid ${Tokens.Color.Gray.Dark7}`,
                      color: 'white',
                      backgroundColor: 'transparent',
                      outlineColor: `${Tokens.Color.Gray.Dark9}`,
                      borderRadius: 2,
                      paddingLeft: 8,
                      paddingRight: 8,
                    }}
                    value={battle.playerOneId || 'null'}
                    onChange={e => {
                      setBattles(battles.map(
                        b => b.id === battle.id ? { ...b, playerOneId: e.target.value } : b
                      ));
                    }}
                  >
                    <option value="null">No player selected</option>
                    {players.map(p => (
                      <option key={p.id} disabled={p.id === battle.playerTwoId} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <span className={styles.versus}>vs</span>

                  <select
                    style={{
                      height: 32,
                      border: `1px solid ${Tokens.Color.Gray.Dark7}`,
                      color: 'white',
                      backgroundColor: 'transparent',
                      outlineColor: `${Tokens.Color.Gray.Dark9}`,
                      borderRadius: 2,
                      paddingLeft: 8,
                      paddingRight: 8,
                    }}
                    value={battle.playerTwoId || 'null'}
                    onChange={e => {
                      setBattles(battles.map(
                        b => b.id === battle.id ? { ...b, playerTwoId: e.target.value } : b
                      ));
                    }}
                  >
                    <option value="null">No player selected</option>
                    {players.map(p => (
                      <option key={p.id} disabled={p.id === battle.playerOneId} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <span className={styles.versus}>results in</span>
                  <NumberInput
                    type="boxOutline"
                    value={battle.result}
                    onChange={(newResult: number) => {
                      setBattles(battles.map(
                        p => p.id === battle.id ? { ...p, result: newResult } : p
                      ));
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    type={battle.enabled ? "primary" : "text"}
                    onClick={() => {
                      setBattles(battles.map(
                        b => b.id === battle.id ? { ...b, enabled: !battle.enabled } : b
                      ));
                    }}
                    leading={color => (
                      battle.enabled ? <Icons.EyeOpen size={16} color={color} /> : <Icons.EyeClosed size={16} color={color} />
                    )}
                    color={battle.enabled ? Tokens.Color.Brand.Blue : Tokens.Color.Gray.Dark8}
                    size={26}
                    width={26}
                  />
                  <Button
                    onClick={() => setBattles(battles.filter(p => p.id !== battle.id))}
                    leading={color => <Icons.Close size={16} color={color} />}
                    color={Tokens.Color.Brand.Red}
                    size={26}
                    width={26}
                  />
                </div>
              </div>
            </div>
          ))}
        </Sortable>
      </div>

      <h1>Results</h1>
      <div className={styles.resultsList}>
        <div className={styles.battleResults}>
          {Array.from(results).map(([id, player]) => (
            <div key={id} className={styles.battleResult}>
              <div className={styles.battleResultName}>{player.name}</div>
              <div className={styles.battleResultScore}>{player.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
