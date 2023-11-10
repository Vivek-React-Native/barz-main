import * as React from 'react';
import { Fragment, useState, useCallback, useContext, useEffect } from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import Share from 'react-native-share';
import { useAuth } from '@clerk/clerk-expo';
import {
  Alert,
  Switch,
  Text,
  ScrollView,
  SafeAreaView,
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import RNRestart from 'react-native-restart';
import VersionNumber from 'react-native-version-number';
import alpha from 'color-alpha';

import { VideoCacheContext } from '@barz/mobile/src/video-cache';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import Button from '@barz/mobile/src/ui/Button';
import HeaderButton from '@barz/mobile/src/ui/HeaderButton';
import TextField from '@barz/mobile/src/ui/TextField';
import {
  ArrowLeft as IconArrowLeft,
  Close as IconClose,
  ChevronLeft as IconChevronLeft,
} from '@barz/mobile/src/ui/icons';
import {
  DeveloperModeCache,
  StatusAlertCache,
  BattleViewerDebugCache,
  BattleMatchingModeDebugCache,
} from '@barz/mobile/src/lib/cache';
import Environment from '@barz/mobile/src/lib/environment';
import { EnvironmentContext } from '@barz/mobile/src/environment-data';
import { round } from '@barz/mobile/src/lib/math';
import { BattleWithParticipants, BattleParticipant } from '@barz/mobile/src/lib/api';
import { version as packageJsonVersion } from '@barz/mobile/package.json';

import {
  PRODUCTION_CLERK_PUBLISHABLE_KEY,
  STAGING_CLERK_PUBLISHABLE_KEY,
  PRODUCTION_PUSHER_API_KEY,
  STAGING_PUSHER_API_KEY,
} from '@barz/mobile/src/config';
import { UserDataContext } from '@barz/mobile/src/user-data';

import {
  MockBattle,
  MockBattleSummary,
  MockCoinToss,
  MockOpponentFound,
  MockBattlePrivacyScreen,
  MockIntroSlideshow,
  MockCreateRapNameIntro,
} from './mock-views';
import { ButtonStorybook, TextFieldStorybook, ChipStorybook } from './storybook';

// The below logic implements a typescript-friendly way to expose the prop type data to each screen
// within the feature
// ref: https://stackoverflow.com/a/75142476/4115328
export type DeveloperModeStackParamList = {
  'Developer Mode > Initial': undefined;
  'Developer Mode > Visible': undefined;
  'Developer Mode > Mock Battle': undefined;
  'Developer Mode > Mock Coin Toss': undefined;
  'Developer Mode > Mock Battle Summary': undefined;
  'Developer Mode > Mock Opponent Found': undefined;
  'Developer Mode > Mock Battle Privacy Screen': undefined;
  'Developer Mode > Mock Intro Slideshow': undefined;
  'Developer Mode > Mock Create Rap Name Intro': undefined;
  'Developer Mode > Button Storybook': undefined;
  'Developer Mode > TextField Storybook': undefined;
  'Developer Mode > Chip Storybook': undefined;
};

export type PageProps<T extends keyof DeveloperModeStackParamList> = {
  navigation: NativeStackScreenProps<DeveloperModeStackParamList, T>['navigation'];
  // FIXME: this doesn't seem to work... I don't get it
  // route?: NativeStackScreenProps<DeveloperModeStackParamList, T>['route'];
  route: FixMe;
};

const Stack = createNativeStackNavigator<DeveloperModeStackParamList>();

const environmentSwitcherButtonStyles = StyleSheet.create({
  button: {
    flexGrow: 1,
    flexShrink: 1,
    width: 320,
    height: 64,
    borderWidth: 2,
    borderColor: Color.Gray.Dark9,
    gap: 8,
  },
  row: {
    height: 64,
    marginLeft: 16,
    marginRight: 16,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: Color.Gray.Dark9,
  },
  buttonPressed: {
    borderColor: Color.Gray.Dark8,
  },
  name: {
    ...Typography.Body1Bold,
    color: Color.Gray.Dark12,
  },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Color.Gray.Dark9,
  },
  children: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
  },
});

