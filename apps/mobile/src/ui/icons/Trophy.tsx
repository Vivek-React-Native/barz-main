import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgTrophy = (iconProps: IconProps) => {
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
        d="M17 11V3L7 3.5V11c0 2 1 4 5 4s5-2 5-4ZM20 9.5V7h-3v5c2.4 0 3-1.667 3-2.5ZM4 9.5V7h3v5c-2.4 0-3-1.667-3-2.5ZM11.924 15.101 7.62 20.84a.1.1 0 0 0 .08.16h9.087a.1.1 0 0 0 .076-.164l-4.782-5.739a.1.1 0 0 0-.157.004Z"
      />
    </Svg>
  );
};
export default SvgTrophy;
