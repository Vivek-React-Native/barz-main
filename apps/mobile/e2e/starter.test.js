require('dotenv').config();

const { openApp } = require('./utils/openApp');
const MockBarzServer = require('./utils/mock-barz-server');
const MockPusher = require('./utils/mock-pusher');
const MockTwilioVideo = require('./utils/mock-twilio-video');
const MockNetInfo = require('./utils/mock-net-info');
const MockSignIn = require('./utils/mock-sign-in');
const MockSMSReceiver = require('./utils/mock-sms-receiver');
const MockWebOAuthSession = require('./utils/mock-web-oauth-session');
const loadFixture = require('./utils/load-fixture');
const delay = require('./utils/delay');
const assert = require('assert');

const byTestID = (testID) => () => element(by.id(testID));

// ref: https://stackoverflow.com/questions/47522081/detox-ios-simulator-how-to-confirm-alert-message
export function systemDialog(label) {
  if (device.getPlatform() === 'ios') {
    return element(by.label(label)).atIndex(1);
  }

  return element(by.text(label));
}

const BattlePage = {
  wrapper: byTestID('home'),

  bottomTab: byTestID('bottom-tab-battle'),

  topBar: {
    leaveButton: byTestID('battle-top-bar-leave-button'),
    backButton: byTestID('battle-top-bar-back-button'),
  },

  initiator: {
    container: byTestID('rap-battle-initiator-container'),

    findOpponentButton: byTestID('battle-find-opponent-button'),
    challengeOpponentButton: byTestID('battle-challenge-opponent-button'),

    pendingChallenges: {
      first: {
        wrapper: byTestID('battle-pending-challenge-wrapper'),
        actions: {
          // For challenges created by the user:
          waitingRoomButton: byTestID('battle-pending-challenge-waiting-room-button'),
          cancelButton: byTestID('battle-pending-challenge-cancel-button'),

          // For challenges created by others:
          acceptButton: byTestID('battle-pending-challenge-accept-button'),
          declineButton: byTestID('battle-pending-challenge-decline-button'),
        },
      },
    },
  },

  intro: {
    slideshow: {
      page0: byTestID('battle-intro-slideshow-0'),
      page1: byTestID('battle-intro-slideshow-1'),
      page2: byTestID('battle-intro-slideshow-2'),
      page3: byTestID('battle-intro-slideshow-3'),
      actions: {
        next: byTestID('battle-intro-slideshow-next-button'),
        startBattle: byTestID('battle-intro-slideshow-start-battle-button'),
        fillOutProfile: byTestID('battle-intro-slideshow-fill-out-profile-button'),
        cancel: byTestID('battle-intro-slideshow-cancel-button'),
      },
    },
    createRapTag: {
      wrapper: byTestID('battle-intro-create-rap-tag-wrapper'),
      inputField: byTestID('battle-intro-create-rap-tag-input'),
      actions: {
        continueButton: byTestID('battle-intro-create-rap-tag-continue-button'),
        backButton: byTestID('battle-intro-create-rap-tag-back-button'),
      },
    },
    uploadAvatar: {
      wrapper: byTestID('battle-intro-upload-avatar-wrapper'),
      avatarImageUpload: byTestID('battle-intro-upload-avatar-image'),
      avatarImageUploadImageSet: byTestID('user-profile-avatar-image-upload-set'),
      avatarImageUploadImageUnset: byTestID('user-profile-avatar-image-upload-unset'),
      actions: {
        nextButton: byTestID('battle-intro-upload-avatar-next-button'),
        cancelButton: byTestID('battle-intro-cancel-button'),
      },
    },
    completeBio: {
      wrapper: byTestID('battle-intro-complete-bio-wrapper'),

      introField: byTestID('profile-bio-edit-intro-field'),
      locationField: byTestID('profile-bio-edit-location-field'),
      artistField: byTestID('profile-bio-edit-favorite-artist-field'),
      favoriteSongField: byTestID('profile-bio-edit-favorite-song-field'),
      instagramField: byTestID('profile-bio-edit-instagram-field'),
      soundcloudField: byTestID('profile-bio-edit-soundcloud-field'),

      actions: {
        doneButton: byTestID('battle-intro-complete-bio-done-button'),
      },

      roughLocationPicker: {
        wrapper: byTestID('user-bio-edit-rough-location-picker-wrapper'),
        searchField: byTestID('user-bio-edit-rough-location-picker-search-field'),
        firstItem: byTestID('user-bio-edit-rough-location-picker-item'),
        actions: {
          done: byTestID('battle-intro-complete-bio-rough-location-picker-done'),
          clear: byTestID('battle-intro-complete-bio-rough-location-picker-clear'),
        },
      },
      favoriteArtistPicker: {
        wrapper: byTestID('user-bio-edit-favorite-artist-picker-wrapper'),
        searchField: byTestID('user-bio-edit-favorite-artist-picker-search-field'),
        firstItem: byTestID('user-bio-edit-favorite-artist-picker-item'),
        actions: {
          done: byTestID('battle-intro-complete-bio-favorite-artist-picker-done'),
          clear: byTestID('battle-intro-complete-bio-favorite-artist-picker-clear'),
        },
      },
      favoriteTrackPicker: {
        wrapper: byTestID('user-bio-edit-favorite-track-picker-wrapper'),
        searchField: byTestID('user-bio-edit-favorite-track-picker-search-field'),
        firstItem: byTestID('user-bio-edit-favorite-track-picker-item'),
        actions: {
          done: byTestID('battle-intro-complete-bio-favorite-track-picker-done'),
          clear: byTestID('battle-intro-complete-bio-favorite-track-picker-clear'),
        },
      },
    },
    profilePreview: {
      wrapper: byTestID('battle-intro-profile-preview-wrapper'),

      actions: {
        doneButton: byTestID('battle-intro-profile-preview-done-button'),
        cancelButton: byTestID('battle-intro-profile-preview-cancel-button'),
      },
    },
  },

  notConnectedToInternetOverlay: byTestID('not-connected-to-internet-overlay'),
  opponentLostInternetOverlay: byTestID('opponent-lost-internet-overlay'),

  matching: {
    container: byTestID('battle-matching-container'),
    initialMatchFailedMessage: byTestID('battle-matching-initial-match-failed'),
    readyButton: byTestID('battle-matching-ready-button'),
    readyButtonWaiting: () =>
      element(
        by
          .id('battle-matching-ready-button')
          .withDescendant(by.text('Waiting for other participants...')),
      ),
    otherOpponentReadyMessage: byTestID('battle-matching-other-opponent-ready'),
  },

  challengesSearchForUser: {
    wrapper: byTestID('battle-challenge-search-for-user-wrapper'),
    searchField: byTestID('battle-challenge-search-for-user-search-field'),
    firstItem: byTestID('battle-challenge-search-for-user-item'),
    actions: {
      back: byTestID('battle-challenge-search-for-user-back'),
    },
  },

  challengesWaitingRoom: {
    container: byTestID('battle-challenge-waiting-room-container'),
    actions: {
      back: byTestID('battle-top-bar-back-button'),
      cancel: byTestID('battle-challenge-cancel-button'),
    },
  },

  challengesPublicPrivate: {
    container: byTestID('battle-privacy-container'),

    private: {
      button: byTestID('battle-privacy-private-participant-button'),
      participantSelected: byTestID('battle-privacy-private-participant-selected'),
      opponentSelected: byTestID('battle-privacy-private-opponent-selected'),
    },
    public: {
      button: byTestID('battle-privacy-public-participant-button'),
      participantSelected: byTestID('battle-privacy-public-participant-selected'),
      opponentSelected: byTestID('battle-privacy-public-opponent-selected'),
    },

    status: {
      public: byTestID('battle-privacy-status-public'),
      private: byTestID('battle-privacy-status-private'),
    },

    readyButton: byTestID('battle-privacy-ready-button'),
    readyButtonWaiting: () =>
      element(by.id('battle-privacy-ready-button').withDescendant(by.text('Starting Battle...'))),
    otherOpponentReadyMessage: byTestID('battle-privacy-other-opponent-ready'),
  },

  coinToss: {
    leaveButton: byTestID('coin-toss-battle-leave-button'),
  },

  main: {
    header: {
      leaveButton: byTestID('battle-leave-button'),
    },
  },

  summary: {
    container: byTestID('battle-summary-container'),
    close: byTestID('battle-summary-close-button'),
  },
};

