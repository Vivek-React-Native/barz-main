import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgStar = (iconProps: IconProps) => {
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
        d="M11.91 3.179 9.024 8.954a.1.1 0 0 1-.073.054l-5.782.964a.1.1 0 0 0-.062.161l3.866 4.832a.1.1 0 0 1 .02.079l-.96 5.762a.1.1 0 0 0 .144.106l5.78-2.89a.1.1 0 0 1 .089 0l5.78 2.89a.1.1 0 0 0 .143-.106l-.96-5.762a.1.1 0 0 1 .02-.079l3.866-4.832a.1.1 0 0 0-.062-.161l-5.782-.964a.1.1 0 0 1-.073-.054L12.09 3.18a.1.1 0 0 0-.178 0Z"
      />
    </svg>
  );
};
export default SvgStar;
