import { requireNativeModule } from 'expo-modules-core';
const BarzTwilioVideo = requireNativeModule('BarzTwilioVideo');

export const resetFileModificationTime = (path: string) => {
  BarzTwilioVideo.resetFileModificationTime(path);
};
