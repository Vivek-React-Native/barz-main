import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgLink = (iconProps: IconProps) => {
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
        strokeWidth={2}
        d="m6.626 11.717-1.98 1.98a3.73 3.73 0 0 0-1.041 2.353c-.048.911.269 1.966 1.324 3.021 2.263 2.263 4.525 1.131 5.374.283l3.394-3.394c1.406-1.406 1.28-3.812-.283-5.374"
      />
      <path
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        d="m17.374 12.283 1.98-1.98c1.406-1.406 1.28-3.812-.283-5.374a4.378 4.378 0 0 0-1.246-.876c-1.414-.659-3.06-.475-4.128.593L10.303 8.04a3.73 3.73 0 0 0-1.041 2.353c-.048.912.269 1.966 1.324 3.021"
      />
    </svg>
  );
};
export default SvgLink;
