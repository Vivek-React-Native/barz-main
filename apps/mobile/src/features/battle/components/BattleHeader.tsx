import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Fragment, useEffect, useState } from 'react';
import alpha from 'color-alpha';

import { BattleWithParticipants, BattleParticipant } from '@barz/mobile/src/lib/api';
import Button from '@barz/mobile/src/ui/Button';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { Close as IconClose } from '@barz/mobile/src/ui/icons';

import { useCountdownSeconds, formatSeconds } from '../utils';
import Chip from '@barz/mobile/src/ui/Chip';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.select({ ios: 0, android: 32 }),
    left: 0,
    right: 0,
    height: 164,
    zIndex: 99999,
  },
  containerInner: {
    flexDirection: 'column',

    paddingLeft: 16,
    paddingRight: 16,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opponentDetails: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicatorText: {
    fontSize: 14,
    fontFamily: 'Archivo Medium',
    color: Color.Brand.Yellow,
  },
  opponentVersusText: {
    ...Typography.Body2,
    color: Color.Gray.Dark11,
  },
  opponentName: {
    ...Typography.Body2SemiBold,

    color: Color.White,
  },
  opponentImagePlaceholder: {},
  opponentNameLoading: {},

  progressBar: {
    flexDirection: 'row',
    gap: 8,
    height: 4,
    marginTop: 19,
  },
  progressBarSectionWrapper: {
    height: '100%',
    backgroundColor: alpha(Color.Brand.Gray1, 0.1),
  },
  progressBarSectionInner: {
    width: '100%',
    height: '100%',
    backgroundColor: Color.Yellow.Dark10,
  },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  titleRowName: {
    ...Typography.Heading3,
    color: 'white',
  },
  titleRowDetail: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  titleRowDetailFirst: {
    ...Typography.Body1,
    color: Color.Gray.Dark9,
  },
  titleRowDetailLast: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
    marginLeft: 8,
  },
});

