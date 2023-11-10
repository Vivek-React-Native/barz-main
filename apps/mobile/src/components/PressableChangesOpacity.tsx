import * as React from 'react';
import { useState } from 'react';
import { Pressable, PressableProps } from 'react-native';
import { FixMe } from '@barz/mobile/src/lib/fixme';

// A `Pressable`, only when a user presses down, it automatically dims slightly as a hint to the
// user that they pressed the control.
const PressableChangesOpacity: React.FunctionComponent<PressableProps> = (props) => {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      {...props}
      style={[props.style as FixMe, { opacity: pressed ? 0.75 : 1 }]}
      onPressIn={(event) => {
        setPressed(true);
        if (props.onPressIn) {
          props.onPressIn(event);
        }
      }}
      onPressOut={(event) => {
        setPressed(false);
        if (props.onPressOut) {
          props.onPressOut(event);
        }
      }}
    />
  );
};

export default PressableChangesOpacity;
