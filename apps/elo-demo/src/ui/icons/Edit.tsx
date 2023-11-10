import * as React from "react";
type IconProps = {
  size?: number,
  color?: string,
};
const SvgEdit = (iconProps: IconProps) => {
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
        d="M4 20.9v-3.86a.1.1 0 0 1 .027-.069L16.929 3.076a.1.1 0 0 1 .144-.003l3.859 3.859a.1.1 0 0 1 .002.139L8.03 20.968a.1.1 0 0 1-.074.032H4.1a.1.1 0 0 1-.1-.1ZM13.5 7l4 4"
      />
    </svg>
  );
};
export default SvgEdit;
