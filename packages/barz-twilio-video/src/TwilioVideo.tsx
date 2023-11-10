import * as React from 'react';
import {
  Fragment,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';

import {
  EventEmitter,
  NativeModulesProxy,
  requireNativeModule,
  requireNativeViewManager,
} from 'expo-modules-core';

import {
  CameraType,
  ConnectParameters,
  Participant,
  Publication,
  StatsResponse,
} from './types';

const BarzTwilioVideo = requireNativeModule('BarzTwilioVideo');

// NOTE: this has to be called first, before anything else is invoked to make sure the audio device
// supporting custom media is properly configured
BarzTwilioVideo.prepareLocalMedia();

const eventEmitter = new EventEmitter(BarzTwilioVideo ?? NativeModulesProxy.BarzTwilioVideo);



type Props = {
  /**
   * Whether or not video should be automatically initialized upon mounting
   * of this component. Defaults to true. If set to false, any use of the
   * camera will require calling `startLocalVideo`.
   */
  autoInitializeCamera: boolean,

  /**
   * Called when the room has connected
   *
   * @param {{roomName, participants}}
   */
  onRoomDidConnect?: (args: {
    roomName: string,
    roomSid: string,
    participants: Array<Participant>,
    localParticipant: Participant
  }) => void,

  /**
   * Called when the room has disconnected
   *
   * @param {{roomName, error}}
   */
  onRoomDidDisconnect?: (args: {
    roomName: string,
    roomSid: string,
    error: string | null
  }) => void,

  /**
   * Called when connection with room failed
   *
   * @param {{roomName, error}}
   */
  onRoomDidFailToConnect?: (args: {
    roomName: string,
    roomSid: string,
    error: string | null
  }) => void,

  /**
   * Called when a new participant has connected
   *
   * @param {{roomName, participant}}
   */
  onRoomParticipantDidConnect?: (args: {
    roomName: string,
    roomSid: string,
    participant: Participant,
  }) => void,

  /**
   * Called when a participant has disconnected
   *
   * @param {{roomName, participant}}
   */
  onRoomParticipantDidDisconnect?: (args: {
    roomName: string,
    roomSid: string,
    participant: Participant,
  }) => void,

  /**
   * Called when a new video track has been added
   *
   * @param {{participant, track, enabled}}
   */
  onParticipantAddedVideoTrack?: (args: {
    participant: Participant,
    track: Publication,
  }) => void,

  /**
   * Called when a video track has been removed
   *
   * @param {{participant, track}}
   */
  onParticipantRemovedVideoTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a new data track has been added
   *
   * @param {{participant, track}}
   */
  onParticipantAddedDataTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a data track has been removed
   *
   * @param {{participant, track}}
   */
  onParticipantRemovedDataTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a new audio track has been added
   *
   * @param {{participant, track}}
   */
  onParticipantAddedAudioTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a audio track has been removed
   *
   * @param {{participant, track}}
   */
  onParticipantRemovedAudioTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a video track has been enabled.
   *
   * @param {{participant, track}}
   */
  onParticipantEnabledVideoTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when a video track has been disabled.
   *
   * @param {{participant, track}}
   */
  onParticipantDisabledVideoTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when an audio track has been enabled.
   *
   * @param {{participant, track}}
   */
  onParticipantEnabledAudioTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when an audio track has been disabled.
   *
   * @param {{participant, track}}
   */
  onParticipantDisabledAudioTrack?: (args: {
    participant: Participant;
    track: Publication;
  }) => void,

  /**
   * Called when the local video track has been enabled or disabled
   *
   * @param {{videoEnabled}}
   */
  onLocalVideoChanged?: (args: {videoEnabled: boolean}) => void,

  /**
   * Called when the local audio track has been enabled or disabled
   *
   * @param {{audioEnabled}}
   */
  onLocalAudioChanged?: (args: {audioEnabled: boolean}) => void,

  /**
   * Called when an dataTrack receives a message
   *
   * @param {{message}}
   */
  onDataTrackMessageReceived?: (args: {
    message: string;
    trackSid: Publication['trackSid'];
  }) => void,

  /**
   * Called when the camera has started
   *
   */
  onCameraDidStart?: () => void,

  /**
   * Called when the camera has been interrupted
   *
   */
  onCameraWasInterrupted?: (args: {reason: string}) => void,

  /**
   * Called when the camera interruption has ended
   *
   */
  onCameraInterruptionEnded?: () => void,

  /**
   * Called when the camera has stopped runing with an error
   *
   * @param {{error}} The error message description
   */
  onCameraDidStopRunning?: (args: { error: any }) => void,

  /**
   * Called when stats are received (after calling getStats)
   *
   */
  onStatsReceived?: (stats: StatsResponse) => void;

  /**
   * Called when the network quality levels of a participant have changed (only if enableNetworkQualityReporting is set to True when connecting)
   *
   */
  onNetworkQualityLevelsChanged?: (args: {
    participant: Participant,
    networkQualityLevel: number,
  }) => void,

  /**
   * Called when dominant speaker changes
   * @param {{ participant, room }} dominant participant
   */
  onDominantSpeakerDidChange?: (args: {
    participant: Participant;
    roomName: string;
    roomSid: string;
  }) => void,
};

export type ImperativeInterface = {
  startLocalVideo: () => Promise<{ success: true, error: null } | { success: false, error: string }>;

  stopLocalVideo: () => void;

  startLocalAudio: () => Promise<{ success: true, error: null  } | { success: false, error: string  }>;

  isLocalAudioInitialized: () => boolean;

  stopLocalAudio: () => void;

  prepareLocalMedia: () => void;

  /**
   * Locally mute / unmute all remote audio tracks from a given participant
   */
  setRemoteAudioPlayback: (params: { participantSid: string, enabled: boolean }) => void;

  setRemoteAudioEnabled: (enabled: boolean) => void;

  setBluetoothHeadsetConnected: (enabled: boolean) => void;

  /**
   * Enable or disable local video
   */
  setLocalVideoEnabled: (enabled: boolean, cameraType: CameraType) => void;

  /**
   * Enable or disable local audio
   */
  setLocalAudioEnabled : (enabled: boolean) => void;

  /**
   * Filp between the front and back camera
   */
  flipCamera: () => void;

  /**
   * Toggle screen sharing
   */
  toggleScreenSharing: (value: boolean) => void;

  /**
   * Toggle audio setup from speaker (default) and headset
   */
  toggleSoundSetup: (speaker: boolean) => void;

  /**
   * Get connection stats
   */
  getStats: () => void;

  /**
   * Connect to given room name using the JWT access token
   * @param  {String} roomName    The connecting room name
   * @param  {String} accessToken The Twilio's JWT access token
   * @param  {String} encodingParameters Control Encoding config
   * @param  {Boolean} enableNetworkQualityReporting Report network quality of participants
   */
  connect: (params: ConnectParameters) => void;

  /**
   * Disconnect from current room
   */
  disconnect: () => void;

  releaseResources: () => void;

  /**
   * Publish a local video track
   */
  publishLocalVideo: () => void;

  /**
   * Publish a local audio track
   */
  publishLocalAudio: () => void;

  /**
   * Publish a local data track
   */
  publishLocalData: () => void;

  /**
   * Unpublish a local video track
   */
  unpublishLocalVideo: () => void;

  /**
   * Unpublish a local audio track
   */
  unpublishLocalAudio: () => void;

  /**
   * Unpublish a local data track
   */
  unpublishLocalData: () => void;

  /**
   * SendString to datatrack
   * @param  {String} message    The message string to send
   */
  sendString: (message: string) => void;

  /**
   * Is the library currently connected to a twilio video room?
   */
  isConnected: () => boolean;

  // Start playing the loaded music track
  playMusic: () => void;

  // Stop playing the loaded music track
  stopMusic: () => void;

  // Get the current position of the music track being played back in an offset in seconds
  // from the beginning of the music track
  getMusicPlaybackPosition: () => number;

  // Instantaneously sets the volume of the currently playing music track from the current level to
  // the specified level. Volume is specified as a inclusive on both sides range from 0.0 to 1.0.
  setMusicVolume: (toVolume: number) => void;

  // Fade the volume of the currently playing music track from the current level to the specified
  // level. Volume is specified as a inclusive on both sides range from 0.0 to 1.0.
  //
  // Returns a promise which resolves once the fade is complete.
  fadeMusicVolume: (durationInSeconds: number, to: number) => Promise<void>;

  // Loads the given music track into memory so that it can be played with `playMusic()`
  // This method caches tracks - repeated calls with the same url will use this cached data.
  downloadMusicFromURLAndMakeActive: (url: string) => Promise<{
    error: string | null;
    fileUrl: string;
    cacheHit: boolean;
  }>;

  // Removes a music track from the local cache so that further calls of
  // `downloadMusicFromURLAndMakeActive` will be forced to re download the track from the server.
  removeCachedMusicForURL: (url: string) => void;

  // requestMediaPermissions: () => Promise<{ error: string | null, success: boolean }>;
};

// export async function requestMediaPermissions(): Promise<{ success: true, error: null } | { success: false, error: string }> {
//   return BarzTwilioVideo.requestMediaPermissions();
// }

export type PropsWithChildren = Props & { children?: React.ReactNode };
export type PropsWithChildrenAndRef = PropsWithChildren & { customRef: any };

// TwilioVideo is the component that manages the twilio video session, and provides imperative
// controls that can used to control connections, media, and audio playback.
const TwilioVideo = forwardRef(function TwilioVideo(props: PropsWithChildren, ref) {
  return (
    <TwilioVideoRaw {...props} customRef={ref} />
  );
});

const TwilioVideoRaw: React.FunctionComponent<PropsWithChildrenAndRef> = ({
  autoInitializeCamera,
  children,
  customRef,

  onCameraDidStart,
  onCameraDidStopRunning,
  onCameraInterruptionEnded,
  onCameraWasInterrupted,
  onDataTrackMessageReceived,
  onDominantSpeakerDidChange,
  onLocalAudioChanged,
  onLocalVideoChanged,
  onNetworkQualityLevelsChanged,
  onParticipantAddedAudioTrack,
  onParticipantAddedDataTrack,
  onParticipantAddedVideoTrack,
  onParticipantDisabledAudioTrack,
  onParticipantDisabledVideoTrack,
  onParticipantEnabledAudioTrack,
  onParticipantEnabledVideoTrack,
  onParticipantRemovedAudioTrack,
  onParticipantRemovedDataTrack,
  onParticipantRemovedVideoTrack,
  onRoomDidConnect,
  onRoomDidDisconnect,
  onRoomDidFailToConnect,
  onRoomParticipantDidConnect,
  onRoomParticipantDidDisconnect,
  onStatsReceived,
}) => {
  // Register event handlers when rendering the component
  useEffect(() => {
    BarzTwilioVideo.changeListenerStatus(true);

    type FirstArgumentOfProp<T extends (
      | 'onCameraDidStopRunning'
      | 'onCameraWasInterrupted'
      | 'onDataTrackMessageReceived'
      | 'onDominantSpeakerDidChange'
      | 'onLocalAudioChanged'
      | 'onLocalVideoChanged'
      | 'onNetworkQualityLevelsChanged'
      | 'onParticipantAddedAudioTrack'
      | 'onParticipantAddedDataTrack'
      | 'onParticipantAddedVideoTrack'
      | 'onParticipantDisabledAudioTrack'
      | 'onParticipantDisabledVideoTrack'
      | 'onParticipantEnabledAudioTrack'
      | 'onParticipantEnabledVideoTrack'
      | 'onParticipantRemovedAudioTrack'
      | 'onParticipantRemovedDataTrack'
      | 'onParticipantRemovedVideoTrack'
      | 'onRoomDidConnect'
      | 'onRoomDidDisconnect'
      | 'onRoomDidFailToConnect'
      | 'onRoomParticipantDidConnect'
      | 'onRoomParticipantDidDisconnect'
      | 'onStatsReceived'
    )> = Parameters<Required<Props>[T]>[0];

    const subscriptions = [
      eventEmitter.addListener('roomDidConnect', (data: FirstArgumentOfProp<'onRoomDidConnect'>) => {
        console.log('roomDidConnect', data);
        if (onRoomDidConnect) {
          onRoomDidConnect(data)
        }
      }),
      eventEmitter.addListener('roomDidDisconnect', (data: FirstArgumentOfProp<'onRoomDidDisconnect'>) => {
        console.log('roomDidDisconnect', data);
        if (onRoomDidDisconnect) {
          onRoomDidDisconnect(data)
        }
      }),
      eventEmitter.addListener('roomDidFailToConnect', (data: FirstArgumentOfProp<'onRoomDidFailToConnect'>) => {
        console.log('roomDidFailToConnect', data);
        if (onRoomDidFailToConnect) {
          onRoomDidFailToConnect(data)
        }
      }),
      eventEmitter.addListener('roomParticipantDidConnect', (data: FirstArgumentOfProp<'onRoomParticipantDidConnect'>) => {
        console.log('roomParticipantDidConnect', data);
        if (onRoomParticipantDidConnect) {
          onRoomParticipantDidConnect(data)
        }
      }),
      eventEmitter.addListener('roomParticipantDidDisconnect', (data: FirstArgumentOfProp<'onRoomParticipantDidDisconnect'>) => {
        console.log('roomParticipantDidDisconnect', data);
        if (onRoomParticipantDidDisconnect) {
          onRoomParticipantDidDisconnect(data)
        }
      }),
      eventEmitter.addListener('participantAddedVideoTrack', (data: FirstArgumentOfProp<'onParticipantAddedVideoTrack'>) => {
        console.log('participantAddedVideoTrack', data);
        if (onParticipantAddedVideoTrack) {
          onParticipantAddedVideoTrack(data)
        }
      }),
      eventEmitter.addListener('participantAddedDataTrack', (data: FirstArgumentOfProp<'onParticipantAddedDataTrack'>) => {
        console.log('participantAddedDataTrack', data);
        if (onParticipantAddedDataTrack) {
          onParticipantAddedDataTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedDataTrack', (data: FirstArgumentOfProp<'onParticipantRemovedDataTrack'>) => {
        console.log('participantRemovedDataTrack', data);
        if (onParticipantRemovedDataTrack) {
          onParticipantRemovedDataTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedVideoTrack', (data: FirstArgumentOfProp<'onParticipantRemovedVideoTrack'>) => {
        console.log('participantRemovedVideoTrack', data);
        if (onParticipantRemovedVideoTrack) {
          onParticipantRemovedVideoTrack(data)
        }
      }),
      eventEmitter.addListener('participantAddedAudioTrack', (data: FirstArgumentOfProp<'onParticipantAddedAudioTrack'>) => {
        console.log('participantAddedAudioTrack', data);
        if (onParticipantAddedAudioTrack) {
          onParticipantAddedAudioTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedAudioTrack', (data: FirstArgumentOfProp<'onParticipantRemovedAudioTrack'>) => {
        console.log('participantRemovedAudioTrack', data);
        if (onParticipantRemovedAudioTrack) {
          onParticipantRemovedAudioTrack(data)
        }
      }),
      eventEmitter.addListener('participantEnabledVideoTrack', (data: FirstArgumentOfProp<'onParticipantEnabledVideoTrack'>) => {
        console.log('participantEnabledVideoTrack', data);
        if (onParticipantEnabledVideoTrack) {
          onParticipantEnabledVideoTrack(data)
        }
      }),
      eventEmitter.addListener(
        'participantDisabledVideoTrack',
        (data: FirstArgumentOfProp<'onParticipantDisabledVideoTrack'>) => {
          console.log('participantDisabledVideoTrack', data);
          if (onParticipantDisabledVideoTrack) {
            onParticipantDisabledVideoTrack(data)
          }
        }
      ),
      eventEmitter.addListener('participantEnabledAudioTrack', (data: FirstArgumentOfProp<'onParticipantEnabledAudioTrack'>) => {
        console.log('participantEnabledAudioTrack', data);
        if (onParticipantEnabledAudioTrack) {
          onParticipantEnabledAudioTrack(data)
        }
      }),
      eventEmitter.addListener(
        'participantDisabledAudioTrack',
        (data: FirstArgumentOfProp<'onParticipantDisabledAudioTrack'>) => {
          console.log('participantDisabledAudioTrack', data);
          if (onParticipantDisabledAudioTrack) {
            onParticipantDisabledAudioTrack(data)
          }
        }
      ),
      eventEmitter.addListener('dataTrackMessageReceived', (data: FirstArgumentOfProp<'onDataTrackMessageReceived'>) => {
        console.log('dataTrackMessageReceived', data);
        if (onDataTrackMessageReceived) {
          onDataTrackMessageReceived(data)
        }
      }),
      eventEmitter.addListener('cameraDidStart', () => {
        console.log('cameraDidStart');
        if (onCameraDidStart) {
          onCameraDidStart();
        }
      }),
      eventEmitter.addListener('cameraWasInterrupted', (data: FirstArgumentOfProp<'onCameraWasInterrupted'>) => {
        console.log('cameraWasInterrupted', data);
        if (onCameraWasInterrupted) {
          onCameraWasInterrupted(data)
        }
      }),
      eventEmitter.addListener('cameraInterruptionEnded', () => {
        console.log('cameraInterruptionEnded');
        if (onCameraInterruptionEnded) {
          onCameraInterruptionEnded()
        }
      }),
      eventEmitter.addListener('cameraDidStopRunning', (data: FirstArgumentOfProp<'onCameraDidStopRunning'>) => {
        console.log('cameraDidStopRunning', data);
        if (onCameraDidStopRunning) {
          onCameraDidStopRunning(data)
        }
      }),
      eventEmitter.addListener('statsReceived', (data: FirstArgumentOfProp<'onStatsReceived'>) => {
        console.log('statsReceived', data);
        if (onStatsReceived) {
          onStatsReceived(data)
        }
      }),
      eventEmitter.addListener('networkQualityLevelsChanged', (data: FirstArgumentOfProp<'onNetworkQualityLevelsChanged'>) => {
        console.log('networkQualityLevelsChanged', data);
        if (onNetworkQualityLevelsChanged) {
          onNetworkQualityLevelsChanged(data)
        }
      }),
      eventEmitter.addListener('dominantSpeakerDidChange', (data: FirstArgumentOfProp<'onDominantSpeakerDidChange'>) => {
        console.log('dominantSpeakerDidChange', data);
        if (onDominantSpeakerDidChange) {
          onDominantSpeakerDidChange(data)
        }
      }),
      eventEmitter.addListener('videoChanged', (data: FirstArgumentOfProp<'onLocalVideoChanged'>) => {
        console.log('videoChanged', data);
        if (onLocalVideoChanged) {
          onLocalVideoChanged(data)
        }
      }),
      eventEmitter.addListener('audioChanged', (data: FirstArgumentOfProp<'onLocalAudioChanged'>) => {
        console.log('audioChanged', data);
        if (onLocalAudioChanged) {
          onLocalAudioChanged(data)
        }
      }),
    ];

    return () => {
      BarzTwilioVideo.changeListenerStatus(false);
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [
    onRoomDidConnect,
    onRoomDidDisconnect,
    onRoomDidFailToConnect,
    onRoomParticipantDidConnect,
    onRoomParticipantDidDisconnect,
    onParticipantAddedVideoTrack,
    onParticipantRemovedVideoTrack,
    onParticipantAddedDataTrack,
    onParticipantRemovedDataTrack,
    onParticipantAddedAudioTrack,
    onParticipantRemovedAudioTrack,
    onParticipantEnabledVideoTrack,
    onParticipantDisabledVideoTrack,
    onParticipantEnabledAudioTrack,
    onParticipantDisabledAudioTrack,
    onDataTrackMessageReceived,
    onCameraDidStart,
    onCameraWasInterrupted,
    onCameraInterruptionEnded,
    onCameraDidStopRunning,
    onStatsReceived,
    onNetworkQualityLevelsChanged,
    onDominantSpeakerDidChange,
  ]);

  // Ensure everything is cleaned up when the component unmounts
  useEffect(() => {
    return () => {
      BarzTwilioVideo.stopLocalVideo();
      BarzTwilioVideo.stopLocalAudio();
      BarzTwilioVideo.releaseResources();
    };
  }, []);

  // Set up the video interface when the component mounts
  useEffect(() => {
    if (autoInitializeCamera) {
      BarzTwilioVideo.startLocalVideo()
    }
    return () => {
      BarzTwilioVideo.stopLocalVideo()
    };
  }, [autoInitializeCamera]);

  // Define a number of methods that downstream consumers can use to imperatively effect the twilio
  // video connection
  useImperativeHandle(customRef, (): ImperativeInterface => ({
    async startLocalVideo() {
      return await BarzTwilioVideo.startLocalVideo()
    },

    stopLocalVideo() {
      BarzTwilioVideo.stopLocalVideo()
    },

    async startLocalAudio() {
      return await BarzTwilioVideo.startLocalAudio()
    },

    isLocalAudioInitialized() {
      return BarzTwilioVideo.isLocalAudioInitialized()
    },

    stopLocalAudio() {
      BarzTwilioVideo.stopLocalAudio()
    },

    prepareLocalMedia() {
      BarzTwilioVideo.prepareLocalMedia();
    },

    /**
     * Locally mute / unmute all remote audio tracks from a given participant
     */
    setRemoteAudioPlayback({ participantSid, enabled }: { participantSid: string, enabled: boolean }) {
      BarzTwilioVideo.setRemoteAudioPlayback(participantSid, enabled)
    },

    setRemoteAudioEnabled(enabled: boolean) {
      return Promise.resolve(enabled);
    },

    setBluetoothHeadsetConnected(enabled: boolean) {
      return Promise.resolve(enabled);
    },

    /**
     * Enable or disable local video
     */
    setLocalVideoEnabled(enabled: boolean, cameraType: CameraType) {
      return BarzTwilioVideo.setLocalVideoEnabled(enabled, cameraType);
    },

    /**
     * Enable or disable local audio
     */
    setLocalAudioEnabled (enabled: boolean) {
      return BarzTwilioVideo.setLocalAudioEnabled(enabled);
    },

    /**
     * Filp between the front and back camera
     */
    flipCamera() {
      BarzTwilioVideo.flipCamera();
    },

    /**
     * Toggle screen sharing
     */
    toggleScreenSharing(value: boolean) {
      BarzTwilioVideo.toggleScreenSharing(value);
    },

    /**
     * Toggle audio setup from speaker (default) and headset
     */
    toggleSoundSetup(speaker: boolean) {
      BarzTwilioVideo.toggleSoundSetup(speaker);
    },

    /**
     * Get connection stats
     */
    getStats() {
      BarzTwilioVideo.getStats();
    },

    /**
     * Connect to given room name using the JWT access token
     * @param  {String} roomName    The connecting room name
     * @param  {String} accessToken The Twilio's JWT access token
     * @param  {String} encodingParameters Control Encoding config
     * @param  {Boolean} enableNetworkQualityReporting Report network quality of participants
     */
    connect({
      roomName,
      accessToken,
      cameraType = 'front',
      enableAudio = true,
      enableVideo = true,
      enableH264Codec = false,
      audioBitrate = undefined,
      videoBitrate = undefined,
      enableNetworkQualityReporting = false,
      dominantSpeakerEnabled = false
    }: ConnectParameters) {
      BarzTwilioVideo.connect(
        accessToken,
        roomName,
        enableAudio,
        enableVideo,
        enableH264Codec,
        // audioBitrate,
        // videoBitrate,
        enableNetworkQualityReporting,
        dominantSpeakerEnabled,
        cameraType
      )
    },

    /**
     * Disconnect from current room
     */
    disconnect() {
      BarzTwilioVideo.disconnect();
    },

    releaseResources() {
      BarzTwilioVideo.releaseResources()
    },

    /**
     * Publish a local video track
     */
    publishLocalVideo() {
      BarzTwilioVideo.publishLocalVideo();
    },

    /**
     * Publish a local audio track
     */
    publishLocalAudio() {
      BarzTwilioVideo.publishLocalAudio();
    },

    /**
     * Publish a local data track
     */
    publishLocalData() {
      BarzTwilioVideo.publishLocalData();
    },

    /**
     * Unpublish a local video track
     */
    unpublishLocalVideo() {
      BarzTwilioVideo.unpublishLocalVideo();
    },

    /**
     * Unpublish a local video track
     */
    unpublishLocalAudio() {
      BarzTwilioVideo.unpublishLocalAudio();
    },

    /**
     * Unpublish a local data track
     */
    unpublishLocalData() {
      BarzTwilioVideo.unpublishLocalData();
    },

    /**
     * SendString to datatrack
     * @param  {String} message    The message string to send
     */
    sendString(message: string) {
      BarzTwilioVideo.sendString(message);
    },

    isConnected() {
      return BarzTwilioVideo.isConnected()
    },

    playMusic() {
      BarzTwilioVideo.playMusic()
    },

    stopMusic() {
      BarzTwilioVideo.stopMusic()
    },

    getMusicPlaybackPosition() {
      return BarzTwilioVideo.getMusicPlaybackPosition();
    },

    async setMusicVolume(toVolume: number) {
      return BarzTwilioVideo.setMusicVolume(toVolume);
    },

    async fadeMusicVolume(durationInSeconds: number, to: number) {
      return await BarzTwilioVideo.fadeMusicVolume(durationInSeconds, to);
    },

    async downloadMusicFromURLAndMakeActive(url: string) {
      return await BarzTwilioVideo.downloadMusicFromURLAndMakeActive(url);
    },

    removeCachedMusicForURL(url: string) {
      BarzTwilioVideo.removeCachedMusicForURL(url)
    },

    // async requestMediaPermissions() {
    //   return await BarzTwilioVideo.requestMediaPermissions();
    // },
  }), []);

  if (children) {
    return <Fragment>{children}</Fragment>;
  } else {
    return null;
  }
};

export default TwilioVideo;
