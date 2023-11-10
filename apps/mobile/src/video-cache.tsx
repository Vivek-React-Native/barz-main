import * as React from 'react';
import { Fragment, useRef, useEffect, useCallback, useContext, useMemo } from 'react';
import { showMessage } from 'react-native-flash-message';
import * as FileSystem from 'expo-file-system';
import { resetFileModificationTime } from '@barz/twilio-video';

import {
  BattleWithParticipants,
  BattleRecording,
  BattleParticipant,
} from '@barz/mobile/src/lib/api';
import BattleAndParticipantMap from '@barz/mobile/src/lib/battle-and-participant-map';

const BATTLE_VIDEO_FILE_PREFIX = `battle-video`;

// Video cache settings:

// 500mb should be the absolute maximum amount of video data in the cache directory, ideally much
// less: https://forums.expo.dev/t/my-expo-app-is-crashing-in-prod-how-do-i-troubleshoot-it/52924/34
const MAX_CACHED_VIDEO_TOTAL_SIZE_BYTES = 200 * 1024 * 1024 * 1024; // 200mb

// Amount of time that videos should stick around on the filesystem before being removed
const MAX_CACHED_VIDEO_FILE_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// How often to run the garbage collection function to periodically clean up old videos
const GARBAGE_COLLECTION_CYCLE_TIME_SECONDS = 10;

export type VideoCacheContextData = {
  fetchVideosForBattleRecordings: (
    battleRecordingsToFetch: Array<BattleRecording>,

    // Called when a battle video has either completed downloading or immediately if the video is
    // cached
    onBattleVideoAvailable?: (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      videoPath: string,
    ) => void,

    // Called when an individual battle video failed to download for some reason
    onErrorLoadingBattleVideo?: (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
    ) => void,

    // If specified, allows the caller to cancel fetching videos prior to completion
    abort?: AbortSignal,
  ) => Promise<void>;
  aquireLockOnVideoFile: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    nameOfLocker: string,
  ) => void;
  releaseLockOnVideoFile: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
    nameOfLocker: string,
  ) => void;
  listCachedVideos: () => Promise<
    Array<[BattleWithParticipants['id'], BattleParticipant['id'], FileSystem.FileInfo]>
  >;
};
export const VideoCacheContext = React.createContext<VideoCacheContextData | null>(null);

const VideoCachingProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Stores a reference counter for each video, tracking each place that video is being shown. Note
  // that this is ONLY stored in memory, so force quitting / terminating the app will cause a lock to
  // be released on all videos.
  //
  // Videos will only be deleted from the filesystem once this reference counter resets back to zero
  // to ensure that videos aren't cleared while they are currently being played.
  const battleParticipantVideoLockNamesRef = useRef(BattleAndParticipantMap.create<Set<string>>());

  // For each video that is currently downloading, store an array of [resolve, reject] callback
  // pairs. Once the video is done downloading, the corresponding callback is called
  //
  // This facilitates behavior where if one call of `fetchVideosForBattleRecordings` starts
  // downloading a video and during that process, `fetchVideosForBattleRecordings` is called AGAIN
  // to download the same video, it can just "subscribe" to the first video being downloaded rather
  // than attempting to download it twice.
  const battleParticipantVideoDownloadingCompleteCallbacksRef = useRef(
    BattleAndParticipantMap.create<
      Array<
        [
          (
            data: [
              BattleWithParticipants['id'],
              BattleParticipant['id'],
              string | null,
              string,
              FileSystem.FileSystemDownloadResult | null,
            ],
          ) => void,
          (error: Error) => void,
        ]
      >
    >(),
  );

  // When called, removes battle participant video files that haven't been touched in a long
  // enough time, and also limit the maximum amount of space that videos can take up
  //
  // https://www.echowaves.com/post/expo-filesystem-cachedirectory-has-to-be-cleaned
  const garbageCollectUnusedVideos = useCallback(async () => {
    const cachedBattleParticipantVideos = await listCachedVideos();
    if (!cachedBattleParticipantVideos) {
      return;
    }

    const now = new Date();
    // console.log('LOCK STATE:', BATTLE_PARTICIPANT_VIDEO_REFERENCES.current)

    const newestToOldestCachedBattleParticipantVideos = cachedBattleParticipantVideos.sort(
      ([_aid, _apid, a], [_bid, _bpid, b]) => {
        if (!a.exists) {
          return 0;
        }
        if (!b.exists) {
          return 0;
        }
        return a.modificationTime < b.modificationTime ? 1 : -1;
      },
    );

    let fileSizeInBytes = 0;
    let battleParticipantVideosToDelete: Array<FileSystem.FileInfo> = [];
    for (const [
      battleId,
      participantId,
      battleParticipantVideoInfo,
    ] of newestToOldestCachedBattleParticipantVideos) {
      if (!battleParticipantVideoInfo.exists) {
        continue;
      }

      // If this video is currently being played, then skip removing it until it is done being played
      const refs = BattleAndParticipantMap.getOrDefault(
        battleParticipantVideoLockNamesRef.current,
        battleId,
        participantId,
        new Set(),
      );
      if (refs.size > 0) {
        continue;
      }

      // If this video file goes over the maximum amount of cache space that is allowed, delete it
      if (fileSizeInBytes > MAX_CACHED_VIDEO_TOTAL_SIZE_BYTES) {
        // console.log('BYTES', fileSizeInBytes, MAX_CACHED_VIDEO_TOTAL_SIZE_BYTES);
        battleParticipantVideosToDelete.push(battleParticipantVideoInfo);
        continue;
      }

      // Delete video files that are beyond the given max age
      const fileLastModifiedAt = new Date(battleParticipantVideoInfo.modificationTime * 1000);
      if (now.getTime() - fileLastModifiedAt.getTime() > MAX_CACHED_VIDEO_FILE_AGE_SECONDS * 1000) {
        // console.log('TIME', now, 'VS', fileLastModifiedAt, now.getTime() - fileLastModifiedAt.getTime())
        battleParticipantVideosToDelete.push(battleParticipantVideoInfo);
        continue;
      }

      fileSizeInBytes += battleParticipantVideoInfo.size;
    }

    const deletionResults = await Promise.all(
      battleParticipantVideosToDelete.map(async (video) => {
        if (!video.exists) {
          return;
        }
        console.log(
          `[VIDEO FILE GARBAGE COLLECTOR] Erasing battle video ${
            video.uri
          } (last modified at: ${new Date(video.modificationTime * 1000)})`,
        );
        return FileSystem.deleteAsync(video.uri, { idempotent: true });
      }),
    );

    if (deletionResults.length > 0) {
      console.log(
        `[VIDEO FILE GARBAGE COLLECTOR] Erased ${deletionResults.length} battle participant video ${
          deletionResults.length === 1 ? 'file' : 'files'
        }.`,
      );
    }
  }, []);

  // On an interval, run the garbage collection function to clean up old battle participant videos
  // Wait to run the next garbage collection function until after the current run has completed
  useEffect(() => {
    garbageCollectUnusedVideos();

    let handle: NodeJS.Timeout | null = null;
    const scheduleGarbageCollection = () => {
      const complete = () => {
        handle = setTimeout(
          scheduleGarbageCollection,
          GARBAGE_COLLECTION_CYCLE_TIME_SECONDS * 1000,
        );
      };

      garbageCollectUnusedVideos()
        .then(() => {
          complete();
        })
        .catch((err) => {
          console.error('Error running video garbage collection:', err);
          complete();
        });
    };
    scheduleGarbageCollection();

    return () => {
      if (handle !== null) {
        clearTimeout(handle);
      }
    };
  }, [garbageCollectUnusedVideos]);

  // Get a list of all video files cached on the filesystem, along with their battle and participant
  // ids
  const listCachedVideos = useCallback(async () => {
    if (!FileSystem.cacheDirectory) {
      return [];
    }
    const parentDirectory = FileSystem.cacheDirectory;

    const files = await FileSystem.readDirectoryAsync(parentDirectory);
    const fileInfo = await Promise.all(
      files
        .filter((path) => path.startsWith(BATTLE_VIDEO_FILE_PREFIX))
        .map((path) => FileSystem.getInfoAsync(parentDirectory + path)),
    );

    return fileInfo.map((info) => {
      // Extract the battle and participant ids from the battle video file path
      const url = new URL(info.uri);
      const [battleId, participantId] = url.pathname
        .replace(new RegExp(`^.*${BATTLE_VIDEO_FILE_PREFIX}-`), '')
        .replace(/\..+$/, '')
        .split('-');

      return [battleId, participantId, info] as [
        BattleRecording['battleId'],
        BattleParticipant['id'],
        FileSystem.FileInfo,
      ];
    });
  }, []);

  // Given a battle recording and participant within that battle recording, return the location for
  // which the video associated with the recording should be cached to the filesystem
  const generateBattleParticipantMediaVideoPath = useCallback(
    (battleRecording: BattleRecording, participant: BattleRecording['participants'][0]) => {
      if (!FileSystem.cacheDirectory) {
        return null;
      }
      if (!participant.mediaUrl) {
        return null;
      }

      // Extract the file extension from the url
      const parsedMediaUrl = new URL(participant.mediaUrl);
      const extensionMatch = /\.([a-z0-9]+)$/.exec(parsedMediaUrl.pathname);
      const extension = extensionMatch ? extensionMatch[1] : '';

      return `${FileSystem.cacheDirectory}${BATTLE_VIDEO_FILE_PREFIX}-${battleRecording.battleId}-${participant.id}.${extension}`;
    },
    [],
  );

  // Given a list of battle recordings, fetch all video files from the cloud and cache them locally.
  const fetchVideosForBattleRecordings = useCallback(
    async (
      battleRecordingsToFetch: Array<BattleRecording>,

      // Called when a battle video has either completed downloading or immediately if the video is
      // cached
      onBattleVideoAvailable?: (
        battleId: BattleWithParticipants['id'],
        participantId: BattleRecording['participants'][0]['id'],
        videoPath: string,
      ) => void,

      // Called when an individual battle video failed to download for some reason
      onErrorLoadingBattleVideo?: (
        battleId: BattleWithParticipants['id'],
        participantId: BattleParticipant['id'],
      ) => void,

      // If specified, allows the caller to cancel fetching videos prior to completion
      abort?: AbortSignal,
    ) => {
      for (const battleRecording of battleRecordingsToFetch) {
        const cachedBattleVideos = await listCachedVideos();

        const promises: Array<
          Promise<
            [
              BattleWithParticipants['id'],
              BattleParticipant['id'],
              string | null,
              string,
              FileSystem.FileSystemDownloadResult | null,
            ]
          >
        > = [];

        // Step 1: Kick off downloading a video per participant from the server
        for (const participant of battleRecording.participants) {
          if (!participant.mediaUrl) {
            console.log(
              `Video found in mediaUrl key for battle ${battleRecording.battleId} and participant ${participant.id} was null, skipping fetch...`,
            );
            continue;
          }

          // Skip fetching videos that are already downloaded
          const matchingCachedBattleVideo = cachedBattleVideos.find(([battleId, participantId]) => {
            return battleId === battleRecording.battleId && participantId === participant.id;
          });
          if (matchingCachedBattleVideo) {
            const cachedBattleVideoInfo = matchingCachedBattleVideo[2];
            if (cachedBattleVideoInfo.exists) {
              // Reset the modification timestamp on the video to be "now"
              //
              // NOTE: there is not a good way to do this in expo as one atomic operation, so I've
              // had to write a custom native function to do this with corresponding ios and android
              // native implementations
              resetFileModificationTime(cachedBattleVideoInfo.uri);

              // console.log('VIDEO ALREADY CACHED!', battleRecording.battleId, participant.id);
              promises.push(
                Promise.resolve([
                  battleRecording.battleId,
                  participant.id,
                  participant.mediaUrl,
                  cachedBattleVideoInfo.uri,
                  null,
                ]),
              );
              continue;
            }
          }

          // If a battle is already being fetched from the server, then avoid fetching the file again,
          // and attach a handler so that when the currently in progress download completes, this
          // function will know about it
          const battleParticipantVideoDownloadingCompleteCallbacks =
            BattleAndParticipantMap.getOrDefault(
              battleParticipantVideoDownloadingCompleteCallbacksRef.current,
              battleRecording.battleId,
              participant.id,
              [],
            );
          const isVideoDownloadingCurrently =
            battleParticipantVideoDownloadingCompleteCallbacks.length > 0;

          // Once the video is done downloading, then the callbacks in
          // BATTLE_PARTICIPANT_VIDEO_DOWNLOADING_COMPLETE_CALLBACKS will be called, which will result
          // in the below promise resolving:
          promises.push(
            new Promise((resolve, reject) => {
              battleParticipantVideoDownloadingCompleteCallbacksRef.current =
                BattleAndParticipantMap.set(
                  battleParticipantVideoDownloadingCompleteCallbacksRef.current,
                  battleRecording.battleId,
                  participant.id,
                  [...battleParticipantVideoDownloadingCompleteCallbacks, [resolve, reject]],
                );
            }),
          );
          if (isVideoDownloadingCurrently) {
            // console.log(`Video for battle ${battleRecording.battleId} and participant ${participant.id} already downloading, skipping downloading again...`);
            continue;
          }

          const videoPath = generateBattleParticipantMediaVideoPath(battleRecording, participant);
          if (!videoPath) {
            console.warn(
              `Could not generate video path for battle ${battleRecording.battleId} and participant ${participant.id}, skipping...`,
            );
            continue;
          }
          // console.log('DOWNLOADING:', battleRecording.battleId, participant.id);

          FileSystem.downloadAsync(participant.mediaUrl, videoPath)
            .then((result) => {
              const callbacks = BattleAndParticipantMap.getOrDefault(
                battleParticipantVideoDownloadingCompleteCallbacksRef.current,
                battleRecording.battleId,
                participant.id,
                [],
              );

              for (const [resolve, _reject] of callbacks) {
                resolve([
                  battleRecording.battleId,
                  participant.id,
                  participant.mediaUrl,
                  videoPath,
                  result,
                ]);
              }

              // After calling all the callbacks, clear them so they won't be called again
              battleParticipantVideoDownloadingCompleteCallbacksRef.current =
                BattleAndParticipantMap.delete(
                  battleParticipantVideoDownloadingCompleteCallbacksRef.current,
                  battleRecording.battleId,
                  participant.id,
                );
            })
            .catch((error) => {
              const callbacks = BattleAndParticipantMap.getOrDefault(
                battleParticipantVideoDownloadingCompleteCallbacksRef.current,
                battleRecording.battleId,
                participant.id,
                [],
              );

              for (const [_resolve, reject] of callbacks) {
                reject(error);
              }

              // After calling all the callbacks, clear them so they won't be called again
              battleParticipantVideoDownloadingCompleteCallbacksRef.current =
                BattleAndParticipantMap.delete(
                  battleParticipantVideoDownloadingCompleteCallbacksRef.current,
                  battleRecording.battleId,
                  participant.id,
                );
            });
        }

        if (abort && abort.aborted) {
          // console.log('Aborting battle video download...');
          return;
        }

        // Step 2: Download all videos for the active battle
        if (promises.length > 0) {
          const results = await Promise.all(promises);
          // console.log('PROMISES COMPLETE!')

          if (abort && abort.aborted) {
            // console.log('Aborting battle video download...');
            return;
          }

          // Step 3: Update the mapping in memory with the locations of each file that has been
          // downloaded
          for (const [battleId, participantId, mediaUrl, videoPath, downloadResult] of results) {
            if (downloadResult && (downloadResult.status < 200 || downloadResult.status >= 400)) {
              console.warn(
                `Error downloading video ${mediaUrl} for battle ${battleId} and participant ${participantId}: received ${downloadResult.status}. Reporting to parent context so the battle recording can be refetched...`,
              );
              if (onErrorLoadingBattleVideo) {
                onErrorLoadingBattleVideo(battleId, participantId);
              }
              continue;
            }
            // console.log('DOWNLOADING COMPLETE:', battleId, participantId);
            if (onBattleVideoAvailable) {
              onBattleVideoAvailable(battleId, participantId, videoPath);
            }
          }
        }
      }
    },
    [listCachedVideos, generateBattleParticipantMediaVideoPath],
  );

  // Aquire and release videos to keep them from being automatically deleted
  const aquireLockOnVideoFile = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      nameOfLocker: string,
    ) => {
      // console.log(`[VIDEO FILE] Aquire lock ${battleId} -> ${participantId} (${nameOfLocker})`);
      battleParticipantVideoLockNamesRef.current = BattleAndParticipantMap.upsert(
        battleParticipantVideoLockNamesRef.current,
        battleId,
        participantId,
        (old) => {
          const newSet = new Set(old);
          newSet.add(nameOfLocker);
          return newSet;
        },
      );
    },
    [],
  );
  const releaseLockOnVideoFile = useCallback(
    (
      battleId: BattleWithParticipants['id'],
      participantId: BattleParticipant['id'],
      nameOfLocker: string,
    ) => {
      // console.log(`[VIDEO FILE] Release lock ${battleId} -> ${participantId} (${nameOfLocker})`);
      battleParticipantVideoLockNamesRef.current = BattleAndParticipantMap.upsert(
        battleParticipantVideoLockNamesRef.current,
        battleId,
        participantId,
        (old) => {
          const newSet = new Set(old);
          newSet.delete(nameOfLocker);
          return newSet;
        },
      );
    },
    [],
  );

  const videoCacheContextData: VideoCacheContextData = useMemo(() => {
    return {
      fetchVideosForBattleRecordings,
      aquireLockOnVideoFile,
      releaseLockOnVideoFile,
      listCachedVideos,
    };
  }, [
    fetchVideosForBattleRecordings,
    aquireLockOnVideoFile,
    releaseLockOnVideoFile,
    listCachedVideos,
  ]);

  return (
    <VideoCacheContext.Provider value={videoCacheContextData}>
      {children}
    </VideoCacheContext.Provider>
  );
};

