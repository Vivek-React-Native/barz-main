import * as React from 'react';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Pusher, PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import { PACKAGER_IP_ADDRESS } from './lib/environment';

console.log('Loaded pusher.detox.tsx! This should never happen in production.');

export const PusherContext = React.createContext<Pusher | null>(null);

export const PusherProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pusher, setPusher] = useState<Pusher | null>(null);

  useEffect(() => {
    const socket = io(`ws://${PACKAGER_IP_ADDRESS}:8001`);
    setPusher({
      async subscribe(payload: {
        channelName: string;
        onEvent: (event: PusherEvent) => void;
      }): Promise<PusherChannel> {
        socket.on(payload.channelName, payload.onEvent);

        return Promise.resolve({
          channelName: payload.channelName,
          members: new Map(),
          me: undefined,
          subscriptionCount: undefined,
          onSubscriptionSucceeded: undefined,
          onSubscriptionCount: undefined,
          onEvent: payload.onEvent,
          onMemberAdded: undefined,
          onMemberRemoved: undefined,
          unsubscribe: async () => {
            socket.off(payload.channelName, payload.onEvent);
          },
          trigger: async (_event: PusherEvent) => {
            throw new Error('Not implemented');
          },
        });
      },
      async unsubscribe(payload: { channelName: string }) {
        socket.off(payload.channelName);
      },
    } as Pusher);
  }, [setPusher]);

  return <PusherContext.Provider value={pusher}>{children}</PusherContext.Provider>;
};

export const hackedUnsubscribe = async (pusher: Pusher, channelName: string) => {
  await pusher.unsubscribe({ channelName });
};
