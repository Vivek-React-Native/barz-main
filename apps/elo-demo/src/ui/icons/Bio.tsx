import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgBio = (iconProps: IconProps) => {
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
        d="m4 11 16 2M4 6l16 2M4 16l9 1"
      />
    </svg>
  );
};
export default SvgBio;
