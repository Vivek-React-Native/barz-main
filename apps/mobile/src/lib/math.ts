export const round = (n: number, places: number = 0) => {
  const multiplier = Math.pow(10, places);
  return Math.round(n * multiplier) / multiplier;
};
