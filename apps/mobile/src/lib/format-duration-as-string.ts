import { Duration } from 'date-fns';

export default function formatDurationAsString(duration: Duration) {
  let result: Array<string> = [];
  let showSeconds = true;
  let showMinutes = true;
  let showHours = true;

  if (duration.years) {
    result.push(`${duration.years}y`);
    showSeconds = false;
    showMinutes = false;
    showHours = false;
  }
  if (duration.months) {
    result.push(`${duration.months}M`);
    showSeconds = false;
    showMinutes = false;
    showHours = false;
  }
  if (duration.weeks) {
    result.push(`${duration.weeks}w`);
    showSeconds = false;
    showMinutes = false;
    showHours = false;
  }
  if (duration.days) {
    result.push(`${duration.days}d`);
    showSeconds = false;
    showMinutes = false;
  }
  if (showHours && duration.hours) {
    result.push(`${duration.hours}h`);
    showSeconds = false;
  }
  if (showMinutes && duration.minutes) {
    result.push(`${duration.minutes}m`);
    showSeconds = false;
  }
  if (showSeconds && duration.seconds) {
    result.push(`${duration.seconds}s`);
  }

  return result.join(' ');
}
