import { useEffect, useState, useContext } from 'react';
import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { PusherContext } from '../pusher';

console.log('Loaded src/lib/use-net-info.detox.tsx! This should never happen in production.');

// This mock version of `useNetInfo` allows the detox test runner to programatically disable network
// connectivity.
export default () => {
  const [netInfo, setNetInfo] = useState<NetInfoState>({
    type: NetInfoStateType.other,
    isConnected: true,
    isInternetReachable: true,
    isWifiEnabled: true,
    details: {
      isConnectionExpensive: false,
      ssid: null,
      bssid: null,
      strength: 100,
      ipAddress: '',
      subnet: '',
    },
  });
  const pusher = useContext(PusherContext);

  // When messages are sent from the server, change the net info state dynamically
  useEffect(() => {
    if (!pusher) {
      return;
    }

    let unsubscribe: (() => void) | null = null;
    pusher
      .subscribe({
        channelName: 'change-net-info',
        onEvent: (data) => {
          setNetInfo((oldNetInfo) => ({ ...oldNetInfo, ...data }));
        },
      })
      .then((result) => {
        unsubscribe = result.unsubscribe;
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [pusher]);

  return netInfo;
};