const EnvironmentSwitcherButton: React.FunctionComponent<{
  name: string;
  color: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}> = ({ name, color, selected, disabled, onPress, children }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => onPress()}
      style={[
        environmentSwitcherButtonStyles.button,
        pressed ? environmentSwitcherButtonStyles.buttonPressed : {},
        selected ? { height: children ? 'auto' : 64, borderColor: color } : {},
      ]}
      disabled={disabled}
    >
      <View
        style={[
          environmentSwitcherButtonStyles.row,
          selected && children ? environmentSwitcherButtonStyles.rowExpanded : {},
        ]}
      >
        <Text style={environmentSwitcherButtonStyles.name}>{name}</Text>
        <View
          style={[
            environmentSwitcherButtonStyles.check,
            selected ? { borderColor: color, backgroundColor: color } : {},
          ]}
        />
      </View>
      {selected && children ? (
        <View style={environmentSwitcherButtonStyles.children}>{children}</View>
      ) : null}
    </Pressable>
  );
};

const EnvironmentSwitcherChildFormInput: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={{ ...Typography.Body1Bold, color: Color.White }}>{title}</Text>
    {children}
  </View>
);

const DeveloperModeSection: React.FunctionComponent<{
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, actions, children }) => (
  <View style={{ borderWidth: 1, borderColor: Color.White, padding: 8, gap: 8 }}>
    {title || actions ? (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 32,
        }}
      >
        <Text style={{ ...Typography.Body1Bold, color: Color.White }}>{title || ''}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>{actions}</View>
      </View>
    ) : null}
    {children}
  </View>
);

