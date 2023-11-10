import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgMenu = (iconProps: IconProps) => {
  const props = {};
  return (
    <svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect
        width={4}
        height={4}
        x={10}
        y={3}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        rx={1}
      />
      <rect
        width={4}
        height={4}
        x={10}
        y={10}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        rx={1}
      />
      <rect
        width={4}
        height={4}
        x={10}
        y={17}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        rx={1}
      />
    </svg>
  );
};
export default SvgMenu;
