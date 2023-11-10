import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgSearch = (iconProps: IconProps) => {
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
        d="M13.389 13.389 19 19"
      />
      <circle
        cx={9.5}
        cy={9.5}
        r={5.5}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
      />
    </svg>
  );
};
export default SvgSearch;
