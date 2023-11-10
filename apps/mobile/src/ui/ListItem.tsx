import * as React from 'react';
import { Fragment, useState } from 'react';
import { Text, StyleSheet, View, Pressable } from 'react-native';

import { Typography, Color } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listItemBorder: {
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
  },
  left: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIcon: {
    minWidth: 36,
  },
  leftInner: {
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
  description?:
    | string
    | React.ReactNode
    | ((color: string) => React.ReactNode)
    | Array<string | React.ReactNode | ((color: string) => React.ReactNode)>;
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
  if (type === 'default') {
    if (disabled) {
      color = Color.Gray.Dark8;
    } else if (pressed) {
      color = Color.Gray.Light8;
      descriptionColor = Color.Gray.Dark10;
    } else {
      color = Color.Gray.Light3;
    }
  } else {
    if (disabled) {
      color = Color.Gray.Dark8;
    } else if (pressed) {
      color = Color.Red.Dark8;
      descriptionColor = Color.Gray.Dark10;
    } else {
      color = Color.Red.Dark10;
    }
  }

  const descriptionAsArray = Array.isArray(description) ? description : [description];
  const descriptionNodes = descriptionAsArray.map((line, index) => {
    if (typeof line === 'string') {
      return (
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ ...Typography.Body1, color: descriptionColor }}
          key={line}
        >
          {line}
        </Text>
      );
    } else if (typeof line === 'function') {
      return <Fragment key={index}>{line(color)}</Fragment>;
    } else {
      return <Fragment key={index}>{line}</Fragment>;
    }
  });

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
        {/* Allow detox tests to figure out if a given list item is disabled or not */}
        {disabled ? <View testID={`${testID}-disabled`} /> : null}

        {leading ? (
          <View style={styles.leftIcon}>
            {typeof leading === 'function' ? leading(color) : leading}
          </View>
        ) : null}
        <View style={styles.leftInner}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ ...Typography.Body1SemiBold, color }}
          >
            {children}
          </Text>
          {descriptionNodes}
        </View>
      </View>
      <View style={styles.right}>
        {trailingLabel ? (
          <Text style={{ ...Typography.Body1, color: descriptionColor, marginRight: 4 }}>
            {trailingLabel}
          </Text>
        ) : null}
        {typeof trailing === 'function' ? trailing(color) : trailing}
      </View>
    </Pressable>
  );
};

export default ListItem;