const DeveloperModeEnvironmentSwitcher: React.FunctionComponent<{
  navigation: PageProps<'Developer Mode > Visible'>['navigation'];
}> = ({ navigation }) => {
  const { signOut } = useAuth();
  const [environment, onChangeEnvironment] = useContext(EnvironmentContext);

  const [workingEnvironment, setWorkingEnvironment] = useState<Environment | null>(null);

  // When the app environment changes, make sure that the local copy of the environment also stays
  // up to date
  useEffect(() => {
    setWorkingEnvironment(environment);
  }, [environment]);
  useFocusEffect(
    useCallback(() => {
      setWorkingEnvironment(environment);
    }, [environment, setWorkingEnvironment]),
  );

  // When the user navigates back to the app, sign out if the environment was changed
  const [workingEnvironmentChanged, setWorkingEnvironmentChanged] = useState(false);
  useEffect(() => {
    const onBeforeRemove = () => {
      if (!workingEnvironment) {
        return;
      }
      if (!workingEnvironmentChanged) {
        return;
      }

      const run = () => {
        // Sync the environment back to the global context
        setActiveEnvironmentLoading(true);
        onChangeEnvironment(workingEnvironment)
          .catch((err) => {
            setActiveEnvironmentLoading(false);
            console.log(`Error setting environment: ${err}`);
            alert(`Error setting environment: ${err}`);
          })
          .then(() => {
            setActiveEnvironmentLoading(false);

            // NOTE: When the environment is changed, the `ClerkProvider` at the root of the app needs
            // to reload for the change to "take". However, the ClerkProvider internally caches the
            // `clerk` object which means that changing the `publishableKey` after initially rendering
            // the ClerkProvider has no effect.
            //
            // This is the out of band cache that is problematic: https://github.com/clerkinc/javascript/blob/4d94d10cdd4870c801bab2bd869ef605fe0b64d8/packages/expo/src/singleton.ts#L9

            // So, the only way to refresh this cache is to force reload the react native app. This is
            // kinda sucky... so if YOU can figure out a better way to do this, please implement it!
            RNRestart.restart();
          });
      };

      Alert.alert(
        'Log out and back in',
        'You have changed the selected environment. Would you like to log out and reload react native (required for clerk)?',
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: 'Log Out & Reload',
            style: 'destructive',
            onPress: () => {
              signOut().then(() => {
                run();
              });
            },
          },
        ],
      );
    };
    navigation.addListener('beforeRemove', onBeforeRemove);

    return () => {
      navigation.removeListener('beforeRemove', onBeforeRemove);
    };
  }, [navigation, workingEnvironment, workingEnvironmentChanged, signOut]);

  const [activeEnvironmentLoading, setActiveEnvironmentLoading] = useState(false);
  const onChangeWorkingEnvironment = useCallback(
    async (environment: Environment) => {
      setWorkingEnvironment(environment);
      setWorkingEnvironmentChanged(true);
    },
    [setWorkingEnvironment, setWorkingEnvironmentChanged],
  );

  return (
    <DeveloperModeSection title="Environment Switcher">
      {workingEnvironment ? (
        <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <EnvironmentSwitcherButton
            name="Production"
            color={Color.Blue.Dark10}
            selected={workingEnvironment.type === 'PRODUCTION'}
            disabled={activeEnvironmentLoading}
            onPress={() => onChangeWorkingEnvironment(Environment.PRODUCTION)}
          />
          <EnvironmentSwitcherButton
            name="Staging"
            color={Color.Red.Dark10}
            selected={workingEnvironment.type === 'STAGING'}
            disabled={activeEnvironmentLoading}
            onPress={() => onChangeWorkingEnvironment(Environment.STAGING)}
          />
          <EnvironmentSwitcherButton
            name="Local"
            color={Color.Yellow.Dark10}
            selected={workingEnvironment.type === 'LOCAL'}
            disabled={activeEnvironmentLoading}
            onPress={() => onChangeWorkingEnvironment(Environment.createLocal())}
          >
            {workingEnvironment.type === 'LOCAL' ? (
              <Fragment>
                <EnvironmentSwitcherChildFormInput title="Host">
                  <TextField
                    type="box"
                    width={200}
                    value={workingEnvironment.barzServerHost}
                    placeholder="ex: 10.10.11.11"
                    onChangeText={(host) => {
                      setWorkingEnvironment({ ...workingEnvironment, barzServerHost: host });
                    }}
                    inputMode="decimal"
                    onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                  />
                </EnvironmentSwitcherChildFormInput>
                <EnvironmentSwitcherChildFormInput title="Port">
                  <TextField
                    type="box"
                    width={200}
                    value={workingEnvironment.barzServerPort}
                    placeholder="ex: 8000"
                    onChangeText={(port) => {
                      setWorkingEnvironment({ ...workingEnvironment, barzServerPort: port });
                    }}
                    inputMode="numeric"
                    onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                  />
                </EnvironmentSwitcherChildFormInput>
                <EnvironmentSwitcherChildFormInput title="Clerk Key">
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          clerkPublishableKey: PRODUCTION_CLERK_PUBLISHABLE_KEY,
                        });
                      }}
                    >
                      P
                    </Button>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          clerkPublishableKey: STAGING_CLERK_PUBLISHABLE_KEY,
                        });
                      }}
                    >
                      S
                    </Button>
                    <TextField
                      type="box"
                      width={150}
                      value={workingEnvironment.clerkPublishableKey}
                      placeholder="ex: pk_test_xxx"
                      onChangeText={(clerkPublishableKey) => {
                        setWorkingEnvironment({ ...workingEnvironment, clerkPublishableKey });
                      }}
                      onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                    />
                  </View>
                </EnvironmentSwitcherChildFormInput>
                <EnvironmentSwitcherChildFormInput title="Pusher Key">
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          pusherKey: PRODUCTION_PUSHER_API_KEY,
                        });
                      }}
                    >
                      P
                    </Button>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          pusherKey: STAGING_PUSHER_API_KEY,
                        });
                      }}
                    >
                      S
                    </Button>
                    <TextField
                      type="box"
                      width={150}
                      value={workingEnvironment.pusherKey}
                      placeholder="ex: xxxxxxxxxxx"
                      onChangeText={(pusherKey) => {
                        setWorkingEnvironment({ ...workingEnvironment, pusherKey });
                      }}
                      onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                    />
                  </View>
                </EnvironmentSwitcherChildFormInput>
              </Fragment>
            ) : null}
          </EnvironmentSwitcherButton>
          <EnvironmentSwitcherButton
            name="Custom"
            color={Color.Green.Dark10}
            selected={workingEnvironment.type === 'CUSTOM'}
            disabled={activeEnvironmentLoading}
            onPress={() => onChangeWorkingEnvironment(Environment.createCustom())}
          >
            {workingEnvironment.type === 'CUSTOM' ? (
              <Fragment>
                <EnvironmentSwitcherChildFormInput title="Base URL">
                  <TextField
                    type="box"
                    width={200}
                    value={workingEnvironment.barzServerBaseUrl}
                    placeholder="ex: http://10.10.11.11:8000"
                    onChangeText={(barzServerBaseUrl) => {
                      setWorkingEnvironment({ ...workingEnvironment, barzServerBaseUrl });
                    }}
                    inputMode="url"
                    onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                  />
                </EnvironmentSwitcherChildFormInput>
                <EnvironmentSwitcherChildFormInput title="Clerk Key">
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          clerkPublishableKey: PRODUCTION_CLERK_PUBLISHABLE_KEY,
                        });
                      }}
                    >
                      P
                    </Button>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          clerkPublishableKey: STAGING_CLERK_PUBLISHABLE_KEY,
                        });
                      }}
                    >
                      S
                    </Button>
                    <TextField
                      type="box"
                      width={150}
                      value={workingEnvironment.clerkPublishableKey}
                      placeholder="ex: pk_test_xxx"
                      onChangeText={(clerkPublishableKey) => {
                        setWorkingEnvironment({ ...workingEnvironment, clerkPublishableKey });
                      }}
                      onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                    />
                  </View>
                </EnvironmentSwitcherChildFormInput>
                <EnvironmentSwitcherChildFormInput title="Pusher Key">
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          pusherKey: PRODUCTION_PUSHER_API_KEY,
                        });
                      }}
                    >
                      P
                    </Button>
                    <Button
                      type="outline"
                      size={32}
                      onPress={() => {
                        setWorkingEnvironment({
                          ...workingEnvironment,
                          pusherKey: STAGING_PUSHER_API_KEY,
                        });
                      }}
                    >
                      S
                    </Button>
                    <TextField
                      type="box"
                      width={150}
                      value={workingEnvironment.pusherKey}
                      placeholder="ex: xxxxxxxxxxx"
                      onChangeText={(pusherKey) => {
                        setWorkingEnvironment({ ...workingEnvironment, pusherKey });
                      }}
                      onBlur={() => onChangeWorkingEnvironment(workingEnvironment)}
                    />
                  </View>
                </EnvironmentSwitcherChildFormInput>
              </Fragment>
            ) : null}
          </EnvironmentSwitcherButton>
        </View>
      ) : null}
    </DeveloperModeSection>
  );
};

