export const FORCE_USE_PRODUCTION_VALUES = false;

// "ryan@bread.works" Organization -> "Barz" Application
export const LOCAL_CLERK_PUBLISHABLE_KEY =
  'pk_test_d2lubmluZy1raXR0ZW4tMTkuY2xlcmsuYWNjb3VudHMuZGV2JA';

// "Barz" Organization -> "Barz Staging" Application
export const STAGING_CLERK_PUBLISHABLE_KEY =
  'pk_test_dml0YWwtc3RhcmZpc2gtNjUuY2xlcmsuYWNjb3VudHMuZGV2JA';

// "Barz" Organization -> "Barz" Application
export const PRODUCTION_CLERK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsucmFwYmF0dGxlYXBwLmNvbSQ';

export const PRODUCTION_BARZ_SERVER_BASE_URL = 'https://api.rapbattleapp.com';
export const STAGING_BARZ_SERVER_BASE_URL = 'https://api-staging.rapbattleapp.com';

// "barz-production" pusher channels project
export const PRODUCTION_PUSHER_API_KEY = 'fdb53787c1f97a4562ee';

// "barz-staging" pusher channels project
export const STAGING_PUSHER_API_KEY = 'bed8369648771e1dee9c';

// "barz-development" pusher channels project
export const LOCAL_PUSHER_API_KEY = 'ab4f85cc714fe7dc1134';

// Links to the app store to support the app telling you that you need to upgrade
export const ANDROID_PLAYSTORE_DEEP_LINK = 'TODO';
export const IOS_APPSTORE_DEEP_LINK = 'TODO';

export const SENTRY_DSN =
  'https://ab7e2c46aabd4e3e8fe53c1898cbaed3@o4505432667979776.ingest.sentry.io/4505432671715328';

// When this phone number is entered, log into the demo clerk account for the selected environment
// if possible
export const DEMO_PHONE_NUMBER = '+15555551234';

// For now, facebook auth will be disabled in production because Luke has not set up the legal
// paperwork required for Barz to join the Meta Business Account program. More info on what is
// required: https://madebybread.slack.com/archives/C04RFG9S1B7/p1697204258103399.
//
// Once this is done, facebook should function in the production barz environment.
export const FACEBOOK_AUTH_ENABLED = false;
