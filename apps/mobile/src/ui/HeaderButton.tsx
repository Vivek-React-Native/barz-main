import * as React from 'react';
import { Text, View, PressableProps, StyleSheet, Platform } from 'react-native';

import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';

const styles = StyleSheet.create({
  buttonWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

type HeaderButtonCustomProps = {
  leading?: React.ReactNode | ((color: string) => React.ReactNode);
  trailing?: React.ReactNode | ((color: string) => React.ReactNode);
  leadingSpace?: boolean;
  trailingSpace?: boolean;
  // accent color of the header button
  accentColor?: string;
  loading?: boolean;
  children?: string | number;
};

export type HeaderButtonProps = Omit<PressableProps, keyof HeaderButtonCustomProps> &
  HeaderButtonCustomProps;

const HeaderButton: React.FunctionComponent<HeaderButtonProps> = ({
  leading,
  trailing,
  leadingSpace,
  trailingSpace,
  accentColor = Color.White,
  loading = false,
  disabled = false,
  children,
  ...rest
}) => {
  let buttonColor = accentColor;
  if (loading || disabled) {
    buttonColor = Color.Gray.Dark11;
  }

  return (
    <PressableChangesOpacity {...rest} disabled={loading || disabled}>
      <View
        style={[
          styles.buttonWrapper,
          {
            marginLeft: leadingSpace && Platform.OS === 'android' ? 16 : undefined,
            marginRight: trailingSpace && Platform.OS === 'android' ? 16 : undefined,
          },
        ]}
      >
        {typeof leading === 'function' ? leading(buttonColor) : leading}
        <Text style={{ ...Typography.Body1, color: buttonColor }}>{children}</Text>
        {typeof trailing === 'function' ? trailing(buttonColor) : trailing}
      </View>
    </PressableChangesOpacity>
  );
};

export default HeaderButton;
