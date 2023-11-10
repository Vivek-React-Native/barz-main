import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgUserAdd = (iconProps: IconProps) => {
  const props = {};
  return (
    <svg
      width={iconProps.size || 24}
      height={iconProps.size || 24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        stroke={iconProps.color || "white"}
        strokeWidth={2}
        clipPath="url(#user-add_svg__a)"
      >
        <path d="M19 8v6m3-3h-6" />
        <circle cx={9} cy={7} r={4} />
        <path d="M12 21H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      </g>
      <defs>
        <clipPath id="user-add_svg__a">
          <path fill={iconProps.color || "white"} d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
};
export default SvgUserAdd;
