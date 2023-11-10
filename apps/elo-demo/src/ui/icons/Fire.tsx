import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgFire = (iconProps: IconProps) => {
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
        d="M16.544 8.5C15.5 12 14 12 13.09 12c1.411-6-1.423-8.5-2.929-9 .491 2.5-1.31 4.667-1.964 5.5L6.23 11C4.5 13.5 4.694 15.888 5.5 17.5c1 2 2.964 3.5 6.5 3.5 4.42 0 7-2.959 7-6 0-2.5-1.474-5.333-2.456-6.5Z"
      />
    </svg>
  );
};
export default SvgFire;
