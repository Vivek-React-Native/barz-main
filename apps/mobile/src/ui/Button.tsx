import * as React from 'react';
import { useState } from 'react';
import { View, Text, Pressable, PressableProps, StyleSheet } from 'react-native';

import * as Tokens from './tokens';
import Chip, { ChipProps } from './Chip';

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.Color.White,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  innerFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  text: {
    color: Tokens.Color.Gray.Dark2,
  },
});

type ButtonType =
  | 'primaryAccent'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'outlineAccent'
  | 'text'
  | 'textAccent'
  | 'blurred';
export type ButtonSize = 56 | 48 | 40 | 36 | 32 | 26 | 20;
type ButtonCustomProps = {
  type?: ButtonType;
  size?: ButtonSize;
  disabled?: boolean;
  focused?: boolean;
  loading?: boolean;

  leading?: React.ReactNode | ((color: string, iconSize: number) => React.ReactNode);
  trailing?: React.ReactNode | ((color: string, iconSize: number) => React.ReactNode);
  inner?: React.ReactNode | ((color: string, iconSize: number) => React.ReactNode);
  badge?: string | number;
  color?: string;

  width?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  children?: string | number;
};

export type ButtonProps = Omit<PressableProps, keyof ButtonCustomProps> & ButtonCustomProps;

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
  };
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
  textAccent: {
    backgroundColor: 'transparent',
    textColor: Tokens.Color.Yellow.Dark10,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.Yellow.Dark10,
    disabledBackgroundColor: Tokens.Color.Gray.Dark3,
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: Tokens.Color.Gray.Dark3,
    loadingBackgroundColor: 'transparent',
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: 'transparent',
  },
  blurred: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    textColor: Tokens.Color.White,
    outsideBorderColor: 'transparent',
    focusedInnerBorderColor: Tokens.Color.White,
    disabledBackgroundColor: 'rgba(0, 0, 0, 0.2)',
    disabledTextColor: Tokens.Color.Gray.Dark9,
    disabledOutsideBorderColor: 'transparent',
    loadingBackgroundColor: 'rgba(0, 0, 0, 0.2)',
    loadingTextColor: Tokens.Color.Gray.Dark11,
    loadingOutsideBorderColor: 'transparent',
  },
};

