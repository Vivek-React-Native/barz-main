import { NativeModules } from 'react-native';
import url from 'url';
import {
  FORCE_USE_PRODUCTION_VALUES,
  PRODUCTION_CLERK_PUBLISHABLE_KEY,
  STAGING_CLERK_PUBLISHABLE_KEY,
  LOCAL_CLERK_PUBLISHABLE_KEY,
  PRODUCTION_BARZ_SERVER_BASE_URL,
  STAGING_BARZ_SERVER_BASE_URL,
  PRODUCTION_PUSHER_API_KEY,
  STAGING_PUSHER_API_KEY,
  LOCAL_PUSHER_API_KEY,
} from '../config';

type Environment =
  | { type: 'PRODUCTION' }
  | { type: 'STAGING' }
  | {
      type: 'LOCAL';
      barzServerHost: string;
      barzServerPort: string;
      clerkPublishableKey: string;
      pusherKey: string;
    }
  | {
      type: 'CUSTOM';
      barzServerBaseUrl: string;
      clerkPublishableKey: string;
      pusherKey: string;
    };

// ref: https://stackoverflow.com/a/53949973/4115328
export const PACKAGER_IP_ADDRESS = url.parse(NativeModules.SourceCode.scriptURL).hostname;

const Environment = {
  PRODUCTION: { type: 'PRODUCTION' as const },
  STAGING: { type: 'STAGING' as const },

  createLocal(
    host: string = PACKAGER_IP_ADDRESS || '',
    port: number = 8000,
    clerkPublishableKey: string = LOCAL_CLERK_PUBLISHABLE_KEY,
    pusherKey: string = LOCAL_PUSHER_API_KEY,
  ) {
    return {
      type: 'LOCAL' as const,
      barzServerHost: `${host}`,
      barzServerPort: `${port}`,
      clerkPublishableKey,
      pusherKey,
    };
  },
  createCustom(
    barzServerBaseUrl: string = '',
    clerkPublishableKey: string = '',
    pusherKey: string = '',
  ) {
    return {
      type: 'CUSTOM' as const,
      barzServerBaseUrl,
      clerkPublishableKey,
      pusherKey,
    };
  },
};

export default Environment;

export const generateBarzAPIBaseUrl = (environment: Environment) => {
  if (FORCE_USE_PRODUCTION_VALUES) {
    return PRODUCTION_BARZ_SERVER_BASE_URL;
  }

  switch (environment.type) {
    case 'PRODUCTION':
      return PRODUCTION_BARZ_SERVER_BASE_URL;
    case 'STAGING':
      return STAGING_BARZ_SERVER_BASE_URL;
    case 'LOCAL':
      return `http://${environment.barzServerHost}:${environment.barzServerPort}`;
    case 'CUSTOM':
      return environment.barzServerBaseUrl;
  }
};

export const generateClerkPublishableKey = (environment: Environment) => {
  if (FORCE_USE_PRODUCTION_VALUES) {
    return PRODUCTION_CLERK_PUBLISHABLE_KEY;
  }

  switch (environment.type) {
    case 'PRODUCTION':
      return PRODUCTION_CLERK_PUBLISHABLE_KEY;
    case 'STAGING':
      return STAGING_CLERK_PUBLISHABLE_KEY;
    case 'LOCAL':
    case 'CUSTOM':
      return environment.clerkPublishableKey;
  }
};

export const generatePusherKey = (environment: Environment) => {
  if (FORCE_USE_PRODUCTION_VALUES) {
    return PRODUCTION_PUSHER_API_KEY;
  }

  switch (environment.type) {
    case 'PRODUCTION':
      return PRODUCTION_PUSHER_API_KEY;
    case 'STAGING':
      return STAGING_PUSHER_API_KEY;
    case 'LOCAL':
    case 'CUSTOM':
      return environment.pusherKey;
  }
};
