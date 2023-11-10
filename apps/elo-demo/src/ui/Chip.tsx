import * as React from 'react';
import * as Tokens from './tokens';

const styles = ({
  wrapper: {
    display: 'flex' as const,
    backgroundColor: Tokens.Color.Black,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  text: {
    ...Tokens.Typography.Body3Bold,
    color: Tokens.Color.White,
  },
});

export type ChipProps = {
  size: 32 | 26 | 22 | 16;
  backgroundColor?: string;
  color?: string;
  children?: string | number;
};

const Chip: React.FunctionComponent<ChipProps> = ({
  size,
  backgroundColor=Tokens.Color.White,
  color=Tokens.Color.Black,
  children,
}) => {
  return (
    <div style={{
      ...styles.wrapper,
      backgroundColor,
      height: size,
      minWidth: size,
      borderRadius: size / 2,
      paddingLeft: size / 4,
      paddingRight: size / 4,
    }}>
      <span style={{...styles.text, color}}>{children}</span>
    </div>
  );
};

export default Chip;
