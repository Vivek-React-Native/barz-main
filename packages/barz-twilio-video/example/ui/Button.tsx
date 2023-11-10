import * as React from 'react';
import { useState } from 'react';
import { Text, Pressable, PressableProps, StyleSheet } from 'react-native';

import * as Tokens from './tokens';

type ButtonType = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'magic';

type ButtonSize = 'small' | 'medium' | 'large' | 'nano';

type ButtonCustomProps = {
  type?: ButtonType;
  // variant?: 'default' | 'outline' | 'clear' | 'secondary';
  size?: ButtonSize;
  disabled?: boolean;
  rounded?: boolean;

  leading?: React.ReactNode;
  trailing?: React.ReactNode;

  width?: string | number;
  children?: string;
};

type ButtonProps = Omit<PressableProps, keyof ButtonCustomProps> & ButtonCustomProps;

const TYPE_COLORS: {
  [type in ButtonType]: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    pressedBackgroundColor: string;
    pressedBorderColor: string;
    pressedTextColor: string;
    disabledBackgroundColor: string;
    disabledTextColor: string;
  }
} = {
  default: {
    backgroundColor: Tokens.Color.White,
    borderColor: Tokens.Color.Gray300,
    textColor: Tokens.Color.Gray800,
    pressedBackgroundColor: Tokens.Color.Gray200,
    pressedBorderColor: Tokens.Color.Gray300,
    pressedTextColor: Tokens.Color.Gray900,
    disabledBackgroundColor: Tokens.Color.Gray200,
    disabledTextColor: Tokens.Color.Gray500,
  },
  primary: {
    backgroundColor: Tokens.Color.Gray800,
    borderColor: Tokens.Color.Gray900,
    textColor: Tokens.Color.White,
    pressedBackgroundColor: Tokens.Color.Gray900,
    pressedBorderColor: Tokens.Color.Gray900,
    pressedTextColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Gray300,
    disabledTextColor: Tokens.Color.Gray500,
  },
  success: {
    backgroundColor: Tokens.Color.Green500,
    borderColor: Tokens.Color.Green600,
    textColor: Tokens.Color.White,
    pressedBackgroundColor: Tokens.Color.Green600,
    pressedBorderColor: Tokens.Color.Green600,
    pressedTextColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Green100,
    disabledTextColor: Tokens.Color.Green500,
  },
  danger: {
    backgroundColor: Tokens.Color.Red500,
    borderColor: Tokens.Color.Red600,
    textColor: Tokens.Color.White,
    pressedBackgroundColor: Tokens.Color.Red600,
    pressedBorderColor: Tokens.Color.Red600,
    pressedTextColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Red100,
    disabledTextColor: Tokens.Color.Red500,
  },
  warning: {
    backgroundColor: Tokens.Color.Yellow500,
    borderColor: Tokens.Color.Yellow600,
    textColor: Tokens.Color.White,
    pressedBackgroundColor: Tokens.Color.Yellow600,
    pressedBorderColor: Tokens.Color.Yellow600,
    pressedTextColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Yellow100,
    disabledTextColor: Tokens.Color.Yellow500,
  },
  magic: {
    backgroundColor: Tokens.Color.Purple500,
    borderColor: Tokens.Color.Purple600,
    textColor: Tokens.Color.White,
    pressedBackgroundColor: Tokens.Color.Purple600,
    pressedBorderColor: Tokens.Color.Purple600,
    pressedTextColor: Tokens.Color.White,
    disabledBackgroundColor: Tokens.Color.Purple100,
    disabledTextColor: Tokens.Color.Purple500,
  },
};

const SIZE_HEIGHTS: {
  [size in ButtonSize]: {
    buttonHeight: number;
    textSize: number;
    startEndHorizontalSpacing: number;
    startEndHorizontalSpacingLeadingTrailing: number;
    gapHorizontalSpacing: number;
  }
} = {
  nano: {
    buttonHeight: Tokens.FormSize.Nano,
    textSize: 12,
    startEndHorizontalSpacing: Tokens.Space3,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space2,
    gapHorizontalSpacing: Tokens.Space2,
  },
  small: {
    buttonHeight: Tokens.FormSize.Small,
    textSize: 12,
    startEndHorizontalSpacing: Tokens.Space3,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space2,
    gapHorizontalSpacing: Tokens.Space2,
  },
  medium: {
    buttonHeight: Tokens.FormSize.Medium,
    textSize: 14,
    startEndHorizontalSpacing: Tokens.Space4,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space3,
    gapHorizontalSpacing: Tokens.Space3,
  },
  large: {
    buttonHeight: Tokens.FormSize.Large,
    textSize: 16,
    startEndHorizontalSpacing: Tokens.Space5,
    startEndHorizontalSpacingLeadingTrailing: Tokens.Space4-2,
    gapHorizontalSpacing: Tokens.Space3,
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

    borderWidth: 1,
    borderColor: Tokens.Color.Gray300,
  },

  text: {
    color: Tokens.Color.Gray900,
    fontFamily: 'Menlo',
    fontWeight: Tokens.TextWeightBold,
  },
});

const Button: React.FunctionComponent<ButtonProps> = ({
  type='default',
  // variant='default',
  size='small',
  disabled=false,
  rounded=false,
  width,

  leading,
  trailing,

  onPressIn,
  onPressOut,
  children,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);

  const typeData = TYPE_COLORS[type];
  const sizeData = SIZE_HEIGHTS[size];

  let backgroundColor = typeData.backgroundColor;
  if (pressed) {
    backgroundColor = typeData.pressedBackgroundColor;
  }
  if (disabled) {
    backgroundColor = typeData.disabledBackgroundColor;
  }

  let borderColor = typeData.borderColor;
  if (pressed) {
    borderColor = typeData.pressedBorderColor;
  }
  if (disabled) {
    borderColor = typeData.disabledBackgroundColor;
  }

  let color = typeData.textColor;
  if (pressed) {
    color = typeData.pressedTextColor;
  }
  if (disabled) {
    color = typeData.disabledTextColor;
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={[
        styles.wrapper,
        {
          width,
          height: sizeData.buttonHeight,
          backgroundColor,
          borderColor,
          gap: sizeData.gapHorizontalSpacing,
          paddingLeft: leading || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
          paddingRight: trailing || !children ? sizeData.startEndHorizontalSpacingLeadingTrailing : sizeData.startEndHorizontalSpacing,
          borderRadius: rounded ? Tokens.RadiusRounded : Tokens.Radius200,
        },
      ]}
      onPressIn={e => {
        setPressed(true);
        if (onPressIn) {
          onPressIn(e);
        }
      }}
      onPressOut={e => {
        setPressed(false);
        if (onPressOut) {
          onPressOut(e);
        }
      }}
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
      {trailing}
    </Pressable>
  );
};

export default Button;
