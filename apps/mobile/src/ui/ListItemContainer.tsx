import * as React from 'react';
import { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import { Color } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  listItemContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  listItemDivider: {
    height: 1,
    backgroundColor: Color.Gray.Dark6,
    marginHorizontal: 16,
  },
});

const ListItemContainer: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <View style={styles.listItemContainer}>
      <Fragment>
        {React.Children.map(children, (child, index) => {
          return (
            <View key={index}>
              {index !== 0 ? <ListItemDivider /> : null}
              {child}
            </View>
          );
        })}
      </Fragment>
    </View>
  );
};

export const ListItemDivider: React.FunctionComponent = () => (
  <View style={styles.listItemDivider} />
);

export default ListItemContainer;
