# Barz Server

The Barz Server exposes a number of REST-like resources for mobile clients to utilize to orchestrate
the battle workflow.

Artitecture diagram overview: https://www.figma.com/file/U7vUXyxVLBavxWLrJaIX8T/Barz-System-Diagram?type=whiteboard&node-id=0-1&t=Y14lDrrHSQbLFfS8-0

If you would like access, reach out to `@ryan` on the bread slack, or email `ryan@bread.works`

## Getting Started
```bash
$ # Clone the repository
$ git clone git@github.com:MadeByBread/barz-server.git
$ cd barz-server
$
$ # Install dependencies
$ pnpm install
$
$ npx prisma generate
```

Prior to starting the server, you will need to configure a number of environment variables. They are
all enumerated in `.env.example`, so copy this file to be `.env` (this file is not checked in to
version control), and then update all the relevant variables:
```
$ cp .env.example .env
$ vim .env
$ # Update environment variable values in .env!
```

Barz's server depends on postgres and redis. If you have docker running locally, then the below two
commands will start a postgres and redis container locally that expose themselves on port `5432` and
`6379` respectively. If you don't have docker locally, you'll need to set up postgres and redis some
other way:
```bash
$ # Start database and redis instance
$ npm run start:db
$ npm run start:redis
```

Finally, before running the server, you'll need to generate some fixture data for the app to work
properly:
```
$ npm run setup:fixtures
```

There are two main targets that need to be run for the Barz server to function:
- The main web server, which is run with `npm start`, and by default listens on port `8000`
  (configurable with the `PORT` environment variable). This is the process that mobile devices
  communicate with over HTTP to report on battle progress.