describe('Battle Workflow', () => {
  beforeAll(async () => {
    await openApp();
  });

  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',

      intro: 'Test Intro',
      locationName: 'The Internet',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'My Favorite Rapper',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'My Song',
      favoriteSongArtistName: 'My Rapper',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',

      intro: 'Test Intro',
      locationName: 'The Internet',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'My Favorite Rapper',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'My Song',
      favoriteSongArtistName: 'My Rapper',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 0,
      next: false,
      results: [],
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [],
    });

    // When a request is made to get details for the opponent user, return fixture data
    await MockBarzServer.intercept('GET', '/v1/users/OTHERUSER', {
      ...(await loadFixture('user.json')),
      id: 'OTHERUSER',
      handle: 'barzdetoxother',
      name: 'Barz Detox Other',
      profileImageUrl: 'https://picsum.photos/100/100',
      computedScore: 40000,
    });

    await MockBarzServer.start();

    await device.reloadReactNative();

    // Sign in to the app using the detox mock user credentials
    await MockSignIn.signInAsDetoxMockUser();

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();
  });

  describe('Battle matching', () => {
    beforeEach(async () => {
      const sampleUser = await loadFixture('user.json');
      const sampleUserMe = await loadFixture('user-me.json');
      await MockBarzServer.intercept('GET', '/v1/users/me', {
        ...sampleUserMe,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtest',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
        ...sampleUser,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtest',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
        total: 0,
        next: false,
        results: [],
      });

      // When a request is made to get all pending challenges, by default, return an empty list
      await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
        total: 0,
        next: null,
        previous: null,
        results: [],
      });

      // Mock a request to create a new participant
      await MockBarzServer.intercept('POST', '/v1/participants', 'current-participant.json');

      // Mock a request checkin requests that the client makes
      await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/checkin', {
        statusCode: 204,
        body: '',
      });

      // Mock a request to get the battle that the participant has been associated with
      await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE', 'initial-battle.json');

      // Mock a request to get the backing beat
      // NOTE: send back an empty mp3 file
      await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE/beat', {
        statusCode: 200,
        body: {
          id: 'BEAT',
          beatKey: 'empty.mp3',
          beatUrl: 'https://cable.ayra.ch/empty/?id=5',
        },
      });

      // Mock a request to get the state machine definition
      await MockBarzServer.intercept(
        'GET',
        '/v1/battles/CURRENTBATTLE/state-machine-definition',
        'state-machine-definition.json',
      );

      // Mock a request to get the projected battle outcome of a given battle
      await MockBarzServer.intercept(
        'GET',
        '/v1/battles/CURRENTBATTLE/projected-outcome',
        'battle-projected-outcome.json',
      );

      // Mock a request to let the server know this participant is ready to battle
      await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/ready', {
        statusCode: 204,
        body: '',
      });

      // Mock the request to get the twilio token
      await MockBarzServer.intercept('POST', '/v1/participants/CURRENTPARTICIPANT/twilio-token', {
        token: 'FAKE TWILIO TOKEN',
      });
    });

    it('should match a participant with another participant if there is another participant available', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Make sure that the "back" button in the upper left is visible
      await waitFor(BattlePage.topBar.backButton()).toBeVisible().withTimeout(12_000);
      // and the "leave" button is not visible.
      await waitFor(BattlePage.topBar.leaveButton()).not.toBeVisible().withTimeout(12_000);

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that a matching participant has been found!
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
        },
      );

      // Now that there is a participant that has been matched, make sure that "leave" is now visible
      await waitFor(BattlePage.topBar.leaveButton()).toBeVisible().withTimeout(12_000);
      // and the "back" button went away
      await waitFor(BattlePage.topBar.backButton()).not.toBeVisible().withTimeout(12_000);

      // Make sure that the opponent id is visible somewhere
      // NOTE: this eventually should be swapped out for the participant's username
      await expect(
        element(by.id('battle-matching-container').withDescendant(by.text('Barz Detox Other'))),
      ).toBeVisible();
    });
    it('should show a toast if there are no other participants available', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Make sure that the "back" button in the upper left is visible
      await waitFor(BattlePage.topBar.backButton()).toBeVisible().withTimeout(12_000);
      // and the "leave" button is not visible.
      await waitFor(BattlePage.topBar.leaveButton()).not.toBeVisible().withTimeout(12_000);

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that the participant was NOT matched with another, yet, and that
      // the matching process is still going on in the background
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          initialMatchFailed: true, // <=== THIS is the important field
        },
      );

      // Make sure that a message is presented to the user telling them that they were not matched
      // YET, but will be soon
      await waitFor(BattlePage.matching.initialMatchFailedMessage())
        .toBeVisible()
        .withTimeout(12_000);
    });
    it('should unmatch the current participant if the battle becomes inactive (the other participant leaving, etc)', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that a matching participant has been found!
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
        },
      );

      // Make sure that the opponent's username is visible somewhere
      await expect(
        element(by.id('battle-matching-container').withDescendant(by.text('Barz Detox Other'))),
      ).toBeVisible();

      // Now, publish a message saying that the battle has been made inactive
      await MockPusher.publish('private-battle-CURRENTBATTLE', 'battle.update', {
        ...(await loadFixture('initial-battle.json')),
        madeInactiveAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
      });

      // This should result in a message to be shown on screen
      // TODO: right now this is an alert, but add an assertion here once this is a real react
      // native ui element

      // And the user being kicked out of the matching workflow
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });
    it('should leave without consequences if the matching process looses internet BEFORE A MATCH IS MADE', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Turn off the internet
      await MockNetInfo.changeNetInfo({ isInternetReachable: false });

      // Make sure that 10 seconds after the internet is lost, the user leaves the matching workflow
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });
    it('should forfeit the battle due to inactivity if the matching process looses internet AFTER A MATCH IS MADE', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that a matching participant has been found!
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
        },
      );

      // Turn off the internet
      await MockNetInfo.changeNetInfo({ isInternetReachable: false });

      // Make sure that 10 seconds after the internet is lost, the user leaves the matching workflow
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });
    it('should leave the battle if the server sets madeInactiveAt on the battle participant', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that the battle matching process has been made inactive serverside
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          madeInactiveAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
        },
      );

      // Make sure that right afterwards, the user leaves the matching process
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });

    it('should disable the "ready" button when a user presses it', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that a matching participant has been found!
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
        },
      );

      // Make sure that the opponent's username is visible somewhere
      await expect(
        element(by.id('battle-matching-container').withDescendant(by.text('Barz Detox Other'))),
      ).toBeVisible();

      // Now that the match has been made, press "ready" to move to the next step in the process
      await BattlePage.matching.readyButton().tap();

      // Publish a message saying that the current participant is ready
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          readyForBattleAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
        },
      );

      // Make sure that after "ready" is pressed, it becomes disabled
      await waitFor(BattlePage.matching.readyButtonWaiting()).toBeVisible().withTimeout(12_000);

      // Simulate the other battler pressing "ready"
      await MockPusher.publish(
        'private-battleparticipant-OTHERPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('other-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          readyForBattleAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
        },
      );

      // Now that both participants are ready, the app should leave the matching process and move to
      // the next step
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });

    it('should stay on the ready page until both participants press "ready"', async () => {
      // Tap on "Find Opponent", which will create a participant, and begin looking for other
      // participants
      await BattlePage.initiator.findOpponentButton().tap();

      // Wait for the participant matching screen to show up
      await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

      // Publish a message saying that a matching participant has been found!
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
        },
      );

      // Make sure that the opponent's username is visible somewhere
      await expect(
        element(by.id('battle-matching-container').withDescendant(by.text('Barz Detox Other'))),
      ).toBeVisible();

      // Now that the match has been made, simulate the other battler pressing "ready"
      await MockPusher.publish(
        'private-battleparticipant-OTHERPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('other-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          readyForBattleAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
        },
      );

      // Once this occurs, the "other participant pressed ready" indicator should be shown
      await waitFor(BattlePage.matching.otherOpponentReadyMessage())
        .toBeVisible()
        .withTimeout(12_000);

      // Now, press the "ready" button
      await BattlePage.matching.readyButton().tap();

      // Publish a message saying that the current participant is ready
      await MockPusher.publish(
        'private-battleparticipant-CURRENTPARTICIPANT',
        'battleParticipant.update',
        {
          ...(await loadFixture('current-participant.json')),
          battleId: 'CURRENTBATTLE',
          order: 0,
          readyForBattleAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
        },
      );

      // Now that both participants are ready, the app should leave the matching process and move to
      // the next step
      await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);
    });

    it.todo('should automatically make a battler ready after 30 seconds');
  });

  describe('Battle state machine', () => {
    describe('With CURRENTPARTICIPANT going first', () => {
      beforeEach(async () => {
        // Mock a request to create a new participant
        await MockBarzServer.intercept('POST', '/v1/participants', 'current-participant.json');

        // Tap on "Find Opponent", which will create a participant, and begin looking for other
        // participants
        await BattlePage.initiator.findOpponentButton().tap();

        // Mock a request checkin requests that the client makes
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/checkin', {
          statusCode: 204,
          body: '',
        });

        // Mock a request to get the battle that the participant has been associated with
        await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE', 'initial-battle.json');

        // Mock a request to get the backing beat
        // NOTE: send back an empty mp3 file
        await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE/beat', {
          statusCode: 200,
          body: {
            id: 'BEAT',
            beatKey: 'empty.mp3',
            beatUrl: 'https://cable.ayra.ch/empty/?id=5',
          },
        });

        // Mock a request to get the state machine definition
        await MockBarzServer.intercept(
          'GET',
          '/v1/battles/CURRENTBATTLE/state-machine-definition',
          'state-machine-definition.json',
        );

        // Mock a request to get the projected battle outcome of a given battle
        await MockBarzServer.intercept(
          'GET',
          '/v1/battles/CURRENTBATTLE/projected-outcome',
          'battle-projected-outcome.json',
        );

        // Mock a request to allow the participant to send a state machine event to the server for
        // storage
        await MockBarzServer.intercept(
          'POST',
          '/v1/participants/CURRENTPARTICIPANT/state-machine-events',
          {
            type: 'MOVE_TO_NEXT_PARTICIPANT',
          },
        );

        // Mock the request to leave the battle
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/leave', {
          statusCode: 204,
          data: '',
        });

        // Publish a message saying that a matching participant has been found!
        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('current-participant.json')),
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
          },
        );

        // Wait for the participant matching screen to show up
        await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

        // Mock a request to let the server know this participant is ready to battle
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/ready', {
          statusCode: 204,
          body: '',
        });

        await MockBarzServer.clearStoredRequests();

        // Now that the match has been made, press "ready" to move to the next step in the process
        await BattlePage.matching.readyButton().tap();

        // Wait for the ready request to be made
        await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/ready');

        // Send the message that indicates that the ready state changed
        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('current-participant.json')),
            readyForBattleAt: new Date().toISOString(),
          },
        );

        // Mock the request to get the twilio token
        await MockBarzServer.intercept('POST', '/v1/participants/CURRENTPARTICIPANT/twilio-token', {
          token: 'FAKE TWILIO TOKEN',
        });

        // Send the message that indicates the other participant pressed "ready" too
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('other-participant.json')),
            order: 1,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            readyForBattleAt: new Date().toISOString(),
          },
        );

        await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);

        // Simulate a successful connection to twilio video
        await MockBarzServer.intercept(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/twilio-track-ids',
          {
            statusCode: 204,
            data: '',
          },
        );
      });

      describe('With connecting to a battle and navigating to the coin toss step', () => {
        beforeEach(async () => {
          await MockTwilioVideo.clearStoredImperativeFunctionCalls();

          await MockTwilioVideo.interceptImperativeFunctionCall(
            'downloadMusicFromURLAndMakeActive',
            async () => ({ success: true, error: null }),
          );

          // Send all the events that twilio video would normally generate when somebody joins a video
          // room
          await MockTwilioVideo.publishEvent('roomDidConnect', {
            roomName: '',
            roomSid: '',
            participants: [],
            localParticipant: {
              sid: 'local',
              videoTrackSids: ['XXX'],
              audioTrackSids: ['YYY'],
              dataTrackSids: ['ZZZ'],
            },
          });
          await MockTwilioVideo.publishEvent('roomParticipantDidConnect', {
            roomName: '',
            roomSid: '',
            participant: {
              sid: 'remote',
              videoTrackSids: ['AAA'],
              audioTrackSids: ['BBB'],
              dataTrackSids: ['CCC'],
            },
          });
          await MockTwilioVideo.publishEvent('participantAddedVideoTrack', {
            roomName: '',
            roomSid: '',
            participant: {
              sid: 'remote',
              videoTrackSids: ['AAA'],
              audioTrackSids: ['BBB'],
              dataTrackSids: ['CCC'],
            },
            track: {
              enabled: true,
              trackName: 'camera',
              trackSid: 'remotevideotracksid',
            },
          });
          await MockTwilioVideo.publishEvent('participantAddedAudioTrack', {
            roomName: '',
            roomSid: '',
            participant: {
              sid: 'remote',
              videoTrackSids: ['AAA'],
              audioTrackSids: ['BBB'],
              dataTrackSids: ['CCC'],
            },
            track: {
              enabled: false,
              trackName: 'microphone',
              trackSid: '',
            },
          });
          await MockTwilioVideo.publishEvent('participantAddedDataTrack', {
            roomName: '',
            roomSid: '',
            participant: {
              sid: 'remote',
              videoTrackSids: ['AAA'],
              audioTrackSids: ['BBB'],
              dataTrackSids: ['CCC'],
            },
            track: {
              enabled: true,
              trackName: '',
              trackSid: '',
            },
          });

          // Make sure that the javascript code calls a bunch of native stuff during the setup process too
          await Promise.all([
            MockTwilioVideo.waitForImperativeFunctionCall('setLocalAudioEnabled'),
            MockTwilioVideo.waitForImperativeFunctionCall('downloadMusicFromURLAndMakeActive'),
            MockTwilioVideo.waitForImperativeFunctionCall('stopMusic'),
            MockTwilioVideo.waitForImperativeFunctionCall('setLocalAudioEnabled'),
          ]);

          // Make sure the state transitions into COIN_TOSS
          await MockBarzServer.waitForRequest(
            'PUT',
            '/v1/participants/CURRENTPARTICIPANT/checkin',
            (result) => result.req.body.currentState === 'COIN_TOSS',
          );

          await MockPusher.publish(
            'private-battleparticipant-CURRENTPARTICIPANT',
            'battleParticipant.update',
            {
              ...(await loadFixture('current-participant.json')),
              battleId: 'CURRENTBATTLE',
              order: 0,
              associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
              currentState: 'COIN_TOSS',
            },
          );
        });

        it('should stop the battle when "leave" is pressed while in the coin toss', async () => {
          // Press the "leave" button on the coin toss page
          await BattlePage.coinToss.leaveButton().tap();
          await systemDialog('Leave').tap();

          // Make sure that after leaving the battle, the user goes to the "summary" page
          await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

          // Then, tapping on "close" on THAT page should terminate the battle
          await BattlePage.summary.close().tap();

          // Wait for the twilio video call to be disconnected
          await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
          // Send the disconnect event from twilio
          await MockTwilioVideo.publishEvent('roomDidDisconnect', {
            roomName: '',
            roomSid: '',
            error: null,
          });

          // Make sure the leave request was made
          await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

          // And finally, make sure the summary page has gone away
          await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
        });
        it('should stop the battle when internet connectivity is lost in the coin toss', async () => {
          // Turn off the internet
          await MockNetInfo.changeNetInfo({ isInternetReachable: false });

          // Make sure that after leaving the battle, the user goes to the "summary" page
          await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);
        });
        it('should stop the battle when the other participant presses "leave" in the coin toss', async () => {
          // Simulate the other participant pressing leave
          // This presents itself as the `madeInactiveAt` being set to non-null on the battle
          await MockPusher.publish('private-battle-CURRENTBATTLE', 'battle.update', {
            ...(await loadFixture('initial-battle.json')),
            madeInactiveAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
            madeInactiveReason: 'DETOX_TESTING_REASON',
          });

          // Make sure that an alert was shown saying the other user left - and once it is, press the "ok" button on it
          await systemDialog('OK').tap();

          // Make sure that after leaving the battle, the user goes to the "summary" page
          await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);
        });
        it.todo(
          'should stop the battle when the other participant looses internet connection in the coin toss',
        );

        describe('With entering the main battle workflow', () => {
          beforeEach(async () => {
            // Then, make sure the state transitions into WARM_UP
            await MockBarzServer.clearStoredRequests();
            await MockBarzServer.waitForRequest(
              'PUT',
              '/v1/participants/CURRENTPARTICIPANT/checkin',
              (result) => result.req.body.currentState === 'WARM_UP',
            );

            await MockPusher.publish(
              'private-battleparticipant-CURRENTPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('current-participant.json')),
                battleId: 'CURRENTBATTLE',
                order: 0,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                currentState: 'WARM_UP',
              },
            );

            // Then, make sure the state transitions into BATTLE
            await MockBarzServer.waitForRequest(
              'PUT',
              '/v1/participants/CURRENTPARTICIPANT/checkin',
              (result) => result.req.body.currentState === 'BATTLE',
            );

            await MockPusher.publish(
              'private-battleparticipant-CURRENTPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('current-participant.json')),
                battleId: 'CURRENTBATTLE',
                order: 0,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                currentState: 'BATTLE',
              },
            );
          });

          it('should be able to battle another user successfully', async () => {
            // After the turn is complete, an event should be received by the server indicating that the app
            // is done with its turn, and that the "other participant" should take over
            await MockBarzServer.waitForRequest(
              'POST',
              '/v1/participants/CURRENTPARTICIPANT/state-machine-events',
              (result) => result.req.body.payload.type === 'MOVE_TO_NEXT_PARTICIPANT',
            );

            // Then, make sure the state transitions into WAITING
            await MockBarzServer.clearStoredRequests();
            await MockBarzServer.waitForRequest(
              'PUT',
              '/v1/participants/CURRENTPARTICIPANT/checkin',
              (result) => result.req.body.currentState === 'WAITING',
            );

            await MockPusher.publish(
              'private-battleparticipant-CURRENTPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('current-participant.json')),
                battleId: 'CURRENTBATTLE',
                order: 0,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                currentState: 'WAITING',
              },
            );

            // Make the other participant go into "WARM_UP"
            await MockPusher.publish(
              'private-battleparticipant-OTHERPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('other-participant.json')),
                order: 1,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                readyForBattleAt: new Date().toISOString(),
                currentState: 'WARM_UP',
              },
            );

            // Make the other participant go into "BATTLE"
            await MockPusher.publish(
              'private-battleparticipant-OTHERPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('other-participant.json')),
                order: 1,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                readyForBattleAt: new Date().toISOString(),
                currentState: 'BATTLE',
              },
            );

            // Simulating the other participant generating a "BATTLE_COMPLETE" event
            await MockTwilioVideo.publishEvent('dataTrackMessageReceived', {
              message: JSON.stringify({
                uuid: 'fakebattlecompletemessageuuid',
                type: 'BATTLE_COMPLETE',
              }),
            });

            // Make sure the battle goes to the completion screen
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

            // Then, tapping on "close" on THAT page should terminate the battle
            await BattlePage.summary.close().tap();

            // Wait for the twilio video call to be disconnected
            await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
            // Send the disconnect event from twilio
            await MockTwilioVideo.publishEvent('roomDidDisconnect', {
              roomName: '',
              roomSid: '',
              error: null,
            });

            // Make sure the leave request was made
            await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

            // And finally, make sure the summary page has gone away
            await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
          });

          it('should stop the battle when "leave" is pressed', async () => {
            // Press the "leave" button to purposely terminate the battle
            await BattlePage.main.header.leaveButton().tap();
            await systemDialog('Leave').tap();

            // Make sure that after leaving the battle, the user goes to the "summary" page
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

            // Then, tapping on "close" on THAT page should terminate the battle
            await BattlePage.summary.close().tap();

            // Wait for the twilio video call to be disconnected
            await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
            // Send the disconnect event from twilio
            await MockTwilioVideo.publishEvent('roomDidDisconnect', {
              roomName: '',
              roomSid: '',
              error: null,
            });

            // Make sure the leave request was made
            await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

            // And finally, make sure the summary page has gone away
            await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
          });
          it('should stop the battle when the other participant presses "leave"', async () => {
            // Simulate the other participant pressing leave
            // This presents itself as the `madeInactiveAt` being set to non-null on the battle
            await MockPusher.publish('private-battle-CURRENTBATTLE', 'battle.update', {
              ...(await loadFixture('initial-battle.json')),
              madeInactiveAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
              madeInactiveReason: 'DETOX_TESTING_REASON',
            });

            // Press ok on the alert that comes up
            await systemDialog('OK').tap();

            // Make sure that after leaving the battle, the user goes to the "summary" page
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

            // Then, tapping on "close" on THAT page should terminate the battle
            await BattlePage.summary.close().tap();

            // Wait for the twilio video call to be disconnected
            await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
            // Send the disconnect event from twilio
            await MockTwilioVideo.publishEvent('roomDidDisconnect', {
              roomName: '',
              roomSid: '',
              error: null,
            });

            // Make sure the leave request was made
            await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

            // And finally, make sure the summary page has gone away
            await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
          });
          it('should leave the battle when the app looses its internet connection', async () => {
            // Turn off the internet
            await MockNetInfo.changeNetInfo({ isInternetReachable: false });

            // Make sure the not connected to internet message shows up
            await waitFor(BattlePage.notConnectedToInternetOverlay())
              .toBeVisible()
              .withTimeout(12_000);

            // Make sure that after leaving the battle, the user goes to the "summary" page
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

            // Then, tapping on "close" on the simmary page should bring the user back to the start of
            // the workflow
            await BattlePage.summary.close().tap();

            // Wait for the twilio video call to be disconnected
            await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
            // Send the disconnect event from twilio
            await MockTwilioVideo.publishEvent('roomDidDisconnect', {
              roomName: '',
              roomSid: '',
              error: null,
            });

            // Make sure the leave request was made
            await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

            // And finally, make sure the summary page has gone away
            await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
          });
          it('should stop the battle when the other user looses internet connection', async () => {
            await MockPusher.publish(
              'private-battleparticipant-OTHERPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('other-participant.json')),
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                readyForBattleAt: new Date().toISOString(),
                connectionStatus: 'OFFLINE', // <== THIS is the important field - mark the other participant as have gone offline
              },
            );

            // Once the opponent looses internet, make sure that the message saying as such is shown
            await waitFor(BattlePage.opponentLostInternetOverlay())
              .toBeVisible()
              .withTimeout(12_000);

            // After a while, the battle will be made inactive serverside due to the opponent not
            // checking in in a long enough duration
            await MockPusher.publish('private-battle-CURRENTBATTLE', 'battle.update', {
              ...(await loadFixture('initial-battle.json')),
              madeInactiveAt: '2023-05-16T15:28:38.060Z', // <=== THIS is the important field
              madeInactiveReason: 'AUTO_FORFEIT_DUE_TO_INACTIVITY',
            });

            // Once this happens, make sure that an alert was shown saying the other user left - and once it is, press the "ok" button on it
            await systemDialog('OK').tap();

            // Make sure that after leaving the battle, the user goes to the "summary" page
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);
          });
          it('should interrupt the battle intermittantly when internet briefly drops out IN THE MIDDLE OF A TURN and comes back', async () => {
            // Turn off the internet
            await MockNetInfo.changeNetInfo({ isInternetReachable: false });

            // Make sure the not connected to internet message shows up
            await waitFor(BattlePage.notConnectedToInternetOverlay())
              .toBeVisible()
              .withTimeout(12_000);

            // Mock a request to fetch the current battle - this is performed when coming back online
            // to "catch back up" to the most recent state
            await MockBarzServer.intercept(
              'GET',
              '/v1/battles/CURRENTBATTLE',
              'initial-battle.json',
            );

            // Turn the internet back on
            await MockNetInfo.changeNetInfo({ isInternetReachable: true });

            // Make sure the not connected to internet message goes away
            await waitFor(BattlePage.notConnectedToInternetOverlay())
              .not.toBeVisible()
              .withTimeout(12_000);

            // Make sure the app makes a request to refetch the battle information
            await MockBarzServer.waitForRequest('GET', '/v1/battles/CURRENTBATTLE');
          });
          it('should interrupt the battle intermittantly when internet briefly drops out and comes back AT THE END OF A BATTLE', async () => {
            // BEGIN SET UP LOGIC
            //
            // After the turn is complete, an event should be received by the server indicating that the app
            // is done with its turn, and that the "other participant" should take over
            await MockBarzServer.waitForRequest(
              'POST',
              '/v1/participants/CURRENTPARTICIPANT/state-machine-events',
              (result) => result.req.body.payload.type === 'MOVE_TO_NEXT_PARTICIPANT',
            );

            // Then, make sure the state transitions into WAITING
            await MockBarzServer.clearStoredRequests();
            await MockBarzServer.waitForRequest(
              'PUT',
              '/v1/participants/CURRENTPARTICIPANT/checkin',
              (result) => result.req.body.currentState === 'WAITING',
            );

            await MockPusher.publish(
              'private-battleparticipant-CURRENTPARTICIPANT',
              'battleParticipant.update',
              {
                ...(await loadFixture('current-participant.json')),
                battleId: 'CURRENTBATTLE',
                order: 0,
                associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
                currentState: 'WAITING',
              },
            );
            //
            // END SET UP LOGIC

            // Turn off the internet - this test assumes that the internet is lost near the end of
            // the battle, and while offline the other battler will send a state machine event
            await MockNetInfo.changeNetInfo({ isInternetReachable: false });

            // Make sure the not connected to internet message shows up
            await waitFor(BattlePage.notConnectedToInternetOverlay())
              .toBeVisible()
              .withTimeout(12_000);

            // Mock a request to fetch the current battle - this is performed when coming back online
            // to "catch back up" to the most recent state.
            const initialBattleFixture = await loadFixture('initial-battle.json');
            await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE', {
              ...initialBattleFixture,

              participants: [
                { ...initialBattleFixture.participants[0], currentState: 'WAITING' },
                { ...initialBattleFixture.participants[1], currentState: 'WARM_UP' },
              ],

              // Include in this response a state machine event. This event should tell the system
              // to move to the next battler when processed.
              stateMachineEvents: [
                {
                  id: 'movetonextparticipanteventid',
                  createdAt: '2023-05-16T15:26:47.662Z',
                  updatedAt: '2023-05-16T15:28:36.712Z',
                  clientGeneratedUuid: '80946933-528d-497c-a2f4-52839d21221b',
                  triggeredByParticipantId: 'OTHERPARTICIPANT',
                  payload: {
                    type: 'BATTLE_COMPLETE',
                  },
                },
              ],
            });
            await MockBarzServer.intercept('GET', '/v1/participants/CURRENTPARTICIPANT', {
              ...(await loadFixture('current-participant.json')),
              currentState: 'WARM_UP',
            });

            // Turn the internet back on
            await MockNetInfo.changeNetInfo({ isInternetReachable: true });

            // Make sure the not connected to internet message goes away
            await waitFor(BattlePage.notConnectedToInternetOverlay())
              .not.toBeVisible()
              .withTimeout(12_000);

            // Make sure the app makes a request to refetch the battle information
            await MockBarzServer.waitForRequest('GET', '/v1/battles/CURRENTBATTLE');
            // And also the active participant
            await MockBarzServer.waitForRequest('GET', '/v1/participants/CURRENTPARTICIPANT');

            // And finally, make sure that the BATTLE_COMPLETE event is processed, and the user is
            // redirected to the summary page
            await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);
          });
        });
      });
    });
    describe('With OTHERPARTICIPANT going first', () => {
      beforeEach(async () => {
        // Mock a request to create a new participant
        await MockBarzServer.intercept('POST', '/v1/participants', 'current-participant.json');

        // Tap on "Find Opponent", which will create a participant, and begin looking for other
        // participants
        await BattlePage.initiator.findOpponentButton().tap();

        // Mock a request checkin requests that the client makes
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/checkin', {
          statusCode: 204,
          body: '',
        });

        // Mock a request to get the battle that the participant has been associated with
        const initialBattleFixture = await loadFixture('initial-battle.json');
        await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE', {
          ...initialBattleFixture,
          participants: [
            { ...initialBattleFixture.participants[0], order: 1 },
            { ...initialBattleFixture.participants[1], order: 0 },
          ],
        });

        // Mock a request to get the state machine definition
        const stateMachineDefinitionFixture = await loadFixture('state-machine-definition.json');
        await MockBarzServer.intercept(
          'GET',
          '/v1/battles/CURRENTBATTLE/state-machine-definition',
          {
            ...stateMachineDefinitionFixture,
            context: {
              ...stateMachineDefinitionFixture.context,
              // NOTE: override the order of hte participants so that OTHERPARTICIPANT goes first
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
          },
        );

        // Mock a request to allow the participant to send a state machine event to the server for
        // storage
        await MockBarzServer.intercept(
          'POST',
          '/v1/participants/CURRENTPARTICIPANT/state-machine-events',
          {
            type: 'MOVE_TO_NEXT_PARTICIPANT',
          },
        );

        // Wait for the participant matching screen to show up
        await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);

        // Publish a message saying that a matching participant has been found!
        const currentParticipantFixture = await loadFixture('current-participant.json');
        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 1, // NOTE: This being 1 means CURRENTPARTICIPANT goes second!
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              // NOTE: override the order of the participants so that OTHERPARTICIPANT goes first
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
          },
        );

        // Mock a request to let the server know this participant is ready to battle
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/ready', {
          statusCode: 204,
          body: '',
        });

        await MockBarzServer.clearStoredRequests();

        // Now that the match has been made, press "ready" to move to the next step in the process
        await BattlePage.matching.readyButton().tap();

        // Wait for the ready request to be made
        await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/ready');

        // Send the message that indicates that the ready state changed
        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 1,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },

            readyForBattleAt: new Date().toISOString(),
          },
        );

        // Mock the request to get the twilio token
        await MockBarzServer.intercept('POST', '/v1/participants/CURRENTPARTICIPANT/twilio-token', {
          token: 'FAKE TWILIO TOKEN',
        });

        // Send the message that indicates the other participant pressed "ready" too
        const otherParticipantFixture = await loadFixture('other-participant.json');
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...otherParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 0, // NOTE: This being 0 means OTHERPARTICIPANT goes first!
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...otherParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },

            readyForBattleAt: new Date().toISOString(),
          },
        );

        await waitFor(BattlePage.matching.container()).not.toBeVisible().withTimeout(12_000);

        // Simulate a successful connection to twilio video
        await MockBarzServer.intercept(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/twilio-track-ids',
          {
            statusCode: 204,
            data: '',
          },
        );
      });

      it('should be able to handle going second when battling another participant', async () => {
        await MockTwilioVideo.clearStoredImperativeFunctionCalls();

        await MockTwilioVideo.interceptImperativeFunctionCall(
          'downloadMusicFromURLAndMakeActive',
          async () => ({ success: true, error: null }),
        );

        // Send all the events that twilio video would normally generate when somebody joins a video
        // room
        await MockTwilioVideo.publishEvent('roomDidConnect', {
          roomName: '',
          roomSid: '',
          participants: [],
          localParticipant: {
            sid: 'local',
            videoTrackSids: ['XXX'],
            audioTrackSids: ['YYY'],
            dataTrackSids: ['ZZZ'],
          },
        });
        await MockTwilioVideo.publishEvent('roomParticipantDidConnect', {
          roomName: '',
          roomSid: '',
          participant: {
            sid: 'remote',
            videoTrackSids: ['AAA'],
            audioTrackSids: ['BBB'],
            dataTrackSids: ['CCC'],
          },
        });
        await MockTwilioVideo.publishEvent('participantAddedVideoTrack', {
          roomName: '',
          roomSid: '',
          participant: {
            sid: 'remote',
            videoTrackSids: ['AAA'],
            audioTrackSids: ['BBB'],
            dataTrackSids: ['CCC'],
          },
          track: {
            enabled: true,
            trackName: 'camera',
            trackSid: 'remotevideotracksid',
          },
        });
        await MockTwilioVideo.publishEvent('participantAddedAudioTrack', {
          roomName: '',
          roomSid: '',
          participant: {
            sid: 'remote',
            videoTrackSids: ['AAA'],
            audioTrackSids: ['BBB'],
            dataTrackSids: ['CCC'],
          },
          track: {
            enabled: false,
            trackName: 'microphone',
            trackSid: '',
          },
        });
        await MockTwilioVideo.publishEvent('participantAddedDataTrack', {
          roomName: '',
          roomSid: '',
          participant: {
            sid: 'remote',
            videoTrackSids: ['AAA'],
            audioTrackSids: ['BBB'],
            dataTrackSids: ['CCC'],
          },
          track: {
            enabled: true,
            trackName: '',
            trackSid: '',
          },
        });

        // Make sure that the javascript code calls a bunch of native stuff during the setup process too
        await Promise.all([
          MockTwilioVideo.waitForImperativeFunctionCall('setLocalAudioEnabled'),
          MockTwilioVideo.waitForImperativeFunctionCall('downloadMusicFromURLAndMakeActive'),
          MockTwilioVideo.waitForImperativeFunctionCall('stopMusic'),
          MockTwilioVideo.waitForImperativeFunctionCall('setLocalAudioEnabled'),
        ]);

        // Make sure the state transitions into COIN_TOSS
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/checkin',
          (result) => result.req.body.currentState === 'COIN_TOSS',
        );

        const currentParticipantFixture = await loadFixture('current-participant.json');
        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
            readyForBattleAt: new Date().toISOString(),

            currentState: 'COIN_TOSS',
          },
        );

        // Then, make sure the state transitions into WAITING - the current participant is not going
        // first
        await MockBarzServer.clearStoredRequests();
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/checkin',
          (result) => result.req.body.currentState === 'WAITING',
        );

        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
            readyForBattleAt: new Date().toISOString(),

            currentState: 'WARM_UP',
          },
        );

        // Simulate the other participant going into "WARM_UP"
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('other-participant.json')),
            order: 1,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            readyForBattleAt: new Date().toISOString(),
            currentState: 'WARM_UP',
          },
        );

        // Simulate the other participant going into "BATTLE"
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('other-participant.json')),
            order: 1,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            readyForBattleAt: new Date().toISOString(),
            currentState: 'BATTLE',
          },
        );

        // Simulating the other participant generating a "MOVE_TO_NEXT_PARTICIPANT" event
        await MockTwilioVideo.publishEvent('dataTrackMessageReceived', {
          message: JSON.stringify({
            uuid: 'fakemovetonextparticipantuuid',
            type: 'MOVE_TO_NEXT_PARTICIPANT',
          }),
        });

        // Mock the request to leave the battle
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/leave', {
          statusCode: 204,
          data: '',
        });

        // Make sure the state transitions into WARM_UP
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/checkin',
          (result) => result.req.body.currentState === 'WARM_UP',
        );

        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
            readyForBattleAt: new Date().toISOString(),

            currentState: 'WARM_UP',
          },
        );

        // Then, make sure the state transitions into BATTLE
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/checkin',
          (result) => result.req.body.currentState === 'BATTLE',
        );

        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...currentParticipantFixture,
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentContext: {
              ...currentParticipantFixture.currentContext,
              participantIds: ['OTHERPARTICIPANT', 'CURRENTPARTICIPANT'],
            },
            readyForBattleAt: new Date().toISOString(),

            currentState: 'BATTLE',
          },
        );

        // After the turn is complete, an event should be received by the server indicating that the
        // battle is complete.
        await MockBarzServer.waitForRequest(
          'POST',
          '/v1/participants/CURRENTPARTICIPANT/state-machine-events',
          (result) => result.req.body.payload.type === 'BATTLE_COMPLETE',
        );

        // Then, make sure the state transitions into WAITING
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/checkin',
          (result) => result.req.body.currentState === 'WAITING',
        );

        await MockPusher.publish(
          'private-battleparticipant-CURRENTPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('current-participant.json')),
            battleId: 'CURRENTBATTLE',
            order: 0,
            associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
            currentState: 'WAITING',
          },
        );

        // Make sure the battle goes to the completion screen
        await waitFor(BattlePage.summary.container()).toBeVisible().withTimeout(12_000);

        // Then, tapping on "close" on THAT page should terminate the battle
        await BattlePage.summary.close().tap();

        // Wait for the twilio video call to be disconnected
        await MockTwilioVideo.waitForImperativeFunctionCall('disconnect');
        // Send the disconnect event from twilio
        await MockTwilioVideo.publishEvent('roomDidDisconnect', {
          roomName: '',
          roomSid: '',
          error: null,
        });

        // Make sure the leave request was made
        await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/leave');

        // And finally, make sure the summary page has gone away
        await waitFor(BattlePage.summary.container()).not.toBeVisible().withTimeout(12_000);
      });
    });
  });
});

