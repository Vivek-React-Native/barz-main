import * as React from 'react';
import {
  Text,
  ScrollView,
  SafeAreaView,
  Platform,
  Linking,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import RNRestart from 'react-native-restart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
// @ts-ignore
import errorBoundaryIconImage from '@barz/mobile/src/images/errorboundaryicon.png';

import Button from '@barz/mobile/src/ui/Button';
import Environment from '@barz/mobile/src/lib/environment';
import { SENTRY_DSN } from '@barz/mobile/src/config';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import { ANDROID_PLAYSTORE_DEEP_LINK, IOS_APPSTORE_DEEP_LINK } from '@barz/mobile/src/config';
import { Color } from '@barz/mobile/src/ui/tokens';

// TODO: Not sure if this is necessary...
// const BugsnagBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);

type Props = {
  environment: Environment;
  children: React.ReactNode;
};

export default class GlobalErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidMount() {
    const environment = this.props.environment;
    if (environment.type === 'PRODUCTION' || environment.type === 'STAGING') {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: environment.type.toLowerCase(),
      });
    }
  }

  componentDidCatch(error: FixMe, errorInfo: FixMe) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo);
    if (!__DEV__) {
      try {
        Sentry.captureException(error);
      } catch (err) {
        console.error(err);
      }
    }

    this.handleErrorCount();
  }

  getErrorNum = async () => {
    let rawValue: string | null = null;
    if (Platform.OS === 'web') {
      rawValue = window.localStorage.getItem('global-error-boundary-error-retry-counter');
    } else {
      rawValue = await AsyncStorage.getItem('global-error-boundary-error-retry-counter');
    }
    if (!rawValue) {
      return 0;
    }

    return parseInt(rawValue, 10);
  };

  setErrorNum = async (newValue: number) => {
    if (Platform.OS === 'web') {
      window.localStorage.setItem('global-error-boundary-error-retry-counter', `${newValue}`);
    } else {
      await AsyncStorage.setItem('global-error-boundary-error-retry-counter', `${newValue}`);
    }
  };

  handleErrorCount = async () => {
    console.log('ERROR OCCURRED!');
    try {
      let value = await this.getErrorNum();
      if (value >= 3) {
        value = 0;
        await this.setErrorNum(value);
        this.setState({ hasError: true });
      } else {
        value += 1;
        await this.setErrorNum(value);
        this.resetApp();
      }
    } catch (e) {
      console.warn('WARNING: App failed to load, retrying:', e);
    }
  };

  resetApp = () => {
    RNRestart.restart();
    this.setState({ hasError: false });
  };

  render() {
    const appStoreUrl =
      Platform.OS === 'android' ? ANDROID_PLAYSTORE_DEEP_LINK : IOS_APPSTORE_DEEP_LINK;

    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (Platform.OS === 'web') {
        return (
          <View style={{ backgroundColor: Color.Gray.Dark12, marginTop: 32 }}>
            <Text
              style={{ fontSize: 32, fontWeight: 'bold', marginTop: 64, color: Color.Gray.Dark4 }}
            >
              If you're reading this, something went wrong... Try refreshing your browser! If you
              need help, contact us at contact@getfilteroff.com
            </Text>
          </View>
        );
      }

      return (
        <SafeAreaView
          style={{
            backgroundColor: Color.Gray.Dark12,
          }}
        >
          <ScrollView
            style={{
              flexGrow: 1,
              flexShrink: 1,
              width: '100%',
              height: '100%',
              padding: 24,
              gap: 24,
            }}
          >
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Image
                source={errorBoundaryIconImage}
                style={{ resizeMode: 'contain', width: 128, height: 128, borderRadius: 8 }}
              />
            </View>
            <Text
              style={{ fontSize: 32, color: Color.Gray.Dark1, fontWeight: 'bold', marginTop: 32 }}
            >
              If you're reading this, something went wrong
            </Text>

            <View style={{ marginTop: 24 }}>
              <Button size={48} onPress={this.resetApp}>
                Restart App
              </Button>
            </View>

            <Text
              style={{ marginTop: 32, fontWeight: 'bold', fontSize: 18, color: Color.Gray.Dark1 }}
            >
              What can you do to fix this?
            </Text>
            <Text style={{ marginTop: 24, fontSize: 18, color: Color.Gray.Dark1 }}>
              1. Force-quit the app and relaunch it.
            </Text>

            <Text style={{ marginTop: 24, fontSize: 18, color: Color.Gray.Dark1 }}>
              2. Make sure your app is up to date
            </Text>

            <TouchableOpacity onPress={() => Linking.openURL(appStoreUrl)} style={{ padding: 8 }}>
              <Text style={{ color: Color.Blue.Dark8, fontSize: 18 }}>(visit App Store)</Text>
            </TouchableOpacity>

            <Text style={{ marginTop: 20, fontSize: 18, color: Color.Gray.Dark1 }}>
              3. If all else fails, try deleting the app and reinstalling.
            </Text>
            {/*
            <Text style={{ marginTop: 60, fontSize: 18, lineHeight: 32, color: Color.Gray.Dark10 }}>
              If you need help, contact us at contact@getfilteroff.com
            </Text>
            */}
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