const DeveloperModeAppInfo: React.FunctionComponent = () => {
  const [shownStatusAlertIds, setShownStatusAlertIds] = useState<Array<number>>([]);
  useFocusEffect(
    useCallback(() => {
      StatusAlertCache.getShownStatusAlertIds().then(setShownStatusAlertIds);
    }, [setShownStatusAlertIds]),
  );

  return (
    <DeveloperModeSection
      title="App Info"
      actions={
        <Text style={{ ...Typography.Body2Bold, color: Color.White }}>
          pkg.json:{' '}
          <Text style={{ ...Typography.Monospace2, color: Color.Gray.Dark11 }}>
            {packageJsonVersion}
          </Text>
          , app.json:{' '}
          <Text style={{ ...Typography.Monospace2, color: Color.Gray.Dark11 }}>
            {VersionNumber.appVersion}
          </Text>
        </Text>
      }
    >
      <Text style={{ ...Typography.Body1, color: Color.White }}>
        Shown Status Alert IDs:{' '}
        <Text style={{ ...Typography.Monospace1, color: Color.Gray.Dark11 }}>
          {JSON.stringify(shownStatusAlertIds)}
        </Text>
      </Text>
      <Button
        onPress={() => {
          StatusAlertCache.setShownStatusAlertIds([]).then(() =>
            alert('Reset shown status alert ids!'),
          );
        }}
      >
        Clear shown status alerts
      </Button>
    </DeveloperModeSection>
  );
};