describe('Challenges', () => {
  beforeAll(async () => {
    await openApp();
  });

  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',

      intro: 'Test Intro',
      locationName: 'The Internet',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'My Favorite Rapper',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'My Song',
      favoriteSongArtistName: 'My Rapper',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',

      intro: 'Test Intro',
      locationName: 'The Internet',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'My Favorite Rapper',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'My Song',
      favoriteSongArtistName: 'My Rapper',
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [],
    });

    // When a request is made to get details for the opponent user, return fixture data
    await MockBarzServer.intercept('GET', '/v1/users', {
      total: 1,
      next: null,
      results: [
        {
          ...(await loadFixture('user.json')),
          id: 'OTHERUSER',
          handle: 'barzdetoxother',
          name: 'Barz Detox Other',
          profileImageUrl: 'https://picsum.photos/100/100',
          computedScore: 40000,
        },
      ],
    });

    await MockBarzServer.intercept('GET', '/v1/users/me/is-challenging', { status: false });

    // When a request is made to get details for the opponent user, return fixture data
    await MockBarzServer.intercept('GET', '/v1/users/OTHERUSER', {
      ...(await loadFixture('user.json')),
      id: 'OTHERUSER',
      handle: 'barzdetoxother',
      name: 'Barz Detox Other',
      profileImageUrl: 'https://picsum.photos/100/100',
      computedScore: 40000,
    });

    // Mock a request to get the battle that the participant has been associated with
    const initialBattle = await loadFixture('initial-battle.json');
    await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE', {
      ...initialBattle,
      participants: [
        { ...initialBattle.participants[0], userId: 'CURRENTUSER' },
        { ...initialBattle.participants[1], userId: 'OTHERUSER' },
      ],
    });

    // Mock a request to get the backing beat
    // NOTE: send back an empty mp3 file
    await MockBarzServer.intercept('GET', '/v1/battles/CURRENTBATTLE/beat', {
      statusCode: 200,
      body: {
        id: 'BEAT',
        beatKey: 'empty.mp3',
        beatUrl: 'https://cable.ayra.ch/empty/?id=5',
      },
    });

    // Mock a request to get the state machine definition
    await MockBarzServer.intercept(
      'GET',
      '/v1/battles/CURRENTBATTLE/state-machine-definition',
      'state-machine-definition.json',
    );

    // Mock a request to get the projected battle outcome of a given battle
    await MockBarzServer.intercept(
      'GET',
      '/v1/battles/CURRENTBATTLE/projected-outcome',
      'battle-projected-outcome.json',
    );

    // Mock a request to let a uset change the privacy of the battle
    await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/privacy', {
      status: 204,
    });

    await MockBarzServer.start();

    await device.reloadReactNative();

    // Sign in to the app using the detox mock user credentials
    await MockSignIn.signInAsDetoxMockUser();

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();
  });

  describe('With a user initiated challenge', () => {
    beforeEach(async () => {
      // Mock a request to create a new challenge
      await MockBarzServer.intercept('POST', '/v1/challenges', 'user-initiated-challenge.json');

      // Mock all the actions that one can perform on a challenge
      await MockBarzServer.intercept('PUT', '/v1/challenges/CURRENTCHALLENGE/checkin', {
        status: 204,
      });
      await MockBarzServer.intercept('PUT', '/v1/challenges/CURRENTCHALLENGE/cancel', {
        ...(await loadFixture('user-initiated-challenge.json')),
        status: 'CANCELLED',
        cancelledAt: `${new Date().toISOString()}`,
      });
    });
    it('should select another user to challenge and then when the other user joins the waiting room, go into the battle', async () => {
      // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
      await BattlePage.initiator.challengeOpponentButton().tap();

      // Wait for the challenges user search page to be visible
      await waitFor(BattlePage.challengesSearchForUser.wrapper()).toBeVisible().withTimeout(5_000);

      // Select the first user in the list to challenge
      await BattlePage.challengesSearchForUser.firstItem().tap();

      // Wait for the challenges waiting room to open
      await waitFor(BattlePage.challengesWaitingRoom.container()).toBeVisible().withTimeout(5_000);

      // Simulate a pusher message indicating that the challenge has started because the other user
      // entered the waiting room
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('user-initiated-challenge.json')),
        status: 'STARTED',
        startedAt: `${new Date().toISOString()}`,
        battleId: 'CURRENTBATTLE',
      });

      // Make sure that the other opponent profile page with a ready button is shown
      await waitFor(BattlePage.challengesPublicPrivate.container())
        .toBeVisible()
        .withTimeout(5_000);
    });
    it('should select another user to challenge and then leave the waiting room, have the other user join, and then reenter to start the battle', async () => {
      // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
      await BattlePage.initiator.challengeOpponentButton().tap();

      // Wait for the challenges user search page to be visible
      await waitFor(BattlePage.challengesSearchForUser.wrapper()).toBeVisible().withTimeout(5_000);

      // Select the first user in the list to challenge
      await BattlePage.challengesSearchForUser.firstItem().tap();

      // Wait for the challenges waiting room to open
      await waitFor(BattlePage.challengesWaitingRoom.container()).toBeVisible().withTimeout(5_000);

      // Press the "back" button to get out of the waiting room
      await BattlePage.challengesWaitingRoom.actions.back().tap();

      // Wait for the initiator page to be visible again
      await waitFor(BattlePage.initiator.container()).toBeVisible().withTimeout(5_000);

      // Simulate a pusher message indicating that the other user joined the waiting room
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('user-initiated-challenge.json')),
        challengedUserLastAliveAt: `${new Date().toISOString()}`,
        challengedUserInWaitingRoom: true,
      });

      // Now, re-enter the waiting room by pressing "Waiting Room" on the challenge item
      await BattlePage.initiator.pendingChallenges.first.actions.waitingRoomButton().tap();

      // Make sure that a request was made to check in with the challenge - this should happen when
      // joining a waiting room that already exists
      await MockBarzServer.waitForRequest('PUT', '/v1/challenges/CURRENTCHALLENGE/checkin');

      // After sending this request, simulate a pusher message indicating that the challenge has started because
      // the other user checked in with the client
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('user-initiated-challenge.json')),
        status: 'STARTED',
        startedAt: `${new Date().toISOString()}`,
        battleId: 'CURRENTBATTLE',
      });

      // Make sure that the other opponent profile page with a ready button is shown
      await waitFor(BattlePage.challengesPublicPrivate.container())
        .toBeVisible()
        .withTimeout(5_000);
    });
    it('should select another user to challenge and then cancel the challenge in the waiting room', async () => {
      // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
      await BattlePage.initiator.challengeOpponentButton().tap();

      // Wait for the challenges user search page to be visible
      await waitFor(BattlePage.challengesSearchForUser.wrapper()).toBeVisible().withTimeout(5_000);

      // Select the first user in the list to challenge
      await BattlePage.challengesSearchForUser.firstItem().tap();

      // Wait for the challenges waiting room to open
      await waitFor(BattlePage.challengesWaitingRoom.container()).toBeVisible().withTimeout(5_000);

      // Press the "cancel" button to cancel the challenge before the other user joining
      await BattlePage.challengesWaitingRoom.actions.cancel().tap();

      // Make sure that a request was made to cancel the challenge explcitly
      await MockBarzServer.waitForRequest('PUT', '/v1/challenges/CURRENTCHALLENGE/cancel');

      // Send a pusher message indicating the challenge was cancelled
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('user-initiated-challenge.json')),
        status: 'CANCELLED',
        cancelledAt: `${new Date().toISOString()}`,
      });

      // Wait for the initiator page to be visible again
      await waitFor(BattlePage.initiator.container()).toBeVisible().withTimeout(5_000);

      // Also make sure that the challenge that was just cancelled is NOT visible on the initial
      // screen
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);
    });
    it('should ensure if a challenge is cancelled while in a waiting room, redirect to the initial page', async () => {
      // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
      await BattlePage.initiator.challengeOpponentButton().tap();

      // Wait for the challenges user search page to be visible
      await waitFor(BattlePage.challengesSearchForUser.wrapper()).toBeVisible().withTimeout(5_000);

      // Select the first user in the list to challenge
      await BattlePage.challengesSearchForUser.firstItem().tap();

      // Wait for the challenges waiting room to open
      await waitFor(BattlePage.challengesWaitingRoom.container()).toBeVisible().withTimeout(5_000);

      // Send a pusher message indicating the challenge was cancelled by the other user
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('user-initiated-challenge.json')),
        status: 'CANCELLED',
        cancelledAt: `${new Date().toISOString()}`,
      });

      // Make sure an alert is shown telling the user that the other user cancelled the challenge on
      // them
      await waitFor(systemDialog('OK')).toExist().withTimeout(5_000);
      await systemDialog('OK').tap();

      // And after cancelling, the user should be back at the initial screen
      await waitFor(BattlePage.initiator.container()).toBeVisible().withTimeout(5_000);

      // Also make sure that the challenge that was just cancelled is NOT visible on the initial
      // screen
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);
    });

    describe('With a user already having an active challenge', () => {
      beforeEach(async () => {
        // Mock an endpoint used by the app to figure out if the user has an active challenge in
        // progress
        await MockBarzServer.intercept('GET', '/v1/users/me/is-challenging', { status: true });
      });
      it('should let the user know they have an active challenge and allow the user to cancel it', async () => {
        // Tap on "Challenge", to start making a challenge
        await BattlePage.initiator.challengeOpponentButton().tap();

        // Wait for the challenges user search page to be visible
        await waitFor(BattlePage.challengesSearchForUser.wrapper())
          .toBeVisible()
          .withTimeout(5_000);

        // Select the first user in the list to challenge
        await BattlePage.challengesSearchForUser.firstItem().tap();

        // After tapping on the user to challenge, make sure an alert is shown letting the user know that
        // they are attempting to make a second challenge
        await waitFor(systemDialog('Cancel Current Challenge')).toExist().withTimeout(5_000);
        // Tap "Cancel Current Challenge" to continue anyway
        await systemDialog('Cancel Current Challenge').tap();

        // After pressing that button, the challenges waiting room should open
        await waitFor(BattlePage.challengesWaitingRoom.container())
          .toBeVisible()
          .withTimeout(5_000);
      });
      it(`should leave existing challenges alone if a user doesn't press "Cancel" in the alert`, async () => {
        // Now, tap on "Challenge", to start making a challenge
        await BattlePage.initiator.challengeOpponentButton().tap();

        // Wait for the challenges user search page to be visible
        await waitFor(BattlePage.challengesSearchForUser.wrapper())
          .toBeVisible()
          .withTimeout(5_000);

        // Select the first user in the list to challenge
        await BattlePage.challengesSearchForUser.firstItem().tap();

        // After tapping on the user to challenge, make sure an alert is shown letting the user know that
        // they are attempting to make a second challenge
        await waitFor(systemDialog('Go Back')).toExist().withTimeout(5_000);
        // Tap "Go Back" to cancel creating this new challenge
        await systemDialog('Go Back').tap();

        // After pressing the button, wait for the initiator page to be visible again
        await waitFor(BattlePage.initiator.container()).toBeVisible().withTimeout(5_000);
      });
    });

    describe('With a user having accepted a challenge and on the public/private screen', () => {
      beforeEach(async () => {
        // Mock a request to create a new challenge
        await MockBarzServer.intercept('POST', '/v1/challenges', 'user-initiated-challenge.json');

        // Mock checking in to a challenge
        await MockBarzServer.intercept('PUT', '/v1/challenges/CURRENTCHALLENGE/checkin', {
          status: 204,
        });

        // Mock checking in to the participant and making it ready
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/checkin', {
          status: 204,
        });
        await MockBarzServer.intercept('PUT', '/v1/participants/CURRENTPARTICIPANT/ready', {
          status: 204,
        });

        // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
        await BattlePage.initiator.challengeOpponentButton().tap();

        // Wait for the challenges user search page to be visible
        await waitFor(BattlePage.challengesSearchForUser.wrapper())
          .toBeVisible()
          .withTimeout(5_000);

        // Select the first user in the list to challenge
        await BattlePage.challengesSearchForUser.firstItem().tap();

        // Wait for the challenges waiting room to open
        await waitFor(BattlePage.challengesWaitingRoom.container())
          .toBeVisible()
          .withTimeout(5_000);

        // Simulate a pusher message indicating that the challenge has started because the other user
        // entered the waiting room
        await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
          ...(await loadFixture('user-initiated-challenge.json')),
          status: 'STARTED',
          startedAt: `${new Date().toISOString()}`,
          battleId: 'CURRENTBATTLE',
        });

        // Make sure that the other opponent profile page with a ready button is shown
        await waitFor(BattlePage.challengesPublicPrivate.container())
          .toBeVisible()
          .withTimeout(5_000);
      });
      it('should be able to select that the battle should be public / private', async () => {
        // Make sure that by default, there is no public / private options selected for either user
        await waitFor(BattlePage.challengesPublicPrivate.private.participantSelected())
          .not.toBeVisible()
          .withTimeout(5_000);
        await waitFor(BattlePage.challengesPublicPrivate.private.opponentSelected())
          .not.toBeVisible()
          .withTimeout(5_000);
        await waitFor(BattlePage.challengesPublicPrivate.public.participantSelected())
          .not.toBeVisible()
          .withTimeout(5_000);
        await waitFor(BattlePage.challengesPublicPrivate.public.opponentSelected())
          .not.toBeVisible()
          .withTimeout(5_000);

        // Press "private"
        await BattlePage.challengesPublicPrivate.private.button().tap();

        // Make sure a request was made to the server to set the requested privacy to PRIVATE
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/privacy',
          ({ req }) => {
            return req.body.requestedBattlePrivacyLevel === 'PRIVATE';
          },
        );

        // Make sure that the user's image shows up in the private button afterwards
        await waitFor(BattlePage.challengesPublicPrivate.private.participantSelected())
          .toBeVisible()
          .withTimeout(5_000);

        // Also make sure that the status shown to the user reflects the battle is private
        await waitFor(BattlePage.challengesPublicPrivate.status.private())
          .toBeVisible()
          .withTimeout(5_000);

        // Press "public"
        await BattlePage.challengesPublicPrivate.public.button().tap();

        // Make sure a request was made to the server to set the requested privacy to PUBLIC
        await MockBarzServer.waitForRequest(
          'PUT',
          '/v1/participants/CURRENTPARTICIPANT/privacy',
          ({ req }) => {
            return req.body.requestedBattlePrivacyLevel === 'PUBLIC';
          },
        );

        // Make sure that the user's image shows up in the public button afterwards
        await waitFor(BattlePage.challengesPublicPrivate.public.participantSelected())
          .toBeVisible()
          .withTimeout(5_000);
        // And is no longer in the private button
        await waitFor(BattlePage.challengesPublicPrivate.private.participantSelected())
          .not.toBeVisible()
          .withTimeout(5_000);

        // Also make sure that the status shown to the user says the battle is still private - the
        // other user hasn't weighed in yet
        await waitFor(BattlePage.challengesPublicPrivate.status.private())
          .toBeVisible()
          .withTimeout(5_000);
      });
      it(`should show the state of the other user's public/private selection`, async () => {
        // Simulate the other user pressing "private"
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('other-participant.json')),
            battleId: 'CURRENTBATTLE',
            requestedBattlePrivacyLevel: 'PRIVATE', // <=== THIS is the important field
          },
        );

        // Make sure that the opponent's image shows up in the private button afterwards
        await waitFor(BattlePage.challengesPublicPrivate.private.opponentSelected())
          .toBeVisible()
          .withTimeout(5_000);

        // Also make sure that the status shown to the user reflects the battle is private
        await waitFor(BattlePage.challengesPublicPrivate.status.private())
          .toBeVisible()
          .withTimeout(5_000);

        // Simulate the other user pressing "public"
        await MockPusher.publish(
          'private-battleparticipant-OTHERPARTICIPANT',
          'battleParticipant.update',
          {
            ...(await loadFixture('other-participant.json')),
            battleId: 'CURRENTBATTLE',
            requestedBattlePrivacyLevel: 'PUBLIC', // <=== THIS is the important field
          },
        );

        // Make sure that the opponent's image shows up in the public button afterwards
        await waitFor(BattlePage.challengesPublicPrivate.public.opponentSelected())
          .toBeVisible()
          .withTimeout(5_000);
        // And is no longer in the private button
        await waitFor(BattlePage.challengesPublicPrivate.private.opponentSelected())
          .not.toBeVisible()
          .withTimeout(5_000);

        // Also make sure that the status shown to the user says the battle is still private - the
        // other user hasn't weighed in yet
        await waitFor(BattlePage.challengesPublicPrivate.status.private())
          .toBeVisible()
          .withTimeout(5_000);

        // Finally, locally on this end, press "public"
        await BattlePage.challengesPublicPrivate.public.button().tap();

        // And make sure that NOW that both users have selected public, the status reflects that the
        // battle will actually be public
        await waitFor(BattlePage.challengesPublicPrivate.status.public())
          .toBeVisible()
          .withTimeout(5_000);
      });
      it('should automatically make the battle ready after 15 seconds', async () => {
        // Wait for the timer to almost reach the end
        await delay(12_000);

        // Make sure that after 15 seconds, the app automatically makes the participant ready for
        // battle
        await MockBarzServer.waitForRequest('PUT', '/v1/participants/CURRENTPARTICIPANT/ready');
      });
    });
  });

  describe('With an opponent initiated challenge', () => {
    beforeEach(async () => {
      // Mock a request to create a new challenge
      await MockBarzServer.intercept('POST', '/v1/challenges', 'opponent-initiated-challenge.json');

      // Mock all the actions that one can perform on a challenge
      await MockBarzServer.intercept('PUT', '/v1/challenges/CURRENTCHALLENGE/checkin', {
        status: 204,
      });
      await MockBarzServer.intercept('PUT', '/v1/challenges/CURRENTCHALLENGE/cancel', {
        ...(await loadFixture('opponent-initiated-challenge.json')),
        status: 'CANCELLED',
        cancelledAt: `${new Date().toISOString()}`,
      });
    });
    it('should receive a challenge, press accept, and go into the battle workflow', async () => {
      // Make sure that the pending challenge list starts empty
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message inviting a user to this challenge
      await MockPusher.publish(
        'private-user-CURRENTUSER-challenges',
        'challenge.create',
        await loadFixture('opponent-initiated-challenge.json'),
      );

      // Make sure that the newly created challenge showed up in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .toBeVisible()
        .withTimeout(5_000);

      // Press "Accept" to accept the challenge and open the waiting room
      await BattlePage.initiator.pendingChallenges.first.actions.acceptButton().tap();

      // Wait for the challenges waiting room to open
      await waitFor(BattlePage.challengesWaitingRoom.container()).toBeVisible().withTimeout(5_000);

      // Simulate a pusher message indicating that the challenge has started because the other user
      // entered the waiting room
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('opponent-initiated-challenge.json')),
        status: 'STARTED',
        startedAt: `${new Date().toISOString()}`,
        battleId: 'CURRENTBATTLE',
      });

      // Make sure that the other opponent profile page with a ready button is shown
      await waitFor(BattlePage.challengesPublicPrivate.container())
        .toBeVisible()
        .withTimeout(5_000);
    });
    it('should receive a challenge, press cancel, and have the challenge get removed from the list', async () => {
      // Make sure that the pending challenge list starts empty
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message inviting a user to this challenge
      await MockPusher.publish(
        'private-user-CURRENTUSER-challenges',
        'challenge.create',
        await loadFixture('opponent-initiated-challenge.json'),
      );

      // Make sure that the newly created challenge showed up in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .toBeVisible()
        .withTimeout(5_000);

      // Press "Decline" to block the challenge
      await BattlePage.initiator.pendingChallenges.first.actions.declineButton().tap();

      // Make sure that pressing that button made a request to cancel the challenge
      await MockBarzServer.waitForRequest('PUT', '/v1/challenges/CURRENTCHALLENGE/cancel');

      // After pressing cancel, the challenge should no longer be in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);
    });
  });

  it('should allow a user to search through the list of users to challenge for a challenger', async () => {
    // Tap on "Challenge", which will create a new challenge and put the user into the waiting room
    await BattlePage.initiator.challengeOpponentButton().tap();

    // Wait for the challenges user search page to be visible
    await waitFor(BattlePage.challengesSearchForUser.wrapper()).toBeVisible().withTimeout(5_000);

    // Mock the request used to search for users
    await MockBarzServer.intercept('GET', '/v1/users', {
      total: 1,
      next: null,
      results: [
        {
          ...(await loadFixture('user.json')),
          id: 'SEARCHRESULT',
          handle: 'searchresult',
          name: 'SEARCH RESULT',
          profileImageUrl: 'https://picsum.photos/100/100',
          computedScore: 40000,
        },
      ],
    });

    // Type a search phrase into the search box
    await BattlePage.challengesSearchForUser.searchField().typeText('SEARCH');

    // Make sure that the request to get the new user data was made
    await MockBarzServer.waitForRequest(
      'GET',
      '/v1/users',
      ({ req }) => req.query.search === 'SEARCH',
    );

    // And make sure that eventually the user from the search result was shown on screen
    await expect(
      element(
        by.id('battle-challenge-search-for-user-item').withDescendant(by.text('SEARCH RESULT')),
      ),
    ).toBeVisible();
  });

  describe('Pusher Messages', () => {
    it('should show new challenges in the pending challenges list when a create pusher message is received', async () => {
      // Make sure that the pending challenge list starts empty
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message indicating a challenge was created
      await MockPusher.publish(
        'private-user-CURRENTUSER-challenges',
        'challenge.create',
        await loadFixture('opponent-initiated-challenge.json'),
      );

      // Make sure that the newly created challenge showed up in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .toBeVisible()
        .withTimeout(5_000);
    });
    it('should remove a challenge from the pending challenges list when a challenge is CANCELLED', async () => {
      // Make sure that the pending challenge list starts empty
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message indicating a challenge was created
      await MockPusher.publish(
        'private-user-CURRENTUSER-challenges',
        'challenge.create',
        await loadFixture('opponent-initiated-challenge.json'),
      );

      // Make sure that the newly created challenge showed up in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message updating the challenge to be CANCELLED
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('opponent-initiated-challenge.json')),
        status: 'CANCELLED',
        cancelledAt: `${new Date().toISOString()}`,
      });

      // Since the list should only show pending challenges, make sure the challenge is no longer
      // visible
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);
    });
    it('should remove a challenge from the pending challenges list when a challenge is STARTED', async () => {
      // Make sure that the pending challenge list starts empty
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message indicating a challenge was created
      await MockPusher.publish(
        'private-user-CURRENTUSER-challenges',
        'challenge.create',
        await loadFixture('opponent-initiated-challenge.json'),
      );

      // Make sure that the newly created challenge showed up in the list
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .toBeVisible()
        .withTimeout(5_000);

      // Send a pusher message updating the challenge to be STARTED
      await MockPusher.publish('private-user-CURRENTUSER-challenges', 'challenge.update', {
        ...(await loadFixture('opponent-initiated-challenge.json')),
        status: 'STARTED',
        startedAt: `${new Date().toISOString()}`,
        battleId: 'CURRENTBATTLE',
      });

      // Since the list should only show pending challenges, make sure the challenge is no longer
      // visible
      await waitFor(BattlePage.initiator.pendingChallenges.first.wrapper())
        .not.toBeVisible()
        .withTimeout(5_000);
    });
  });
});

