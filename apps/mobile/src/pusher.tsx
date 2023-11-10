import * as React from 'react';
import { useState, useEffect, useContext } from 'react';
import { Platform, NativeModules } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import {
  Pusher,
  PusherMember,
  PusherEvent,
  PusherChannel,
} from '@pusher/pusher-websocket-react-native';
import { useAuth } from '@clerk/clerk-expo';
import { v4 as uuidv4 } from 'uuid';

import delay from '@barz/mobile/src/lib/delay';
import { generatePusherKey } from '@barz/mobile/src/lib/environment';
import { BarzAPI } from '@barz/mobile/src/lib/api';
import { EnvironmentContext } from '@barz/mobile/src/environment-data';

type PusherChannelWithSubscriptionId = PusherChannel & { subscriptionId: string };

type EnhancedPusher = Pusher & {
  subscribe: (args: Parameters<Pusher['subscribe']>[0]) => Promise<PusherChannelWithSubscriptionId>;
  unsubscribe: (
    args: Parameters<Pusher['unsubscribe']>[0] & {
      subscriptionId: PusherChannelWithSubscriptionId['subscriptionId'];
    },
  ) => Promise<void>;
};

export const PusherContext = React.createContext<Pusher | null>(null);

export const PusherProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { getToken } = useAuth();
  const [pusher, setPusher] = useState<EnhancedPusher | null>(null);
  const [environment] = useContext(EnvironmentContext);

  useEffect(() => {
    type SubscriptionMap = Map<
      PusherChannelWithSubscriptionId['subscriptionId'],
      Parameters<Pusher['subscribe']>[0]
    >;
    const subscriptionsByChannelName = new Map<
      PusherChannel['channelName'],
      [PusherChannel | null, SubscriptionMap]
    >();

    // Track all `pusher.subscribe` calls that are currently in progress, so that if the app
    // attempts to subscribe to a topic that is already being subscribed to, it will just attach to
    // the subscription rather than subscribing a second time.
    const subscriptionSubscribesInProgress = new Map<
      PusherChannel['channelName'],
      Array<[(channel: PusherChannel) => void, (err: Error) => void]>
    >();

    const getSubscriptionsByChannelName = (channelName: PusherChannel['channelName']) => {
      const channelAndSubscriptions = subscriptionsByChannelName.get(channelName);
      if (!channelAndSubscriptions) {
        return [];
      }
      const [_channel, subscriptions] = channelAndSubscriptions;
      return Array.from(subscriptions).map(([_id, subscription]) => subscription);
    };

    const init = async () => {
      const pusher = Pusher.getInstance();

      if (pusher.connectionState !== 'DISCONNECTED') {
        await pusher.disconnect();
      }

      await pusher.init({
        apiKey: generatePusherKey(environment),
        cluster: 'us2',
        // authEndpoint: `${generateBarzAPIBaseUrl(environment)}/v1/pusher/user-auth`,

        // ref: https://github.com/pusher/pusher-websocket-react-native/issues/40#issuecomment-1322408009
        onAuthorizer: async (channelName, socketId) => {
          try {
            const result = await BarzAPI.pusherAuth(getToken, channelName, socketId);
            return result;
          } catch {
            return { auth: 'an error occcured' };
          }
        },
      });

      await pusher.connect();

      const overriddenUnsubscribe: EnhancedPusher['unsubscribe'] = async (unsubscribeArgs: {
        channelName: string;
        subscriptionId: string;
      }) => {
        const channelAndSubscriptions = subscriptionsByChannelName.get(unsubscribeArgs.channelName);
        if (!channelAndSubscriptions) {
          return;
        }

        const [channel, subscriptions] = channelAndSubscriptions;
        subscriptions.delete(unsubscribeArgs.subscriptionId);
        console.log('PUSHER: unattach from', unsubscribeArgs.channelName);

        if (subscriptions.size > 0) {
          subscriptionsByChannelName.set(unsubscribeArgs.channelName, [channel, subscriptions]);
          return;
        }

        // If all subscriptions have unsubscribed, then really unsubscribe from the channel
        console.log('PUSHER: unsubscribe from', unsubscribeArgs.channelName);
        hackedUnsubscribe(pusher, unsubscribeArgs.channelName);
        subscriptionsByChannelName.delete(unsubscribeArgs.channelName);
      };

      const overriddenSubscribe: EnhancedPusher['subscribe'] = async (subscribeArgs: {
        channelName: string;
        onSubscriptionSucceeded?: (data: any) => void;
        onSubscriptionError?: (channelName: string, message: string, e: any) => void;
        onMemberAdded?: (member: PusherMember) => void;
        onMemberRemoved?: (member: PusherMember) => void;
        onEvent?: (event: PusherEvent) => void;
      }) => {
        const channelAndSubscriptions = subscriptionsByChannelName.get(subscribeArgs.channelName);

        console.log('PUSHER: attach to', subscribeArgs.channelName);
        if (channelAndSubscriptions) {
          // This channel is already being subscribed to, so just add one more subscriber
          const [channel, subscriptions] = channelAndSubscriptions;
          if (!channel) {
            throw new Error(
              `Attempted to subscribe to ${subscribeArgs.channelName} a second time while the initial subscribe is being made`,
            );
          }
          const subscriptionId = uuidv4();
          subscriptions.set(subscriptionId, subscribeArgs);
          subscriptionsByChannelName.set(subscribeArgs.channelName, [channel, subscriptions]);
          return {
            ...channel,
            subscriptionId,
            unsubscribe: () =>
              overriddenUnsubscribe({
                channelName: subscribeArgs.channelName,
                subscriptionId,
              }),
            trigger: (...args) => pusher.trigger(...args),
          };
        } else {
          // This channel wasn't subscribed to previously, so subscribe to it fresh
          console.log('PUSHER: subscribe to', subscribeArgs.channelName);

          let channel: PusherChannel;

          // Is this channel in the process of being subscribed to?
          const subscriptionInProgressHandlers = subscriptionSubscribesInProgress.get(
            subscribeArgs.channelName,
          );
          if (subscriptionInProgressHandlers) {
            // If so, attach once the in progress subscription is complete.
            channel = await new Promise((resolve, reject) => {
              subscriptionInProgressHandlers.push([resolve, reject]);
            });
          } else {
            // Actually subscribe to the pusher channel using the underlying pusher sdk!
            subscriptionSubscribesInProgress.set(subscribeArgs.channelName, []);
            try {
              channel = await pusher.subscribe({
                channelName: subscribeArgs.channelName,
                onSubscriptionSucceeded: (...args) => {
                  for (const subscription of getSubscriptionsByChannelName(
                    subscribeArgs.channelName,
                  )) {
                    if (subscription.onSubscriptionSucceeded) {
                      subscription.onSubscriptionSucceeded(...args);
                    }
                  }
                },
                onSubscriptionError: (...args) => {
                  for (const subscription of getSubscriptionsByChannelName(
                    subscribeArgs.channelName,
                  )) {
                    if (subscription.onSubscriptionError) {
                      subscription.onSubscriptionError(...args);
                    }
                  }
                },
                onMemberAdded: (...args) => {
                  for (const subscription of getSubscriptionsByChannelName(
                    subscribeArgs.channelName,
                  )) {
                    if (subscription.onMemberAdded) {
                      subscription.onMemberAdded(...args);
                    }
                  }
                },
                onMemberRemoved: (...args) => {
                  for (const subscription of getSubscriptionsByChannelName(
                    subscribeArgs.channelName,
                  )) {
                    if (subscription.onMemberRemoved) {
                      subscription.onMemberRemoved(...args);
                    }
                  }
                },
                onEvent: (...args) => {
                  for (const subscription of getSubscriptionsByChannelName(
                    subscribeArgs.channelName,
                  )) {
                    if (subscription.onEvent) {
                      subscription.onEvent(...args);
                    }
                  }
                },
              });
            } catch (err) {
              (subscriptionSubscribesInProgress.get(subscribeArgs.channelName) || []).map(
                ([_resolve, reject]) => {
                  reject(err as Error);
                },
              );

              // Rethrow the error after it has been sent to other listeners
              throw err;
            }
            (subscriptionSubscribesInProgress.get(subscribeArgs.channelName) || []).map(
              ([resolve, _reject]) => {
                resolve(channel);
              },
            );
          }

          const subscriptions: SubscriptionMap = new Map();
          const subscriptionId = uuidv4();
          subscriptions.set(subscriptionId, subscribeArgs);
          subscriptionsByChannelName.set(subscribeArgs.channelName, [channel, subscriptions]);

          return {
            ...channel,
            subscriptionId,
            unsubscribe: () =>
              overriddenUnsubscribe({
                channelName: subscribeArgs.channelName,
                subscriptionId,
              }),
            trigger: (...args) => pusher.trigger(...args),
          };
        }
      };

      setPusher({
        ...pusher,
        subscribe: overriddenSubscribe,
        unsubscribe: overriddenUnsubscribe,
      } as EnhancedPusher);
    };
    init().catch((error) => {
      showMessage({
        message: 'Error initializing pusher:',
        description: `${error}`,
        type: 'warning',
      });
    });
  }, [environment, getToken, setPusher]);

  return <PusherContext.Provider value={pusher}>{children}</PusherContext.Provider>;
};

