import * as React from 'react';
import { useContext } from 'react';
import { View, StyleSheet } from 'react-native';

import BarzMark from '@barz/mobile/src/components/BarzMark';
import { Color } from '@barz/mobile/src/ui/tokens';

import { PendingChallengesDataContext } from '@barz/mobile/src/pending-challenges-data';

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    width: 16,
    height: 16,
    backgroundColor: Color.Yellow.Dark10,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: Color.Gray.Dark2,
  },
});

const BattleBottomIcon: React.FunctionComponent<{ focused: boolean }> = ({ focused }) => {
  const [pendingChallenges] = useContext(PendingChallengesDataContext);
  return (
    <View style={styles.wrapper}>
      <BarzMark width={41} height={40} outlineYellow={focused} />
      {pendingChallenges.status === 'COMPLETE' && pendingChallenges.total > 0 ? (
        <View style={styles.badge} />
      ) : null}
    </View>
  );
};

export default BattleBottomIcon;
