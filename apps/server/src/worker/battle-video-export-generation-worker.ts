import { Queue, Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

import { BASE_PROJECT_DIRECTORY } from '../config.ts';
import { redisConnection } from '../lib/redis.ts';
import { RecordingsObjectStorage } from '../lib/object-storage.ts';
import Battle, { BattleWithParticipants } from '../lib/battle.ts';
import prisma from '../lib/prisma.ts';

const WORKER_NAME = 'battle-video-export-generation';

// The width and height of each battle video in the export
const BATTLE_PARTICIPANT_VIDEO_SIZE_PX = 768;
const BATTLE_PARTICIPANT_FINAL_EXPORT_WIDTH_PX = BATTLE_PARTICIPANT_VIDEO_SIZE_PX;
const BATTLE_PARTICIPANT_FINAL_EXPORT_HEIGHT_PX = BATTLE_PARTICIPANT_VIDEO_SIZE_PX * 2;

// Configuration around how the watermarks should be rendered
// The "top watermark" is the little barz logo:
const WATERMARK_TOP_WIDTH_PX = BATTLE_PARTICIPANT_VIDEO_SIZE_PX / 5;
const WATERMARK_TOP_HEIGHT_PX = WATERMARK_TOP_WIDTH_PX / 2;
const WATERMARK_TOP_X_PX = 32;
const WATERMARK_TOP_Y_PX = BATTLE_PARTICIPANT_VIDEO_SIZE_PX - WATERMARK_TOP_HEIGHT_PX - 32;
const WATERMARK_TOP_OPACITY = 1;

// The "bottom watermark" is the gradient bar with the rapbattleapp.com text on it:
const WATERMARK_BOTTOM_WIDTH_PX = BATTLE_PARTICIPANT_FINAL_EXPORT_WIDTH_PX;
const WATERMARK_BOTTOM_HEIGHT_PX = WATERMARK_BOTTOM_WIDTH_PX * 0.25;
const WATERMARK_BOTTOM_X_PX = 0;
const WATERMARK_BOTTOM_Y_PX = BATTLE_PARTICIPANT_VIDEO_SIZE_PX;
const WATERMARK_BOTTOM_OPACITY = 1;

// The "end screen watermark" is the image on the end screen with the app store badges:
const END_SCREEN_LENGTH_MILLISECONDS = 3000;
const WATERMARK_END_SCREEN_WIDTH_PX = BATTLE_PARTICIPANT_FINAL_EXPORT_WIDTH_PX * 0.5;
const WATERMARK_END_SCREEN_HEIGHT_PX = (WATERMARK_END_SCREEN_WIDTH_PX / 772) * 1204;
const WATERMARK_END_SCREEN_X_PX =
  (BATTLE_PARTICIPANT_FINAL_EXPORT_WIDTH_PX - WATERMARK_END_SCREEN_WIDTH_PX) / 2;
const WATERMARK_END_SCREEN_Y_PX =
  (BATTLE_PARTICIPANT_FINAL_EXPORT_HEIGHT_PX - WATERMARK_END_SCREEN_HEIGHT_PX) / 2;
const WATERMARK_END_SCREEN_OPACITY = 1;


// The battle export thumbnail is the thumbnail image generated to be used when showing the battle
// export

const THUMBNAIL_SIZES_PIXELS = [32, 64, 128, 256, 512];
const THUMBNAIL_LOGO_OPACITY = 1;
const THUMBNAIL_LOGO_SIZE_CUTOFF = 64; // Thumbnails above the cutoff in size are `LARGE`, otherwise are `SMALL`
const THUMBNAIL_LOGO_SMALL_SCALE_RATIO = 0.85;
const THUMBNAIL_LOGO_LARGE_SCALE_RATIO = 0.5;

type Message = {
  version: 1;
  type: 'GENERATE_BATTLE_EXPORT_VIDEO';
  battleId: Battle['id'];
};

const queue = new Queue(WORKER_NAME, { connection: redisConnection });

// When called, enqueue a message to take the given participant and generate a video of their time
// while in a battle
export async function queueEventToGenerateBattleVideoExport(battle: Battle) {
  const message: Message = {
    version: 1,
    type: 'GENERATE_BATTLE_EXPORT_VIDEO',
    battleId: battle.id,
  };
  await queue.add('generate-battle-export-video', message, {
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

export async function run(message: Message) {
  // Get the battle row from the database
  const battle = await Battle.getById(message.battleId);
  if (!battle) {
    console.error(`[${message.battleId}] Battle with id ${message.battleId} not found!`);
    return;
  }

  const participantsInExport: Array<BattleWithParticipants['participants'][0]> = [];
  for (let index = 0; index < battle.participants.length; index += 1) {
    const participant = battle.participants[index];

    // Make sure that the participant video has finished processing successfully
    if (participant.processedVideoStatus !== 'COMPLETED') {
      console.error(
        `[${message.battleId}] Battle Participant with id ${participant.id} has processedVideoStatus not set to COMPLETED - has this video been processed yet? Skipping...`,
      );
      return;
    }
    if (participant.processedVideoCompletedAt === null) {
      console.error(
        `[${message.battleId}] Battle Participant with id ${participant.id} has processedVideoCompletedAt set to null - has this video been processed yet? Skipping...`,
      );
      return;
    }

    if (index > 2) {
      console.error(
        `[${message.battleId}] WARNING: Battle Participant with id ${participant.id} is of index ${index} - only participants with index 0 and 1 will be shown in the export!`,
      );
      continue;
    }
    participantsInExport.push(participant);
  }
  if (participantsInExport.length < 2) {
    console.error(
      `[${message.battleId}] Battle only has ${participantsInExport.length} participant(s), which is under the minimum of 2 needed to generate an export! skipping...`,
    );
    return;
  }

  const [participantA, participantB] = participantsInExport;

  const participantAFileKey = participantA.processedVideoKey;
  if (participantAFileKey === null) {
    console.error(
      `[${message.battleId}] Battle Participant with id ${participantA.id} has processedVideoKey set to null, skipping...`,
    );
    return;
  }
  const participantAFilePath = `/tmp/${message.battleId}-${participantA.id}.mp4`;

  const participantBFileKey = participantB.processedVideoKey;
  if (participantBFileKey === null) {
    console.error(
      `[${message.battleId}] Battle Participant with id ${participantB.id} has processedVideoKey set to null, skipping...`,
    );
    return;
  }
  const participantBFilePath = `/tmp/${message.battleId}-${participantB.id}.mp4`;

  const outputFileKey = `export/${message.battleId}/export.mp4`;
  const outputFilePath = `/tmp/${message.battleId}-export.mp4`;
  const generatedThumbnailPathsAndKeys: Array<[string, string]> = [];

  const battleExportWatermarkTopPath = path.join(
    BASE_PROJECT_DIRECTORY,
    'src',
    'assets',
    'battle-export-watermark-top.png',
  );
  const battleExportWatermarkBottomPath = path.join(
    BASE_PROJECT_DIRECTORY,
    'src',
    'assets',
    'battle-export-watermark-bottom.png',
  );
  const battleExportWatermarkEndScreenPath = path.join(
    BASE_PROJECT_DIRECTORY,
    'src',
    'assets',
    'battle-export-watermark-end-screen.png',
  );
  const battleExportThumbnailLogoPath = path.join(
    BASE_PROJECT_DIRECTORY,
    'src',
    'assets',
    'battle-export-thumbnail-logo.png',
  );

  try {
    // Register the video as beginning to process
    await Battle.updateExportVideoStatus(battle, 'DOWNLOADING');
    console.log(
      `[${message.battleId}] Downloading source videos ${participantAFileKey} and ${participantBFileKey}...`,
    );

    // Download video and audio files from object storage
    await Promise.all([
      downloadFileFromObjectStorage(participantAFileKey, participantAFilePath),
      downloadFileFromObjectStorage(participantBFileKey, participantBFilePath),
    ]);

    await Battle.updateExportVideoStatus(battle, 'COMPOSITING');
    console.log(`[${message.battleId}] Start encoding the video file with ffmpeg...`);

    const maxVideoOffsetMilliseconds = Math.max(
      ...[participantA, participantB].map((p) => p.processedVideoOffsetMilliseconds),
    );

    // Encode the merged mkv into a mp4 that can be played on a phone
    await new Promise<void>((resolve, reject) => {
      // ffmpeg \
      //   -ss 12 -t 80 -i /Users/ryan/Downloads/cljq4rt8j010gtg0gqcb1510rMUTED.mp4 \
      //   -ss 12 -t 80 -i /Users/ryan/Downloads/cljq4re7p00zwtg0gdnr2e60jMUTED.mp4 \
      //   -i ./barz.png \
      //   -filter_complex "
      //     [0:v]crop=w='min(min(iw\,ih)\,500)':h='min(min(iw\,ih)\,500)',scale=500:500,setsar=1[a];
      //     [1:v]crop=w='min(min(iw\,ih)\,500)':h='min(min(iw\,ih)\,500)',scale=500:500,setsar=1[b];
      //     [a][b]vstack,format=yuv420p[video];
      //     [2]crop=w='iw':h='ih',scale=200:200,format=rgba,colorchannelmixer=aa=0.5[logo];
      //     [video][logo]overlay=10:10[output]
      //   " \
      //   -map "[output]" -map "0:a" -map "1:a" \
      //   -c:v libx264 -crf 18 -ac 2 -vsync 2 together.mp4

      ffmpeg()
        // The TOP video goes first - with a seek flag so that the video starts at the proper time
        // to keep the two videos aligned
        .input(participantAFilePath)
        .seekInput(
          (maxVideoOffsetMilliseconds - participantA.processedVideoOffsetMilliseconds) / 1000,
        )

        // The BOTTOM video goes second - with a seek flag so that the video starts at the proper time
        // to keep the two videos aligned
        .input(participantBFilePath)
        .seekInput(
          (maxVideoOffsetMilliseconds - participantB.processedVideoOffsetMilliseconds) / 1000,
        )

        .input(battleExportWatermarkTopPath)
        .input(battleExportWatermarkBottomPath)
        .input(battleExportWatermarkEndScreenPath)

        // Combine all the inputs to create the export video
        .complexFilter([
          // Center crop both battle videos to be square (think `background-size: cover;`)
          // ref: https://stackoverflow.com/a/63856839/4115328
          `[0:v]crop=w='min(min(iw\\,ih)\\,${BATTLE_PARTICIPANT_VIDEO_SIZE_PX})':h='min(min(iw\\,ih)\\,${BATTLE_PARTICIPANT_VIDEO_SIZE_PX})',scale=${BATTLE_PARTICIPANT_VIDEO_SIZE_PX}:${BATTLE_PARTICIPANT_VIDEO_SIZE_PX},setsar=1[a]`,
          `[1:v]crop=w='min(min(iw\\,ih)\\,${BATTLE_PARTICIPANT_VIDEO_SIZE_PX})':h='min(min(iw\\,ih)\\,${BATTLE_PARTICIPANT_VIDEO_SIZE_PX})',scale=${BATTLE_PARTICIPANT_VIDEO_SIZE_PX}:${BATTLE_PARTICIPANT_VIDEO_SIZE_PX},setsar=1[b]`,

          // Stack both videos vertically
          // ref: https://stackoverflow.com/a/51402015/4115328
          `[a][b]vstack,format=yuv420p[video]`,

          // Crop the top watermark image to be smaller, and make it partially transparent
          // ref: https://stackoverflow.com/a/10920872/4115328
          // ref: https://video.stackexchange.com/a/4571
          `[2]crop=w='iw':h='ih',scale=${WATERMARK_TOP_WIDTH_PX}:${WATERMARK_TOP_HEIGHT_PX},format=rgba,colorchannelmixer=aa=${WATERMARK_TOP_OPACITY}[logotop]`,
          `[video][logotop]overlay=${WATERMARK_TOP_X_PX}:${WATERMARK_TOP_Y_PX}[vintermediate]`,

          // Crop the bottom watermark image to be the right size, and make it partially transparent
          // ref: https://stackoverflow.com/a/10920872/4115328
          // ref: https://video.stackexchange.com/a/4571
          `[3]crop=w='iw':h='ih',scale=${WATERMARK_BOTTOM_WIDTH_PX}:${WATERMARK_BOTTOM_HEIGHT_PX},format=rgba,colorchannelmixer=aa=${WATERMARK_BOTTOM_OPACITY}[logobottom]`,
          `[vintermediate][logobottom]overlay=${WATERMARK_BOTTOM_X_PX}:${WATERMARK_BOTTOM_Y_PX}[vbattle]`,

          // Create the end screen by positioning the end screen watermark image in the center of
          // the video viewport...
          `[4]crop=w='iw':h='ih',scale=${WATERMARK_END_SCREEN_WIDTH_PX}:${WATERMARK_END_SCREEN_HEIGHT_PX},format=rgba,colorchannelmixer=aa=${WATERMARK_END_SCREEN_OPACITY}[logoendscreen]`,
          // ... and then concat it with the main battle video
          // ref: https://video.stackexchange.com/a/29816
          `color=c=black:s=${BATTLE_PARTICIPANT_FINAL_EXPORT_WIDTH_PX}x${BATTLE_PARTICIPANT_FINAL_EXPORT_HEIGHT_PX}:r=24:d=${
            END_SCREEN_LENGTH_MILLISECONDS / 1000
          }[black]`,
          `[black][logoendscreen]overlay=${WATERMARK_END_SCREEN_X_PX}:${WATERMARK_END_SCREEN_Y_PX}[vendscreen]`,
          `[vbattle][vendscreen]concat=n=2:v=1:a=0[vout]`,

          // Merge both audio tracks into a single audio track to include in the export
          `[0:a][1:a]amerge=inputs=2[aout]`,
        ])

        // Use the output of the complex filter as the output video and audio channels
        .map('[vout]')
        .map('[aout]')

        .withVideoCodec('libx264')
        .withOutputOptions(['-crf', '28'])
        .fpsOutput(24)

        .withAudioCodec('aac')
        .withAudioChannels(2)
        .withAudioFrequency(48_000)

        .format('mp4')
        .output(outputFilePath)
        .on('end', () => resolve())
        .on('error', (err: Error, stdout: string, stderr: string) => {
          console.error('Error encoding video!');
          console.log(stdout);
          console.error(stderr);
          reject(err);
        })
        .run();
    });

    await Battle.updateExportVideoStatus(battle, 'GENERATING_THUMBNAILS');
    console.log(`[${message.battleId}] Checking to see if an export thumbnail can be generated...`);

    const participantAThumbnail = await prisma.battleParticipantThumbnail.findFirst({
      where: {
        battleParticipantId: participantA.id,
      },
      orderBy: { size: 'desc' },
    });
    const participantBThumbnail = await prisma.battleParticipantThumbnail.findFirst({
      where: {
        battleParticipantId: participantB.id,
      },
      orderBy: { size: 'desc' },
    });
    if (participantAThumbnail && participantBThumbnail) {
      console.log(`[${message.battleId}] Downloading ${participantAThumbnail.key} and ${participantBThumbnail.key} from object storage...`);
      const participantAThumbnailPath =  `/tmp/${battle.id}-${participantA.id}.jpg`;
      const participantBThumbnailPath =  `/tmp/${battle.id}-${participantB.id}.jpg`;
      await Promise.all([
        downloadFileFromObjectStorage(participantAThumbnail.key, participantAThumbnailPath),
        downloadFileFromObjectStorage(participantBThumbnail.key, participantBThumbnailPath),
      ]);

      for (const size of THUMBNAIL_SIZES_PIXELS) {
        console.log(`[${message.battleId}] Generating ${size}x${size} export thumbnail...`);
        const outputThumbnailPath = `/tmp/${battle.id}-${size}.jpg`;
        const outputThumbnailKey = `export/${battle.id}/export-${size}.jpg`;

        const scaleRatio = size <= THUMBNAIL_LOGO_SIZE_CUTOFF ? THUMBNAIL_LOGO_SMALL_SCALE_RATIO : THUMBNAIL_LOGO_LARGE_SCALE_RATIO;

        // Generate the export thumbnail image
        await new Promise<void>((resolve, reject) => {
          // ffmpeg \
          //   -i /Users/ryan/Downloads/clnt1hf10001st00gh72wzunz-512.jpg \
          //   -i /Users/ryan/Downloads/clnt08qz201mqwg0gitt2y35r-512.jpg \
          //   -filter_complex "
          //    [0:v]crop=w='min(min(iw\,ih)\,250)':h='min(min(iw\,ih)\,500)',scale=250:500,setsar=1[a];
          //    [1:v]crop=w='min(min(iw\,ih)\,250)':h='min(min(iw\,ih)\,500)',scale=250:500,setsar=1[b];
          //    [a][b]hstack[output];
          //   " \
          //   -map "[output]" ~/Downloads/combined.jpg

          ffmpeg()
            .input(participantAThumbnailPath)
            .input(participantBThumbnailPath)
            .input(battleExportThumbnailLogoPath)
            .complexFilter([
              // Position both thumbnail images in a `size / 2` wide, `size` high box
              `[0:v]scale=${size}:${size},crop=w='min(min(iw\,ih)\,${size / 2})':h='min(min(iw\,ih)\,${size})',scale=${size / 2}:${size},setsar=1[a]`,
              `[1:v]scale=${size}:${size},crop=w='min(min(iw\,ih)\,${size / 2})':h='min(min(iw\,ih)\,${size})',scale=${size / 2}:${size},setsar=1[b]`,

              // Stack them horizontally to make a `size` by `size` image
              `[a][b]hstack[video]`,

              // If desired, render the barz logo in the middle, centered
              `[2]crop=w='iw':h='ih',scale=${size * scaleRatio}:${size * scaleRatio},format=rgba,colorchannelmixer=aa=${THUMBNAIL_LOGO_OPACITY}[logo]`,
              `[video][logo]overlay=${
                (size * (1 - scaleRatio)) / 2
              }:${
                (size * (1 - scaleRatio)) / 2
              }[output]`,
            ])

            .map('[output]')
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
          prisma.battleExportThumbnail.deleteMany({
            where: { battleId: battle.id, size },
          }),
          // Then create a new one of that given size
          prisma.battleExportThumbnail.create({
            data: {
              size,
              battleId: battle.id,
              key: outputThumbnailKey,
            },
          }),
        ]);
      }
    } else {
      console.log(`[${message.battleId}] Could not find source thumbnail images for participant ${participantA.id} and ${participantB.id}, skipping...`);
    }

    await Battle.updateExportVideoStatus(battle, 'UPLOADING');
    console.log(`[${message.battleId}] Uploading final mp4 to ${outputFileKey}...`);

    // Upload the combined file back to S3
    await RecordingsObjectStorage.putFromFilesystem(outputFileKey, outputFilePath);

    // Upload any generated thumbnails to s3
    for (const [path, key] of generatedThumbnailPathsAndKeys) {
      console.log(`[${message.battleId}] Uploading export thumbnail ${path} to ${key}...`);
      await RecordingsObjectStorage.putFromFilesystem(key, path);
    }

    // Clean up all temp file artifacts
    await fs.unlink(participantAFilePath);
    await fs.unlink(participantBFilePath);
    await fs.unlink(outputFilePath);

    console.log(`[${message.battleId}] Encoding complete!`);
    await Battle.updateExportVideoStatus(battle, 'COMPLETED', outputFileKey);
  } catch (err) {
    console.error(`[${message.battleId}] Error processing video: ${err}`);

    // Mark the video as failing to process
    await Battle.updateExportVideoStatus(battle, 'ERROR');
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
