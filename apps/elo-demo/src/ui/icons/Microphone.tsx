import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgMicrophone = (iconProps: IconProps) => {
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
        d="M5 10a7 7 0 1 0 14 0M12 17v4"
      />
      <path
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        d="M12 3a3 3 0 0 0-3 3v4c0 .534.171 1.353.695 2 .458.565 1.186 1 2.305 1 2.4 0 3-2 3-3V6a3 3 0 0 0-3-3Z"
      />
    </svg>
  );
};
export default SvgMicrophone;
