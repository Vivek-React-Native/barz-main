import * as React from 'react';
import { Fragment, useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  useWindowDimensions,
  Image,
  ViewToken,
  Platform,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Video from 'react-native-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';
import { v4 as uuidv4 } from 'uuid';

import { PusherContext } from '@barz/mobile/src/pusher';
import {
  BattleWithParticipants,
  BattleRecording,
  BattleParticipant,
  BarzAPI,
} from '@barz/mobile/src/lib/api';
import {
  VideoCommentsButton,
  VideoMoreButton,
  VideoBackButton,
  VideoVoteButton,
  VideoPlaybackSeekBar,
  VideoParticipantHeader,
  VideoVoteCountdown,
  VideoCommentBottomSheet,
  VideoMoreBottomSheet,
  VideoPrivateIndicator,
} from './BattleListPlayerControls';
import { UserDataContext } from '@barz/mobile/src/user-data';
import BattleAndParticipantMap from '@barz/mobile/src/lib/battle-and-participant-map';
import {
  VideoCachingDependsOnParticipantVideos,
  VideoCachingPrefetchBattleRecordingVideos,
} from '@barz/mobile/src/video-cache';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';

// import { FixMe } from "@barz/mobile/src/lib/fixme";
import Button from '@barz/mobile/src/ui/Button';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { BattleViewerDebugCache } from '@barz/mobile/src/lib/cache';
import BarzLoading from './BarzLoading';

const MAX_NUMBER_OF_CONCURRENT_BATTLES_TO_RENDER = 3;

// How many battles after the visible battle should have their videos start to be loaded and cached
// to the filesystem?
const NUMBER_OF_BATTLES_AFTER_VISIBLE_TO_START_LOADING = 10;

// How many battles backwards in the list from the visible battle should have their video data
// remain on the filesystem?
const NUMBER_OF_BATTLES_BEFORE_VISIBLE_TO_CACHE_ON_FILESYSTEM = 10;

// How many battles need to be loaded beyond the initial battle for the full page "loading" state to
// go away? Setting this parameter to "0" disables this behavior.
const NUMBER_OF_BATTLES_TO_FINISH_LOADING_BEFORE_FULL_PAGE_LOADING_GOES_AWAY = 3;

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 100,
    zIndex: 99,
  },

  voteButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    // bottom
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 10000,
    marginBottom: 24,
    height: 72,
  },

  videoContainer: {
    position: 'relative',
    height: '50%',
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoContainerActive: {
    borderWidth: 1,
    borderColor: Color.Brand.Yellow,
  },
  videoViewportContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,

    width: '100%',
    height: '100%',
    flexShrink: 1,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoViewportContainerText: {
    ...Typography.Body1,
    color: 'white',
  },

  secondVideoGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: Color.Brand.Red,
    position: 'relative',
    zIndex: 9999,
  },

  videoParticipantHeaderWrapper: {
    position: 'absolute',
    // top: '0%',
    right: 0,
    zIndex: 9999,
  },

  videoInteractionsGroup: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    right: 16,
    bottom: 96,
    zIndex: 9999,
  },
});

const BattleListPlayerVideoCacheManager: React.FunctionComponent<{
  name: string;
  battleRecordings: Array<BattleRecording>;
  visibleBattleIndex: number;

  onBattleVideoAvailable: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    videoPath: string,
  ) => void;
  onErrorLoadingBattleVideo: (battleId: BattleWithParticipants['id']) => void;
}> = ({
  name,
  battleRecordings,
  visibleBattleIndex,
  onBattleVideoAvailable,
  onErrorLoadingBattleVideo,
}) => {
  const battleRecordingsAtIncludingVisibleBattle = useMemo(
    () => battleRecordings.slice(visibleBattleIndex),
    [battleRecordings, visibleBattleIndex],
  );

  // Determine which videos a lock should be aquired on so that the video cache
  // will not delete them
  const videosToAquireLocksOn = useMemo(() => {
    const pairs: Array<[BattleWithParticipants['id'], BattleParticipant['id']]> = [];

    for (
      let battleRecordingIndex = 0;
      battleRecordingIndex < battleRecordings.length;
      battleRecordingIndex += 1
    ) {
      const battleRecording = battleRecordings[battleRecordingIndex];
      for (const participant of battleRecording.participants) {
        // If there aren't enough battles loaded to start evicting them, then keep them all around
        if (visibleBattleIndex < NUMBER_OF_BATTLES_BEFORE_VISIBLE_TO_CACHE_ON_FILESYSTEM) {
          pairs.push([battleRecording.battleId, participant.id]);
          continue;
        }

        // 1. If the given battle is after the NUMBER_OF_BATTLES_BEFORE_VISIBLE_TO_CACHE_ON_FILESYSTEM
        //    cutoff in the list, then it's definitely good to keep around
        if (
          battleRecordingIndex >
          visibleBattleIndex - NUMBER_OF_BATTLES_BEFORE_VISIBLE_TO_CACHE_ON_FILESYSTEM
        ) {
          pairs.push([battleRecording.battleId, participant.id]);
          continue;
        }

        // 2. Make sure to keep around any battles that occur AGAIN later on in the list AFTER the
        //    current battle, these should not be evicted because they are coming up again soon
        const battleIdsAfterAndIncludingCurrentBattle = battleRecordings
          .slice(visibleBattleIndex)
          .map((r) => r.battleId);
        if (battleIdsAfterAndIncludingCurrentBattle.includes(battleRecording.battleId)) {
          pairs.push([battleRecording.battleId, participant.id]);
          continue;
        }
      }
    }

    return pairs;
  }, [battleRecordings, visibleBattleIndex]);

  return (
    <Fragment>
      {/* Ensure that the given battle participant videos are locked so they cannot be */}
      {/* removed by the video garbage colelctor while this component is active */}
      <VideoCachingDependsOnParticipantVideos name={name} videos={videosToAquireLocksOn} />

      {/* Fetch battles from the server so that the video files are available for playback */}
      <VideoCachingPrefetchBattleRecordingVideos
        // Only fetch battle recordings AT or AFTER the currently visible battle
        battleRecordings={battleRecordingsAtIncludingVisibleBattle}
        onBattleVideoAvailable={onBattleVideoAvailable}
        onErrorLoadingBattleVideo={onErrorLoadingBattleVideo}
      />
    </Fragment>
  );
};

