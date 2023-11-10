import { Alert, SafeAreaView, View, Text, StyleSheet, Platform } from 'react-native';

import {
  Participant as TwilioParticipant,
  Publication as TwilioPublication,
  LocalParticipantView,
  RemoteParticipantView,
} from '@barz/twilio-video';
import {
  LocalParticipantView as MockLocalParticipantView,
  RemoteParticipantView as MockRemoteParticipantView,
} from '@barz/twilio-video/src/mockParticipantViews';

import { BattleParticipant, BattleWithParticipants } from '@barz/mobile/src/lib/api';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import { Close as IconClose } from '@barz/mobile/src/ui/icons';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';

import HeaderButton from '@barz/mobile/src/ui/HeaderButton';

import { useCountdownSeconds, formatSeconds } from '../utils';

const COIN_TOSS_SCREEN_COUNTDOWN_FOR_SECONDS = 10;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    marginLeft: 16,
    marginRight: 16,
    zIndex: 99999999999,
    marginTop: Platform.select({ ios: 0, android: 24 }),
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 56,
  },

  firstParticipantName: {
    ...Typography.Heading1,
    color: Color.White,
    marginTop: 28,
  },
  firstParticipantNameSubtitle: {
    ...Typography.Heading3,
    color: Color.White,
    marginTop: 4,
  },
  rulesWrapper: {
    marginTop: 36,
    alignItems: 'center',
  },
  rulesLine: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
  },

  battleCountdown: {
    marginTop: 48,
    ...Typography.Body1Bold,
    color: Color.Yellow.Dark10,
  },
});

// The coin toss screen is rendered while the battle is initializing / during the COIN_TOSS state.
//
// It renders some fancy graphics to show the "coin flip" action, resulting in the order which has
// pre-generated serverside.
const CoinTossScreen: React.FunctionComponent<{
  battle: BattleWithParticipants;
  firstParticipant?: Omit<BattleParticipant, 'battleId'>;
  remoteParticipantVideoTracks: Map<TwilioParticipant['sid'], TwilioPublication['trackSid']>;
  isConnectedToInternet: boolean;
  showMockParticipantViews?: boolean;
  onLeaveBattle: () => void;
}> = ({
  battle,
  firstParticipant,
  remoteParticipantVideoTracks,
  isConnectedToInternet,
  showMockParticipantViews,
  onLeaveBattle,
}) => {
  const LocalParticipantViewComponent = showMockParticipantViews
    ? MockLocalParticipantView
    : LocalParticipantView;
  const RemoteParticipantViewComponent = showMockParticipantViews
    ? MockRemoteParticipantView
    : RemoteParticipantView;

  // Once the component renders, start counting down until the battle starts
  const [countdownSeconds, countdownComplete] = useCountdownSeconds(
    // FIXME: add one to the countdown length. For some reason, it seems to take about a second for the
    // state transition to actually run on the device (and the device to show the video streams /
    // etc). I don't get this and this might be emblematic of some larger problem that needs investigation.
    //
    // This effectively keeps the "Battle starts soon" state from showing most of the time
    COIN_TOSS_SCREEN_COUNTDOWN_FOR_SECONDS + 1,
  );

  if (!firstParticipant) {
    // FIXME: add loading state here
    return (
      <View style={styles.container}>
        <Text style={{ ...Typography.Body2, color: Color.Brand.Gray3 }}>Loading...</Text>
      </View>
    );
  }

  // let videoAvatar: React.ReactNode = null;
  // if (firstParticipant.twilioVideoTrackId) {
  //   const remoteParticipantTrackSid = remoteParticipantVideoTracks.get(firstParticipant.twilioVideoTrackId);
  //   videoAvatar = remoteParticipantTrackSid ? (
  //     <RemoteParticipantViewComponent
  //       key={remoteParticipantTrackSid}
  //       enabled
  //       scaleType="fill"
  //       remoteParticipantSid={firstParticipant.twilioVideoTrackId}
  //       remoteParticipantTrackSid={remoteParticipantTrackSid}
  //       style={{ width: 140, height: 140, borderRadius: 70 }}
  //     />
  //   ) : (
  //     <LocalParticipantViewComponent
  //       enabled
  //       scaleType="fill"
  //       style={{ width: 140, height: 140, borderRadius: 70 }}
  //     />
  //   );
  // }

  return (
    <SafeAreaView style={{ width: '100%', height: '100%' }}>
      <View style={styles.topBar}>
        <HeaderButton
          accentColor={Color.Brand.Red}
          onPress={() => {
            Alert.alert('Are you sure?', 'Leaving the battle will forfeit.', [
              {
                text: 'Leave',
                onPress: () => onLeaveBattle(),
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]);
          }}
          testID="coin-toss-battle-leave-button"
          leading={(color) => <IconClose color={color} />}
        >
          Forfeit
        </HeaderButton>
      </View>

      <View style={styles.container}>
        <AvatarImage profileImageUrl={firstParticipant.user.profileImageUrl} size={140} />
        {/* {videoAvatar} */}

        <Text style={styles.firstParticipantName}>{firstParticipant.user.name}</Text>
        <Text style={styles.firstParticipantNameSubtitle}>you spit first</Text>

        <View style={styles.rulesWrapper}>
          <Text style={styles.rulesLine}>
            {battle.numberOfRounds === 1
              ? 'One verse each'
              : `${battle.numberOfRounds} verses each`}
          </Text>
          <Text style={styles.rulesLine}>Each verse is {battle.turnLengthSeconds} seconds</Text>
          <Text style={styles.rulesLine}>
            {battle.warmupLengthSeconds} {battle.warmupLengthSeconds === 1 ? 'second' : 'seconds'}{' '}
            to warm up, {battle.turnLengthSeconds - battle.warmupLengthSeconds} to rap
          </Text>
        </View>

        {isConnectedToInternet ? (
          <Text style={styles.battleCountdown}>
            Battle starts{' '}
            {countdownComplete
              ? 'soon'
              : `in ${formatSeconds(
                  Math.min(countdownSeconds, COIN_TOSS_SCREEN_COUNTDOWN_FOR_SECONDS),
                )}`}
          </Text>
        ) : null}

        {/*
        <View style={styles.participantList}>
          <LocalParticipantViewComponent enabled scaleType="fill" style={{width: 100, height: 100}} />
          {Array.from(remoteParticipantVideoTracks).slice(0, 1).map(([sid, trackSid]) => (
            <RemoteParticipantViewComponent
              key={trackSid}
              enabled
              scaleType="fill"
              remoteParticipantSid={sid}
              remoteParticipantTrackSid={trackSid}
              style={{ width: 100, height: 100 }}
            />
          ))}
        </View>
        */}
      </View>
    </SafeAreaView>
  );
};

export default CoinTossScreen;