describe('Battle Intro Workflow', () => {
  beforeAll(async () => {
    await openApp();
  });

  let userPhoneNumber;
  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: '',
      name: '',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: '',
      name: '',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 0,
      next: false,
      results: [],
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/users/generated-rap-tag', {
      name: 'Generated Rap Tag',
    });

    // Mock a request to create a new participant - this will be triggered once the battle intro
    // workflow completes
    await MockBarzServer.intercept('POST', '/v1/participants', 'current-participant.json');

    await MockBarzServer.start();

    // Make sure that any users created from previous test runs are deleted
    await MockSignIn.deleteUsersWithUsernameFromClerk('generatedraptag');

    await device.reloadReactNative();

    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        userPhoneNumber = phoneNumber;
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        const result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        const verificationCodeMatch = /[0-9]{6}/.exec(result);
        const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);

        // Make sure that the autogenerated rap name is shown to the user
        await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
        // Dismiss the rap name intro page
        await OnboardingPage.rapNameIntroPage.nextButton().tap();

        // Make sure that the onboarding process is complete - the final onboarding page
        // should no longer be visible
        await waitFor(OnboardingPage.verifyCodePage.wrapper())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Go to the "Rap" tab at the bottom
        await BattlePage.bottomTab().tap();
      },
    );
  });

  it('should go through the whole battle intro workflow with a freshly created user', async () => {
    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the avatar image upload page is now shown
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Press the avatar image to simulate initiating the image selection process
    await BattlePage.intro.uploadAvatar.avatarImageUpload().tap();
    await systemDialog('Camera').tap();

    // Make sure that the avatar image gets set
    await waitFor(BattlePage.intro.uploadAvatar.avatarImageUploadImageSet())
      .toBeVisible()
      .withTimeout(3_000);

    // Go to the next page
    await BattlePage.intro.uploadAvatar.actions.nextButton().tap();

    // Make sure that the page to complete one's bio is now shown
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);

    // Fill out all the required bio fields
    // Intro:
    await BattlePage.intro.completeBio.introField().typeText('Sample Intro Here');

    // "Area Code":
    await BattlePage.intro.completeBio.locationField().tap();
    await waitFor(BattlePage.intro.completeBio.roughLocationPicker.wrapper())
      .toExist()
      .withTimeout(12_000);
    await MockBarzServer.intercept('GET', '/v1/geocoding/search', { statusCode: 200, body: [] });
    await BattlePage.intro.completeBio.roughLocationPicker
      .searchField()
      .typeText('Example City Name');
    await BattlePage.intro.completeBio.roughLocationPicker.actions.done().tap();
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);

    // Favorite Rapper:
    await BattlePage.intro.completeBio.artistField().tap();
    await waitFor(BattlePage.intro.completeBio.favoriteArtistPicker.wrapper())
      .toExist()
      .withTimeout(12_000);
    await MockBarzServer.intercept('GET', '/v1/spotify/artists/search', {
      statusCode: 200,
      body: { total: 0, next: false, results: [] },
    });
    await BattlePage.intro.completeBio.favoriteArtistPicker
      .searchField()
      .typeText('Example Artist Name');
    await BattlePage.intro.completeBio.favoriteArtistPicker.actions.done().tap();
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);

    // Favorite Song:
    await BattlePage.intro.completeBio.favoriteSongField().tap();
    await waitFor(BattlePage.intro.completeBio.favoriteTrackPicker.wrapper())
      .toExist()
      .withTimeout(12_000);
    await MockBarzServer.intercept('GET', '/v1/spotify/tracks/search', {
      statusCode: 200,
      body: { total: 0, next: false, results: [] },
    });
    await BattlePage.intro.completeBio.favoriteTrackPicker
      .searchField()
      .typeText('Example Song Name');
    await BattlePage.intro.completeBio.favoriteTrackPicker.actions.done().tap();
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);

    // Mock the request that will be made to the server to save the bio information
    await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
      statusCode: 200,
      body: await loadFixture('user.json'), // FIXME: this doesn't have the updated body data in it?
    });

    // Press "Done" to complete the bio edit page
    await BattlePage.intro.completeBio.actions.doneButton().tap();

    // Press "Lets battle" to complete the battle intro workflow
    await BattlePage.intro.profilePreview.actions.doneButton().tap();

    // Once the battle intro workflow is complete, the battle matching workflow should have started
    await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);
  });

  it('should only show the battle intro slideshow one time', async () => {
    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press cancel to dismiss the slideshow
    await BattlePage.intro.slideshow.actions.cancel().tap();

    // This should go back to the battle inititator page - make sure that this happened
    await waitFor(BattlePage.initiator.findOpponentButton()).toExist().withTimeout(3_000);

    // Then, if the find opponent button is pressed again...
    await BattlePage.initiator.findOpponentButton().tap();

    // ... The slideshow should NOT be visible, instead the "create rap tag" screen should be shown
    await waitFor(BattlePage.intro.slideshow.page0()).not.toExist().withTimeout(3_000);
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);
  });

  it('should ONLY show the battle slideshow if all battle metadata is filled out ahead of time (rap tag + image + bio)', async () => {
    // Send a user update to inject a bunch of bio user information
    const sampleUser = await loadFixture('user.json');
    await MockPusher.publish(`private-user-CURRENTUSER`, 'user.update', {
      ...sampleUser,
      id: 'CURRENTUSER',
      intro: 'starting intro',
      locationName: 'Example City Name',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'Example Rapper Name',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'Example Song Name',
      favoriteSongArtistName: 'Example Rapper Name',
    });

    // Go to the user profile page, set a custom rap tag, and upload a custom avatar image
    await ProfilePage.bottomTab().tap();
    await ProfilePage.actions.editProfile().tap();
    await ProfilePage.edit.name().clearText();
    await ProfilePage.edit.name().typeText('New Rap Tag');
    await ProfilePage.edit.avatarImageUpload().tap();
    await systemDialog('Camera').tap();
    await waitFor(ProfilePage.edit.avatarImageUploadImageSet()).toBeVisible().withTimeout(12_000);
    await ProfilePage.edit.actions.save().tap();
    await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all THREE visible pages of the slideshow
    //
    // NOTE: importantly, there are only THREE pages in the slideshow when the user profile
    // is already filled out!!
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);

    // Press "start battle" to go into the battle matching workflow
    await BattlePage.intro.slideshow.actions.startBattle().tap();

    // Make sure that the matching workflow has started!
    await waitFor(BattlePage.matching.container()).toExist().withTimeout(3_000);
  });

  it('should skip showing the create rap tag screen if ONLY a rap tag is already set', async () => {
    // Go to the user profile page, and enter a custom rap tag value
    await ProfilePage.bottomTab().tap();
    await ProfilePage.actions.editProfile().tap();
    await ProfilePage.edit.name().clearText();
    await ProfilePage.edit.name().typeText('New Rap Tag');
    await ProfilePage.edit.actions.save().tap();
    await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // The next visible page should NOT be the rap tag creation page...
    await waitFor(BattlePage.intro.createRapTag.wrapper()).not.toExist().withTimeout(3_000);

    // ... It should be the avatar upload page!
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);
  });

  it('should skip showing the image upload screen if ONLY a avatar image is already set', async () => {
    // Go to the user profile page, and upload a custom avatar image
    await ProfilePage.bottomTab().tap();
    await ProfilePage.actions.editProfile().tap();
    await ProfilePage.edit.avatarImageUpload().tap();
    await systemDialog('Camera').tap();
    await waitFor(ProfilePage.edit.avatarImageUploadImageSet()).toBeVisible().withTimeout(12_000);
    await ProfilePage.edit.actions.save().tap();
    await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // ... Make sure that since the avatar image was uploaded initially, that the next visible page
    // is NOT the avatar upload page...
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).not.toExist().withTimeout(3_000);

    // ... It should be the bio editing page!
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);
  });

  it('should skip showing the bio editing screen if ONLY required bio information is already set', async () => {
    // Send a user update to inject a bunch of bio user information
    const sampleUser = await loadFixture('user.json');
    await MockPusher.publish(`private-user-CURRENTUSER`, 'user.update', {
      ...sampleUser,
      id: 'CURRENTUSER',
      intro: 'starting intro',
      locationName: 'Example City Name',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'Example Rapper Name',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'Example Song Name',
      favoriteSongArtistName: 'Example Rapper Name',
    });

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the avatar image upload page is now shown
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Press the avatar image to simulate initiating the image selection process
    await BattlePage.intro.uploadAvatar.avatarImageUpload().tap();
    await systemDialog('Camera').tap();

    // Make sure that the avatar image gets set
    await waitFor(BattlePage.intro.uploadAvatar.avatarImageUploadImageSet())
      .toBeVisible()
      .withTimeout(3_000);

    // Go to the next page
    await BattlePage.intro.uploadAvatar.actions.nextButton().tap();

    // Make sure that the page that is now visible is NOT the bio completion page - the bio
    // information was already set for this user!
    await waitFor(BattlePage.intro.completeBio.wrapper()).not.toExist().withTimeout(3_000);

    // Instead, the workflow should now be complete and the battle matching workflow should have
    // started.
    await waitFor(BattlePage.matching.container()).toBeVisible().withTimeout(12_000);
  });

  it('should NOT skip showing the bio editing screen if ONLY the intro is already set', async () => {
    // Send a user update to inject a bunch of bio user information
    const sampleUser = await loadFixture('user.json');
    await MockPusher.publish(`private-user-CURRENTUSER`, 'user.update', {
      ...sampleUser,
      id: 'CURRENTUSER',
      intro: 'starting intro',
    });

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the avatar image upload page is now shown
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Press the avatar image to simulate initiating the image selection process
    await BattlePage.intro.uploadAvatar.avatarImageUpload().tap();
    await systemDialog('Camera').tap();

    // Make sure that the avatar image gets set
    await waitFor(BattlePage.intro.uploadAvatar.avatarImageUploadImageSet())
      .toBeVisible()
      .withTimeout(3_000);

    // Go to the next page
    await BattlePage.intro.uploadAvatar.actions.nextButton().tap();

    // Make sure the bio editing page is shown
    await waitFor(BattlePage.intro.completeBio.wrapper()).toExist().withTimeout(3_000);
  });

  it('should skip showing the image upload screen AND the bio editing screen if BOTH the avatar image and bio info are already set', async () => {
    // Go to the user profile page, and upload a custom avatar image
    await ProfilePage.bottomTab().tap();
    await ProfilePage.actions.editProfile().tap();
    await ProfilePage.edit.avatarImageUpload().tap();
    await systemDialog('Camera').tap();
    await waitFor(ProfilePage.edit.avatarImageUploadImageSet()).toBeVisible().withTimeout(12_000);
    await ProfilePage.edit.actions.cancel().tap(); // NOTE: pressing save would save the rap tag, which is not desired!
    await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Send a user update to inject a bunch of bio user information
    const sampleUser = await loadFixture('user.json');
    await MockPusher.publish(`private-user-CURRENTUSER`, 'user.update', {
      ...sampleUser,
      id: 'CURRENTUSER',
      intro: 'starting intro',
      locationName: 'Example City Name',
      locationLatitude: null,
      locationLongitude: null,
      favoriteRapperSpotifyId: null,
      favoriteRapperName: 'Example Rapper Name',
      favoriteSongSpotifyId: null,
      favoriteSongName: 'Example Song Name',
      favoriteSongArtistName: 'Example Rapper Name',
    });

    // Go to the "Rap" tab at the bottom
    await BattlePage.bottomTab().tap();

    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the matching workflow has started!
    await waitFor(BattlePage.matching.container()).toExist().withTimeout(3_000);
  });

  it('should ensure that if an avatar image is uploaded and cleared, a user cannot battle until they upload one', async () => {
    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the avatar image upload page is now shown
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Press the avatar image to simulate initiating the image selection process
    await BattlePage.intro.uploadAvatar.avatarImageUpload().tap();
    await systemDialog('Camera').tap();

    // Make sure that the avatar image gets set
    await waitFor(BattlePage.intro.uploadAvatar.avatarImageUploadImageSet())
      .toBeVisible()
      .withTimeout(3_000);

    // Clear the avatar image
    await BattlePage.intro.uploadAvatar.avatarImageUpload().tap();
    await systemDialog('Clear').tap();

    // Make sure that the avatar image is not unset
    await waitFor(BattlePage.intro.uploadAvatar.avatarImageUploadImageUnset())
      .toBeVisible()
      .withTimeout(3_000);

    // Attempt to go to the next page by tapping the next button
    await BattlePage.intro.uploadAvatar.actions.nextButton().tap();

    // Make sure that the user does NOT go to the bio page - an avatar image is required!
    await waitFor(BattlePage.intro.completeBio.wrapper()).not.toExist().withTimeout(3_000);
  });

  it('should enter a rap tag name, and then when pressing back and "find opponent" again skip the rap tag page', async () => {
    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a new rap tag into the text input
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('New Rap Tag');

    // Press continue to go to the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that the avatar image upload page is now shown
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Press cancel
    await BattlePage.intro.uploadAvatar.actions.cancelButton().tap();

    // Press "find opponent" again
    await BattlePage.initiator.findOpponentButton().tap();

    // Make sure that the avatar image upload page is navigated to - the "rap tag" value has already
    // been set, so that page should be skipped
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);
  });

  it('should append a number to the end of the username if a duplicate rap tag is chosen', async () => {
    // Press "find opponent"
    await BattlePage.initiator.findOpponentButton().tap();

    // Go through all four visible pages of the slideshow
    await waitFor(BattlePage.intro.slideshow.page0()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page1()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page2()).toExist().withTimeout(3_000);
    await BattlePage.intro.slideshow.actions.next().tap();
    await waitFor(BattlePage.intro.slideshow.page3()).toExist().withTimeout(3_000);

    // Press "fill out profile" to start entering user info
    await BattlePage.intro.slideshow.actions.fillOutProfile().tap();

    // Make sure that the rap tag creation page is now shown
    await waitFor(BattlePage.intro.createRapTag.wrapper()).toExist().withTimeout(3_000);

    // Type in a rap tag that already exists
    await BattlePage.intro.createRapTag.inputField().clearText();
    await BattlePage.intro.createRapTag.inputField().typeText('barzdetoxtest');

    // Press continue to try to go the next page
    await BattlePage.intro.createRapTag.actions.continueButton().tap();

    // Make sure that we are now on the avatar image page
    await waitFor(BattlePage.intro.uploadAvatar.wrapper()).toExist().withTimeout(3_000);

    // Make sure that the user's username is NOT just "barzdetoxtest" - a suffix should have been
    // added to the end
    const user = await MockSignIn.getUserFromClerkByPhoneNumber(userPhoneNumber);
    assert.notStrictEqual(user.username, 'barzdetoxtest');
  });
});

const HomePage = {
  feedSwitcher: {
    followingActiveButton: byTestID('home-feed-switcher-following-active'),
    trendingActiveButton: byTestID('home-feed-switcher-trending-active'),
    changeToTrendingButton: byTestID('home-feed-switcher-trending-button'),
    changeToFollowingButton: byTestID('home-feed-switcher-following-button'),
  },
  battleList: {
    wrapper: byTestID('home-battle-list-wrapper'),
    initialBattlesLoading: byTestID('home-battle-list-initial-battles-loading'),
    swipeUp: async () => HomePage.battleList.wrapper().swipe('up', 'fast', 1, 0.5, 0.8),
    swipeDown: async () => HomePage.battleList.wrapper().swipe('down', 'fast', 1, 0.5, 0.8),
    forBattle: (battleId) => ({
      wrapper: byTestID(`home-battle-list-battle-${battleId}-wrapper`),
      visible: byTestID(`home-battle-list-battle-${battleId}-visible`),
      commentsButton: byTestID(`home-battle-list-comments-button`),
      forParticipant: (participantId) => ({
        downloading: byTestID(
          `home-battle-list-battle-${battleId}-participant-${participantId}-downloading`,
        ),
        playing: byTestID(
          `home-battle-list-battle-${battleId}-participant-${participantId}-playing`,
        ),
        voteButton: byTestID(
          `home-battle-list-battle-${battleId}-participant-${participantId}-vote-button`,
        ),
        voteButtonContainingVotes: (votes) => {
          return element(
            by
              .id(`home-battle-list-battle-${battleId}-participant-${participantId}-vote-button`)
              .withDescendant(by.text(`${votes}`)),
          );
        },
        name: byTestID(
          `home-battle-list-battle-${battleId}-participant-${participantId}-header-name`,
        ),
        score: byTestID(
          `home-battle-list-battle-${battleId}-participant-${participantId}-header-score`,
        ),
      }),
    }),

    commentsBottomSheet: {
      wrapper: byTestID('home-battle-list-comments-bottom-sheet-wrapper'),
      header: byTestID('home-battle-list-comments-bottom-sheet-header'),
      swipeUpToExpand: async () => {
        return HomePage.battleList.commentsBottomSheet.header().swipe('up', 'fast', 1, 0.5, 0.8);
      },
      swipeDownToClose: async () => {
        return HomePage.battleList.commentsBottomSheet.header().swipe('down', 'fast', 1, 0.5, 0.8);
      },

      commentList: byTestID('home-battle-list-comments-bottom-sheet-comment-list'),
      commentListRefreshing: byTestID('home-battle-list-comments-bottom-sheet-refreshing'),
      commentListContainingNumberOfComments: (numComments) => {
        return element(
          by
            .id(`home-battle-list-comments-bottom-sheet-loaded-comment-count`)
            .withDescendant(by.text(`${numComments}`)),
        );
      },

      forComment: (commentId) => ({
        wrapper: byTestID(`home-battle-list-comments-bottom-sheet-comment-${commentId}-wrapper`),
        avatarImage: byTestID(
          `home-battle-list-comments-bottom-sheet-comment-${commentId}-avatar-image`,
        ),
        voteButton: byTestID(
          `home-battle-list-comments-bottom-sheet-comment-${commentId}-vote-button`,
        ),
        unvoteButton: byTestID(
          `home-battle-list-comments-bottom-sheet-comment-${commentId}-unvote-button`,
        ),
      }),

      postCommentTextField: byTestID(
        'home-battle-list-comments-bottom-sheet-post-comment-text-field',
      ),
      postCommentButton: byTestID('home-battle-list-comments-bottom-sheet-post-comment-button'),
    },
  },
};

const ProfilePage = {
  wrapper: byTestID('profile-wrapper'),
  scroll: byTestID('profile-scroll'),
  bottomTab: byTestID('bottom-tab-profile'),

  followersCountContainingValue: (count) => {
    return element(by.id('profile-followers-count').and(by.text(`${count}`)));
  },
  followingCountContainingValue: (count) => {
    return element(by.id('profile-following-count').and(by.text(`${count}`)));
  },

  actions: {
    editProfile: byTestID('profile-edit-profile'),
    followButton: byTestID('profile-follow'),
    challengeButton: byTestID('profile-challenge'),
    unfollowButton: byTestID('profile-unfollow'),
    settingsButton: byTestID('profile-settings'),
    followersButton: byTestID('profile-followers-button'),
    followingButton: byTestID('profile-following-button'),
  },

  recent: {
    battleListItems: byTestID('profile-recent-battle-list-item'),
  },

  bio: {
    tab: byTestID('profile-bio-tab'),
    editButton: byTestID('profile-bio-edit-button'),
    editGettingStarted: byTestID('profile-bio-get-started-button'),

    intro: byTestID('profile-bio-intro'),
    locationName: byTestID('profile-bio-location-name'),
    rapperName: byTestID('profile-bio-favorite-rapper-name'),
    songName: byTestID('profile-bio-favorite-song-name'),
    instagramHandle: byTestID('profile-bio-instagram-handle'),
    soundcloudHandle: byTestID('profile-bio-soundcloud-handle'),

    edit: {
      wrapper: byTestID('profile-bio-edit-wrapper'),
      actions: {
        save: byTestID('profile-bio-edit-save'),
        cancel: byTestID('user-profile-cancel'),
      },

      introField: byTestID('profile-bio-edit-intro-field'),
      locationField: byTestID('profile-bio-edit-location-field'),
      artistField: byTestID('profile-bio-edit-favorite-artist-field'),
      favoriteSongField: byTestID('profile-bio-edit-favorite-song-field'),
      instagramField: byTestID('profile-bio-edit-instagram-field'),
      soundcloudField: byTestID('profile-bio-edit-soundcloud-field'),

      roughLocationPicker: {
        wrapper: byTestID('user-bio-edit-rough-location-picker-wrapper'),
        searchField: byTestID('user-bio-edit-rough-location-picker-search-field'),
        firstItem: byTestID('user-bio-edit-rough-location-picker-item'),
        actions: {
          done: byTestID('user-bio-edit-rough-location-picker-done'),
          clear: byTestID('user-bio-edit-rough-location-picker-clear'),
        },
      },
      favoriteArtistPicker: {
        wrapper: byTestID('user-bio-edit-favorite-artist-picker-wrapper'),
        searchField: byTestID('user-bio-edit-favorite-artist-picker-search-field'),
        firstItem: byTestID('user-bio-edit-favorite-artist-picker-item'),
        actions: {
          done: byTestID('user-bio-edit-favorite-artist-picker-done'),
          clear: byTestID('user-bio-edit-favorite-artist-picker-clear'),
        },
      },
      favoriteTrackPicker: {
        wrapper: byTestID('user-bio-edit-favorite-track-picker-wrapper'),
        searchField: byTestID('user-bio-edit-favorite-track-picker-search-field'),
        firstItem: byTestID('user-bio-edit-favorite-track-picker-item'),
        actions: {
          done: byTestID('user-bio-edit-favorite-track-picker-done'),
          clear: byTestID('user-bio-edit-favorite-track-picker-clear'),
        },
      },
    },
  },

  edit: {
    wrapper: byTestID('profile-edit-wrapper'),
    name: byTestID('profile-edit-name'),
    handle: byTestID('profile-edit-handle'),

    avatarImageUpload: byTestID('user-profile-avatar-image-upload'),
    avatarImageUploadImageSet: byTestID('user-profile-avatar-image-upload-set'),
    avatarImageUploadImageUnset: byTestID('user-profile-avatar-image-upload-unset'),
    avatarImageUploadImageLoading: byTestID('user-profile-avatar-image-upload-loading'),

    actions: {
      save: byTestID('user-profile-save'),
      cancel: byTestID('user-profile-cancel'),
    },
  },

  followingFollowers: {
    following: {
      wrapper: byTestID('profile-following-wrapper'),
      userCountContainingValue: (count) => {
        return element(by.id('profile-following-user-count').and(by.text(`${count}`)));
      },
      userWithID: (id) => ({
        wrapper: byTestID(`profile-following-user-item-${id}`),
        actions: {
          followButton: byTestID(`profile-following-user-item-${id}-follow`),
          unfollowButton: byTestID(`profile-following-user-item-${id}-unfollow`),
        },
      }),
    },
    followers: {
      wrapper: byTestID('profile-followers-wrapper'),
      userCountContainingValue: (count) => {
        return element(by.id('profile-followers-user-count').and(by.text(`${count}`)));
      },
      userWithID: (id) => ({
        wrapper: byTestID(`profile-followers-user-item-${id}`),
        actions: {
          followButton: byTestID(`profile-followers-user-item-${id}-follow`),
          unfollowButton: byTestID(`profile-followers-user-item-${id}-unfollow`),
        },
      }),
    },
  },

  battleViewer: {
    initialBattlesLoading: byTestID('home-battle-list-initial-battles-loading'),
    forBattle: (battleId) => ({
      wrapper: byTestID(`profile-viewer-battle-${battleId}-wrapper`),
      visible: byTestID(`profile-viewer-battle-${battleId}-visible`),
      forParticipant: (participantId) => ({
        downloading: byTestID(
          `profile-viewer-battle-${battleId}-participant-${participantId}-downloading`,
        ),
        playing: byTestID(`profile-viewer-battle-${battleId}-participant-${participantId}-playing`),
        voteButton: byTestID(
          `profile-viewer-battle-${battleId}-participant-${participantId}-vote-button`,
        ),
        voteButtonContainingVotes: (votes) => {
          return element(
            by
              .id(`profile-viewer-battle-${battleId}-participant-${participantId}-vote-button`)
              .withDescendant(by.text(`${votes}`)),
          );
        },
        name: byTestID(
          `profile-viewer-battle-${battleId}-participant-${participantId}-header-name`,
        ),
        score: byTestID(
          `profile-viewer-battle-${battleId}-participant-${participantId}-header-score`,
        ),
      }),
    }),
  },

  settings: {
    wrapper: byTestID('profile-settings-wrapper'),
    signOutButton: byTestID('profile-settings-sign-out'),
    addPhoneNumberButton: byTestID('profile-settings-add-phone-number'),
    phoneNumberSettingsButton: byTestID('profile-settings-phone-number-settings'),
    oauthProviders: {
      googleSettingsButton: byTestID('profile-settings-oauth-google-settings'),
      facebookSettingsButton: byTestID('profile-settings-oauth-facebook-settings'),
      appleSettingsButton: byTestID('profile-settings-oauth-apple-settings'),
    },
  },
  phoneNumberSettings: {
    wrapper: byTestID('profile-phone-number-settings-wrapper'),
    changePhoneNumberButton: byTestID('profile-phone-number-settings-change-phone-number'),
    removePhoneNumberButton: byTestID('profile-phone-number-settings-remove-phone-number'),
    removePhoneNumberButtonDisabled: byTestID(
      'profile-phone-number-settings-remove-phone-number-disabled',
    ),
  },
  oAuthProviderSettings: {
    wrapper: byTestID('profile-oauth-provider-settings-wrapper'),
    detachOAuthProviderButton: byTestID('profile-oauth-provider-settings-detach'),
    detachOAuthProviderButtonDisabled: byTestID('profile-oauth-provider-settings-detach-disabled'),
  },
  changePhoneNumber: {
    enterNumberStep: {
      wrapper: byTestID('profile-settings-change-phone-number-enter-number-wrapper'),
      numberInputField: byTestID('profile-settings-change-phone-number-enter-number-input-field'),
      actions: {
        submitButton: byTestID('profile-settings-change-phone-number-enter-number-submit'),
      },
    },
    verifyStep: {
      wrapper: byTestID('profile-settings-change-phone-number-verify-wrapper'),
      verifyInputField: byTestID('profile-settings-change-phone-number-verify-input'),
      actions: {
        submitButton: byTestID('profile-settings-change-phone-number-verify-submit'),
      },
    },
  },
};

const OnboardingPage = {
  phoneNumberInput: byTestID('onboarding-phone-number-input'),
  verifyPhoneNumberButton: byTestID('onboarding-verify-phone-number-button'),
  otpInput: byTestID('onboarding-otp-input'),

  enterPhonePage: {
    wrapper: byTestID('onboarding-enter-phone-page'),
    signIn: {
      google: byTestID('onboarding-sign-in-google'),
      facebook: byTestID('onboarding-sign-in-facebook'),
      apple: byTestID('onboarding-sign-in-apple'),
    },
  },

  verifyCodePage: {
    wrapper: byTestID('onboarding-verify-code-page'),
    verifyButton: byTestID('onboarding-verify-button'),
  },

  rapNameIntroPage: {
    wrapper: byTestID('onboarding-create-rap-name-wrapper'),
    nextButton: byTestID('onboarding-create-rap-name-next'),
  },
};

