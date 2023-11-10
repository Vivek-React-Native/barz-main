import * as React from 'react';
import { Fragment, useCallback, useContext, useState } from 'react';
import { Alert, View, Text } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@clerk/clerk-expo';
import { BarzAPI, User, UserInContextOfUserMe, Paginated } from '@barz/mobile/src/lib/api';
import { UserDataContext } from '@barz/mobile/src/user-data';
import requestCameraAndMicPermissions, {
  showCameraAndMicPermissionDeniedAlert,
} from '@barz/mobile/src/lib/request-camera-mic-permissions';

import ListItem from '@barz/mobile/src/ui/ListItem';
import SearchableListItemPicker from '@barz/mobile/src/components/SearchableListItemPicker';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import { User as IconUser } from '@barz/mobile/src/ui/icons';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '.';
import BattleContext, { EMPTY_CONTEXT_DATA } from './context';

const ChallengeSearchForUser: React.FunctionComponent<
  PageProps<'Battle > Challenge Search For User'>
> = ({ navigation }) => {
  const { getToken } = useAuth();

  const [userMe] = useContext(UserDataContext);
  const { setBattleContextData } = useContext(BattleContext);

  const [searchText, setSearchText] = useState('');

  const onFetchData = useCallback(
    async (
      page: number,
      searchQuery: string,
      signal: AbortSignal,
    ): Promise<Paginated<UserInContextOfUserMe>> => {
      const data = await BarzAPI.getUsers(getToken, page, searchQuery, signal);
      return {
        ...data,
        results:
          userMe.status === 'COMPLETE'
            ? data.results.filter((user) => user.id !== userMe.data.id)
            : data.results,
      };
    },
    [getToken],
  );

  const [waitingForPermissions, setWaitingForPermissions] = useState(false);
  const onSelectUserId = useCallback(
    (userId: User['id']) => {
      const navigateToChallenge = async () => {
        setWaitingForPermissions(true);

        // Before letting the user enter the battle workflow, make sure they have granted
        // microphone + camera access
        let result;
        try {
          result = await requestCameraAndMicPermissions();
        } catch (err) {
          showMessage({
            message: 'Error requesting camera and mic permissions!',
            description: `Aborting battle... ${err}`,
            type: 'warning',
          });
          setWaitingForPermissions(false);
          return;
        }
        if (!result) {
          setWaitingForPermissions(false);
          showCameraAndMicPermissionDeniedAlert();
          return;
        }

        setWaitingForPermissions(false);

        // NOTE: use `replace` here so that pressing the back button on the matching page goes back
        // to the initial page, and NOT back to this user search page.
        navigation.replace('Battle > Matching', {
          type: 'CHALLENGE',
          resumeExisting: false,
          userToChallengeId: userId,
        });
      };

      const goBack = () => {
        setBattleContextData(() => EMPTY_CONTEXT_DATA);
        navigation.navigate('Battle > Initial');
      };

      BarzAPI.isChallengingAnotherUser(getToken)
        .then((isChallengingAnotherUser) => {
          if (isChallengingAnotherUser) {
            Alert.alert(
              `You're already challenging someone`,
              'You can only send out one challenge at a time. Please cancel your current challenge to continue.',
              [
                {
                  text: 'Cancel Current Challenge',
                  isPreferred: true,
                  onPress: navigateToChallenge,
                },
                { text: 'Go Back', onPress: goBack },
              ],
            );
          } else {
            navigateToChallenge();
          }
        })
        .catch((err) => {
          console.log(`Error getting if challenging another user: ${err}`);
          showMessage({
            message: 'Error fetching if challenging another user!',
            type: 'info',
          });
        });
    },
    [getToken, setBattleContextData],
  );

  return (
    <Fragment>
      <StatusBar style="light" />
      <SearchableListItemPicker
        testID="battle-challenge-search-for-user"
        autoFocus={true}
        keyboardAppearance="dark"
        onFetchData={onFetchData}
        onRenderItem={(item, onPress, disabled, testID) => {
          let description: Array<string | ((color: string) => React.ReactNode)> = [
            `@${item.handle}`,
          ];
          if (item.computedIsFollowingUserMe && item.computedIsBeingFollowedByUserMe) {
            description.push((color) => (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <IconUser size={12} color={Color.Gray.Dark11} />
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}
                >
                  You follow each other
                </Text>
              </View>
            ));
          } else if (item.computedIsBeingFollowedByUserMe) {
            description.push((color) => (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <IconUser size={12} color={Color.Gray.Dark11} />
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}
                >
                  Following
                </Text>
              </View>
            ));
          } else if (item.computedIsFollowingUserMe) {
            description.push((color) => (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <IconUser size={12} color={Color.Gray.Dark11} />
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}
                >
                  Follows you
                </Text>
              </View>
            ));
          }

          return (
            <ListItem
              onPress={onPress}
              testID={testID}
              disabled={disabled}
              leading={() => (
                <View style={{ paddingRight: 16 }}>
                  <AvatarImage profileImageUrl={item.profileImageUrl} size={32} />
                </View>
              )}
              description={description}
            >
              {item.name || ''}
            </ListItem>
          );
        }}
        onSelectItem={(item) => {
          onSelectUserId(item.id);
        }}
        searchText={searchText}
        disabled={waitingForPermissions}
        searchBoxPlaceholder="Search by Rapper Name or handle"
        onChangeSearchText={setSearchText}
        emptyPlaceholderText="Search for users"
        notFoundPlaceholderText="No users found"
      />
    </Fragment>
  );
};

export default ChallengeSearchForUser;