export default VideoCachingProvider;

// A component which calls `fetchVideosForBattleRecordings` in a declarative way
export const VideoCachingPrefetchBattleRecordingVideos: React.FunctionComponent<{
  battleRecordings: Array<BattleRecording>;

  // Called when a battle video has either completed downloading or immediately if the video is
  // cached
  onBattleVideoAvailable?: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleRecording['participants'][0]['id'],
    videoPath: string,
  ) => void;

  // Called when an individual battle video failed to download for some reason
  onErrorLoadingBattleVideo?: (
    battleId: BattleWithParticipants['id'],
    participantId: BattleParticipant['id'],
  ) => void;

  onComplete?: () => void;

  children?: React.ReactNode;
}> = ({
  battleRecordings,
  onBattleVideoAvailable,
  onErrorLoadingBattleVideo,
  onComplete,
  children,
}) => {
  const videoCacheContext = useContext(VideoCacheContext);
  if (!videoCacheContext) {
    throw new Error(
      '[VideoCachingPrecacheBattleRecordings] Unable to get context data! Was a VideoCachingPrecacheBattleRecordings rendered outside of VideoCacheContext?',
    );
  }

  useEffect(() => {
    const abortController = new AbortController();

    videoCacheContext
      .fetchVideosForBattleRecordings(
        battleRecordings,
        onBattleVideoAvailable,
        onErrorLoadingBattleVideo,
        abortController.signal,
      )
      .then(() => {
        if (onComplete) {
          onComplete();
        }
      })
      .catch((err) => {
        console.log(`Error downloading videos: ${err}`);
        showMessage({
          message: 'Error downloading videos:',
          description: `${err}`,
          type: 'info',
        });
      });

    return () => {
      abortController.abort();
    };
  }, [
    videoCacheContext,
    battleRecordings,
    onBattleVideoAvailable,
    onErrorLoadingBattleVideo,
    onComplete,
  ]);

  return <Fragment>{children}</Fragment>;
};

// A component which calls `aquireLockOnVideoFile` and `releaseLockOnVideoFile` in a declarative way
export const VideoCachingDependsOnParticipantVideos: React.FunctionComponent<{
  name: string;
  videos: Array<[BattleRecording['battleId'], BattleParticipant['id']]>;
  children?: React.ReactNode;
}> = ({ name, videos, children }) => {
  const videoCacheContext = useContext(VideoCacheContext);
  if (!videoCacheContext) {
    throw new Error(
      '[VideoCachingAquireLock] Unable to get context data! Was a VideoCachingAquireLock rendered outside of VideoCacheContext?',
    );
  }

  const videosAsString = videos
    .map(([battleId, participantId]) => `${battleId},${participantId}`)
    .sort()
    .join(';');
  useEffect(() => {
    const parsedData = videosAsString.split(';').map((raw) => raw.split(','));
    for (const [battleId, participantId] of parsedData) {
      videoCacheContext.aquireLockOnVideoFile(battleId, participantId, name);
    }

    return () => {
      for (const [battleId, participantId] of parsedData) {
        videoCacheContext.releaseLockOnVideoFile(battleId, participantId, name);
      }
    };
  }, [videoCacheContext, name, videosAsString]);

  return <Fragment>{children}</Fragment>;
};
