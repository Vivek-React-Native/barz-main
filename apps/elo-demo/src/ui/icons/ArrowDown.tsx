import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgArrowDown = (iconProps: IconProps) => {
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
        d="m5 13 7 7 7-8M12 20 11 4"
      />
    </svg>
  );
};
export default SvgArrowDown;
