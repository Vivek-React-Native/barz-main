import * as React from 'react';
import { useState, useContext, useCallback, useEffect } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import * as Sentry from '@sentry/react-native';

import { PusherContext } from '@barz/mobile/src/pusher';
import { BarzAPI, UserMe, User } from '@barz/mobile/src/lib/api';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import delay from '@barz/mobile/src/lib/delay';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';

type UserDataContextValue =
  | { status: 'INITIAL' }
  | { status: 'IDLE' }
  | { status: 'INITIAL_LOADING' }
  | { status: 'LOADING' }
  | { status: 'NOT_SIGNED_IN' }
  | { status: 'COMPLETE'; data: UserMe }
  | { status: 'ERROR'; error: Error };

export const UserDataContext = React.createContext<
  [
    UserDataContextValue,
    (fn: (old: UserDataContextValue) => UserDataContextValue) => void,
    () => void,
  ]
>([{ status: 'INITIAL' }, () => {}, () => {}]);

const USER_ME_RELOAD_MAX_RETRY_COUNT = 5;
const USER_ME_RELOAD_DELAY_BETWEEN_RETRIES_MILLISECONDS = 3000;

export const UserDataProvider: React.FunctionComponent<{
  children: (userMeData: UserDataContextValue) => React.ReactNode;
}> = ({ children }) => {
  const [userMeData, setUserMeData] = useState<UserDataContextValue>({ status: 'INITIAL' });
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();

  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: userId.toString() });
    }
  }, [userId]);

  useEffect(() => {
    let unmounted = false;

    if (!isLoaded) {
      setUserMeData((old) => {
        if (old.status === 'INITIAL') {
          return { status: 'INITIAL' };
        } else {
          return { status: 'IDLE' };
        }
      });
      return;
    }

    if (!isSignedIn) {
      setUserMeData({ status: 'NOT_SIGNED_IN' });

      // // When logging out, clear any cached video files.
      // // Since it's likely that when a user signs back in, they'll be
      // // signing into a different user account / looking at different videos
      // listCachedVideos().then(async (files) => {
      //   for (const file of files) {
      //     if (unmounted) {
      //       break;
      //     }
      //     await FileSystem.deleteAsync(file.uri);
      //   }
      // }).catch(err => {
      //   console.log(`Error clearing cached videos: ${err}`);
      // });

      return;
    }

    setUserMeData((old) => {
      if (old.status === 'INITIAL') {
        return { status: 'INITIAL_LOADING' };
      } else {
        return { status: 'LOADING' };
      }
    });

    // Wait for the user me data to reload. This function call will make a request to the barz
    // server to get information for this user, and if it fails, will wait some time and then retry.
    //
    // NOTE: this may take a moment - when a user is initially created, clerk needs to reach out to
    // the the barz server via a webhook and tell it a new user was created.
    (async () => {
      let lastError: Error | null = null;

      for (let index = 0; index < USER_ME_RELOAD_MAX_RETRY_COUNT; index += 1) {
        try {
          const data = await BarzAPI.getUserMe(getToken);
          if (unmounted) {
            return;
          }
          setUserMeData({ status: 'COMPLETE', data });
          console.log(
            `Successfully fetched user me data! (attempt ${
              index + 1
            } / ${USER_ME_RELOAD_MAX_RETRY_COUNT})`,
          );
          return;
        } catch (err: FixMe) {
          lastError = err;
          console.log(
            `Error fetching user me data: ${err} (attempt ${
              index + 1
            } / ${USER_ME_RELOAD_MAX_RETRY_COUNT})`,
          );
        }
        await delay(USER_ME_RELOAD_DELAY_BETWEEN_RETRIES_MILLISECONDS);
      }

      if (lastError) {
        setUserMeData({ status: 'ERROR', error: lastError });
      }
    })().catch((error) => {
      setUserMeData({ status: 'ERROR', error });
    });

    return () => {
      unmounted = true;
      setUserMeData({ status: 'IDLE' });
    };
  }, [isLoaded, isSignedIn, reloadCounter, getToken]);

  const forceReloadUserMe = useCallback(() => setReloadCounter((n) => n + 1), [setReloadCounter]);

  // Once the user data is loaded, listen for updates to the user data via pusher
  // This always runs in the background while the app is connected
  const pusher = useContext(PusherContext);
  const userMeDataId = userMeData.status === 'COMPLETE' ? userMeData.data.id : null;
  useEffect(() => {
    if (!userMeDataId) {
      return;
    }
    if (!pusher) {
      return;
    }

    let userSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userMeDataId}`,
        onEvent: (event: PusherEvent) => {
          const payload: User = JSON.parse(event.data);
          switch (event.eventName) {
            case 'user.update':
              setUserMeData((old) => {
                if (old.status !== 'COMPLETE') {
                  return old;
                }
                return {
                  ...old,
                  data: { ...old.data, ...payload },
                };
              });
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        userSubscription = channel;
      });

    // NOTE: `private-user-ID-follows` is not being listened to here, because these events are used
    // to keep track of whether the current user is being followed or not, and a user is not allowed
    // to follow themselves. So these events should never be received anyway.

    return () => {
      if (userSubscription) {
        userSubscription.unsubscribe();
      }
    };
  }, [userMeDataId]);

  if (userMeData.status === 'INITIAL_LOADING') {
    return (
      <SafeAreaView
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Color.Gray.Dark1,
          height: '100%',
          width: '100%',
        }}
      >
        <Text style={{ ...Typography.Body1, color: Color.Gray.Dark8 }}>Loading user data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <UserDataContext.Provider value={[userMeData, setUserMeData, forceReloadUserMe]}>
      {children(userMeData)}
    </UserDataContext.Provider>
  );
};