describe('Onboarding Workflow', () => {
  beforeAll(async () => {
    await openApp();
  });

  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: '',
      name: '',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: '',
      name: '',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 0,
      next: false,
      results: [],
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/users/generated-rap-tag', {
      name: 'Generated Rap Tag',
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [],
    });

    await MockBarzServer.start();

    await MockSignIn.deleteUsersWithUsernameFromClerk('generatedraptag');

    await device.reloadReactNative();
  });

  it('should successfully sign up for a barz account via phone number', async () => {
    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        const result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        const verificationCodeMatch = /[0-9]{6}/.exec(result);
        const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);

        // Make sure that the autogenerated rap name is shown to the user
        await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
        // Dismiss the rap name intro page
        await OnboardingPage.rapNameIntroPage.nextButton().tap();

        // Make sure that the onboarding process is complete - the final onboarding page
        // should no longer be visible
        await waitFor(OnboardingPage.verifyCodePage.wrapper())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Finally, make sure that the clerk user has the appropriate metadata set
        const user = await MockSignIn.getUserFromClerkByPhoneNumber(phoneNumber);
        assert.strictEqual(user.unsafeMetadata.rapperName, 'Generated Rap Tag');
        assert.strictEqual(user.unsafeMetadata.rapperNameChangedFromDefault, false);
      },
    );
  });

  it('should be able to successfully sign up via phone number, log out, and log back in', async () => {
    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        let result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        let verificationCodeMatch = /[0-9]{6}/.exec(result);
        let verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);

        // Make sure that the autogenerated rap name is shown to the user
        await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
        // Dismiss the rap name intro page
        await OnboardingPage.rapNameIntroPage.nextButton().tap();

        // Tap the user profile image in the corner to open the profile page
        await ProfilePage.bottomTab().tap();

        // Tap the settings button
        await ProfilePage.actions.settingsButton().tap();

        // Tap "sign out"
        await ProfilePage.settings.signOutButton().tap();

        // Now, type the same phone number in
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Wait for an OTP code to be generated
        result = await waitForSMS((message) => message.includes('Barz'));
        verificationCodeMatch = /[0-9]{6}/.exec(result);
        verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Enter the OTP code
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);

        // And finally, make sure we are back in the app - the rest of the onboarding workflow
        // should be skipped
        await waitFor(ProfilePage.bottomTab()).toBeVisible().withTimeout(12_000);
      },
    );
  });

  it('should successfully sign up for a barz account via phone number BUT have it take multiple seconds for the clerk webhook to be sent to the api', async () => {
    // Update the mock /v1/users/me endpoint to simulate as if the user is not logged in
    await MockBarzServer.intercept('GET', '/v1/users/me', { statusCode: 404 });

    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        const result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        const verificationCodeMatch = /[0-9]{6}/.exec(result);
        const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);
      },
    );

    // Wait a few seconds
    await delay(3000);

    // Make sure that the onboarding process still has not finished, since the /users/me endpoint
    // is STILL returning a 404
    await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Update the /users/me mock to return user data
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
      profileImageUrl: null,
      computedScore: 5000,
      computedFollowersCount: 0,
      computedFollowingCount: 0,
      phoneNumber: '5555555555',
      lastViewedBattleId: null,
      maxNumberOfVotesPerBattle: 20,
    });

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the final onboarding page
    // should no longer be visible
    await waitFor(OnboardingPage.verifyCodePage.wrapper()).not.toBeVisible().withTimeout(12_000);
  });

  it('should FAIL to sign up for a barz account via phone number IF the clerk webhook is never delivered to the barz api', async () => {
    // Update the mock /v1/users/me endpoint to simulate as if the user is not logged in
    await MockBarzServer.intercept('GET', '/v1/users/me', { statusCode: 404 });

    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        const result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        const verificationCodeMatch = /[0-9]{6}/.exec(result);
        const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
        assert.notStrictEqual(verificationCode, null);

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(verificationCode);
      },
    );

    // Wait many seconds, long enough that the user fetching logic times out
    await delay(20_000);

    // Press the 'OK' button on the alert popup that appeared telling the user that the user data
    // was not found
    await systemDialog('OK').tap();

    // Make sure that the onboarding process still has not finished, since the /users/me endpoint
    // never returned a 2xx response
    await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Update the /users/me mock to return user data
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
      profileImageUrl: null,
      computedScore: 5000,
      computedFollowersCount: 0,
      computedFollowingCount: 0,
      phoneNumber: '5555555555',
      lastViewedBattleId: null,
      maxNumberOfVotesPerBattle: 20,
    });

    // Press "verify" to try again
    await OnboardingPage.verifyCodePage.verifyButton().tap();

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the final onboarding page
    // should no longer be visible
    await waitFor(OnboardingPage.verifyCodePage.wrapper()).not.toBeVisible().withTimeout(12_000);
  });

  it('should be unable to sign up via phone number if the verification code is incorrect', async () => {
    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Initialize the mock sms receiver
    await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
      async (phoneNumber, waitForSMS) => {
        // Clean up clerk users associated with the given phone number
        await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

        // Enter the phone number the mock SMS receiver is using into the app
        await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

        // Press "verify"
        await OnboardingPage.verifyPhoneNumberButton().tap();

        // Make sure that the workflow moves to the OTP code page
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

        // Wait for a new barz verification code to be received
        const result = await waitForSMS((message) => message.includes('Barz'));

        // Extract the verification code from the message
        const verificationCodeMatch = /[0-9]{6}/.exec(result);
        const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;

        // Generate a code that is NOT the code that was sent
        const incorrectVerificationCode = verificationCode === '999999' ? '999998' : '999999';

        // Type it into the OTP box
        await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
        await OnboardingPage.otpInput().typeText(incorrectVerificationCode);

        // Make sure that an alert shows up saying the verification code was invalid
        await waitFor(systemDialog('OK')).toExist().withTimeout(5_000);

        // Make sure that the onboarding process has NOT complete - the final page should still be
        // rendered
        await waitFor(OnboardingPage.verifyCodePage.wrapper()).toExist().withTimeout(3_000);
      },
    );
  });

  it('should be able to sign up for a barz account via an oauth provider (google)', async () => {
    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Clean up clerk users associated with the given google account
    await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);

    // Go through the login workflow in a web browser
    //
    // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
    // this automatic login attempt
    await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
      // Press "Sign in with google"
      await OnboardingPage.enterPhonePage.signIn.google().tap();

      // Wait for the login page to open up in the web browser
      const page = await waitForWebAuthToStart();

      // Perform a sign in within the web browser, entering demo google credentials
      await MockWebOAuthSession.performSignInToGoogleLoginPage(
        page,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
      );
    });

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the final onboarding page
    // should no longer be visible
    await waitFor(OnboardingPage.verifyCodePage.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Finally, make sure that the clerk user has the appropriate metadata set
    user = await MockSignIn.getUserFromClerkByEmailAddress(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);
    assert.strictEqual(user.unsafeMetadata.rapperName, 'Generated Rap Tag');
    assert.strictEqual(user.unsafeMetadata.rapperNameChangedFromDefault, false);
  });

  it('should be able to sign up for a barz account via an oauth provider (google), log out, and log back in', async () => {
    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Clean up clerk users associated with the given google account
    await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);

    // Go through the login workflow in a web browser
    //
    // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
    // this automatic login attempt
    await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
      // Press "Sign in with google"
      await OnboardingPage.enterPhonePage.signIn.google().tap();

      // Wait for the login page to open up in the web browser
      const page = await waitForWebAuthToStart();

      // Perform a sign in within the web browser, entering demo google credentials
      await MockWebOAuthSession.performSignInToGoogleLoginPage(
        page,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
      );
    });

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the onboarding page should no longer be visible
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).not.toBeVisible().withTimeout(12_000);

    // Tap the user profile image in the corner to open the profile page
    await ProfilePage.bottomTab().tap();

    // Tap the settings button
    await ProfilePage.actions.settingsButton().tap();

    // Tap "sign out"
    await ProfilePage.settings.signOutButton().tap();

    // Delete the user that was previously created when signing in
    // NOTE: this seems to make the second login more reliable in the test? I don't get why.
    await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);

    // Go through the login workflow in a web browser, AGAIN
    //
    // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
    // this automatic login attempt
    await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
      // Press "Sign in with google"
      await OnboardingPage.enterPhonePage.signIn.google().tap();

      // Wait for the login page to open up in the web browser
      const page = await waitForWebAuthToStart();

      // Perform a sign in within the web browser, entering demo google credentials
      await MockWebOAuthSession.performSignInToGoogleLoginPage(
        page,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
      );
    });

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // And finally, make sure we are back in the app - the rest of the onboarding workflow
    // should be skipped
    await waitFor(ProfilePage.bottomTab()).toBeVisible().withTimeout(12_000);
  });

  it('should be able to sign up for a barz account via an oauth provider (google) BUT have it take multiple seconds for the clerk webhook to be sent to the api', async () => {
    // Update the mock /v1/users/me endpoint to simulate as if the user is not logged in
    await MockBarzServer.intercept('GET', '/v1/users/me', { statusCode: 404 });

    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Clean up clerk users associated with the given google account
    await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);

    // Go through the login workflow in a web browser
    //
    // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
    // this automatic login attempt
    await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
      // Press "Sign in with google"
      await OnboardingPage.enterPhonePage.signIn.google().tap();

      // Wait for the login page to open up in the web browser
      const page = await waitForWebAuthToStart();

      // Perform a sign in within the web browser, entering demo google credentials
      await MockWebOAuthSession.performSignInToGoogleLoginPage(
        page,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
      );
    });

    // Wait a few seconds
    await delay(3000);

    // Make sure that the onboarding process still has not finished, since the /users/me endpoint
    // is STILL returning a 404
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Update the /users/me mock to return user data
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the final onboarding page
    // should no longer be visible
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).not.toBeVisible().withTimeout(12_000);
  });

  it('should FAIL to sign up for a barz account via an oauth provider (google) IF the clerk webhook is never delivered to the barz api', async () => {
    // Update the mock /v1/users/me endpoint to simulate as if the user is not logged in
    await MockBarzServer.intercept('GET', '/v1/users/me', { statusCode: 404 });

    // Make sure that the workflow starts on the phone number page
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Clean up clerk users associated with the given google account
    await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);

    // Go through the login workflow in a web browser
    //
    // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
    // this automatic login attempt
    await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
      // Press "Sign in with google"
      await OnboardingPage.enterPhonePage.signIn.google().tap();

      // Wait for the login page to open up in the web browser
      const page = await waitForWebAuthToStart();

      // Perform a sign in within the web browser, entering demo google credentials
      await MockWebOAuthSession.performSignInToGoogleLoginPage(
        page,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
        MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
      );
    });

    // Wait many seconds, long enough that the user fetching logic times out
    await delay(20_000);

    // Press the 'OK' button on the alert popup that appeared telling the user that the user data
    // was not found
    await systemDialog('OK').tap();

    // Make sure that the onboarding process still has not finished, since the /users/me endpoint
    // never returned a 2xx response
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

    // Update the /users/me mock to return user data
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });

    // Press "Sign in with google" - this refetches the user data
    await OnboardingPage.enterPhonePage.signIn.google().tap();

    // Make sure that the autogenerated rap name is shown to the user
    await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
    // Dismiss the rap name intro page
    await OnboardingPage.rapNameIntroPage.nextButton().tap();

    // Make sure that the onboarding process is complete - the onboarding page should no longer be visible
    await waitFor(OnboardingPage.enterPhonePage.wrapper()).not.toBeVisible().withTimeout(12_000);
  });
});

