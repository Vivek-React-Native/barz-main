import { View, StyleSheet } from 'react-native';

import { TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS } from '../constants';
import { useCountdownSeconds } from '../utils';
import FullScreenMessage from './FullScreenMessage';

// If internet is lost, this view is shown to let the user know that they need to get back online,
// and if not, the battle will be auto-forfeited after 10 seconds.
const OpponentNotConnectedToInternetMessage: React.FunctionComponent = () => {
  const [disconnectCountdownSeconds, countdownComplete] = useCountdownSeconds(
    TWILIO_VIDEO_BATTLE_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_MILLISECONDS / 1000,
  );

  return (
    <View
      style={{ ...StyleSheet.absoluteFillObject, zIndex: 9999 }}
      testID="opponent-lost-internet-overlay"
    >
      <FullScreenMessage>
        {`
        Your opponent has lost their network connection, waiting for them to rejoin...

        If they don't rejoin ${
          countdownComplete
            ? `in ${disconnectCountdownSeconds} ${
                disconnectCountdownSeconds === 1 ? 'second' : 'seconds'
              }`
            : 'soon'
        }, they'll automatically forfeit.
        `}
      </FullScreenMessage>
    </View>
  );
};

export default OpponentNotConnectedToInternetMessage;
