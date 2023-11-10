import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Linking,
  AppState,
  AppStateStatus,
  StyleSheet,
  View,
  Text,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Color } from '@barz/mobile/src/ui/tokens';
import semver from 'semver';
import RNExitApp from 'react-native-exit-app';
import VersionNumber from 'react-native-version-number';

import { StatusAlertCache } from '@barz/mobile/src/lib/cache';
import Environment from '@barz/mobile/src/lib/environment';
import Button from '@barz/mobile/src/ui/Button';
import { ANDROID_PLAYSTORE_DEEP_LINK, IOS_APPSTORE_DEEP_LINK } from '@barz/mobile/src/config';

export type StatusAlert = {
  id: number;
  title?: string;
  message: string;
  type:
    | 'dismissable' // An dismissable alert popup with an "ok" button
    | 'full-page' // A full-page blocking page keeping the user from using the app
    | 'banner' // A top banner that is dismissable
    | 'app-force-update'; // A non dismissable popup that links the user to the app store to update
  version: string;

  // If true, show this alert once, and then never show it to the user again.
  // If false, always show this alert as long as the version check passes
  showOnce: boolean;
};

const styles = StyleSheet.create({
  fullPageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Color.Blue.Dark10,
    gap: 16,
  },
  fullPageTitle: {
    fontFamily: 'menlo',
    fontSize: 24,
    fontWeight: 'bold',
    color: Color.Gray.Dark1,
    textAlign: 'center',
  },
  fullPageText: {
    fontFamily: 'menlo',
    fontSize: 16,
    color: Color.Gray.Dark1,
    marginLeft: 16,
    marginRight: 16,
  },

  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 8,
    backgroundColor: Color.Blue.Dark10,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
    padding: 8,
  },
  bannerText: {
    fontFamily: 'menlo',
    fontSize: 16,
    color: Color.Gray.Dark1,
    flexGrow: 1,
    flexShrink: 1,
  },
  bannerButton: {
    flexGrow: 0,
    flexShrink: 0,
  },
});