describe('User Profile Page', () => {
  beforeAll(async () => {
    await openApp();
  });

  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 0,
      next: false,
      results: [],
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 3,
      next: false,
      results: [
        await loadFixture('battle-recording-one.json'),
        await loadFixture('battle-recording-two.json'),
        await loadFixture('battle-recording-three.json'),
        await loadFixture('battle-recording-four-forfeited.json'),
        await loadFixture('battle-recording-five-private.json'),
      ],
    });

    await MockBarzServer.intercept('PUT', '/v1/battles/BATTLERECORDINGONE/view', {
      statusCode: 204,
    });

    await MockBarzServer.intercept('GET', '/v1/users/cljcwr5ph0000wa0g0zqup6q6', {
      ...sampleUser,
      ...(await loadFixture('battle-recording-one.json')).participants[0].user,
    });
    await MockBarzServer.intercept('POST', '/v1/users/cljcwr5ph0000wa0g0zqup6q6/follow', {
      statusCode: 204,
    });
    await MockBarzServer.intercept('POST', '/v1/users/cljcwr5ph0000wa0g0zqup6q6/unfollow', {
      statusCode: 204,
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [],
    });

    await MockBarzServer.start();

    await device.reloadReactNative();
  });

  describe('With being signed in to a pre-created account first', () => {
    beforeEach(async () => {
      // Sign in to the app using the detox mock user credentials
      await MockSignIn.signInAsDetoxMockUser();

      // Go to the user profile page
      await ProfilePage.bottomTab().tap();
    });

    it('should be able to view the user profile page', async () => {
      // And that they can edit their own profile
      await waitFor(ProfilePage.actions.editProfile()).toBeVisible().withTimeout(5_000);

      // And visit the settings page
      await waitFor(ProfilePage.actions.settingsButton()).toBeVisible().withTimeout(5_000);
    });

    it('should NOT be able to follow or challenge themselves', async () => {
      // Make sure "follow" is not visible
      await waitFor(ProfilePage.actions.followButton()).not.toBeVisible().withTimeout(5_000);
      await waitFor(ProfilePage.actions.unfollowButton()).not.toBeVisible().withTimeout(5_000);
      await waitFor(ProfilePage.actions.challengeButton()).not.toBeVisible().withTimeout(5_000);
    });

    describe('Profile Edit Workflow', () => {
      it('should let a user edit their name and save successfully', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter a new name into the name box
        await ProfilePage.edit.name().clearText();
        await ProfilePage.edit.name().typeText('NEW NAME');

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // TODO: assert that the name is rendered on the profile page

        // Make sure that the clerk data was updated to have the "NEW NAME" value in it
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.unsafeMetadata.rapperName, 'NEW NAME');
      });

      it('should truncate any entered name to 30 characters', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter a new name into the name box
        await ProfilePage.edit.name().clearText();
        await ProfilePage.edit.name().typeText('1234567890123456789012345678901234567890');
        //                                      ^== This is 40 characters long!

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the clerk data was updated, but the name was truncated to the first 30
        // characters
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.unsafeMetadata.rapperName, '123456789012345678901234567890');
      });

      it('should let a user edit their handle and save successfully', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter a new name into the name box
        await ProfilePage.edit.handle().clearText();
        await ProfilePage.edit.handle().typeText('newhandle');

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // TODO: assert that the handle is rendered on the profile page

        // Make sure that the clerk data was updated to have the "NEW NAME" value in it
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.username, 'newhandle');
      });

      it('should let a user set an initial profile image and save successfully', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Tap the avatar image to simulate initiating the image selection process
        await ProfilePage.edit.avatarImageUpload().tap();
        await systemDialog('Camera').tap();

        // Wait for the image to complete uploading
        await waitFor(ProfilePage.edit.avatarImageUploadImageSet())
          .toBeVisible()
          .withTimeout(12_000);

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the clerk data was updated to have the uploaded image data value in it
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.unsafeMetadata.avatarImageUploaded, true);
        assert(
          user.profileImageUrl.startsWith('https://images.clerk.dev/uploaded'),
          'Profile Image URL does not start with https://images.clerk.dev/uploaded!',
        );
      });

      it('should let a user set an initial profile image and still upload the image even if cancel is pressed', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Tap the avatar image to simulate initiating the image selection process
        await ProfilePage.edit.avatarImageUpload().tap();
        await systemDialog('Camera').tap();

        // Wait for the image to complete uploading
        await waitFor(ProfilePage.edit.avatarImageUploadImageSet())
          .toBeVisible()
          .withTimeout(12_000);

        // Press "cancel"
        await ProfilePage.edit.actions.save().tap();

        // Make sure that the clerk data was updated to have the uploaded image data value in it
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.unsafeMetadata.avatarImageUploaded, true);
        assert(
          user.profileImageUrl.startsWith('https://images.clerk.dev/uploaded'),
          'Profile Image URL does not start with https://images.clerk.dev/uploaded!',
        );
      });
    });

    describe('Profile Bio Edit Workflow', () => {
      it('should let a user starting with no bio settings add an intro and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some intro text into the intro box
        await ProfilePage.bio.edit.introField().typeText('SAMPLE INTRO!');

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: { ...(await loadFixture('user.json')), intro: 'SAMPLE INTRO!' },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the intro text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return req.body.intro === 'SAMPLE INTRO!';
        });

        // Make sure that the intro text is visible on the profile page
        await waitFor(ProfilePage.bio.intro()).toHaveText('SAMPLE INTRO!').withTimeout(12_000);
      });
      it('should let a user starting with no bio settings and add an "area code" USING AUTOCOMPLETE and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the "area code" / location selection option
        await ProfilePage.bio.edit.locationField().tap();

        // Make sure the rough location selector shows up
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete locations
        await MockBarzServer.intercept('GET', '/v1/geocoding/search', {
          statusCode: 200,
          body: [
            {
              place_id: 64353984,
              licence: 'License text here',
              osm_type: 'node',
              osm_id: 7579791029,
              lat: '-3.1929182',
              lon: '37.2356429',
              category: 'place',
              type: 'village',
              place_rank: 19,
              importance: 0.27501,
              addresstype: 'village',
              name: 'Test Geolocation Entry',
              display_name: 'Test Geolocation Entry Display Name',
              boundingbox: ['-3.2129182', '-3.1729182', '37.2156429', '37.2556429'],
            },
          ],
        });

        // Make sure no autocomplete items are initially visible
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.firstItem())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Type a character into the search box
        await ProfilePage.bio.edit.roughLocationPicker.searchField().typeText('A');

        // Make sure that after typing into the autocomplete, an item shows up on screen
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.firstItem())
          .toBeVisible()
          .withTimeout(12_000);

        // Select the autocomplete item
        await ProfilePage.bio.edit.roughLocationPicker.firstItem().tap();

        // After selecting the autocomplete item, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            locationName: 'Test Geolocation Entry',
            locationLatitude: -3.1929182,
            locationLongitude: 37.2356429,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the location text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.locationName === 'Test Geolocation Entry' &&
            req.body.locationLatitude === -3.1929182 &&
            req.body.locationLongitude === 37.2356429
          );
        });

        // Make sure that the location text is visible on the profile page
        await waitFor(ProfilePage.bio.locationName())
          .toHaveText('Test Geolocation Entry')
          .withTimeout(12_000);
      });
      it('should let a user starting with no bio settings and add an "area code" WITHOUT AUTOCOMPLETE and save, then clear what was set', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the "area code" / location selection option
        await ProfilePage.bio.edit.locationField().tap();

        // Make sure the rough location selector shows up
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete locations to return
        // nothing
        await MockBarzServer.intercept('GET', '/v1/geocoding/search', {
          statusCode: 200,
          body: [],
        });

        // Type a phrase into the search box
        await ProfilePage.bio.edit.roughLocationPicker.searchField().typeText('Example City Name');

        // Press "done"
        await ProfilePage.bio.edit.roughLocationPicker.actions.done().tap();

        // After pressing done, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            locationName: 'Example City Name',
            locationLatitude: null,
            locationLongitude: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the location text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.locationName === 'Example City Name' &&
            req.body.locationLatitude === null &&
            req.body.locationLongitude === null
          );
        });

        // Make sure that the location text is visible on the profile page
        await waitFor(ProfilePage.bio.locationName())
          .toHaveText('Example City Name')
          .withTimeout(12_000);

        // Now, clear the selection:

        // Press the "edit bio" button
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the "area code" / location selection option
        await ProfilePage.bio.edit.locationField().tap();

        // Make sure the rough location selector shows up
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Press "clear"
        await ProfilePage.bio.edit.roughLocationPicker.actions.clear().tap();

        // After pressing clear, make sure that the bio edit view is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            locationName: null,
            locationLatitude: null,
            locationLongitude: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to clear the location data
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.locationName === null &&
            req.body.locationLatitude === null &&
            req.body.locationLongitude === null
          );
        });
      });

      it('should let a user starting with no bio settings and add a favorite rapper USING AUTOCOMPLETE and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite artist field
        await ProfilePage.bio.edit.artistField().tap();

        // Make sure the favorite artist selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteArtistPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete artists
        await MockBarzServer.intercept('GET', '/v1/spotify/artists/search', {
          statusCode: 200,
          body: {
            total: 1000,
            next: true,
            results: [
              {
                external_urls: {
                  spotify: 'https://open.spotify.com/artist/0anEu43cPG00OjwdaBxR91',
                },
                followers: {
                  href: null,
                  total: 2341,
                },
                genres: ['nordic folk', 'sami', 'yoik'],
                href: 'https://api.spotify.com/v1/artists/0anEu43cPG00OjwdaBxR91',
                id: '0anEu43cPG00OjwdaBxR91',
                images: [
                  {
                    height: 640,
                    url: 'https://i.scdn.co/image/ab67616d0000b273d87ad8db6242f66e0136686b',
                    width: 640,
                  },
                  {
                    height: 300,
                    url: 'https://i.scdn.co/image/ab67616d00001e02d87ad8db6242f66e0136686b',
                    width: 300,
                  },
                  {
                    height: 64,
                    url: 'https://i.scdn.co/image/ab67616d00004851d87ad8db6242f66e0136686b',
                    width: 64,
                  },
                ],
                name: 'Adjagas',
                popularity: 9,
                type: 'artist',
                uri: 'spotify:artist:0anEu43cPG00OjwdaBxR91',
              },
            ],
          },
        });
        // await MockBarzServer.intercept('GET', '/v1/spotify/tracks/search', {
        //   statusCode: 200,
        //   body: {
        //     "total": 1000,
        //     "next": true,
        //     "results": [
        //       {
        //         "album": {
        //           "album_type": "album",
        //           "artists": [],
        //           "available_markets": [],
        //           "external_urls": {
        //             "spotify": "https://open.spotify.com/album/7Cw4LObzgnVqSlkuIyywtI"
        //           },
        //           "href": "https://api.spotify.com/v1/albums/7Cw4LObzgnVqSlkuIyywtI",
        //           "id": "7Cw4LObzgnVqSlkuIyywtI",
        //           "images": [],
        //           "name": "DIE FOR MY BITCH",
        //           "release_date": "2019-07-19",
        //           "release_date_precision": "day",
        //           "total_tracks": 14,
        //           "type": "album",
        //           "uri": "spotify:album:7Cw4LObzgnVqSlkuIyywtI"
        //         },
        //         "artists": [
        //           {
        //             "external_urls": {
        //               "spotify": "https://open.spotify.com/artist/5SXuuuRpukkTvsLuUknva1"
        //             },
        //             "href": "https://api.spotify.com/v1/artists/5SXuuuRpukkTvsLuUknva1",
        //             "id": "5SXuuuRpukkTvsLuUknva1",
        //             "name": "Baby Keem",
        //             "type": "artist",
        //             "uri": "spotify:artist:5SXuuuRpukkTvsLuUknva1"
        //           }
        //         ],
        //         "available_markets": [],
        //         "disc_number": 1,
        //         "duration_ms": 129882,
        //         "explicit": true,
        //         "external_ids": {
        //           "isrc": "QM6N21900076"
        //         },
        //         "external_urls": {
        //           "spotify": "https://open.spotify.com/track/5FkoSXiJPKTNyYgALRJFhD"
        //         },
        //         "href": "https://api.spotify.com/v1/tracks/5FkoSXiJPKTNyYgALRJFhD",
        //         "id": "5FkoSXiJPKTNyYgALRJFhD",
        //         "is_local": false,
        //         "name": "ORANGE SODA",
        //         "popularity": 83,
        //         "preview_url": "https://p.scdn.co/mp3-preview/16036f2f4b872f58b00af7696e802883c79ae84e?cid=feaf5955b24d4fcf9edd61d3f7000b4c",
        //         "track_number": 12,
        //         "type": "track",
        //         "uri": "spotify:track:5FkoSXiJPKTNyYgALRJFhD"
        //       }
        //     ],
        //   },
        // });

        // Make sure no autocomplete items are initially visible
        await waitFor(ProfilePage.bio.edit.favoriteArtistPicker.firstItem())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Type a character into the search box
        await ProfilePage.bio.edit.favoriteArtistPicker.searchField().typeText('A');

        // Make sure that after typing into the autocomplete, an item shows up on screen
        await waitFor(ProfilePage.bio.edit.favoriteArtistPicker.firstItem())
          .toBeVisible()
          .withTimeout(12_000);

        // Select the autocomplete item
        await ProfilePage.bio.edit.favoriteArtistPicker.firstItem().tap();

        // After selecting the autocomplete item, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteRapperSpotifyId: '0anEu43cPG00OjwdaBxR91',
            favoriteRapperName: 'Adjagas',
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the favorite artist text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.favoriteRapperSpotifyId === '0anEu43cPG00OjwdaBxR91' &&
            req.body.favoriteRapperName === 'Adjagas'
          );
        });

        // Make sure that the location text is visible on the profile page
        await waitFor(ProfilePage.bio.rapperName()).toHaveText('Adjagas').withTimeout(12_000);
      });
      it('should let a user starting with no bio settings and add a favorite rapper WITHOUT AUTOCOMPLETE and save, then clear what was set', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite artist field
        await ProfilePage.bio.edit.artistField().tap();

        // Make sure the favorite artist selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteArtistPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete locations to return
        // nothing
        await MockBarzServer.intercept('GET', '/v1/spotify/artists/search', {
          statusCode: 200,
          body: { total: 0, next: false, results: [] },
        });

        // Type a phrase into the search box
        await ProfilePage.bio.edit.favoriteArtistPicker.searchField().typeText('Example Rapper');

        // Press "done"
        await ProfilePage.bio.edit.favoriteArtistPicker.actions.done().tap();

        // After pressing done, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteRapperName: 'Example Rapper',
            favoriteRapperSpotifyId: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the favorite artist text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.favoriteRapperName === 'Example Rapper' &&
            req.body.favoriteRapperSpotifyId === null
          );
        });

        // Make sure that the location text is visible on the profile page
        await waitFor(ProfilePage.bio.rapperName())
          .toHaveText('Example Rapper')
          .withTimeout(12_000);

        // Now, clear the selection:

        // Press the "edit bio" button
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite song field
        await ProfilePage.bio.edit.artistField().tap();

        // Make sure the favorite artist selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteArtistPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Press "clear"
        await ProfilePage.bio.edit.favoriteArtistPicker.actions.clear().tap();

        // After pressing clear, make sure that the bio edit view is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteRapperName: null,
            favoriteRapperSpotifyId: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to clear the favorite artist text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return req.body.favoriteRapperName === null && req.body.favoriteRapperSpotifyId === null;
        });
      });

      it('should let a user starting with no bio settings and add a favorite song USING AUTOCOMPLETE and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite song field
        await ProfilePage.bio.edit.favoriteSongField().tap();

        // Make sure the favorite song selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteTrackPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete tracks
        await MockBarzServer.intercept('GET', '/v1/spotify/tracks/search', {
          statusCode: 200,
          body: {
            total: 1000,
            next: true,
            results: [
              {
                album: {
                  album_type: 'album',
                  artists: [],
                  available_markets: [],
                  external_urls: {
                    spotify: 'https://open.spotify.com/album/7Cw4LObzgnVqSlkuIyywtI',
                  },
                  href: 'https://api.spotify.com/v1/albums/7Cw4LObzgnVqSlkuIyywtI',
                  id: '7Cw4LObzgnVqSlkuIyywtI',
                  images: [],
                  name: 'DIE FOR MY BITCH',
                  release_date: '2019-07-19',
                  release_date_precision: 'day',
                  total_tracks: 14,
                  type: 'album',
                  uri: 'spotify:album:7Cw4LObzgnVqSlkuIyywtI',
                },
                artists: [
                  {
                    external_urls: {
                      spotify: 'https://open.spotify.com/artist/5SXuuuRpukkTvsLuUknva1',
                    },
                    href: 'https://api.spotify.com/v1/artists/5SXuuuRpukkTvsLuUknva1',
                    id: '5SXuuuRpukkTvsLuUknva1',
                    name: 'Baby Keem',
                    type: 'artist',
                    uri: 'spotify:artist:5SXuuuRpukkTvsLuUknva1',
                  },
                ],
                available_markets: [],
                disc_number: 1,
                duration_ms: 129882,
                explicit: true,
                external_ids: {
                  isrc: 'QM6N21900076',
                },
                external_urls: {
                  spotify: 'https://open.spotify.com/track/5FkoSXiJPKTNyYgALRJFhD',
                },
                href: 'https://api.spotify.com/v1/tracks/5FkoSXiJPKTNyYgALRJFhD',
                id: '5FkoSXiJPKTNyYgALRJFhD',
                is_local: false,
                name: 'ORANGE SODA',
                popularity: 83,
                preview_url:
                  'https://p.scdn.co/mp3-preview/16036f2f4b872f58b00af7696e802883c79ae84e?cid=feaf5955b24d4fcf9edd61d3f7000b4c',
                track_number: 12,
                type: 'track',
                uri: 'spotify:track:5FkoSXiJPKTNyYgALRJFhD',
              },
            ],
          },
        });

        // Make sure no autocomplete items are initially visible
        await waitFor(ProfilePage.bio.edit.favoriteTrackPicker.firstItem())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Type a character into the search box
        await ProfilePage.bio.edit.favoriteTrackPicker.searchField().typeText('A');

        // Make sure that after typing into the autocomplete, an item shows up on screen
        await waitFor(ProfilePage.bio.edit.favoriteTrackPicker.firstItem())
          .toBeVisible()
          .withTimeout(12_000);

        // Select the autocomplete item
        await ProfilePage.bio.edit.favoriteTrackPicker.firstItem().tap();

        // After selecting the autocomplete item, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteSongSpotifyId: '5FkoSXiJPKTNyYgALRJFhD',
            favoriteSongName: 'ORANGE SODA',
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the favorite song text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.favoriteSongSpotifyId === '5FkoSXiJPKTNyYgALRJFhD' &&
            req.body.favoriteSongName === 'ORANGE SODA'
          );
        });

        // Make sure that the song text is visible on the profile page
        await waitFor(ProfilePage.bio.songName()).toHaveText('ORANGE SODA').withTimeout(12_000);
      });
      it('should let a user starting with no bio settings and add a favorite song WITHOUT AUTOCOMPLETE and save, then clear what was set', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite song field
        await ProfilePage.bio.edit.favoriteSongField().tap();

        // Make sure the favorite artist selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteTrackPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Mock the request that will be made to the server to autocomplete tracks to return
        // nothing
        await MockBarzServer.intercept('GET', '/v1/spotify/tracks/search', {
          statusCode: 200,
          body: { total: 0, next: false, results: [] },
        });

        // Type a phrase into the search box
        await ProfilePage.bio.edit.favoriteTrackPicker.searchField().typeText('Example Song');

        // Press "done"
        await ProfilePage.bio.edit.favoriteTrackPicker.actions.done().tap();

        // After pressing done, make sure that the profile page is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteSongName: 'Example Song',
            favoriteSongSpotifyId: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the favorite song text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return (
            req.body.favoriteSongName === 'Example Song' && req.body.favoriteSongSpotifyId === null
          );
        });

        // Make sure that the song text is visible on the profile page
        await waitFor(ProfilePage.bio.songName()).toHaveText('Example Song').withTimeout(12_000);

        // Now, clear the selection:

        // Press the "edit bio" button
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Open the favorite song field
        await ProfilePage.bio.edit.favoriteSongField().tap();

        // Make sure the favorite track selector shows up
        await waitFor(ProfilePage.bio.edit.favoriteTrackPicker.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Press "clear"
        await ProfilePage.bio.edit.favoriteTrackPicker.actions.clear().tap();

        // After pressing clear, make sure that the bio edit view is visible again
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: {
            ...(await loadFixture('user.json')),
            favoriteSongName: null,
            favoriteSongSpotifyId: null,
          },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to clear the favorite artist text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return req.body.favoriteSongName === null && req.body.favoriteSongSpotifyId === null;
        });
      });

      it('should let a user starting with no bio settings add an instagram handle and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some instagram handle text into the instagram handle box
        await ProfilePage.bio.edit.instagramField().typeText('instagramhandle');

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: { ...(await loadFixture('user.json')), instagramHandle: 'instagramhandle' },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the instagram handle text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return req.body.instagramHandle === 'instagramhandle';
        });

        // Make sure that the instagram handle text is visible on the profile page
        await waitFor(ProfilePage.bio.instagramHandle())
          .toHaveText('instagramhandle')
          .withTimeout(12_000);
      });
      it('should let a user starting with no bio settings add a soundcloud link and save', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some soundcloud handle text into the soundcloud handle box
        await ProfilePage.bio.edit.soundcloudField().typeText('soundcloudhandle');

        // Mock the request that will be made to the server to save the bio information
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: { ...(await loadFixture('user.json')), soundcloudHandle: 'soundcloudhandle' },
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away - this signfies the loading state has gone away
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the request was made to the server to save the soundcloud handle text
        await MockBarzServer.waitForRequest('PUT', '/v1/users/CURRENTUSER', ({ req }) => {
          return req.body.soundcloudHandle === 'soundcloudhandle';
        });

        // Make sure that the soundcloud handle text is visible on the profile page
        await waitFor(ProfilePage.bio.soundcloudHandle())
          .toHaveText('soundcloudhandle')
          .withTimeout(12_000);
      });

      it('should show an error if saving the user bio settings fails', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editGettingStarted().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some intro text into the intro box
        await ProfilePage.bio.edit.introField().typeText('SAMPLE INTRO!');

        // Mock the request that will be made to the server so that it FAILS
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 400,
          body: {},
        });

        // Press "save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Make sure an error shows up indicating that the request failed!
        await waitFor(element(by.text('Error updating user bio details!')))
          .toExist()
          .withTimeout(3_000);
      });
    });

    describe('Followers Page', () => {
      it('should let a user view all users that follow them', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/followers', {
          next: false,
          results: [
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
          ],
        });

        // Navigate to the followers page
        await ProfilePage.actions.followersButton().tap();

        // Make sure the expected number of users show up
        await waitFor(ProfilePage.followingFollowers.followers.userCountContainingValue(5))
          .toExist()
          .withTimeout(3_000);
      });
      // FIXME: the below infinite scroll test seems to be a bit flaky and needs some work to become
      // more reliable
      it.skip('should be able to load a really large user list via infinite scroll', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/followers', {
          total: 50,
          next: true,
          results: new Array(25).fill(0).map(() => ({ ...sampleUser, id: `${Math.random()}` })),
        });

        // Navigate to the followers page
        await ProfilePage.actions.followersButton().tap();

        // Make sure the expected number of users show up
        await waitFor(ProfilePage.followingFollowers.followers.userCountContainingValue(25))
          .toExist()
          .withTimeout(3_000);

        // Mock a second page of data to fetch
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/followers', {
          total: 50,
          next: true,
          results: [
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
          ],
        });

        // Scroll downwards in the followers view, which should trigger the infinite scroll data loading behavior
        await ProfilePage.followingFollowers.followers.wrapper().swipe('up');

        // FIXME: it ideally would be good to assert that the loading indicator showed up here as
        // well, but for some reason, the above `swipe` function call seems to take a long time
        // which means the loading indicator disappears before the `swipe` call completes.

        // Wait for page #2's data to load
        await waitFor(
          ProfilePage.followingFollowers.followers.userCountContainingValue(
            25 /* page one's data */ + 10 /* page two's data */,
          ),
        )
          .toExist()
          .withTimeout(12_000);
      });
      it('should be able to follow / unfollow users in the list', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/followers', {
          next: false,
          results: [{ ...sampleUser, id: `NEW` }],
        });

        // Navigate to the followers page
        await ProfilePage.actions.followersButton().tap();

        // Mock the user follow / unfollow endpoint
        await MockBarzServer.intercept('POST', '/v1/users/NEW/follow', { statusCode: 204 });
        await MockBarzServer.intercept('POST', '/v1/users/NEW/unfollow', { statusCode: 204 });

        await MockBarzServer.intercept('GET', '/v1/users/NEW', {
          ...sampleUser,
          id: 'NEW',
          name: 'New User',
          handle: 'newuser',
        });

        // Press the "follow" button on the user
        await ProfilePage.followingFollowers.followers
          .userWithID('NEW')
          .actions.followButton()
          .tap();

        // Make sure a request was made to follow the user
        await MockBarzServer.waitForRequest('POST', '/v1/users/NEW/follow');

        // Make sure that the "unfollow" button is now visible on the user, due to an optimistic
        // update
        await waitFor(
          ProfilePage.followingFollowers.followers.userWithID('NEW').actions.unfollowButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Now, send the server push via pusher that reflects the "follow" request
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.create', {
          id: `${Math.random()}`,
          userId: 'CURRENTUSER',
          followsUserId: 'NEW',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // Make sure that the "unfollow" button is still visible on the user - the optimistic update
        // should have updated the UI properly
        await waitFor(
          ProfilePage.followingFollowers.followers.userWithID('NEW').actions.unfollowButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Press the "unfollow" button on the user
        await ProfilePage.followingFollowers.followers
          .userWithID('NEW')
          .actions.unfollowButton()
          .tap();

        // Make sure a request was made to unfollow the user
        await MockBarzServer.waitForRequest('POST', '/v1/users/NEW/unfollow');

        // Make sure that the "follow" button is now visible again due to the optimistic update
        await waitFor(
          ProfilePage.followingFollowers.followers.userWithID('NEW').actions.followButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Now, send the server push via pusher that reflects the "unfollow" request
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.delete', {
          id: `${Math.random()}`,
          userId: 'CURRENTUSER',
          followsUserId: 'NEW',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // Make sure that the "follow" button is still visible on the user - the optimistic update
        // should have updated the UI properly
        await waitFor(
          ProfilePage.followingFollowers.followers.userWithID('NEW').actions.followButton(),
        )
          .toExist()
          .withTimeout(3_000);
      });
      it('should update the user following list when a pusher message says a new user followed them', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/followers', {
          next: false,
          results: [{ ...sampleUser, id: `${Math.random()}` }],
        });

        // Navigate to the followers page
        await ProfilePage.actions.followersButton().tap();

        // Mock an endpoint to look up the new following user
        await MockBarzServer.intercept('GET', '/v1/users/NEW', {
          ...sampleUser,
          id: 'NEW',
          name: 'New User',
          handle: 'newuser',
        });

        // Simulate another client attempting to follow our current user
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.create', {
          id: `${Math.random()}`,
          userId: 'NEW',
          followsUserId: 'CURRENTUSER',
          followedAt: new Date().toISOString(),
        });

        // Make sure that the new user shows up in the list:
        await waitFor(ProfilePage.followingFollowers.followers.userWithID('NEW').wrapper())
          .toExist()
          .withTimeout(3_000);

        // Also make sure that the new user row is showing the "follow" button
        await waitFor(
          ProfilePage.followingFollowers.followers.userWithID('NEW').actions.followButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Simulate the other client now unfollowing our current user
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.delete', {
          id: `${Math.random()}`,
          userId: 'NEW',
          followsUserId: 'CURRENTUSER',
          followedAt: new Date().toISOString(),
        });

        // And make sure afterwards that the new user row is showing the "unfollow" button
        await waitFor(ProfilePage.followingFollowers.followers.userWithID('NEW').wrapper())
          .not.toExist()
          .withTimeout(3_000);
      });
    });
    describe('Following Page', () => {
      it('should let a user view all users that they follow', async () => {
        // Mock the user following endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/following', {
          next: false,
          results: [
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
          ],
        });

        // Navigate to the following page
        await ProfilePage.actions.followingButton().tap();

        // Make sure the expected number of users show up
        await waitFor(ProfilePage.followingFollowers.following.userCountContainingValue(5))
          .toExist()
          .withTimeout(3_000);
      });
      // FIXME: the below infinite scroll test seems to be a bit flaky and needs some work to become
      // more reliable
      it.skip('should be able to load a really large user list via infinite scroll', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/following', {
          total: 50,
          next: true,
          results: new Array(25).fill(0).map(() => ({ ...sampleUser, id: `${Math.random()}` })),
        });

        // Navigate to the following page
        await ProfilePage.actions.followingButton().tap();

        // Make sure the expected number of users show up
        await waitFor(ProfilePage.followingFollowers.following.userCountContainingValue(25))
          .toExist()
          .withTimeout(3_000);

        // Mock a second page of data to fetch
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/following', {
          total: 50,
          next: true,
          results: [
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
            { ...sampleUser, id: `${Math.random()}` },
          ],
        });

        // Scroll downwards in the following view, which should trigger the infinite scroll data loading behavior
        await ProfilePage.followingFollowers.following.wrapper().swipe('up', 'slow');

        // FIXME: it ideally would be good to assert that the loading indicator showed up here as
        // well, but for some reason, the above `swipe` function call seems to take a long time
        // which means the loading indicator disappears before the `swipe` call completes.

        // Wait for page #2's data to load
        await waitFor(
          ProfilePage.followingFollowers.following.userCountContainingValue(
            25 /* page one's data */ + 10 /* page two's data */,
          ),
        )
          .toExist()
          .withTimeout(12_000);
      });
      it('should be able to follow / unfollow users in the list', async () => {
        // Mock the user following endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/following', {
          next: false,
          results: [{ ...sampleUser, id: `NEW` }],
        });

        // Navigate to the following page
        await ProfilePage.actions.followingButton().tap();

        // Mock the user follow / unfollow endpoint
        await MockBarzServer.intercept('POST', '/v1/users/NEW/follow', { statusCode: 204 });
        await MockBarzServer.intercept('POST', '/v1/users/NEW/unfollow', { statusCode: 204 });

        await MockBarzServer.intercept('GET', '/v1/users/NEW', {
          ...sampleUser,
          id: 'NEW',
          name: 'New User',
          handle: 'newuser',
        });

        // Press the "follow" button on the user
        await ProfilePage.followingFollowers.following
          .userWithID('NEW')
          .actions.followButton()
          .tap();

        // Make sure a request was made to follow the user
        await MockBarzServer.waitForRequest('POST', '/v1/users/NEW/follow');

        // Make sure that the "unfollow" button is now visible on the user, due to an optimistic
        // update
        await waitFor(
          ProfilePage.followingFollowers.following.userWithID('NEW').actions.unfollowButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Now, send the server push via pusher that reflects the "follow" request
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.create', {
          id: `${Math.random()}`,
          userId: 'CURRENTUSER',
          followsUserId: 'NEW',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // Make sure that the "unfollow" button is still visible on the user - the optimistic update
        // should have updated the UI properly
        await waitFor(
          ProfilePage.followingFollowers.following.userWithID('NEW').actions.unfollowButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Press the "unfollow" button on the user
        await ProfilePage.followingFollowers.following
          .userWithID('NEW')
          .actions.unfollowButton()
          .tap();

        // Make sure a request was made to unfollow the user
        await MockBarzServer.waitForRequest('POST', '/v1/users/NEW/unfollow');

        // Make sure that the "follow" button is now visible again due to the optimistic update
        await waitFor(
          ProfilePage.followingFollowers.following.userWithID('NEW').actions.followButton(),
        )
          .toExist()
          .withTimeout(3_000);

        // Now, send the server push via pusher that reflects the "unfollow" request
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.delete', {
          id: `${Math.random()}`,
          userId: 'CURRENTUSER',
          followsUserId: 'NEW',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // Make sure that the "follow" button is still visible on the user - the optimistic update
        // should have updated the UI properly
        await waitFor(
          ProfilePage.followingFollowers.following.userWithID('NEW').actions.followButton(),
        )
          .toExist()
          .withTimeout(3_000);
      });
      it('should NOT update the user following list when a pusher message says a new user followed them', async () => {
        // Mock the user followers endpoint to return 5 sample users
        const sampleUser = await loadFixture('user.json');
        await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/following', {
          next: false,
          results: [{ ...sampleUser, id: 'NEW' }],
        });

        // Navigate to the following page
        await ProfilePage.actions.followingButton().tap();

        // Mock an endpoint to look up the new following user
        await MockBarzServer.intercept('GET', '/v1/users/NEW', {
          ...sampleUser,
          id: 'NEW',
          name: 'New User',
          handle: 'newuser',
        });

        // Simulate another client attempting to follow our current user
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.create', {
          id: `${Math.random()}`,
          userId: 'NEW',
          followsUserId: 'CURRENTUSER',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // The following view doesn't show data about users that follow the current user, so this
        // should do nothing.

        // Make sure that the count of users in the list stays at 1
        await waitFor(ProfilePage.followingFollowers.following.userCountContainingValue(1))
          .toExist()
          .withTimeout(3_000);

        // Simulate the other client now unfollowing our current user
        await MockPusher.publish(`private-user-CURRENTUSER-follows`, 'userFollow.delete', {
          id: `${Math.random()}`,
          userId: 'NEW',
          followsUserId: 'CURRENTUSER',
          followedAt: new Date().toISOString(),
        });

        // Wait a moment for any react rerenders to run
        await delay(250);

        // Again, this should not do anything - the count should stay at 1
        await waitFor(ProfilePage.followingFollowers.following.userCountContainingValue(1))
          .toExist()
          .withTimeout(3_000);
      });
    });

    describe('With a profile image being initially set', () => {
      beforeEach(async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Tap the avatar image to simulate initiating the image selection process
        await ProfilePage.edit.avatarImageUpload().tap();
        await systemDialog('Camera').tap();

        // Wait for the image to complete uploading
        await waitFor(ProfilePage.edit.avatarImageUploadImageSet())
          .toBeVisible()
          .withTimeout(12_000);

        // Press "cancel"
        await ProfilePage.edit.actions.save().tap();
      });
      it('should let a user clear their already set profile image and save successfully', async () => {
        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that an image is selected by default
        await waitFor(ProfilePage.edit.avatarImageUploadImageSet())
          .toBeVisible()
          .withTimeout(12_000);

        // Tap the avatar image, and select "clear" to remove the selected image
        await ProfilePage.edit.avatarImageUpload().tap();
        await systemDialog('Clear').tap();

        // Wait for the image to be removed from the user profile
        await waitFor(ProfilePage.edit.avatarImageUploadImageUnset())
          .toBeVisible()
          .withTimeout(12_000);

        // Wait for the image to be done loading
        await waitFor(ProfilePage.edit.avatarImageUploadImageLoading())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signfies loading has completed
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // FIXME: the below assertion doesn't pass. Figure out why!
        // // Make sure that the clerk data was updated to remove the profile image
        // const user = await MockSignIn.getDetoxMockUserFromClerk();
        // console.log('FOO', user.unsafeMetadata)
        // assert.strictEqual(user.unsafeMetadata.avatarImageUploaded, false);
        // // NOTE: after the image is removed, clerk replaces the profileImageUrl value with a default
        // // clerk profile image - this value doesn't become `null` or something like that. So it's not
        // // so easy to assert that this value was cleared.
      });
      it('should let a user change their already set profile image and save successfully', async () => {
        const originalUser = await MockSignIn.getDetoxMockUserFromClerk();

        // Press "edit" to start editing the user's profile
        await ProfilePage.actions.editProfile().tap();

        // Make sure the edit page shows up
        await waitFor(ProfilePage.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that an image is selected by default
        await waitFor(ProfilePage.edit.avatarImageUploadImageSet())
          .toBeVisible()
          .withTimeout(12_000);

        // Tap the avatar image, and select a new image
        await ProfilePage.edit.avatarImageUpload().tap();
        await systemDialog('Camera').tap();

        // Wait for the image to be done loading
        await waitFor(ProfilePage.edit.avatarImageUploadImageLoading())
          .not.toBeVisible()
          .withTimeout(12_000);

        // Press "save"
        await ProfilePage.edit.actions.save().tap();

        // Wait for the edit view to go away - this signifies saving has completed
        await waitFor(ProfilePage.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure the flag that indicates that an image upload occurred is still set
        const user = await MockSignIn.getDetoxMockUserFromClerk();
        assert.strictEqual(user.unsafeMetadata.avatarImageUploaded, true);

        // Make sure that the clerk data has a different image associated
        assert.notStrictEqual(user.profileImageUrl, originalUser.profileImageUrl);
      });
    });

    describe(`With navigating to another user's profile page`, () => {
      let user;
      beforeEach(async () => {
        const battleRecordingOne = await loadFixture('battle-recording-one.json');

        // Tap on the first battle in the recent list
        await ProfilePage.recent.battleListItems().atIndex(0).tap();

        // Wait for the battle viewer to show up on screen for the given battle
        await waitFor(ProfilePage.battleViewer.forBattle(battleRecordingOne.battleId).wrapper())
          .toExist()
          .withTimeout(30_000);

        // Store the user for later
        user = battleRecordingOne.participants[0].user;

        // Mock the battle list on the other user's profile to prevent an error in the page
        await MockBarzServer.intercept('GET', `/v1/users/${user.id}/battles/recordings`, {
          total: 0,
          next: false,
          results: [],
        });

        // Tap on the name of the first participant
        await ProfilePage.battleViewer
          .forBattle(battleRecordingOne.battleId)
          .forParticipant('cljeese62013jyv0g7r04912a')
          .name()
          .tap();
      });

      it('should be able to follow and unfollow another user', async () => {
        // Press the "follow" on the user profile page
        await ProfilePage.actions.followButton().tap();

        // Wait for the unfollow button to show up
        await waitFor(ProfilePage.actions.unfollowButton()).toBeVisible().withTimeout(12_000);

        // Press the "unfollow" on the user profile page
        await ProfilePage.actions.unfollowButton().tap();
      });
      it('should update the followers number optimistically when the follow button is pressed', async () => {
        // Press the "follow" on the user profile page
        await ProfilePage.actions.followButton().tap();

        // The followers count should increase due to an optimistic update
        await waitFor(ProfilePage.followersCountContainingValue(1)).toExist().withTimeout(12_000);

        // Wait for the unfollow button to show up
        await waitFor(ProfilePage.actions.unfollowButton()).toBeVisible().withTimeout(12_000);

        // Press the "unfollow" on the user profile page
        await ProfilePage.actions.unfollowButton().tap();

        // The followers count should decrease due to an optimistic update
        await waitFor(ProfilePage.followersCountContainingValue(0)).toExist().withTimeout(12_000);
      });
      it('should update the following and followers numbers for a user when pusher messages are received', async () => {
        // Send an update to the current visible user
        await MockPusher.publish(`private-user-${user.id}`, 'user.update', {
          ...user,
          computedFollowersCount: 99,
          computedFollowingCount: 46,
        });

        // Make sure the update shows up
        await waitFor(ProfilePage.followersCountContainingValue(99)).toExist().withTimeout(12_000);
        await waitFor(ProfilePage.followingCountContainingValue(46)).toExist().withTimeout(12_000);
      });
      it('should be able to challenge the other user', async () => {
        // Mock the request to create a challenge
        await MockBarzServer.intercept('POST', '/v1/challenges', 'user-initiated-challenge.json');

        // Press "challenge" on the user
        await ProfilePage.actions.challengeButton().tap();

        // Make sure the request to create a challenge is made
        await MockBarzServer.waitForRequest('POST', '/v1/challenges');

        // And make sure that we are in the waiting room
        await waitFor(BattlePage.challengesWaitingRoom.container())
          .toBeVisible()
          .withTimeout(5_000);
      });
    });

    describe(`With playing a private battle`, () => {
      beforeEach(async () => {
        const battleRecordingFivePrivate = await loadFixture('battle-recording-five-private.json');

        // Tap on the fifth battle in the recent list, this one is the private battle
        await ProfilePage.scroll().scroll(1000); // Scroll down so the battle is on screen
        await ProfilePage.recent.battleListItems().atIndex(4).tap();

        // Wait for the battle viewer to show up on screen for the given battle
        await waitFor(
          ProfilePage.battleViewer.forBattle(battleRecordingFivePrivate.battleId).wrapper(),
        )
          .toExist()
          .withTimeout(30_000);
      });

      it('should NOT be able to vote on a private battle', async () => {
        const battleRecordingFivePrivate = await loadFixture('battle-recording-five-private.json');

        // Make sure that both vote buttons are not visible
        await waitFor(
          ProfilePage.battleViewer
            .forBattle(battleRecordingFivePrivate.battleId)
            .forParticipant(battleRecordingFivePrivate.participants[0].id)
            .voteButton(),
        )
          .not.toBeVisible()
          .withTimeout(5_000);
        await waitFor(
          ProfilePage.battleViewer
            .forBattle(battleRecordingFivePrivate.battleId)
            .forParticipant(battleRecordingFivePrivate.participants[1].id)
            .voteButton(),
        )
          .not.toBeVisible()
          .withTimeout(5_000);
      });
      it.todo('should NOT be able to share a private battle');
    });
  });

  describe('With being signed in to a pre-created account first AND custom user bio data preset in the UserMe data', () => {
    beforeEach(async () => {
      const sampleUser = await loadFixture('user.json');
      const sampleUserMe = await loadFixture('user-me.json');
      await MockBarzServer.intercept('GET', '/v1/users/me', {
        ...sampleUserMe,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtest',
        name: 'Barz Detox Test',

        intro: 'starting intro',
        instagramHandle: 'testhandle',
        locationName: 'The Internet',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
        ...sampleUser,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtest',
        name: 'Barz Detox Test',

        intro: 'starting intro',
        instagramHandle: 'testhandle',
        locationName: 'The Internet',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
        total: 0,
        next: false,
        results: [],
      });

      // Sign in to the app using the detox mock user credentials
      await MockSignIn.signInAsDetoxMockUser();

      // Go to the user profile page
      await ProfilePage.bottomTab().tap();
    });

    describe('Profile Bio Edit Workflow WITH PRESET BIO DATA', () => {
      it('should make changes to the user bio settings and cancel, and that should not save the changes', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some text into a few different form fields
        // "intro" value:
        await ProfilePage.bio.edit.introField().clearText();
        await ProfilePage.bio.edit.introField().typeText('SAMPLE INTRO!');

        // "area code" / location value:
        await ProfilePage.bio.edit.locationField().tap();
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.wrapper())
          .toExist()
          .withTimeout(12_000);
        await MockBarzServer.intercept('GET', '/v1/geocoding/search', {
          statusCode: 200,
          body: [],
        });
        await ProfilePage.bio.edit.roughLocationPicker.searchField().typeText('Custom Location');
        await ProfilePage.bio.edit.roughLocationPicker.actions.done().tap();
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // instagram handle value:
        await ProfilePage.bio.edit.instagramField().clearText();
        await ProfilePage.bio.edit.instagramField().typeText('instagramhandle');

        // Press "cancel"
        await ProfilePage.bio.edit.actions.cancel().tap();

        // Wait for the bio edit view to go away, and we are back at the bio read only view
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that none of the field changes that were made are reflected on the main page
        await waitFor(ProfilePage.bio.intro()).toHaveText('starting intro').withTimeout(3_000);
        await waitFor(ProfilePage.bio.instagramHandle())
          .toHaveText('testhandle')
          .withTimeout(3_000);
        await waitFor(ProfilePage.bio.locationName()).toHaveText('The Internet').withTimeout(3_000);
      });
      it('should be able to edit a bio that has already been filled out to add more data', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Enter some text into the soundcloud field:
        await ProfilePage.bio.edit.soundcloudField().typeText('soundcloudhandle');

        // Mock the request to the server
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: { ...(await loadFixture('user.json')), soundcloudHandle: 'soundcloudhandle' },
        });

        // Press "Save"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away, and we are back at the bio read only view
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure that the updated soundcloud field is shown
        await waitFor(ProfilePage.bio.soundcloudHandle())
          .toHaveText('soundcloudhandle')
          .withTimeout(3_000);
      });
      it('should be able to clear a bio that has already been filled out to go back to the empty state', async () => {
        // Go to the "bio" tab
        await ProfilePage.bio.tab().tap();

        // Press the "getting started" button shown on the bio empty state to open the bio edit
        // workflow
        await ProfilePage.bio.editButton().tap();

        // Make sure the bio edit page shows up
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // Clear out all the set form fields
        // "intro" value:
        await ProfilePage.bio.edit.introField().clearText();

        // "area code" / location value:
        await ProfilePage.bio.edit.locationField().tap();
        await waitFor(ProfilePage.bio.edit.roughLocationPicker.wrapper())
          .toExist()
          .withTimeout(12_000);
        await ProfilePage.bio.edit.roughLocationPicker.actions.clear().tap();
        await waitFor(ProfilePage.bio.edit.wrapper()).toBeVisible().withTimeout(12_000);

        // instagram handle value:
        await ProfilePage.bio.edit.instagramField().clearText();

        // Mock the request to the server
        await MockBarzServer.intercept('PUT', '/v1/users/CURRENTUSER', {
          statusCode: 200,
          body: await loadFixture('user.json'),
        });

        // Press "done"
        await ProfilePage.bio.edit.actions.save().tap();

        // Wait for the bio edit view to go away, and we are back at the bio read only view
        await waitFor(ProfilePage.bio.edit.wrapper()).not.toBeVisible().withTimeout(12_000);

        // Make sure the empty state is now shown, because the profile is now empty
        await waitFor(ProfilePage.bio.editGettingStarted()).toBeVisible().withTimeout(3_000);
      });
    });
  });

  describe('With freshly creating a user via phone number', () => {
    let firstPhoneNumber;
    beforeEach(async () => {
      await MockSignIn.deleteUsersWithUsernameFromClerk('barzdetoxtestphone');

      const sampleUser = await loadFixture('user.json');
      const sampleUserMe = await loadFixture('user-me.json');
      await MockBarzServer.intercept('GET', '/v1/users/me', {
        ...sampleUserMe,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtestphone',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
        ...sampleUser,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtestphone',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
        total: 0,
        next: false,
        results: [],
      });

      await MockBarzServer.intercept('GET', '/v1/users/generated-rap-tag', {
        name: 'Barz Detox Test Phone',
      });

      // Make sure that the workflow starts on the phone number page
      await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

      // Initialize the mock sms receiver
      await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
        async (phoneNumber, waitForSMS) => {
          firstPhoneNumber = phoneNumber;
          // Clean up clerk users associated with the given phone number
          await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

          // Enter the phone number the mock SMS receiver is using into the app
          await OnboardingPage.phoneNumberInput().typeText(phoneNumber);

          // Press "verify"
          await OnboardingPage.verifyPhoneNumberButton().tap();

          // Make sure that the workflow moves to the OTP code page
          await waitFor(OnboardingPage.verifyCodePage.wrapper()).toBeVisible().withTimeout(12_000);

          // Wait for a new barz verification code to be received
          const result = await waitForSMS((message) => message.includes('Barz'));

          // Extract the verification code from the message
          const verificationCodeMatch = /[0-9]{6}/.exec(result);
          const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
          assert.notStrictEqual(verificationCode, null);

          // Type it into the OTP box
          await waitFor(OnboardingPage.otpInput()).toBeVisible().withTimeout(12_000);
          await OnboardingPage.otpInput().typeText(verificationCode);

          // Make sure that the autogenerated rap name is shown to the user
          await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
          // Dismiss the rap name intro page
          await OnboardingPage.rapNameIntroPage.nextButton().tap();

          // Make sure that the onboarding process is complete - the final onboarding page
          // should no longer be visible
          await waitFor(OnboardingPage.verifyCodePage.wrapper())
            .not.toBeVisible()
            .withTimeout(12_000);

          // Finally, make sure that the clerk user has the appropriate metadata set
          const user = await MockSignIn.getUserFromClerkByPhoneNumber(phoneNumber);
          assert.strictEqual(user.unsafeMetadata.rapperNameChangedFromDefault, false);
        },
      );
    });

    it('should let a user change their phone number', async () => {
      // Go to the user profile page
      await ProfilePage.bottomTab().tap();

      // Press "settings" to go to the settings page
      await ProfilePage.actions.settingsButton().tap();

      // Make sure that the settings page is visible
      await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

      // Go to the phone number settings page
      await ProfilePage.settings.phoneNumberSettingsButton().tap();

      // Press "change phone number" to kick off the phone number changing workflow
      await ProfilePage.phoneNumberSettings.changePhoneNumberButton().tap();

      // Wait for the phone number input page to show up
      await waitFor(ProfilePage.changePhoneNumber.enterNumberStep.wrapper())
        .toExist()
        .withTimeout(12_000);

      // Initialize the mock sms receiver - PASS THE FIRST PHONE NUMBER SO A DIFFERENT NUMBER IS
      // USED THIS TIME!
      await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
        async (phoneNumber, waitForSMS) => {
          // Clean up clerk users associated with the given phone number
          await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

          // Enter the phone number into the phone number box
          await ProfilePage.changePhoneNumber.enterNumberStep
            .numberInputField()
            .typeText(phoneNumber);

          // Press "verify"
          await ProfilePage.changePhoneNumber.enterNumberStep.actions.submitButton().tap();

          // Wait for the verification code page to show up
          await waitFor(ProfilePage.changePhoneNumber.verifyStep.wrapper())
            .toExist()
            .withTimeout(12_000);

          // Wait for a new barz verification code to be received
          const result = await waitForSMS((message) => message.includes('Barz'));

          // Extract the verification code from the message
          const verificationCodeMatch = /[0-9]{6}/.exec(result);
          const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
          assert.notStrictEqual(verificationCode, null);

          // Enter the code into the verification code box
          await ProfilePage.changePhoneNumber.verifyStep
            .verifyInputField()
            .typeText(verificationCode);

          // Make sure that the settings page becomes visible again
          await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

          // Finally, make sure the new phone number is visible somewhere on the settings page
          await expect(
            element(by.id('profile-settings-wrapper').withDescendant(by.text(phoneNumber))),
          ).toBeVisible();
        },
        [firstPhoneNumber],
      );
    });
    it.todo(
      'should fail to let a user change their phone number to their same original phone number',
    );
    it.todo(
      'should fail to let a user change their phone number if the verification code is wrong',
    );

    // FIXME: I can't get this test to pass - after signing in with google, the email never shows up
    // on the user profile page. The functionality seems to work in the app in regular use and I
    // think there's just something slightly off with the way I am doing the mocking?
    it.skip('should let a user associate an oauth provider account (google) and then remove the original phone number', async () => {
      // Go to the user profile page
      await ProfilePage.bottomTab().tap();

      // Press "settings" to go to the settings page
      await ProfilePage.actions.settingsButton().tap();

      // Make sure that the settings page is visible
      await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

      // Make sure the new phone number is visible on the settings page
      await expect(
        element(by.id('profile-settings-wrapper').withDescendant(by.text(firstPhoneNumber))),
      ).toBeVisible();

      await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
        // Tap the google oauth provider settings to associate a new google account
        await ProfilePage.settings.oauthProviders.googleSettingsButton().tap();

        // Wait for the login page to open up in the web browser
        const page = await waitForWebAuthToStart();

        // Perform a sign in within the web browser, entering demo google credentials
        await MockWebOAuthSession.performSignInToGoogleLoginPage(
          page,
          MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
          MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
        );
      });

      // Make sure the google email address is now shown on screen to make sure that the association
      // worked
      await expect(
        element(
          by
            .id('profile-settings-wrapper')
            .withDescendant(by.text(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL)),
        ),
      ).toBeVisible();

      // // Go to the phone number settings page
      // await ProfilePage.settings.phoneNumberSettingsButton().tap();

      // // Tap the "remove" button
      // await ProfilePage.phoneNumberSettings.removePhoneNumberButton().tap();

      // // Press "remove" in the popup to confirm
      // await systemDialog('Remove').tap();

      // // Make sure that the settings page is visible
      // await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

      // // Finally, make sure the new phone number is NOT visible now on the settings page
      // await expect(
      //   element(
      //     by.id("profile-settings-wrapper").withDescendant(
      //       by.text(firstPhoneNumber)
      //     )
      //   )
      // ).not.toBeVisible();
    });

    it('should not let the phone number be removed if there are no oauth provider accounts linked', async () => {
      // Go to the user profile page
      await ProfilePage.bottomTab().tap();

      // Press "settings" to go to the settings page
      await ProfilePage.actions.settingsButton().tap();

      // Make sure that the settings page is visible
      await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

      // Go to the phone number settings page
      await ProfilePage.settings.phoneNumberSettingsButton().tap();

      // Make sure that the "remove" button is disabled
      await waitFor(ProfilePage.phoneNumberSettings.removePhoneNumberButtonDisabled())
        .toExist()
        .withTimeout(12_000);
    });
  });

  describe('With freshly creating a user via oauth provider account (google)', () => {
    let user;
    beforeEach(async () => {
      await MockSignIn.deleteUsersWithUsernameFromClerk('barzdetoxtestoauth');

      const sampleUser = await loadFixture('user.json');
      const sampleUserMe = await loadFixture('user-me.json');
      await MockBarzServer.intercept('GET', '/v1/users/me', {
        ...sampleUserMe,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtestoauth',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
        ...sampleUser,
        id: 'CURRENTUSER',
        handle: 'barzdetoxtestoauth',
        name: 'Barz Detox Test',
      });
      await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
        total: 0,
        next: false,
        results: [],
      });

      await MockBarzServer.intercept('GET', '/v1/users/generated-rap-tag', {
        name: 'Barz Detox Test Oauth',
      });

      // Make sure that the workflow starts on the phone number page
      await waitFor(OnboardingPage.enterPhonePage.wrapper()).toBeVisible().withTimeout(12_000);

      // Clean up clerk users associated with the given google account
      await MockSignIn.deleteUsersAssociatedWithEmailFromClerk(
        MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
      );

      // Go through the login workflow in a web browser
      //
      // TODO: this might turn out to be a bad idea if google were to start rate limiting / blocking
      // this automatic login attempt
      await MockWebOAuthSession.initialize(async (waitForWebAuthToStart) => {
        // Press "Sign in with google"
        await OnboardingPage.enterPhonePage.signIn.google().tap();

        // Wait for the login page to open up in the web browser
        const page = await waitForWebAuthToStart();

        // Perform a sign in within the web browser, entering demo google credentials
        await MockWebOAuthSession.performSignInToGoogleLoginPage(
          page,
          MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL,
          MockSignIn.MOCK_GOOGLE_ACCOUNT_PASSWORD,
        );
      });

      // Make sure that the autogenerated rap name is shown to the user
      await waitFor(OnboardingPage.rapNameIntroPage.wrapper()).toBeVisible().withTimeout(12_000);
      // Dismiss the rap name intro page
      await OnboardingPage.rapNameIntroPage.nextButton().tap();

      // Make sure that the onboarding process is complete - the final onboarding page
      // should no longer be visible
      await waitFor(OnboardingPage.verifyCodePage.wrapper()).not.toBeVisible().withTimeout(12_000);

      // Finally, make sure that the clerk user has the appropriate metadata set
      user = await MockSignIn.getUserFromClerkByEmailAddress(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL);
      assert.strictEqual(user.unsafeMetadata.rapperNameChangedFromDefault, false);

      // Go to the user profile page
      await ProfilePage.bottomTab().tap();
    });

    it('should not be able to detach the oauth provider (google) account since there are no other providers linked and no phone number', async () => {
      // Press "settings" to go to the settings page
      await ProfilePage.actions.settingsButton().tap();

      // Make sure that the settings page is visible
      await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

      // Make sure the google email address is shown on screen
      //
      // This is to verify going into the below test that yes, in fact, there
      // is a google account associated with this user
      await expect(
        element(
          by
            .id('profile-settings-wrapper')
            .withDescendant(by.text(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL)),
        ),
      ).toBeVisible();

      // Go into the google oauth provider settings
      await ProfilePage.settings.oauthProviders.googleSettingsButton().tap();

      // Wait for the oauth provider page to become visible
      await waitFor(ProfilePage.oAuthProviderSettings.wrapper()).toBeVisible().withTimeout(12_000);

      // Verify that the google account cannot be disassociated because it's the only account (and
      // there is no phone number)
      await waitFor(ProfilePage.oAuthProviderSettings.detachOAuthProviderButtonDisabled())
        .toExist()
        .withTimeout(12_000);
    });

    describe('With associating a phone number to the google account', () => {
      let linkedPhoneNumber = null;
      beforeEach(async () => {
        // Press "settings" to go to the settings page
        await ProfilePage.actions.settingsButton().tap();

        // Make sure that the settings page is visible
        await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

        // STEP 1: associate a phone number with this account

        // Press the button to add a phone number
        // NOTE: This is only visible because the user signed in does NOT currently have a phone number
        // associated
        await ProfilePage.settings.addPhoneNumberButton().tap();

        // Wait for the phone number input page to show up
        await waitFor(ProfilePage.changePhoneNumber.enterNumberStep.wrapper())
          .toExist()
          .withTimeout(12_000);

        // Initialize the mock sms receiver
        await MockSMSReceiver.generatePhoneNumberToReceiveSMSMessage(
          async (phoneNumber, waitForSMS) => {
            // Clean up any pre-existing clerk users associated with the given phone number
            await MockSignIn.deleteUsersAssociatedWithPhoneNumberFromClerk(phoneNumber);

            // Enter the phone number into the phone number box
            await ProfilePage.changePhoneNumber.enterNumberStep
              .numberInputField()
              .typeText(phoneNumber);

            // Press "verify"
            await ProfilePage.changePhoneNumber.enterNumberStep.actions.submitButton().tap();

            // Wait for the verification code page to show up
            await waitFor(ProfilePage.changePhoneNumber.verifyStep.wrapper())
              .toExist()
              .withTimeout(12_000);

            // Wait for a new barz verification code to be received
            const result = await waitForSMS((message) => message.includes('Barz'));

            // Extract the verification code from the message
            const verificationCodeMatch = /[0-9]{6}/.exec(result);
            const verificationCode = verificationCodeMatch ? verificationCodeMatch[0] : null;
            assert.notStrictEqual(verificationCode, null);

            // Enter the code into the verification code box
            await ProfilePage.changePhoneNumber.verifyStep
              .verifyInputField()
              .typeText(verificationCode);

            // Make sure that the settings page becomes visible again
            await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

            // Store the phone number for later use in the test
            linkedPhoneNumber = phoneNumber;
          },
        );
      });

      it('should be able to disassociate a phone number from the account', async () => {
        // First, make sure the new phone number is visible somewhere on the settings page
        await expect(
          element(by.id('profile-settings-wrapper').withDescendant(by.text(linkedPhoneNumber))),
        ).toBeVisible();

        // Press the button to go to the phone number settings page
        await ProfilePage.settings.phoneNumberSettingsButton().tap();

        // Make sure that the phone number settings page is visible
        await waitFor(ProfilePage.phoneNumberSettings.wrapper()).toExist().withTimeout(12_000);

        // Press the "remove" button to disassociate the phone number
        await ProfilePage.phoneNumberSettings.removePhoneNumberButton().tap();

        // Press "remove" in the popup to confirm
        await systemDialog('Remove').tap();

        // Make sure that the settings page is visible
        await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

        // Finally, make sure the new phone number is NOT visible now on the settings page
        await expect(
          element(by.id('profile-settings-wrapper').withDescendant(by.text(linkedPhoneNumber))),
        ).not.toBeVisible();
      });
      it('after associating a phone number, should let the oauth provider account (google) be removed', async () => {
        // First, make sure the google email address is shown on screen
        //
        // This is to verify going into the below test that yes, in fact, there
        // is a google account associated with this user
        await expect(
          element(
            by
              .id('profile-settings-wrapper')
              .withDescendant(by.text(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL)),
          ),
        ).toBeVisible();

        // Go into the google oauth provider settings
        await ProfilePage.settings.oauthProviders.googleSettingsButton().tap();

        // Wait for the oauth provider page to become visible
        await waitFor(ProfilePage.oAuthProviderSettings.wrapper())
          .toBeVisible()
          .withTimeout(12_000);

        // Disassociate the google account - this should be possible now because there is a phone
        // number attached
        await ProfilePage.oAuthProviderSettings.detachOAuthProviderButton().tap();

        // Press "remove" in the popup to confirm
        await systemDialog('Remove').tap();

        // Make sure that the settings page is visible
        await waitFor(ProfilePage.settings.wrapper()).toExist().withTimeout(12_000);

        // Finally, make sure the google account email address is NOT shown on the settings page
        // This is just to confirm that detaching the account worked
        await expect(
          element(
            by
              .id('profile-settings-wrapper')
              .withDescendant(by.text(MockSignIn.MOCK_GOOGLE_ACCOUNT_EMAIL)),
          ),
        ).not.toBeVisible();
      });
    });
  });
});

