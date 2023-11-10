const MockPusher = require('./mock-pusher');
const delay = require('./delay');

// Detox doesn't have as many features as something like cypress, it's a bit more of a "build your
// own custom stack" sort of option.
// ref: https://wix.github.io/Detox/docs/guide/mocking/#quick-flow
//
// This MockTwilioVideo logic implements a mechanism for the test runner to be able to remotely mock
// twilio video's natice logic to test edge cases within the react native mobile code.
//
// The way this works is by utilizing the MockPusher implementation to send special socket.io events
// to a custom mocked implementation of the @barz/barz-twilio-video library. The "other half" of
// this mocked implementation can be found in `packages/barz-twilio-video/src/indexDetox.tsx`.
const MockTwilioVideo = {
  imperativeFunctionCalls: new Map(),

  async start() {
    if (!MockPusher.io) {
      return;
    }

    await MockTwilioVideo.clearStoredImperativeFunctionCalls();

    // When function call messages are received, cache them locally so that assertions can use them
    // later on
    const onMessage = (data) => {
      const listOfFunctionCalls = this.imperativeFunctionCalls.get(data.functionName) || [];
      this.imperativeFunctionCalls.set(data.functionName, [...listOfFunctionCalls, data]);
    };

    const onNewSocket = (socket) => {
      socket.on('twilio-video-function-call', onMessage);
    };

    // Listen for connections on all existing sockets
    for (const [_id, socket] of Array.from(MockPusher.io.sockets.sockets)) {
      socket.on('twilio-video-function-call', onMessage);
    }
    // And also on any new sockets
    MockPusher.io.sockets.on('connection', onNewSocket);
  },

  async stop() {
    // Remove all event handlers when the test run is complete
    //
    // This includes the ones defined in `MockTwilioVideo.start`, since those
    // are never explicitly removed.
    for (const [id, socket] of Array.from(MockPusher.io.sockets.sockets)) {
      socket.removeAllListeners('twilio-video-function-call');
    }
    MockPusher.io.removeAllListeners('connection');
  },

  // When called, this simulates the native code sending an event to the javascript code. An
  // example of an event could be "roomDidConnect", "participantAddedVideoTrack", etc.
  //
  // These event names are defined in the native code - for example, refer to
  // `packages/barz-twilio-video/ios/BarzTwilioVideoModule.swift`.
  //
  // Also, as a rule of thumb - the react prop name is the event name prefixed with `on`:
  // roomDidConnect => onRoomDidConnect, etc
  async publishEvent(eventName, eventPayload) {
    if (!MockPusher.io) {
      return;
    }
    MockPusher.io.emit('twilio-video-event', {
      eventName,
      eventPayload,
    });
  },

  // When called, this function clears all the locally cached imperative function calls that have
  // been made in the past. This "wipes the slate clean" so that assertions won't apply to function
  // calls made in the past.
  //
  // Optionally, specify function names to clear as arguments, and ONLY calls to these imperative
  // functions will be cleared.
  async clearStoredImperativeFunctionCalls(...functionNames) {
    for (const [key, value] of Array.from(this.imperativeFunctionCalls)) {
      if (functionNames.length > 0 && !functionNames.includes(key)) {
        continue;
      }
      this.imperativeFunctionCalls.delete(key);
    }
  },

  // When called, intercepts the twilio video function call, and allows a custom return value to be
  // defined. This works very similarly to `MockBarzServer.intercept` or something like `mock.patch`
  // in python.
  //
  // Resolves a function that when called, will stop intercepting function calls.
  async interceptImperativeFunctionCall(functionName, callback) {
    if (!MockPusher.io) {
      return;
    }

    const onMessage = (data) => {
      if (data.functionName !== functionName) {
        return;
      }

      callback(data.args)
        .then((result) => {
          MockPusher.io.emit(`twilio-video-function-call-response-${data.id}`, result);
        })
        .catch((error) => {
          console.error(`Error processing twilio function call ${data}: ${error}`);
        });
    };

    const onNewSocket = (socket) => {
      socket.on('twilio-video-function-call', onMessage);
    };

    // Listen for connections on all existing sockets
    for (const [id, socket] of Array.from(MockPusher.io.sockets.sockets)) {
      socket.on('twilio-video-function-call', onMessage);
    }
    // And also on any new sockets
    MockPusher.io.sockets.on('connection', onNewSocket);

    return () => {
      // And similarly, unsubscribe from existing sockets, and don't add the event listener to
      // future sockets
      for (const [id, socket] of Array.from(MockPusher.io.sockets.sockets)) {
        socket.off('twilio-video-function-call', onMessage);
      }
      MockPusher.io.off('connection', onNewSocket);
    };
  },

  // When called, waits up to `timeoutMilliseconds` for an imperative function with the given name
  // to be called, optionally funltering futher by specifying a list of arguments that pass the
  // `argsMatchingCallback` function.
  //
  // If the impoerative function is not called within `timeoutMilliseconds`, this function will
  // return a rejecting promise / reject with an error.
  async waitForImperativeFunctionCall(
    functionName,
    argsMatchingCallback = () => true,
    timeoutMilliseconds = 5000,
  ) {
    // Check to see if the function call has already been made, and if so, bail out early
    const existingData = this.imperativeFunctionCalls.get(functionName);
    if (existingData) {
      if (existingData.length > 0) {
        const data = existingData[0];
        if (argsMatchingCallback(data.args)) {
          return data;
        }
      }
    }

    let initialCallCount = 0;
    // const initialCallCount = (() => {
    //   const existingData = this.imperativeFunctionCalls.get(functionName);
    //   if (!existingData) {
    //     return 0;
    //   }
    //   return existingData.length;
    // })();

    const delayMilliseconds = 250;
    const iterationCount = Math.ceil(timeoutMilliseconds / delayMilliseconds);

    for (let i = 0; i < iterationCount; i += 1) {
      await delay(delayMilliseconds);

      const existingData = this.imperativeFunctionCalls.get(functionName);
      if (existingData) {
        if (existingData.length > initialCallCount) {
          initialCallCount = existingData.length;
          for (const data of existingData) {
            if (argsMatchingCallback(data.args)) {
              return data;
            }
          }
        }
      }
    }

    throw new Error(
      `Twilio Video Imperative function ${functionName} was not called in an accepted way after ${timeoutMilliseconds} ms!`,
    );
  },
};

beforeEach(async () => {
  await MockTwilioVideo.start();
});

afterEach(async () => {
  await MockTwilioVideo.stop();
});

module.exports = MockTwilioVideo;
