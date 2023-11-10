import * as React from 'react';
import { Fragment, forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { StyleSheet, TextInput, Text, View } from 'react-native';

import { EventEmitter, requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import Button from './ui/Button';
import Chip from './ui/Chip';
import BattleView from './BattleView';

// const TWVideoModule = requireNativeModule('Twilliovideo');
const TWVideoModule = requireNativeModule('BarzTwilioVideo');

// export default function App() {
//   return <Text>{TWVideoModule.hello()}</Text>
// }

// NOTE: this has to be called first, before anything else is invoked to make sure the audio device
// supporting custom media is properly configured
TWVideoModule.prepareLocalMedia();

type Participant = {
  identity: string;
  sid: string;
  state: number;
  networkQualityLevel: number;
};

type Publication = {
  track: {
    isEnabled: boolean;
    name: string;
    state: string;
  } | null;
  trackEnabled: boolean;
  trackName: string;
  trackSid: string;
};

type StatsReport = {
  remoteAudioTrackStats: Array<{
    trackSid: string;
    packetsLost: number;
    codec: string;
    ssrc: string;
    timestamp: number;
    bytesReceived: number;
    packetsReceived: number;
    audioLevel: number;
    jitter: number;
  }>;
  remoteVideoTrackStats: Array<{
    trackSid: string;
    packetsLost: number;
    codec: string;
    ssrc: string;
    timestamp: number;
    bytesReceived: number;
    packetsReceived: number;
    dimensions: { width: number, height: number };
    frameRate: number;
  }>;
  localAudioTrackStats: Array<{
    trackSid: string;
    packetsLost: number;
    codec: string;
    ssrc: string;
    timestamp: number;
    bytesSent: number;
    packetsSent: number;
    audioLevel: number;
    jitter: number;
  }>;
  localVideoTrackStats: Array<{
    trackSid: string;
    packetsLost: number;
    codec: string;
    ssrc: string;
    timestamp: number;
    bytesSent: number;
    packetsSent: number;
    dimensions: { width: number, height: number };
    frameRate: number;
  }>;
};

type StatsResponse = { [perrConnectionId: string]: StatsReport };

type CameraType = "front" | "back";

type ConnectParameters = {
  accessToken: string;
  roomName: string;
  enableAudio?: boolean;
  enableVideo?: boolean;
  enableH264Codec?: boolean;
  audioBitrate?: number;
  videoBitrate?: number;
  enableNetworkQualityReporting?: boolean;
  dominantSpeakerEnabled?: boolean;
  cameraType?: CameraType;
}

type Props = {
  /**
   * Whether or not video should be automatically initialized upon mounting
   * of this component. Defaults to true. If set to false, any use of the
   * camera will require calling `_startLocalVideo`.
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
  onCameraDidStopRunning?: (args: { error }) => void,

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

type PropsWithChildren = Props & { children?: React.ReactNode };
type PropsWithChildrenAndRef = PropsWithChildren & { customRef: any };

const TwillioVideo = forwardRef(function TwilioVideo(props: PropsWithChildren, ref) {
  return (
    <TwillioVideoRaw {...props} customRef={ref} />
  );
});

const eventEmitter = new EventEmitter(TWVideoModule);

const TwillioVideoRaw: React.FunctionComponent<PropsWithChildrenAndRef> = ({
  autoInitializeCamera,
  children,
  customRef,

  onRoomDidConnect,
  onRoomDidDisconnect,
  onRoomDidFailToConnect,
  onRoomParticipantDidConnect,
  onRoomParticipantDidDisconnect,
  onParticipantAddedVideoTrack,
  onParticipantAddedDataTrack,
  onParticipantRemovedDataTrack,
  onParticipantRemovedVideoTrack,
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
}) => {
  // Register event handlers when rendering the component
  useEffect(() => {
    TWVideoModule.changeListenerStatus(true)
    const subscriptions = [
      eventEmitter.addListener('roomDidConnect', (data) => {
        console.log('roomDidConnect', data);
        if (onRoomDidConnect) {
          onRoomDidConnect(data)
        }
      }),
      eventEmitter.addListener('roomDidDisconnect', (data) => {
        console.log('roomDidDisconnect', data);
        if (onRoomDidDisconnect) {
          onRoomDidDisconnect(data)
        }
      }),
      eventEmitter.addListener('roomDidFailToConnect', (data) => {
        console.log('roomDidFailToConnect', data);
        alert(`roomDidFailToConnect: ${JSON.stringify(data)}`);
        if (onRoomDidFailToConnect) {
          onRoomDidFailToConnect(data)
        }
      }),
      eventEmitter.addListener('roomParticipantDidConnect', (data) => {
        console.log('roomParticipantDidConnect', data);
        if (onRoomParticipantDidConnect) {
          onRoomParticipantDidConnect(data)
        }
      }),
      eventEmitter.addListener('roomParticipantDidDisconnect', (data) => {
        console.log('roomParticipantDidDisconnect', data);
        if (onRoomParticipantDidDisconnect) {
          onRoomParticipantDidDisconnect(data)
        }
      }),
      eventEmitter.addListener('participantAddedVideoTrack', (data) => {
        console.log('participantAddedVideoTrack', data);
        if (onParticipantAddedVideoTrack) {
          onParticipantAddedVideoTrack(data)
        }
      }),
      eventEmitter.addListener('participantAddedDataTrack', (data) => {
        console.log('participantAddedDataTrack', data);
        if (onParticipantAddedDataTrack) {
          onParticipantAddedDataTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedDataTrack', (data) => {
        console.log('participantRemovedDataTrack', data);
        if (onParticipantRemovedDataTrack) {
          onParticipantRemovedDataTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedVideoTrack', (data) => {
        console.log('participantRemovedVideoTrack', data);
        if (onParticipantRemovedVideoTrack) {
          onParticipantRemovedVideoTrack(data)
        }
      }),
      eventEmitter.addListener('participantAddedAudioTrack', (data) => {
        console.log('participantAddedAudioTrack', data);
        if (onParticipantAddedAudioTrack) {
          onParticipantAddedAudioTrack(data)
        }
      }),
      eventEmitter.addListener('participantRemovedAudioTrack', (data) => {
        console.log('participantRemovedAudioTrack', data);
        if (onParticipantRemovedAudioTrack) {
          onParticipantRemovedAudioTrack(data)
        }
      }),
      eventEmitter.addListener('participantEnabledVideoTrack', (data) => {
        console.log('participantEnabledVideoTrack', data);
        if (onParticipantEnabledVideoTrack) {
          onParticipantEnabledVideoTrack(data)
        }
      }),
      eventEmitter.addListener(
        'participantDisabledVideoTrack',
        (data) => {
          console.log('participantDisabledVideoTrack', data);
          if (onParticipantDisabledVideoTrack) {
            onParticipantDisabledVideoTrack(data)
          }
        }
      ),
      eventEmitter.addListener('participantEnabledAudioTrack', (data) => {
        console.log('participantEnabledAudioTrack', data);
        if (onParticipantEnabledAudioTrack) {
          onParticipantEnabledAudioTrack(data)
        }
      }),
      eventEmitter.addListener(
        'participantDisabledAudioTrack',
        (data) => {
          console.log('participantDisabledAudioTrack', data);
          if (onParticipantDisabledAudioTrack) {
            onParticipantDisabledAudioTrack(data)
          }
        }
      ),
      eventEmitter.addListener('dataTrackMessageReceived', (data) => {
        console.log('dataTrackMessageReceived', data);
        if (onDataTrackMessageReceived) {
          onDataTrackMessageReceived(data)
        }
      }),
      eventEmitter.addListener('cameraDidStart', () => {
        console.log('cameraDidStart', data);
        if (onCameraDidStart) {
          onCameraDidStart();
        }
      }),
      eventEmitter.addListener('cameraWasInterrupted', (data) => {
        console.log('cameraWasInterrupted', data);
        if (onCameraWasInterrupted) {
          onCameraWasInterrupted(data)
        }
      }),
      eventEmitter.addListener('cameraInterruptionEnded', () => {
        console.log('cameraInterruptionEnded', data);
        if (onCameraInterruptionEnded) {
          onCameraInterruptionEnded()
        }
      }),
      eventEmitter.addListener('cameraDidStopRunning', (data) => {
        console.log('cameraDidStopRunning', data);
        if (onCameraDidStopRunning) {
          onCameraDidStopRunning(data)
        }
      }),
      eventEmitter.addListener('statsReceived', (data) => {
        console.log('statsReceived', data);
        if (onStatsReceived) {
          onStatsReceived(data)
        }
      }),
      eventEmitter.addListener('networkQualityLevelsChanged', (data) => {
        console.log('networkQualityLevelsChanged', data);
        if (onNetworkQualityLevelsChanged) {
          onNetworkQualityLevelsChanged(data)
        }
      }),
      eventEmitter.addListener('dominantSpeakerDidChange', (data) => {
        console.log('dominantSpeakerDidChange', data);
        if (onDominantSpeakerDidChange) {
          onDominantSpeakerDidChange(data)
        }
      })
    ];

    return () => {
      TWVideoModule.changeListenerStatus(false)
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    TWVideoModule.startLocalAudio();
    return () => {
      TWVideoModule.stopLocalAudio();
      TWVideoModule.releaseResources();
    };
  }, []);
  useEffect(() => {
    if (autoInitializeCamera) {
      TWVideoModule.startLocalVideo()
    }
    return () => {
      TWVideoModule.stopLocalVideo()
    };
  }, [autoInitializeCamera]);

  useImperativeHandle(customRef, () => ({
    startLocalVideo() {
      TWVideoModule.startLocalVideo()
    },

    stopLocalVideo() {
      TWVideoModule.stopLocalVideo()
    },

    startLocalAudio() {
      TWVideoModule.startLocalAudio()
    },

    stopLocalAudio() {
      TWVideoModule.stopLocalAudio()
    },

    prepareLocalMedia() {
      TWVideoModule.prepareLocalMedia();
    },

    /**
     * Locally mute / unmute all remote audio tracks from a given participant
     */
    setRemoteAudioPlayback({ participantSid, enabled }: { participantSid: string, enabled: boolean }) {
      TWVideoModule.setRemoteAudioPlayback(participantSid, enabled)
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
      return TWVideoModule.setLocalVideoEnabled(enabled, cameraType);
    },

    /**
     * Enable or disable local audio
     */
    setLocalAudioEnabled (enabled: boolean) {
      return TWVideoModule.setLocalAudioEnabled(enabled);
    },

    /**
     * Filp between the front and back camera
     */
    flipCamera() {
      TWVideoModule.flipCamera();
    },

    /**
     * Toggle screen sharing
     */
    toggleScreenSharing(value: boolean) {
      TWVideoModule.toggleScreenSharing(value);
    },

    /**
     * Toggle audio setup from speaker (default) and headset
     */
    toggleSoundSetup(speaker: boolean) {
      TWVideoModule.toggleSoundSetup(speaker);
    },

    /**
     * Get connection stats
     */
    getStats() {
      TWVideoModule.getStats();
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
      TWVideoModule.connect(
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
      TWVideoModule.disconnect();
    },

    releaseResources() {
      TWVideoModule.releaseResources()
    },

    /**
     * Publish a local video track
     */
    publishLocalVideo() {
      TWVideoModule.publishLocalVideo();
    },

    /**
     * Publish a local audio track
     */
    publishLocalAudio() {
      TWVideoModule.publishLocalAudio();
    },

    /**
     * Publish a local data track
     */
    publishLocalData() {
      TWVideoModule.publishLocalData();
    },

    /**
     * Unpublish a local video track
     */
    unpublishLocalVideo() {
      TWVideoModule.unpublishLocalVideo();
    },

    /**
     * Unpublish a local audio track
     */
    unpublishLocalAudio() {
      TWVideoModule.unpublishLocalAudio();
    },

    /**
     * Unpublish a local data track
     */
    unpublishLocalData() {
      TWVideoModule.unpublishLocalData();
    },

    /**
     * SendString to datatrack
     * @param  {String} message    The message string to send
     */
    sendString(message: string) {
      TWVideoModule.sendString(message);
    },

    playMusic() {
      TWVideoModule.playMusic()
    },

    stopMusic() {
      TWVideoModule.stopMusic()
    },

    async fadeMusicVolume(durationInSeconds: number, to: number) {
      return await TWVideoModule.fadeMusicVolume(durationInSeconds, to);
    },

    async downloadMusicFromURLAndMakeActive(url: string) {
      return await TWVideoModule.downloadMusicFromURLAndMakeActive(url);
    },

    removeCachedMusicForURL(url: string) {
      TWVideoModule.removeCachedMusicForURL(url)
    },
  }), []);

  if (children) {
    return <Fragment>{children}</Fragment>;
  } else {
    return null;
  }
};

