import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgUser = (iconProps: IconProps) => {
  const props = {};
  return (
    <svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        cx={12}
        cy={7}
        r={4}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
      />
      <path
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        d="M15 21H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"
      />
    </svg>
  );
};
export default SvgUser;