// The battle header renders the topmost status indicators at the top of the battle.
//
// This includes the currently active participant, the "progress bar" showing how far
// the battle has progressed, and the currently active battle phase.
const BattleHeader: React.FunctionComponent<{
  battle: BattleWithParticipants;
  activeParticipant?: Omit<BattleParticipant, 'battleId'>;
  opponentParticipant?: Omit<BattleParticipant, 'battleId'>;
  onLeaveBattle: () => void;
}> = ({ battle, opponentParticipant, activeParticipant, onLeaveBattle }) => {
  const activeParticipantCurrentState = activeParticipant?.currentState;

  const battleLengthSeconds = battle.turnLengthSeconds - battle.warmupLengthSeconds;

  const [[countdownMaxSeconds, countdownEnabled], setCountdownMetadata] = useState([0, false]);
  const [countdownSeconds, countdownComplete] = useCountdownSeconds(
    countdownMaxSeconds,
    countdownEnabled,
  );
  useEffect(() => {
    switch (activeParticipantCurrentState) {
      case 'WARM_UP':
        setCountdownMetadata([battle.warmupLengthSeconds, true]);
        break;
      case 'BATTLE':
        setCountdownMetadata([battleLengthSeconds, true]);
        break;
      default:
        setCountdownMetadata([0, false]);
        break;
    }
  }, [activeParticipantCurrentState, battle.warmupLengthSeconds, battleLengthSeconds]);

  const statusRow = (
    <View style={styles.statusRow}>
      <View style={styles.opponentDetails}>
        <Chip size={22} selected={true}>
          LIVE
        </Chip>
        <Text style={styles.opponentVersusText}>vs.</Text>
        {opponentParticipant ? (
          <Fragment>
            <AvatarImage size={22} profileImageUrl={opponentParticipant.user.profileImageUrl} />
            <Text style={styles.opponentName}>{opponentParticipant.user.name}</Text>
          </Fragment>
        ) : (
          <Fragment>
            <View style={styles.opponentImagePlaceholder} />
            <Text style={styles.opponentNameLoading}>Loading</Text>
          </Fragment>
        )}
      </View>
      {/* <View style={{flexDirection: 'row'}}> */}
      {/*   {battle.participants.map(p => ( */}
      {/*     <Text */}
      {/*       key={p.id} */}
      {/*       style={{ */}
      {/*         fontWeight: p.id === activeParticipant?.id ? 'bold' : 'normal', */}
      {/*         fontSize: 8, */}
      {/*         marginRight: 24, */}
      {/*         color: 'white', */}
      {/*       }} */}
      {/*     >{p.id}</Text> */}
      {/*   ))} */}
      {/* </View> */}
      <Button
        size={32}
        width={32}
        type="text"
        onPress={() => onLeaveBattle()}
        testID="battle-leave-button"
        leading={<IconClose color={Color.Brand.Red} />}
      />
    </View>
  );

  const progressBarWarmupSectionWidthPercent = `${
    (battle.warmupLengthSeconds / battle.turnLengthSeconds) * 100
  }%`;

  const emptyProgressBarRow = (
    <View style={styles.progressBar}>
      <View
        style={[styles.progressBarSectionWrapper, { width: progressBarWarmupSectionWidthPercent }]}
      />
      <View style={[styles.progressBarSectionWrapper, { flexGrow: 1 }]} />
    </View>
  );

  if (!activeParticipantCurrentState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.containerInner}>
          {statusRow}
          {emptyProgressBarRow}
          <View style={styles.titleRow}>
            <Text style={styles.titleRowName}>Waiting</Text>
            <View style={styles.titleRowDetail}>
              <Text style={styles.titleRowDetailFirst}>Starts soon</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  switch (activeParticipantCurrentState) {
    case 'WARM_UP':
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.containerInner}>
            {statusRow}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarSectionWrapper,
                  { width: progressBarWarmupSectionWidthPercent },
                ]}
              >
                <View
                  style={[
                    styles.progressBarSectionInner,
                    {
                      width: `${
                        ((battle.warmupLengthSeconds - countdownSeconds) /
                          battle.warmupLengthSeconds) *
                        100
                      }%`,
                    },
                  ]}
                />
              </View>

              <View style={[styles.progressBarSectionWrapper, { flexGrow: 1 }]} />
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.titleRowName}>Warm-up</Text>
              <View style={styles.titleRowDetail}>
                <Text style={styles.titleRowDetailFirst}>
                  Verse starts {countdownComplete ? '' : 'in'}
                </Text>
                <Text style={styles.titleRowDetailLast}>
                  {countdownComplete ? 'soon' : formatSeconds(countdownSeconds)}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      );
    case 'BATTLE':
    case 'TRANSITION_TO_NEXT_BATTLER':
    case 'TRANSITION_TO_NEXT_ROUND':
    case 'TRANSITION_TO_SUMMARY':
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.containerInner}>
            {statusRow}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarSectionWrapper,
                  { width: progressBarWarmupSectionWidthPercent },
                ]}
              >
                <View style={[styles.progressBarSectionInner]} />
              </View>
              <View style={[styles.progressBarSectionWrapper, { flexGrow: 1 }]}>
                <View
                  style={[
                    styles.progressBarSectionInner,
                    {
                      width: `${
                        activeParticipantCurrentState === 'BATTLE'
                          ? ((battleLengthSeconds - countdownSeconds) / battleLengthSeconds) * 100
                          : 100
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.titleRowName}>Verse</Text>
              <View style={styles.titleRowDetail}>
                <Text style={styles.titleRowDetailFirst}>Start spittin'!</Text>
                <Text style={styles.titleRowDetailLast}>
                  {countdownComplete ? 'Done soon' : formatSeconds(countdownSeconds)}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      );
    case 'COMPLETE':
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.containerInner}>
            {statusRow}
            {emptyProgressBarRow}
            <View style={styles.titleRow}>
              <Text style={styles.titleRowName}>Battle Complete, Moving to Summary</Text>
            </View>
          </View>
        </SafeAreaView>
      );
    default:
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.containerInner}>
            {statusRow}
            {emptyProgressBarRow}
            <View style={styles.titleRow}>
              <Text style={styles.titleRowName}>
                UNKNOWN STATE: {activeParticipantCurrentState}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      );
  }
};

export default BattleHeader;
