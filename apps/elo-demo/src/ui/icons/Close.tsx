import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgClose = (iconProps: IconProps) => {
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
        d="M6 20 19 4M20 18 4 6"
      />
    </svg>
  );
};
export default SvgClose;
