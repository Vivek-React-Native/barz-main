import { StyleSheet, View, Text } from 'react-native';
import TextField from '@barz/mobile/src/ui/TextField';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  length: {
    ...Typography.Body3,
    color: Color.Gray.Dark10,
  },
});

const RAPPER_NAME_MAX_LENGTH = 30;

const RapperNameField: React.FunctionComponent<{
  value: string;
  label?: string;
  width?: string;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
  onChangeText: (newText: string) => void;
}> = ({ value, label, width, placeholder, editable = true, testID, onChangeText }) => {
  return (
    <View style={[styles.wrapper, { width }]}>
      <TextField
        size={56}
        label={label}
        type="clear"
        autoCapitalize="none"
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
        editable={editable}
        maxLength={RAPPER_NAME_MAX_LENGTH}
        testID={testID}
      />

      <Text style={styles.length}>
        {value.length} / {RAPPER_NAME_MAX_LENGTH}
      </Text>
    </View>
  );
};

export default RapperNameField;
