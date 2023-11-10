import * as React from 'react';
import { Fragment } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { BattleWithParticipants, BattleParticipant } from '@barz/mobile/src/lib/api';
import Button from '@barz/mobile/src/ui/Button';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';

const styles = StyleSheet.create({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    width: '100%',
    height: '100%',
  },
  innerContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',

    alignItems: 'center',
    gap: 16,
  },
  publicPrivateSelection: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  avatarImageContainer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 100,
    marginBottom: 20,
  },
  bottomReadyButtonContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
  },
});

// The opponent found screen is shown to a user once they have an opponent selected for them so they
// can preview the opponent priopr to battling them
const BattlePrivacyScreen: React.FunctionComponent<{
  battle: BattleWithParticipants | null;
  participant: Omit<BattleParticipant, 'battleId'> | null;
  opponentParticipant: Omit<BattleParticipant, 'battleId'> | null;
  onRequestPrivacyLevel: (privacyLevel: BattleWithParticipants['computedPrivacyLevel']) => void;
  onReadyPress: () => void;
  isReadyForBattle: boolean;
  readyCountdownComplete: boolean;
  readyCountdownSeconds: number;
}> = ({
  battle,
  participant,
  opponentParticipant,
  onRequestPrivacyLevel,
  onReadyPress,
  isReadyForBattle,
  readyCountdownComplete,
  readyCountdownSeconds,
}) => {
  return (
    <View style={styles.container} testID="battle-privacy-container">
      <StatusBar style="light" />
      <SafeAreaView style={styles.innerContainer}>
        <View style={styles.avatarImageContainer}>
          {battle
            ? battle.participants
                .sort((a, b) => {
                  return (a.order ?? Infinity) - (b.order ?? Infinity);
                })
                .map((participant) => (
                  <AvatarImage
                    key={participant.id}
                    profileImageUrl={participant.user.profileImageUrl}
                    size={97}
                  />
                ))
            : null}
        </View>
        <Text style={{ ...Typography.Heading2, color: Color.White }}>Publish Battle?</Text>
        <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11, textAlign: 'center' }}>
          Publishing the battle makes it available for the public to view and vote on. Both
          participants have to consent for the battle to be published.
        </Text>
        <View style={styles.publicPrivateSelection}>
          <Button
            type="outlineAccent"
            size={48}
            width="100%"
            onPress={() => onRequestPrivacyLevel('PRIVATE')}
            disabled={readyCountdownComplete}
            testID="battle-privacy-private-participant-button"
            trailing={
              <Fragment>
                {participant?.requestedBattlePrivacyLevel === 'PRIVATE' ? (
                  <View testID="battle-privacy-private-participant-selected">
                    <AvatarImage profileImageUrl={participant.user.profileImageUrl} size={24} />
                  </View>
                ) : null}
                {opponentParticipant?.requestedBattlePrivacyLevel === 'PRIVATE' ? (
                  <View testID="battle-privacy-private-opponent-selected">
                    <AvatarImage
                      profileImageUrl={opponentParticipant.user.profileImageUrl}
                      size={24}
                    />
                  </View>
                ) : null}
              </Fragment>
            }
          >
            No
          </Button>
          <Button
            type="outlineAccent"
            size={48}
            width="100%"
            onPress={() => onRequestPrivacyLevel('PUBLIC')}
            disabled={readyCountdownComplete}
            testID="battle-privacy-public-participant-button"
            trailing={
              <Fragment>
                {participant?.requestedBattlePrivacyLevel === 'PUBLIC' ? (
                  <View testID="battle-privacy-public-participant-selected">
                    <AvatarImage profileImageUrl={participant.user.profileImageUrl} size={24} />
                  </View>
                ) : null}
                {opponentParticipant?.requestedBattlePrivacyLevel === 'PUBLIC' ? (
                  <View testID="battle-privacy-public-opponent-selected">
                    <AvatarImage
                      profileImageUrl={opponentParticipant.user.profileImageUrl}
                      size={24}
                    />
                  </View>
                ) : null}
              </Fragment>
            }
          >
            Yes
          </Button>
          <View style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
            {battle?.computedPrivacyLevel === 'PUBLIC' ? (
              <Text
                style={{ ...Typography.Body1Bold, color: Color.Gray.Dark11 }}
                testID="battle-privacy-status-public"
              >
                Battle will be published
              </Text>
            ) : (
              <Text
                style={{ ...Typography.Body1Bold, color: Color.Gray.Dark11 }}
                testID="battle-privacy-status-private"
              >
                Battle will not be published
              </Text>
            )}
          </View>
        </View>

        <View style={styles.bottomReadyButtonContainer}>
          {isReadyForBattle ? (
            <Button
              size={48}
              type="primary"
              width="100%"
              disabled
              testID="battle-privacy-ready-button"
            >
              Starting Battle...
            </Button>
          ) : (
            <Button
              size={48}
              type="primary"
              width="100%"
              testID="battle-privacy-ready-button"
              onPress={onReadyPress}
              // Once the other opponent becomes ready, show their avatar image on the button
              trailing={
                opponentParticipant?.readyForBattleAt ? (
                  <View testID="battle-privacy-other-opponent-ready">
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
      </SafeAreaView>
    </View>
  );
};

export default BattlePrivacyScreen;
