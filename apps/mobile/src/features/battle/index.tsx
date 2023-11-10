import * as React from 'react';
import { Fragment, useState, useMemo, useContext, useEffect } from 'react';
import { AppState, Alert, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { subMilliseconds } from 'date-fns';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';

import HeaderBackButton from '@barz/mobile/src/ui/HeaderBackButton';
import HeaderButton from '@barz/mobile/src/ui/HeaderButton';
import { PusherContext } from '@barz/mobile/src/pusher';
import { ExpoUpdatesDisallowContext } from '@barz/mobile/src/expo-updates-manager';
import useNetInfo from '@barz/mobile/src/lib/use-net-info';
import { useCalculateProfileBioFormState } from '@barz/mobile/src/features/profile';
import {
  BarzAPI,
  FavoriteArtist,
  FavoriteTrack,
  RoughLocation,
  Challenge,
  User,
  BattleParticipant,
} from '@barz/mobile/src/lib/api';
import { BattleStateMachineEvent } from '@barz/mobile/src/lib/state-machine';
import { Color } from '@barz/mobile/src/ui/tokens';
import { Close as IconClose, ArrowLeft as IconArrowLeft } from '@barz/mobile/src/ui/icons';
import { PendingChallengesDataContext } from '@barz/mobile/src/pending-challenges-data';

import IntroSlideshow from './IntroSlideshow';
import IntroCreateRapTag from './IntroCreateRapTag';
import IntroUploadAvatar from './IntroUploadAvatar';
import IntroCompleteBio from './IntroCompleteBio';
import IntroProfilePreview from './IntroProfilePreview';
import ChallengeSearchForUser from './ChallengeSearchForUser';
import Matching from './Matching';
import Battle from './Battle';
import MeProfileFavoriteTrackPicker from '../profile/MeProfileFavoriteTrackPicker';
import MeProfileFavoriteArtistPicker from '../profile/MeProfileFavoriteArtistPicker';
import MeProfileRoughLocationPicker from '../profile/MeProfileRoughLocationPicker';
import BattleContext, { BattleContextData, EMPTY_CONTEXT_DATA } from './context';
import IntroHeaderProgressBar from './components/IntroHeaderProgressBar';

type MatchingScreenParams =
  | {
      type: 'MATCH';
      matchingAlgorithm: 'RANDOM' | 'DEFAULT';
    }
  | {
      type: 'CHALLENGE';
      resumeExisting: true;
      challenge: Challenge;
    }
  | {
      type: 'CHALLENGE';
      resumeExisting: false;
      userToChallengeId: User['id'];
    };

// The below logic implements a typescript-friendly way to expose the prop type data to each screen
// within the feature
// ref: https://stackoverflow.com/a/75142476/4115328
export type BattleStackParamList = {
  'Battle > Initial': undefined;
  'Battle > Intro Slideshow': {
    matchingScreenParams: MatchingScreenParams;
  };

  'Battle > Create Rap Tag': {
    matchingScreenParams: MatchingScreenParams;
  };
  'Battle > Upload Avatar': {
    matchingScreenParams: MatchingScreenParams;
  };
  'Battle > Complete Bio': {
    matchingScreenParams: MatchingScreenParams;
  };
  'Battle > Profile Preview': {
    matchingScreenParams: MatchingScreenParams;
  };
  'Battle > Complete Bio > Favorite Track Picker': undefined;
  'Battle > Complete Bio > Favorite Artist Picker': undefined;
  'Battle > Complete Bio > Rough Location Picker': undefined;

  'Battle > Challenge Search For User': undefined;

  'Battle > Matching': MatchingScreenParams;
  'Battle > Battle': undefined;
};

export type PageProps<T extends keyof BattleStackParamList> = NativeStackScreenProps<
  BattleStackParamList,
  T
>;

const Stack = createNativeStackNavigator<BattleStackParamList>();

const BATTLE_CHECKIN_POLL_INTERVAL_MILLISECONDS = 2000;

const BattleFeature: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();
  const [battleContext, setBattleContext] = useState<BattleContextData>(EMPTY_CONTEXT_DATA);

  const [_pendingChallenges, setPendingChallenges] = useContext(PendingChallengesDataContext);

  // When a user is in the battle workflow, then avoid doing an OTA update with expo-updates
  // The user is in the middle of something and it would be better for them to wait a bit than
  // update immediately
  const disableExpoUpdates = useContext(ExpoUpdatesDisallowContext);
  useEffect(() => {
    if (!disableExpoUpdates) {
      return;
    }
    if (!battleContext.participant && !battleContext.challenge) {
      // The user isn't in a battle
      return;
    }

    const reEnableUpdates = disableExpoUpdates('battle');
    return () => {
      reEnableUpdates();
    };
  }, [disableExpoUpdates, battleContext]);

  const battleContextProviderData = useMemo(
    () => ({
      battleContextData: battleContext,
      setBattleContextData: (updater: (old: BattleContextData) => BattleContextData) => {
        setBattleContext((old) => updater(old));
      },
    }),
    [battleContext, setBattleContext],
  );

  // If there is a participant in the context data, check in to the server as that participant
  // periodically to ensure that the server knows that the app has not been force closed
  useEffect(() => {
    if (!battleContextProviderData.battleContextData.participant) {
      return;
    }
    if (!battleContextProviderData.battleContextData.isConnectedToInternet) {
      return;
    }

    const participantId = battleContextProviderData.battleContextData.participant.id;
    const intervalId = setInterval(() => {
      const now = new Date();

      // If a check in has happened within the last `BATTLE_CHECKIN_POLL_INTERVAL_MILLISECONDS` from an out of band
      // source, then don't worry about checking in
      const lastCheckedInAt = battleContextProviderData.battleContextData.lastCheckedInAt;
      if (
        lastCheckedInAt &&
        lastCheckedInAt > subMilliseconds(now, BATTLE_CHECKIN_POLL_INTERVAL_MILLISECONDS)
      ) {
        return;
      }

      const videoStreamOffsetMilliseconds = battleContextProviderData.battleContextData
        .twilioVideoConnectedAt
        ? now.getTime() -
          battleContextProviderData.battleContextData.twilioVideoConnectedAt.getTime()
        : null;

      BarzAPI.checkinParticipant(getToken, participantId, videoStreamOffsetMilliseconds)
        .then(() => {
          setBattleContext((old) => ({ ...old, lastCheckedInAt: now }));
        })
        .catch((err) => console.log(`Error checking in: ${err}`));
    }, BATTLE_CHECKIN_POLL_INTERVAL_MILLISECONDS);

    return () => clearInterval(intervalId);
  }, [
    battleContextProviderData.battleContextData.participant,
    battleContextProviderData.battleContextData.isConnectedToInternet,
    battleContextProviderData.battleContextData.lastCheckedInAt,
    battleContextProviderData.battleContextData.twilioVideoConnectedAt,
    getToken,
  ]);

  const pusher = useContext(PusherContext);

  // When a participant is created, start listening to all pushes related to that participant from
  // the server
  const participantId = battleContext.participant ? battleContext.participant.id : null;
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!participantId) {
      return;
    }

    let participantSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battleparticipant-${participantId}`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);
          setBattleContext((old) => ({
            ...old,
            battle: old.battle
              ? {
                  ...old.battle,
                  participants: old.battle.participants.map((p) => {
                    if (p.id === participantId) {
                      return { ...p, ...payload };
                    } else {
                      return p;
                    }
                  }),
                }
              : null,
            participant:
              old.participant && old.participant.id === participantId
                ? {
                    ...old.participant,
                    ...payload,
                  }
                : old.participant,
          }));
        },
      })
      .then((channel) => {
        participantSubscription = channel;
      });

    return () => {
      if (participantSubscription) {
        participantSubscription.unsubscribe();
      }
    };
  }, [pusher, participantId]);

  // When the client joins a battle, start listening for state updates from the battle and all
  // associated participants
  const battleId = battleContext.battle ? battleContext.battle.id : null;
  const battleParticipantIdsCommaSeperated = battleContext.battle
    ? battleContext.battle.participants
        .map((p) => p.id)
        .sort()
        .join(',')
    : null;
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!battleId || !battleParticipantIdsCommaSeperated) {
      return;
    }

    let battleSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battle-${battleId}`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);
          switch (event.eventName) {
            case 'battle.create':
            case 'battle.update':
              setBattleContext((old) => ({
                ...old,
                battle: { ...old.battle, ...payload },
              }));
              break;
          }
        },
      })
      .then((channel) => {
        battleSubscription = channel;
      });

    let battleParticipantSubscriptions: Array<PusherChannel> = [];
    for (const remoteParticipantId of battleParticipantIdsCommaSeperated.split(',')) {
      if (remoteParticipantId === participantId) {
        continue;
      }
      pusher
        .subscribe({
          channelName: `private-battleparticipant-${remoteParticipantId}`,
          onEvent: (event: PusherEvent) => {
            const payload: Partial<BattleParticipant> = JSON.parse(event.data);
            switch (event.eventName) {
              case 'battleParticipant.create':
              case 'battleParticipant.update':
                setBattleContext((old) => {
                  const opponentParticipant =
                    old.opponentParticipant?.id === remoteParticipantId
                      ? { ...old.opponentParticipant, ...payload }
                      : old.opponentParticipant;
                  return {
                    ...old,
                    opponentParticipant,
                    battle: old.battle
                      ? {
                          ...old.battle,
                          participants: old.battle.participants.map((p) => {
                            if (p.id === remoteParticipantId) {
                              return { ...p, ...payload };
                            } else {
                              return p;
                            }
                          }),
                        }
                      : null,
                  };
                });
            }
          },
        })
        .then((channel) => {
          battleParticipantSubscriptions.push(channel);
        });
    }

    return () => {
      if (battleSubscription) {
        battleSubscription.unsubscribe();
      }
      for (const participantSubscription of battleParticipantSubscriptions) {
        participantSubscription.unsubscribe();
      }
    };
  }, [pusher, participantId, battleId, battleParticipantIdsCommaSeperated]);

  // If the app gets backgrounded, let the server know
  useEffect(() => {
    if (!battleContextProviderData.battleContextData.participant) {
      return;
    }

    const participantId = battleContextProviderData.battleContextData.participant.id;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      BarzAPI.updateAppState(getToken, participantId, nextAppState).catch((err) =>
        console.error(`Error updating app state: ${err}`),
      );
    });

    return () => {
      subscription.remove();
    };
  }, [battleContextProviderData.battleContextData.participant, getToken]);

  // Subscribe to changes in internet connectivity. If the app goes offline, then store that. When
  // the app comes back online, refetch the latest data from server to catch up to what has happened
  // with the battle.
  const battleContextAcknowlegedMessageUuids =
    battleContext.currentContext?.acknowlegedMessageUuids;
  const netInfoState = useNetInfo();
  useEffect(() => {
    // NOTE: Sometimes `isInternetReachable` seems to be null, even when it seems like it
    // shouldn't be. So if it is null, instead use `isConnected`. I don't fully understand why
    // this is...
    let isOnline = netInfoState.isInternetReachable;
    if (isOnline === null) {
      isOnline = netInfoState.isConnected;
    }
    if (isOnline === null) {
      isOnline = false;
    }

    if (!battleContext.isConnectedToInternet && isOnline) {
      // Internet activity has been regained!
      setBattleContext((old) => ({ ...old, isConnectedToInternet: true }));

      // If associated with a participant, when reconnecting, get the latest battle information from the server
      if (battleContext.participant) {
        BarzAPI.getParticipantById(getToken, battleContext.participant.id)
          .then((participant) => {
            setBattleContext((old) => ({
              ...old,
              battle: old.battle
                ? {
                    ...old.battle,
                    participants: old.battle.participants.map((p) => {
                      if (p.id === participant.id) {
                        return { ...p, ...participant };
                      } else {
                        return p;
                      }
                    }),
                  }
                : null,
              participant:
                old.participant && old.participant.id === participant.id
                  ? {
                      ...old.participant,
                      ...participant,
                    }
                  : old.participant,
            }));
          })
          .catch((err) => {
            console.error(`Error fetching participant ${battleContext.participant?.id}: ${err}`);
          });

        // Check in immediately to make sure that the app does not go offline
        const now = new Date();
        const videoStreamOffsetMilliseconds = battleContext.twilioVideoConnectedAt
          ? now.getTime() - battleContext.twilioVideoConnectedAt.getTime()
          : null;
        BarzAPI.checkinParticipant(
          getToken,
          battleContext.participant.id,
          videoStreamOffsetMilliseconds,
        ).catch((err) => {
          console.error(`Error checking in participant ${battleContext.participant?.id}: ${err}`);
        });
      }

      // If associated with a battle, when reconnecting, get the latest battle information from the server
      if (battleContext.battle) {
        BarzAPI.getBattleById(getToken, battleContext.battle.id)
          .then((latestBattle) => {
            if (!battleContext.currentContext || !battleContext.service) {
              return;
            }

            setBattleContext((old) => ({ ...old, battle: latestBattle }));

            // Send all events to the state machine that it may have missed while it was offline
            if (battleContext.service) {
              for (const event of latestBattle.stateMachineEvents) {
                const payload = event.payload as BattleStateMachineEvent;
                if (battleContextAcknowlegedMessageUuids?.includes(payload.uuid)) {
                  console.log(
                    `WARNING: after reconnecting, skipping state machine event ${JSON.stringify(
                      payload,
                    )} because it has already been processed previously! (current state: ${
                      battleContext.currentState
                    })`,
                  );
                  continue;
                }
                battleContext.service.send(payload);
              }
            }
          })
          .catch((err) => {
            showMessage({
              message: `Error fetching battle with id: ${battleContext.battle?.id}:`,
              description: `${err}`,
              type: 'warning',
            });
          });
      }
    } else if (battleContext.isConnectedToInternet && !isOnline) {
      // Internet connectivity has been lost
      setBattleContext((old) => ({ ...old, isConnectedToInternet: false }));
    }
  }, [
    netInfoState,
    battleContextAcknowlegedMessageUuids,
    battleContext.battle,
    battleContext.service,
    battleContext.twilioVideoConnectedAt,
    getToken,
  ]);

  // ---------------------------------------------------------------------------
  // EDIT BIO HOOKS:
  // ---------------------------------------------------------------------------
  const {
    workingUserSavingBioDataToApi,
    setWorkingUserSavingBioDataToApi,

    workingUserMeIntro,
    setWorkingUserMeIntro,
    workingUserMeRoughLocation,
    setWorkingUserMeRoughLocation,
    workingUserMeFavoriteRapper,
    setWorkingUserMeFavoriteRapper,
    workingUserMeFavoriteSong,
    setWorkingUserMeFavoriteSong,
    workingUserMeInstagramHandle,
    setWorkingUserMeInstagramHandle,
    workingUserMeSoundcloudHandle,
    setWorkingUserMeSoundcloudHandle,

    favoriteSongSearchText,
    setFavoriteSongSearchText,
    pickFavoriteSongResolve,
    pickFavoriteSongReject,
    setPickFavoriteSongResolveReject,

    favoriteArtistSearchText,
    setFavoriteArtistSearchText,
    pickFavoriteArtistResolve,
    pickFavoriteArtistReject,
    setPickFavoriteArtistResolveReject,

    roughLocationSearchText,
    setRoughLocationSearchText,
    pickRoughLocationResolve,
    pickRoughLocationReject,
    setPickRoughLocationResolveReject,

    onSaveWorkingUserBioDataToApi,
  } = useCalculateProfileBioFormState();

  return (
    <BattleContext.Provider value={battleContextProviderData}>
      <Stack.Navigator>
        {/* The initial screen contains the rest of the application. */}
        <Stack.Screen name="Battle > Initial" options={{ headerShown: false }}>
          {() => <Fragment>{children}</Fragment>}
        </Stack.Screen>

        {/*
        All screens in the below group are in the "battle intro" - this is a mini workflow
        that runs before the main battle workflow that ensures that a user has configured all
        of their profile details before starting a battle.
        */}
        <Stack.Group
          screenOptions={({ navigation }) => {
            return {
              title: '',
              orientation: 'portrait',
              headerLeft: () => <HeaderBackButton appearance="chevron" />,
              headerRight: () => (
                <HeaderButton
                  // When cancel is pressed, exit out of the whole process
                  //
                  // NOTE: this is using navigation.navigate and NOT navigation.push so that
                  // it goes back to the first item in the navigation stack, NOT pushing a new item
                  // to the end
                  onPress={() => navigation.navigate('Battle > Initial')}
                  testID="battle-intro-cancel-button"
                  leadingSpace
                >
                  Cancel
                </HeaderButton>
              ),
            };
          }}
        >
          <Stack.Screen
            name="Battle > Intro Slideshow"
            component={IntroSlideshow}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Battle > Create Rap Tag"
            component={IntroCreateRapTag}
            options={({ navigation }) => ({
              headerTitle: () => <IntroHeaderProgressBar sections={3} sectionsFilled={1} />,
              headerLeft: () => (
                <HeaderBackButton
                  // NOTE: using `navigate` here will mean that if a user presses the back button
                  // while on the "create rap tag" screen, it won't go back to the slideshow page,
                  // it will go back to the page at the very top of the navigation stack
                  onPress={() => navigation.navigate('Battle > Initial')}
                  appearance="chevron"
                />
              ),
            })}
          />

          <Stack.Screen
            name="Battle > Upload Avatar"
            component={IntroUploadAvatar}
            options={{
              headerTitle: () => <IntroHeaderProgressBar sections={3} sectionsFilled={2} />,
            }}
          />

          <Stack.Screen
            name="Battle > Complete Bio"
            options={{
              title: 'Complete Your Bio',
              headerTitle: () => <IntroHeaderProgressBar sections={3} sectionsFilled={3} />,
            }}
          >
            {(props) => (
              <IntroCompleteBio
                {...props}
                workingUserSavingBioDataToApi={workingUserSavingBioDataToApi}
                workingUserMeIntro={workingUserMeIntro}
                onChangeWorkingUserMeIntro={setWorkingUserMeIntro}
                workingUserMeRoughLocation={workingUserMeRoughLocation}
                onChangeWorkingUserMeRoughLocation={setWorkingUserMeRoughLocation}
                workingUserMeFavoriteRapper={workingUserMeFavoriteRapper}
                onChangeWorkingUserMeFavoriteRapper={setWorkingUserMeFavoriteRapper}
                workingUserMeFavoriteSong={workingUserMeFavoriteSong}
                onChangeWorkingUserMeFavoriteSong={setWorkingUserMeFavoriteSong}
                workingUserMeInstagramHandle={workingUserMeInstagramHandle}
                onChangeWorkingUserMeInstagramHandle={setWorkingUserMeInstagramHandle}
                workingUserMeSoundcloudHandle={workingUserMeSoundcloudHandle}
                onChangeWorkingUserMeSoundcloudHandle={setWorkingUserMeSoundcloudHandle}
                onSaveWorkingUserBioDataToApi={onSaveWorkingUserBioDataToApi}
                onPickFavoriteSong={async () => {
                  setFavoriteSongSearchText('');

                  const promise = new Promise<FavoriteTrack | null>((resolve, reject) => {
                    // Set the callbacks into state that the favorite track picker can access
                    setPickFavoriteSongResolveReject([resolve, reject]);

                    // Navigate to the favorite track picker
                    props.navigation.push('Battle > Complete Bio > Favorite Track Picker');
                  });

                  // After a success or failure, clear the callbacks
                  promise
                    .then(() => {
                      setPickFavoriteSongResolveReject([null, null]);
                    })
                    .catch(() => {
                      setPickFavoriteSongResolveReject([null, null]);
                    });

                  return promise;
                }}
                onPickFavoriteArtist={async () => {
                  setFavoriteArtistSearchText('');

                  const promise = new Promise<FavoriteArtist | null>((resolve, reject) => {
                    // Set the callbacks into state that the favorite track picker can access
                    setPickFavoriteArtistResolveReject([resolve, reject]);

                    // Navigate to the favorite track picker
                    props.navigation.push('Battle > Complete Bio > Favorite Artist Picker');
                  });

                  // After a success or failure, clear the callbacks
                  promise
                    .then(() => {
                      setPickFavoriteArtistResolveReject([null, null]);
                    })
                    .catch(() => {
                      setPickFavoriteArtistResolveReject([null, null]);
                    });

                  return promise;
                }}
                onPickRoughLocation={async () => {
                  setRoughLocationSearchText('');

                  const promise = new Promise<RoughLocation | null>((resolve, reject) => {
                    // Set the callbacks into state that the favorite track picker can access
                    setPickRoughLocationResolveReject([resolve, reject]);

                    // Navigate to the favorite track picker
                    props.navigation.push('Battle > Complete Bio > Rough Location Picker');
                  });

                  // After a success or failure, clear the callbacks
                  promise
                    .then(() => {
                      setPickRoughLocationResolveReject([null, null]);
                    })
                    .catch(() => {
                      setPickRoughLocationResolveReject([null, null]);
                    });

                  return promise;
                }}
              />
            )}
          </Stack.Screen>

          {/* The "Favorite Track Picker" screen allows a user to select a new favorite track on their bio */}
          <Stack.Screen
            name="Battle > Complete Bio > Favorite Track Picker"
            options={({ navigation }) => ({
              title: 'Favorite Song',
              orientation: 'portrait',
              headerRight: () => (
                <HeaderButton
                  onPress={() => {
                    setWorkingUserMeFavoriteSong(
                      favoriteSongSearchText.length > 0
                        ? {
                            name: favoriteSongSearchText,
                            artistName: null,
                            id: null,
                          }
                        : null,
                    );
                    navigation.goBack();
                  }}
                  testID={
                    favoriteSongSearchText.length > 0
                      ? 'battle-intro-complete-bio-favorite-track-picker-done'
                      : 'battle-intro-complete-bio-favorite-track-picker-clear'
                  }
                  leadingSpace
                >
                  {favoriteSongSearchText.length > 0 ? 'Done' : 'Clear'}
                </HeaderButton>
              ),
            })}
          >
            {(props) => (
              <MeProfileFavoriteTrackPicker
                {...props}
                onResolve={pickFavoriteSongResolve}
                onReject={pickFavoriteSongReject}
                searchText={favoriteSongSearchText}
                onChangeSearchText={setFavoriteSongSearchText}
              />
            )}
          </Stack.Screen>

          {/* The "Favorite Artist Picker" screen allows a user to select a new favorite artist on their bio */}
          <Stack.Screen
            name="Battle > Complete Bio > Favorite Artist Picker"
            options={({ navigation }) => ({
              title: 'Favorite Rapper',
              orientation: 'portrait',
              headerRight: () => (
                <HeaderButton
                  onPress={() => {
                    setWorkingUserMeFavoriteRapper(
                      favoriteArtistSearchText.length > 0
                        ? {
                            name: favoriteArtistSearchText,
                            id: null,
                          }
                        : null,
                    );
                    navigation.goBack();
                  }}
                  testID={
                    favoriteArtistSearchText.length > 0
                      ? 'battle-intro-complete-bio-favorite-artist-picker-done'
                      : 'battle-intro-complete-bio-favorite-artist-picker-clear'
                  }
                  leadingSpace
                >
                  {favoriteArtistSearchText.length > 0 ? 'Done' : 'Clear'}
                </HeaderButton>
              ),
            })}
          >
            {(props) => (
              <MeProfileFavoriteArtistPicker
                {...props}
                onResolve={pickFavoriteArtistResolve}
                onReject={pickFavoriteArtistReject}
                searchText={favoriteArtistSearchText}
                onChangeSearchText={setFavoriteArtistSearchText}
              />
            )}
          </Stack.Screen>

          {/* The "Rough Location Picker" screen allows a user to select a new rough location on their bio */}
          <Stack.Screen
            name="Battle > Complete Bio > Rough Location Picker"
            options={({ navigation }) => ({
              title: 'Location',
              orientation: 'portrait',
              headerLeft: () => (
                <HeaderButton
                  leading={(color) => <IconArrowLeft color={color} />}
                  onPress={navigation.goBack}
                  trailingSpace
                />
              ),
              headerRight: () => (
                <HeaderButton
                  onPress={() => {
                    setWorkingUserMeRoughLocation(
                      roughLocationSearchText.length > 0
                        ? {
                            name: roughLocationSearchText,
                            latitude: null,
                            longitude: null,
                          }
                        : null,
                    );
                    navigation.goBack();
                  }}
                  testID={
                    roughLocationSearchText.length > 0
                      ? 'battle-intro-complete-bio-rough-location-picker-done'
                      : 'battle-intro-complete-bio-rough-location-picker-clear'
                  }
                  leadingSpace
                >
                  {roughLocationSearchText.length > 0 ? 'Done' : 'Clear'}
                </HeaderButton>
              ),
            })}
          >
            {(props) => (
              <MeProfileRoughLocationPicker
                {...props}
                onResolve={pickRoughLocationResolve}
                onReject={pickRoughLocationReject}
                searchText={roughLocationSearchText}
                onChangeSearchText={setRoughLocationSearchText}
              />
            )}
          </Stack.Screen>

          <Stack.Screen
            name="Battle > Profile Preview"
            options={{ headerShown: false }}
            component={IntroProfilePreview}
          />
        </Stack.Group>

        {/*
        Challenge Search For User - This is the screen that lets the user search for another user
        to challenge.
        */}
        <Stack.Screen
          name="Battle > Challenge Search For User"
          component={ChallengeSearchForUser}
          options={{
            title: 'Challenge',
            headerLeft: () => <HeaderBackButton testID="battle-challenge-search-for-user-back" />,
          }}
        />

        {/* All screens in the below group are in the "battle workflow" */}
        <Stack.Group
          screenOptions={({ navigation }) => {
            let isBattleActive = false;
            if (battleContext.challenge) {
              // If in a challenge, then a battle becomes active once it starts
              isBattleActive =
                battleContext.battle !== null && battleContext.battle.startedAt !== null;
            } else {
              // If in a regular battle, a battle becomes active once the battle shows up in the
              // battle context
              isBattleActive = battleContext.battle !== null && battleContext.participant !== null;
            }

            const goBack = () => {
              setBattleContext(EMPTY_CONTEXT_DATA);
              navigation.navigate('Battle > Initial');
            };

            const cancelChallengeAndGoBack = () => {
              if (!battleContext.challenge) {
                goBack();
                return;
              }

              setBattleContext((old) => ({
                ...old,
                cancellingChallengeInProgress: true,
              }));

              const challengeId = battleContext.challenge.id;

              BarzAPI.cancelChallenge(getToken, challengeId)
                .then(() => {
                  // Do an optimistic update to remove the challenge from the challenges list, now that is no
                  // longer pending
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

                  goBack();
                })
                .catch((err) => {
                  setBattleContext((old) => ({
                    ...old,
                    cancellingChallengeInProgress: false,
                  }));

                  console.log(`Error cancelling challenge: ${err}`);
                  showMessage({
                    message: 'Error cancelling challenge',
                    type: 'info',
                  });
                });
            };

            const leaveBattleAndGoBack = () => {
              if (!battleContext.participant) {
                goBack();
                return;
              }

              setBattleContext((old) => ({
                ...old,
                leavingBattleInProgress: true,
              }));

              // If there is a battle active, then make sure the battle serverside is
              // invalidated prior to going back. This is important so that all
              // clients can be forced out of the battle.
              BarzAPI.leaveBattle(getToken, battleContext.participant.id)
                .then(() => {
                  goBack();
                })
                .catch((err) => {
                  setBattleContext((old) => ({
                    ...old,
                    leavingBattleInProgress: false,
                  }));

                  showMessage({
                    message: 'Error leaving battle:',
                    description: `${err}`,
                    type: 'info',
                  });
                });
            };

            return {
              title: 'Battle',
              // Within the battle workflow, there is a global "leave" button in the
              // upper left instead of a "back" button. Pressing it anywhere will let
              // the user get back to the "Initial" screen.
              headerLeft: () => {
                // When the battle has completed, hide the "back" button
                if (battleContext.battleCompleted) {
                  return <View></View>;
                }
                // If the battle is active, then make sure users have to explicitly "leave" so they
                // will forfeit the battle
                if (isBattleActive) {
                  return (
                    <HeaderButton
                      accentColor={Color.Brand.Red}
                      leading={(color) => <IconClose color={color} />}
                      trailingSpace
                      onPress={() => {
                        Alert.alert('Are you sure?', 'Leaving the battle will forfeit.', [
                          {
                            text: 'Leave',
                            onPress: () => leaveBattleAndGoBack(),
                          },
                          {
                            text: 'Cancel',
                            style: 'cancel',
                          },
                        ]);
                      }}
                      // Ensure that one cannot leave a battle if leaving is already in progress
                      disabled={battleContextProviderData.battleContextData.leavingBattleInProgress}
                      testID="battle-top-bar-leave-button"
                    >
                      Forfeit
                    </HeaderButton>
                  );
                }
                return (
                  <HeaderBackButton
                    onPress={() => leaveBattleAndGoBack()}
                    disabled={battleContextProviderData.battleContextData.leavingBattleInProgress}
                    testID="battle-top-bar-back-button"
                  />
                );
              },
              headerRight: () => {
                // When in a challenge waiting room, show "cancel" so that the user can get rid of
                // the challenge
                if (battleContext.challenge && battleContext.challenge.status === 'PENDING') {
                  return (
                    <HeaderButton
                      accentColor={Color.Red.Dark10}
                      onPress={cancelChallengeAndGoBack}
                      disabled={
                        battleContextProviderData.battleContextData.cancellingChallengeInProgress
                      }
                      testID="battle-challenge-cancel-button"
                      leadingSpace
                    >
                      Cancel
                    </HeaderButton>
                  );
                }
                return null;
              },
              orientation: 'portrait',
            };
          }}
        >
          {/*
          Matching - This is the screen that lets the user connect with another
          participant to do a battle. This screen also shows opponent information,
          gives the user a "Ready" button they can press once they are ready to do
          a battle.
          */}
          <Stack.Screen
            name="Battle > Matching"
            component={Matching}
            options={({ route }) => {
              if (battleContext.battle) {
                return { title: 'Opponent' };
              }

              const params = route.params as MatchingScreenParams;
              switch (params.type) {
                case 'CHALLENGE':
                  return { title: 'Challenge' };
                case 'MATCH':
                  return { title: 'Battle' };
              }
            }}
          />

          {/*
          Battle - The main battle screen. This shows the video streams and manages playing
          back audio mixed with the rap lyrics.

          Because the summary view keeps the video call audio going at the end, that is switched to
          dynamically at the end of this step rather than being its own page.
          */}
          <Stack.Screen
            name="Battle > Battle"
            component={Battle}
            options={{ headerShown: battleContext.battleCompleted, title: 'Summary' }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </BattleContext.Provider>
  );
};

export default BattleFeature;
