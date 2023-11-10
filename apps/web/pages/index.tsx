import { Fragment, createContext, useContext, useState, useEffect } from 'react';
import Head from 'next/head';
import colorToRgba from 'color-rgba';
import colorAlpha from 'color-alpha';
import {
  gray,
  blue,
  red,
  green,
  yellow,
  purple,
  pink,
  cyan,
} from '@radix-ui/colors';

import { BarzAPI, BattleWithParticipantsAndCheckinsAndEvents } from '@barz/mobile/src/lib/api';

const round = (value: number, places: number = 0) => {
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
};

const WIDTH_PX = 800;
const OUTER_PADDING_X_PX = 4;
const PARTICIPANT_TRACK_HEIGHT_PX = 72;
const TIME_LEGEND_HEIGHT_PX = 28;
const TIME_LEGEND_MIN_DISTANCE_BETWEEN_TICKS_SECONDS = 5;
const TIME_LEGEND_AFTER_BATTLE_COMPLETE_SCALE_PADDING_SECONDS = 2;

const STATE_TO_COLOR = {
  "WARM_UP": blue.blue5,
  "BATTLE": blue.blue7,
  "TRANSITION_TO_NEXT_BATTLER": purple.purple3,
  "WAITING": yellow.yellow4,
  "TRANSITION_TO_SUMMARY": purple.purple7,
};
const STATE_TO_HATCHED = {
  "WARM_UP": false,
  "BATTLE": false,
  "TRANSITION_TO_NEXT_BATTLER": false,
  "WAITING": true,
  "TRANSITION_TO_SUMMARY": false,
};

// Given a series of checkins, generate a series of ranges of time that the system was in each state
function generateStateChanges(
  checkins: BattleWithParticipantsAndCheckinsAndEvents['participants'][0]['checkins'],
  battleCompletedAt: Date,
) {
  return checkins.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt)).map((checkin, index) => {
    let nextCheckin = checkins[index+1];
    return {
      from: new Date(checkin.checkedInAt),
      to: nextCheckin ? new Date(nextCheckin.checkedInAt) : battleCompletedAt,
      state: checkin.state,
      context: checkin.context,
    };
  });
}

function generateTextColor(bgColor: string) {
  const [hexR, hexG, hexB] = colorToRgba(bgColor);

  // Gets the average value of the colors
  const contrastRatio = (hexR + hexG + hexB) / (255 * 3);

  return contrastRatio >= 0.5
      ? 'black'
      : 'white';
}


const GraphContext = createContext<{
  battle: BattleWithParticipantsAndCheckinsAndEvents;
  tracksHeightInPx: number;
  widthInPx: number;
  heightInPx: number;

  battleCreatedAt: Date;
  battleStartedAt: Date;
  battleCompletedAt: Date;
  battleLengthInMilliseconds: number;

  xPixelsPerSecond: number;
} | null>(null);

function FullHeightLine({timestamp, color, dashed}: {timestamp: Date, color: string, dashed?: boolean}) {
  const graphContext = useContext(GraphContext);
  if (!graphContext) {
    throw new Error('GraphContext data is not defined!');
  }

  const position = (
    timestamp.getTime() - new Date(graphContext.battleCreatedAt).getTime()
  ) * graphContext.xPixelsPerSecond;

  return (
    <line
      x1={position}
      y1={0}
      x2={position}
      y2={graphContext.tracksHeightInPx}
      strokeWidth={1}
      stroke={color}
      strokeDasharray={dashed ? "2 2" : undefined}
    />
  );
}

