import * as React from 'react';
import Svg, { G, Path, Circle, Defs, ClipPath } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgUserAdd = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <G stroke={iconProps.color || 'white'} strokeWidth={2} clipPath="url(#user-add_svg__a)">
        <Path d="M19 8v6m3-3h-6" />
        <Circle cx={9} cy={7} r={4} />
        <Path d="M12 21H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      </G>
      <Defs>
        <ClipPath id="user-add_svg__a">
          <Path fill={iconProps.color || 'white'} d="M0 0h24v24H0z" />
        </ClipPath>
      </Defs>
    </Svg>
  );
};
export default SvgUserAdd;