- The worker process, which is run with `npm run start:worker`. This is a
  [bullmq](https://bullmq.io/) worker that listens to messages sent to it from the main web server,
  and runs longer deferred tasks in the background. Bullmq uses redis to signal between the server
  instance(s) and worker instance(s), and this process should be safe to horizontally scale.

```bash
$ # Run the server
$ npm start
> barz-server@1.0.0 start
-> Listening on port 8000
-> Listening externally on: https://6443-75-150-133-133.ngrok-free.app
$
$ # Run the worker for deferred tasks
$ npm run start:worker
Started worker(s)!
```

#### Running the tests
To verify the tests still pass after making changes, run `npm test`:
```bash
$ npm test
```

#### Getting a node.js REPL with common utilities pre-imported
This is the equivilent of a "django shell" or "rails console":
```bash
$ npm run shell
> // Auto imports:
> import prisma from './lib/prisma.ts';
> import Battle from './lib/battle.ts';
> import BattleParticipant from './lib/battle-participant.ts';
> import User from './lib/user.ts';
> import BattleComment from './lib/battle-comment.ts';
> import Challenge from './lib/challenge.ts';
> import { BeatsObjectStorage, RecordingsObjectStorage } from './lib/object-storage.ts';
> // End auto imports
> 
```

#### Getting a psql prompt connected to your local database instance
This is the equivilent of a command like `./manage.py dbshell` in django. If you want to do this in
production / staging, there is a `heroku psql` command that does something very similar.
```bash
$ npm run shell:db
psql (13.10 (Debian 13.10-1.pgdg110+1))
Type "help" for help.

demo=# select count(*) from battle;
 count 
-------
  1082
(1 row)

demo=# 
```

#### A note on auth in local development:
There is an environment variable you can specify that will disable auth (or more accurately, assume
that every request is authed as the given user). This can be handy sometimes.

Here's an example:
```
$ MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID=user_2QG0L1YwoEbGiOdBPxNDlGNCRYR npm start
WARNING: MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID is set, which disabled auth for local development! This should never happen in production.
-> Listening on port 8000
-> Listening externally on: https://a224-75-150-133-133.ngrok-free.app
```

## Deployment
As of late september 2023, this server is hosted on heroku. Also as of late october 2023, there is
no continuous integration - deployment happens by running `git push` locally.

The way I set things up, I have two remotes locally that I can push to, one for staging, and one for
production:
```
$ git remote -v
heroku-production       https://git.heroku.com/barz-production.git (fetch)
heroku-production       https://git.heroku.com/barz-production.git (push)
heroku-staging  https://git.heroku.com/barz-staging.git (fetch)
heroku-staging  https://git.heroku.com/barz-staging.git (push)
```

Barz Server's production information:
- **Base URL**: https://api.rapbattleapp.com

Barz Server's staging information:
- **Base URL**: https://api-staging.rapbattleapp.com

## Video Encoding
There are two video encoding related jobs:
- `src/worker/battle-participant-video-generation-worker.ts` - For each battle participant, this job
  takes the `mkv` and `mka` artifacts in the "raw" directory of the recordings object storage
  bucket, combines them together, and outputs a mp4 representing the full video track for the
  participant into the "encoded" directory in the recordings object storage bucket.
- `src/worker/battle-video-export-generation-worker.ts` - Once the previous job completes for all
  participants, this job takes the resulting video files and combines them together with some visual
  effects to generate the video that a user can export from the app.

To test video encoding, you also need to have `mkvmerge` and `ffmpeg` installed, in addition to the
regular app dependencies.

The easiest way I have found to work on this job is to run the corresponding test(s) in the `tests`
directory since it puts input video files into the right places and kicks off things exactly as
twilio would via a webhook.

## Clerk
Clerk is a 3rd party service that manages user logins / logouts / storing user information.

In order to use the mobile app with a local version of the server, you will need to create a testing
clerk account, and then in the app, go to `user profile` => `settings` => `developer mode` (if not
visible, see the mobile app readme) => look under environment switcher for `local` => make sure that
the `clerk key` value is set to the clerk publishable key for your clerk instance.

There's an environment variable that needs to be set called CLERK_BASE64_ENCODED_PUBLIC_KEY. The way
I generated this was to follow the instructions in
https://clerk.com/docs/request-authentication/validate-session-tokens#instructions to get the public
key, but importantly, I DIDN'T follow the thing they were doing in that document to break up the
public key into sections. Instead, I base64 encoded the raw key, then put that in the environment
variable.

The other important thing to know about clerk is that there is a webhook configuration that needs to
be set up on clerk's end to talk to your local barz server instance so that it can send user creates
and updates to be synced into the `clerk_user` database table managed by prisma. The easiest way to
do this is to set the `NGROK_AUTHTOKEN` environment variable, and then put the generated ngrok url
into clerk. **If you don't do this, then you'll see an alert when signing in on the mobile app
saying something like "Error getting user data from server!"**.

## Object storage
Object storage is where Barz stores all raw battle participant recordings, final battle artifacts
for user playback, battle participant thumbnails, and backing tracks played during a battle

As of late september 2023, there two buckets:
- `beats` (in production, `s3://barz-beats-*`) stores all beat music files
- `recordings` (in production, `s3://barz-videos`) stores battle recordings in all stages of their
  lifecycle

This server implements an abstraction layer around storing data to object storage which means
that locally barz can utilize your filesystem instead of an external object storage provider like
amazon s3! This is enabled by default for local development (and when running tests), and this local
filesystem backed object storage implementation can be found in the `.local-object-storage` in the
project root.

## Twilio video configuration
Twilio video powers the video based elements of the Barz battling experience.

After configuring twilio video, clerk, and pusher locally, you should be able to select the "local"
environment in two copies of the barz mobile app and perform a battle locally. There is nothing that
is production / cloud hosted environment specific.

HOWEVER, the one catch to know about - when a battle finishes in a cloud hosted environment, twilio
video is / should be configured to write the resulting battle recordings to s3 (as of late september
2023, this is the only non-stock configuration that has been applied to twilio video). Because the
barz server by default uses the local filesystem-based object storage implementation, these video
files will obviously not be written to the right place, and that means that generating the videos
via the battle video generation process will fail.

So, if you want to go end to end, from starting a battle all the way to a final recording of the
battle all locally, you'll either need to:
1. Use the s3 backed object storage implementation, and have it point to the same remote bucket that
   twilio video is writing to
2. Log into the twilio video dashboard, find the latest recording(s), download the `mkv` and `mka`
   files (one of each per participant), place them in the corresponding places in your local object
   storage implementation, and then re-kick off the twilio video webhook that gets sent once the
   video recording is complete to regenerate the battle: `curl -X POST -d 'StatusCallbackEvent=recording-completed&Type=video&SourceSid=MT1bc4d3aa7b8e3d641d67cf324ac5c958' http://barz-staging.herokuapp.com/v1/battles/cliutztkz003gt70gyq0jg1gw/twilio-video-room-webhook` or `await BattleParticipant.beginTranscodingVideoForMobilePlayback(await BattleParticipant.getById('...'))` for each participant of the battle

I almost always do #2.

## Clout score debugger
If one is working on the clout score computation code, there exists a helpful visualization tool to
see the state of how the clout scores cascade. To give it a try, take a look at
`src/score-viewer.ts` or run `npm run shell:score-viewer`.

## Pusher events
When database rows are updated, certain events are sent to clients via [Pusher](https://pusher.io).
This allows clients to stay up to date as the battle progresses, and to be able to know the status
of the state machines on other mobile devices.

### `private-battle-[BATTLEID]` -> `battle.create`
This message is sent when a battle is created. The payload of the event is a serialized `Battle` row.

### `private-battle-[BATTLEID]` -> `battle.update`
This message is sent when a battle is updated. The payload of the event is a serialized `Battle` row.

### `private-battle-[BATTLEID]-events` -> `battle.event`
This message is sent when a new state machine event is created by a participant in the battle. The
payload of the event is a serialized `BattleParticipantStateMachineEvent` row.
**NOTE**: These events are ALSO sent over the webrtc socket channel that the video and audio data
gets sent over, but as a backup, they are also sent to the server. The messages have a client
generated uuid within them that allows any clients who receive the message to perform deduplication
and make sure each message is processed exactly once.

### `private-battle-[BATTLEID]-comments` -> `battleComment.create`
This message is sent when a new comment is left on a battle. The payload of the event is a serialized `BattleComment` row.

### `private-battle-[BATTLEID]-comments` -> `battleComment.update`
This message is sent when a comment is updated on a battle - generally the text of the comment changed.
The payload of the event is a serialized `BattleComment` row.

### `private-battle-[BATTLEID]-comments` -> `battleComment.delete`
This message is sent when a comment is soft-deleted on a battle. The payload of the event is `{ id: "battle comment id here" }`.

### `private-battle-[BATTLEID]-user-[USERID]-commentvotes` -> `battleCommentVote.create`
This message is sent when a user votes on a comment. The payload of the event is a serialized `BattleCommentVote` row.

### `private-battle-[BATTLEID]-user-[USERID]-commentvotes` -> `battleCommentVote.delete`
This message is sent when a user unvotes a comment. The payload of the event is `{ commentId: "battle comment id here" }`

### `private-battlevotearticipant-[BATTLEPARTICIPANTID]` -> `battleParticipant.create`
This message is sent when a battle participant is created. The payload of the event is a serialized `BattleParticipant` row.

### `private-battleparticipant-[BATTLEPARTICIPANTID]` -> `battleParticipant.update`
This message is sent when a battle participant is updated. The payload of the event is a serialized `BattleParticipant` row.

### `private-battleparticipant-[BATTLEPARTICIPANTID]-votes` -> `battleParticipantVote.create`
This message is sent when a new vote is created for a participant in a battle. The payload of the event is a serialized `BattleParticipantVote` row.

### `private-user-[USERID]` -> `user.update`
This message is sent when a user is updated. The payload of the event is a serialized `User` row.

### `private-user-[USERID]-follows` -> `userFollow.create`
This message is sent when the given user follows somebody new, or they themselves are followed.

### `private-user-[USERID]-follows` -> `userFollow.delete`
This message is sent when the given user unfollows somebody, or they themselves are unfollowed.

### `private-user-[USERID]-challenges` -> `challenge.create`
This message is sent when a new challenge is created - this message is sent to both users associated
with the challenge. The payload of the event is a serialized `Challenge` row.

### `private-user-[USERID]-challenges` -> `challenge.update`
This message is sent when a challenge is updated. The payload of the event is a serialized
`Challenge` row.

### `private-user-[USERID]-challenges` -> `challenge.requestCheckIn`
This message is sent when a user checks in to a challenge to the other user associated
with the challenge, and indicates that the server would like the this user to check in.
The payload of the event is `{ challengeId: "challenge id here" }`.
