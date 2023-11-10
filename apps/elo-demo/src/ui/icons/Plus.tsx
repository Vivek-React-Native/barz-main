import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgPlus = (iconProps: IconProps) => {
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
        d="M12 19V5M19 11 5 13"
      />
    </svg>
  );
};
export default SvgPlus;
