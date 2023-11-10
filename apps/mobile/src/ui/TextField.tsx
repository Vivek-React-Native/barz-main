import * as React from 'react';
import { useState } from 'react';
import { Text, View, TextInput, TextInputProps, StyleSheet, Platform } from 'react-native';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import * as Tokens from './tokens';

export type TextFieldType = 'box' | 'boxOutline' | 'clear';
export type TextFieldSize = 72 | 56 | 48 | 40 | 36 | 32 | 26 | 20;

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
  },
  leadingTrailingText: {
    color: Tokens.Color.Gray.Dark11,
    // paddingLeft
    // paddingRight
    paddingTop: 2,
  },

  labelText: {
    ...Tokens.Typography.Body2,
    color: Tokens.Color.Gray.Dark11,
  },

  labelNodeWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  supportingText: {
    ...Tokens.Typography.Label1,
    color: Tokens.Color.Gray.Dark10,
  },

  supportingTextNodeWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  input: {
    color: Tokens.Color.White,

    padding: 0,
    margin: 0,

    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: 'transparent',
  },
  inputDisabled: {
    color: Tokens.Color.Gray.Dark7,
    display: 'flex',
    flexDirection: 'column',
  },

  textFieldWrapper: {
    display: 'flex',
    flexDirection: 'column',
  },
});

type TextFieldCustomProps = {
  type?: TextFieldType;
  size?: TextFieldSize;
  disabled?: boolean;
  error?: boolean;
  bottomSheetTextInputEnabled?: boolean;

  label?: string | ((color: string) => React.ReactNode);
  labelRequired?: boolean;

  supportingText?: string | ((color: string) => React.ReactNode);

  leadingIcon?: React.ReactNode | ((color: string, iconSize: number) => React.ReactNode);
  leadingText?: string | ((color: string) => React.ReactNode);
  trailingIcon?: React.ReactNode | ((color: string, iconSize: number) => React.ReactNode);
  trailingText?: string | ((color: string) => React.ReactNode);

  textAlign?: 'left' | 'right' | 'center';

  statusColor?: string;

  width?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  // children?: string | number;
};

type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | keyof TextFieldCustomProps
> &
  TextFieldCustomProps;

const SIZE_PROPERTIES: {
  [key in TextFieldSize]: {
    textStyle: FixMe;
    verticalSpacing: number;
    horizontalSpacingClear: number;
    horizontalSpacingBox: number;
    leadingTrailingTextHorizontalSpacing: number;
    leadingTrailingIconHorizontalSpacing: number;
    gapHorizontalSpacing: number;
    labelMarginBottomClear: number;
    labelMarginBottomBox: number;
  };
} = {
  72: {
    textStyle: {
      ...Tokens.Typography.Body1,
      fontSize: 40,
      lineHeight: Platform.select({ ios: 44, android: 64 }),
    },
    verticalSpacing: 12,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 16,
    leadingTrailingTextHorizontalSpacing: 8,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 8,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 6,
  },
  56: {
    textStyle: {
      ...Tokens.Typography.Body1,
      fontSize: 22,
      lineHeight: Platform.select({ ios: 24, android: 48 }),
    },
    verticalSpacing: 12,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 16,
    leadingTrailingTextHorizontalSpacing: 4,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 8,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 6,
  },
  48: {
    textStyle: {
      ...Tokens.Typography.Body1,
      fontSize: 18,
      lineHeight: Platform.select({ ios: 20, android: 36 }),
    },
    verticalSpacing: 10,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 14,
    leadingTrailingTextHorizontalSpacing: 4,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 8,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 6,
  },
  40: {
    textStyle: {
      ...Tokens.Typography.Body1,
      fontSize: 18,
      lineHeight: Platform.select({ ios: 20, android: 30 }),
    },
    verticalSpacing: 10,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 12,
    leadingTrailingTextHorizontalSpacing: 2,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 6,
  },
  36: {
    textStyle: {
      ...Tokens.Typography.Body2,
      lineHeight: Platform.select({ ios: 16, android: 32 }),
    },
    verticalSpacing: 10,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 12,
    leadingTrailingTextHorizontalSpacing: 2,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 4,
  },
  32: {
    textStyle: {
      ...Tokens.Typography.Body2,
      lineHeight: Platform.select({ ios: 16, android: 32 }),
    },
    verticalSpacing: 8,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 10,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 4,
  },
  26: {
    textStyle: {
      ...Tokens.Typography.Body2,
      lineHeight: Platform.select({ ios: 16, android: 32 }),
    },
    verticalSpacing: 8,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 8,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 2,
  },
  20: {
    textStyle: {
      ...Tokens.Typography.Body3,
      lineHeight: Platform.select({ ios: 13, android: 24 }),
    },
    verticalSpacing: 7,
    horizontalSpacingClear: 0,
    horizontalSpacingBox: 6,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6,
    labelMarginBottomClear: 0,
    labelMarginBottomBox: 2,
  },
};

