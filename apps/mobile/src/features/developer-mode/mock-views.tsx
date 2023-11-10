import { FixMe } from '@barz/mobile/src/lib/fixme';
import { BattleWithParticipants } from '@barz/mobile/src/lib/api';

import { BattlingScreen } from '@barz/mobile/src/features/battle/Battle';
import CoinTossScreen from '@barz/mobile/src/features/battle/components/CoinTossScreen';
import BattleSummaryScreen from '@barz/mobile/src/features/battle/components/BattleSummaryScreen';
import OpponentFoundScreen from '@barz/mobile/src/features/battle/components/OpponentFoundScreen';
import BattlePrivacyScreen from '@barz/mobile/src/features/battle/components/BattlePrivacyScreen';
import { IntroSlideshowContents } from '@barz/mobile/src/features/battle/IntroSlideshow';
import { CreateRapNameIntroContents } from '@barz/mobile/src/features/onboarding/CreateRapNameIntro';

const MOCK_BATTLE: BattleWithParticipants = {
  id: 'CURRENTBATTLE',
  createdAt: '2023-05-16T15:26:47.662Z',
  updatedAt: '2023-05-16T15:28:36.712Z',
  madeInactiveAt: null,
  madeInactiveReason: null,
  startedAt: '2023-05-16T15:26:56.542Z',
  completedAt: '2023-05-16T15:28:33.351Z',
  numberOfRounds: 1,
  turnLengthSeconds: 40,
  warmupLengthSeconds: 10,
  twilioRoomName: 'battle-clhqfg0gr01bhpk2xhxbj4m6h-clhqfepql018lpk2x6evfrsc2-1684250807663',
  beatId: 'CURRENTBEAT',
  votingEndsAt: null,
  computedPrivacyLevel: 'PUBLIC',
  exportedVideoStatus: 'COMPLETED',
  exportedVideoKey: 'export/clk1f24sn00iizn0grcdg811b/export.mp4',
  exportedVideoQueuedAt: '2023-07-13T18:22:59.823Z',
  exportedVideoStartedAt: '2023-07-13T18:22:59.851Z',
  exportedVideoCompletedAt: '2023-07-13T18:23:51.817Z',
  participants: [
    {
      id: 'CURRENTPARTICIPANT',
      createdAt: '2023-05-16T15:26:47.644Z',
      updatedAt: '2023-05-16T15:28:37.060Z',
      userId: 'clhqfg0gi01bepk2x8cnt8q0b',
      order: 0,
      madeInactiveAt: null,
      madeInactiveReason: null,
      associatedWithBattleAt: '2023-05-16T15:28:37.060Z',
      forfeitedAt: null,
      videoStreamingStartedAt: null,
      connectionStatus: 'ONLINE',
      initialMatchFailed: false,
      currentState: 'BATTLE',
      currentContext: {
        version: 1,
        battleId: 'CURRENTBATTLE',
        participantIds: ['CURRENTPARTICIPANT', 'OTHERPARTICIPANT'],
        nextMessageUuid: 'e87ace9b-f4fd-4c56-8fa7-a0a065c4c9eb',
        activeRoundIndex: 0,
        totalNumberOfRounds: 1,
        acknowlegedMessageUuids: [],
        currentParticipantIndex: 0,
      },
      readyForBattleAt: null,
      requestedBattlePrivacyLevel: null,
      twilioAudioTrackId: 'MTaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      twilioVideoTrackId: 'MTbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      twilioDataTrackId: null,
      appState: null,
      twilioCompositionSid: null,
      twilioCompositionStatus: null,
      user: {
        id: 'CURRENTUSER',
        handle: 'barzdetoxtest',
        name: 'Barz Detox Test',
        profileImageUrl: 'https://picsum.photos/100/100?cachebust=1',
        computedScore: 5000,
        computedFollowersCount: 0,
        computedFollowingCount: 0,
      },
      lastCheckedInAt: '2023-05-16T15:28:37.060Z',
    },
    {
      id: 'OTHERPARTICIPANT',
      createdAt: '2023-05-16T15:25:47.086Z',
      updatedAt: '2023-05-16T15:28:40.043Z',
      userId: 'clhqfepq9018ipk2xiz0c5qp3',
      order: 1,
      madeInactiveAt: null,
      madeInactiveReason: null,
      associatedWithBattleAt: '2023-05-16T15:26:47.662Z',
      forfeitedAt: null,
      videoStreamingStartedAt: null,
      connectionStatus: 'ONLINE',
      initialMatchFailed: true,
      currentState: 'WAITING',
      currentContext: {
        version: 1,
        battleId: 'CURRENTBATTLE',
        participantIds: ['CURRENTPARTICIPANT', 'OTHERPARTICIPANT'],
        nextMessageUuid: 'b4836d55-360f-4cf6-b35d-d047f32164b5',
        activeRoundIndex: 0,
        totalNumberOfRounds: 1,
        acknowlegedMessageUuids: [],
        currentParticipantIndex: 0,
      },
      readyForBattleAt: null,
      requestedBattlePrivacyLevel: 'PUBLIC',
      twilioAudioTrackId: 'MT11111111111111111111111111111111',
      twilioVideoTrackId: 'MT22222222222222222222222222222222',
      twilioDataTrackId: 'UNKNOWN',
      appState: null,
      twilioCompositionSid: null,
      twilioCompositionStatus: null,
      user: {
        id: 'OTHERUSER',
        handle: 'barzdetoxother',
        name: 'Barz Detox Other',
        profileImageUrl: 'https://picsum.photos/100/100?cachebust=2',
        computedScore: 5000,
        computedFollowersCount: 0,
        computedFollowingCount: 0,
      },
      lastCheckedInAt: '2023-05-16T15:28:37.060Z',
    },
  ],
};