const DeveloperModeVideoCache: React.FunctionComponent = () => {
  const videoCacheContext = useContext(VideoCacheContext);
  if (!videoCacheContext) {
    throw new Error(
      '[DeveloperModeVideoCache] Unable to get context data! Was a DeveloperModeVideoCache rendered outside of VideoCacheContext?',
    );
  }

  const [cachedVideoFiles, setCachedVideoFiles] = useState<
    Array<[BattleWithParticipants['id'], BattleParticipant['id'], FileSystem.FileInfo]>
  >([]);
  useFocusEffect(
    useCallback(() => {
      videoCacheContext.listCachedVideos().then(setCachedVideoFiles);
    }, [videoCacheContext, setCachedVideoFiles]),
  );

  const [debugMenuVisible, setDebugMenuVisible] = useState(false);
  useEffect(() => {
    BattleViewerDebugCache.getDebugMenuVisible().then((enabled) => {
      setDebugMenuVisible(enabled);
    });
  }, [setDebugMenuVisible]);
  const [debugMenuVisibleLoading, setDebugMenuVisibleLoading] = useState(false);

  return (
    <DeveloperModeSection
      title="Video Player + Cache"
      actions={
        <Text style={{ ...Typography.Body1, color: Color.White }}>
          {cachedVideoFiles.length} videos{' '}
          <Text style={{ ...Typography.Monospace2, color: Color.Gray.Dark11 }}>
            {`(${round(
              cachedVideoFiles.reduce((acc, i) => (i[2].exists ? acc + i[2].size : acc), 0) /
                1024 /
                1024,
              3,
            )} Mb)`}
          </Text>
        </Text>
      }
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ScrollView style={{ height: 200, width: '100%' }}>
          <Text style={{ ...Typography.Monospace3, color: Color.White }}>
            {JSON.stringify(cachedVideoFiles, null, 2)}
          </Text>
        </ScrollView>

        <View style={{ flexDirection: 'column', gap: 8, width: 140 }}>
          <Button
            size={26}
            onPress={() => {
              videoCacheContext.listCachedVideos().then(setCachedVideoFiles);
            }}
          >
            Refresh list
          </Button>

          <Button
            size={26}
            onPress={() => {
              Clipboard.setStringAsync(JSON.stringify(cachedVideoFiles)).then(() =>
                alert('Copied to clipboard!'),
              );
            }}
          >
            Copy to clipboard
          </Button>

          <Button
            size={26}
            onPress={() => {
              Promise.all(
                cachedVideoFiles.map(([_b, _p, file]) => FileSystem.deleteAsync(file.uri)),
              ).then(() => {
                alert('Cleared cached videos!');
                setCachedVideoFiles([]);
              });
            }}
          >
            Clear cached videos
          </Button>

          <Button
            size={26}
            type={debugMenuVisible ? 'primaryAccent' : 'primary'}
            onPress={() => {
              setDebugMenuVisible(!debugMenuVisible);
              setDebugMenuVisibleLoading(true);
              BattleViewerDebugCache.setDebugMenuVisible(!debugMenuVisible)
                .then(() => {
                  setDebugMenuVisibleLoading(false);
                })
                .catch(() => {
                  setDebugMenuVisibleLoading(false);
                  setDebugMenuVisible(debugMenuVisible);
                });
            }}
          >
            {debugMenuVisible ? 'Debug Menu: ON' : 'Debug Menu: OFF'}
          </Button>
        </View>
      </View>
    </DeveloperModeSection>
  );
};

const DeveloperModeMatching: React.FunctionComponent = () => {
  const [testVideoCallEnabled, setTestVideoCallEnabled] = useState(false);
  const [randomMatchModeEnabled, setRandomMatchModeEnabled] = useState(false);
  useEffect(() => {
    BattleMatchingModeDebugCache.getTestVideoCallEnabled().then((enabled) => {
      setTestVideoCallEnabled(enabled);
    });
    BattleMatchingModeDebugCache.getRandomMatchModeEnabled().then((enabled) => {
      setRandomMatchModeEnabled(enabled);
    });
  }, [setTestVideoCallEnabled, setRandomMatchModeEnabled]);
  const [testVideoCallEnabledLoading, setTestVideoCallEnabledLoading] = useState(false);
  const [randomMatchModeEnabledLoading, setRandomMatchModeEnabledLoading] = useState(false);

  return (
    <DeveloperModeSection title="Battle Matching">
      <View style={{ flexDirection: 'column', gap: 8 }}>
        <Button
          size={26}
          type={randomMatchModeEnabled ? 'primaryAccent' : 'primary'}
          disabled={randomMatchModeEnabledLoading}
          onPress={() => {
            setRandomMatchModeEnabled(!randomMatchModeEnabled);
            setRandomMatchModeEnabledLoading(true);
            BattleMatchingModeDebugCache.setRandomMatchModeEnabled(!randomMatchModeEnabled)
              .then(() => {
                setRandomMatchModeEnabledLoading(false);
              })
              .catch(() => {
                setRandomMatchModeEnabledLoading(false);
                setRandomMatchModeEnabled(randomMatchModeEnabled);
              });
          }}
        >
          {randomMatchModeEnabled ? 'Random Match Mode: ENABLED' : 'Random Match Mode: DISABLED'}
        </Button>
        <Button
          size={26}
          type={testVideoCallEnabled ? 'primaryAccent' : 'primary'}
          disabled={testVideoCallEnabledLoading}
          onPress={() => {
            setTestVideoCallEnabled(!testVideoCallEnabled);
            setTestVideoCallEnabledLoading(true);
            BattleMatchingModeDebugCache.setTestVideoCallEnabled(!testVideoCallEnabled)
              .then(() => {
                setTestVideoCallEnabledLoading(false);
              })
              .catch(() => {
                setTestVideoCallEnabledLoading(false);
                setTestVideoCallEnabled(testVideoCallEnabled);
              });
          }}
        >
          {testVideoCallEnabled ? 'Test Video Call: ENABLED' : 'Test Video Call: DISABLED'}
        </Button>
      </View>
    </DeveloperModeSection>
  );
};

