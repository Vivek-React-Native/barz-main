import * as ImagePicker from 'expo-image-picker';

console.log('Loaded image-picker.detox.tsx! This should never happen in production.');

// Mock the `launchCameraAsync` function so that an image is picked when detox tests are run
export const launchCameraAsync = async () => ({
  cancelled: false,
  assets: [
    {
      uri: 'https://picsum.photos/100/100',
    },
  ],
});

// Mock the `requestCameraPermissionsAsync` function so that detox can skip the permissions checks
export const requestCameraPermissionsAsync = async () =>
  Promise.resolve({
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: false,
  });

// Mock the `launchImageLibraryAsync` function so that an image is picked when detox tests are run
export const launchImageLibraryAsync = async () => ({
  cancelled: false,
  assets: [
    {
      uri: 'https://picsum.photos/100/100',
    },
  ],
});

// Mock the `requestMediaLibraryPermissionsAsync` function so that detox can skip the permissions checks
export const requestMediaLibraryPermissionsAsync = async () =>
  Promise.resolve({
    accessPrivileges: 'all',
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: false,
  });

export const MediaTypeOptions = ImagePicker.MediaTypeOptions;