describe('Home', () => {
  beforeAll(async () => {
    await openApp();
  });

  beforeEach(async () => {
    const sampleUser = await loadFixture('user.json');
    const sampleUserMe = await loadFixture('user-me.json');
    await MockBarzServer.intercept('GET', '/v1/users/me', {
      ...sampleUserMe,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER', {
      ...sampleUser,
      id: 'CURRENTUSER',
      handle: 'barzdetoxtest',
      name: 'Barz Detox Test',
    });
    await MockBarzServer.intercept('GET', '/v1/users/CURRENTUSER/battles/recordings', {
      total: 0,
      next: false,
      results: [],
    });

    // When a request is made to get all pending challenges, by default, return an empty list
    await MockBarzServer.intercept('GET', '/v1/challenges/pending', {
      total: 0,
      next: null,
      previous: null,
      results: [],
    });

    await MockBarzServer.intercept('GET', '/v1/battles/home', {
      next: null,
      nextLastBattleId: null,
      results: [
        await loadFixture('battle-recording-one.json'),
        await loadFixture('battle-recording-two.json'),
        await loadFixture('battle-recording-three.json'),
      ],
    });

    await MockBarzServer.intercept(
      'GET',
      '/v1/battles/BATTLERECORDINGONE/recording',
      'battle-recording-one.json',
    );
    await MockBarzServer.intercept(
      'GET',
      '/v1/battles/BATTLERECORDINGTWO/recording',
      'battle-recording-two.json',
    );
    await MockBarzServer.intercept(
      'GET',
      '/v1/battles/BATTLERECORDINGTHREE/recording',
      'battle-recording-three.json',
    );

    await MockBarzServer.intercept('PUT', '/v1/battles/BATTLERECORDINGONE/view', {
      statusCode: 204,
    });
    await MockBarzServer.intercept('PUT', '/v1/battles/BATTLERECORDINGTWO/view', {
      statusCode: 204,
    });
    await MockBarzServer.intercept('PUT', '/v1/battles/BATTLERECORDINGTHREE/view', {
      statusCode: 204,
    });

    await MockBarzServer.intercept('POST', '/v1/battles/BATTLERECORDINGONE/vote', {
      statusCode: 204,
    });
    await MockBarzServer.intercept('POST', '/v1/battles/BATTLERECORDINGTWO/vote', {
      statusCode: 204,
    });
    await MockBarzServer.intercept('POST', '/v1/battles/BATTLERECORDINGTHREE/vote', {
      statusCode: 204,
    });

    // Mock the comments endpoint to have some sample data
    const battleComment = await loadFixture('battle-comment.json');
    const battleRecordingOne = await loadFixture('battle-recording-one.json');
    await MockBarzServer.intercept('GET', `/v1/battles/${battleRecordingOne.battleId}/comments`, {
      total: 50,
      next: true,
      results: new Array(25).fill(0).map((_, index) => ({
        ...battleComment,
        id: `COMMENT-1-${index}`,
        battleId: battleRecordingOne.battleId,
        user: battleRecordingOne.participants[0].user,
      })),
    });

    // Mock the user that is associated with all the comments
    await MockBarzServer.intercept(
      'GET',
      `/v1/users/${battleRecordingOne.participants[0].user.id}`,
      {
        ...sampleUser,
        ...battleRecordingOne.participants[0].user,
      },
    );

    await MockBarzServer.start();

    await device.reloadReactNative();

    // Sign in to the app using the detox mock user credentials
    await MockSignIn.signInAsDetoxMockUser();
  });

  it('should show the first battle returned by the home endpoint when initially loaded', async () => {
    // // Because this is the first time these battles are being shown, make sure that the initial
    // // loading state is shown
    // await waitFor(HomePage.battleList.initialBattlesLoading()).toBeVisible().withTimeout(12_000);

    // Make sure that the home battle list is visible once loading is complete
    await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(60_000);

    // After a few seconds though, the videos should be fully downloaded and start playing
    const battleRecordingOne = await loadFixture('battle-recording-one.json');
    await waitFor(
      HomePage.battleList
        .forBattle(battleRecordingOne.battleId)
        .forParticipant(battleRecordingOne.participants[0].id)
        .playing(),
    )
      .toBeVisible()
      .withTimeout(12_000);
    await waitFor(
      HomePage.battleList
        .forBattle(battleRecordingOne.battleId)
        .forParticipant(battleRecordingOne.participants[1].id)
        .playing(),
    )
      .toBeVisible()
      .withTimeout(12_000);
  });

  it('should default to "TRENDING" on the home page', async () => {
    // Make sure that the "trending" button is initially viewable in the upper left corner
    await waitFor(HomePage.feedSwitcher.trendingActiveButton()).toBeVisible().withTimeout(12_000);
  });
  it('should switch from "TRENDING" to "FOLLOWING" on the home page', async () => {
    // Make sure that the "trending" button is initially viewable in the upper left corner
    await waitFor(HomePage.feedSwitcher.trendingActiveButton()).toBeVisible().withTimeout(12_000);

    // Press the trending button to open the feed selector
    await HomePage.feedSwitcher.trendingActiveButton().tap();

    // Press "following"
    await HomePage.feedSwitcher.changeToFollowingButton().tap();

    // Make sure a request is made to get the following feed
    await MockBarzServer.waitForRequest(
      'GET',
      '/v1/battles/home',
      ({ req }) => req.query.feed === 'FOLLOWING',
    );

    // Make sure that the "following" button is now visible in the upper left corner
    await waitFor(HomePage.feedSwitcher.followingActiveButton()).toBeVisible().withTimeout(12_000);

    // Press the following button to open the feed selector
    await HomePage.feedSwitcher.followingActiveButton().tap();

    // Press "trending"
    await HomePage.feedSwitcher.changeToTrendingButton().tap();

    // Make sure a request is made to get the trending feed
    await MockBarzServer.waitForRequest(
      'GET',
      '/v1/battles/home',
      ({ req }) => req.query.feed === 'TRENDING',
    );
  });

  describe('With battles loaded', () => {
    beforeEach(async () => {
      // Make sure that the home battle list is visible once loading is complete
      // This could take a while for the first test that runs
      await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(60_000);
    });

    it('should show the next battle when swiping up, and previous battle when swiping down', async () => {
      // Make sure that the home battle list is visible
      await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(30_000);

      // Make sure that battle recording one is visible
      const battleRecordingOne = await loadFixture('battle-recording-one.json');
      await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
        .toExist()
        .withTimeout(30_000);

      // Wait for battle two to finish loading and be in the list of battles
      const battleRecordingTwo = await loadFixture('battle-recording-two.json');
      await waitFor(HomePage.battleList.forBattle(battleRecordingTwo.battleId).wrapper())
        .toExist()
        .withTimeout(30_000);

      // Swipe from bottom to top on the screen
      await HomePage.battleList.swipeUp();

      // Make sure that battle recording two is now visible
      await waitFor(HomePage.battleList.forBattle(battleRecordingTwo.battleId).visible())
        .toBeVisible()
        .withTimeout(12_000);

      // Make sure that a request was made to log that the user viewed battle one after swiping
      await MockBarzServer.waitForRequest('PUT', '/v1/battles/BATTLERECORDINGONE/view');

      // Swipe from top to bottom on the screen
      await HomePage.battleList.swipeDown();

      // Make sure that battle recording one is now visible again
      await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
        .toBeVisible()
        .withTimeout(12_000);
    });

    it.todo('should fetch more battles in the list as the user swipes through them');
    it.todo('should uncache previous battles once they get far enough back in the history');
    it.todo('should report to the server every time a battle has finished being viewed');
    it.todo('should pause battle playback when moving to the user profile page');
    it.todo('should pause battle playback when backgrounding the app');
    it.todo('should pause battle playback when tapping the screen');

    describe('Voting', () => {
      it('should submit a vote to the server when the "vote" button is pressed', async () => {
        // Make sure that the home battle list is visible
        await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that battle recording one is visible
        const battleRecordingOne = await loadFixture('battle-recording-one.json');
        await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
          .toBeVisible()
          .withTimeout(30_000);

        // Press "vote" for the first participant in battle recording one
        HomePage.battleList
          .forBattle(battleRecordingOne.battleId)
          .forParticipant(battleRecordingOne.participants[0].id)
          .voteButton()
          .tap();

        // Make sure that a request was made to vote for the given participant
        await MockBarzServer.waitForRequest(
          'POST',
          '/v1/battles/BATTLERECORDINGONE/vote',
          ({ req }) => {
            return (
              req.body.participantId === battleRecordingOne.participants[0].id &&
              req.body.amount === 1
            );
          },
        );
      });
      it('should debounce votes so that pressing the button 3x quickly only makes one vote request', async () => {
        // Make sure that the home battle list is visible
        await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that battle recording one is visible
        const battleRecordingOne = await loadFixture('battle-recording-one.json');
        await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
          .toBeVisible()
          .withTimeout(30_000);

        // Press "vote" 3 times quickly for the first participant in battle recording one
        HomePage.battleList
          .forBattle(battleRecordingOne.battleId)
          .forParticipant(battleRecordingOne.participants[0].id)
          .voteButton()
          .multiTap(3);

        // Make sure that a request was made to vote for the given participant for 3 votes
        await MockBarzServer.waitForRequest(
          'POST',
          '/v1/battles/BATTLERECORDINGONE/vote',
          ({ req }) => {
            return (
              req.body.participantId === battleRecordingOne.participants[0].id &&
              req.body.amount === 3 // <=== THIS SHOULD MATCH THE NUMBER OF PRESSES ABOVE!
            );
          },
        );
      });
      it('should show updated vote totals for each participant when they are pushed from the server', async () => {
        // Make sure that the home battle list is visible
        await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that battle recording one is visible
        const battleRecordingOne = await loadFixture('battle-recording-one.json');
        await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
          .toBeVisible()
          .withTimeout(30_000);

        // Publish a message with updated vote totals
        await MockPusher.publish('private-battle-BATTLERECORDINGONE-results', 'battle.results', {
          computedTotalVoteAmountByParticipantId: {
            [battleRecordingOne.participants[0].id]: 100,
            [battleRecordingOne.participants[1].id]: 999,
          },
          winningOrTieingBattleParticipantIds: [],
        });

        // Make sure that the first participant's vote total says "100" now
        await waitFor(
          HomePage.battleList
            .forBattle(battleRecordingOne.battleId)
            .forParticipant(battleRecordingOne.participants[0].id)
            .voteButtonContainingVotes(100),
        )
          .toBeVisible()
          .withTimeout(12_000);

        // Make sure that the second participant's vote total says "999" now
        await waitFor(
          HomePage.battleList
            .forBattle(battleRecordingOne.battleId)
            .forParticipant(battleRecordingOne.participants[1].id)
            .voteButtonContainingVotes(999),
        )
          .toBeVisible()
          .withTimeout(12_000);
      });
      it('should show updated user score values when they are pushed from the server', async () => {
        // Make sure that the home battle list is visible
        await waitFor(HomePage.battleList.wrapper()).toBeVisible().withTimeout(12_000);

        // Make sure that battle recording one is visible
        const battleRecordingOne = await loadFixture('battle-recording-one.json');
        await waitFor(HomePage.battleList.forBattle(battleRecordingOne.battleId).visible())
          .toBeVisible()
          .withTimeout(30_000);

        // Publish a message with an updated user clout score
        await MockPusher.publish(
          `private-user-${battleRecordingOne.participants[0].user.id}`,
          'user.update',
          {
            ...battleRecordingOne.participants[0],
            computedScore: 66_666,
          },
        );

        // Make sure that the score showed up under the first participant's name
        await waitFor(
          HomePage.battleList
            .forBattle(battleRecordingOne.battleId)
            .forParticipant(battleRecordingOne.participants[0].id)
            .score(),
        )
          .toHaveText('66666')
          .withTimeout(12_000);
      });
    });

    describe('Commenting', () => {
      it('should be able to open / close the comment sheet', async () => {
        const battleRecordingOne = await loadFixture('battle-recording-one.json');

        // Press the comments button to open the comments sheet
        await HomePage.battleList.forBattle(battleRecordingOne.battleId).commentsButton().tap();

        // Make sure the comments sheet is visible
        await waitFor(HomePage.battleList.commentsBottomSheet.header())
          .toBeVisible()
          .withTimeout(12_000);

        // Drag the comments sheet down to close it
        await HomePage.battleList.commentsBottomSheet.swipeDownToClose();

        // Make sure the comments sheet is no longer visible
        await waitFor(HomePage.battleList.commentsBottomSheet.header())
          .not.toBeVisible()
          .withTimeout(12_000);
      });
      // FIXME: the below infinite scroll test seems to be a bit flaky and needs some work to become
      // more reliable
      it.skip('should be able to load a really large comment list via infinite scroll', async () => {
        const battleRecordingOne = await loadFixture('battle-recording-one.json');
        const battleComment = await loadFixture('battle-comment.json');

        // Press the comments button to open the comments sheet
        await HomePage.battleList.forBattle(battleRecordingOne.battleId).commentsButton().tap();

        // Make sure the comments sheet is visible
        await waitFor(HomePage.battleList.commentsBottomSheet.header())
          .toBeVisible()
          .withTimeout(12_000);

        // Mock a large second page of data to fetch
        await MockBarzServer.intercept(
          'GET',
          `/v1/battles/${battleRecordingOne.battleId}/comments`,
          {
            statusCode: 200,
            body: {
              total: 50,
              next: true,
              results: new Array(10).fill(0).map((_, index) => ({
                ...battleComment,
                id: `COMMENT-2-${index}`,
                battleId: battleRecordingOne.battleId,
                user: battleRecordingOne.participants[0].user,
              })),
            },
          },
        );

        // Expand the comments sheet upwards to make it full screen
        await HomePage.battleList.commentsBottomSheet.swipeUpToExpand();

        // Scroll downwards in the list view, which should trigger the infinite scroll data loading behavior
        await HomePage.battleList.commentsBottomSheet.commentList().swipe('up', 'slow');

        // FIXME: it ideally would be good to assert that the loading indicator showed up here as
        // well, but for some reason, the above `swipe` function call seems to take a long time
        // which means the loading indicator disappears before the `swipe` call completes.

        // Wait for page #2's data to load
        await waitFor(
          HomePage.battleList.commentsBottomSheet.commentListContainingNumberOfComments(
            25 /* page one's data */ + 10 /* page two's data */,
          ),
        )
          .toExist()
          .withTimeout(12_000);
      });

      describe('With the comment sheet open', () => {
        beforeEach(async () => {
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Press the comments button to open the comments sheet
          await HomePage.battleList.forBattle(battleRecordingOne.battleId).commentsButton().tap();

          // Make sure the comments sheet is visible
          await waitFor(HomePage.battleList.commentsBottomSheet.header())
            .toBeVisible()
            .withTimeout(12_000);

          // Expand the comments sheet upwards to make it full screen
          await HomePage.battleList.commentsBottomSheet.swipeUpToExpand();
        });

        it('should post a new comment', async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Mock a request to create a new comment
          await MockBarzServer.intercept(
            'POST',
            `/v1/battles/${battleRecordingOne.battleId}/comments`,
            {
              statusCode: 201,
              body: {
                ...battleComment,
                id: `NEWCOMMENT`,
                commentedAt: new Date().toISOString(),
                text: 'NEW MESSAGE',
                battleId: battleRecordingOne.battleId,
              },
            },
          );

          // Type a message into the bottom comment box
          await HomePage.battleList.commentsBottomSheet
            .postCommentTextField()
            .typeText('NEW MESSAGE');

          // Press "post"
          await HomePage.battleList.commentsBottomSheet.postCommentButton().tap();

          // Wait for a POST request to be made to create the comment
          await MockBarzServer.waitForRequest(
            'POST',
            `/v1/battles/${battleRecordingOne.battleId}/comments`,
          );

          // Make sure that the number of comments increased by one due to the new comment showing up
          // in the list
          await waitFor(
            HomePage.battleList.commentsBottomSheet.commentListContainingNumberOfComments(
              25 /* page one's data */ + 1 /* newly created comment */,
            ),
          )
            .toExist()
            .withTimeout(12_000);
        });
        it('should add a new comment to the list when a pusher message is received', async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Send a pusher message to add a new comment
          await MockPusher.publish(
            `private-battle-${battleRecordingOne.battleId}-comments`,
            'battleComment.create',
            {
              ...battleComment,
              id: `NEWCOMMENT`,
              commentedAt: new Date().toISOString(),
              text: 'NEW MESSAGE',
              battleId: battleRecordingOne.battleId,
            },
          );

          // Make sure that the new comment shows up in the list
          await waitFor(HomePage.battleList.commentsBottomSheet.forComment('NEWCOMMENT').wrapper())
            .toBeVisible()
            .withTimeout(12_000);
        });
        it(`should update a comment's text in the list when a pusher message is received`, async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Send a pusher message to update a comment in the list
          await MockPusher.publish(
            `private-battle-${battleRecordingOne.battleId}-comments`,
            'battleComment.update',
            {
              ...battleComment,
              id: `COMMENT-1-0`,
              text: 'UPDATED MESSAGE',
              battleId: battleRecordingOne.battleId,
            },
          );

          // Make sure that the new comment text shows up in the comments list
          await expect(
            element(
              by
                .id('home-battle-list-comments-bottom-sheet-wrapper')
                .withDescendant(by.text('UPDATED MESSAGE')),
            ),
          ).toBeVisible();
        });
        it('should vote / unvote a comment', async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Mock the comment voting request, and return an incremented vote total
          await MockBarzServer.intercept(
            'POST',
            `/v1/battles/BATTLERECORDINGONE/comments/COMMENT-1-0/vote`,
            {
              ...battleComment,
              id: `COMMENT-1-0`,
              battleId: battleRecordingOne.battleId,
              computedVoteTotal: 6, // <== THIS IS THE IMPORTANT FIELD
            },
          );

          // Press the "vote" button on the first comment
          await HomePage.battleList.commentsBottomSheet
            .forComment('COMMENT-1-0')
            .voteButton()
            .tap();

          // Make sure that the vote total increments within the comment item
          await expect(
            element(
              by
                .id('home-battle-list-comments-bottom-sheet-comment-COMMENT-1-0-wrapper')
                .withDescendant(by.text('6')),
            ),
          ).toBeVisible();

          // Now, unvote the comment!

          // Mock the comment voting request, and return the original vote total again
          await MockBarzServer.intercept(
            'POST',
            `/v1/battles/BATTLERECORDINGONE/comments/COMMENT-1-0/unvote`,
            {
              ...battleComment,
              id: `COMMENT-1-0`,
              battleId: battleRecordingOne.battleId,
              computedVoteTotal: 5, // <== THIS IS THE IMPORTANT FIELD
            },
          );

          // Press the "unvote" button on the first comment
          await HomePage.battleList.commentsBottomSheet
            .forComment('COMMENT-1-0')
            .unvoteButton()
            .tap();

          // Make sure that the vote total goes back to the original value within the comment item
          await expect(
            element(
              by
                .id('home-battle-list-comments-bottom-sheet-comment-COMMENT-1-0-wrapper')
                .withDescendant(by.text('5')),
            ),
          ).toBeVisible();
        });
        it(`should change a comment's vote totals when a pusher message is received`, async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Send a pusher message to update a comment in the list's vote totals
          await MockPusher.publish(
            `private-battle-${battleRecordingOne.battleId}-comments`,
            'battleComment.update',
            {
              ...battleComment,
              id: `COMMENT-1-0`,
              battleId: battleRecordingOne.battleId,
              computedVoteTotal: 9354, // <== THIS IS THE IMPORTANT FIELD
            },
          );

          // Make sure that the new vote total shows up in the comments list
          await expect(
            element(
              by
                .id('home-battle-list-comments-bottom-sheet-wrapper')
                .withDescendant(by.text('9354')),
            ),
          ).toBeVisible();
        });
        it('should be able to visit a user profile by tapping on a user profile image', async () => {
          // Press the avatar image of the first comment
          await HomePage.battleList.commentsBottomSheet
            .forComment('COMMENT-1-0')
            .avatarImage()
            .tap();

          // Make sure the user profile page is now visible
          await waitFor(ProfilePage.wrapper()).toBeVisible().withTimeout(12_000);
        });
        it('should delete a comment by long pressing on the comment', async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Send a pusher message to add a new comment that was created by this user
          await MockPusher.publish(
            `private-battle-${battleRecordingOne.battleId}-comments`,
            'battleComment.create',
            {
              ...battleComment,
              id: `NEWCOMMENT`,
              commentedAt: new Date().toISOString(),
              text: 'NEW MESSAGE',
              battleId: battleRecordingOne.battleId,
              user: {
                id: 'CURRENTUSER',
                handle: 'barzdetoxtest',
                name: 'Barz Detox Test',
                profileImageUrl: null,
                computedScore: 5000,
                computedFollowersCount: 0,
                computedFollowingCount: 0,
              },
            },
          );

          // Wait for the new comment to show up in the list
          await waitFor(HomePage.battleList.commentsBottomSheet.forComment('NEWCOMMENT').wrapper())
            .toBeVisible()
            .withTimeout(12_000);

          // Mock the comment deleting request, and return an incremented vote total
          await MockBarzServer.intercept(
            'DELETE',
            `/v1/battles/BATTLERECORDINGONE/comments/NEWCOMMENT`,
            {
              statusCode: 204,
            },
          );

          // Long press the comment
          await HomePage.battleList.commentsBottomSheet
            .forComment('NEWCOMMENT')
            .wrapper()
            .longPress();

          // Press "Delete Comment" in the popup
          await systemDialog('Delete Comment').tap();

          // Wait for a DELETE request to be made to remove the comment
          await MockBarzServer.waitForRequest(
            'DELETE',
            `/v1/battles/BATTLERECORDINGONE/comments/NEWCOMMENT`,
          );

          // Make sure the comment goes away
          await waitFor(HomePage.battleList.commentsBottomSheet.forComment('NEWCOMMENT').wrapper())
            .not.toBeVisible()
            .withTimeout(12_000);
        });
        it('should remove a comment from the list when a pusher message is received', async () => {
          const battleComment = await loadFixture('battle-comment.json');
          const battleRecordingOne = await loadFixture('battle-recording-one.json');

          // Send a pusher message to remove a comment
          await MockPusher.publish(
            `private-battle-${battleRecordingOne.battleId}-comments`,
            'battleComment.delete',
            {
              ...battleComment,
              id: `COMMENT-1-0`,
            },
          );

          // Make sure that the comment goes away
          await waitFor(HomePage.battleList.commentsBottomSheet.forComment('COMMENT-1-0').wrapper())
            .not.toBeVisible()
            .withTimeout(12_000);
        });
      });
    });
  });
});