const DeveloperModeUserInfo: React.FunctionComponent = () => {
  const { signOut, getToken } = useAuth();
  const [userMe] = useContext(UserDataContext);

  return (
    <DeveloperModeSection title="User Info">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ScrollView style={{ height: 200, width: '100%' }}>
          <Text style={{ ...Typography.Monospace3, color: Color.White }}>
            {JSON.stringify(userMe, null, 2)}
          </Text>
        </ScrollView>

        <View style={{ flexDirection: 'column', gap: 8, width: 140 }}>
          <Button size={26} onPress={() => signOut()}>
            Log out
          </Button>

          <Button
            type="secondary"
            size={26}
            onPress={() => {
              Clipboard.setStringAsync(JSON.stringify(userMe)).then(() =>
                alert('Copied to clipboard!'),
              );
            }}
          >
            Copy to clipboard
          </Button>

          <Button
            type="secondary"
            size={26}
            onPress={() => {
              getToken().then(async (token) => {
                if (!token) {
                  alert('Unable to generate token!');
                  return;
                }

                await Clipboard.setStringAsync(token);
                alert('Copied to clipboard!\n\nFYI: This token is short lived.');
              });
            }}
          >
            Copy token
          </Button>

          <Button
            type="secondary"
            size={26}
            onPress={() => {
              getToken().then((token) => {
                if (!token) {
                  alert('Unable to generate token!');
                  return;
                }
                console.log('Clerk Token:', token);
              });
            }}
          >
            Log token
          </Button>

          <Button
            type="secondary"
            size={26}
            onPress={() => {
              getToken().then(async (token) => {
                if (!token) {
                  alert('Unable to generate token!');
                  return;
                }

                await Share.open({ message: token });
              });
            }}
          >
            Share token
          </Button>
        </View>
      </View>
    </DeveloperModeSection>
  );
};

const DeveloperMode: React.FunctionComponent<
  PageProps<'Developer Mode > Visible'> & { enabled: boolean }
