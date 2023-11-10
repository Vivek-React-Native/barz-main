import * as React from 'react';
import { useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';

import { Typography, Color } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  wrapper: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    marginLeft: 16,
    marginRight: 16,
  },
  left: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIcon: {
    width: 36,
  },
  leftInner: {
    gap: 4,
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
});

const ListItem: React.FunctionComponent<{
  children: string;
  description?: string;
  leading?: React.ReactNode | ((color: string) => React.ReactNode);
  trailingLabel?: string;
  trailing?: React.ReactNode | ((color: string) => React.ReactNode);
  disabled?: boolean;
  onPress?: () => void;
  type?: 'default' | 'danger';
  testID?: string;
}> = ({
  children,
  description,
  leading,
  trailingLabel,
  trailing,
  disabled,
  onPress,
  type = 'default',
  testID,
}) => {
  const [pressed, setPressed] = useState(false);

  let color: string = Color.Gray.Light1;
  let descriptionColor: string = Color.Gray.Dark11;
  if (disabled) {
    color = Color.Gray.Light8;
  } else if (type === 'default') {
    if (pressed) {
      color = Color.Gray.Light8;
      descriptionColor = Color.Gray.Dark8;
    } else {
      color = Color.Gray.Light3;
    }
  } else {
    if (pressed) {
      color = Color.Red.Dark8;
      descriptionColor = Color.Gray.Dark8;
    } else {
      color = Color.Red.Dark10;
    }
  }

  return (
    <Pressable
      style={styles.wrapper}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <View style={styles.left}>
        {leading ? (
          <View style={styles.leftIcon}>
            {typeof leading === 'function' ? leading(color) : leading}
          </View>
        ) : null}
        <View style={styles.leftInner}>
          <Text style={{ ...Typography.Body1SemiBold, color}}>
            {children}
          </Text>
          {description ? (
            <Text style={{ ...Typography.Body1, color: descriptionColor }}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        {trailingLabel ? (
          <Text style={{ ...Typography.Body1, color: descriptionColor, marginRight: 4}}>{trailingLabel}</Text>
        ) : null}
        {typeof trailing === 'function' ? trailing(color) : trailing}
      </View>
    </Pressable>
  );
};

export default ListItem;
