import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgExplore = (iconProps: IconProps) => {
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
        d="m10.047 9.984 5.763-1.92a.1.1 0 0 1 .127.126l-1.921 5.763a.1.1 0 0 1-.063.063l-5.763 1.92a.1.1 0 0 1-.127-.126l1.921-5.763a.1.1 0 0 1 .063-.063Z"
      />
    </svg>
  );
};
export default SvgExplore;