const TwilliovideoLocalOrRemoteParticipantVideoView = requireNativeViewManager('BarzTwilioVideo');

function TwilioVideoLocalOrRemoteParticipantView(props: {
  scaleType: 'fit' | 'fill',
  local: boolean;
  remoteParticipantSid?: string;
  remoteParticipantTrackSid?: string;
  enabled: boolean,
  children?: React.ReactNode,
}) {
  const scalesType = props.scaleType === 'fit' ? 1 : 2
  return (
    <TwilliovideoLocalOrRemoteParticipantVideoView
      scalesType={scalesType}
      style={{ width: 100, height: 100 }}
      {...props}
    >
      {props.children || null}
    </TwilliovideoLocalOrRemoteParticipantVideoView>
  );
}


export default function App() {
  const ref = useRef<any>(null);

  const [twilioToken1, setTwillioToken1] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU4NTk5MDdkMTY4MjU4ZDZjNWRmMjQxNDUwZmI5NGE5LTE2ODI5NTI2MjUiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJicmVhZDEiLCJ2aWRlbyI6e319LCJpYXQiOjE2ODI5NTI2MjUsImV4cCI6MTY4Mjk1NjIyNSwiaXNzIjoiU0s1ODU5OTA3ZDE2ODI1OGQ2YzVkZjI0MTQ1MGZiOTRhOSIsInN1YiI6IkFDZTBjZmE0NGI5MzYwNjUwODY4YmU2YmYxYzZmODU1MGUifQ.9Cxj6DrXDuUwcRYVlBWQHF_z7gH-ZNEistvHIxiK9LI');
  const [twilioToken2, setTwillioToken2] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU4NTk5MDdkMTY4MjU4ZDZjNWRmMjQxNDUwZmI5NGE5LTE2ODI5NTI2MzkiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJicmVhZDIiLCJ2aWRlbyI6e319LCJpYXQiOjE2ODI5NTI2MzksImV4cCI6MTY4Mjk1NjIzOSwiaXNzIjoiU0s1ODU5OTA3ZDE2ODI1OGQ2YzVkZjI0MTQ1MGZiOTRhOSIsInN1YiI6IkFDZTBjZmE0NGI5MzYwNjUwODY4YmU2YmYxYzZmODU1MGUifQ.AwcYMii3THPjIHBw49TpVBD-4J_FW3Q5e1XVktDCPnQ');

  const [roomSid, setRoomSid] = useState<string | null>(null);
  const [localParticipantSid, setLocalParticipantSid] = useState<string | null>(null);

  const [remoteParticipantVideoTracks, setRemoteParticipantVideoTracks] = useState<Array<{
    remoteParticipantSid: string,
    remoteParticipantTrackSid: string,
  }>>([]);
  console.log('TRACKS:', remoteParticipantVideoTracks)

  const callOnTrackAdd = useRef<((string, { participant: Participant, track: Publication }) => void) | null>(null);
  const callOnDataTrackReceived = useRef<((string, string) => void) | null>(null);

  const [localAudioEnabledIndicator, setLocalAudioEnabledIndicator] = useState<boolean>(true);

  useEffect(() => {
    return () => {
      if (!ref.current) {
        return;
      }

      ref.current.disconnect();
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* <Text>{TWVideoModule.hello()}</Text> */}
      <Text>Room SID: {roomSid || 'N/A'}</Text>
      <Text>Local Participant SID: {localParticipantSid || 'N/A'}</Text>

      <TwillioVideo
        ref={ref}
        autoInitializeCamera={false}
        onRoomDidConnect={data => {
          setTimeout(() => {
            setRoomSid(data.roomSid);
            setLocalParticipantSid(data.localParticipant.sid);
          }, 1000);
        }}
        onRoomDidDisconnect={data => {
          setRoomSid(null);
          setLocalParticipantSid(null);
        }}
        onRoomDidFailToConnect={data => {
          setRoomSid(null);
          setLocalParticipantSid(null);
        }}
        onParticipantAddedVideoTrack={data => {
          if (callOnTrackAdd.current) {
            callOnTrackAdd.current('video', data);
          }
          // alert(`ADDED VIDEO TRACK! ${JSON.stringify(data)} ${data.participant.sid}`)
          setRemoteParticipantVideoTracks(n => [
            ...n.filter(i => i.remoteParticipantSid !== data.participant.sid),
            {
              remoteParticipantSid: data.participant.sid,
              remoteParticipantTrackSid: data.track.trackSid,
            },
          ]);
        }}
        onParticipantRemovedVideoTrack={data => {
          // alert(`REMOVED VIDEO TRACK! ${JSON.stringify(data)} ${data.participant.sid}`)
          setRemoteParticipantVideoTracks(n => n.filter(i => (
            i.remoteParticipantSid !== data.participant.sid
          )));
        }}

        onParticipantAddedAudioTrack={data => {
          if (callOnTrackAdd.current) {
            callOnTrackAdd.current('audio', data);
          }
        }}
        onParticipantAddedDataTrack={data => {
          if (callOnTrackAdd.current) {
            callOnTrackAdd.current('data', data);
          }
        }}

        onDataTrackMessageReceived={({ message, trackSid }) => {
          // console.log('RECEIVED MESSAGE!', message, trackSid);
          if (callOnDataTrackReceived.current) {
            callOnDataTrackReceived.current(message, trackSid);
          }
        }}

        onParticipantDisabledAudioTrack={(data) => {
          console.log('DISABLED AUDIO TRACK!', data);
        }}
      />

      {roomSid !== null ? (
        <Fragment>
          <View style={{borderWidth: 4, borderColor: 'red'}}>
            <TwilioVideoLocalOrRemoteParticipantView
              local={true}
              enabled={roomSid !== null}
              scaleType="fit"
            />
          </View>

          {remoteParticipantVideoTracks.filter(i => i.remoteParticipantSid !== localParticipantSid).map((i) => (
            <View style={{borderWidth: 4, borderColor: 'green'}}>
              <Text>{JSON.stringify(i)}</Text>
              <TwilioVideoLocalOrRemoteParticipantView
                key={`${i.remoteParticipantSid},${i.remoteParticipantTrackSid}`}
                enabled={true}
                scaleType="fit"
                local={false}
                remoteParticipantSid={i.remoteParticipantSid}
                remoteParticipantTrackSid={i.remoteParticipantTrackSid}
              />
            </View>
          ))}
        </Fragment>
      ) : null}

      {roomSid === null ? (
        <TextInput
          placeholder="Enter Twillio Token"
          style={styles.textInput}
          onChangeText={setTwillioToken1}
          value={twilioToken1}
        />
      ) : null}

      {roomSid === null ? (
        <TextInput
          placeholder="Enter Twillio Token"
          style={styles.textInput}
          onChangeText={setTwillioToken2}
          value={twilioToken2}
        />
      ) : null}

      <View style={{
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        width: 400,
        justifyContent: 'center',
        marginBottom: 48,
      }}>
        {/* <Chip size="medium" count={10} type="warning">Foo</Chip> */}
        <Button
          size="medium"
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.disconnect();
          }}
          disabled={roomSid === null}
        >Disconnect</Button>

        <Button
          type="primary"
          size="medium"
          disabled={roomSid !== null}
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.startLocalVideo();
            ref.current.setLocalVideoEnabled(true, "front");
            // ref.current.toggleSoundSetup(true);

            ref.current.connect({
              accessToken: twilioToken1,
              roomName: 'test-room',
              enableNetworkQualityReporting: true,
              enableVideo: true,
              enableAudio: true,
            });
          }}
        >Connect 1</Button>

        <Button
          type="primary"
          size="medium"
          disabled={roomSid !== null}
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.startLocalVideo();
            ref.current.setLocalVideoEnabled(true, "front");
            // ref.current.toggleSoundSetup(true);

            ref.current.connect({
              accessToken: twilioToken2,
              roomName: 'test-room',
              enableNetworkQualityReporting: true,
              enableVideo: true,
              enableAudio: true,
            });
          }}
        >Connect 2</Button>

        <Button
          type="warning"
          size="medium"
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.downloadMusicFromURLAndMakeActive(
              'https://www.fesliyanstudios.com/musicfiles/2019-03-06_-_Crazy_Feelin_-_www.fesliyanstudios.com_-_David_Renda.mp3'
            ).then((data) => alert(`Done! ${JSON.stringify(data)}`));
          }}
        >Load Custom Music</Button>

        {/*
        <Button
          type="warning"
          size="medium"
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.removeCachedMusicForURL(
              'https://www.fesliyanstudios.com/musicfiles/2019-03-06_-_Crazy_Feelin_-_www.fesliyanstudios.com_-_David_Renda.mp3'
            )
          }}
        >Remove cached custom music track</Button>
        */}

        <Button
          type="magic"
          size="medium"
          disabled={roomSid === null}
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.playMusic();
          }}
        >Play Music</Button>

        <Button
          type="danger"
          size="medium"
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.stopMusic();
          }}
        >Stop Music</Button>

        <Button
          type="danger"
          size="medium"
          onPress={() => {
            if (!ref.current) {
              return;
            }

            ref.current.fadeMusicVolume(5, 0).then(() => {
              setTimeout(() => {
                ref.current.stopMusic();
              }, 200);
            });
          }}
        >Fade and Stop Music</Button>
      </View>

      <BattleView
        onConnect={async (token, battle) => {
          return new Promise(resolve => {
            if (!ref.current) {
              return;
            }

            // Wait for all three track ids to get populated before resolving
            let videoTrackId: string | null = 'ALREADY SET';
            let audioTrackId: string | null = null;
            let dataTrackId: string | null = null;
            callOnTrackAdd.current = (trackType, trackData) => {
              switch (trackType) {
                case 'video':
                  videoTrackId = trackData.track.trackSid;
                  break;
                case 'audio':
                  audioTrackId = trackData.track.trackSid;
                  break;
                case 'data':
                  dataTrackId = trackData.track.trackSid;
                  break;
              }

              console.log('TRACK ADD', videoTrackId, audioTrackId, dataTrackId);
              if (videoTrackId && audioTrackId && dataTrackId) {
                callOnTrackAdd.current = null;
                resolve([videoTrackId, audioTrackId, dataTrackId]);
              }
            };

            ref.current.startLocalVideo();
            ref.current.setLocalVideoEnabled(true, "front");
            // ref.current.toggleSoundSetup(true);

            ref.current.connect({
              accessToken: token,
              roomName: battle.twilioRoomName,
              enableNetworkQualityReporting: true,
              enableVideo: true,
              enableAudio: true,
            });
          });
        }}
        onLoadMusic={async (url) => {
          if (!ref.current) {
            return;
          }

          return ref.current.downloadMusicFromURLAndMakeActive(url);
        }}
        onPlayMusic={() => {
          if (!ref.current) {
            return;
          }

          ref.current.playMusic();
        }}
        onStopMusic={() => {
          if (!ref.current) {
            return;
          }

          ref.current.stopMusic();
        }}
        onDisconnect={() => {
          if (!ref.current) {
            return;
          }

          ref.current.disconnect();
        }}
        onSendString={data => {
          if (!ref.current) {
            return;
          }
          console.log('SEND STRING:', data);

          ref.current.sendString(JSON.stringify(data));
        }}
        onDisableLocalAudio={() => {
          if (!ref.current) {
            return;
          }
          console.log('SET LOCAL AUDIO ENABLED: false');

          setLocalAudioEnabledIndicator(false);
          ref.current.setLocalAudioEnabled(false);
        }}
        onEnableLocalAudio={() => {
          if (!ref.current) {
            return;
          }
          console.log('SET LOCAL AUDIO ENABLED: true');

          setLocalAudioEnabledIndicator(true);
          ref.current.setLocalAudioEnabled(true);
        }}
        onSetCallOnDataTrackReceived={(fn) => {
          callOnDataTrackReceived.current = fn;
        }}
      />
      <Text>Local audio enabled: {localAudioEnabledIndicator ? 'yes' : 'no'}</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textInput: {
    width: 300,
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});
