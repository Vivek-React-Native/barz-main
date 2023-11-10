const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const { createHttpTerminator } = require('http-terminator');

const loadFixture = require('./load-fixture');
const delay = require('./delay');

// Detox doesn't have as many features as something like cypress, it's a bit more of a "build your
// own custom stack" sort of option.
//
// This MockBarzServer implementation mirrors the cy.intercept functionality from cypress. It
// creates an express web server, lets the user define a bunch of mock responses, and uses these to
// mock out states in the app.
const MockBarzServer = {
  app: null,
  server: null,
  isStopping: false,

  mockData: new Map(),

  init() {
    if (this.app) {
      this.stop();
    }

    this.app = express();
    this.app.use(bodyParser.json());
  },
  async start() {
    return new Promise((resolve) => {
      if (!this.app) {
        this.init();
      }

      this.server = this.app.listen(parseInt(process.env.PORT || '8005', 10), () => {
        resolve();
      });
    });
  },
  async stop() {
    if (!this.server) {
      return;
    }

    if (this.isStopping) {
      throw new Error('Stopping MockBarzServer is already in progress!');
    }
    this.isStopping = true;

    const terminator = createHttpTerminator({ server: this.server });
    await terminator.terminate();

    this.isStopping = false;
    this.server = null;
  },
  deinit() {
    if (this.server) {
      this.stop();
    }

    this.app = null;
  },
  async reset() {
    await this.stop();
    this.deinit();
    this.init();
  },

  async intercept(...args) {
    let method = null,
      url = null,
      mockResponse = null;
    switch (args.length) {
      case 1:
        method = 'GET';
        url = args[0];
        break;
      case 2:
      case 3:
        method = args[0];
        url = args[1];
        if (args[2]) {
          if (typeof args[2] === 'string') {
            // Filepath to mock response
            mockResponse = { statusCode: 200, body: await loadFixture(args[2]), calls: [] };
          } else if (typeof args[2].statusCode !== 'undefined') {
            mockResponse = { ...args[2], calls: [] };
          } else {
            // Otherwise, assume a static json response
            mockResponse = { statusCode: 200, body: args[2], calls: [] };
          }
        }
        break;
    }

    const existingData = this.mockData.get(url) || new Map();
    existingData.set(method, mockResponse);
    this.mockData.set(url, existingData);

    // Dynamically create request on the test server
    this.app[method.toLowerCase()](url, (req, res) => {
      const existingData = this.mockData.get(url);
      if (existingData) {
        const mockResponse = existingData.get(method);
        if (mockResponse) {
          mockResponse.calls.push({ calledAt: new Date(), req });
          res.status(mockResponse.statusCode).send(mockResponse.body);
          return;
        }
      }

      res.status(404).end();
    });
  },

  async clearStoredRequests() {
    for (const [url, outerValue] of Array.from(this.mockData)) {
      for (const [method, value] of Array.from(outerValue)) {
        value.calls = [];
      }
    }
  },

  async waitForRequest(method, url, filterCallback = null, timeoutMilliseconds = 12000) {
    // Check to see if the api call has already been made, and if so, bail out early
    const existingData = this.mockData.get(url);
    if (existingData) {
      const mockResponse = existingData.get(method);
      if (mockResponse.calls.length > 0) {
        return mockResponse.calls[0];
      }
    }

    const delayMilliseconds = 250;
    const iterationCount = Math.ceil(timeoutMilliseconds / delayMilliseconds);

    for (let i = 0; i < iterationCount; i += 1) {
      await delay(delayMilliseconds);

      const existingData = this.mockData.get(url);
      if (existingData) {
        const mockResponse = existingData.get(method);
        for (const data of mockResponse.calls) {
          if (filterCallback ? filterCallback(data) : true) {
            return data;
          }
        }
      }
    }

    throw new Error(
      `Barz Server API call ${method} ${url}${
        filterCallback ? ` that passed filter ${filterCallback.toString()}` : ''
      } was not made within ${timeoutMilliseconds} ms!`,
    );
  },
};

beforeAll(() => {
  MockBarzServer.init();
});

afterEach(async () => {
  await MockBarzServer.clearStoredRequests();
  await MockBarzServer.stop();
});

afterAll(() => {
  MockBarzServer.deinit();
});

module.exports = MockBarzServer;
