import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaView, View, Text, Platform } from 'react-native';
import { Fragment, useEffect, useCallback, useState, useContext, useRef } from 'react';
import { ClerkProvider, useUser } from '@clerk/clerk-expo';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';
import FlashMessage from 'react-native-flash-message';
import changeAndroidNavigationBarColor from 'react-native-navigation-bar-color';
import * as SplashScreen from 'expo-splash-screen';

import { PusherProvider } from './pusher';
import { UserDataProvider, UserDataContext } from './user-data';
import { PendingChallengesDataProvider } from './pending-challenges-data';
import ExpoUpdatesManager from './expo-updates-manager';
import VideoCachingProvider from './video-cache';
import { TokenCache } from './lib/cache';
import StatusAlertShower from '@barz/mobile/src/components/StatusAlertShower';
import EnvironmentProvider from '@barz/mobile/src/environment-data';
import GlobalErrorBoundary from '@barz/mobile/src/components/GlobalErrorBoundary';
// import AvatarImage, { AvatarImageError } from '@barz/mobile/src/components/AvatarImage';

import BattleFeature from './features/battle';
import OnboardingFeature from './features/onboarding';
import HomeFeature from './features/home';
import ProfileFeature from './features/profile';
import DeveloperModeFeature from './features/developer-mode';
import ImperativeLoginInTest from './features/onboarding/imperative-login-in-test';

import RapBattleInitiator from './RapBattleInitiator';
import { generateClerkPublishableKey } from './lib/environment';
import BattleBottomIcon from '@barz/mobile/src/components/BattleBottomIcon';

import { Color } from '@barz/mobile/src/ui/tokens';
import { Home as IconHome } from '@barz/mobile/src/ui/icons';
import { User as IconUser } from '@barz/mobile/src/ui/icons';

// @ts-ignore
import ArchivoRegularFont from './assets/Archivo/static/Archivo-Regular.ttf';
// @ts-ignore
import ArchivoMediumFont from './assets/Archivo/static/Archivo-Medium.ttf';
// @ts-ignore
import ArchivoBoldFont from './assets/Archivo/static/Archivo-Bold.ttf';
// @ts-ignore
import ArchivoItalicFont from './assets/Archivo/static/Archivo-Italic.ttf';
import { LinearGradient } from 'expo-linear-gradient';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// NOTE: on android, change the soft navigation bar to be dark colored to better fit in with the
// color scheme of the application
if (Platform.OS === 'android') {
  changeAndroidNavigationBarColor(Color.Gray.Dark1, false);
}

const Tab = createBottomTabNavigator();

const BarzNavigationTheme = {
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Color.Brand.Yellow,
    background: Color.Gray.Dark1,
    card: Color.Gray.Dark1,
    text: Color.White,
    border: Color.Brand.Gray4,
    notification: Color.Brand.Yellow,
  },
};

const FontLoader: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded] = useFonts({
    'Archivo Regular': ArchivoRegularFont,
    'Archivo Medium': ArchivoMediumFont,
    'Archivo Bold': ArchivoBoldFont,
    'Archivo Italic': ArchivoItalicFont,
  });

  if (!loaded) {
    return (
      <SafeAreaView
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Color.Gray.Dark1,
          height: '100%',
          width: '100%',
        }}
      >
        <Text style={{ color: Color.White }}>Loading Fonts...</Text>
      </SafeAreaView>
    );
  }

  return <Fragment>{children}</Fragment>;
};

const StopShowingSplashScreen: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isLoaded } = useUser();
  const [userMe] = useContext(UserDataContext);

  const [splashScreenHidden, setSplashScreenHidden] = useState(false);
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (userMe.status === 'INITIAL' || userMe.status == 'INITIAL_LOADING') {
      return;
    }

    setSplashScreenHidden(true);
  }, [isLoaded, userMe.status, setSplashScreenHidden]);

  const [rootViewRendered, setRootViewRendered] = useState(false);
  const onLayoutRootView = useCallback(async () => {
    setRootViewRendered(true);
  }, [setRootViewRendered]);

  useEffect(() => {
    if (!splashScreenHidden) {
      return;
    }
    if (!rootViewRendered) {
      return;
    }

    // This tells the splash screen to hide immediately! If we call this after
    // `setRootViewRendered`, then we may see a blank screen while the app is
    // loading its initial state and rendering its first pixels. So instead,
    // we hide the splash screen once we know the root view has already
    // performed layout.
    SplashScreen.hideAsync();
  }, [splashScreenHidden, rootViewRendered]);

  return (
    <View style={{ width: '100%', height: '100%' }} onLayout={onLayoutRootView}>
      {children}
    </View>
  );
};

