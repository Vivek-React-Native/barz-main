import { Queue, Worker } from 'bullmq';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import which from 'which';

import { redisConnection } from '../lib/redis.ts';
import BattleParticipant from '../lib/battle-participant.ts';
import { RecordingsObjectStorage } from '../lib/object-storage.ts';
import Battle from '../lib/battle.ts';
import prisma from '../lib/prisma.ts';

const WORKER_NAME = 'battle-participant-video-generation';

// Amount of time to wait after the state machine transitions into WARM_UP before the thumbnail
// image is extracted for the battle
const THUMBNAIL_OFFSET_FROM_WARM_UP_MILLISECONDS = 3_000;
const THUMBNAIL_SIZES_PIXELS = [64, 128, 256, 512];

type Message = {
  version: 1;
  type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO';
  battleParticipantId: BattleParticipant['id'];
};

const queue = new Queue(WORKER_NAME, { connection: redisConnection });

// When called, enqueue a message to take the given participant and generate a video of their time
// while in a battle
export async function queueEventToGenerateBattleParticipantVideo(
  battleParticipant: BattleParticipant,
) {
  const message: Message = {
    version: 1,
    type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO',
    battleParticipantId: battleParticipant.id,
  };
  await queue.add('generate-battle-participant-video', message, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

const downloadFileFromObjectStorage = async (key: string, outputFilePath: string) => {
  const buffer = await RecordingsObjectStorage.get(key);

  if (!buffer) {
    throw new Error(`Downloading data from ${key} failed!`);
  }
  return fs.writeFile(outputFilePath, buffer);
};

const getMkvMergePath = async () => {
  // First: Try the MKVMERGE_PATH environment variable
  if (process.env.MKVMERGE_PATH) {
    let exists = true;
    try {
      await fs.stat(process.env.MKVMERGE_PATH);
    } catch {
      exists = false;
    }
    if (exists) {
      return process.env.MKVMERGE_PATH;
    }
  }

  // Second: Search in the PATH
  const path = await which('mkvmerge', { nothrow: true });
  if (path) {
    return path;
  }

  throw new Error(
    'Error: unable to find mkvmerge binary! Either set MKVMERGE_PATH or make sure mkvmerge is in the PATH.',
  );
};

const getMkvExtractPath = async () => {
  // First: Try the MKVEXTRACT_PATH environment variable
  if (process.env.MKVEXTRACT_PATH) {
    let exists = true;
    try {
      await fs.stat(process.env.MKVEXTRACT_PATH);
    } catch {
      exists = false;
    }
    if (exists) {
      return process.env.MKVEXTRACT_PATH;
    }
  }

  // Second: Search in the PATH
  const path = await which('mkvextract', { nothrow: true });
  if (path) {
    return path;
  }

  throw new Error(
    'Error: unable to find mkvextract binary! Either set MKVEXTRACT_PATH or make sure mkvextract is in the PATH.',
  );
};

const getMkaTimestamps = async (battleParticipantId: string, audioFilePath: string) => {
  const outputPath = `/tmp/timestamps-${battleParticipantId}.txt`;
  const mkvExtractPath = await getMkvExtractPath();

  await new Promise<void>((resolve, reject) => {
    const childProcess = execFile(
      mkvExtractPath,
      [audioFilePath, 'timestamps_v2', `0:${outputPath}`],
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
    childProcess.stdout?.on('data', (data) => {
      console.log(data);
    });

    childProcess.stderr?.on('data', (data) => {
      console.error(data);
    });
  });

  const lines = await fs.readFile(outputPath, { encoding: 'utf8' });
  await fs.unlink(outputPath);

  return lines
    .split('\n')
    .map((line) => parseInt(line, 10))
    .filter((timestamp) => !isNaN(timestamp));
};

export async function run(message: Message) {
  // Get the battle participant row from the database
  const participant = await BattleParticipant.getById(message.battleParticipantId);
  if (!participant) {
    console.error(
      `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} not found!`,
    );
    return;
  }

  if (participant.battleId === null) {
    console.error(
      `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} seems to not be in a battle yet! Skipping...`,
    );
    return;
  }

  if (participant.twilioVideoRecordingId === null) {
    console.error(
      `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} has twilioVideoRecordingId set to null, skipping...`,
    );
    return;
  }

  if (participant.twilioAudioRecordingId === null) {
    console.error(
      `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} has twilioAudioRecordingId set to null, skipping...`,
    );
    return;
  }

  const battle = await Battle.getById(participant.battleId);
  if (!battle) {
    console.error(
      `[${message.battleParticipantId}] Unable to get battle ${participant.battleId}, which is associated with Battle Participant of id ${message.battleParticipantId}!`,
    );
    return;
  }

  const videoFileS3Key = `raw/${participant.twilioVideoRecordingId}.mkv`;
  const videoFilePath = `/tmp/${participant.twilioVideoRecordingId}.mkv`;

  const audioFileS3Key = `raw/${participant.twilioAudioRecordingId}.mka`;
  const audioFilePath = `/tmp/${participant.twilioAudioRecordingId}.mka`;

  const mergedFilePath = `/tmp/${participant.battleId}-${participant.id}.mkv`;

  const intermediateOutputFilePath = `/tmp/${participant.battleId}-${participant.id}-intermediate.mp4`;

  const outputFileKey = `encoded/${participant.battleId}/${participant.id}.mp4`;
  const outputFilePath = `/tmp/${participant.battleId}-${participant.id}.mp4`;
  const outputThumbnailPathsKeysBySize = new Map(
    THUMBNAIL_SIZES_PIXELS.map((size) => [
      size,
      [
        `/tmp/${participant.battleId}-${participant.id}-${size}.jpg`,
        `encoded/${participant.battleId}/${participant.id}-${size}.jpg`,
      ],
    ]),
  );

  try {
    // Register the video as beginning to process
    await BattleParticipant.updateProcessedVideoStatus(participant, 'DOWNLOADING');
    console.log(
      `[${participant.id}] Downloading source videos ${videoFileS3Key} and ${audioFileS3Key}...`,
    );

    // Download video and audio files from object storage
    await Promise.all([
      downloadFileFromObjectStorage(videoFileS3Key, videoFilePath),
      downloadFileFromObjectStorage(audioFileS3Key, audioFilePath),
    ]);

    await BattleParticipant.updateProcessedVideoStatus(participant, 'MERGING');

    console.log(`[${participant.id}] Start merging video and audio files with mkvmerge...`);

    // Use mkvmerge to combine together the video and audio track
    //
    // NOTE: Doing this with ffmpeg is possible, but results in the audio and video tracks being
    // misaligned for some unknown reason...
    const mkvMergePath = await getMkvMergePath();
    await new Promise<void>((resolve, reject) => {
      const childProcess = execFile(
        mkvMergePath,
        ['--output', mergedFilePath, videoFilePath, audioFilePath],
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );

      childProcess.stdout?.on('data', (data) => {
        console.log(data);
      });

      childProcess.stderr?.on('data', (data) => {
        console.error(data);
      });
    });

    await BattleParticipant.updateProcessedVideoStatus(participant, 'ANALYZING');
    console.log(`[${participant.id}] Begining to analyize merged video and audio data...`);

    // NOTE: The mkv and mka audio files being output by twilio video are quite messed up. According
    // the twilio video, the files are "optimized for compactness"
    // (ref: https://www.twilio.com/docs/video/api/recordings-resource#get-media-subresource), which
    // unfortunately ffmpeg is seems to be unable to understand due to a buggy / incorrect matroska
    // implementation in ffmpeg.
    // Longer explaination here: https://madebybread.slack.com/archives/C04RFG9S1B7/p1689985927267249?thread_ts=1689984604.875249&cid=C04RFG9S1B7
    //
    // So instead, I've had to implement some admittedly kinda crazy logic to try to "reconstruct
    // the audio in post" where by it reads the audio track from the merged mkv, extracts out the
    // sections of the audio file, and places them into the right places to simulate what the output
    // from ffmpeg SHOULD have been if it processed the original data correctly.

    const timestamps = await getMkaTimestamps(participant.id, audioFilePath);
    const audioFileInitialOffsetMilliseconds = timestamps.length > 0 ? timestamps[0] : 0;
    const audioFileLengthMilliseconds = (timestamps.length > 0 && timestamps.at(-1)) || 0;

    let continousTimeRanges: Array<[number, number]> = [];
    let startIndex = -1;
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index];
      const previousTimestamp = index > 0 ? timestamps[index - 1] : null;

      if (previousTimestamp === null) {
        startIndex = index;
        continue;
      }

      // If there is over a 500ms difference between the two timestamps, then consider it a
      // discontinuity
      if (timestamp - previousTimestamp < 500) {
        continue;
      }

      const endIndex = index - 1;
      continousTimeRanges.push([timestamps[startIndex], timestamps[endIndex]]);
      startIndex = index;
    }
    // If at least one timestamp has been processed, then add the "final" continuous region up until
    // the end of the list
    if (startIndex >= 0) {
      continousTimeRanges.push([timestamps[startIndex], timestamps[timestamps.length - 1]]);
    }
    console.log(
      `[${participant.id}] Continuous audio time ranges in mka audio:`,
      continousTimeRanges,
    );

    // Compute the time that participant in question initially went into the WARM_UP state - this is
    // the point in the battle workflow where they should have first initially become unmuted
    const firstWarmUpCheckin = battle.participants
      .find((p) => p.id === participant.id)
      ?.checkins?.find((c) => c.state === 'WARM_UP');
    let audioStartsAtMilliseconds: number | null = null;
    if (!firstWarmUpCheckin) {
      console.log(
        `[${participant.id}] Unable to find a WARM_UP checkin for participant ${participant.id}! Omitting audio from video stream...`,
      );
    } else if (firstWarmUpCheckin.videoStreamOffsetMilliseconds === null) {
      console.log(
        `[${participant.id}] First WARM_UP checkin for participant ${participant.id} has a null 'videoStreamOffsetMilliseconds' value, using first timestamp in audio file as this value instead...`,
      );
      if (timestamps.length > 0) {
        audioStartsAtMilliseconds = timestamps[0];
      } else {
        console.log(
          `[${participant.id}] No timestamp data found! Omitting audio from video stream...`,
        );
      }
    } else {
      audioStartsAtMilliseconds = firstWarmUpCheckin.videoStreamOffsetMilliseconds;
    }

    const playableVideoMillisecondsRange = await Battle.calculatePlayableVideoMillisecondsRange(
      battle,
    );
    const millisecondsFromStartOfVideoToFirstWarmUp = playableVideoMillisecondsRange
      ? playableVideoMillisecondsRange[0]
      : null;
    const millisecondsFromStartOfVideoToComplete = playableVideoMillisecondsRange
      ? playableVideoMillisecondsRange[1]
      : null;
    if (
      millisecondsFromStartOfVideoToFirstWarmUp !== null &&
      millisecondsFromStartOfVideoToComplete !== null
    ) {
      console.log(
        `[${participant.id}] Playable region of battle: ${millisecondsFromStartOfVideoToFirstWarmUp}ms to ${millisecondsFromStartOfVideoToComplete}ms`,
      );
    }

    await BattleParticipant.updateProcessedVideoStatus(
      participant,
      'ENCODING',
      undefined,
      millisecondsFromStartOfVideoToFirstWarmUp || 0,
    );
    console.log(`[${participant.id}] Start encoding the video file with ffmpeg...`);

    // Encode the merged mkv into a mp4 that can be played on a phone
    await new Promise<void>((resolve, reject) => {
      // ffmpeg -i /Users/ryan/Downloads/out1.mkv -f lavfi -i "sine=frequency=0:duration=103.168" -ss 0 -t 51.462 -i /Users/ryan/Downloads/out1.mkv -ss 82.797 -t 20.371 -i /Users/ryan/Downloads/out1.mkv -filter_complex '[2:a]areverse,apad=pad_dur=11.149s,areverse,apad[2pad];[3:a]areverse,apad=pad_dur=93.946s,areverse,apad[3pad];[1:a][2pad][3pad]amerge=inputs=3[merged];[merged]volume=1[out]' -map '[out]' -map '0:v' -r 24 test.mp4
      let instance = ffmpeg();

      // Source 0: Merged video stream
      instance.input(mergedFilePath);

      // Source 1: An empty block of audio (a 0 frequency sin wave)
      //
      // This fills up the whole audio track with "filler data" so that the audio track will take up
      // the same duration ad the video track.
      // ref: https://superuser.com/questions/724391/how-to-generate-a-sine-wave-with-ffmpeg
      instance
        .input(`sine=frequency=0:duration=${audioFileLengthMilliseconds / 1000}`)
        .inputOption(['-f', 'lavfi']);

      // Source(s) 2 to infinity: One per continuous time range of audio
      for (const [start, end] of continousTimeRanges) {
        if (!audioStartsAtMilliseconds) {
          continue;
        }
        const startMilliseconds =
          start - audioFileInitialOffsetMilliseconds + audioStartsAtMilliseconds;
        const rangeLengthMilliseconds = end - start;

        instance
          .input(mergedFilePath)
          .inputOption(['-ss', `${startMilliseconds / 1000}`])
          .inputOption(['-t', `${rangeLengthMilliseconds / 1000}`]);
      }

      // For each continuous time range (sources 2 to infinity), do some preprocessing:
      // 1. Pad the start of each audio snippet so that it is located in the right place in the output
      // 2. Pad the end of the audio snippet to go out to the end of the audio data (this goes to
      //    the end of that "empty" block of sine wave audio)
      let preprocessedContinuousAudioSegmentRules = [];
      for (let index = 0; index < continousTimeRanges.length; index += 1) {
        if (!audioStartsAtMilliseconds) {
          continue;
        }
        const start = continousTimeRanges[index][0];
        const audioOffsetInOutputMilliseconds =
          start - audioFileInitialOffsetMilliseconds + audioStartsAtMilliseconds;
        preprocessedContinuousAudioSegmentRules.push(
          `[${index + 2}:a]areverse,apad=pad_dur=${
            audioOffsetInOutputMilliseconds / 1000
          }s,areverse,apad[${index + 2}pad]`,
        );
      }

      instance
        .complexFilter([
          ...preprocessedContinuousAudioSegmentRules,

          // Finally, take all those preprocessed audio samples and merge them together into [out]
          `[1:a]${preprocessedContinuousAudioSegmentRules
            .map((_, index) => `[${index + 2}pad]`)
            .join('')}amerge=inputs=${preprocessedContinuousAudioSegmentRules.length + 1}[out]`,
        ])
        // Use the output of the complex filter as the output audio channel
        .map('[out]')

        // Proxy through the video from source 0 as the video track
        //
        // NOTE: For some reason, `.map` always surrounds its parameter in square brackets. If
        // these 0:a and 1:a options are surrounded in square brackets, the ffmpeg command fails,
        // and I am not sure why.
        .withOptions(['-map', '0:v'])

        .withVideoCodec('libx264')
        .withOutputOptions(['-crf', '28'])
        .fpsOutput(24)

        .withAudioCodec('aac')
        .withAudioChannels(2)
        .withAudioFrequency(48_000)

        .output(intermediateOutputFilePath)
        .on('end', () => resolve())
        .on('error', (err: Error, stdout: string, stderr: string) => {
          console.error('Error encoding video (part 1)!');
          console.log(stdout);
          console.error(stderr);
          reject(err);
        })
        .run();
    });

    console.log(`[${participant.id}] Truncating battle around playable region...`);
    await new Promise<void>((resolve, reject) => {
      const instance = ffmpeg();

      instance.input(intermediateOutputFilePath);
      if (millisecondsFromStartOfVideoToFirstWarmUp !== null) {
        instance.inputOption(['-ss', `${millisecondsFromStartOfVideoToFirstWarmUp / 1000}`]);
        if (millisecondsFromStartOfVideoToComplete !== null) {
          instance.inputOption([
            '-t',
            `${
              (millisecondsFromStartOfVideoToComplete - millisecondsFromStartOfVideoToFirstWarmUp) /
              1000
            }`,
          ]);
        }
      }

      instance
        .withVideoCodec('copy')
        .withAudioCodec('copy')
        .output(outputFilePath)
        .on('end', () => resolve())
        .on('error', (err: Error, stdout: string, stderr: string) => {
          console.error('Error encoding video (part 2)!');
          console.log(stdout);
          console.error(stderr);
          reject(err);
        })
        .run();
    });

    await BattleParticipant.updateProcessedVideoStatus(participant, 'GENERATING_THUMBNAILS');

    const generatedThumbnailPathsAndKeys: Array<[string, string]> = [];
    for (const size of THUMBNAIL_SIZES_PIXELS) {
      console.log(`[${participant.id}] Generating ${size}x${size} thumbnail...`);
      const outputThumbnailPathKey = outputThumbnailPathsKeysBySize.get(size);
      if (!outputThumbnailPathKey) {
        continue;
      }
      const [outputThumbnailPath, outputThumbnailKey] = outputThumbnailPathKey;

      const generateThumbnailAtOffsetMilliseconds =
        (firstWarmUpCheckin?.videoStreamOffsetMilliseconds || 0) +
        THUMBNAIL_OFFSET_FROM_WARM_UP_MILLISECONDS;

      // Generate the thumbnail image
      await new Promise<void>((resolve, reject) => {
        // ffmpeg -y -ss 00:00:16.00 -i ~/Downloads/output.mp4 -vf "crop=w='min(min(iw\,ih)\,512)':h='min(min(iw\\,ih)\\,512)',scale=64:64,setsar=1" -vframes 1 ~/Downloads/output.jpg
        ffmpeg()
          .input(intermediateOutputFilePath)

          // Pick the point in the video that the thumbnail should be extracted from
          .inputOption(['-ss', `${generateThumbnailAtOffsetMilliseconds / 1000}`])

          .videoFilters([
            // Center crop the battle video to be square (think `background-size: cover;`) inside a
            // 512x512 box before scaling down the image to make the thumbnail
            // ref: https://stackoverflow.com/a/63856839/4115328
            `crop=w='min(min(iw\\,ih)\\,512)':h='min(min(iw\\,ih)\\,512)',scale=${size}:${size},setsar=1`,
          ])
          .withFrames(1) // -vframes 1
          .output(outputThumbnailPath)
          .on('end', () => resolve())
          .on('error', (err: Error, stdout: string, stderr: string) => {
            console.error(`Error generating thumbnail of size ${size}`);
            console.log(stdout);
            console.error(stderr);
            reject(err);
          })
          .run();
      });

      generatedThumbnailPathsAndKeys.push([outputThumbnailPath, outputThumbnailKey]);

      // Store the thumbnail into the database
      await prisma.$transaction([
        // Get rid of any pre-existing thumbnail records that may exist for the given size
        prisma.battleParticipantThumbnail.deleteMany({
          where: { battleParticipantId: participant.id, size },
        }),
        // Then create a new one of that given size
        prisma.battleParticipantThumbnail.create({
          data: {
            size,
            fromVideoStreamOffsetMilliseconds: generateThumbnailAtOffsetMilliseconds,
            battleParticipantId: participant.id,
            key: outputThumbnailKey,
          },
        }),
      ]);
    }

    await BattleParticipant.updateProcessedVideoStatus(participant, 'UPLOADING');
    console.log(`[${participant.id}] Uploading final mp4 to ${outputFileKey}...`);

    // Upload the combined file back to S3
    await RecordingsObjectStorage.putFromFilesystem(outputFileKey, outputFilePath);

    // Upload any generated thumbnails to s3
    for (const [path, key] of generatedThumbnailPathsAndKeys) {
      await RecordingsObjectStorage.putFromFilesystem(key, path);
    }

    // Clean up all temp file artifacts
    await fs.unlink(videoFilePath);
    await fs.unlink(audioFilePath);
    await fs.unlink(mergedFilePath);
    await fs.unlink(intermediateOutputFilePath);
    await fs.unlink(outputFilePath);
    for (const [path] of generatedThumbnailPathsAndKeys) {
      await fs.unlink(path);
    }

    console.log(`[${participant.id}] Encoding complete!`);
    await BattleParticipant.updateProcessedVideoStatus(participant, 'COMPLETED', outputFileKey);
  } catch (err) {
    console.error(`[${message.battleParticipantId}] Error processing video: ${err}`);

    // Mark the video as failing to process
    await BattleParticipant.updateProcessedVideoStatus(participant, 'ERROR');
  }

  // Once processing all participant videos associated with the battle is complete, generate the
  // battle video
  const updatedBattle = await Battle.getById(battle.id);
  if (updatedBattle) {
    const allParticipantVideosProcessed = updatedBattle.participants.every(
      (participant) => participant.processedVideoStatus === 'COMPLETED',
    );
    if (allParticipantVideosProcessed) {
      console.log(
        `[${message.battleParticipantId}] All ${updatedBattle.participants.length} participant(s) (including ${message.battleParticipantId}) of battle ${updatedBattle.id} have a processed video, so enqueing generating a video export automatically for battle ${updatedBattle.id}!`,
      );
      Battle.beginGeneratingVideoExport(updatedBattle);
    }
  }
}

export function getWorker() {
  return new Worker(
    WORKER_NAME,
    async (job) => {
      try {
        await run(job.data);
      } catch (err) {
        console.error(err);
      }
    },
    { connection: redisConnection },
  );
}
