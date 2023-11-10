import * as React from 'react';
import { useState } from 'react';

import * as Tokens from './tokens';
import Chip, { ChipProps } from './Chip';

const styles = ({
  wrapper: {
    display: 'inline-flex' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Tokens.Color.White,
    borderWidth: 1,
    borderColor: 'transparent' as const,
    cursor: 'pointer' as const,
    padding: 0,
    outline: 'none',
  },

  innerFrame: {
    display: 'flex' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderStyle: 'solid',
  },

  text: {
    color: Tokens.Color.Gray900,
    fontFamily: 'Menlo',
    fontWeight: Tokens.TextWeightBold,
  },
});

type ButtonType = 'primaryAccent' | 'primary' | 'secondary' | 'outline' | 'outlineAccent' | 'text';
export type ButtonSize = 56 | 48 | 40 | 32 | 26 | 20;
type ButtonCustomProps = {
  type?: ButtonType;
  size?: ButtonSize;
  disabled?: boolean;
  // focused?: boolean;
  loading?: boolean;

  leading?: React.ReactNode | ((color: string) => React.ReactNode);
  trailing?: React.ReactNode | ((color: string) => React.ReactNode);
  inner?: React.ReactNode | ((color: string) => React.ReactNode);
  badge?: string | number;
  color?: string;

  width?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  children?: string | number;
};

export type ButtonProps = Omit<React.HTMLProps<HTMLButtonElement>, keyof ButtonCustomProps> & ButtonCustomProps;

const TYPE_COLORS: {
  [type in ButtonType]: {
    backgroundColor: string;
    textColor: string;
    outsideBorderColor: string;
    focusedInnerBorderColor: string;
    disabledBackgroundColor: string;
    disabledTextColor: string;
    disabledOutsideBorderColor: string;
    loadingBackgroundColor: string;
    loadingTextColor: string;
    loadingOutsideBorderColor: string;
  }
} = {
  primaryAccent: {
    backgroundColor: Tokens.Color.Brand.Yellow,
    textColor: Tokens.Color.Black,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.Black,
    disabledBackgroundColor: Tokens.Color.Gray.Dark3,
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: Tokens.Color.Gray.Dark3,
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: Tokens.Color.Gray.Dark3,
  },
  primary: {
    backgroundColor: Tokens.Color.White,
    textColor: Tokens.Color.Black,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.Black,
    disabledBackgroundColor: Tokens.Color.Gray.Dark3,
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: Tokens.Color.Gray.Dark3,
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: Tokens.Color.Gray.Dark3,
  },
  secondary: {
    backgroundColor: Tokens.Color.Gray.Dark3,
    textColor: Tokens.Color.White,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Gray.Dark3,
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: Tokens.Color.Gray.Dark3,
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: Tokens.Color.Gray.Dark3,
  },
  outline: {
    backgroundColor: 'transparent',
    textColor: Tokens.Color.White,
    outsideBorderColor: Tokens.Color.White,
    focusedInnerBorderColor: Tokens.Color.White,
    disabledBackgroundColor: 'transparent',
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: 'transparent',
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: Tokens.Color.Gray.Dark6,
  },
  outlineAccent: {
    backgroundColor: 'transparent',
    textColor: Tokens.Color.Brand.Yellow,
    outsideBorderColor: Tokens.Color.Brand.Yellow,
    focusedInnerBorderColor: Tokens.Color.Brand.Yellow,
    disabledBackgroundColor: 'transparent',
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: 'transparent',
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: Tokens.Color.Gray.Dark6,
  },
  text: {
    backgroundColor: 'transparent',
    textColor: Tokens.Color.White,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Gray.Dark3,
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: 'transparent',
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: 'transparent',
  },
};

const SIZE_HEIGHTS: {
  [size in ButtonSize]: {
    textStyle: typeof Tokens.Typography[keyof typeof Tokens.Typography],
    horizontalSpacing: number;
    horizontalSpacingWithIcon: number;
    horizontalSpacingWithIconOpposingSide: number;
    gapHorizontalSpacing: number;
  }
} = {
  56: {
    textStyle: Tokens.Typography.Heading4,
    horizontalSpacing: 24,
    horizontalSpacingWithIcon: 22,
    horizontalSpacingWithIconOpposingSide: 24,
    gapHorizontalSpacing: 8,
  },
  48: {
    textStyle: Tokens.Typography.Heading5,
    horizontalSpacing: 20,
    horizontalSpacingWithIcon: 14,
    horizontalSpacingWithIconOpposingSide: 16,
    gapHorizontalSpacing: 6,
  },
  40: {
    textStyle: Tokens.Typography.Body1Bold,
    horizontalSpacing: 16,
    horizontalSpacingWithIcon: 14,
    horizontalSpacingWithIconOpposingSide: 16,
    gapHorizontalSpacing: 6,
  },
  32: {
    textStyle: Tokens.Typography.Body2Bold,
    horizontalSpacing: 16,
    horizontalSpacingWithIcon: 12,
    horizontalSpacingWithIconOpposingSide: 10,
    gapHorizontalSpacing: 6,
  },
  26: {
    textStyle: Tokens.Typography.Body3Bold,
    horizontalSpacing: 12,
    horizontalSpacingWithIcon: 12,
    horizontalSpacingWithIconOpposingSide: 12,
    gapHorizontalSpacing: 4,
  },
  20: {
    textStyle: Tokens.Typography.Body3Bold,
    horizontalSpacing: 8,
    horizontalSpacingWithIcon: 6,
    horizontalSpacingWithIconOpposingSide: 8,
    gapHorizontalSpacing: 4,
  },
};

