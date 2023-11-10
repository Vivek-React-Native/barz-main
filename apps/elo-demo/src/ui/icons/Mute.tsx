import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgMute = (iconProps: IconProps) => {
  const props = {};
  return (
    <svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        d="M9 6a3 3 0 1 1 6 0v5"
      />
      <path
        stroke={iconProps.color || "white"}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m5 6 14 13M19 10a6.97 6.97 0 0 1-1.5 4.33M5 10a7 7 0 0 0 7 7v4"
      />
    </svg>
  );
};
export default SvgMute;
