import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import * as Tokens from './tokens';

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export type ChipSize = 32 | 26 | 22 | 16;
export type ChipType = 'filled' | 'outline';

const TYPE_COLORS: {
  [type in ChipType]: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    selectedBackgroundColor: string;
    selectedTextColor: string;
    selectedBorderColor: string;
  };
} = {
  filled: {
    backgroundColor: Tokens.Color.White,
    textColor: Tokens.Color.Gray.Dark1,
    borderColor: Tokens.Color.White,
    selectedBackgroundColor: Tokens.Color.Yellow.Dark10,
    selectedTextColor: Tokens.Color.Gray.Dark1,
    selectedBorderColor: Tokens.Color.Yellow.Dark10,
  },
  outline: {
    backgroundColor: 'transparent',
    textColor: Tokens.Color.White,
    borderColor: Tokens.Color.White,
    selectedBackgroundColor: 'transparent',
    selectedTextColor: Tokens.Color.Yellow.Dark10,
    selectedBorderColor: Tokens.Color.Yellow.Dark10,
  },
};

const SIZE_HEIGHTS: {
  [size in ChipSize]: {
    textStyle: typeof Tokens.Typography[keyof typeof Tokens.Typography];
    horizontalSpacingTextSide: number;
    horziontalSpacingIconSide: number;
    gapHorizontalSpacing: number;
  };
} = {
  32: {
    textStyle: Tokens.Typography.Body2SemiBold,
    horizontalSpacingTextSide: 12,
    horziontalSpacingIconSide: 10,
    gapHorizontalSpacing: 6,
  },
  26: {
    textStyle: Tokens.Typography.Body3SemiBold,
    horizontalSpacingTextSide: 8,
    horziontalSpacingIconSide: 6,
    gapHorizontalSpacing: 4,
  },
  22: {
    textStyle: Tokens.Typography.Body3SemiBold,
    horizontalSpacingTextSide: 6,
    horziontalSpacingIconSide: 4,
    gapHorizontalSpacing: 4,
  },
  16: {
    textStyle: Tokens.Typography.Label2,
    horizontalSpacingTextSide: 4,
    horziontalSpacingIconSide: 2,
    gapHorizontalSpacing: 2,
  },
};

const ICON_SIZES: { [size in ChipSize]: number } = {
  32: 18,
  26: 16,
  22: 16,
  16: 14,
};

export type ChipProps = {
  size: ChipSize;
  type?: ChipType;

  // if you want to customize the chip appearance
  customBackgroundColor?: string;
  customColor?: string;

  leading?: React.ReactNode | ((iconSize: number, iconColor: string) => React.ReactNode);
  trailing?: React.ReactNode | ((iconSize: number, iconColor: string) => React.ReactNode);
  children?: string | number;

  selected?: boolean;
};

const Chip: React.FunctionComponent<ChipProps> = ({
  size,
  type = 'outline',

  customBackgroundColor,
  customColor,

  leading,
  trailing,
  children,

  selected = 'false',
}) => {
  const typeColors = TYPE_COLORS[type];
  const sizeHeights = SIZE_HEIGHTS[size];
  const iconSize = ICON_SIZES[size];

  // DETERMINE COLORS
  // determine backgroundColor (whether selected or not)
  let backgroundColor = typeColors.backgroundColor;
  if (selected == true) {
    backgroundColor = typeColors.selectedBackgroundColor;
  }

  // determine textColor (whether selected or not)
  let textColor = typeColors.textColor;
  if (selected == true) {
    textColor = typeColors.selectedTextColor;
  }

  // determine borderColor (whether selected or not)
  let borderColor = typeColors.borderColor;
  if (selected == true) {
    borderColor = typeColors.selectedBorderColor;
  }

  // DETERMINE COLORS IF USER HAS INPUT CUSTOM COLORS
  // determine backgroundColor & borderColor (if user has used customBackgroundColor)
  if (customBackgroundColor) {
    backgroundColor = customBackgroundColor;
    borderColor = customBackgroundColor;
  }

  // determine text color (if user has used customColor)
  if (customColor) {
    textColor = customColor;
  }

  // DETERMINE PADDING/SPACING
  let paddingLeft = sizeHeights.horizontalSpacingTextSide;
  let paddingRight = sizeHeights.horizontalSpacingTextSide;
  let gap = sizeHeights.gapHorizontalSpacing;
  if (leading) {
    paddingLeft = sizeHeights.horziontalSpacingIconSide;
  }
  if (trailing) {
    paddingRight = sizeHeights.horziontalSpacingIconSide;
  }
  if (!children) {
    paddingLeft = sizeHeights.horziontalSpacingIconSide;
    paddingRight = sizeHeights.horziontalSpacingIconSide;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor,
          borderWidth: 1,
          borderColor,
          paddingLeft,
          paddingRight,
          gap,
          height: size,
          minWidth: size,
          borderRadius: 9999,
        },
      ]}
    >
      {typeof leading === 'function' ? leading(iconSize, textColor) : leading}
      {children ? (
        <Text
          style={{
            ...sizeHeights.textStyle,
            color: textColor,
          }}
        >
          {children}
        </Text>
      ) : null}
      {typeof trailing === 'function' ? trailing(iconSize, textColor) : trailing}
    </View>
  );
};

export default Chip;
