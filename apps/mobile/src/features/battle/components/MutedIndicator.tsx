import { View, StyleSheet } from 'react-native';
import { Color } from '@barz/mobile/src/ui/tokens';
import { Microphone as IconMicrophone, Mute as IconMute } from '@barz/mobile/src/ui/icons';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Color.Yellow.Dark10,

    alignItems: 'center',
    justifyContent: 'center',
  },
  containerMuted: {
    backgroundColor: `rgba(0, 0, 0, 0.4)`,

    alignItems: 'center',
    justifyContent: 'center',
  },
});

const MutedIndicator: React.FunctionComponent<{
  muted?: boolean;
  size?: number;
}> = ({ muted = false, size = 40 }) => (
  <View
    style={[
      styles.container,
      muted ? styles.containerMuted : {},
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
    ]}
  >
    {muted ? <IconMute color={Color.White} /> : <IconMicrophone color={Color.Black} />}
  </View>
);

export default MutedIndicator;