// A component that makes a request to fetch a file on S3 (stored by environment), and using the
// results, shows different kinds of alerts to the user.
//
// The file is structured like this, and should grow with time as new entries are added to the array:
// [{
//   "id": 0,
//   "message": "This is an alert message!",
//   "type": "dismissable",
//   "version": ">=0.14.0"
// }]
//
// A list of already shown alerts is stored in asyncstorage, and this is fetched, and used to
// determine which alerts have already been shown.
const StatusAlertShower: React.FunctionComponent<{
  environment: Environment;
  children: React.ReactNode;
}> = ({ environment, children }) => {
  const [statusAlerts, setStatusAlerts] = useState<
    | { status: 'IDLE' }
    | { status: 'LOADING_INITIAL' }
    | { status: 'COMPLETE'; alerts: Array<StatusAlert> }
    | { status: 'LOADING_LATER' }
    | { status: 'ERROR'; error: Error }
  >({ status: 'IDLE' });

  const fetchStatusAlertsFromS3 = useCallback(
    (initial = true) => {
      setStatusAlerts({ status: initial ? 'LOADING_INITIAL' : 'LOADING_LATER' });
      StatusAlertCache.getShownStatusAlertIds()
        .catch((err) => {
          console.log(`Error loading shown status alert ids, defaulting to an empty list: ${err}`);
          return [];
        })
        .then(async (shownStatusAlertIds: Array<StatusAlert['id']>) => {
          // Fetch status alerts from S3
          const statusUrl = `https://barz-mobile-status.s3.amazonaws.com/${environment.type.toLowerCase()}.json?cachebusting=${new Date().getTime()}`;
          const response = await fetch(statusUrl);

          if (!response.ok) {
            throw new Error(
              `Error requesting status alerts from ${statusUrl}: received ${response.status}`,
            );
          }
          const body: Array<StatusAlert> = await response.json();

          if (!Array.isArray(body)) {
            throw new Error(
              `Error parsing status alerts from ${statusUrl}: root of json was not an array, found ${JSON.stringify(
                body,
              )}`,
            );
          }

          // Compute a list of all status alerts that still need to be shown to the user
          const statusAlertsToShowToUser = body.filter((statusAlert) => {
            // Filter out alerts which don't satisfy the semver constraints
            if (!semver.satisfies(VersionNumber.appVersion, statusAlert.version)) {
              return false;
            }

            // Filter out alerts that have already been shown, if that alert should only be shown once
            if (statusAlert.showOnce !== false && shownStatusAlertIds.includes(statusAlert.id)) {
              return false;
            }

            return true;
          });

          setStatusAlerts({
            status: 'COMPLETE',
            alerts: statusAlertsToShowToUser,
          });

          // Make sure that the status alert ids that have just been shown are cached so that they won't be shown next
          // time
          const newShownStatusAlertIds = new Set([
            ...shownStatusAlertIds,
            ...statusAlertsToShowToUser.map((a) => a.id),
          ]);
          await StatusAlertCache.setShownStatusAlertIds(Array.from(newShownStatusAlertIds));

          // Finally, show all dismissable alerts to the user
          for (const item of statusAlertsToShowToUser) {
            switch (item.type) {
              case 'dismissable':
                await new Promise<void>((resolve) => {
                  Alert.alert(item.title || 'Alert', item.message, [
                    {
                      text: 'OK',
                      onPress: () => resolve(),
                    },
                  ]);
                });
                break;
              case 'app-force-update':
                await new Promise<void>(() => {
                  Alert.alert(
                    'Update required',
                    `Please update your app to continue using Barz${
                      item.message.length > 0 ? `: ${item.message}` : '.'
                    }`,
                    [
                      {
                        text: 'Update',
                        onPress: async () => {
                          const appStoreUrl =
                            Platform.OS === 'android'
                              ? ANDROID_PLAYSTORE_DEEP_LINK
                              : IOS_APPSTORE_DEEP_LINK;

                          await Linking.openURL(appStoreUrl);
                          RNExitApp.exitApp();
                        },
                      },
                    ],
                    { cancelable: false },
                  );
                });
                break;
            }
          }
        })
        .catch((err) => {
          console.error(`Error fetching alerts to show: ${err}`);
          setStatusAlerts({ status: 'ERROR', error: err });
        });
    },
    [setStatusAlerts],
  );

  useEffect(() => {
    fetchStatusAlertsFromS3();
  }, [fetchStatusAlertsFromS3]);

  const [appState, setAppState] = useState(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        fetchStatusAlertsFromS3(false);
      }
      setAppState(nextAppState);
    });
    return () => {
      subscription.remove();
    };
  }, [appState, fetchStatusAlertsFromS3]);

  switch (statusAlerts.status) {
    case 'IDLE':
    case 'LOADING_INITIAL':
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
          <Text style={{ color: 'white' }}>Loading status alerts...</Text>
        </SafeAreaView>
      );

    case 'COMPLETE':
      const firstFullPageAlert = statusAlerts.alerts.find(
        (statusAlert) => statusAlert.type === 'full-page',
      );
      if (firstFullPageAlert) {
        return (
          <View style={styles.fullPageContainer}>
            {firstFullPageAlert.title ? (
              <Text style={styles.fullPageTitle}>{firstFullPageAlert.title}</Text>
            ) : null}
            <Text style={styles.fullPageText}>{firstFullPageAlert.message}</Text>
          </View>
        );
      } else {
        const bannerStatusAlerts = statusAlerts.alerts.filter(
          (statusAlert) => statusAlert.type === 'banner',
        );
        return (
          <View style={StyleSheet.absoluteFill}>
            {children}

            {/* Show any banners on-screen */}
            {bannerStatusAlerts.length > 0 ? (
              <SafeAreaView style={styles.bannerContainer}>
                {bannerStatusAlerts.map((statusAlert) => (
                  <View style={styles.banner} key={statusAlert.id}>
                    <Text style={styles.bannerText}>{statusAlert.message}</Text>
                    <View style={styles.bannerButton}>
                      <Button
                        size={26}
                        type="primary"
                        onPress={() =>
                          setStatusAlerts((old) =>
                            old.status === 'COMPLETE'
                              ? {
                                  status: 'COMPLETE',
                                  alerts: old.alerts.filter((a) => statusAlert.id !== a.id),
                                }
                              : old,
                          )
                        }
                      >
                        Dismiss
                      </Button>
                    </View>
                  </View>
                ))}
              </SafeAreaView>
            ) : null}
          </View>
        );
      }

    case 'LOADING_LATER':
    case 'ERROR':
      return <View style={StyleSheet.absoluteFill}>{children}</View>;
  }
};

export default StatusAlertShower;
