import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgPause = (iconProps: IconProps) => {
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
        d="m4.056 4.816 5.269.628V18.77l-5.269-.628V4.816ZM14.908 4.816l5.268.628V18.77l-5.268-.628V4.816Z"
      />
    </Svg>
  );
};
export default SvgPause;
