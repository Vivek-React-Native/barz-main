const MockPusher = require('./mock-pusher');

// Detox doesn't have as many features as something like cypress, it's a bit more of a "build your
// own custom stack" sort of option.
// ref: https://wix.github.io/Detox/docs/guide/mocking/#quick-flow
//
// This MockNetInfo logic implements a mechanism for the test runner to be able to remotely turn
// on and off the internet connection of the mobile app. This is critical to permit simulating users
// going into a subway tunnel or otherwise loosing internet connection during a battle.
//
// The way this works is by utilizing the MockPusher implementation to send special socket.io events
// to a custom mocked implementation of the @barz/barz-twilio-video library. The "other half" of
// this mocked implementation can be found in `apps/mobile/src/lib/use-net-info.detox.ts`.
const MockNetInfo = {
  async changeNetInfo(data) {
    if (!MockPusher.io) {
      return;
    }
    MockPusher.io.emit('change-net-info', data);
  },
};

module.exports = MockNetInfo;
