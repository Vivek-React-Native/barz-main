import * as React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgClock = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <Circle cx={12} cy={12} r={9} stroke={iconProps.color || 'white'} strokeWidth={2} />
      <Path
        stroke={iconProps.color || 'white'}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m11 7 1 5 5 1"
      />
    </Svg>
  );
};
export default SvgClock;
