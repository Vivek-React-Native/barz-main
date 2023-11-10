import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgMute = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <Path stroke={iconProps.color || 'white'} strokeWidth={2} d="M9 6a3 3 0 1 1 6 0v5" />
      <Path
        stroke={iconProps.color || 'white'}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m5 6 14 13M19 10a6.97 6.97 0 0 1-1.5 4.33M5 10a7 7 0 0 0 7 7v4"
      />
    </Svg>
  );
};
export default SvgMute;
