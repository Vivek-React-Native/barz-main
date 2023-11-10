import { View, Text, StyleSheet } from 'react-native';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  fullScreenMessage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullScreenMessageInner: {
    alignItems: 'center',
    textAlign: 'center',
    width: 320,
  },
  fullScreenMessageText: {
    ...Typography.Body1,
    color: Color.White,
  },
  fullScreenMessageTitle: {
    ...Typography.Heading4,
    color: Color.White,
  },
});

// This component is used to render entire screen bits of infromation / context about the battle
// current state, such as a loss of network conenction, or transition from one battler to another
const FullScreenMessage: React.FunctionComponent<{ title?: string; children: string }> = ({
  title,
  children,
}) => (
  <View style={styles.fullScreenMessage}>
    <View style={styles.fullScreenMessageInner}>
      {title ? <Text style={styles.fullScreenMessageTitle}>{title}</Text> : null}
      <Text style={styles.fullScreenMessageText}>{children}</Text>
    </View>
  </View>
);

export default FullScreenMessage;