function FullHeightEvent({sourceIndex, timestamp, color, dashed}: {sourceIndex: number, timestamp: Date, color: string, dashed?: boolean}) {
  const graphContext = useContext(GraphContext);
  if (!graphContext) {
    throw new Error('GraphContext data is not defined!');
  }

  const topSpacingInPx = 24;

  const position = (
    timestamp.getTime() - new Date(graphContext.battleCreatedAt).getTime()
  ) * graphContext.xPixelsPerSecond;

  const circleY = topSpacingInPx + ((PARTICIPANT_TRACK_HEIGHT_PX - topSpacingInPx) / 2);

  return (
    <g transform={`translate(${position},${sourceIndex * PARTICIPANT_TRACK_HEIGHT_PX})`}>
      {sourceIndex === 0 ? (
        <g>
          <line
            x1={0}
            y1={circleY}
            x2={0}
            y2={circleY + PARTICIPANT_TRACK_HEIGHT_PX - 16}
            strokeWidth={1}
            stroke={gray.gray12}
          />
          <path
            transform={`translate(0,${circleY + PARTICIPANT_TRACK_HEIGHT_PX - 16})`}
            d={`M-8,0 L8,0 L0,8 L-8,0 L0,0`}
            fill={color}
            strokeWidth={1}
            stroke={gray.gray12}
          />
        </g>
      ) : (
        <g>
          <line
            x1={0}
            y1={circleY}
            x2={0}
            y2={circleY - PARTICIPANT_TRACK_HEIGHT_PX + 16}
            strokeWidth={1}
            stroke={gray.gray12}
          />
          <path
            transform={`translate(0,${circleY - PARTICIPANT_TRACK_HEIGHT_PX + 16})`}
            d={`M-8,0 L8,0 L0,-8 L-8,0 L0,0`}
            fill={color}
            strokeWidth={1}
            stroke={gray.gray12}
          />
        </g>
      )}
      <circle
        cx={0}
        cy={circleY}
        r={4}
        fill={color}
        strokeWidth={2}
        stroke={gray.gray12}
      />
    </g>
  );
}

function Line({timestamp, color, dashed}: {timestamp: Date, color: string, dashed?: boolean}) {
  const graphContext = useContext(GraphContext);
  if (!graphContext) {
    throw new Error('GraphContext data is not defined!');
  }

  const position = (
    timestamp.getTime() - new Date(graphContext.battleCreatedAt).getTime()
  ) * graphContext.xPixelsPerSecond;

  return (
    <line
      x1={position}
      y1={0}
      x2={position}
      y2={PARTICIPANT_TRACK_HEIGHT_PX}
      strokeWidth={1}
      stroke={color}
      strokeDasharray={dashed ? "2 2" : undefined}
    />
  );
}

function Region({start, end, color, hatched, label}: {start: Date, end: Date, color: string, hatched?: boolean, label?: string}) {
  const graphContext = useContext(GraphContext);
  if (!graphContext) {
    throw new Error('GraphContext data is not defined!');
  }
  const topSpacingInPx = 24;

  const startPosition = (
    start.getTime() - new Date(graphContext.battleCreatedAt).getTime()
  ) * graphContext.xPixelsPerSecond;

  const endPosition = (
    end.getTime() - new Date(graphContext.battleCreatedAt).getTime()
  ) * graphContext.xPixelsPerSecond;

  const hatchId = `hatch-${start.getTime()}-${end.getTime()}`;
  const clipId = `clip-${start.getTime()}-${end.getTime()}`;
  const textId = `text-${start.getTime()}-${end.getTime()}`;

  return (
    <g transform={`translate(${startPosition},${topSpacingInPx})`}>
      {hatched ? (
        <pattern id={hatchId} width="9" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect x="0" y="0" width="3" height="1" fill={color} />
          <rect x="3" y="0" width="9" height="1" fill="white" />
        </pattern>
      ) : null}
      <rect
        x={0}
        y={0}
        width={endPosition - startPosition}
        height={PARTICIPANT_TRACK_HEIGHT_PX - topSpacingInPx}
        fill={hatched ? `url(#${hatchId})` : color}
      />
      {label ? (
        <Fragment>
          <clipPath id={clipId}>
            <rect
              x={0}
              y={0}
              width={endPosition - startPosition}
              height={PARTICIPANT_TRACK_HEIGHT_PX - topSpacingInPx}
            />
          </clipPath>
          <g id={textId}>
            <text
              transform={`translate(4,${PARTICIPANT_TRACK_HEIGHT_PX - topSpacingInPx - 6})`}
              fill={generateTextColor(color)}
            >{label}</text>
          </g>
          <use clipPath={`url(#${clipId})`} href={`#${textId}`} fill="red" />
        </Fragment>
      ) : null}
    </g>
  );
}

