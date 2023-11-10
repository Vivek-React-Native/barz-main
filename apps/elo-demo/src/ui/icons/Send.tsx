import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgSend = (iconProps: IconProps) => {
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
        d="M3 7.5 19.5 5 11 20.5 8 13l4-3"
      />
    </svg>
  );
};
export default SvgSend;
