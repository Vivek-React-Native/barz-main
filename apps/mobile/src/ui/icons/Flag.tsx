import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgFlag = (iconProps: IconProps) => {
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
        d="M4 21 5.988 4.102a.1.1 0 0 1 .113-.088l13.66 1.952a.1.1 0 0 1 .046.179L16.092 8.93a.1.1 0 0 0-.01.15l3.762 3.763a.1.1 0 0 1-.064.17L5 14"
      />
    </Svg>
  );
};
export default SvgFlag;
