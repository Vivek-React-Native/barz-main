import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgChallenge = (iconProps: IconProps) => {
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
        d="M12.025 9.589v6.6H7.51V8.916v6.6H2.995V6.349L7.51 4.15H12l2.286-1.382 2.254 1.42h4.515v12H16.54V8.954v7.234h-4.515V8.954v.634Z"
      />
      <Path
        stroke={iconProps.color || 'white'}
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={2}
        d="M19.711 16.188h-8.419a1 1 0 0 0-1 1v3.603h8.42a1 1 0 0 0 1-1v-3.603Z"
      />
    </Svg>
  );
};
export default SvgChallenge;
