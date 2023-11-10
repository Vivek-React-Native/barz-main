import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgWarning = (iconProps: IconProps) => {
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
        d="M12 9v4M12 15v2M10.23 4.363 3.543 17.068C2.842 18.4 3.808 20 5.313 20h13.374c1.505 0 2.471-1.6 1.77-2.931L13.77 4.363c-.75-1.425-2.79-1.425-3.54 0Z"
      />
    </svg>
  );
};
export default SvgWarning;
