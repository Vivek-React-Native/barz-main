import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgBookmark = (iconProps: IconProps) => {
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
        d="m6.132 19.956 5.836-1.945a.1.1 0 0 1 .064 0l5.836 1.945a.1.1 0 0 0 .132-.095V4.11a.1.1 0 0 0-.108-.1l-11.8.983a.1.1 0 0 0-.092.1v14.77a.1.1 0 0 0 .132.094Z"
      />
    </svg>
  );
};
export default SvgBookmark;
