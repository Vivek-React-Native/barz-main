import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgInfo = (iconProps: IconProps) => {
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
        cy={12}
        r={9}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
      />
      <path
        stroke={iconProps.color || "white"}
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18v-8M12 8V6"
      />
    </svg>
  );
};
export default SvgInfo;
