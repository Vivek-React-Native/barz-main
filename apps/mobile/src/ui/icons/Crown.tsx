import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgCrown = (iconProps: IconProps) => {
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
        d="m3.088 13.176 2.884 5.769a.1.1 0 0 0 .09.055h12.863a.1.1 0 0 0 .096-.073l1.923-6.731a.1.1 0 0 0-.133-.12l-4.726 1.89a.1.1 0 0 1-.126-.048l-3.856-7.713a.1.1 0 0 0-.184.01l-2.89 7.708a.1.1 0 0 1-.11.063l-5.725-.954a.1.1 0 0 0-.106.144ZM15 5l2-2m0 6 2.5-1M9 5 7 3m.5 6L5 8"
      />
    </Svg>
  );
};
export default SvgCrown;
