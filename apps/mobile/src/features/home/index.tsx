import * as React from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';

import { User } from '@barz/mobile/src/lib/api';

import {
  useCalculateProfileScreens,
  ProfileStackParamList,
} from '@barz/mobile/src/features/profile';

import Home from './Home';

// The below logic implements a typescript-friendly way to expose the prop type data to each screen
// within the feature
// ref: https://stackoverflow.com/a/75142476/4115328
export type HomeStackParamList = {
  'Home > Initial': undefined;
  'Home > Profile': {
    userId: User['id'];
  };
  'Home > Profile > Settings': undefined;
  'Home > Profile > Settings > Phone Number Settings > Add/Change Phone Number': undefined;

  // FIXME: this route navigates to the developer mode feature
  'Developer Mode > Visible': undefined;
} & ProfileStackParamList;

export type PageProps<T extends keyof HomeStackParamList> = NativeStackScreenProps<
  HomeStackParamList,
  T
>;

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeFeature: React.FunctionComponent = () => {
  const profileScreensJsx = useCalculateProfileScreens();

  return (
    <Stack.Navigator>
      {/* The "Home" screen shows a list of battles that a user can select */}
      <Stack.Screen
        name="Home > Initial"
        options={() => ({
          headerShown: false,
          orientation: 'portrait',
        })}
        component={Home}
      />

      {/*
      Render all of the screens from the "Profile" feature of the app here as well.

      This is so that when a user presses on a battler's name on the home page, they
      will do a stack push transition to the new screen, rather than switch tabs and go
      to the "Profile" tab.
      */}
      {profileScreensJsx}
    </Stack.Navigator>
  );
};

export default HomeFeature;
