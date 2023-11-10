import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgHeart = (iconProps: IconProps) => {
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
        d="M4.042 5.96c-.499 4.195 3.472 9.782 9.933 13.988a.1.1 0 0 0 .136-.026c2.816-3.98 4.806-8.464 5.452-10.217 1.202-2.995-.275-4.357-2.003-4.68-2.43-.454-4.544 2.03-5.43 3.603a.102.102 0 0 1-.17.01c-1.052-1.445-3.36-4.186-4.914-4.55-1.602-.373-2.837.47-3.004 1.873Z"
      />
    </Svg>
  );
};
export default SvgHeart;
