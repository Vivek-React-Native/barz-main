import * as React from 'react';
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgSoundOn = (iconProps: IconProps) => {
  const props = {};
  return (
    <Svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <G stroke={iconProps.color || 'white'} strokeWidth={2} clipPath="url(#sound-on_svg__a)">
        <Path
          strokeLinejoin="round"
          d="M4 14.9V9.1a.1.1 0 0 1 .1-.1h2.865a.1.1 0 0 0 .062-.022l4.81-3.848a.1.1 0 0 1 .163.078v13.584a.1.1 0 0 1-.162.078l-4.81-3.848A.1.1 0 0 0 6.964 15H4.1a.1.1 0 0 1-.1-.1Z"
        />
        <Path d="M15.828 9.172a4 4 0 0 1 0 5.656M18.657 6.343a8 8 0 0 1 0 11.314" />
      </G>
      <Defs>
        <ClipPath id="sound-on_svg__a">
          <Path fill={iconProps.color || 'white'} d="M0 0h24v24H0z" />
        </ClipPath>
      </Defs>
    </Svg>
  );
};
export default SvgSoundOn;
