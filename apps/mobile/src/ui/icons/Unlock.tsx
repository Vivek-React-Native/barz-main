import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgUnlock = (iconProps: IconProps) => {
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
        strokeMiterlimit={10}
        strokeWidth={2}
        d="M17.639 11.542H6.229v8.74h11.41v-8.74Z"
      />
      <Path
        stroke={iconProps.color || 'white'}
        strokeMiterlimit={10}
        strokeWidth={2}
        d="M15.385 7.61a3.454 3.454 0 0 0-6.908 0v3.932"
      />
    </Svg>
  );
};
export default SvgUnlock;
