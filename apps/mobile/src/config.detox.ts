import { NativeModules } from 'react-native';
import url from 'url';

// ref: https://stackoverflow.com/a/53949973/4115328
export const PACKAGER_IP_ADDRESS = url.parse(NativeModules.SourceCode.scriptURL).hostname;
if (!PACKAGER_IP_ADDRESS) {
  throw new Error('Unable to determine Packager IP address!');
}

// This ensures that locally stored environment values do not override clerk
export const FORCE_USE_PRODUCTION_VALUES = true;

// This is a key for the "Barz Detox" clerk instance which overrides the regular key when in test
// mode
export const PRODUCTION_CLERK_PUBLISHABLE_KEY =
  'pk_test_c3R1bm5pbmctcmFjY29vbi02MC5jbGVyay5hY2NvdW50cy5kZXYk';
export const LOCAL_CLERK_PUBLISHABLE_KEY = '';
export const STAGING_CLERK_PUBLISHABLE_KEY = '';

// When testing the app with detox, all communication should occur with the local system
export const PRODUCTION_BARZ_SERVER_BASE_URL = `http://${PACKAGER_IP_ADDRESS}:8005`;
export const STAGING_BARZ_SERVER_BASE_URL = '';

// This key is used to connect to the "barz-development" pusher channels project
export const PRODUCTION_PUSHER_API_KEY = 'd571378fb96492762463';
export const STAGING_PUSHER_API_KEY = '';
export const LOCAL_PUSHER_API_KEY = '';