const CHIP_SIZES: { [size in ButtonSize]: ChipProps['size']} = {
  56: 22,
  48: 22,
  40: 22,
  32: 22,
  26: 16,
  20: 16,
};

const CHIP_LIGHT_OR_DARK: { [type in ButtonType]: [ChipProps['backgroundColor'], ChipProps['color']]} = {
  primaryAccent: [Tokens.Color.Black, Tokens.Color.White],
  primary: [Tokens.Color.Black, Tokens.Color.White],
  secondary: [Tokens.Color.White, Tokens.Color.Black],
  outline: [Tokens.Color.White, Tokens.Color.Black],
  outlineAccent: [Tokens.Color.Brand.Yellow, Tokens.Color.Black],
  text: [Tokens.Color.White, Tokens.Color.Black],
};

const Button: React.FunctionComponent<ButtonProps> = ({
  type = 'primary',
  size = 32,
  disabled,
  // focused,
  loading,

  leading,
  trailing,
  inner,
  badge,
  color,

  width,
  flexGrow=0,
  flexShrink=0,

  onMouseUp,
  onMouseDown,
  onFocus,
  onBlur,
  children,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  const typeColors = TYPE_COLORS[type];
  const sizeHeights = SIZE_HEIGHTS[size];
  const badgeSize = CHIP_SIZES[size];
  let [badgeBackgroundColor, badgeColor] = CHIP_LIGHT_OR_DARK[type];

  let outsideBorderColor = typeColors.outsideBorderColor;

  let backgroundColor = typeColors.backgroundColor;
  color = color || typeColors.textColor;
  let borderColor = typeColors.backgroundColor;
  if (focused) {
    borderColor = typeColors.focusedInnerBorderColor;
  } else if (disabled) {
    backgroundColor = typeColors.disabledBackgroundColor;
    borderColor = typeColors.disabledBackgroundColor;
    color = typeColors.disabledTextColor;
    outsideBorderColor = typeColors.disabledOutsideBorderColor;
    badgeBackgroundColor = typeColors.disabledTextColor;
  } else if (loading) {
    backgroundColor = typeColors.loadingBackgroundColor;
    borderColor = typeColors.loadingBackgroundColor;
    color = typeColors.loadingTextColor;
    outsideBorderColor = typeColors.loadingOutsideBorderColor;
    badgeBackgroundColor = typeColors.loadingTextColor;
  }

  let paddingLeft = sizeHeights.horizontalSpacing - 3;
  let paddingRight = sizeHeights.horizontalSpacing - 3;
  if (leading && !children) {
    paddingLeft = 0;
    paddingRight = 0;
  } else if (leading && trailing) {
    paddingLeft = sizeHeights.horizontalSpacingWithIcon - 3;
    paddingRight = sizeHeights.horizontalSpacingWithIcon - 3;
  } else if (leading) {
    paddingLeft = sizeHeights.horizontalSpacingWithIcon - 3;
    // paddingRight = sizeHeights.horizontalSpacingWithIconOpposingSide - 3;
    paddingRight = sizeHeights.horizontalSpacingWithIconOpposingSide;
  } else if (trailing) {
    // paddingLeft = sizeHeights.horizontalSpacingWithIconOpposingSide - 3;
    paddingLeft = sizeHeights.horizontalSpacingWithIconOpposingSide;
    paddingRight = sizeHeights.horizontalSpacingWithIcon - 3;
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        ...styles.wrapper,
        width,
        height: size,
        flexGrow,
        flexShrink,
        backgroundColor,
        borderColor: outsideBorderColor,

        // FIXME: add some sort of official pressed state for buttons?
        opacity: pressed ? 0.75 : 1,

        // paddingLeft: leading || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
        // paddingRight: trailing || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
      }}
      onFocus={e => {
        setFocused(true);
        if (onFocus) {
          onFocus(e);
        }
      }}
      onBlur={e => {
        setFocused(false);
        if (onBlur) {
          onBlur(e);
        }
      }}
      onMouseDown={e => {
        setPressed(true);
        if (onMouseUp) {
          onMouseUp(e);
        }
        const onMouseUpHandler = () => {
          window.removeEventListener('mouseup', onMouseUpHandler);
          setPressed(false);
          if (onMouseDown) {
            onMouseDown(e);
          }
        };
        window.addEventListener('mouseup', onMouseUpHandler);
      }}
    >
      <div
        style={{
          ...styles.innerFrame,
          width,
          height: size-6,
          borderColor,

          gap: sizeHeights.gapHorizontalSpacing,
          paddingLeft,
          paddingRight,
          // paddingLeft: leading || trailing ? sizeHeights.horizontalSpacingWithIcon : sizeData.noIconHorizontalSpacing,
          // paddingRight: leading || trailing ? sizeHeights.horizontalSpacingWithIconOpposingSize : sizeData.noIconHorizontalSpacing,
          // gap: sizeData.gapHorizontalSpacing,
        }}
      >
        {typeof leading === 'function' ? leading(color) : leading}

        {children ? (
          <span
            style={{
              ...styles.text,
              ...sizeHeights.textStyle,
              color,
            }}
          >{children}</span>
        ) : null}

        {inner || badge || trailing ? (
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: sizeHeights.gapHorizontalSpacing,
            paddingLeft: 4,
            alignItems: 'center',
          }}>
            {typeof inner === 'function' ? inner(color) : inner}
            {badge ? (
              <Chip backgroundColor={badgeBackgroundColor} color={badgeColor} size={badgeSize}>{badge}</Chip>
            ) : null}
            {typeof trailing === 'function' ? trailing(color) : trailing}
          </div>
        ) : null}
      </div>
    </button>
  );
};

export default Button;
