import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
type IconProps = {
  size?: number;
  color?: string;
};
const SvgChat = (iconProps: IconProps) => {
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
        d="M4 4.1v12.8a.1.1 0 0 0 .1.1h10.872a.1.1 0 0 1 .052.014l4.825 2.895a.1.1 0 0 0 .151-.086V4.1a.1.1 0 0 0-.1-.1H4.1a.1.1 0 0 0-.1.1Z"
      />
    </Svg>
  );
};
export default SvgChat;
