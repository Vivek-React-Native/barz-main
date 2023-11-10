import * as React from 'react';

import { requireNativeViewManager } from 'expo-modules-core';

const BarzTwillioVideoLocalOrRemoteParticipantVideoView = requireNativeViewManager('BarzTwilioVideo');

function TwilioVideoLocalOrRemoteParticipantView(props: {
  scaleType: 'fit' | 'fill',
  local: boolean;
  remoteParticipantSid?: string;
  remoteParticipantTrackSid?: string;
  enabled: boolean,
  style: any,
}) {
  const {
    scaleType,
    style,
    ...restProps
  } = props;
  const scalesType = scaleType === 'fit' ? 1 : 2;
  return (
    <BarzTwillioVideoLocalOrRemoteParticipantVideoView
      scalesType={scalesType}
      style={style}
      {...restProps}
    />
  );
}

export const LocalParticipantView: React.FunctionComponent<{
  enabled: boolean,
  scaleType: 'fit' | 'fill',
  style: any,
}> = ({
  enabled,
  scaleType,
  style,
}) => (
  <TwilioVideoLocalOrRemoteParticipantView
    local={true}
    enabled={enabled}
    scaleType={scaleType}
    style={style}
  />
);

export const RemoteParticipantView: React.FunctionComponent<{
  enabled: boolean,
  scaleType: 'fit' | 'fill',
  remoteParticipantSid: string,
  remoteParticipantTrackSid: string,
  style: any,
}> = ({
  enabled,
  scaleType,
  remoteParticipantSid,
  remoteParticipantTrackSid,
  style,
}) => (
  <TwilioVideoLocalOrRemoteParticipantView
    local={false}
    enabled={enabled}
    scaleType={scaleType}
    remoteParticipantSid={remoteParticipantSid}
    remoteParticipantTrackSid={remoteParticipantTrackSid}
    style={style}
  />
);
