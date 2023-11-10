import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Text, SafeAreaView } from 'react-native';

import { EnvironmentCache } from '@barz/mobile/src/lib/cache';
import Environment from '@barz/mobile/src/lib/environment';

export const EnvironmentContext = React.createContext<
  [Environment, (newEnvironment: Environment) => Promise<void>]
>([Environment.PRODUCTION, () => Promise.reject()]);

export const EnvironmentProvider: React.FunctionComponent<{
  children: (environment: Environment) => React.ReactNode;
}> = ({ children }) => {
  const [environment, setEnvironment] = useState<Environment | null>(null);

  useEffect(() => {
    const promise = EnvironmentCache.getActiveEnvironment();
    promise.then((env) => setEnvironment(env));
    promise.catch((err) => {
      console.log(`Error loading environment for clerk, defaulting to production: ${err}`);
      setEnvironment(Environment.PRODUCTION);
    });
  }, [setEnvironment]);

  const onChangeEnvironment = useCallback(
    async (newEnvironment: Environment) => {
      await EnvironmentCache.setActiveEnvironment(newEnvironment);
      setEnvironment(newEnvironment);
    },
    [setEnvironment],
  );

  const contextData = useMemo(() => {
    return [environment, onChangeEnvironment] as [
      Environment,
      (newEnvironment: Environment) => Promise<void>,
    ];
  }, [environment, onChangeEnvironment]);

  if (!environment) {
    return (
      <SafeAreaView style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading environment...</Text>
      </SafeAreaView>
    );
  }

  return (
    <EnvironmentContext.Provider value={contextData}>
      {children(environment)}
    </EnvironmentContext.Provider>
  );
};
export default EnvironmentProvider;
