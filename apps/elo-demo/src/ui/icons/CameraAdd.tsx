import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgCameraAdd = (iconProps: IconProps) => {
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
        d="M3.1 19h17.8a.1.1 0 0 0 .1-.1V8.1a.1.1 0 0 0-.1-.1h-3.859a.1.1 0 0 1-.07-.03l-2.942-2.94a.1.1 0 0 0-.07-.03h-3.912a.1.1 0 0 0-.077.036L7.53 7.964A.1.1 0 0 1 7.453 8H3.1a.1.1 0 0 0-.1.1v10.8a.1.1 0 0 0 .1.1ZM12 10v5.5M9.25 12.75h5.5"
      />
    </svg>
  );
};
export default SvgCameraAdd;