// FIXME: the pusher unsubscribe code often throws the below error:
// > TypeError: Cannot read property 'onEvent' of undefined
//
// This is because pusher's unsubscribe code seems to FIRST remove the event listener for the pusher
// events, and THEN actually call into native code behind the scenes to remove the native event
// listener. Because it happens in this order, it seems to be possible for an event to be received
// by the native code, have it be forwarded along to the javascript code, but then throw this error
// because the event listener has been removed! :(
export const hackedUnsubscribe = async (pusher: Pusher, channelName: string) => {
  switch (Platform.OS) {
    case 'ios':
    case 'android':
      console.log('HACKED UNSUBSCRIBE:', channelName);
      // FIRST - substitute in a no-op function for the `onEvent` property on the channel so that if the
      // native code calls the javascript code, it won't throw an error
      let channel = pusher.channels.get(channelName);
      if (!channel) {
        return;
      }
      const noopFunction = () => {};
      channel.onEvent = noopFunction;

      // SECOND - remove the native event listener
      await NativeModules.PusherWebsocketReactNative.unsubscribe(channelName);

      // THIRD - wait for any reconnects to occur
      await delay(2000);

      // FOURTH = if the channel is still subscribed to, and `onEvent` is the
      // no-op function that was previously assigned (ie, a new channel subscription
      // has not been created in those 2 seconds), then get rid of it.
      //
      // The assumption here is that 2 seconds after this function starts, any effects
      // that may re-subscribe to this channel after the unsubscribe will have completed
      // running.
      channel = pusher.channels.get(channelName);
      if (channel && channel.onEvent === noopFunction) {
        pusher.channels.delete(channelName);
      }
      break;

    default:
      console.log('REGULAR UNSUBSCRIBE:', channelName);
      pusher.unsubscribe({ channelName });
      break;
  }
};
