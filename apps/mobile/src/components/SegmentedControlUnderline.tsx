import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { Color } from '@barz/mobile/src/ui/tokens';

const SegmentedControlUnderline = () => {
  return (
    <Svg width="29" height="5" fill="none" viewBox="0 0 29 5">
      <Path
        stroke={Color.Yellow.Dark10}
        strokeLinejoin="round"
        strokeWidth={2}
        d="M1.12061 3.43899C5.62061 0.803951 27.6206 0.304079 27.1206 1.93922"
      />
    </Svg>
  );
};
export default SegmentedControlUnderline;