export default function Web() {
  // const battleId = "clh875dq1009gpk2jm087fnug";
  // const battleId = "clh6wvk3m000gpkdnw1h40ldd";

  const [battle, setBattle] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | { status: "COMPLETE", battle: BattleWithParticipantsAndCheckinsAndEvents }
    | { status: "ERROR", error: Error }
  >({status: "IDLE"});

  let [workingBattleId, setWorkingBattleId] = useState<string>('');
  let [battleId, setBattleId] = useState<string | null>(null);
  useEffect(() => {
    setWorkingBattleId(localStorage.battleId);
    setBattleId(localStorage.battleId || null);
  }, []);

  useEffect(() => {
    if (!battleId) {
      return;
    }

    setBattle({ status: "LOADING" });
    const intervalId = setInterval(() => {
      BarzAPI.getBattleById(battleId).then(battle => {
        setBattle({ status: "COMPLETE", battle });
      }).catch(error => {
        setBattle({ status: "ERROR", error });
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [battleId]);

  const latestBattleButton = (
    <div>
      <Head>
        <title>Battle Visualizer - {battleId}</title>
      </Head>
      <input
        type="text"
        value={workingBattleId}
        onChange={e => setWorkingBattleId(e.target.value)}
        onBlur={() => setBattleId(workingBattleId || null)}
      />
      <button
        onClick={() => {
          BarzAPI.getAllBattles().then(allBattles => {
            const latestBattle = allBattles.results[0];
            localStorage.battleId = latestBattle.id;
            setWorkingBattleId(latestBattle.id);
            setBattleId(latestBattle.id);
          });
        }}
      >Go to latest battle</button>
    </div>
  );

  switch (battle.status) {
    case "IDLE":
    case "LOADING":
      return (
        <div>
          {latestBattleButton}
          <br />
          Loading...
        </div>
      );
    case "ERROR":
      return (
        <div>
          {latestBattleButton}
          <br />
          Error: {battle.error.message}
        </div>
      );
    case "COMPLETE":
      const tracksHeightInPx = battle.battle.participants.length * PARTICIPANT_TRACK_HEIGHT_PX;
      const heightInPx = tracksHeightInPx + TIME_LEGEND_HEIGHT_PX;

      const battleCreatedAt = new Date(battle.battle.createdAt);
      const battleStartedAt = new Date(battle.battle.startedAt);
      const completion = battle.battle.completedAt || battle.battle.madeInactiveAt;
      const battleCompletedAt = completion ? new Date(completion) : new Date();
      const battleLengthInMilliseconds = (
        battleCompletedAt.getTime() - battleCreatedAt.getTime()
      ) + (TIME_LEGEND_AFTER_BATTLE_COMPLETE_SCALE_PADDING_SECONDS * 1000);

      const xPixelsPerSecond = WIDTH_PX / battleLengthInMilliseconds;

      const scale: Array<number> = [];
      const foo = Math.max(
        TIME_LEGEND_MIN_DISTANCE_BETWEEN_TICKS_SECONDS * 1000,
        battleLengthInMilliseconds / 5,
      );
      for (let i = 0; i < battleLengthInMilliseconds; i += foo) {
        scale.push(i);
      }

      return (
        <GraphContext.Provider value={{
          battle: battle.battle,
          tracksHeightInPx,
          widthInPx: WIDTH_PX,
          heightInPx,
          battleCreatedAt,
          battleStartedAt,
          battleCompletedAt,
          battleLengthInMilliseconds,
          xPixelsPerSecond,
        }}>
          <div>
            {latestBattleButton}
            <br />
            <svg
              width={WIDTH_PX + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX}
              height={heightInPx}
              viewBox={`0 0 ${WIDTH_PX + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX} ${heightInPx}`}
              style={{fontFamily: 'monospace'}}
            >
              <g transform={`translate(${OUTER_PADDING_X_PX},0)`}>
                {battle.battle.participants.map((participant, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <g key={participant.id} transform={`translate(0,${index * PARTICIPANT_TRACK_HEIGHT_PX})`}>
                      {/* background color */}
                      <rect
                        x={-1 * OUTER_PADDING_X_PX}
                        y={0}
                        width={WIDTH_PX + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX}
                        height={PARTICIPANT_TRACK_HEIGHT_PX}
                        fill={isEven ? 'white' : 'rgba(0,0,0,0.1)'}
                      />

                      {generateStateChanges(participant.checkins, battleCompletedAt).map(stateForRange => (
                        <Region
                          key={`${stateForRange.to.getTime()}`}
                          start={stateForRange.from}
                          end={stateForRange.to}
                          color={STATE_TO_COLOR[stateForRange.state] || 'silver'}
                          hatched={STATE_TO_HATCHED[stateForRange.state] || false}
                          label={stateForRange.state}
                        />
                      ))}

                      {participant.checkins.map(checkin => (
                        <Line
                          key={checkin.id}
                          timestamp={new Date(checkin.checkedInAt)}
                          color={red.red9}
                          dashed
                        />
                      ))}

                      <Line
                        timestamp={new Date(participant.associatedWithBattleAt)}
                        color={pink.pink8}
                      />

                      <Line
                        timestamp={new Date(participant.readyForBattleAt)}
                        color={cyan.cyan8}
                      />

                      {/* participant id */}
                      <text transform="translate(0,16)">{participant.id}</text>
                    </g>
                  );
                })}

                {/* Render a line where the battle starts and finishes */}
                {battle.battle.startedAt !== null ? (
                  <FullHeightLine
                    timestamp={battleStartedAt}
                    color={green.green8}
                  />
                ) : null}
                {battle.battle.completedAt !== null ? (
                  <FullHeightLine
                    timestamp={battleCompletedAt}
                    color={green.green8}
                  />
                ) : null}

                {battle.battle.stateMachineEvents.map(event => (
                  <FullHeightEvent
                    sourceIndex={battle.battle.participants.map(p => p.id).indexOf(event.triggeredByParticipantId)}
                    timestamp={new Date(event.createdAt)}
                    color={green.green8}
                  />
                ))}

                {/* Render the x scale along the bottom */}
                <g transform={`translate(0,${tracksHeightInPx})`}>
                  {scale.map((value, index) => (
                    <g
                      key={value}
                      transform={`translate(${value * xPixelsPerSecond},0)`}
                    >
                      <line x1={0} y1={0} x2={0} y2={6} strokeWidth={2} stroke="black" />
                      <text
                      textAnchor={index > 0 ? (index === scale.length-1 ? 'end' : 'middle') : 'start'}
                        transform={`translate(0,${TIME_LEGEND_HEIGHT_PX-4})`}
                        fontSize={16}
                    >{round(value / 1000)}s</text>
                    </g>
                  ))}
                </g>

                {/* If the battle has not completed, show that in the corner */}
                {battle.battle.completedAt === null && battle.battle.madeInactiveAt === null ? (
                  <g transform={`translate(${WIDTH_PX - 48},4)`}>
                    <rect x={0} y={0} width={48} height={24} fill="rgba(255,0,0,0.8)" rx={4} ry={4} />
                    <text transform="translate(9,16)" fill="white">LIVE</text>
                  </g>
                ) : null}
              </g>
            </svg>

            <pre>
              {JSON.stringify(battle, null, 2)}
            </pre>
          </div>
        </GraphContext.Provider>
      );
  }
}
