import { Fragment, useEffect } from 'react';
import { View } from 'react-native';
import { useSignIn, useAuth, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { io } from 'socket.io-client';

import { PACKAGER_IP_ADDRESS } from '../../lib/environment';

console.log(
  'Loaded src/features/onboarding/imperative-login-in-test.detox.tsx! This should never happen in production.',
);

// Implements a version of the TokenCache that communicates with the detox test runner and allows
// the test runner to programatically determine if the app is logged in or out when the test starts
export default () => {
  const { signOut } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    signOut();
  }, [signOut]);

  useEffect(() => {
    const socket = io(`ws://${PACKAGER_IP_ADDRESS}:8001`);

    const onSignIn = async (data: any) => {
      console.log('Imperative sign in attempted through detox:', data);
      if (!isLoaded) {
        return;
      }
      const completeSignIn = await signIn.create(data);
      await setActive({ session: completeSignIn.createdSessionId });
    };

    socket.on('signin', onSignIn);
    return () => {
      socket.off('signin', onSignIn);
    };
  }, [signIn, setActive]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Fragment>
      <View testID="imperative-log-in-test-ready"></View>
      <SignedIn>
        {/* <View testID="imperative-log-in-test-signed-in"><Text>signed in</Text></View> */}
        <View testID="imperative-log-in-test-signed-in"></View>
      </SignedIn>
      <SignedOut>
        {/* <View testID="imperative-log-in-test-signed-out"><Text>signed out</Text></View> */}
        <View testID="imperative-log-in-test-signed-out"></View>
      </SignedOut>
    </Fragment>
  );
};
