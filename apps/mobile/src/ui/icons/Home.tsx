import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgHome = (iconProps: IconProps) => {
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
        d="m11.93 3.07-8.816 8.816a.1.1 0 0 0 .04.165l2.778.926a.1.1 0 0 1 .068.095V20.9a.1.1 0 0 0 .1.1h11.8a.1.1 0 0 0 .1-.1v-7.828a.1.1 0 0 1 .068-.095l2.778-.926a.1.1 0 0 0 .04-.165L12.07 3.07a.1.1 0 0 0-.142 0Z"
      />
    </Svg>
  );
};
export default SvgHome;
