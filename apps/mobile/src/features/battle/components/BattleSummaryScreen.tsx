import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { BattleContextData } from '@barz/mobile/src/features/battle/context';
import { BattleWithParticipants } from '@barz/mobile/src/lib/api';
import Button from '@barz/mobile/src/ui/Button';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import BarzLogo from '@barz/mobile/src/components/BarzLogo';
// import { Close as IconClose } from '@barz/mobile/src/ui/icons';
//
import { TWILIO_VIDEO_BATTLE_SUMMARY_PAGE_MAX_TIME_MILLISECONDS } from '../constants';
import { useCountdownSeconds, formatSeconds } from '../utils';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 56,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 56,
  },
  summary: {
    alignItems: 'center',
    gap: 32,
  },
  title: {
    ...Typography.Heading1,
    color: Color.White,
  },

  userAvatarGroup: {
    flexDirection: 'row-reverse',
  },
  userAvatarGroupItem: {
    borderWidth: 2,
    borderColor: Color.Black,
    borderRadius: 48,
  },

  summaryText: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
    textAlign: 'center',
  },
});

// The coin toss screen is rendered while the battle is initializing / during the COIN_TOSS state.
//
// It renders some fancy graphics to show the "coin flip" action, resulting in the order which has
// pre-generated serverside.
const BattleSummaryScreen: React.FunctionComponent<{
  battle: BattleWithParticipants;
  leavingBattleInProgress: boolean;
  twilioVideoStatus: BattleContextData['twilioVideo']['status'];
  onLeaveBattle: () => void;
}> = ({ battle, leavingBattleInProgress, twilioVideoStatus, onLeaveBattle }) => {
  const [summaryCountdownSeconds, summaryCountdownComplete] = useCountdownSeconds(
    TWILIO_VIDEO_BATTLE_SUMMARY_PAGE_MAX_TIME_MILLISECONDS / 1000,
  );

  let closeButton: React.ReactNode = null;

  if (leavingBattleInProgress) {
    closeButton = (
      <Button size={48} type="primary" disabled>
        Leaving battle...
      </Button>
    );
  } else if (twilioVideoStatus === 'DISCONNECTING') {
    closeButton = (
      <Button size={48} type="primary" disabled>
        Disconnecting from twilio video...
      </Button>
    );
  } else {
    closeButton = (
      <Button
        type="primary"
        size={48}
        onPress={() => onLeaveBattle()}
        testID="battle-summary-close-button"
      >
        {`Done (${summaryCountdownComplete ? 'soon' : `${summaryCountdownSeconds} sec`})`}
      </Button>
    );
  }

  return (
    <View style={styles.container} testID="battle-summary-container">
      <StatusBar style="light" />

      <View style={styles.summary}>
        <BarzLogo />

        <Text style={styles.title}>Who got Barz?</Text>

        <View style={styles.userAvatarGroup}>
          {battle.participants.map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.userAvatarGroupItem,
                {
                  transform: [{ translateX: index === 0 ? -8 : 8 }],
                },
              ]}
            >
              <AvatarImage size={96} profileImageUrl={participant.user.profileImageUrl} />
            </View>
          ))}
        </View>

        <Text style={styles.summaryText}>
          These are just the live results, the replay will be uploaded shortly.
        </Text>
      </View>

      {/*
      <ScrollView style={{padding: 8, marginTop: 24, marginBottom: 24, height: 300, flexGrow: 0}}>
        <Text>{JSON.stringify(battleContextData, null, 2)}</Text>
      </ScrollView>
      */}

      {/* Once the battle is complete, reset the context state and go back to the start */}
      {closeButton}
    </View>
  );
};

export default BattleSummaryScreen;
