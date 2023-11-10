import * as React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgUser = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <Circle cx={12} cy={7} r={4} stroke={iconProps.color || 'white'} strokeWidth={2} />
      <Path
        stroke={iconProps.color || 'white'}
        strokeWidth={2}
        d="M15 21H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"
      />
    </Svg>
  );
};
export default SvgUser;
