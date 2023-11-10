const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const MockSignIn = require('./mock-sign-in');

// Detox doesn't have as many features as something like cypress, it's a bit more of a "build your
// own custom stack" sort of option.
// ref: https://wix.github.io/Detox/docs/guide/mocking/#quick-flow
//
// This `MockPusher` utility mirrors the pusher interface over a local socket.io connection. When
// initialized, a local web server is started up on port `8001`.
//
// The react native app build server then is started with the DETOX_ENABLED=true environment
// variable, which causes `src/pusher.detox.tsx` to be loaded in the place of `src/pusher.tsx`. This
// alternate implementation of the pusher logic mocks out pusher to talk to this local socket.io
// connection.
//
// When `MockPusher.publish` is called in the test, it sends a message to the socket.io client in
// the app, which exposes the message through the regular pusher interface.
const MockPusher = {
  app: null,
  server: null,
  io: null,
  isStopping: false,

  init() {
    if (this.app) {
      this.stop();
    }

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);
  },
  async start() {
    return new Promise((resolve) => {
      if (!this.server || !this.app) {
        this.init();
      }

      this.server.listen(parseInt(process.env.SOCKETS_PORT || '8001', 10), () => {
        resolve();
      });
    });
  },
  async stop() {
    if (!this.server) {
      return;
    }

    return new Promise(async (resolve) => {
      if (this.isStopping) {
        throw new Error('Stopping MockPusher is already in progress!');
      }
      this.isStopping = true;

      // Disconnect all in flight socket.io connections before terminating the http server
      for (const [id, socket] of Array.from(this.io.sockets.sockets)) {
        socket.disconnect();
      }

      this.server.close(() => {
        this.isStopping = false;
        this.server = null;
        resolve();
      });
    });
  },
  deinit() {
    if (this.server) {
      this.stop();
    }

    this.app = null;
    this.io = null;
  },
  async reset() {
    await this.stop();
    this.deinit();
    this.init();
  },

  async publish(channelName, eventName, data) {
    this.io.emit(channelName, {
      channelName,
      eventName,
      data: JSON.stringify(data),
      userId: undefined,
    });
  },
};

beforeAll(() => {
  MockPusher.init();
});

beforeEach(async () => {
  await MockPusher.start();
});

afterEach(async () => {
  await MockPusher.stop();
});

afterAll(() => {
  MockPusher.deinit();
});

module.exports = MockPusher;
