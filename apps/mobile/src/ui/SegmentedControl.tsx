import * as React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native';
import { Typography, Color } from './tokens';
import { Fire as IconFire } from '@barz/mobile/src/ui/icons';
import SegmentedControlUnderline from '../components/SegmentedControlUnderline';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';

const styles = StyleSheet.create({
  segmentedControlOption: {
    display: 'flex',
    height: '100%',
    justifyContent: 'flex-start',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
  },

  segmentedControl: {
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    height: 56,
    paddingHorizontal: 16,
    flexWrap: 'nowrap',
    backgroundColor: Color.Gray.Dark1,
  },

  segmentedControlUnderlineWrapper: {
    position: 'absolute',
    top: 28,
  },
});

type SegmentedControlOptionCommonProps = {
  testID?: string;
  active?: boolean;
  // pass the onPress function into this prop
  onPressAction?: any;
  color?: string;
};

type SegmentedControlOptionIconProps = SegmentedControlOptionCommonProps & {
  type?: 'icon';
  // if your segmented control option is of type 'icon'
  icon: ((color: string) => React.ReactNode) | React.ReactNode;
};

type SegmentedControlOptionTextProps = SegmentedControlOptionCommonProps & {
  type: 'text';
  // if yoursegmented control option is of type 'text'
  text?: string;
};
type SegmentedControlOptionProps =
  | SegmentedControlOptionTextProps
  | SegmentedControlOptionIconProps;

export const SegmentedControlOption: React.FunctionComponent<SegmentedControlOptionProps> = ({
  testID,
  active,
  onPressAction,
  color,
  ...rest
}) => {
  // determining color of icon on whether SegmentedControlOption is active or not
  if (active) {
    color = color || 'white';
  } else {
    color = color || Color.Gray.Dark10;
  }

  // rendering the icon
  let iconNode = null;
  if (rest.type == 'icon') {
    iconNode = typeof rest.icon === 'function' ? rest.icon(color) : rest.icon;
  }

  return (
    <PressableChangesOpacity
      style={styles.segmentedControlOption}
      onPress={onPressAction}
      testID={testID}
    >
      {rest.type === 'text' ? (
        <Text style={{ ...Typography.Body1SemiBold, color: color }}>{rest.text}</Text>
      ) : (
        iconNode
      )}
      {active ? (
        <View style={styles.segmentedControlUnderlineWrapper}>
          <SegmentedControlUnderline />
        </View>
      ) : null}
    </PressableChangesOpacity>
  );
};

type SegmentedControlProps = {
  // Type for whether SegmentedControl is sticky or fixed. This will adjust the
  // spacing
  // fixed: sets position of SegmentedControl according to parent element
  // sticky: sets position of SegmentedControl according to viewport
  spacingType?: 'fixed' | 'sticky';
  children: React.ReactNode;
};

export const SegmentedControl: React.FunctionComponent<SegmentedControlProps> = ({
  children,
  spacingType = 'fixed',
}) => {
  // determining the top and bottom padding for the Segmented control based on
  // whether the control is fixed and scrolls with the rest of the page, or 'sticky', sticking
  // to the top of the page
  let controlPaddingTop: number;
  let controlPaddingBottom: number;
  if (spacingType == 'fixed') {
    controlPaddingTop = 16;
    controlPaddingBottom = 0;
  } else {
    controlPaddingTop = 8;
    controlPaddingBottom = 8;
  }

  return (
    <View
      style={{
        ...styles.segmentedControl,
        paddingTop: controlPaddingTop,
        paddingBottom: controlPaddingBottom,
      }}
    >
      {children}
    </View>
  );
};

export default SegmentedControl;