> = ({ navigation, enabled }) => {
  return (
    <SafeAreaView>
      <ScrollView style={{ height: '100%', width: '100%' }}>
        {!enabled ? (
          <View
            style={{
              margin: 8,
              marginBottom: 0,
              borderWidth: 1,
              borderColor: Color.Brand.Yellow,
              backgroundColor: alpha(Color.Brand.Yellow, 0.15),
              padding: 8,
              gap: 16,
            }}
          >
            <Text
              style={{
                ...Typography.Heading3,
                color: Color.White,
                lineHeight: 32,
              }}
            >
              Developer mode is for engineers that are troubleshooting issues.
            </Text>

            <Button
              type="primaryAccent"
              size={48}
              onPress={() => navigation.goBack()}
              leading={<IconArrowLeft color={Color.Black} />}
            >
              Back to Safety
            </Button>
          </View>
        ) : null}

        <View
          style={{
            padding: 8,
            gap: 8,
            opacity: enabled ? 1 : 0.5,
          }}
        >
          <DeveloperModeEnvironmentSwitcher navigation={navigation} />

          <DeveloperModeUserInfo />

          <DeveloperModeVideoCache />

          <DeveloperModeMatching />

          <DeveloperModeAppInfo />

          <DeveloperModeSection title="Mock Views">
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Opponent Found')}
            >
              Opponent Found
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Battle Privacy Screen')}
            >
              Battle Privacy
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Coin Toss')}
            >
              Coin Toss
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Battle')}
            >
              Battle
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Battle Summary')}
            >
              Summary
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Intro Slideshow')}
            >
              Intro Slideshow
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Mock Create Rap Name Intro')}
            >
              Create Rap Name Intro
            </Button>
          </DeveloperModeSection>

          <DeveloperModeSection title="Storybook">
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Button Storybook')}
            >
              Button
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > TextField Storybook')}
            >
              TextField
            </Button>
            <Button
              type="secondary"
              size={32}
              onPress={() => navigation.navigate('Developer Mode > Chip Storybook')}
            >
              Chip
            </Button>
          </DeveloperModeSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Developer Mode is a screen that shows controls useful to a developer working on or
// troubleshooting the barz app.
const DeveloperModeFeature: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  useEffect(() => {
    DeveloperModeCache.isEnabled().then((enabled) => {
      setDeveloperModeEnabled(enabled);
    });
  }, []);
  const [developerModeEnabledLoading, setDeveloperModeEnabledLoading] = useState(false);

  return (
    <Stack.Navigator>
      {/* The "Initial" screen contains the rest of the app */}
      <Stack.Screen name="Developer Mode > Initial" options={{ headerShown: false }}>
        {() => <Fragment>{children}</Fragment>}
      </Stack.Screen>

      {/* The "Visible" screen will be shown once developer mode is activated */}
      <Stack.Screen
        name="Developer Mode > Visible"
        options={{
          title: 'Developer Mode',
          headerRight: () => (
            <Switch
              trackColor={{ true: Color.Yellow.Dark9 }}
              thumbColor={Color.White}
              onValueChange={(enabled) => {
                const oldEnabled = developerModeEnabled;
                setDeveloperModeEnabled(enabled);
                setDeveloperModeEnabledLoading(true);
                DeveloperModeCache.setEnabled(enabled)
                  .then(() => {
                    setDeveloperModeEnabledLoading(false);
                  })
                  .catch(() => {
                    setDeveloperModeEnabledLoading(false);
                    setDeveloperModeEnabled(oldEnabled);
                  });
              }}
              value={developerModeEnabled}
              disabled={developerModeEnabledLoading}
            />
          ),
          orientation: 'portrait',
        }}
      >
        {(props) => <DeveloperMode {...props} enabled={developerModeEnabled} />}
      </Stack.Screen>

      <Stack.Screen
        name="Developer Mode > Mock Opponent Found"
        options={{
          headerTitle: 'Opponent',
          headerLeft: () => (
            <HeaderButton
              accentColor={Color.Gray.Dark10}
              leading={(color) => <IconClose color={color} />}
              trailingSpace
            >
              Forfeit
            </HeaderButton>
          ),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={MockOpponentFound}
      />
      <Stack.Screen
        name="Developer Mode > Mock Battle Privacy Screen"
        options={{
          headerTitle: 'Challenge',
          headerLeft: () => (
            <HeaderButton accentColor={Color.Brand.Red} trailingSpace>
              Leave
            </HeaderButton>
          ),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
        component={MockBattlePrivacyScreen}
      />
      <Stack.Screen
        name="Developer Mode > Mock Coin Toss"
        options={{ headerShown: false }}
        component={MockCoinToss}
      />
      <Stack.Screen
        name="Developer Mode > Mock Battle"
        options={{ headerShown: false }}
        component={MockBattle}
      />
      <Stack.Screen
        name="Developer Mode > Mock Battle Summary"
        options={{ headerShown: false }}
        component={MockBattleSummary}
      />
      <Stack.Screen
        name="Developer Mode > Mock Intro Slideshow"
        options={{ headerShown: false }}
        component={MockIntroSlideshow}
      />
      <Stack.Screen
        name="Developer Mode > Mock Create Rap Name Intro"
        options={{ headerShown: false }}
        component={MockCreateRapNameIntro}
      />

      <Stack.Screen
        name="Developer Mode > Button Storybook"
        options={{ title: 'Button Storybook' }}
        component={ButtonStorybook}
      />
      <Stack.Screen
        name="Developer Mode > TextField Storybook"
        options={{ title: 'Text Field Storybook' }}
        component={TextFieldStorybook}
      />
      <Stack.Screen
        name="Developer Mode > Chip Storybook"
        options={{ title: 'Chip Storybook' }}
        component={ChipStorybook}
      />
    </Stack.Navigator>
  );
};

export default DeveloperModeFeature;
