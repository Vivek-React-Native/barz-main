import { SafeAreaView, View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { UserProfileHeader, UserProfileBioDetails } from '@barz/mobile/src/components/UserProfile';

import { BattleParticipant } from '@barz/mobile/src/lib/api';
import Button from '@barz/mobile/src/ui/Button';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import {
  Crown as IconCrown,
  ChevronUpFill as IconChevronUpFill,
  ChevronDownFill as IconChevronDownFill,
} from '@barz/mobile/src/ui/icons';

import { BattleContextData } from '../context';

const styles = StyleSheet.create({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
  },

  profileWrapper: {
    alignItems: 'center',
    height: '100%',
    paddingTop: 36,
    paddingBottom: 120,
    flexGrow: 1,
  },

  profileBioWrapper: {
    width: '100%',
    paddingTop: 24,
  },

  opponentNotFoundWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomReadyButtonContainerWrapper: {
    width: '100%',
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },

  bottomReadyButtonContainer: {
    backgroundColor: Color.Gray.Dark3,
  },

  winTieLoseContainer: {
    width: '100%',
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  winTieLoseInner: {
    paddingVertical: 12,
  },
  winTieLoseRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    alignItems: 'center',
  },
  cloutScore: {
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

const WinTieLose: React.FunctionComponent<{
  projectedOutcome: NonNullable<BattleContextData['projectedOutcome']>;
}> = ({ projectedOutcome }) => {
  const winDifference = projectedOutcome.projectedScores.win - projectedOutcome.startingScore;
  const tieDifference = projectedOutcome.projectedScores.tie - projectedOutcome.startingScore;
  const lossDifference = projectedOutcome.projectedScores.loss - projectedOutcome.startingScore;

  return (
    <View style={styles.winTieLoseContainer}>
      <View style={styles.winTieLoseInner}>
        <Text style={{ ...Typography.Body2, color: Color.White }}>Win</Text>
        <View style={styles.winTieLoseRow}>
          {winDifference < 0 ? (
            <IconChevronDownFill size={18} color={Color.Red.Dark11} />
          ) : (
            <IconChevronUpFill size={18} color={Color.Green.Dark11} />
          )}
          <View style={styles.cloutScore}>
            <IconCrown size={18} />
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              {Math.abs(winDifference)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.winTieLoseInner}>
        <Text style={{ ...Typography.Body2, color: Color.White }}>Tie</Text>
        <View style={styles.winTieLoseRow}>
          {tieDifference < 0 ? (
            <IconChevronDownFill size={18} color={Color.Red.Dark11} />
          ) : (
            <IconChevronUpFill size={18} color={Color.Green.Dark11} />
          )}
          <View style={styles.cloutScore}>
            <IconCrown size={18} />
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              {Math.abs(tieDifference)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.winTieLoseInner}>
        <Text style={{ ...Typography.Body2, color: Color.White }}>Lose</Text>
        <View style={styles.winTieLoseRow}>
          {lossDifference < 0 ? (
            <IconChevronDownFill size={18} color={Color.Red.Dark11} />
          ) : (
            <IconChevronUpFill size={18} color={Color.Green.Dark11} />
          )}
          <View style={styles.cloutScore}>
            <IconCrown size={18} />
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              {Math.abs(lossDifference)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// The opponent found screen is shown to a user once they have an opponent selected for them so they
// can preview the opponent priopr to battling them
const OpponentFoundScreen: React.FunctionComponent<{
  opponentParticipant: Omit<BattleParticipant, 'battleId'> | null;
  userAssociatedWithOpponentParticipant: BattleContextData['userAssociatedWithOpponentParticipant'];
  onReadyPress: () => void;
  isReadyForBattle: boolean;
  readyCountdownComplete: boolean;
  readyCountdownSeconds: number;
  projectedOutcome: BattleContextData['projectedOutcome'];
}> = ({
  opponentParticipant,
  userAssociatedWithOpponentParticipant,
  onReadyPress,
  isReadyForBattle,
  readyCountdownComplete,
  readyCountdownSeconds,
  projectedOutcome,
}) => {
  return (
    <View testID="battle-matching-container">
      <StatusBar style="light" />
      <SafeAreaView style={{ position: 'relative', width: '100%', height: '100%' }}>
        {userAssociatedWithOpponentParticipant.status === 'LOADING' ? (
          <View style={styles.opponentNotFoundWrapper}>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark10 }}>
              Loading opponent...
            </Text>
          </View>
        ) : null}
        {userAssociatedWithOpponentParticipant.status === 'COMPLETE' ? (
          <ScrollView>
            <View style={styles.profileWrapper}>
              <UserProfileHeader user={userAssociatedWithOpponentParticipant.data} />
              <View style={styles.profileBioWrapper}>
                <UserProfileBioDetails
                  user={userAssociatedWithOpponentParticipant.data}
                  isOwnProfile={false}
                />
              </View>
            </View>
          </ScrollView>
        ) : null}
        {/*
        <ScrollView style={{padding: 8, marginTop: 24, marginBottom: 24, height: 300, flexGrow: 0}}>
          <Text>{JSON.stringify(battleContextData, null, 2)}</Text>
        </ScrollView>
        */}
        <View style={styles.bottomReadyButtonContainerWrapper}>
          <View style={styles.bottomReadyButtonContainer}>
            {projectedOutcome ? <WinTieLose projectedOutcome={projectedOutcome} /> : null}
            {isReadyForBattle ? (
              <Button
                size={48}
                type="primary"
                width="100%"
                disabled
                testID="battle-matching-ready-button"
              >
                Waiting for other participants...
              </Button>
            ) : (
              <Button
                size={48}
                type="primary"
                width="100%"
                testID="battle-matching-ready-button"
                onPress={onReadyPress}
                // Once the other opponent becomes ready, show their avatar image on the button
                trailing={
                  opponentParticipant?.readyForBattleAt ? (
                    <View testID="battle-matching-other-opponent-ready">
                      <AvatarImage
                        profileImageUrl={opponentParticipant.user.profileImageUrl}
                        size={24}
                      />
                    </View>
                  ) : null
                }
              >{`Ready (${
                readyCountdownComplete ? 'soon' : `${readyCountdownSeconds} sec`
              })`}</Button>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default OpponentFoundScreen;
