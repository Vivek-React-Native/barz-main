import { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, Keyboard, Pressable } from 'react-native';
import TextField from '@barz/mobile/src/ui/TextField';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});

const VerificationCodeBox: React.FunctionComponent<{
  code: string;
  onChangeCode: (newCode: string) => void;
  numberOfCharacters: number;
  autoFocus?: boolean;
  disabled?: boolean;
  testID?: string;
  onSubmitCode: (code: string) => void;
}> = ({
  code,
  onChangeCode,
  numberOfCharacters,
  autoFocus = false,
  disabled = false,
  testID,
  onSubmitCode,
}) => {
  const textInputRefs = useRef<Map<number, TextInput>>(new Map());

  const [value, setValue] = useState<Array<string>>([]);
  useEffect(() => {
    const newValue = new Array(numberOfCharacters).fill('');
    if (code) {
      for (let i = 0; i < numberOfCharacters; i += 1) {
        if (code[i]) {
          newValue[i] = code[i];
        }
      }
    }
    setValue(newValue);
  }, [numberOfCharacters]);

  const onChangeValue = useCallback(
    (fn: (oldValue: Array<string>) => Array<string>) => {
      let newValue: Array<string> = [];

      setValue((old) => {
        newValue = fn(old);
        return newValue;
      });

      onChangeCode(newValue.join(''));
    },
    [setValue],
  );

  // Once the control is fully populated (ie, all boxes have a character in them), then submit the code
  useEffect(() => {
    if (value.length !== numberOfCharacters) {
      return;
    }

    const firstUnfilledIndex = value.findIndex((n) => n.length === 0);
    if (firstUnfilledIndex < 0) {
      onSubmitCode(value.join(''));
    }
  }, [value, numberOfCharacters]);

  const setCharacterInBoxAtIndex = (index: number, key: string) => {
    // When a number is typed, populate the current box
    onChangeValue((oldValue) => {
      const newValue = oldValue.slice();
      newValue[index] = key;
      return newValue;
    });

    if (index === numberOfCharacters - 1) {
      // Focus the last box
      const lastBox = textInputRefs.current.get(numberOfCharacters - 1);
      if (lastBox) {
        lastBox.focus();
      }
    } else {
      // Focus the next box
      const nextBox = textInputRefs.current.get(index + 1);

      // NOTE: clear the next box when moving to it. This seems to be helpful but I am not sure.
      // Some OTP components online do this, and some don't.
      onChangeValue((oldValue) => {
        const newValue = oldValue.slice();
        newValue[index + 1] = '';
        return newValue;
      });

      if (nextBox) {
        nextBox.focus();
      }
    }
  };

  return (
    <Pressable style={styles.container} onPress={Keyboard.dismiss}>
      {value.map((character, index) => (
        <TextField
          key={index}
          type="clear"
          size={72}
          width={48}
          autoFocus={autoFocus && index === 0}
          autoCapitalize="none"
          value={character}
          textAlign="center"
          ref={(ref) => {
            if (ref) {
              // Store the ref so that the input at this given index can be focused imperatively
              // later
              textInputRefs.current.set(index, ref);
            } else {
              textInputRefs.current.delete(index);
            }
          }}
          onKeyPress={(event) => {
            const key = event.nativeEvent.key;
            switch (key) {
              case 'Backspace':
                if (value[index].length === 0) {
                  // There is nothing in the current box, so clear the previous box
                  onChangeValue((oldValue) => {
                    const newValue = oldValue.slice();
                    newValue[index - 1] = '';
                    return newValue;
                  });
                } else {
                  // Clear the current box
                  onChangeValue((oldValue) => {
                    const newValue = oldValue.slice();
                    newValue[index] = '';
                    return newValue;
                  });
                }

                // And then focus the previous box
                const previousBox = textInputRefs.current.get(index - 1);
                if (previousBox) {
                  previousBox.focus();
                }
                break;

              case '1':
              case '2':
              case '3':
              case '4':
              case '5':
              case '6':
              case '7':
              case '8':
              case '9':
              case '0':
                setCharacterInBoxAtIndex(index, key);
                break;
            }
          }}
          onChangeText={(text) => {
            text = text.replace(/[^0-9]/g, '');
            if (text.length <= 1) {
              // This case is handled by onKeyPress, so bail out early
              // It's easier to do in there because `Backspace` generates a key press event
              return;
            }

            if (text.length === 2) {
              // The user attempted to type one additional character in a box
              // This should result in the CURRENT box having this character removed from it
              onChangeValue((oldValue) => {
                const newValue = oldValue.slice();
                newValue[index] = text[0];
                return newValue;
              });
              // and the NEXT box getting this character entered into it
              setCharacterInBoxAtIndex(index + 1, text[1]);
              return;
            }

            // Otherwise, assume somebody pasted text into one of the boxes.
            const numberOfCharactersFromTextToPopulate = Math.min(numberOfCharacters, text.length);

            // If many characters were typed at once (ie, like a clipboard paste occurred), then
            // set the whole value and focus the final box
            onChangeValue(() => {
              const newValue = new Array(numberOfCharacters).fill('');
              for (let i = 0; i < numberOfCharactersFromTextToPopulate; i += 1) {
                newValue[i] = text[i];
              }
              return newValue;
            });

            if (numberOfCharactersFromTextToPopulate === numberOfCharacters) {
              // Focus the last box if the whole code was pasted
              const lastBox = textInputRefs.current.get(numberOfCharacters - 1);
              if (lastBox) {
                lastBox.focus();
              }
            } else {
              // Normally though, just focus the last box that was filled
              const finalBox = textInputRefs.current.get(numberOfCharactersFromTextToPopulate);
              if (finalBox) {
                finalBox.focus();
              }
            }
          }}
          keyboardType="number-pad"
          disabled={disabled}
          testID={index === 0 ? `${testID}-input` : undefined}
        />
      ))}
    </Pressable>
  );
};

export default VerificationCodeBox;
