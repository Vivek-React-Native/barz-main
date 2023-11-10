import * as React from 'react';
import { useState, useContext, useCallback, useEffect } from 'react';
import { showMessage } from 'react-native-flash-message';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';

import { PusherContext } from '@barz/mobile/src/pusher';
import { BarzAPI, Challenge } from '@barz/mobile/src/lib/api';
import {
  InfiniteScrollListState,
  fetchInitialPage,
  fetchNextPage,
} from '@barz/mobile/src/lib/infinite-scroll-list';
import { UserDataContext } from '@barz/mobile/src/user-data';

type PendingChallengesDataContextValue = InfiniteScrollListState<
  Challenge & { cancelInProgress: boolean }
>;

export const PendingChallengesDataContext = React.createContext<
  [
    PendingChallengesDataContextValue,
    (fn: (old: PendingChallengesDataContextValue) => PendingChallengesDataContextValue) => void,
    () => Promise<void>,
  ]
>([{ status: 'IDLE' }, () => {}, () => Promise.resolve()]);

export const PendingChallengesDataProvider: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  const [userMe] = useContext(UserDataContext);

  const fetchPageOfData = useCallback(
    async (page: number) => {
      const pageOfData = await BarzAPI.getPendingChallenges(getToken, page);

      return {
        ...pageOfData,
        results: pageOfData.results.map((n) => ({ ...n, cancelInProgress: false })),
      };
    },
    [getToken],
  );

  const [pendingChallenges, setPendingChallenges] = useState<PendingChallengesDataContextValue>({
    status: 'IDLE',
  });
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    if (userMe.status !== 'COMPLETE') {
      return;
    }

    fetchInitialPage(setPendingChallenges, fetchPageOfData, (error) => {
      console.log(`Error fetching pending challenges page 1: ${error}`);
      showMessage({
        message: 'Error fetching pending challenges!',
        type: 'info',
      });
    });
  }, [isSignedIn, userMe.status, setPendingChallenges, fetchPageOfData]);
  const onFetchNextChallengesPage = useCallback(async () => {
    return fetchNextPage(
      pendingChallenges,
      setPendingChallenges,
      fetchPageOfData,
      (error, page) => {
        console.log(`Error fetching pending challenges page ${page}: ${error}`);
        showMessage({
          message: 'Error fetching pending challenges!',
          type: 'info',
        });
      },
    );
  }, [fetchPageOfData, pendingChallenges, setPendingChallenges]);

  // Once the user data is loaded, listen for updates to the user data via pusher
  // This always runs in the background while the app is connected
  const pusher = useContext(PusherContext);
  const userMeDataId = userMe.status === 'COMPLETE' ? userMe.data.id : null;
  useEffect(() => {
    if (!userMeDataId) {
      return;
    }
    if (!pusher) {
      return;
    }

    const upsertChallenge = (challenge: Challenge) => {
      setPendingChallenges((old) => {
        if (
          old.status === 'IDLE' ||
          old.status === 'LOADING_INITIAL_PAGE' ||
          old.status === 'LOADING_NEW_PAGE' ||
          old.status === 'ERROR'
        ) {
          return old;
        }

        let challengeUpdated = false;
        const newData = old.data.map((existingChallenge) => {
          if (existingChallenge.id === challenge.id) {
            challengeUpdated = true;
            return {
              ...existingChallenge,
              ...challenge,
            };
          } else {
            return existingChallenge;
          }
        });

        return {
          ...old,
          total: challengeUpdated ? old.total : old.total + 1,
          data: challengeUpdated
            ? newData
            : [...newData, { ...challenge, cancelInProgress: false }],
        };
      });
    };

    const deleteChallenge = (challengeId: Challenge['id']) => {
      setPendingChallenges((old) => {
        if (
          old.status === 'IDLE' ||
          old.status === 'LOADING_INITIAL_PAGE' ||
          old.status === 'LOADING_NEW_PAGE' ||
          old.status === 'ERROR'
        ) {
          return old;
        }

        const newData = old.data.filter(
          (existingChallenge) => existingChallenge.id !== challengeId,
        );

        return {
          ...old,
          total: old.total - (old.data.length - newData.length),
          data: newData,
        };
      });
    };

    let challengesSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-user-${userMeDataId}-challenges`,
        onEvent: (event: PusherEvent) => {
          console.log('EVENT:', event.eventName, event.data);
          switch (event.eventName) {
            case 'challenge.create':
            case 'challenge.update': {
              const payload: Challenge = JSON.parse(event.data);

              // This is a list of pending challenges. If the challenge isn't pending:
              // If creating, then do nothing.
              // If updating because the status changed, then remove the challenge.
              if (payload.status !== 'PENDING') {
                deleteChallenge(payload.id);
                break;
              }

              // Upsert new challenges rather than have a seperate create / update handler, because
              // if this client creates a new challenge, it will be stored into the pending challenges
              // state BEFORE the pusher message is received
              upsertChallenge(payload);
              break;
            }

            case 'challenge.delete': {
              const payload: { id: Challenge['id'] } = JSON.parse(event.data);
              deleteChallenge(payload.id);
              break;
            }
          }
        },
      })
      .then((channel: PusherChannel) => {
        challengesSubscription = channel;
      });

    return () => {
      if (challengesSubscription) {
        challengesSubscription.unsubscribe();
      }
    };
  }, [userMeDataId]);

  return (
    <PendingChallengesDataContext.Provider
      value={[pendingChallenges, setPendingChallenges, onFetchNextChallengesPage]}
    >
      {children}
    </PendingChallengesDataContext.Provider>
  );
};
