import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgMessages = (iconProps: IconProps) => {
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
        d="M4.1 20h15.8a.1.1 0 0 0 .1-.1v-9.85a.1.1 0 0 0-.04-.08l-7.9-5.925a.1.1 0 0 0-.12 0L4.04 9.97a.1.1 0 0 0-.04.08v9.85a.1.1 0 0 0 .1.1Z"
      />
      <path
        stroke={iconProps.color || "white"}
        strokeLinejoin="round"
        strokeWidth={2}
        d="m20 10-8 4.5L4 10"
      />
    </svg>
  );
};
export default SvgMessages;
