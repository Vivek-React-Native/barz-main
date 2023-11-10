import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';

import useAppState from '@barz/mobile/src/lib/use-app-state';

export const ExpoUpdatesDisallowContext = React.createContext<null | ((key: string) => () => void)>(
  null,
);

// Communicates with Expo Updates, a managed expo service for over the air updates to expo based
// mobile apps, and whenever the user backgrounds their app, automatically fetches the latest code
// from EAS and runs it.
const ExpoUpdatesManager: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const appState = useAppState();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [disallowedUpdateKeys, setDisallowedUpdateKeys] = useState<Array<string>>([]);

  const onFetchUpdateAsync = useCallback(async () => {
    if (__DEV__) {
      return;
    }

    let update;
    try {
      update = await Updates.checkForUpdateAsync();
    } catch (error) {
      console.error('Error calling Updates.checkForUpdateAsync() :', error);
      return;
    }

    if (update.isAvailable) {
      try {
        await Updates.fetchUpdateAsync();
      } catch (error) {
        console.error('Error calling Updates.fetchUpdateAsync() :', error);
        return;
      }
      setUpdateAvailable(true);
    }
  }, [setUpdateAvailable]);

  useEffect(() => {
    if (__DEV__) {
      return;
    }
    if (appState !== 'background') {
      return;
    }
    if (disallowedUpdateKeys.length !== 0) {
      return;
    }

    try {
      if (updateAvailable) {
        Updates.reloadAsync();
      }
    } catch (err) {
      console.error('Error while reloading the app', err);
    }

    onFetchUpdateAsync();
  }, [disallowedUpdateKeys, appState, onFetchUpdateAsync, updateAvailable]);

  // When called, allows a region of the application to disable expo-updates while inside.
  // The function that is returned can then be called to undo this lock.
  //
  // This mainly exists so that updates won't happen while a user is battling.
  const disableUpdatesInRegionOfApp = useCallback(
    (key: string) => {
      setDisallowedUpdateKeys((old) => [...old, key]);
      return () => {
        setDisallowedUpdateKeys((old) => old.filter((item) => item !== key));
      };
    },
    [setDisallowedUpdateKeys],
  );

  return (
    <ExpoUpdatesDisallowContext.Provider value={disableUpdatesInRegionOfApp}>
      {children}
    </ExpoUpdatesDisallowContext.Provider>
  );
};

export default ExpoUpdatesManager;
