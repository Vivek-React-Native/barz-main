import { useEffect, useState } from 'react';

export const formatSeconds = (seconds: number) => {
  if (seconds < 0) {
    // This case should never happen
    return `${Math.round(seconds)}`;
  } else if (seconds < 10) {
    return `0:0${Math.round(seconds)}`;
  } else if (seconds < 60) {
    return `0:${Math.round(seconds)}`;
  } else {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${Math.round(seconds % 60)}`;
  }
};

export const useCountdownSeconds = (
  startAtSeconds: number,
  enabled: boolean = true,
): [number, boolean] => {
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setCountdownSeconds(null);
      return;
    }

    let intervalId: NodeJS.Timer | null = null;
    setCountdownSeconds(startAtSeconds);

    intervalId = setInterval(() => {
      setCountdownSeconds((value) => {
        if (typeof value === 'number') {
          return value - 1;
        } else {
          return null;
        }
      });
    }, 1000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setCountdownSeconds(null);
    };
  }, [startAtSeconds, setCountdownSeconds, enabled]);

  if (countdownSeconds === null) {
    return [0, false];
  } else if (countdownSeconds < 0) {
    return [0, true];
  } else {
    return [countdownSeconds, countdownSeconds === 0];
  }
};