const SIZE_HEIGHTS: {
  [size in ButtonSize]: {
    textStyle: typeof Tokens.Typography[keyof typeof Tokens.Typography];
    horizontalSpacing: number;
    horizontalSpacingWithIcon: number;
    horizontalSpacingWithIconOpposingSide: number;
    gapHorizontalSpacing: number;
  };
} = {
  56: {
    textStyle: Tokens.Typography.Heading4,
    horizontalSpacing: 28,
    horizontalSpacingWithIcon: 26,
    horizontalSpacingWithIconOpposingSide: 28,
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
  36: {
    textStyle: Tokens.Typography.Body2Bold,
    horizontalSpacing: 16,
    horizontalSpacingWithIcon: 14,
    horizontalSpacingWithIconOpposingSide: 16,
    gapHorizontalSpacing: 4,
  },
  32: {
    textStyle: Tokens.Typography.Body2Bold,
    horizontalSpacing: 16,
    horizontalSpacingWithIcon: 14,
    horizontalSpacingWithIconOpposingSide: 16,
    gapHorizontalSpacing: 4,
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

const CHIP_SIZES: { [size in ButtonSize]: ChipProps['size'] } = {
  56: 22,
  48: 22,
  40: 22,
  36: 22,
  32: 22,
  26: 16,
  20: 16,
};

const ICON_SIZES: { [size in ButtonSize]: number } = {
  56: 24,
  48: 21,
  40: 18,
  36: 18,
  32: 18,
  26: 16,
  20: 12,
};

const CHIP_LIGHT_OR_DARK: {
  [type in ButtonType]: [ChipProps['customBackgroundColor'], ChipProps['customColor']];
} = {
  primaryAccent: [Tokens.Color.Black, Tokens.Color.White],
  primary: [Tokens.Color.Black, Tokens.Color.White],
  secondary: [Tokens.Color.White, Tokens.Color.Black],
  outline: [Tokens.Color.White, Tokens.Color.Black],
  outlineAccent: [Tokens.Color.Brand.Yellow, Tokens.Color.Black],
  text: [Tokens.Color.White, Tokens.Color.Black],
  textAccent: [Tokens.Color.Yellow.Dark10, Tokens.Color.Black],
  blurred: [Tokens.Color.White, Tokens.Color.Black],
};

const Button: React.FunctionComponent<ButtonProps> = ({
  type = 'primary',
  size = 32,
  disabled,
  focused,
  loading,

  leading,
  trailing,
  inner,
  badge,
  color,

  width,
  flexGrow = 0,
  flexShrink = 0,

  onPressIn,
  onPressOut,
  children,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);

  const typeColors = TYPE_COLORS[type];
  const sizeHeights = SIZE_HEIGHTS[size];
  const badgeSize = CHIP_SIZES[size];
  const iconSize = ICON_SIZES[size];

  let [badgeBackgroundColor, badgeColor] = CHIP_LIGHT_OR_DARK[type];

  let outsideBorderColor =
    typeColors.outsideBorderColor === 'transparent'
      ? 'transparent'
      : color || typeColors.outsideBorderColor;

  let backgroundColor = typeColors.backgroundColor;
  color = color || typeColors.textColor;
  let borderColor = 'transparent';
  if (focused) {
    borderColor = typeColors.focusedInnerBorderColor;
  } else if (disabled) {
    backgroundColor = typeColors.disabledBackgroundColor;
    if (type === 'blurred') {
      borderColor = 'transparent';
    } else {
      borderColor = typeColors.disabledBackgroundColor;
    }
    color = typeColors.disabledTextColor;
    if (type === 'blurred') {
      outsideBorderColor = 'transparent';
    }
    outsideBorderColor = typeColors.disabledOutsideBorderColor;
    badgeBackgroundColor = typeColors.disabledTextColor;
    if (type === 'outline' || type === 'outlineAccent' || type === 'blurred') {
      badgeColor = Tokens.Color.Black;
    } else {
      badgeColor = typeColors.disabledBackgroundColor;
    }
  } else if (loading) {
    backgroundColor = typeColors.loadingBackgroundColor;
    if (type === 'blurred') {
      borderColor = 'transparent';
    } else {
      borderColor = typeColors.loadingBackgroundColor;
    }
    color = typeColors.loadingTextColor;
    outsideBorderColor = typeColors.loadingOutsideBorderColor;
    badgeBackgroundColor = typeColors.loadingTextColor;
    if (type === 'outline' || type === 'outlineAccent' || type === 'blurred') {
      badgeColor = Tokens.Color.Black;
    } else {
      badgeColor = typeColors.disabledBackgroundColor;
    }
  }

  let paddingLeft = sizeHeights.horizontalSpacing - 3;
  let paddingRight = sizeHeights.horizontalSpacing - 3;
  // the case that the button only has a leading or trailing icon
  if (((leading && !trailing) || (!leading && trailing)) && !children && !badge) {
    if (size === 20) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 20;
    } else if (size === 26) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 26;
    } else if (size === 32) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 32;
    } else if (size === 36) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 36;
    } else if (size === 40) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 40;
    } else if (size === 48) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 48;
    } else if (size === 56) {
      paddingLeft = 0;
      paddingRight = 0;
      width = 56;
    }
  } else if (leading && trailing) {
    paddingLeft = sizeHeights.horizontalSpacingWithIcon - 3;
    paddingRight = sizeHeights.horizontalSpacingWithIcon - 3;
  } else if (leading) {
    paddingLeft = sizeHeights.horizontalSpacingWithIcon - 3;
    paddingRight = sizeHeights.horizontalSpacingWithIconOpposingSide - 3;
  } else if (trailing) {
    paddingLeft = sizeHeights.horizontalSpacingWithIconOpposingSide - 3;
    paddingRight = sizeHeights.horizontalSpacingWithIcon - 3;
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={[
        styles.wrapper,
        {
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
        },
      ]}
      onPressIn={(e) => {
        setPressed(true);
        if (onPressIn) {
          onPressIn(e);
        }
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (onPressOut) {
          onPressOut(e);
        }
      }}
    >
      <View
        style={[
          styles.innerFrame,
          {
            height: size - 2,
            borderColor,

            gap: sizeHeights.gapHorizontalSpacing,
            paddingLeft,
            paddingRight,
            // paddingLeft: leading || trailing ? sizeHeights.horizontalSpacingWithIcon : sizeData.noIconHorizontalSpacing,
            // paddingRight: leading || trailing ? sizeHeights.horizontalSpacingWithIconOpposingSize : sizeData.noIconHorizontalSpacing,
            // gap: sizeData.gapHorizontalSpacing,
          },
        ]}
      >
        {typeof leading === 'function' ? leading(color, iconSize) : leading}

        {children ? (
          <Text
            style={[
              styles.text,
              {
                ...sizeHeights.textStyle,
                color,
              },
            ]}
          >
            {children}
          </Text>
        ) : null}

        {inner || badge || trailing ? (
          <View
            style={{
              flexDirection: 'row',
              gap: sizeHeights.gapHorizontalSpacing,
              paddingLeft: 0,
              alignItems: 'center',
            }}
          >
            {typeof inner === 'function' ? inner(color, iconSize) : inner}
            {badge ? (
              <Chip
                customBackgroundColor={badgeBackgroundColor}
                customColor={badgeColor}
                size={badgeSize}
              >
                {badge}
              </Chip>
            ) : null}
            {typeof trailing === 'function' ? trailing(color, iconSize) : trailing}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

export default Button;
