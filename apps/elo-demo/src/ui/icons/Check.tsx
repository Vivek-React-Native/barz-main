import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgCheck = (iconProps: IconProps) => {
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
        d="m5 9 1.959 10.775a.1.1 0 0 0 .178.042L19 4"
      />
    </svg>
  );
};
export default SvgCheck;
