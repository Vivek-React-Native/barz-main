import * as React from 'react';
import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import { View, Text } from 'react-native';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

export {
  Participant,
  Publication,
  StatsReport,
  StatsResponse,
  CameraType,
  ConnectParameters,
} from './types';

export { ImperativeInterface } from './TwilioVideo';

// export const requestMediaPermissions = async () => Promise.resolve({ success: true, error: null });

export {
  LocalParticipantView,
  RemoteParticipantView,
} from './mockParticipantViews';

import { PropsWithChildren, PropsWithChildrenAndRef, ImperativeInterface } from './TwilioVideo';

// FIXME: hardcoding this may be a bad idea?
const SERVER_BASE_URL = "http://localhost:8000";

console.log('Loaded mainDetox entrypoint within `@barz/barz-twilio-video`! This should never happen in production.');

// TwilioVideo is the component that manages the twilio video session, and provides imperative
// controls that can used to control connections, media, and audio playback.
//
// This version is a MOCK version, that can be used when running the detox tests. It ties into the
// socket.io server being run so that the test runner can send events to the mobile app to simulate
// a battle from start to end.
const TwilioVideo = forwardRef(function TwilioVideo(props: PropsWithChildren, ref) {
  return (
    <TwilioVideoRaw {...props} customRef={ref} />
  );
});

const TwilioVideoRaw: React.FunctionComponent<PropsWithChildrenAndRef> = ({
  autoInitializeCamera,
  children,
  customRef,

  ...eventHandlers
}) => {
  const socket = useRef<any | null>(null);
  const isConnected = useRef<boolean>(false);

  // Listen for socket events that can be used to mock twilio video events from other participants
  useEffect(() => {
    socket.current = io(`${SERVER_BASE_URL.replace('http', 'ws').replace('8000', '8001')}`);
  }, []);
  useEffect(() => {
    const onTwilioVideoEvent = (data: any) => {
      if (data.eventName === 'roomDidConnect') {
        isConnected.current = true;
      }

      const propName = `on${data.eventName[0].toUpperCase()}${data.eventName.slice(1)}`;
      if (propName in eventHandlers) {
        ((eventHandlers as any)[propName] as any)(data.eventPayload);
      } else {
        console.log(`WARNING: Detox Mocked Twilio Video received event ${data.eventName}, but no event handler prop was found! Ignoring...`);
      }
    };

    socket.current.on('twilio-video-event', onTwilioVideoEvent);

    return () => {
      socket.current.off('twilio-video-event', onTwilioVideoEvent);
    };
  }, [eventHandlers]);

  // Define a number of methods that can be called by consumers of this library. When any of these
  // are called, the call is proxied to the detox test runner over the sockets.io connection, which
  // optionally can send an event back to make the event resolve with data.
  useImperativeHandle(customRef, (): ImperativeInterface => {
    const callToDetoxTestRunner = (functionName: string) => (...args: Array<any>): Promise<any> => {
      return new Promise(resolve => {
        const id = uuidv4();
        socket.current.emit('twilio-video-function-call', { id, functionName, args });
        socket.current.once(`twilio-video-function-call-response-${id}`, resolve);
      });
    };

    return {
      startLocalVideo: callToDetoxTestRunner('startLocalVideo'),
      stopLocalVideo: callToDetoxTestRunner('stopLocalVideo'),
      startLocalAudio: callToDetoxTestRunner('startLocalAudio'),
      isLocalAudioInitialized: () => true,
      stopLocalAudio: callToDetoxTestRunner('stopLocalAudio'),
      prepareLocalMedia: callToDetoxTestRunner('prepareLocalMedia'),
      setRemoteAudioPlayback: callToDetoxTestRunner('setRemoteAudioPlayback'),
      setRemoteAudioEnabled: callToDetoxTestRunner('setRemoteAudioEnabled'),
      setBluetoothHeadsetConnected: callToDetoxTestRunner('setBluetoothHeadsetConnected'),
      setLocalVideoEnabled: callToDetoxTestRunner('setLocalVideoEnabled'),
      setLocalAudioEnabled: callToDetoxTestRunner('setLocalAudioEnabled'),
      flipCamera: callToDetoxTestRunner('flipCamera'),
      toggleScreenSharing: callToDetoxTestRunner('toggleScreenSharing'),
      toggleSoundSetup: callToDetoxTestRunner('toggleSoundSetup'),
      getStats: callToDetoxTestRunner('getStats'),
      connect: callToDetoxTestRunner('connect'),
      disconnect: callToDetoxTestRunner('disconnect'),
      releaseResources: callToDetoxTestRunner('releaseResources'),
      publishLocalVideo: callToDetoxTestRunner('publishLocalVideo'),
      publishLocalAudio: callToDetoxTestRunner('publishLocalAudio'),
      publishLocalData: callToDetoxTestRunner('publishLocalData'),
      unpublishLocalVideo: callToDetoxTestRunner('unpublishLocalVideo'),
      unpublishLocalAudio: callToDetoxTestRunner('unpublishLocalAudio'),
      unpublishLocalData: callToDetoxTestRunner('unpublishLocalData'),
      sendString: callToDetoxTestRunner('sendString'),
      isConnected: () => isConnected.current,
      playMusic: callToDetoxTestRunner('playMusic'),
      stopMusic: callToDetoxTestRunner('stopMusic'),
      getMusicPlaybackPosition: () => 0,
      setMusicVolume: callToDetoxTestRunner('setMusicVolume'),
      fadeMusicVolume: callToDetoxTestRunner('fadeMusicVolume'),
      downloadMusicFromURLAndMakeActive: callToDetoxTestRunner('downloadMusicFromURLAndMakeActive'),
      removeCachedMusicForURL: callToDetoxTestRunner('removeCachedMusicForURL'),
      // requestMediaPermissions: callToDetoxTestRunner('requestMediaPermissions'),
    };
  }, []);

  return null;
};

export { resetFileModificationTime } from './resetFileModificationTime';

export default TwilioVideo;
