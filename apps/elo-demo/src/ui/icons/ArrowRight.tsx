import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgArrowRight = (iconProps: IconProps) => {
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
        d="m13 19 7-7-8-7M20 12 4 13"
      />
    </svg>
  );
};
export default SvgArrowRight;
