import * as React from 'react';
import { useState } from 'react';
import { Text, View, ViewProps, StyleSheet } from 'react-native';

import * as Tokens from './tokens';

type ChipType = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'magic';

type ChipSize = 'small' | 'medium' | 'large' | 'nano';

type ChipCustomProps = {
  type?: ChipType;
  // variant?: 'default' | 'outline' | 'clear' | 'secondary';
  size?: ChipSize;

  leading?: React.ReactNode;
  count?: number;

  children?: string;
};

type ChipProps = Omit<ViewProps, keyof ChipCustomProps> & ChipCustomProps;

const TYPE_COLORS: {
  [type in ButtonType]: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  }
} = {
  default: {
    backgroundColor: Tokens.Color.Gray100,
    textColor: Tokens.Color.Gray800,
  },
  primary: {
    backgroundColor: Tokens.Color.Gray900,
    textColor: Tokens.Color.White,
  },
  success: {
    backgroundColor: Tokens.Color.Green100,
    textColor: Tokens.Color.White,
  },
  danger: {
    backgroundColor: Tokens.Color.Red100,
    textColor: Tokens.Color.White,
  },
  warning: {
    backgroundColor: Tokens.Color.Yellow100,
    textColor: Tokens.Color.Yellow900,
  },
  magic: {
    backgroundColor: Tokens.Color.Purple200,
    textColor: Tokens.Color.Purple600,
  },
};

const SIZE_HEIGHTS: {
  [size in ChipSize]: {
    chipHeight: number;
    textSize: number;
    startEndHorizontalSpacing: number;
    startEndHorizontalSpacingLeadingTrailing: number;
    gapHorizontalSpacing: number;
    countSize: number;
  }
} = {
  nano: {
    chipHeight: Tokens.FormSize.Nano,
    textSize: 12,
    startEndHorizontalSpacing: Tokens.Space2,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space2,
    gapHorizontalSpacing: Tokens.Space2,
    countSize: Tokens.Space3,
  },
  small: {
    chipHeight: Tokens.FormSize.Small,
    textSize: 12,
    startEndHorizontalSpacing: Tokens.Space3,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space2,
    gapHorizontalSpacing: Tokens.Space2,
    countSize: Tokens.Space3,
  },
  medium: {
    chipHeight: Tokens.FormSize.Medium,
    textSize: 14,
    startEndHorizontalSpacing: Tokens.Space3,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space3,
    gapHorizontalSpacing: Tokens.Space3,
    countSize: Tokens.Space7,
  },
  large: {
    chipHeight: Tokens.FormSize.Large,
    textSize: 16,
    startEndHorizontalSpacing: Tokens.Space3,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space4-2,
    gapHorizontalSpacing: Tokens.Space3,
    countSize: Tokens.Space7,
  },
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Tokens.Space4,
    paddingRight: Tokens.Space4,
    backgroundColor: Tokens.Color.White,

    borderRadius: Tokens.Radius200,
  },

  text: {
    color: Tokens.Color.Gray900,
    fontFamily: 'Menlo',
    fontWeight: Tokens.TextWeightBold,
  },

  count: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.Color.White,
    borderRadius: Tokens.Radius200,
    width: Tokens.Space5,
    height: Tokens.Space5,
  },
});

const Chip: React.FunctionComponent<ChipProps> = ({
  type='default',
  size='small',

  leading,
  count,

  children,
  ...rest
}) => {
  const typeData = TYPE_COLORS[type];
  const sizeData = SIZE_HEIGHTS[size];

  let backgroundColor = typeData.backgroundColor;
  let color = typeData.textColor;

  const showCount = typeof count === 'number';

  return (
    <View
      {...rest}
      style={[
        styles.wrapper,
        {
          height: sizeData.chipHeight,
          backgroundColor,
          gap: sizeData.gapHorizontalSpacing,
          paddingLeft: leading || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
          paddingRight: showCount || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
        },
      ]}
    >
      {leading}
      {children ? (
        <Text
          style={[
            styles.text,
            {
              color,
              fontSize: sizeData.textSize,
            },
          ]}
        >{children}</Text>
      ) : null}
      {showCount ? (
        <View style={[styles.count, { color, width: sizeData.countSize, height: sizeData.countSize }]}>
          <Text style={styles.text}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default Chip;
