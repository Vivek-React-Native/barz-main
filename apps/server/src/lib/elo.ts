type Constants = {
  kFactor: number;
  exponentBase: number;
  exponentDenominator: number;
  minScore: number | null;
  maxScore: number | null;
  roundPlaces: number | null;
};

// from: https://www.notion.so/breadco/Clout-Score-M2-e2f27370dbcb466b8a50e88b9cdd8007
export const DEFAULT_CONSTANTS: Constants = {
  kFactor: 24_500,
  exponentBase: 10,
  exponentDenominator: 235_294,
  minScore: 1000,
  maxScore: null,
  roundPlaces: 0,
};

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

const Elo = {
  // ref: https://mattmazzola.medium.com/understanding-the-elo-rating-system-264572c7a2b4
  computeProbabilityOfWinningAgainst(
    playerScore: number,
    opponentScore: number,
    constants: Constants = DEFAULT_CONSTANTS,
  ) {
    const denominator =
      1 +
      Math.pow(
        constants.exponentBase,
        (opponentScore - playerScore) / constants.exponentDenominator,
      );
    return 1 / denominator;
  },

  // When called, simulates a match between the player and opponent, and returns the updated scores
  // taking into account the results of the match.
  executeMatch(
    playerScore: number,
    opponentScore: number,
    resultFromPlayerPerspective: number,
    constants: Constants = DEFAULT_CONSTANTS,
  ): [number, number] {
    const resultFromOpponentPerspective = 1 - resultFromPlayerPerspective;

    const playerProbability = Elo.computeProbabilityOfWinningAgainst(
      playerScore,
      opponentScore,
      constants,
    );
    const playerChangeInScore =
      constants.kFactor * (resultFromPlayerPerspective - playerProbability);
    const newPlayerScore = boundScore(playerScore + playerChangeInScore, constants);

    const opponentProbability = Elo.computeProbabilityOfWinningAgainst(
      opponentScore,
      playerScore,
      constants,
    );
    const opponentChangeInScore =
      constants.kFactor * (resultFromOpponentPerspective - opponentProbability);
    const newOpponentScore = boundScore(opponentScore + opponentChangeInScore, constants);

    return [newPlayerScore, newOpponentScore];
    // const newPlayer = { ...player, score: newPlayerScore };
    // const newOpponent = { ...opponent, score: newOpponentScore };
    // return [newPlayer, newOpponent];
  },
};

export default Elo;
