import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgLocation = (iconProps: IconProps) => {
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
        d="M12 3C8.686 3 6 5.763 6 9.171 6 14.11 10 19.114 12 21c2-1.552 6-6.091 6-11.829C18 5.763 15.314 3 12 3Z"
      />
      <ellipse
        cx={12}
        cy={9.5}
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        rx={2}
        ry={2.5}
      />
    </svg>
  );
};
export default SvgLocation;