export default () => (
  // const flashMessageRef = useRef();
  <EnvironmentProvider>
    {(environment) => (
      <>
        <GlobalErrorBoundary environment={environment}>
          <FontLoader>
            <VideoCachingProvider>
              <StatusAlertShower environment={environment}>
                <ClerkProvider
                  publishableKey={generateClerkPublishableKey(environment)}
                  tokenCache={TokenCache}
                >
                  {/*
                  When detox is running a test, this component allows the system to automatically
                  inject a "sign in" event and bypass the auth mechanism.
                */}
                  <ImperativeLoginInTest />

                  <NavigationContainer theme={BarzNavigationTheme}>
                    <PusherProvider>
                      <UserDataProvider>
                        {(userMe) => (
                          <StopShowingSplashScreen>
                            <ExpoUpdatesManager>
                              <PendingChallengesDataProvider>
                                <ActionSheetProvider>
                                  <GestureHandlerRootView style={{ flex: 1 }}>
                                    <DeveloperModeFeature>
                                      <OnboardingFeature>
                                        <BattleFeature>
                                          <Tab.Navigator
                                            id="tabs"
                                            screenOptions={{
                                              tabBarStyle: {
                                                borderTopWidth: 0,
                                              },
                                              tabBarBackground: () => (
                                                <LinearGradient
                                                  style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    height: 149,
                                                    width: '100%',
                                                  }}
                                                  colors={['rgba(20, 20, 20, 0.0)']}
                                                  locations={[0.27]}
                                                />
                                              ),

                                              // On android, the bottom tab bar seems to be shown above the
                                              // keyboard. However, this doesn't seem to be an issue on ios,
                                              // and moreover, if this is set on ios, the
                                              // @gorhom/bottom-sheet bottom footer positioning doesn't
                                              // seem to work correctly.
                                              tabBarHideOnKeyboard: Platform.OS === 'android',
                                            }}
                                          >
                                            <Tab.Screen
                                              name="Home"
                                              component={HomeFeature}
                                              options={{
                                                headerShown: false,
                                                title: 'Home',
                                                tabBarTestID: 'bottom-tab-home',
                                                tabBarStyle: {
                                                  // NOTE: this needs to be "black", not Colors.Black, to blend
                                                  // with the gradient at the bottom of the battle player
                                                  borderTopWidth: 0,
                                                },
                                                tabBarIcon: ({ focused }) => (
                                                  <View style={{ opacity: focused ? 1 : 0.5 }}>
                                                    <IconHome />
                                                  </View>
                                                ),
                                                tabBarLabel: () => null,
                                              }}
                                            />
                                            <Tab.Screen
                                              name="BattleInitiator"
                                              component={RapBattleInitiator}
                                              options={{
                                                title: 'Rap',
                                                tabBarTestID: 'bottom-tab-battle',
                                                tabBarStyle: {
                                                  backgroundColor: Color.Gray.Dark1,
                                                  borderTopWidth: 0,
                                                },
                                                tabBarIcon: ({ focused }) => (
                                                  <BattleBottomIcon focused={focused} />
                                                ),
                                                tabBarLabel: () => null,
                                              }}
                                            />
                                            <Tab.Screen
                                              name="My Profile"
                                              component={ProfileFeature}
                                              options={{
                                                headerShown: false,
                                                title: 'Profile',
                                                tabBarTestID: 'bottom-tab-profile',
                                                // tabBarIcon: () => {
                                                //   switch (userMe.status) {
                                                //     case 'IDLE':
                                                //     case 'LOADING':
                                                //       // FIXME: add better loading state
                                                //       return (
                                                //         <View>
                                                //           <AvatarImage profileImageUrl={null} />
                                                //         </View>
                                                //       );
                                                //     case 'ERROR':
                                                //       return (
                                                //         <View>
                                                //           <AvatarImageError />
                                                //         </View>
                                                //       );
                                                //     case 'COMPLETE':
                                                //       return (
                                                //         <AvatarImage profileImageUrl={userMe.data.profileImageUrl} />
                                                //       );
                                                //   }
                                                // },
                                                tabBarIcon: ({ focused }) => (
                                                  <View style={{ opacity: focused ? 1 : 0.5 }}>
                                                    <IconUser />
                                                  </View>
                                                ),
                                                tabBarLabel: () => null,
                                              }}
                                            />
                                          </Tab.Navigator>
                                        </BattleFeature>
                                      </OnboardingFeature>
                                    </DeveloperModeFeature>
                                  </GestureHandlerRootView>
                                </ActionSheetProvider>
                              </PendingChallengesDataProvider>
                            </ExpoUpdatesManager>
                          </StopShowingSplashScreen>
                        )}
                      </UserDataProvider>
                    </PusherProvider>
                  </NavigationContainer>
                </ClerkProvider>
              </StatusAlertShower>
            </VideoCachingProvider>
          </FontLoader>
        </GlobalErrorBoundary>
        <FlashMessage position="bottom"></FlashMessage>
      </>
    )}
  </EnvironmentProvider>
);
