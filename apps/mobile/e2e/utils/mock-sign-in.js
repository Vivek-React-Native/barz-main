const clerk = require('@clerk/clerk-sdk-node');
const { waitFor, element, by } = require('detox');

// NOTE: To generate the ID that is used in this test, I:
// 1. Made a new Clerk instance called "Barz Detox"
// 2. I created a new user.
// 3. I made the email `ryan+detox@bread.works` and the password `detox`
// 4. I made the username `barzdetoxtest`
// 5. I verified the email sent to my real email to make sure the user was set up
// 6. I added a phone number and verified the phone number
// 7. I set this user to have this unsafeMetadata value: { "rapperName": "Barz Detox Test", "rapperNameChangedFromDefault": true, "avatarImageUploaded": true, "battleIntroSlideshowViewed": true, "defaultRapperNameViewed": true }
const CLERK_DETOX_USER_ID = 'user_2UiUKZRHgQrPnGVYvFARoNHDCVQ';

const MockSignIn = {
  // This google account has been created exclusively for the purpose of usage in detox tests for
  // this project. It's used to test creating a barz account associated with a third party oauth
  // provider. I have been treating these credentials as throwaway - there is nothing in this
  // account of value.
  //
  // If for some reason these credentials stop working / you need new ones:
  // 1. Go to google.com
  // 2. Click "sign in" in the upper right
  // 3. Click "create account" and then "personal"
  // 4. Go through the workflow steps, and paste the credentials below
  MOCK_GOOGLE_ACCOUNT_EMAIL: 'barzdetox@gmail.com',
  MOCK_GOOGLE_ACCOUNT_PASSWORD: 'barzdetox123',

  async signInAsDetoxMockUser() {
    const MockPusher = require('./mock-pusher');

    // Wait for the impperative log in component to load, which sets up event handlers for the
    // `signin` event
    await waitFor(element(by.id('imperative-log-in-test-ready')))
      .toExist()
      .withTimeout(5_000);

    // Generate an actor token, which allows the app to log in programatically
    // Think of this value like a one time use token that can be used instead of a SMS OTP code
    // More info: https://clerk.com/docs/authentication/user-impersonation
    const response = await fetch('https://api.clerk.com/v1/actor_tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: CLERK_DETOX_USER_ID,
        actor: { sub: CLERK_DETOX_USER_ID },
        expires_in_seconds: 99999999999,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Unable to get actor token from clerk: ${response.status} ${await response.text()}`,
      );
    }
    const body = await response.json();
    const token = body.token;

    // Send the actor token to the app to let it log in
    MockPusher.io.emit('signin', {
      strategy: 'ticket',
      ticket: token,
    });

    // Wait for the impperative log in component to indicate that the log in was successful
    await waitFor(element(by.id('imperative-log-in-test-signed-in')))
      .toExist()
      .withTimeout(5_000);
  },

  async getDetoxMockUserFromClerk() {
    return clerk.users.getUser(CLERK_DETOX_USER_ID);
  },

  async getUserFromClerkByPhoneNumber(phoneNumber) {
    const users = await clerk.users.getUserList({ phoneNumber: [phoneNumber] });
    if (users.length === 0) {
      return null;
    } else {
      return users[0];
    }
  },

  async getUserFromClerkByEmailAddress(emailAddress) {
    const users = await clerk.users.getUserList({ emailAddress: [emailAddress] });
    if (users.length === 0) {
      return null;
    } else {
      return users[0];
    }
  },

  async deleteUsersWithUsernameFromClerk(username) {
    const users = await clerk.users.getUserList({ username: [username] });

    for (const user of users) {
      await clerk.users.deleteUser(user.id);
    }

    console.log(`Deleted ${users.length} user(s) from clerk associated with username ${username}`);
  },

  async deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber) {
    const users = await clerk.users.getUserList({ phoneNumber: [phoneNumber] });

    for (const user of users) {
      await clerk.users.deleteUser(user.id);
    }

    console.log(
      `Deleted ${users.length} user(s) from clerk associated with phone number ${phoneNumber}`,
    );
  },

  async deleteUsersAssociatedWithEmailFromClerk(emailAddress) {
    const users = await clerk.users.getUserList({ emailAddress: [emailAddress] });

    for (const user of users) {
      await clerk.users.deleteUser(user.id);
    }

    console.log(`Deleted ${users.length} user(s) from clerk associated with email ${emailAddress}`);
  },
};

module.exports = MockSignIn;