export function MockBattle({ navigation }: FixMe) {
  return (
    <BattlingScreen
      showMockParticipantViews
      battle={MOCK_BATTLE}
      participant={MOCK_BATTLE.participants[0]}
      remoteParticipantVideoTracks={
        new Map([[MOCK_BATTLE.participants[0].twilioVideoTrackId!, 'b']])
      }
      remoteParticipantAudioMuted={
        new Map([[MOCK_BATTLE.participants[0].twilioVideoTrackId!, false]])
      }
      localAudioMuted={true}
      currentState="WARM_UP"
      isConnectedToInternet={true}
      opponentParticipant={MOCK_BATTLE.participants[1]}
      activeParticipant={MOCK_BATTLE.participants[0]}
      onLeaveButtonPressed={() => navigation.goBack()}
      onLeaveBattleDueToLossOfNetworkConnection={() => {}}
    />
  );
}

export function MockCoinToss({ navigation }: FixMe) {
  return (
    <CoinTossScreen
      showMockParticipantViews
      battle={MOCK_BATTLE}
      firstParticipant={MOCK_BATTLE.participants[0]}
      remoteParticipantVideoTracks={
        new Map([[MOCK_BATTLE.participants[0].twilioVideoTrackId!, 'b']])
      }
      isConnectedToInternet={true}
      onLeaveBattle={() => navigation.goBack()}
    />
  );
}

export function MockBattleSummary({ navigation }: FixMe) {
  return (
    <BattleSummaryScreen
      battle={MOCK_BATTLE}
      leavingBattleInProgress={false}
      twilioVideoStatus="CONNECTED"
      onLeaveBattle={() => navigation.goBack()}
    />
  );
}

export function MockOpponentFound({ navigation }: FixMe) {
  return (
    <OpponentFoundScreen
      opponentParticipant={MOCK_BATTLE.participants[0]}
      userAssociatedWithOpponentParticipant={{
        status: 'COMPLETE',
        data: {
          ...MOCK_BATTLE.participants[0].user,
          computedIsBeingFollowedByUserMe: false,
          computedIsFollowingUserMe: false,

          intro: 'Intro goes here!',
          locationName: 'The Internet',
          locationLatitude: null,
          locationLongitude: null,
          favoriteRapperSpotifyId: null,
          favoriteRapperName: 'Rapper',
          favoriteSongSpotifyId: null,
          favoriteSongName: 'Song',
          favoriteSongArtistName: null,
          instagramHandle: 'barz',
          soundcloudHandle: 'barz',
        },
      }}
      onReadyPress={() => navigation.goBack()}
      isReadyForBattle={false}
      readyCountdownComplete={false}
      readyCountdownSeconds={5}
      projectedOutcome={{
        startingScore: 1000,
        projectedScores: {
          win: 1100,
          tie: 1000,
          loss: 900,
        },
      }}
    />
  );
}

export function MockBattlePrivacyScreen({ navigation }: FixMe) {
  return (
    <BattlePrivacyScreen
      battle={MOCK_BATTLE}
      participant={MOCK_BATTLE.participants[1]}
      opponentParticipant={MOCK_BATTLE.participants[0]}
      onReadyPress={() => navigation.goBack()}
      onRequestPrivacyLevel={() => {}}
      isReadyForBattle={false}
      readyCountdownComplete={false}
      readyCountdownSeconds={5}
    />
  );
}

export function MockIntroSlideshow({ navigation }: FixMe) {
  return (
    <IntroSlideshowContents
      onPressStartBattle={() => navigation.goBack()}
      onPressFillOutProfile={() => navigation.goBack()}
      onPressMaybeLater={() => navigation.goBack()}
      onPressClose={() => navigation.goBack()}
    />
  );
}

export function MockCreateRapNameIntro({ navigation }: FixMe) {
  return (
    <CreateRapNameIntroContents
      generatedRapName="Bender Rodriguez"
      nextLoading={false}
      onPressNext={() => navigation.goBack()}
    />
  );
}
