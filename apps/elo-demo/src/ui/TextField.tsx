import * as React from 'react';
import { useState } from 'react';
import { FixMe } from '@barz/mobile/src/lib/fixme';

import * as Tokens from './tokens';

export type TextFieldType = 'box' | 'boxOutline' | 'clear';
export type TextFieldSize = 72 | 56 | 48 | 40 | 32 | 26 | 20;

const styles = ({
  box: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
    borderStyle: 'solid',
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

  input: {
    border: 0,
    outline: 'none',
    color: Tokens.Color.White,

    padding: 0,
    margin: 0,

    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: 'transparent',
  },
  inputDisabled: {
    color: Tokens.Color.Gray.Dark7,
  },
});

type TextFieldCustomProps = {
  type?: TextFieldType;
  size?: TextFieldSize;
  disabled?: boolean;

  label?: string | ((color: string) => React.ReactNode);

  leadingIcon?: React.ReactNode | ((color: string) => React.ReactNode);
  leadingText?: string | ((color: string) => React.ReactNode);
  trailingIcon?: React.ReactNode | ((color: string) => React.ReactNode);
  trailingText?: string | ((color: string) => React.ReactNode);

  textAlign?: 'left' | 'right' | 'center';

  statusColor?: string;

  width?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  // children?: string | number;
};

type TextFieldProps = Omit<
React.HTMLProps<HTMLInputElement>,
  | 'style'
  | 'placeholderTextColor'
  | keyof TextFieldCustomProps
  > & TextFieldCustomProps;

const SIZE_PROPERTIES: {[key in TextFieldSize]: {
  textStyle: FixMe;
  horizontalSpacing: number;
  leadingTrailingTextHorizontalSpacing: number;
  leadingTrailingIconHorizontalSpacing: number;
  gapHorizontalSpacing: number;
}} = {
  72: {
    textStyle: { ...Tokens.Typography.Body1, fontSize: 44, lineHeight: '44px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 6,
    leadingTrailingIconHorizontalSpacing: 4,
    gapHorizontalSpacing: 6,
  },
  56: {
    textStyle: { ...Tokens.Typography.Body1, fontSize: 22, lineHeight: '24px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 6,
    leadingTrailingIconHorizontalSpacing: 4,
    gapHorizontalSpacing: 6,
  },
  48: {
    textStyle: { ...Tokens.Typography.Body1, fontSize: 18, lineHeight: '22px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 4,
    leadingTrailingIconHorizontalSpacing: 2,
    gapHorizontalSpacing: 10
  },
  40: {
    textStyle: { ...Tokens.Typography.Body1, fontSize: 18, lineHeight: '21px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 2,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 10,
  },
  32: {
    textStyle: { ...Tokens.Typography.Body1, lineHeight: '18px' },
    horizontalSpacing: 12,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 6
  },
  26: {
    textStyle: { ...Tokens.Typography.Body2, lineHeight: '16px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 10,
  },
  20: {
    textStyle: { ...Tokens.Typography.Body3, lineHeight: '12px' },
    horizontalSpacing: 10,
    leadingTrailingTextHorizontalSpacing: 0,
    leadingTrailingIconHorizontalSpacing: 0,
    gapHorizontalSpacing: 10
  },
};

const TextFieldRaw: React.FunctionComponent<TextFieldProps & { customRef?: React.Ref<HTMLInputElement> }> = ({
  type='box',
  size=32,
  disabled=false,
  label,
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

  const sizeProperties = SIZE_PROPERTIES[size];

  let labelNode: React.ReactNode = null;
  if (label) {
    if (typeof label === 'function') {
      labelNode = label(Tokens.Color.Gray.Dark11);
    } else {
      labelNode = (
        <span style={{
          ...styles.labelText,
          ...(type !== 'clear' ? { marginBottom: 8 } : null),
        }}>{label}</span>
      );
    }
  }

  let backgroundColor = 'transparent';
  if (type === 'box') {
    backgroundColor = Tokens.Color.Gray.Dark3;
  }

  let borderColor: string = Tokens.Color.Gray.Dark7;
  if (statusColor) {
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
  if (type === 'box' && statusColor) {
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

  const color = disabled ? Tokens.Color.Gray.Dark7 : Tokens.Color.Gray.Dark9;

  let textFieldNode = (
    <div style={{
      ...styles.box,
      width,
      height: size,
      paddingLeft: sizeProperties.horizontalSpacing,
      paddingRight: sizeProperties.horizontalSpacing,
      flexGrow,
      flexShrink,
      gap: sizeProperties.gapHorizontalSpacing,

      backgroundColor,

      borderBottomColor,
      borderTopColor,
      borderLeftColor,
      borderRightColor,
    }}>
      {leadingIcon ? (
        typeof leadingIcon === 'function' ? (
          <div style={{
            paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
          }}>
            {leadingIcon(color)}
          </div>
        ) : (
          <div style={{
            paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
          }}>
            {leadingIcon}
          </div>
        )
      ) : null}
      {leadingText ? (
        typeof leadingText === 'function' ? (
          leadingText(color)
        ) : (
          <span style={{
            ...styles.leadingTrailingText,
            ...sizeProperties.textStyle,
            color,
            paddingLeft: sizeProperties.leadingTrailingTextHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingTextHorizontalSpacing,
          }}>{leadingText}</span>
        )
      ) : null}

      <input
        type="text"
        {...rest}

        ref={customRef}

        style={{
          ...styles.input,
          ...sizeProperties.textStyle,
          ...(disabled ? styles.inputDisabled : {}),
          textAlign, height: size,
        }}

        // placeholderTextColor={color}
        // selectionColor={Tokens.Color.Brand.Blue}
        onFocus={(e) => {
          setFocused(true);
          if (onFocus) {
            onFocus(e);
          }
        }}
        onBlur={(e) => {
          setFocused(false);
          if (onBlur) {
            onBlur(e);
          }
        }}
        // editable={!disabled}
        disabled={disabled}
      />

      {trailingText ? (
        typeof trailingText === 'function' ? (
          <div style={{
            paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
          }}>
            {trailingText(color)}
          </div>
        ) : (
          <span style={{
            ...styles.leadingTrailingText,
            ...sizeProperties.textStyle,
            color,
            paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
          }}>{trailingText}</span>
        )
      ) : null}
      {trailingIcon ? (
        typeof trailingIcon === 'function' ? (
          trailingIcon(color)
        ) : (
          <div style={{
            paddingLeft: sizeProperties.leadingTrailingIconHorizontalSpacing,
            paddingRight: sizeProperties.leadingTrailingIconHorizontalSpacing,
          }}>
            {trailingIcon}
          </div>
        )
      ) : null}
    </div>
  );

  if (labelNode) {
    return (
      <div style={{width}}>
        {labelNode}
        {textFieldNode}
      </div>
    );
  } else {
    return textFieldNode;
  }
};

const TextField: React.FunctionComponent<
  TextFieldProps & { ref?: React.Ref<HTMLInputElement> }
> = React.forwardRef<HTMLInputElement>(
  (props, ref) => <TextFieldRaw {...props} customRef={ref} />
) as FixMe;
export default TextField;
