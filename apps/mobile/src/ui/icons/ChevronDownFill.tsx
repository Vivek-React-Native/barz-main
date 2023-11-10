import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgChevronDownFill = (iconProps: IconProps) => {
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
        fill={iconProps.color || 'white'}
        stroke={iconProps.color || 'white'}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m5 9 7 7 7-8L5 9Z"
      />
    </Svg>
  );
};
export default SvgChevronDownFill;