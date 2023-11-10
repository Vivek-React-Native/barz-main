import * as React from 'react';
import Svg, { Rect } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgMore = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <Rect
        width={4}
        height={4}
        x={21}
        y={10}
        stroke={iconProps.color || 'white'}
        strokeWidth={2}
        rx={1}
        transform="rotate(90 21 10)"
      />
      <Rect
        width={4}
        height={4}
        x={14}
        y={10}
        stroke={iconProps.color || 'white'}
        strokeWidth={2}
        rx={1}
        transform="rotate(90 14 10)"
      />
      <Rect
        width={4}
        height={4}
        x={7}
        y={10}
        stroke={iconProps.color || 'white'}
        strokeWidth={2}
        rx={1}
        transform="rotate(90 7 10)"
      />
    </Svg>
  );
};
export default SvgMore;