const BattleListPlayer: React.FunctionComponent<{
  name?: string;
  width?: number;
  additionalGlobalOverlay?: React.ReactNode;
  isVisible?: boolean;
  testID?: string;
  battleRecordings: Array<BattleRecording>;
  loadingNextPageOfBattles?: boolean;
  onFetchNextPageOfBattles?: () => void;
  onChangeVisibleBattleIndex?: (
    index: number,
    timeSpentWatchingBattleInMilliseconds: number | null,
  ) => void;
  onVisitUserProfile: (userId: BattleParticipant['user']['id']) => void;
  onErrorLoadingBattleVideo: (battleId: BattleWithParticipants['id']) => void;
  onRefetchInitialPageOfBattles?: () => void;
  onUpdateParticipantUser?: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    userData: BattleParticipant['user'],
  ) => void;
  onChangeComputedTotalVoteAmountForParticipants?: (
    battleId: BattleWithParticipants['id'],
    newComputedTotalVoteAmounts: Map<BattleParticipant['id'], number>,
  ) => void;
  onChangeCommentTotal?: (
    battleId: BattleWithParticipants['id'],
    newCommentTotal: BattleRecording['battleCommentTotal'],
  ) => void;
  onNavigateBackwards?: () => void;
}> = ({
  name = 'home',
  width,
  additionalGlobalOverlay = null,
  isVisible = true,
  testID = '',
  battleRecordings,
  loadingNextPageOfBattles = false,
  onFetchNextPageOfBattles,
  onChangeVisibleBattleIndex,
  onVisitUserProfile,
  onErrorLoadingBattleVideo,
  onRefetchInitialPageOfBattles,
  onUpdateParticipantUser,
  onChangeComputedTotalVoteAmountForParticipants,
  onChangeCommentTotal,
  onNavigateBackwards,
}) => {
  const { getToken } = useAuth();

  const [userMe] = useContext(UserDataContext);

  const windowDimensions = useWindowDimensions();
  width = typeof width === 'undefined' ? windowDimensions.width : width;

  const [debugMenuVisible, setDebugMenuVisible] = useState(false);
  useEffect(() => {
    BattleViewerDebugCache.getDebugMenuVisible().then((enabled) => {
      setDebugMenuVisible(enabled);
    });
  }, [setDebugMenuVisible]);

  const [commentsBottomSheetOpen, setCommentsBottomSheetOpen] = useState(false);
  const [moreBottomSheetOpen, setMoreBottomSheetOpen] = useState(false);

  const [visibleBattleIndex, setVisibleBattleIndex] = useState(0);

  const [userIsScrolling, setUserIsScrolling] = useState(false);

  // Once the user gets to the end of the battle list, start loading more battles
  const numberOfBattles = battleRecordings.length;
  useEffect(() => {
    if (numberOfBattles === 0) {
      return;
    }
    if (numberOfBattles - visibleBattleIndex > NUMBER_OF_BATTLES_AFTER_VISIBLE_TO_START_LOADING) {
      return;
    }

    // Don't fetch more battles when battles are already being fetched
    if (loadingNextPageOfBattles) {
      return;
    }

    if (!onFetchNextPageOfBattles) {
      return;
    }
    onFetchNextPageOfBattles();
  }, [visibleBattleIndex, numberOfBattles, loadingNextPageOfBattles, onFetchNextPageOfBattles]);

  // When the visible battle index changes, update a ref with that new visible battle index value
  //
  // FIXME: this is in a ref on purpose, a usecallback doesn't work... for more info:
  // https://stackoverflow.com/questions/65256340/keep-getting-changing-onviewableitemschanged-on-the-fly-is-not-supported
  const visibleBattleIndexRef = useRef(0);
  const onViewableItemsChangedRef = useRef((data: { viewableItems: Array<ViewToken> }) => {
    if (data.viewableItems.length < 1) {
      return;
    }
    const index = data.viewableItems[0].index;
    if (index !== null) {
      console.log('CHANGE BATTLE INDEX:', index);
      visibleBattleIndexRef.current = index;

      resetUserScrollingTimeout();
    }
  });

  // Debounce the user scroll interaction and once the user has settled on the final battle they'd
  // like to play, THEN read the visible battle index from the ref and officially set the `visibleBattleIndex`
  const userIsScrollingTimeoutRef = useRef<NodeJS.Timer | null>(null);
  const resetUserScrollingTimeout = () => {
    if (userIsScrollingTimeoutRef.current) {
      clearTimeout(userIsScrollingTimeoutRef.current);
      userIsScrollingTimeoutRef.current = null;
    }

    userIsScrollingTimeoutRef.current = setTimeout(() => {
      console.log('RESET PLAYBACK TIME');
      const battleId = battleRecordings[visibleBattleIndexRef.current]?.battleId;
      if (battleId) {
        updateBattleToCurrentPlaybackTimeMilliseconds(battleId, 0);
      }

      console.log('COMMIT CHANGE BATTLE INDEX:', visibleBattleIndexRef.current);
      setVisibleBattleIndex(visibleBattleIndexRef.current);
    }, 250);
  };

  const lastVisibleBattleIndexRef = useRef(0);
  useEffect(() => {
    const now = new Date();

    // Call `onChangeVisibleBattleIndex` when the visible battle changes
    if (onChangeVisibleBattleIndex && lastVisibleBattleIndexRef.current !== visibleBattleIndex) {
      lastVisibleBattleIndexRef.current = visibleBattleIndex;

      // Figure out how long the battle was viewed for once the battle changes
      const timeSpentWatchingBattleInMilliseconds = initiallyStartedPlayingAtRef.current
        ? now.getTime() - initiallyStartedPlayingAtRef.current.getTime()
        : null;
      onChangeVisibleBattleIndex(visibleBattleIndex, timeSpentWatchingBattleInMilliseconds);
      initiallyStartedPlayingAtRef.current = null;
    }
  }, [visibleBattleIndex, onChangeVisibleBattleIndex]);

  const [
    downloadedVideoFilesByBattleAndParticipant,
    setDownloadedVideoFilesByBattleAndParticipant,
  ] = useState<BattleAndParticipantMap<string>>(BattleAndParticipantMap.create());

  // Download battle videos to the cache directory
  const onBattleVideoAvailable = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      videoPath: string,
    ) => {
      setDownloadedVideoFilesByBattleAndParticipant((mapping) => {
        if (BattleAndParticipantMap.get(mapping, battleId, participantId) === videoPath) {
          return mapping;
        }

        return BattleAndParticipantMap.set(mapping, battleId, participantId, videoPath);
      });
    },
    [setDownloadedVideoFilesByBattleAndParticipant],
  );

  // Store the playback position of each battle in a map, keying by battle id
  const battleToCurrentPlaybackTimeMillisecondsRef = useRef(
    new Map<BattleWithParticipants['id'], number>(),
  );

  const videoRefs = useRef<BattleAndParticipantMap<Video>>(new Map());

  // Keep track of videos as they finish loading so that the system can determine when they all are
  // complete
  const [
    battleToTwilioParticipantIdsWithLoadedVideo,
    setBattleToTwilioParticipantIdsWithLoadedVideo,
  ] = useState(new Map<BattleWithParticipants['id'], Set<string>>());

  // /////////////////
  // FOR THE VISIBLE BATTLE:
  // /////////////////

  // Pick out the battle which is currently being watched by the user
  // If no battle is being watched, then this value is `null`.
  const visibleBattleRecording = useMemo(() => {
    const battleRecording = battleRecordings[visibleBattleIndex];
    if (!battleRecording) {
      return null;
    }
    return battleRecording;
  }, [battleRecordings, visibleBattleIndex]);

  const areAllVideosLoadedForVisibleBattle = useMemo(() => {
    if (!visibleBattleRecording) {
      return null;
    }
    const twilioParticipantIdsWithLoadedVideo = battleToTwilioParticipantIdsWithLoadedVideo.get(
      visibleBattleRecording.battleId,
    );
    if (!twilioParticipantIdsWithLoadedVideo) {
      return null;
    }
    return twilioParticipantIdsWithLoadedVideo.size === visibleBattleRecording.participants.length;
  }, [visibleBattleRecording, battleToTwilioParticipantIdsWithLoadedVideo]);

  const [visibleBattleActiveParticipantId, setVisibleBattleActiveParticipantId] = useState<
    BattleParticipant['id'] | null
  >(null);

  const updateBattleToCurrentPlaybackTimeMilliseconds = useCallback(
    (battleId: BattleWithParticipants['id'], currentTimeMilliseconds: number) => {
      battleToCurrentPlaybackTimeMillisecondsRef.current.set(battleId, currentTimeMilliseconds);

      // As a side effect to updating the battle playback offset, compute the active participant id
      // and if it has changed, update that too
      if (!visibleBattleRecording) {
        setVisibleBattleActiveParticipantId(null);
        return;
      }
      if (visibleBattleRecording.phases.length === 0) {
        setVisibleBattleActiveParticipantId(null);
        return;
      }
      const seekOffsetInMilliseconds = battleToCurrentPlaybackTimeMillisecondsRef.current.get(
        visibleBattleRecording.battleId,
      );
      if (typeof seekOffsetInMilliseconds === 'undefined') {
        setVisibleBattleActiveParticipantId(null);
        return;
      }

      // Adjust the seek timestamp of the video artifact being played by `mediaOffsetMilliseconds` to
      // convert to the twilio video stream offset, which can be compared against values
      // like `startsAtVideoStreamOffsetMilliseconds`.
      const maxMediaOffsetMilliseconds = Math.max(
        ...visibleBattleRecording.participants.map((p) => p.mediaOffsetMilliseconds),
      );
      const adjustedSeekOffsetInMilliseconds =
        seekOffsetInMilliseconds + maxMediaOffsetMilliseconds;

      const firstPhaseStartsAt = new Date(visibleBattleRecording.phases[0].startsAt).getTime();

      for (const phase of visibleBattleRecording.phases) {
        const phaseStartsAtOffsetMilliseconds =
          phase.startsAtVideoStreamOffsetMilliseconds ??
          new Date(phase.startsAt).getTime() - firstPhaseStartsAt;
        const phaseEndsAtOffsetMilliseconds =
          phase.endsAtVideoStreamOffsetMilliseconds ??
          new Date(phase.endsAt).getTime() - firstPhaseStartsAt;
        if (
          adjustedSeekOffsetInMilliseconds >= phaseStartsAtOffsetMilliseconds &&
          adjustedSeekOffsetInMilliseconds < phaseEndsAtOffsetMilliseconds
        ) {
          setVisibleBattleActiveParticipantId(phase.activeParticipantId);
          return;
        }
      }

      setVisibleBattleActiveParticipantId(null);
    },
    [visibleBattleRecording, setVisibleBattleActiveParticipantId],
  );

  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(true);

  // This flag is set once the visible battle has started playing for the first time,
  // so that the system can distiguish between the initial time the battles are played, and subsequent
  // times the battle videos are played.
  const [initiallyStartedPlaying, setInitiallyStartedPlaying] = useState(false);
  const initiallyStartedPlayingAtRef = useRef<Date | null>(null);

  const [participantSeekCallbacks, setParticipantSeekCallbacks] = useState<
    Map<BattleParticipant['id'], () => void>
  >(new Map());

  // Once all videos in the visible battle have loaded, start playing the battle
  useEffect(() => {
    if (!isVisible) {
      setPaused(true);
      return;
    }
    if (!visibleBattleRecording) {
      return;
    }
    if (!areAllVideosLoadedForVisibleBattle) {
      return;
    }
    if (userIsScrolling) {
      return;
    }
    if (!paused) {
      return;
    }

    const visibleBattleVideoRefs = videoRefs.current.get(visibleBattleRecording.battleId);
    if (!visibleBattleVideoRefs) {
      return;
    }

    // const seekPromises: Array<Promise<void>> = [];

    // // If this is the initial time that the battle started to be played, then seek to to the start
    // // before starting playback
    // if (!initiallyStartedPlaying) {
    //   for (const [participantId, video] of Array.from(visibleBattleVideoRefs)) {
    //     video.seek(0);

    //     seekPromises.push(
    //       new Promise((resolve) => {
    //         setParticipantSeekCallbacks((old) => {
    //           const newValue = new Map(old);
    //           newValue.set(participantId, resolve);
    //           return newValue;
    //         });
    //       })
    //     );
    //     // console.log('INITIAL POSITION', participant.id, initialSeekOffsetInMilliseconds);
    //   }
    // }

    // Promise.all(seekPromises).then(() => {
    console.log('START PLAYBACK!');
    setPaused(false);
    setInitiallyStartedPlaying(true);
    initiallyStartedPlayingAtRef.current = new Date();
    // });
  }, [
    isVisible,
    visibleBattleRecording,
    areAllVideosLoadedForVisibleBattle,
    userIsScrolling,
    paused,
    initiallyStartedPlaying,
    setPaused,
  ]);

  // When the component unmounts, pause the battle videos
  useEffect(() => {
    return () => {
      setPaused(false);
      setMuted(true);
    };
  }, []);

  // Once the battle finishes playing, then loop playback / start at the beginning again
  const onVisibleBattleHasReachedEnd = useCallback(() => {
    if (!isVisible) {
      return;
    }
    if (!visibleBattleRecording) {
      return;
    }
    if (!areAllVideosLoadedForVisibleBattle) {
      return;
    }

    const visibleBattleVideoRefs = videoRefs.current.get(visibleBattleRecording.battleId);
    if (!visibleBattleVideoRefs) {
      return;
    }

    for (const [_participantId, video] of Array.from(visibleBattleVideoRefs)) {
      video.seek(0);
    }
  }, [isVisible, visibleBattleRecording, areAllVideosLoadedForVisibleBattle]);

  const [[innerWidth, innerHeight], setInnerSize] = useState([0, 0]);

  const onChangeSeek = useCallback(
    (seekPositionInMilliseconds: number) => {
      // console.log('CHANGE SEEK', seekPositionInMilliseconds);
      if (!visibleBattleRecording) {
        return;
      }

      const videoRefsInBattle = videoRefs.current.get(visibleBattleRecording.battleId);
      if (!videoRefsInBattle) {
        return;
      }

      for (const [_participantId, video] of Array.from(videoRefsInBattle)) {
        video.seek(seekPositionInMilliseconds / 1000);
      }
    },
    [visibleBattleRecording],
  );

  // console.log('SEEK ENABLED', areAllVideosLoadedForVisibleBattle, 'PAUSED', paused);

  const visibleBattleRecordingsWithVideoFilePaths = useMemo(() => {
    const visibleBattleRecordingsWithVideoFilePaths = [];
    for (let index = 0; index < battleRecordings.length; index += 1) {
      const battleRecording = battleRecordings[index];
      const participants = [];
      for (const participant of battleRecording.participants) {
        const videoFilePath = BattleAndParticipantMap.get(
          downloadedVideoFilesByBattleAndParticipant,
          battleRecording.battleId,
          participant.id,
        );

        // For all battles after the visible battle, only show those battles once the videos for those pages
        // have loaded
        if (index > visibleBattleIndex && videoFilePath === null) {
          return visibleBattleRecordingsWithVideoFilePaths;
        }

        participants.push({ ...participant, videoFilePath });
      }

      visibleBattleRecordingsWithVideoFilePaths.push({
        ...battleRecording,
        participants,
      });
    }
    return visibleBattleRecordingsWithVideoFilePaths;
  }, [battleRecordings, downloadedVideoFilesByBattleAndParticipant]);

  const [inFlightCastedVoteUuidsToAmount, setInFlightCastedVoteUuidsToAmount] = useState(
    new Map<
      string,
      {
        battleId: BattleRecording['battleId'];
        participantId: BattleParticipant['id'];
        amount: number;
      }
    >(),
  );
  // console.log('IN FLIGHT:', inFlightCastedVoteUuidsToAmount, visibleBattleRecording?.participants.map(p => [p.id, p.computedTotalVoteAmount]));
  const onVoteForBattleParticipant = useCallback(
    async (
      battleId: BattleRecording['battleId'],
      participantId: BattleParticipant['id'],
      amount: number = 1,
      startedCastingAt: Date,
      endedCastingAt: Date,
    ) => {
      const playbackOffsetMilliseconds =
        battleToCurrentPlaybackTimeMillisecondsRef.current.get(battleId) || 0;
      const castDurationMilliseconds = endedCastingAt.getTime() - startedCastingAt.getTime();

      const startedCastingAtVideoStreamOffsetMilliseconds =
        playbackOffsetMilliseconds - castDurationMilliseconds;
      const endedCastingAtVideoStreamOffsetMilliseconds = playbackOffsetMilliseconds;

      // Along with the vote, send a client generated uuid
      // This can be used later on to deduplicate the stream of pushed votes to avoid aggrevating the
      // same vote twice
      const clientGeneratedUuid = uuidv4();
      setInFlightCastedVoteUuidsToAmount((old) => {
        const newMap = new Map(old);
        newMap.set(clientGeneratedUuid, {
          battleId,
          participantId,
          amount,
        });
        return newMap;
      });

      try {
        await BarzAPI.voteForBattleParticipantInBattle(
          getToken,
          battleId,
          participantId,
          playbackOffsetMilliseconds,
          startedCastingAtVideoStreamOffsetMilliseconds,
          endedCastingAtVideoStreamOffsetMilliseconds,
          amount,
          clientGeneratedUuid,
        );
      } catch (err) {
        setInFlightCastedVoteUuidsToAmount((old) => {
          const newMap = new Map(old);
          newMap.delete(clientGeneratedUuid);
          return newMap;
        });

        console.error(`Error casting vote for ${participantId} in battle ${battleId}: ${err}`);
        showMessage({
          message: 'Error casting vote!',
          type: 'info',
        });
        return;
      }

      console.log(`Cast ${amount} vote(s) for ${participantId} in battle ${battleId}`);
    },
    [getToken],
  );

  // Listen for updates to all the users associated with the visible battle AND the battles currently
  // being loaded. The goal is that by the time a battle is being viewed in the app, it's showing
  // the most up to date data.
  //
  // FIXME: there also needs to be some logic when new battles start loading to populate the initial
  // user data again since it probably will be out of date
  const pusher = useContext(PusherContext);
  const visibleBattleRecordingBattleId = visibleBattleRecording?.battleId;
  const visibleBattleRecordingParticipantsAndUserIds = JSON.stringify(
    visibleBattleRecording
      ? visibleBattleRecording.participants
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
          .map((p) => [p.id, p.user.id])
      : [],
  );
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!onUpdateParticipantUser) {
      return;
    }
    if (!visibleBattleRecordingBattleId) {
      return;
    }

    const userSubscriptions: Array<PusherChannel> = [];
    for (const [participantId, userId] of JSON.parse(
      visibleBattleRecordingParticipantsAndUserIds,
    )) {
      // Skip subscribing to the `userMe` user since that user is already subscribed to globally
      if (userMe.status === 'COMPLETE' && userMe.data.id === userId) {
        continue;
      }

      pusher
        .subscribe({
          channelName: `private-user-${userId}`,
          onEvent: (event: PusherEvent) => {
            const payload = JSON.parse(event.data);
            switch (event.eventName) {
              case 'user.update':
                console.log('EVENT:', payload);
                onUpdateParticipantUser(visibleBattleRecordingBattleId, participantId, payload);
                break;
            }
          },
        })
        .then((channel: PusherChannel) => {
          userSubscriptions.push(channel);
        });
    }

    return () => {
      for (const userSubscription of userSubscriptions) {
        userSubscription.unsubscribe();
      }
    };
  }, [
    onUpdateParticipantUser,
    visibleBattleRecordingBattleId,
    visibleBattleRecordingParticipantsAndUserIds,
  ]);

  // Listen for updates to the battle's vote totals
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!onChangeComputedTotalVoteAmountForParticipants) {
      return;
    }
    if (!visibleBattleRecordingBattleId) {
      return;
    }

    let battleResultsSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battle-${visibleBattleRecordingBattleId}-results`,
        onEvent: (event: PusherEvent) => {
          const payload: {
            computedTotalVoteAmountByParticipantId: {
              [key: BattleParticipant['id']]: number;
            };
          } = JSON.parse(event.data);

          switch (event.eventName) {
            case 'battle.results':
              console.log('RESULTS:', payload);
              setInFlightCastedVoteUuidsToAmount(new Map());
              onChangeComputedTotalVoteAmountForParticipants(
                visibleBattleRecording.battleId,
                new Map(Object.entries(payload.computedTotalVoteAmountByParticipantId)),
              );
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        battleResultsSubscription = channel;
      });

    return () => {
      if (battleResultsSubscription) {
        battleResultsSubscription.unsubscribe();
      }
    };
  }, [
    onChangeComputedTotalVoteAmountForParticipants,
    visibleBattleRecordingBattleId,
    setInFlightCastedVoteUuidsToAmount,
  ]);

  const onBattleParticipantVideoReadyToPlay = useCallback(
    (battleRecording: BattleRecording, participantId: BattleParticipant['id']) => {
      const twilioParticipantIdsWithLoadedVideo =
        battleToTwilioParticipantIdsWithLoadedVideo.get(battleRecording.battleId) || new Set();

      const battleToTwilioParticipantIdsWithLoadedVideoCopy = new Map(
        battleToTwilioParticipantIdsWithLoadedVideo,
      );

      const newTwilioParticipantIdsWithLoadedVideo = new Set([
        ...Array.from(twilioParticipantIdsWithLoadedVideo),
      ]);
      newTwilioParticipantIdsWithLoadedVideo.add(participantId);
      battleToTwilioParticipantIdsWithLoadedVideoCopy.set(
        battleRecording.battleId,
        newTwilioParticipantIdsWithLoadedVideo,
      );

      setBattleToTwilioParticipantIdsWithLoadedVideo(
        battleToTwilioParticipantIdsWithLoadedVideoCopy,
      );
    },
    [battleToTwilioParticipantIdsWithLoadedVideo, setBattleToTwilioParticipantIdsWithLoadedVideo],
  );

  const sortedVisibleBattleParticipants = useMemo(() => {
    if (!visibleBattleRecording) {
      return null;
    }
    return visibleBattleRecording.participants.sort((a, b) => {
      return (a.order ?? Infinity) - (b.order ?? Infinity);
    });
  }, [visibleBattleRecording]);

  const isUserMeABattleParticipant =
    visibleBattleRecording && userMe.status === 'COMPLETE'
      ? Boolean(visibleBattleRecording.participants.find((p) => p.user.id === userMe.data.id))
      : false;

  const videoCacheManager = (
    <BattleListPlayerVideoCacheManager
      name={name}
      battleRecordings={battleRecordings}
      visibleBattleIndex={visibleBattleIndex}
      onBattleVideoAvailable={onBattleVideoAvailable}
      onErrorLoadingBattleVideo={onErrorLoadingBattleVideo}
    />
  );

  if (battleRecordings.length === 0) {
    return (
      <Fragment>
        {videoCacheManager}
        {additionalGlobalOverlay}
        <View
          style={{
            width,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            flexShrink: 1,
            position: 'relative',
            gap: 16,
          }}
          testID="home"
        >
          <Text style={{ ...Typography.Body1, color: Color.White }}>No battles found</Text>
          {onRefetchInitialPageOfBattles ? (
            <Button type="outline" size={32} onPress={onRefetchInitialPageOfBattles}>
              Refresh
            </Button>
          ) : null}
        </View>
      </Fragment>
    );
  }

  const areAllInitialBattlesLoaded = battleRecordings
    .slice(0, NUMBER_OF_BATTLES_TO_FINISH_LOADING_BEFORE_FULL_PAGE_LOADING_GOES_AWAY)
    .every((b) => {
      return b.participants.every((p) => {
        return BattleAndParticipantMap.has(
          downloadedVideoFilesByBattleAndParticipant,
          b.battleId,
          p.id,
        );
      });
    });
  if (!areAllInitialBattlesLoaded) {
    return (
      <Fragment>
        {videoCacheManager}
        {additionalGlobalOverlay}
        <View
          style={{
            width,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            flexShrink: 1,
            position: 'relative',
            gap: 16,
          }}
          testID={`${testID}-initial-battles-loading`}
        >
          <BarzLoading />
        </View>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {videoCacheManager}

      <View style={{ width: '100%', height: '100%' }}>
        <View
          style={{
            width,
            flexGrow: 1,
            flexShrink: 1,
            position: 'relative',
            backgroundColor: 'black',
          }}
          onLayout={(event) => {
            setInnerSize([event.nativeEvent.layout.width, event.nativeEvent.layout.height]);
          }}
          testID={`${testID}-wrapper`}
        >
          <FlatList
            style={{ zIndex: 9 }}
            data={visibleBattleRecordingsWithVideoFilePaths}
            // If only one battle was specified in the props, don't allow scrolling
            scrollEnabled={battleRecordings.length > 1}
            keyExtractor={(n, index) => `${n.battleId}-${index}`}
            pagingEnabled
            onViewableItemsChanged={onViewableItemsChangedRef.current}
            onScrollBeginDrag={() => {
              console.log('SCROLL START');
              if (!userIsScrolling) {
                setUserIsScrolling(true);

                // Pause playback when the battle changes
                setPaused(true);
                // Reset the "initial play" flag when the battle changes
                setInitiallyStartedPlaying(false);

                resetUserScrollingTimeout();
              }
            }}
            onScrollEndDrag={() => {
              console.log('SCROLL END');
              setUserIsScrolling(false);
            }}
            getItemLayout={(_data, index) => ({
              length: innerHeight,
              offset: innerHeight * index,
              index,
            })}
            renderItem={({ item: battleRecording, index: battleRecordingIndex }) => {
              const isBattleVisible = visibleBattleIndex === battleRecordingIndex;

              // Don't render battle videos that are too far back or too far forwards
              //
              // This ensures that the media pipeline on the phone doesn't get overwhelmed due to trying
              // to hold too many videos in memory at the same time!
              const minBattleIndexToRender = Math.round(
                visibleBattleIndex - (MAX_NUMBER_OF_CONCURRENT_BATTLES_TO_RENDER - 1) / 2,
              );
              const maxBattleIndexToRender = Math.round(
                visibleBattleIndex + (MAX_NUMBER_OF_CONCURRENT_BATTLES_TO_RENDER - 1) / 2,
              );
              if (
                battleRecordingIndex < minBattleIndexToRender ||
                battleRecordingIndex > maxBattleIndexToRender
              ) {
                return (
                  <View style={{ width: innerWidth, height: innerHeight }}>
                    {battleRecording.participants
                      .sort((a, b) => {
                        return (a.order ?? Infinity) - (b.order ?? Infinity);
                      })
                      .map((participant) => {
                        return (
                          <View style={styles.videoContainer} key={participant.id}>
                            <View style={styles.videoViewportContainer}>
                              {participant.mediaThumbnailUrls['256'] ? (
                                <Image
                                  source={{ uri: participant.mediaThumbnailUrls['256'] }}
                                  resizeMode="cover"
                                  style={{ ...StyleSheet.absoluteFillObject, zIndex: 1 }}
                                  blurRadius={2}
                                />
                              ) : (
                                <AvatarImage
                                  profileImageUrl={participant.user.profileImageUrl}
                                  size={128}
                                />
                              )}
                            </View>
                          </View>
                        );
                      })}
                  </View>
                );
              }

              // // Ensure that if battles further down in the list are loading, then only render the NEXT
              // // battle that has not began loading yet.
              // if (
              //   battleRecordingsIndexThatIsCurrentlyLoading !== null &&
              //   battleRecordingIndex > battleRecordingsIndexThatIsCurrentlyLoading
              // ) {
              //   return (
              //     <View style={{width: innerWidth, height: innerHeight }}>
              //       <Text style={{color: 'white'}}>Waiting for visible battle to load first...</Text>
              //     </View>
              //   );
              // }

              return (
                <View
                  style={{ width: innerWidth, height: innerHeight, backgroundColor: 'blue' }}
                  testID={`${testID}-battle-${battleRecording.battleId}-wrapper`}
                >
                  {battleRecording.participants
                    .sort((a, b) => {
                      return (a.order ?? Infinity) - (b.order ?? Infinity);
                    })
                    .map((participant, index) => {
                      if (!participant.mediaUrl) {
                        return (
                          <View style={styles.videoContainer} key={participant.id}>
                            <View style={styles.videoViewportContainer}>
                              <Text style={styles.videoViewportContainerText}>No video</Text>
                            </View>
                          </View>
                        );
                      }

                      const videoFilePath = BattleAndParticipantMap.get(
                        downloadedVideoFilesByBattleAndParticipant,
                        battleRecording.battleId,
                        participant.id,
                      );

                      if (!videoFilePath) {
                        return (
                          <View
                            key={participant.id}
                            style={styles.videoContainer}
                            testID={`${testID}-battle-${battleRecording.battleId}-participant-${participant.id}-downloading`}
                          >
                            <View style={styles.videoViewportContainer}>
                              <Text style={styles.videoViewportContainerText}>
                                Downloading video...
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={participant.id}
                          style={[
                            styles.videoContainer,
                            isBattleVisible && participant.id === visibleBattleActiveParticipantId
                              ? styles.videoContainerActive
                              : null,
                          ]}
                          testID={`${testID}-battle-${battleRecording.battleId}-participant-${participant.id}-playing`}
                        >
                          <View style={styles.videoViewportContainer}>
                            {participant.order == 1 ? (
                              <LinearGradient
                                style={[styles.gradient, { width }]}
                                colors={['rgba(0, 0, 0, 0.42)', 'rgba(0, 0, 0, 0)']}
                                locations={[0, 0.1814]}
                                pointerEvents="none"
                              />
                            ) : null}
                            <Video
                              ref={(r) => {
                                if (r === null) {
                                  // Remove the ref from the big video ref mapping
                                  videoRefs.current = BattleAndParticipantMap.delete(
                                    videoRefs.current,
                                    battleRecording.battleId,
                                    participant.id,
                                  );
                                } else {
                                  // Add the ref to the big video ref mapping
                                  videoRefs.current = BattleAndParticipantMap.set(
                                    videoRefs.current,
                                    battleRecording.battleId,
                                    participant.id,
                                    r,
                                  );
                                }
                              }}
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: 'black',
                              }}
                              poster={participant.mediaThumbnailUrls['256']}
                              posterResizeMode="cover"
                              mixWithOthers="mix"
                              preventsDisplaySleepDuringVideoPlayback={false}
                              source={{ uri: videoFilePath }}
                              // source={{ uri: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4" }}
                              resizeMode="cover"
                              onError={(error) => {
                                console.log(
                                  `VIDEO ${battleRecordingIndex}.${index} onError:`,
                                  error,
                                );

                                // {"error": {"code": -1102, "domain": "NSURLErrorDomain", "localizedDescription": "You do not have permission to access the requested resource.", "localizedFailureReason": "", "localizedRecoverySuggestion": ""}, "target": 9919}
                                onErrorLoadingBattleVideo(battleRecording.battleId);
                              }}
                              // Once the video is ready to be played, then mark it as ready - and when all
                              // videos are ready, the battle will start playing!
                              onReadyForDisplay={(...args) => {
                                console.log(
                                  `VIDEO ${battleRecordingIndex}.${index} onReadyForDisplay:`,
                                  args,
                                );

                                // NOTE: this event doesn't seem to be fired correctly on android, so use
                                // the `onLoad` event instead. This one is definitely preferred, though...
                                if (Platform.OS !== 'android') {
                                  onBattleParticipantVideoReadyToPlay(
                                    battleRecording,
                                    participant.id,
                                  );
                                }
                              }}
                              onLoad={(...args) => {
                                console.log(`VIDEO ${battleRecordingIndex}.${index} onLoad:`, args);

                                if (Platform.OS === 'android') {
                                  onBattleParticipantVideoReadyToPlay(
                                    battleRecording,
                                    participant.id,
                                  );
                                }
                              }}
                              onProgress={(e) => {
                                const currentTimeMilliseconds = e.currentTime * 1000;
                                // console.log('VIDEO PLAYBACK PROGRESS:', index, currentTimeMilliseconds);

                                // Since all the videos are lined up in time, playback progress events can come
                                // from any video, so just use the first one
                                if (participant.id === battleRecording.participants[0].id) {
                                  updateBattleToCurrentPlaybackTimeMilliseconds(
                                    battleRecording.battleId,
                                    currentTimeMilliseconds,
                                  );
                                }
                              }}
                              // Once a seek is complete, call the seek callback if one has been
                              // registered
                              onSeek={() => {
                                const callback = participantSeekCallbacks.get(participant.id);
                                if (callback) {
                                  callback();

                                  setParticipantSeekCallbacks((old) => {
                                    const newValue = new Map(old);
                                    newValue.delete(participant.id);
                                    return newValue;
                                  });
                                }
                              }}
                              // If the video ends before the battle officially ends, then somebody must have
                              // bailed out early, so consider that the end of the battle
                              // onEnd={(...args) => {
                              //   console.log(
                              //     `VIDEO ${battleRecordingIndex}.${index} onEnd:`,
                              //     args
                              //   );
                              //   onVisibleBattleHasReachedEnd();
                              // }}
                              paused={isBattleVisible ? paused : true}
                              muted={isBattleVisible ? muted : true}
                              // onLoad={(...args) => {
                              //   console.log('VIDEO onLoad:', args);
                              // }}
                              volume={10}
                              repeat={true}
                              // ref: https://www.npmjs.com/package/react-native-video#automaticallyWaitsToMinimizeStalling
                              // This is important so that the playback of the two videos will misalign less often
                              automaticallyWaitsToMinimizeStalling={false}
                              // ref: https://www.npmjs.com/package/react-native-video#bufferConfig
                              bufferConfig={{
                                minBufferMs: 500,
                                maxBufferMs: 50000,
                                bufferForPlaybackMs: 2500,
                                bufferForPlaybackAfterRebufferMs: 5000,
                              }}
                              // controls={true}
                            />
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            }}
          />

          {/*
          FIXME: `rgba(0,0,0,0.01)` is working around an android issue where when the color is fully
          transparent, android renders the gradients as big black rectangles
          */}
          <LinearGradient
            style={[styles.gradient, { width }]}
            colors={[Color.Gray.Dark1, 'rgba(20, 20, 20, 0.5)', 'rgba(20, 20, 20, 0.01)']}
            locations={[0, 0.1, 0.25]}
            pointerEvents="none"
          />
          <LinearGradient
            style={[styles.gradient, { width }]}
            colors={['rgba(20, 20, 20, 0.01)', 'rgba(20, 20, 20, 0.3)', Color.Gray.Dark1]}
            locations={[0.85, 0.9, 1]}
            pointerEvents="none"
          />

          {additionalGlobalOverlay}

          {onNavigateBackwards ? <VideoBackButton onPress={onNavigateBackwards} /> : null}

          <View style={[styles.videoInteractionsGroup]}>
            {visibleBattleRecording && !userIsScrolling ? (
              <VideoMoreButton onPress={() => setMoreBottomSheetOpen((n) => !n)} />
            ) : null}

            {visibleBattleRecording && !userIsScrolling ? (
              <VideoCommentsButton
                testID={`${testID}-comments-button`}
                battleCommentTotal={visibleBattleRecording.battleCommentTotal}
                onPress={() => setCommentsBottomSheetOpen((n) => !n)}
              />
            ) : null}
          </View>

          {/* DEBUG MENU: show the current battle id in the upper left corner */}
          {debugMenuVisible ? (
            <View
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                marginTop: 8,
                zIndex: 9999,
                gap: 8,
              }}
            >
              {visibleBattleRecording ? (
                <Fragment>
                  <Text style={{ ...Typography.Monospace2, color: Color.White }}>
                    {visibleBattleRecording.battleId}
                  </Text>
                  <Button
                    width={96}
                    onPress={() => onErrorLoadingBattleVideo(visibleBattleRecording.battleId)}
                  >
                    Refetch
                  </Button>
                  <Button
                    width={96}
                    onPress={() => {
                      if (muted) {
                        setMuted(false);
                      } else {
                        setMuted(true);
                      }
                    }}
                  >
                    {muted ? 'Unmute' : 'Mute'}
                  </Button>
                </Fragment>
              ) : (
                <Fragment>
                  <Text style={{ ...Typography.Monospace2, color: Color.White }}>
                    No visible battle
                  </Text>
                </Fragment>
              )}
            </View>
          ) : null}

          {visibleBattleRecording &&
          visibleBattleRecording.battleComputedPrivacyLevel === 'PUBLIC' &&
          sortedVisibleBattleParticipants &&
          !userIsScrolling ? (
            <VideoVoteCountdown votingEndsAt={visibleBattleRecording.battleVotingEndsAt}>
              {(isVotingComplete) => (
                <Fragment>
                  <View
                    style={[styles.voteButtonContainer, { bottom: '50%' }]}
                    pointerEvents="box-none"
                  >
                    <VideoVoteButton
                      participant={sortedVisibleBattleParticipants[0]}
                      testID={`${testID}-battle-${visibleBattleRecording.battleId}-participant-${sortedVisibleBattleParticipants[0].id}-vote-button`}
                      inFlightCastedVoteAmounts={Array.from(inFlightCastedVoteUuidsToAmount)
                        .filter(([_uuid, { participantId }]) => {
                          if (participantId !== sortedVisibleBattleParticipants[0].id) {
                            return false;
                          }
                          return true;
                        })
                        .map(([_uuid, { amount }]) => amount)}
                      maxVotes={
                        userMe.status === 'COMPLETE'
                          ? userMe.data.maxNumberOfVotesPerBattle
                          : undefined
                      }
                      disabled={isVotingComplete || isUserMeABattleParticipant}
                      onCastVote={(participantId, amount, startOffsetMs, endOffsetMs) => {
                        return onVoteForBattleParticipant(
                          visibleBattleRecording.battleId,
                          participantId,
                          amount,
                          startOffsetMs,
                          endOffsetMs,
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.voteButtonContainer, { bottom: '0%', marginBottom: 44 }]}>
                    <VideoVoteButton
                      testID={`${testID}-battle-${visibleBattleRecording.battleId}-participant-${sortedVisibleBattleParticipants[1].id}-vote-button`}
                      participant={sortedVisibleBattleParticipants[1]}
                      inFlightCastedVoteAmounts={Array.from(inFlightCastedVoteUuidsToAmount)
                        .filter(([_uuid, { participantId }]) => {
                          return participantId === sortedVisibleBattleParticipants[1].id;
                        })
                        .map(([_uuid, { amount }]) => amount)}
                      maxVotes={
                        userMe.status === 'COMPLETE'
                          ? userMe.data.maxNumberOfVotesPerBattle
                          : undefined
                      }
                      disabled={isVotingComplete || isUserMeABattleParticipant}
                      onCastVote={(participantId, amount, startOffsetMs, endOffsetMs) => {
                        return onVoteForBattleParticipant(
                          visibleBattleRecording.battleId,
                          participantId,
                          amount,
                          startOffsetMs,
                          endOffsetMs,
                        );
                      }}
                    />
                  </View>
                </Fragment>
              )}
            </VideoVoteCountdown>
          ) : null}
          {visibleBattleRecording &&
          visibleBattleRecording.battleComputedPrivacyLevel === 'PRIVATE' ? (
            <VideoPrivateIndicator />
          ) : null}

          {visibleBattleRecording && !userIsScrolling ? (
            <VideoPlaybackSeekBar
              width={width}
              gutterSpacing={8}
              battleRecording={visibleBattleRecording}
              battleToCurrentPlaybackTimeMillisecondsRef={
                battleToCurrentPlaybackTimeMillisecondsRef
              }
              seekEnabled={areAllVideosLoadedForVisibleBattle === true}
              onSeekStart={() => {
                setPaused(true);
              }}
              onSeekComplete={() => {
                setPaused(false);
              }}
              onChangeSeek={onChangeSeek}
              onBattleHasReachedLastVisiblePhase={onVisibleBattleHasReachedEnd}
            />
          ) : null}

          {visibleBattleRecording && !userIsScrolling && visibleBattleRecording.participants[0] ? (
            <View
              style={[
                styles.videoParticipantHeaderWrapper,
                {
                  // NOTE: On android, move the upper video participant header downwards to be under the
                  // status bar
                  top: Platform.select({ ios: 0, android: 32 }),
                },
              ]}
            >
              <VideoParticipantHeader
                participant={visibleBattleRecording.participants[0]}
                testID={`${testID}-battle-${visibleBattleRecording.battleId}-participant-${visibleBattleRecording.participants[0].id}-header`}
                active={
                  visibleBattleRecording.participants[0].id === visibleBattleActiveParticipantId
                }
                onPress={() => onVisitUserProfile(visibleBattleRecording.participants[0].user.id)}
              />
            </View>
          ) : null}
          {visibleBattleRecording && !userIsScrolling && visibleBattleRecording.participants[1] ? (
            <View style={[styles.videoParticipantHeaderWrapper, { top: '50%' }]}>
              <VideoParticipantHeader
                participant={visibleBattleRecording.participants[1]}
                testID={`${testID}-battle-${visibleBattleRecording.battleId}-participant-${visibleBattleRecording.participants[1].id}-header`}
                active={
                  visibleBattleRecording.participants[1].id === visibleBattleActiveParticipantId
                }
                onPress={() => onVisitUserProfile(visibleBattleRecording.participants[1].user.id)}
              />
            </View>
          ) : null}

          {/* Show a loading indicator when the app is initially loading new battles */}
          {/* FIXME: come up with an official style for this */}
          {loadingNextPageOfBattles ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                zIndex: 9999,
              }}
            >
              <Text style={{ color: 'white' }}>Loading more battles</Text>
            </View>
          ) : null}

          {/* This allows detox to determine programatically which battle is currently visible */}
          {battleRecordings[visibleBattleIndex] ? (
            <View
              style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, zIndex: 9999 }}
              testID={`${testID}-battle-${battleRecordings[visibleBattleIndex].battleId}-visible`}
            />
          ) : null}
        </View>
      </View>

      {visibleBattleRecording ? (
        <VideoCommentBottomSheet
          testID={`${testID}-comments-bottom-sheet`}
          battleId={visibleBattleRecording.battleId}
          open={commentsBottomSheetOpen}
          onClose={() => setCommentsBottomSheetOpen(false)}
          battleToCurrentPlaybackTimeMillisecondsRef={battleToCurrentPlaybackTimeMillisecondsRef}
          onVisitUserProfile={onVisitUserProfile}
          onChangeCommentTotal={(newCommentTotal) => {
            if (onChangeCommentTotal) {
              onChangeCommentTotal(visibleBattleRecording.battleId, newCommentTotal);
            }
          }}
        />
      ) : null}
      {visibleBattleRecording ? (
        <VideoMoreBottomSheet
          battleRecording={visibleBattleRecording}
          open={moreBottomSheetOpen}
          onClose={() => setMoreBottomSheetOpen(false)}
        />
      ) : null}
    </Fragment>
  );
};

export default BattleListPlayer;
