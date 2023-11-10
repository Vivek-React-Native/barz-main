import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Environment from './environment';

const Cache = {
  async get(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const SecureCache = {
  async get(key: string) {
    try {
      return AsyncStorage.getItem(key);
    } catch (err) {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      return AsyncStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  },
};

// Used by Clerk to manage the access token
export const TokenCache = {
  async getToken(key: string) {
    return SecureCache.get(key);
  },
  async saveToken(key: string, value: string) {
    return SecureCache.set(key, value);
  },
};

// Stores whether "developer mode" has been enabled for the app
//
// This screen controls whether the user can access a number of developer only settings, like
// changing the environment, clearing the video cache, etc.
export const DeveloperModeCache = {
  async isEnabled(): Promise<boolean> {
    const result = await Cache.get('developer-mode-enabled');
    if (!result) {
      return false;
    }
    return result.toLowerCase() === 'true';
  },
  async setEnabled(enabled: boolean) {
    return Cache.set('developer-mode-enabled', enabled ? 'true' : 'false');
  },
};

// Stores the environment that is currently active - production, staging, local, or custom
//
// This allows a user to change which set fo backend api hosts (barz api, as well as clerk) the app
// is talking to!
export const EnvironmentCache = {
  async getActiveEnvironment(): Promise<Environment> {
    const result = await Cache.get('environment');
    if (!result) {
      return Environment.PRODUCTION;
    }
    try {
      return JSON.parse(result);
    } catch (err) {
      console.log(`Error parsing environment in asyncstorage: ${err}`);
      return Environment.PRODUCTION;
    }
  },
  async setActiveEnvironment(environment: Environment) {
    return Cache.set('environment', JSON.stringify(environment));
  },
};

// Stores which status alerts have been shown to the user
//
// This ensures that the app doesn't show alerts more than once.
export const StatusAlertCache = {
  async getShownStatusAlertIds(): Promise<Array<number>> {
    const result = await Cache.get('shown-status-alert-ids');
    if (!result) {
      return [];
    }
    try {
      return JSON.parse(result);
    } catch (err) {
      console.log(`Error parsing shown-status-alert-ids in asyncstorage: ${err}`);
      return [];
    }
  },
  async setShownStatusAlertIds(shownStatusAlertIds: Array<number>) {
    return Cache.set('shown-status-alert-ids', JSON.stringify(shownStatusAlertIds));
  },
};

// Stores whether the debug menu is visible in the battle viewer
export const BattleViewerDebugCache = {
  async getDebugMenuVisible() {
    const result = await Cache.get('battle-viewer-debug-menu-visible');
    if (!result) {
      return false;
    }
    return result.toLowerCase() === 'true';
  },
  async setDebugMenuVisible(enabled: boolean) {
    return Cache.set('battle-viewer-debug-menu-visible', enabled ? 'true' : 'false');
  },
};

// Stores whether certain options are visible on the battle maching screen
export const BattleMatchingModeDebugCache = {
  // Stores whether the "random" battle matching mode is visible
  async getRandomMatchModeEnabled() {
    const result = await Cache.get('battle-matching-random-enabled');
    if (!result) {
      return false;
    }
    return result.toLowerCase() === 'true';
  },
  async setRandomMatchModeEnabled(enabled: boolean) {
    return Cache.set('battle-matching-random-enabled', enabled ? 'true' : 'false');
  },

  // Stores whether "test video call" is an enabled option on the matching page
  async getTestVideoCallEnabled() {
    const result = await Cache.get('battle-matching-test-video-call-enabled');
    if (!result) {
      return false;
    }
    return result.toLowerCase() === 'true';
  },
  async setTestVideoCallEnabled(enabled: boolean) {
    return Cache.set('battle-matching-test-video-call-enabled', enabled ? 'true' : 'false');
  },
};

// Stores the most recent home feed view that the user had visible - either following or trending
export const BattleViewerActiveFeedCache = {
  async getActiveFeed(): Promise<'FOLLOWING' | 'TRENDING'> {
    const result = await Cache.get('battle-viewer-active-page');
    if (result === 'FOLLOWING' || result === 'TRENDING') {
      return result;
    } else {
      return 'TRENDING';
    }
  },
  async setActiveFeed(page: 'FOLLOWING' | 'TRENDING') {
    return Cache.set('battle-viewer-active-page', page);
  },
};
