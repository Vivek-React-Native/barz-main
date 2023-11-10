import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const useAppState = () => {
  const [appState, setAppState] = useState(AppState.currentState);
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    },
    [setAppState],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription.remove();
  }, [appState, handleAppStateChange]);

  return appState;
};

export default useAppState;
