import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgVideoOn = (iconProps: IconProps) => {
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
        d="M17 10V6H3v12h14v-4l4 2V8l-4 2Z"
      />
    </svg>
  );
};
export default SvgVideoOn;
