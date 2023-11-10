const puppeteer = require('puppeteer');
const MockPusher = require('./mock-pusher');
const delay = require('./delay');

const MockWebOAuthSession = {
  async initialize(onReady) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    let closed = false;

    // Listen for 'open-web-auth-session' messages to be sent from the app
    const pagePromise = new Promise((resolve) => {
      const onOpenWebAuthSession = async ({ externalVerificationRedirectURL }) => {
        if (closed) {
          return;
        }
        // When a message is received, go to the web auth url
        await page.goto(externalVerificationRedirectURL);

        // And pass the page back through to the caller
        resolve(page);
      };

      // Listen for connections on all existing sockets
      for (const [_id, socket] of Array.from(MockPusher.io.sockets.sockets)) {
        socket.on('open-web-auth-session', onOpenWebAuthSession);
      }
      // And also on any new sockets
      MockPusher.io.sockets.on('connection', (socket) => {
        socket.on('open-web-auth-session', onOpenWebAuthSession);
      });
    });

    await onReady(() => pagePromise);

    // Let the app know once the auth process has been completed
    MockPusher.io.emit('web-auth-session-complete', {
      error: null,
      type: 'success',
      url: 'barz://oauth-redirect#',
    });

    // Once the the auth request has been processed, close the web browser
    await browser.close();
    closed = true;
  },

  // When called with a puppeteer page instance, this function signs in to a google login page with
  // the given email and password.
  //
  // NOTE: this function relies on the structure of the google login page's html. This is by nature
  // something that is kinda finicky and which could change in the future. There isn't really (as
  // far as I can tell) though a way to avoid this, and it's likely this function will need to be
  // adapted in the future if the google login page changes substantially.
  async performSignInToGoogleLoginPage(page, email, password) {
    const emailBox = await page.waitForSelector('input[type=email]');
    await emailBox.type(email, { delay: 20 });

    const nextButton = await page.waitForSelector('::-p-text(Next)');
    await nextButton.click();

    await delay(5000);

    const passwordBox = await page.waitForSelector('input[type=password]');
    await passwordBox.type(password, { delay: 20 });

    const completeButton = await page.waitForSelector('::-p-text(Next)');
    await completeButton.click();

    await delay(5000);

    // This `jscontroller` attribute seems to be present on the body of the google sign in form
    //
    // FIXME: It's definitely a hueristic though and something that will probably break in the
    // future.
    await page.waitForFunction(() => !document.querySelector('body[jscontroller]'));
  },
};

module.exports = MockWebOAuthSession;
