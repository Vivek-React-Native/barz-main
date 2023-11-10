## Getting Started

```bash
$ npm install -g yarn # The expo-module-scripts requires yarn to be installed for it to work... ??
$ npm install -g pnpm
$
$ pnpm install # NOTE:Run from top level directory
$ cd apps/mobile
$ npx expo prebuild --no-install # Generate the `ios` and `android` directories
$ cd ios
$ pod install # Install ios dependencies
$ cd ..
$ npm run open:ios # Open xcode (behind the scenes, this opens `ios/BarzRapBattle.xcworkspace`)
$ # Press run in xcode!
$ # kill the default metro bundler that starts up
$ npm run start # to start the metro bundler in a separate terminal
```

`npm run check` to see typescript errors

- This shows transitive errors sometimes when the packages/barz-twilio-video package reloads. When
  this happens, restart the command and they should go away.

## Fetching new icons from figma

Run `npm run fetch-icons`. This uses a combination of the `figma-export-icons` and `svgr` npm
packages to generate react components for each icon as a svg that can be used in react native.

## Making a release

There are two primary ways to make a release: using EAS (expo application services), or locally.
There are pros and cons to both approaches but if in doubt, EAS is probably a good place to start.

## Making a release via EAS

As of early october 2023, there are a few different subcommands that can be run within this package
to kick off a EAS native build. The plan is to hopefully add a CI workflow that kicks off these
commands automatically:

```bash
$ npm run eas:build:ios # Make an ios build and publish it on the "preview" channel
$ npm run eas:build:android # Make an android build and publish it on the "preview" channel
$ npm run eas:build # Make an ios AND android build and publish it on the "preview" channel
$
$ npm run eas:build:ios:production # Make an ios build and publish it on the "production" channel
```

A few notes:

- Submitting EAS builds to testflight or apple / google for review must be done manually as of early
  october 2023 by running `npx eas submit [ARGS]` manually.
- As of early october 2023, when a build on the `preview` channel is submitted, it gets sent to
  everyone associated with the internal testflight build. This is Luke plus everyone at Bread.
- As of early october 2023, when a build on the `production` channel is submitted, it gets sent to
  everyone associated with the external testflight build. This group consists of a number of
  external testers that Luke has invited to use Barz. In the future, it's likely that this channel
  will be renamed and a newly made `production` channel will go to the apple app store.
- The build numbers are auto-incremented by Expo. However, if you want to manually update them,
  you can run `eas build:version:set`.

In addition, EAS allows one to build a javascript-only bundle that can be hot published to an
existing native app instance already running on a phone. The use case for this is for dynamically
updating app instances that are already out in the world without having to go through another app
review process.

```bash
$ npm run eas:update:ios # Build a javascript-only eas update bundle for ios and publish it to the "preview" channel
$ npm run eas:update:android # Build a javascript-only eas update bundle for android and publish it to the "preview" channel
$ npm run eas:update:ios:production # Build a javascript-only eas update bundle for ios and publish it to the "production" channel
$ npm run eas:update:android:production # Build a javascript-only eas update bundle for android and publish it to the "production" channel
```

After pushing an update, make sure you manually upload the source maps to Sentry.
https://docs.expo.dev/guides/using-sentry/#uploading-source-maps-for-updates

## Making releases locally

This requires using the ios and android native tools, and therefore can be more challenging, but
also gives one more insight into what is exactly happening.

### Android - Making a release

```bash
$ # Generate an `android` directory
$ npx expo prebuild --no-install -p android
$
$ # Add properties to android/gradle.properties
$ echo >> android/gradle.properties
$ echo 'android.enableShrinkResourcesInReleaseBuilds=false' >> android/gradle.properties
$ echo 'android.useAndroidX=true' >> android/gradle.properties
$ echo 'android.enableJetifier=true' >> android/gradle.properties
$ echo 'org.gradle.jvmargs=-Xmx4096M' >> android/gradle.properties
$
$ # Finally, apply https://stackoverflow.com/a/72929836/4115328 to `android/app.build.gradle`
$ vi android/app/build.gradle
$
$ # Now, to build, open android studio, and follow this: https://stackoverflow.com/questions/19619753/how-to-build-a-release-apk-in-android-studio
$ npm run open:android
react-native build-android --mode=release
```

### iOS - Making a crappy release

```bash
$ # Generate an `ios` directory
$ npx expo prebuild --no-install
$ cd ios
$ pod install
$ cd ..
$ # Open xcode
$ npm run open:ios
```

Now, in xcode, go to `Product` => `Archive` to create an ipa.

Once this is complete, the `Organizer` window should automatically open. If it doesn't, go to
`Window` => `Organizer` to open it. Make sure your archive you just made is selected, and click
`Distribute App` - then follow the wizard.

## Testing

Barz has an extensive detox test suite. [Detox](https://github.com/wix/Detox) is an end to end
testing tool written by Wix. It's a lot like Cypress or Playwright for web app testing, but a little
less refined IMO.

There is a bunch of mock related logic that is implemented through running a pair of local http
servers that the app connects to, one on port `:8000` (the mock barz server) and one on port `:8001`
(a socket.io server used for "command and control", but primarily though for simulating pusher
events). For more info, look at these files: `e2e/utils/mock-*.js`.

### Running the tests locally

```
$ brew tap wix/brew
$ brew install applesimutils

$ # Make sure to stop the barz server, and rerun it like the below:
$ DETOX_ENABLED=true npm start
$ # Then, in another terminal, run:
$ npm test
```

Note that some tests will open an instance of chrome to interact with web pages - an example of this
are for some of the oauth sign in related tests.

### Test Concurrency

Right now, the tests must be run in series and only one instance of the tests can be run at a
time. This is because they rely on a few things that are global / shared:

- A detox test specific clerk instance (`Barz Detox Test`) and a preconfigured user within that
  instance - see `e2e/utils/mock-sign-in.js` to change this.
- The MockSMSReceiver (`e2e/utils/mock-sms-receiver.js`) facilitates receiving OTP codes. If two
  test runners were to be running concurrently, they could potentially receive each other's codes!
  This isn't a super high probability but it's definitely possible.
- When signing in via the test google account to check oauth works, if signing in in a new / unusual
  location, the test may fail due to the google sign in requiring a second factor to sign in. To get
  this to work in an automated fashion, it may be required to either mock more of the google sign in
  process (ie, possibly receiving a 2fa code somehow?) or figuring out how to mock oauth at a deeper
  level to not require a real google account.

At some point, fixing these issues will need to happen. The `MockSMSReceiver` probably needs to use
a more reliable service for generating SMS codes like twilio (and then each test run could request its
own unrelated phone number). And maybe a new clerk instance should be generated at the start of each
test run or one per branch / environment or something.
