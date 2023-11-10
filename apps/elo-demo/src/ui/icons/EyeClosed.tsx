import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgEyeClosed = (iconProps: IconProps) => {
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
        d="m9 10 6 4M10 14l4-4M20.959 11.943c-7.456-10.378-15.067-4.484-17.923 0a.1.1 0 0 0 .005.114c7.554 10.277 15.066 4.32 17.922 0a.1.1 0 0 0-.004-.114Z"
      />
    </svg>
  );
};
export default SvgEyeClosed;
