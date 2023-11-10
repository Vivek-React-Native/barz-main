import { View, StyleSheet } from 'react-native';
import { useEffect } from 'react';

import { TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS } from '../constants';
import { useCountdownSeconds } from '../utils';
import FullScreenMessage from './FullScreenMessage';

// If internet is lost, this view is shown to let the user know that they need to get back online,
// and if not, the battle will be auto-forfeited after 10 seconds.
const IsNotConnectedToInternetMessage: React.FunctionComponent<{
  onLeaveBattleDueToLossOfNetworkConnection: () => void;
}> = ({ onLeaveBattleDueToLossOfNetworkConnection }) => {
  const [disconnectCountdownSeconds, countdownComplete] = useCountdownSeconds(
    TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS / 1000,
  );

  // Once counting down is complete, then disconnect
  useEffect(() => {
    if (countdownComplete) {
      onLeaveBattleDueToLossOfNetworkConnection();
    }
  }, [countdownComplete, onLeaveBattleDueToLossOfNetworkConnection]);

  return (
    <View
      testID="not-connected-to-internet-overlay"
      style={{ ...StyleSheet.absoluteFillObject, zIndex: 99999 }}
    >
      <FullScreenMessage>
        {`
        You have lost your internet connection, trying to reconnect to server...

        If you don't rejoin in ${disconnectCountdownSeconds} seconds, you'll automatically forfeit the battle.
        `}
      </FullScreenMessage>
    </View>
  );
};

export default IsNotConnectedToInternetMessage;
