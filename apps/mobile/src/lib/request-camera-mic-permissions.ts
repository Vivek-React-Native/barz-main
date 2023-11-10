import { Alert, Linking } from 'react-native';
import { Camera } from 'expo-camera';

export default async function requestCameraAndMicPermissions(): Promise<boolean> {
  const cameraResult = await Camera.requestCameraPermissionsAsync();
  if (!cameraResult.granted) {
    return false;
  }

  const micResult = await Camera.requestMicrophonePermissionsAsync();
  if (!micResult.granted) {
    return false;
  }

  return true;
}

export function showCameraAndMicPermissionDeniedAlert() {
  Alert.alert(
    'Permission Denied',
    'Barz needs access to the camera and microphone to battle other users.',
    [
      {
        text: 'Enable in Settings',
        onPress: () => Linking.openURL('app-settings:'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
  );
}
