import { StyleSheet, View } from 'react-native';
import alpha from 'color-alpha';
import { Color } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
  },
  section: {
    backgroundColor: alpha(Color.White, 0.2),
    flexGrow: 1,
    flexShrink: 1,
  },
  filled: {
    backgroundColor: Color.White,
  },
  filledYellow: {
    backgroundColor: Color.Yellow.Dark10,
  },
});

const IntroHeaderProgressBar: React.FunctionComponent<{
  sections: number;
  sectionsFilled: number;
  width?: number;
}> = ({ sections, sectionsFilled, width = 150 }) => (
  <View style={[styles.wrapper, { width }]}>
    {new Array(sections).fill(0).map((_, index) => (
      <View
        key={index}
        style={[
          styles.section,
          index < sectionsFilled ? styles.filled : null,
          index + 1 === sectionsFilled ? styles.filledYellow : null,
        ]}
      />
    ))}
  </View>
);

export default IntroHeaderProgressBar;
