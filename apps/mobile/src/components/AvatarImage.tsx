import { StyleSheet, Image, View, Text } from 'react-native';
import { User as IconUser } from '@barz/mobile/src/ui/icons';
import { Color } from '@barz/mobile/src/ui/tokens';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';

const styles = StyleSheet.create({
  noImageWrapper: {
    backgroundColor: Color.Gray.Dark5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingWrapper: {
    position: 'relative',
  },
  loadingInner: {
    opacity: 0.5,
  },
  loadingIndicatorWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    color: 'white',
    fontWeight: 'bold',
  },
});

const AvatarImage: React.FunctionComponent<{
  profileImageUrl: string | null;
  size?: number;
  loading?: boolean;
  onPress?: () => void;
  decoration?: React.ReactNode;
  testID?: string;
}> = ({ profileImageUrl, size = 32, loading = false, testID, onPress, decoration }) => {
  let inner = profileImageUrl ? (
    <Image
      style={{ width: size, height: size, borderRadius: size / 2 }}
      source={{ uri: profileImageUrl }}
      testID={testID ? `${testID}-set` : undefined}
    />
  ) : (
    <View
      style={[styles.noImageWrapper, { width: size, height: size, borderRadius: size / 2 }]}
      testID={testID ? `${testID}-unset` : undefined}
    >
      <IconUser color={Color.Gray.Dark9} size={size * 0.6} />
    </View>
  );

  if (loading) {
    inner = (
      <View
        style={[styles.loadingWrapper, { width: size, height: size, borderRadius: size / 2 }]}
        testID={testID ? `${testID}-loading` : undefined}
      >
        <View style={styles.loadingInner}>{inner}</View>
        <View style={styles.loadingIndicatorWrapper}>
          <Text style={[styles.loadingIndicator, { fontSize: size / 8 }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (decoration) {
    inner = (
      <View style={{ position: 'relative', width: size, height: size }}>
        {inner}
        {decoration}
      </View>
    );
  }

  if (!onPress) {
    return inner;
  }

  return (
    <PressableChangesOpacity
      onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      testID={testID}
    >
      {inner}
    </PressableChangesOpacity>
  );
};

export const AvatarImageError: React.FunctionComponent<{ size?: number }> = ({ size = 32 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: Color.Red.Dark8,
      backgroundColor: Color.Red.Dark1,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <IconUser size={size * 0.6} color={Color.Red.Dark8} />
  </View>
);

export default AvatarImage;
