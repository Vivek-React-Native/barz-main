// The amount of time that a user must be offline before they automatically forfeit the battle
export const TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS = 10_000;

// The amount of time that a user can be on the opponent matching page, at max.
export const TWILIO_VIDEO_BATTLE_MATCHING_PAGE_MAX_TIME_MILLISECONDS = 30_000;

// The amount of time that a user can be on the challenge public private page, at max
export const TWILIO_VIDEO_BATTLE_CHALLGNE_PUBLIC_PRIVATE_MAX_TIME_MILLISECONDS = 15_000;

// The amount of time that a user can be on the summary page, at max. This is in place to attempt to
// ensure that a user cannot keep a twilio video call open for an infinitely long amount of time
// once the battle has completed.
export const TWILIO_VIDEO_BATTLE_SUMMARY_PAGE_MAX_TIME_MILLISECONDS = 30_000;

// The time in between attempted reconnects when the twilio video session disconnects
export const TWILIO_VIDEO_RECONNECT_INTERVAL_MILLISECONDS = 2_000;
