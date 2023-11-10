import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgPlay = (iconProps: IconProps) => {
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
        d="M19.835 11.912 5.147 4.078A.1.1 0 0 0 5 4.167v15.666a.1.1 0 0 0 .147.089l14.688-7.834a.1.1 0 0 0 0-.176Z"
      />
    </svg>
  );
};
export default SvgPlay;
