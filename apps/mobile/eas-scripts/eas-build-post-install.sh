#!/bin/bash

# Make sure that this script runs within apps/mobile
cd $(dirname $(dirname $0))

echo "All packages:"
pnpm ls --depth 1
echo "----------"

echo "React native locations":
pnpm why react-native
echo "----------"

if [[ "$EAS_BUILD_PLATFORM" = "ios" ]]; then
  echo "Node locations:"
  echo "command -v node: $(command -v node)"
  echo "which node: $(which node)"
  echo "echo \$PATH: $(echo $PATH)"
  echo "cat ios/.xcode.env:"
  cat ios/.xcode.env || true

  echo "Updating node binary in .xcode.env:"
  echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env
  echo "Done"
fi

if [[ "$EAS_BUILD_PLATFORM" = "android" ]]; then
  echo "PWD:"
  pwd
  ls android/app/build.gradle
  echo "-----"

  for p in eas-scripts/build-gradle-*.patch; do
    echo "Applying $p:"
    patch android/app/build.gradle < "$p"
  done
fi


# if [[ "$EAS_BUILD_PLATFORM" = "android" ]]; then
#   echo "Run commands for Android builds here"
# npx expo prebuild --no-install -p android
# # $ echo 'android.enableShrinkResourcesInReleaseBuilds=false' >> android/gradle.properties
# # $ echo 'android.useAndroidX=true' >> android/gradle.properties
# # $ echo 'android.enableJetifier=true' >> android/gradle.properties           
# # $ echo 'org.gradle.jvmargs=-Xmx4096M' >> android/gradle.properties                                                                                          
# # $                                                                             
# $ # Finally, apply https://stackoverflow.com/a/72929836/4115328 to `android/app.build.gradle`
# $ vi android/app/build.gradle                                                 
# $                             
# $ # Now, to build, open android studio, and follow this: https://stackoverflow.com/questions/19619753/how-to-build-a-release-apk-in-android-studio
# $ npm run open:android
# react-native build-android --mode=release 
# fi
