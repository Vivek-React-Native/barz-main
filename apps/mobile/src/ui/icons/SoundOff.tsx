import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgSoundOff = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <Path
        stroke={iconProps.color || 'white'}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m15 9 6 7M15 15l5.968-5.346M4 14.9V9.1a.1.1 0 0 1 .1-.1h2.865a.1.1 0 0 0 .062-.022l4.81-3.848a.1.1 0 0 1 .163.078v13.584a.1.1 0 0 1-.162.078l-4.81-3.848A.1.1 0 0 0 6.964 15H4.1a.1.1 0 0 1-.1-.1Z"
      />
    </Svg>
  );
};
export default SvgSoundOff;
