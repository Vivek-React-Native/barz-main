import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgVideoOff = (iconProps: IconProps) => {
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
        d="M3 8v10h8M5.5 6H17v4l4-2v8l-4-2v6L4 4"
      />
    </svg>
  );
};
export default SvgVideoOff;
