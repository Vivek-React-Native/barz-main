import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import * as Tokens from '@barz/mobile/src/ui/tokens';
import Button, { ButtonSize } from '@barz/mobile/src/ui/Button';
import TextField, { TextFieldSize } from '@barz/mobile/src/ui/TextField';
import Chip, { ChipSize } from '@barz/mobile/src/ui/Chip';
import { Fire as IconFire } from '@barz/mobile/src/ui/icons';

const IconPlaceholder: React.FunctionComponent<{ color: string; size: number }> = ({
  color,
  size,
}) => <IconFire color={color} size={size} />;

const Section: React.FunctionComponent<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={{ gap: 16, marginTop: 32 }}>
    {title ? (
      <Text style={{ ...Tokens.Typography.Heading3, color: Tokens.Color.White }}>{title}</Text>
    ) : null}
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      {children}
    </View>
  </View>
);

const SubSection: React.FunctionComponent<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={{ gap: 8 }}>
    {title ? (
      <Text style={{ ...Tokens.Typography.Body2, color: Tokens.Color.White }}>{title}</Text>
    ) : null}
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      {children}
    </View>
  </View>
);

export function ButtonStorybook() {
  const onPress = () => alert('Pressed!');

  const [size, setSize] = useState<ButtonSize>(32);

  return (
    <SafeAreaView>
      <ScrollView style={{ padding: 16 }}>
        {/* Size selector */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[56, 48, 40, 36, 32, 26, 20].map((sizeChoice) => (
            <Button
              key={sizeChoice}
              type={sizeChoice === size ? 'primary' : 'outline'}
              onPress={() => setSize(sizeChoice as ButtonSize)}
            >
              {sizeChoice}
            </Button>
          ))}
        </View>

        <Section title="Primary - Accent">
          <Button size={size} type="primaryAccent" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            inner={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          />
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={22222}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primaryAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          />

          <SubSection title="FOCUS">
            <Button size={size} type="primaryAccent" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              focused
              trailing={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="primaryAccent" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="primaryAccent" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="primaryAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Primary">
          <Button size={size} type="primary" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="primary"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="primary"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="primary" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="primary"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="primary"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="primary" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="primary"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="primary"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="primary" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="primary"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="primary"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Secondary">
          <Button size={size} type="secondary" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="secondary"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="secondary"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="secondary" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="secondary"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="secondary"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="secondary" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="secondary"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="secondary"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="secondary" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="secondary"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="secondary"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Outline">
          <Button size={size} type="outline" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="outline"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="outline"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="outline" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="outline"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="outline"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="outline" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="outline"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="outline"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="outline" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="outline"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="outline"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Outline - Accent">
          <Button size={size} type="outlineAccent" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="outlineAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="outlineAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="outlineAccent" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="outlineAccent" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="outlineAccent" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="outlineAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Text">
          <Button size={size} type="text" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="text"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="text"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="text" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="text"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="text"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="text" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="text"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="text"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="text" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="text"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="text"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Text - Accent">
          <Button size={size} type="textAccent" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="textAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="textAccent"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="textAccent" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="textAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="textAccent"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="textAccent" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="textAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="textAccent"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="textAccent" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="textAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="textAccent"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>

        <Section title="Blurred">
          <Button size={size} type="blurred" onPress={onPress}>
            Press me
          </Button>
          <Button
            size={size}
            type="blurred"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
          >
            Press me
          </Button>
          <Button
            size={size}
            type="blurred"
            leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
            onPress={onPress}
            badge={2}
          >
            Press me
          </Button>

          <SubSection title="FOCUS">
            <Button size={size} type="blurred" focused onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="blurred"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="blurred"
              focused
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="DISABLED">
            <Button size={size} type="blurred" disabled onPress={onPress}>
              Press me
            </Button>
            <Button
              size={size}
              type="blurred"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Press me
            </Button>
            <Button
              size={size}
              type="blurred"
              disabled
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Press me
            </Button>
          </SubSection>

          <SubSection title="LOADING">
            <Button size={size} type="blurred" loading onPress={onPress}>
              Loading...
            </Button>
            <Button
              size={size}
              type="blurred"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
            >
              Loading...
            </Button>
            <Button
              size={size}
              type="blurred"
              loading
              leading={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
              onPress={onPress}
              badge={2}
            >
              Loading...
            </Button>
          </SubSection>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export function TextFieldStorybook() {
  const [value, setValue] = useState('');
  const [size, setSize] = useState<TextFieldSize>(32);

  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <ScrollView style={{ padding: 16 }}>
          <Pressable style={{ width: '100%', height: '100%' }} onPress={Keyboard.dismiss}>
            {/* Size selector */}
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {[72, 56, 48, 40, 36, 32, 26, 20].map((sizeChoice) => (
                <Button
                  key={sizeChoice}
                  type={sizeChoice === size ? 'primary' : 'outline'}
                  onPress={() => setSize(sizeChoice as TextFieldSize)}
                >
                  {sizeChoice}
                </Button>
              ))}
            </View>

            <Section title="Clear">
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                error
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Clear - With Label">
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                error
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Clear - With Supporting Text">
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                error
                placeholder="Search"
                label="Error"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                supportingText="Supporting Text"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Clear - Multiline">
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                error
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="clear"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
                multiline
              />
            </Section>

            <Section title="Box">
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                error
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Box - With Label">
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                error
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Box - Multiline">
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                error
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="box"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
                multiline
              />
            </Section>

            <Section title="Box Outline">
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                error
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Box Outline - With Label">
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                error
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
              />
            </Section>

            <Section title="Box Outline - Multiline">
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Label"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                disabled
                placeholder="Search"
                label="Disabled"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                error
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Yellow}
                value={value}
                onChangeText={setValue}
                multiline
              />
              <TextField
                type="boxOutline"
                size={size}
                width="100%"
                placeholder="Search"
                label="Status Color"
                leadingText="$"
                leadingIcon={(color, iconSize) => <IconPlaceholder color={color} size={iconSize} />}
                trailingIcon={(color, iconSize) => (
                  <IconPlaceholder color={color} size={iconSize} />
                )}
                statusColor={Tokens.Color.Brand.Green}
                value={value}
                onChangeText={setValue}
                multiline
              />
            </Section>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ChipStorybook() {
  const [size, setSize] = useState<ChipSize>(32);

  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <ScrollView style={{ padding: 16 }}>
          <Pressable style={{ width: '100%', height: '100%' }} onPress={Keyboard.dismiss}>
            {/* Size selector */}
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {[32, 26, 22, 16].map((sizeChoice) => (
                <Button
                  key={sizeChoice}
                  type={sizeChoice === size ? 'primary' : 'outline'}
                  onPress={() => setSize(sizeChoice as ChipSize)}
                >
                  {sizeChoice}
                </Button>
              ))}
            </View>
            <Section title="Outline">
              <SubSection title="UNSELECTED">
                <Chip size={size} type="outline">
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  type="outline"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                />
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                />
                <Chip
                  size={size}
                  type="outline"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                />
              </SubSection>
              <SubSection title="SELECTED">
                <Chip size={size} type="outline" selected={true}>
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  type="outline"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                  selected={true}
                />
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="outline"
                  selected={true}
                />
                <Chip
                  size={size}
                  type="outline"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  selected={true}
                />
              </SubSection>
            </Section>
            <Section title="Filled">
              <SubSection title="UNSELECTED">
                <Chip size={size} type="filled">
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  type="filled"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                />
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                />
                <Chip
                  size={size}
                  type="filled"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                />
              </SubSection>
              <SubSection title="SELECTED">
                <Chip size={size} type="filled" selected={true}>
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  type="filled"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                  selected={true}
                >
                  Rappers
                </Chip>
                <Chip
                  size={size}
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                  selected={true}
                />
                <Chip
                  size={size}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  type="filled"
                  selected={true}
                />
                <Chip
                  size={size}
                  type="filled"
                  leading={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  trailing={(iconSize, iconColor) => <IconFire size={iconSize} color={iconColor} />}
                  selected={true}
                />
              </SubSection>
            </Section>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
