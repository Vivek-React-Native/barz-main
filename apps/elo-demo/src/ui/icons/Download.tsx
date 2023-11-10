import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgDownload = (iconProps: IconProps) => {
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
        d="m6 10 6 6 6-6M12 16V3M4 20h16"
      />
    </svg>
  );
};
export default SvgDownload;