const ICON_SIZES: { [size in TextFieldSize]: number } = {
  72: 32,
  56: 24,
  48: 21,
  40: 18,
  36: 18,
  32: 18,
  26: 16,
  20: 12,
};

const TextFieldRaw: React.FunctionComponent<
  TextFieldProps & { customRef?: React.Ref<TextInput> }
> = ({
  type = 'box',
  size = 32,
  disabled = false,
  error = false,
  bottomSheetTextInputEnabled = false,
  label,
  labelRequired,
  supportingText,
  leadingIcon,
  leadingText,
  trailingIcon,
  trailingText,
  statusColor,
  textAlign,
  width,
  flexGrow,
  flexShrink,

  customRef,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const TextInputComponent = bottomSheetTextInputEnabled ? BottomSheetTextInput : TextInput;

  const sizeProperties = SIZE_PROPERTIES[size];

  const iconSize = ICON_SIZES[size];

  let color: string = Tokens.Color.Gray.Dark10;
  if (disabled) {
    color = Tokens.Color.Gray.Dark7;
  }

  const leadingTrailingTextColor = disabled ? Tokens.Color.Gray.Dark9 : Tokens.Color.Gray.Dark11;

  let labelNode: React.ReactNode = null;
  if (label) {
    if (typeof label === 'function') {
      labelNode = label(Tokens.Color.Gray.Dark11);
    } else {
      labelNode = (
        <Text
          style={[
            styles.labelText,
            type == 'clear' ? { marginBottom: sizeProperties.labelMarginBottomClear } : null,
            type == 'box' || type == 'boxOutline'
              ? { marginBottom: sizeProperties.labelMarginBottomBox }
              : null,
          ]}
        >
          {label}
        </Text>
      );
    }
  }

  let labelNodeWrapper: React.ReactNode = (
    <View style={styles.labelNodeWrapper}>
      {labelNode}
      {/*determining whether or not to add the required star*/}
      {labelRequired ? (
        <Text style={{ ...Tokens.Typography.Body2, color: Tokens.Color.Red.Dark10 }}>*</Text>
      ) : null}
    </View>
  );

  let supportingTextNode: React.ReactNode = null;
  if (supportingText) {
    if (typeof supportingText === 'function') {
      supportingTextNode = supportingText(color);
      if (error) {
        supportingTextNode = supportingText(Tokens.Color.Red.Dark10);
      }
    } else {
      supportingTextNode = (
        <Text
          style={{
            ...styles.supportingText,
            color,
          }}
        >
          {supportingText}
        </Text>
      );
      if (error) {
        supportingTextNode = (
          <Text
            style={{
              ...styles.supportingText,
              color: Tokens.Color.Red.Dark10,
            }}
          >
            {supportingText}
          </Text>
        );
      }
    }
  }

  let supportingTextNodeWrapper: React.ReactNode = (
    <View style={styles.supportingTextNodeWrapper}>{supportingTextNode}</View>
  );

  let backgroundColor = 'transparent';
  if (type === 'box') {
    backgroundColor = Tokens.Color.Gray.Dark3;
  }

  let borderColor: string = Tokens.Color.Gray.Dark7;
  if (error) {
    borderColor = Tokens.Color.Red.Dark10;
  } else if (statusColor) {
    borderColor = statusColor;
  } else if (focused) {
    borderColor = Tokens.Color.Gray.Dark8;
  }

  // FIXME: `rgba(0,0,0,0.01)` is working around an android issue where when the border is fully
  // transparent, the line under / around the text field is not being shown.
  let borderBottomColor = 'rgba(0,0,0,0.01)',
    borderTopColor = 'rgba(0,0,0,0.01)',
    borderLeftColor = 'rgba(0,0,0,0.01)',
    borderRightColor = 'rgba(0,0,0,0.01)';
  if (type === 'box' && (statusColor || error)) {
    borderBottomColor = borderColor;
    borderTopColor = borderColor;
    borderLeftColor = borderColor;
    borderRightColor = borderColor;
  } else if (type === 'boxOutline') {
    borderBottomColor = borderColor;
    borderTopColor = borderColor;
    borderLeftColor = borderColor;
    borderRightColor = borderColor;
  } else if (type === 'clear') {
    borderBottomColor = borderColor;
  }

  let textFieldNode = (
    <View
      style={[
        styles.box,
        {
          width,
          minHeight: size,
          maxHeight: rest.multiline ? undefined : size,
          alignItems: rest.multiline ? 'flex-end' : 'center',

          paddingLeft:
            type === 'box' || type === 'boxOutline'
              ? sizeProperties.horizontalSpacingBox
              : sizeProperties.horizontalSpacingClear,
          paddingRight:
            type === 'box' || type === 'boxOutline'
              ? sizeProperties.horizontalSpacingBox
              : sizeProperties.horizontalSpacingClear,
          flexGrow,
          flexShrink,
          gap: sizeProperties.gapHorizontalSpacing,

          backgroundColor,

          borderBottomColor,
          borderTopColor,
          borderLeftColor,
          borderRightColor,
        },
      ]}
    >
      {leadingIcon ? (
        typeof leadingIcon === 'function' ? (
          <View
            style={{
              paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
              paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
              // adding the '-1' to offset the border
              paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            }}
          >
            {leadingIcon(color, iconSize)}
          </View>
        ) : (
          <View
            style={{
              paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
              paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
              // adding the '-1' to offset the border
              paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            }}
          >
            {leadingIcon}
          </View>
        )
      ) : null}
      {leadingText ? (
        typeof leadingText === 'function' ? (
          leadingText(leadingTrailingTextColor)
        ) : (
          <Text
            style={[
              styles.leadingTrailingText,
              sizeProperties.textStyle,

              {
                color: leadingTrailingTextColor,
                // if the leadingText is the first item in the text box, the paddingLeft is 0
                paddingLeft: leadingIcon ? sizeProperties.leadingTrailingTextHorizontalSpacing : 0,
                paddingRight: sizeProperties.leadingTrailingTextHorizontalSpacing,
                // adding the '-1' to offset the border
                paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
              },
            ]}
          >
            {leadingText}
          </Text>
        )
      ) : null}

      <TextInputComponent
        {...rest}
        ref={customRef as FixMe}
        style={[
          styles.input,
          sizeProperties.textStyle,
          disabled ? styles.inputDisabled : null,
          {
            textAlign,
            // FIXME: the below doesn't seem to always work right for all text field sizes - there's
            // a spacing at the bototm of the text input. Go through and figure out why this is and
            // how to fix it. As of august 2023 I (ryan) don't know enough about react native to
            // be able to understand why this is rendering weirdly.

            height: rest.multiline ? undefined : size,
            maxHeight: rest.multiline
              ? sizeProperties.textStyle.lineHeight * 3 + sizeProperties.verticalSpacing * 2
              : sizeProperties.textStyle.lineHeight,
            alignItems: rest.multiline ? 'flex-end' : undefined,
            // The '- 1' applied to the vertical padding is to offset the border
            paddingTop: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
          },
        ]}
        numberOfLines={rest.multiline ? undefined : 1}
        placeholderTextColor={color}
        selectionColor={Tokens.Color.Brand.Blue}
        onFocus={(e) => {
          setFocused(true);
          if (onFocus) {
            onFocus(e);
          }
        }}
        onBlur={(e) => {
          setFocused(false);
          if (onFocus) {
            onFocus(e);
          }
        }}
        editable={!disabled}
      />

      {trailingText ? (
        typeof trailingText === 'function' ? (
          <View
            style={{
              paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
              paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
              // adding the '-1' to offset the border
              paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            }}
          >
            {trailingText(color)}
          </View>
        ) : (
          <Text
            style={[
              styles.leadingTrailingText,
              sizeProperties.textStyle,
              {
                color,
                paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
                paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
                // adding the '-1' to offset the border
                paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
              },
            ]}
          >
            {trailingText}
          </Text>
        )
      ) : null}
      {trailingIcon ? (
        typeof trailingIcon === 'function' ? (
          <View
            style={{
              paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
              // if the textfield is of type clear, then provide some
              paddingRight:
                type == 'clear'
                  ? sizeProperties.horizontalSpacingBox
                  : sizeProperties.leadingTrailingIconHorizontalSpacing,
              // adding the '-1' to offset the border
              paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            }}
          >
            {trailingIcon(color, iconSize)}
          </View>
        ) : (
          <View
            style={{
              paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
              paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
              // adding the '-1' to offset the border
              paddingBottom: rest.multiline ? sizeProperties.verticalSpacing - 1 : 0,
            }}
          >
            {trailingIcon}
          </View>
        )
      ) : null}
    </View>
  );

  if (labelNode && supportingTextNode) {
    return (
      <View style={{ ...styles.textFieldWrapper, width }}>
        {labelNodeWrapper}
        {textFieldNode}
        {supportingTextNodeWrapper}
      </View>
    );
  }

  if (labelNode) {
    return (
      <View style={{ width }}>
        {labelNodeWrapper}
        {textFieldNode}
      </View>
    );
  } else if (supportingTextNode) {
    return (
      <View style={{ width }}>
        {textFieldNode}
        {supportingTextNodeWrapper}
      </View>
    );
  } else {
    return textFieldNode;
  }
};

const TextField: React.FunctionComponent<TextFieldProps & { ref?: React.Ref<TextInput> }> =
  React.forwardRef<TextInput>((props, ref) => <TextFieldRaw {...props} customRef={ref} />) as FixMe;
export default TextField;
