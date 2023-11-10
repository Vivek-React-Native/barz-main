import * as React from 'react';
import { Fragment, useState, useCallback, useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

const styles = StyleSheet.create({
  left: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '25%',
    height: '25%',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 4,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  right: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '25%',
    height: '25%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopLeftRadius: 4,
    borderColor: 'rgba(255,255,255,0.02)',
  },
});

// This component exposes a set of hidden controls that are rendered on screen that allow a user who
// knows the right set of gestures to access the developer tools menu.
//
// This is rendered both on the login page (pre auth) and also within the settings page (post auth).
const DeveloperModeActivator: React.FunctionComponent<{
  showOnTop?: boolean;
  onActivateDeveloperMode: () => void;
}> = ({ showOnTop = false, onActivateDeveloperMode }) => {
  const [receivedTouches, setReceivedTouches] = useState<
    Array<{ type: 'PRESS' | 'LONG_PRESS'; button: 'left' | 'right' }>
  >([]);

  const onPress = useCallback(
    (button: 'left' | 'right') => {
      setReceivedTouches((touches) => [...touches, { type: 'PRESS', button }]);
    },
    [setReceivedTouches],
  );

  const onLongPress = useCallback(
    (button: 'left' | 'right') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      setReceivedTouches((touches) => [...touches, { type: 'LONG_PRESS', button }]);
    },
    [setReceivedTouches],
  );

  // After two seconds, clear the set of touches that are stored
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setReceivedTouches([]);
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [receivedTouches]);

  // Every time the touches change, see if the touch list matches the set of touches that are
  // expected
  useEffect(() => {
    const lastTouch = receivedTouches.at(-1);
    const lastTouchMatches =
      lastTouch && lastTouch.type === 'LONG_PRESS' && lastTouch.button === 'right';
    if (!lastTouchMatches) {
      return;
    }

    const secondToLastTouch = receivedTouches.at(-2);
    const secondToLastTouchMatches =
      secondToLastTouch &&
      secondToLastTouch.type === 'LONG_PRESS' &&
      secondToLastTouch.button === 'left';
    if (!secondToLastTouchMatches) {
      return;
    }

    const thirdToLastTouch = receivedTouches.at(-3);
    const thirdToLastTouchMatches =
      thirdToLastTouch && thirdToLastTouch.type === 'PRESS' && thirdToLastTouch.button === 'right';
    if (!thirdToLastTouchMatches) {
      return;
    }

    const fourthToLastTouch = receivedTouches.at(-4);
    const fourthToLastTouchMatches =
      fourthToLastTouch &&
      fourthToLastTouch.type === 'PRESS' &&
      fourthToLastTouch.button === 'left';
    if (!fourthToLastTouchMatches) {
      return;
    }

    onActivateDeveloperMode();
  }, [receivedTouches, onActivateDeveloperMode]);

  return (
    <Fragment>
      <Pressable
        style={[styles.left, showOnTop ? { bottom: 'auto', top: 0 } : null]}
        onPress={() => onPress('left')}
        onLongPress={() => onLongPress('left')}
      />
      {receivedTouches.length > 0 ? (
        <Pressable
          style={[styles.right, showOnTop ? { bottom: 'auto', top: 0 } : null]}
          onPress={() => onPress('right')}
          onLongPress={() => onLongPress('right')}
        />
      ) : null}
    </Fragment>
  );
};

export default DeveloperModeActivator;
