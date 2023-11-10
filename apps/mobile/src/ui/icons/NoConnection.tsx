import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgNoConnection = (iconProps: IconProps) => {
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
        strokeMiterlimit={10}
        strokeWidth={2}
        d="M5.507 4.358 19.19 18.04M7.9 6.75a12.477 12.477 0 0 1 13.62 3.234M4.64 8.603c-.542.413-1.046.873-1.507 1.375M12.653 11.504a6.906 6.906 0 0 1 4.942 2.411M8.61 12.571a6.99 6.99 0 0 0-1.546 1.338M11.56 17.639a1.075 1.075 0 0 1 .767-.314c.288 0 .565.113.772.314"
      />
    </Svg>
  );
};
export default SvgNoConnection;
