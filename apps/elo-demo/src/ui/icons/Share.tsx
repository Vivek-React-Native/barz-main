import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgShare = (iconProps: IconProps) => {
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
        d="m18 9-6-6-6 6M12 3v13M4 16v3.9a.1.1 0 0 0 .1.1h15.8a.1.1 0 0 0 .1-.1V16"
      />
    </svg>
  );
};
export default SvgShare;
