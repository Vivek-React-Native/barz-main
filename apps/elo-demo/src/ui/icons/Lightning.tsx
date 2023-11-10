import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgLightning = (iconProps: IconProps) => {
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
        d="M18 3 8 4l-3 8h5l-2.5 9.5L20 9h-5l3-6Z"
      />
    </svg>
  );
};
export default SvgLightning;
