import React, { useEffect, ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PulsingView = ({
  children,
  duration = 1000,
  scaleTo = 1.1,
  style = {},
}: {
  children: ReactNode;
  duration?: number;
  scaleTo?: number;
  style?: ViewStyle;
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(scaleTo, { duration, easing: Easing.ease }), -1, true);
  }, [duration, scale, scaleTo]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export default PulsingView;
