import { io } from 'socket.io-client';
import { PACKAGER_IP_ADDRESS } from './environment';

import delay from './delay';

console.log(
  'Loaded src/lib/open-web-auth-session.detox.tsx! This should never happen in production.',
);

// This mock version of `openWebAuthSession` allows the detox test runner to intercept the app
// opening the web auth session and instead allow the detox test runner to handle the web browser
// interactions, since those aren't something that can be controlled in detox on ios
//
// For the other half of this logic that runs in the test runner, see e2e/utils/MockSignIn.js
export default async (externalVerificationRedirectURL: string, oauthRedirectUrl: string) => {
  return new Promise((resolve) => {
    // Step 1: Connect to the socket.io server running on the test runner
    const socket = io(`ws://${PACKAGER_IP_ADDRESS}:8001`);
    socket.on('connect', async () => {
      // Step 2: Send a message to tell it that a web auth session has been created
      socket.emit('open-web-auth-session', { externalVerificationRedirectURL, oauthRedirectUrl });

      // Step 3: Wait for the session to complete
      socket.once('web-auth-session-complete', resolve);
    });
  });
};
