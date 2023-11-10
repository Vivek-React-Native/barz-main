import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgChevronDown = (iconProps: IconProps) => {
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
        strokeLinejoin="round"
        strokeWidth={2}
        d="m5 9 7 7 7-8"
      />
    </svg>
  );
};
export default SvgChevronDown;
