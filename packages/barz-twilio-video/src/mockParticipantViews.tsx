import * as React from 'react';
import { View, Text, Image } from 'react-native';

export const LocalParticipantView: React.FunctionComponent<{
  enabled: boolean,
  scaleType: 'fit' | 'fill',
  style: any,
}> = ({ style }) => (
  <Image
    source={{uri: "https://barz-assets.s3.amazonaws.com/brian.png"}}
    style={style}
  />
  // <View style={{ ...style, backgroundColor: 'red', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
  //   <Text style={{ color: 'white', fontWeight: 'bold' }}>LOCAL</Text>
  // </View>
);

export const RemoteParticipantView: React.FunctionComponent<{
  enabled: boolean,
  scaleType: 'fit' | 'fill',
  remoteParticipantSid: string,
  remoteParticipantTrackSid: string,
  style: any,
}> = ({ style, remoteParticipantTrackSid }) => (
  <Image
    source={{uri: "https://barz-assets.s3.amazonaws.com/markus.png"}}
    style={style}
  />
  // <View style={{ ...style, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
  //   <Text style={{ color: 'white', fontWeight: 'bold' }}>REMOTE</Text>
  //   <Text style={{ color: 'white', fontSize: 8 }}>{remoteParticipantTrackSid}</Text>
  // </View>
);
