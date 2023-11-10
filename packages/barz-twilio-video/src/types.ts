export type Participant = {
  identity: string;
  sid: string;
  state: number;
  networkQualityLevel: number;
  videoTrackSids: Array<Publication['trackSid']>;
  audioTrackSids: Array<Publication['trackSid']>;
  dataTrackSids: Array<Publication['trackSid']>;
};

export type Publication = {
  track: {
    isEnabled: boolean;
    name: string;
    state: string;
  } | null;
  trackEnabled: boolean;
  trackName: string;
  trackSid: string;
};

export type StatsReport = {
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

export type StatsResponse = { [peerConnectionId: string]: StatsReport };

export type CameraType = "front" | "back";

export type ConnectParameters = {
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
};
