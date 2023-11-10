import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgClock = (iconProps: IconProps) => {
  const props = {};
  return (
    <svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        cx={12}
        cy={12}
        r={9}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
      />
      <path
        stroke={iconProps.color || "white"}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m11 7 1 5 5 1"
      />
    </svg>
  );
};
export default SvgClock;
