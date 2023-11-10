import * as React from 'react';
import { Fragment, useMemo, useState, useEffect, useCallback, useContext } from 'react';
import {
  Alert,
  Text,
  Keyboard,
  StyleSheet,
  Image,
  FlatList,
  View,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useAuth } from '@clerk/clerk-expo';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as WebBrowser from 'expo-web-browser';
import { intervalToDuration } from 'date-fns';
import colorAlpha from 'color-alpha';
import { LinearGradient } from 'expo-linear-gradient';

// import { FixMe } from '@barz/mobile/src/lib/fixme';
import {
  BarzAPI,
  BattleRecording,
  User,
  UserInContextOfUserMe,
  UserMe,
  FavoriteArtist,
  FavoriteTrack,
  RoughLocation,
  ForfeitedBeforeStartBattleRecording,
} from '@barz/mobile/src/lib/api';
import Button from '@barz/mobile/src/ui/Button';
import { SegmentedControl, SegmentedControlOption } from '@barz/mobile/src/ui/SegmentedControl';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';
import TextField from '@barz/mobile/src/ui/TextField';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import { UserDataContext } from '@barz/mobile/src/user-data';
import * as ImagePicker from '@barz/mobile/src/lib/image-picker';
import { VideoCachingPrefetchBattleRecordingVideos } from '@barz/mobile/src/video-cache';

import RapperNameField from '@barz/mobile/src/components/RapperNameField';
import BarsStackIcon from '@barz/mobile/src/components/BarsStackIcon';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import {
  Crown as IconCrown,
  Cog as IconCog,
  Plus as IconPlus,
  Fire as IconFire,
  ChevronRight as IconChevronRight,
  Edit as IconEdit,
  Clock as IconClock,
  Bio as IconBio,
  Lock as IconLock,
  Challenge as IconChallenge,
  Flag as IconFlag,
  Trophy as IconTrophy,
} from '@barz/mobile/src/ui/icons';
import { IconInstagram, IconSoundcloud } from '@barz/mobile/src/ui/SocialMediaIcons';
import formatDurationAsString from '@barz/mobile/src/lib/format-duration-as-string';
import InfiniteScrollFlatList from '@barz/mobile/src/components/InfiniteScrollFlatList';
import {
  InfiniteScrollListState,
  fetchInitialPage,
  fetchNextPage,
} from '@barz/mobile/src/lib/infinite-scroll-list';

const styles = StyleSheet.create({
  scrollWrapper: {
    width: '100%',
    height: '100%',
  },
  wrapper: {
    alignItems: 'center',
    // NOTE: add space above the profile view on android so the avatar image does not intersect
    // with the status bar
    paddingTop: Platform.select({ android: 64, ios: 10 }),
    flexGrow: 1,
  },

  battleListWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 24,
  },

  emptyTabPageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    gap: 12,
    width: 250,
  },

  emptyTabPageWrapperOuter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 32,
  },

  imageUploadPlus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    backgroundColor: Color.Yellow.Dark10,

    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    marginTop: 16,
    ...Typography.Display3,
    color: Color.White,
  },
  handle: {
    marginTop: 8,
    ...Typography.Body2,
    color: Color.Gray.Dark11,
  },

  profileStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  buttonsRowWrapper: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
  },

  segmentedControlWrapper: {
    width: '100%',
    flexDirection: 'row',
    borderTopColor: Color.Gray.Dark6,
    borderTopWidth: 1,
  },

  editWrapper: {
    gap: 28,
    height: '100%',
    marginTop: 16,
    marginLeft: 16,
    marginRight: 16,
    // NOTE: on android, add some space to the bottom of the edit wrapper so that the scroll
    // view can be scrolled all the way to the bottom
    marginBottom: Platform.select({ ios: 0, android: 96 }),
  },

  bioWrapper: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 20,
    paddingLeft: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 64,
  },

  editBioButtonWrapper: {
    marginBottom: 16,
  },

  bioIntroOuterWrapper: {
    paddingBottom: 8,
  },

  profileInfoWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    paddingBottom: 8,
  },

  bioIntroWrapper: {
    borderLeftColor: Color.Gray.Light2,
    borderLeftWidth: 1,
    paddingLeft: 12,
  },
  bioLabelWrapper: {
    gap: 2,
  },
  bioSocialMediaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  userProfileBattleListItemWrapper: {
    width: '100%',
    marginTop: 16,
  },
  userProfileBattleListPrivateMarker: {
    marginLeft: 16,
    marginRight: 16,
    flexDirection: 'row',
    gap: 2,
  },
  userProfileBattleListItemHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 8,
  },
  userProfileBattleListItemHeaderName: {
    ...Typography.Body1SemiBold,
    color: Color.White,
    flexGrow: 0,
    flexShrink: 1,
  },
  userProfileBattleListItemHeaderTimeLeft: {
    ...Typography.Body2,
    color: Color.Yellow.Dark10,
  },
  userProfileBattleListItemHeaderTime: {
    ...Typography.Body2,
    color: Color.Gray.Dark10,
  },
  userProfileBattleListItemVideoList: {
    flexDirection: 'row',
    marginLeft: 2,
    marginRight: 2,
  },
  userProfileBattleListItemVideoItem: {
    position: 'relative',
    flexGrow: 1,
    flexShrink: 1,
    aspectRatio: 1,
    backgroundColor: Color.Gray.Dark3,

    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Color.Gray.Dark1,
  },
  userProfileBattleListItemVideoItemOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',

    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  userProfileBattleListItemVideoItemWinCornerWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userProfileBattleListItemVideoItemNameWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 10,
  },
  userProfileBattleListItemVideoItemName: {
    alignSelf: 'flex-start',

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: Color.Black,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
  },
  userProfileBattleListItemVideoItemScore: {
    backgroundColor: Color.Black,
    height: 24,
    paddingLeft: 4,
    paddingRight: 4,

    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,

    position: 'absolute',
    top: 30,
    left: 8,
    zIndex: 10,
  },

  userProfileBattleListItemVideoItemVoteTotalWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,

    position: 'absolute',
    bottom: 8,
    // right or left set inline
    zIndex: 10,
  },

  userProfileBattleListItemVideoOverlay: {
    height: '100%',
    width: '100%',
    backgroundColor: Color.Blue.Dark6,
    position: 'absolute',
    zIndex: 2,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    // width
    // height
    zIndex: 99,
  },

  userProfileFakePressableTextFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Color.Gray.Dark7,
  },
});

// Props that the UserProfile component only needs when editing the "me" user:
type EditModeExtraProps = {
  onEnterEditMode?: () => void;
  onEnterBioEditMode?: () => void;

  workingUserSavingToClerk?: boolean;
  workingUserMeName: UserMe['name'];
  onChangeWorkingUserMeName: (newName: string) => void;
  workingUserMeHandle: UserMe['handle'];
  onChangeWorkingUserMeHandle: (newHandle: string) => void;
  workingUserSavingImageToClerk?: boolean;
  onChangeWorkingUserMeProfileImageUrl: (newImageUrl: UserMe['profileImageUrl']) => void;

  workingUserSavingBioDataToApi?: boolean;
  showRequiredToBattleFieldMarkers?: boolean;
  workingUserMeIntro: UserMe['intro'];
  onChangeWorkingUserMeIntro: (newIntro: UserMe['intro']) => void;
  workingUserMeRoughLocation: RoughLocation | null;
  onChangeWorkingUserMeRoughLocation: (newRoughLocation: RoughLocation | null) => void;
  workingUserMeFavoriteRapper: FavoriteArtist | null;
  onChangeWorkingUserMeFavoriteRapper: (newFavoriteRapper: FavoriteArtist | null) => void;
  workingUserMeFavoriteSong: FavoriteTrack | null;
  onChangeWorkingUserMeFavoriteSong: (newFavoriteTrack: FavoriteTrack | null) => void;
  workingUserMeInstagramHandle: string;
  onChangeWorkingUserMeInstagramHandle: (newHandle: string) => void;
  workingUserMeSoundcloudHandle: string;
  onChangeWorkingUserMeSoundcloudHandle: (soundcloudHandle: string) => void;

  onNavigateToSettingsPage?: () => void;
  onPickFavoriteArtist: () => Promise<FavoriteArtist | null>;
  onPickFavoriteSong: () => Promise<FavoriteTrack | null>;
  onPickRoughLocation: () => Promise<RoughLocation | null>;
};

// Props that the UserProfile component always needs:
type RegularProps = {
  onNavigateToBattlePlayer: (
    battleId: BattleRecording['battleId'],
    battleRecordingsList: Array<BattleRecording>,
    userId: User['id'],
  ) => void;
  onNavigateToFollowingFollowersPage: (
    userId: User['id'],
    initialView: 'FOLLOWING' | 'FOLLOWERS',
  ) => void;
};

// Props that are required when showing the profile for another user:
type AnotherUserProps = {
  onFollow?: () => void;
  onUnFollow?: () => void;
  followUnFollowLoading?: boolean;
  onNavigateToChallengePage?: (userId: User['id']) => void;
};

type Props =
  | ({ mode?: undefined; user: UserInContextOfUserMe } & RegularProps &
      AnotherUserProps &
      Partial<EditModeExtraProps>)
  | ({ mode: 'VIEW' | 'EDIT' | 'EDIT_BIO'; user: UserMe } & RegularProps &
      Partial<AnotherUserProps> &
      EditModeExtraProps);

export const UserProfileAvatarImageUpload: React.FunctionComponent<{
  profileImageUrl: string | null;
  loading: boolean;
  size?: number;
  onChangeImageUrl: (url: string | null) => void;
}> = ({ profileImageUrl, loading, size = 96, onChangeImageUrl }) => {
  if (loading) {
    return <AvatarImage profileImageUrl={profileImageUrl} size={size} loading />;
  }

  return (
    <AvatarImage
      profileImageUrl={profileImageUrl}
      size={size}
      testID="user-profile-avatar-image-upload"
      decoration={
        <View style={styles.imageUploadPlus}>
          <IconPlus color={Color.Black} />
        </View>
      }
      onPress={async () => {
        const imageLocation: 'camera' | 'photos' | 'clear' | null = await new Promise((resolve) => {
          Alert.alert('Upload profile image', 'Select image location', [
            {
              text: 'Camera',
              onPress: () => resolve('camera'),
            },
            {
              text: 'Photos',
              onPress: () => resolve('photos'),
            },
            ...(profileImageUrl !== null
              ? [
                  {
                    text: 'Clear',
                    onPress: () => resolve('clear'),
                  },
                ]
              : []),
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(null),
            },
          ]);
        });

        let result;
        switch (imageLocation) {
          case 'camera':
            const permissionsCheckResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionsCheckResult.granted) {
              Alert.alert(
                'Permission denied',
                'Please grant camera permissions to take a profile picture.',
                [{ text: 'OK', onPress: () => {} }],
              );
              return;
            }

            result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });
            break;
          case 'photos':
            result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });
            break;
          case 'clear':
            onChangeImageUrl(null);
            return;
          default:
            return;
        }

        if (result.canceled || result.assets.length === 0) {
          return;
        }
        onChangeImageUrl(result.assets[0].uri);
      }}
    />
  );
};

const UserProfileBattleListItemUserDetailsHeader: React.FunctionComponent<{
  participant: BattleRecording['participants'][0];
}> = ({ participant }) => (
  <Fragment>
    {/* Render the participant user's info in the upper left */}
    {/* NOTE: this wrapper element takes up the full width of the cell, so that the */}
    {/* ellipsis can apply properly */}
    <View style={styles.userProfileBattleListItemVideoItemNameWrapper}>
      <View style={styles.userProfileBattleListItemVideoItemName}>
        <Text
          style={{ ...Typography.Body2SemiBold, color: Color.White }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {participant.user.name}
        </Text>
      </View>
    </View>
    <View style={styles.userProfileBattleListItemVideoItemScore}>
      <IconFire size={14} color={Color.White} />
      <Text style={{ ...Typography.Body2, color: Color.White }}>
        {participant.user.computedScore}
      </Text>
    </View>
  </Fragment>
);

const UserProfileBattleListItemParticipantImage: React.FunctionComponent<{
  participant: BattleRecording['participants'][0];
}> = ({ participant }) => (
  <Fragment>
    {/* If no image can be loaded, show the avatar image */}
    <AvatarImage profileImageUrl={participant.user.profileImageUrl} size={96} />

    {/* Start by loading the smallest thumbnail image */}
    {/* more info: https://medium.com/react-native-training/progressive-image-loading-in-react-native-e7a01827feb7 */}
    {participant.mediaThumbnailUrls && participant.mediaThumbnailUrls['64'] ? (
      <Image
        source={{ uri: participant.mediaThumbnailUrls['64'] }}
        resizeMode="cover"
        style={{ ...StyleSheet.absoluteFillObject, zIndex: 1 }}
        blurRadius={2}
      />
    ) : null}

    {/* Then load a slightly larger thumbnail image */}
    {participant.mediaThumbnailUrls && participant.mediaThumbnailUrls['256'] ? (
      <Image
        source={{ uri: participant.mediaThumbnailUrls['256'] }}
        resizeMode="cover"
        style={{ ...StyleSheet.absoluteFillObject, zIndex: 2 }}
      />
    ) : null}
  </Fragment>
);

const UserProfileBattleListItem: React.FunctionComponent<{
  battleRecording: BattleRecording | ForfeitedBeforeStartBattleRecording;
  testID?: string;
  onPress?: (battleId: BattleRecording['battleId']) => void;
}> = ({ battleRecording, testID, onPress }) => {
  const parsedVotingEndsAt = useMemo(
    () =>
      battleRecording.battleVotingEndsAt ? new Date(battleRecording.battleVotingEndsAt) : null,
    [battleRecording.battleVotingEndsAt],
  );

  const [[countdownStatus, countdownFormatted], setCountdownMetadata] = useState<
    ['ONGOING' | 'COMPLETED' | 'UNKNOWN', string]
  >(['UNKNOWN', '']);

  // Compute what the countdown label should say
  useEffect(() => {
    const run = () => {
      const now = new Date();

      if (!parsedVotingEndsAt) {
        setCountdownMetadata(['UNKNOWN', '']);
        return;
      }

      let status;
      let duration;
      if (now < parsedVotingEndsAt) {
        status = 'ONGOING' as const;
        duration = intervalToDuration({
          start: now,
          end: parsedVotingEndsAt,
        });
      } else {
        status = 'COMPLETED' as const;
        duration = intervalToDuration({
          start: parsedVotingEndsAt,
          end: now,
        });
      }

      const finalStatus = status;
      const finalResult = formatDurationAsString(duration);

      setCountdownMetadata((old) => {
        if (old[0] !== finalStatus || old[1] !== finalResult) {
          return [finalStatus, finalResult];
        } else {
          return old;
        }
      });
    };
    run();

    // Rerun this logic every second to regenerate the text that should be rendered to the screen
    // This facilutates the "counting down" effect of the timestamp
    const id = setInterval(run, 1000);
    return () => {
      clearInterval(id);
    };
  }, [parsedVotingEndsAt]);

  return (
    <PressableChangesOpacity
      style={styles.userProfileBattleListItemWrapper}
      testID={testID}
      // Don't allow a user to tap on a battle if there is no video data available for any of the participants
      disabled={!battleRecording.participants.every((p) => p.mediaUrl)}
      onPress={onPress ? () => onPress(battleRecording.battleId) : undefined}
    >
      {battleRecording.battleComputedPrivacyLevel === 'PRIVATE' ? (
        <View style={styles.userProfileBattleListPrivateMarker}>
          <IconLock size={14} color={Color.Gray.Dark11} />
          <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>Private</Text>
        </View>
      ) : null}
      <View style={styles.userProfileBattleListItemHeader}>
        <Text
          style={styles.userProfileBattleListItemHeaderName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {battleRecording.participants.map((p) => p.user.name).join(' vs ')}
        </Text>
        {countdownStatus === 'ONGOING' ? (
          <Text
            style={styles.userProfileBattleListItemHeaderTimeLeft}
            numberOfLines={1}
          >{`${countdownFormatted} left!`}</Text>
        ) : null}
        {countdownStatus === 'COMPLETED' ? (
          <Text style={styles.userProfileBattleListItemHeaderTime} numberOfLines={1}>
            {countdownFormatted}
          </Text>
        ) : null}
      </View>
      {battleRecording.battleComputedHasBeenForfeited ? (
        <View style={styles.userProfileBattleListItemVideoList}>
          {battleRecording.participants.map((participant, index) => {
            let contents: React.ReactNode;
            if (participant.videoStreamingStartedAt && participant.forfeitedAt) {
              // Add dark shadow bg
              contents = (
                <Fragment>
                  <UserProfileBattleListItemParticipantImage participant={participant} />

                  <View style={styles.userProfileBattleListItemVideoItemOverlay}>
                    <IconFlag color={Color.White} size={24} />
                    <Text style={{ ...Typography.Body3SemiBold, color: Color.White }}>
                      Forfeited Battle
                    </Text>
                  </View>
                </Fragment>
              );
            } else if (participant.videoStreamingStartedAt) {
              contents = (
                <Fragment>
                  <UserProfileBattleListItemParticipantImage participant={participant} />

                  <View style={styles.userProfileBattleListItemVideoItemWinCornerWrapper}>
                    <IconTrophy color={Color.Yellow.Dark10} size={16} />
                    <Text style={{ ...Typography.Body3SemiBold, color: Color.Yellow.Dark10 }}>
                      Got the win
                    </Text>
                  </View>
                </Fragment>
              );
            } else if (participant.forfeitedAt) {
              contents = (
                <Fragment>
                  <IconFlag color={Color.Gray.Dark11} size={24} />
                  <Text style={{ ...Typography.Body3SemiBold, color: Color.Gray.Dark11 }}>
                    Forfeited Battle
                  </Text>
                  <Text style={{ ...Typography.Body3, color: Color.Gray.Dark11 }}>
                    Before it started!
                  </Text>
                </Fragment>
              );
            } else {
              contents = (
                <Fragment>
                  <IconTrophy color={Color.Yellow.Dark10} size={24} />
                  <Text style={{ ...Typography.Body3SemiBold, color: Color.Yellow.Dark10 }}>
                    Got the Win
                  </Text>
                </Fragment>
              );
            }
            return (
              <View
                key={participant.id}
                style={[
                  styles.userProfileBattleListItemVideoItem,
                  index % 2 === 0 ? { borderRightWidth: 1 } : { borderLeftWidth: 1 },
                ]}
              >
                {contents}

                {/* Render the participant user's info in the upper left */}
                <UserProfileBattleListItemUserDetailsHeader participant={participant} />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.userProfileBattleListItemVideoList}>
          {battleRecording.participants.map((participant, index) => {
            return (
              <View
                key={participant.id}
                style={[
                  styles.userProfileBattleListItemVideoItem,
                  index % 2 === 0 ? { borderRightWidth: 1 } : { borderLeftWidth: 1 },
                ]}
              >
                <UserProfileBattleListItemParticipantImage participant={participant} />
                <LinearGradient
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 2,
                  }}
                  colors={['rgba(0, 0, 0, 0.0)', 'rgba(0, 0, 0, 0.6)']}
                  locations={[0.6875, 1]}
                />

                {/* Render the participant user's info in the upper left */}
                <UserProfileBattleListItemUserDetailsHeader participant={participant} />

                {/* Render the participant vote total in the lower right */}
                <View
                  style={[
                    styles.userProfileBattleListItemVideoItemVoteTotalWrapper,
                    index % 2 === 0 ? { right: 8 } : { left: 8 },
                  ]}
                >
                  {battleRecording.battleComputedPrivacyLevel === 'PUBLIC' ? (
                    <Fragment>
                      <BarsStackIcon size={14} />
                      <Text style={{ ...Typography.Body3, color: Color.White }}>
                        {participant.computedTotalVoteAmount}
                      </Text>
                    </Fragment>
                  ) : (
                    <IconLock size={14} color={colorAlpha(Color.White, 0.75)} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </PressableChangesOpacity>
  );
};

const UserProfileBattleList: React.FunctionComponent<{
  userId: User['id'];
  sort?: 'RECENT' | 'TRENDING';
  testID?: string;
  visible?: boolean;
  reloadCounter: number;
  onPressBattle?: (
    battleId: BattleRecording['battleId'],
    battleRecordings: Array<BattleRecording>,
    userId: User['id'],
  ) => void;
}> = ({ userId, sort = 'RECENT', testID, visible, reloadCounter, onPressBattle }) => {
  const [battleRecordingListState, setBattleListState] = useState<
    InfiniteScrollListState<BattleRecording | ForfeitedBeforeStartBattleRecording>
  >({ status: 'IDLE' });

  const { getToken } = useAuth();

  const fetchPageOfData = useCallback(
    async (page: number) => {
      const includeEmptyForfeitedBattles = sort === 'RECENT';
      return BarzAPI.getBattlesUserParticipatedIn(
        getToken,
        userId,
        page,
        sort,
        includeEmptyForfeitedBattles,
      );
    },
    [getToken, userId, sort],
  );

  useEffect(() => {
    fetchInitialPage(setBattleListState, fetchPageOfData, (error) => {
      console.log(`Error fetching ${sort} battles page 1: ${error}`);
      showMessage({
        message: 'Error fetching battles!',
        type: 'info',
      });
    });
  }, [setBattleListState, fetchPageOfData, sort, reloadCounter]);

  const onLoadNextPage = useCallback(async () => {
    return fetchNextPage(
      battleRecordingListState,
      setBattleListState,
      fetchPageOfData,
      (error, page) => {
        console.log(`Error fetching ${sort} battles page ${page}: ${error}`);
        showMessage({
          message: 'Error fetching battles!',
          type: 'info',
        });
      },
      (battleRecording) => battleRecording.battleId,
    );
  }, [battleRecordingListState, setBattleListState, fetchPageOfData, sort]);

  if (!visible) {
    return null;
  }

  switch (battleRecordingListState.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      return (
        <View style={styles.battleListWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>Loading</Text>
        </View>
      );
    case 'ERROR':
      return (
        <View style={styles.battleListWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>
            {`Error: ${battleRecordingListState.error}`}
          </Text>
        </View>
      );
    case 'LOADING_NEW_PAGE':
    case 'COMPLETE':
      if (battleRecordingListState.data.length > 0) {
        const nonForfeitedBattleRecordings = battleRecordingListState.data.filter(
          (r): r is BattleRecording => !r.battleComputedHasBeenForfeited,
        );
        return (
          <Fragment>
            {/* Once the view is loaded, start pre-fetching the battle recording videos */}
            <VideoCachingPrefetchBattleRecordingVideos
              battleRecordings={nonForfeitedBattleRecordings}
            />

            <InfiniteScrollFlatList
              data={battleRecordingListState.data}
              keyExtractor={(battleRecording) => battleRecording.battleId}
              renderItem={({ item }) => (
                <UserProfileBattleListItem
                  battleRecording={item}
                  testID={testID ? `${testID}-item` : undefined}
                  onPress={
                    onPressBattle
                      ? () =>
                          onPressBattle(
                            item.battleId,
                            battleRecordingListState.data.filter(
                              (r): r is BattleRecording => r.battleStartedAt !== null,
                            ),
                            userId,
                          )
                      : undefined
                  }
                />
              )}
              nestedScrollEnabled
              allDataHasBeenFetched={
                battleRecordingListState.status === 'COMPLETE' &&
                !battleRecordingListState.nextPageAvailable
              }
              fetchingNextPage={battleRecordingListState.status === 'LOADING_NEW_PAGE'}
              onFetchNextPage={onLoadNextPage}
            />
          </Fragment>
        );
      } else {
        return (
          <View style={styles.battleListWrapper}>
            <View style={styles.emptyTabPageWrapper}>
              <Text style={{ ...Typography.Heading3, color: Color.White }}>No Battles Yet</Text>
              <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11, textAlign: 'center' }}>
                When you start battling, your recordings will show up here
              </Text>
            </View>
          </View>
        );
      }
  }
};

const UserProfileFakePressableTextField: React.FunctionComponent<{
  label: string;
  labelRequired?: boolean;
  value?: string;
  disabled?: boolean;
  placeholder: string;
  testID?: string;
  onPress: () => void;
}> = ({ label, labelRequired, value, disabled = false, placeholder, testID, onPress }) => {
  return (
    <View>
      <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>
        {label}
        {labelRequired ? <Text style={{ color: Color.Red.Dark10 }}> *</Text> : null}
      </Text>

      <PressableChangesOpacity
        style={styles.userProfileFakePressableTextFieldWrapper}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
      >
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{
            ...Typography.Body1,
            fontSize: 22,
            lineHeight: 24,
            color: value ? Color.White : Color.Gray.Dark9,
          }}
        >
          {value || placeholder}
        </Text>
        <IconChevronRight size={24} color={Color.Gray.Dark9} />
      </PressableChangesOpacity>
    </View>
  );
};

const UserProfileBioLabelField: React.FunctionComponent<{
  label: string;
  value: string;
  subValue?: string;
  testID?: string;
}> = ({ label, value, subValue, testID }) => (
  <View style={styles.bioLabelWrapper}>
    <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>{label}</Text>
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        ...Typography.Body1,
        fontSize: Typography.Heading4.fontSize,
        lineHeight: Typography.Heading4.lineHeight,
        color: Color.White,
      }}
      testID={testID}
    >
      {value}
    </Text>
    {subValue ? (
      <Text style={{ ...Typography.Body3, color: Color.Gray.Dark9 }}>{subValue}</Text>
    ) : null}
  </View>
);

const UserProfileBioSocialMediaField: React.FunctionComponent<{
  leading: (color: string | undefined) => React.ReactNode;
  handle: string;
  onPress?: () => void;
  testID?: string;
}> = ({ leading, handle, onPress, testID }) => {
  return (
    <PressableChangesOpacity
      style={styles.bioSocialMediaWrapper}
      onPress={onPress}
      disabled={!onPress}
    >
      {leading(undefined)}
      <Text style={{ ...Typography.Heading4, color: Color.White }} testID={testID}>
        {handle}
      </Text>
    </PressableChangesOpacity>
  );
};

export const UserProfileHeader: React.FunctionComponent<{
  user: UserInContextOfUserMe;
  testID?: string;
  onNavigateToFollowingFollowersPage?: (
    userId: User['id'],
    page: 'FOLLOWING' | 'FOLLOWERS',
  ) => void;
}> = ({ user, testID, onNavigateToFollowingFollowersPage }) => (
  <Fragment>
    <AvatarImage profileImageUrl={user.profileImageUrl} size={96} />

    <Text style={styles.name}>{user.name}</Text>

    <Text style={styles.handle}>@{user.handle}</Text>

    <View style={{ flexDirection: 'row', gap: 24, marginTop: 16 }}>
      <PressableChangesOpacity
        style={styles.profileStat}
        onPress={() => {
          if (onNavigateToFollowingFollowersPage) {
            onNavigateToFollowingFollowersPage(user.id, 'FOLLOWERS');
          }
        }}
        testID="profile-followers-button"
      >
        <Text
          style={{ ...Typography.Body1, color: Color.White }}
          testID={`${testID}-followers-count`}
        >
          {user.computedFollowersCount}
        </Text>
        <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>Followers</Text>
      </PressableChangesOpacity>
      <PressableChangesOpacity
        style={styles.profileStat}
        onPress={() => {
          if (onNavigateToFollowingFollowersPage) {
            onNavigateToFollowingFollowersPage(user.id, 'FOLLOWING');
          }
        }}
        testID="profile-following-button"
      >
        <Text
          style={{ ...Typography.Body1, color: Color.White }}
          testID={`${testID}-following-count`}
        >
          {user.computedFollowingCount}
        </Text>
        <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>Following</Text>
      </PressableChangesOpacity>
      <View style={styles.profileStat}>
        <Text style={{ ...Typography.Body1, color: Color.White }}>{user.computedScore}</Text>
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <IconCrown color={Color.Gray.Dark11} size={14} />
          <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>Clout</Text>
        </View>
      </View>
    </View>
  </Fragment>
);

export const UserProfileBioDetails: React.FunctionComponent<{
  user: UserInContextOfUserMe;
  isOwnProfile: boolean;
  onEnterBioEditMode?: () => void;
  testID?: string;
}> = ({ user, isOwnProfile, onEnterBioEditMode, testID }) => {
  const atLeastOneBioFieldSet = Boolean(
    user.intro.length > 0 ||
      user.locationName ||
      user.favoriteRapperName ||
      user.favoriteSongName ||
      user.instagramHandle ||
      user.soundcloudHandle,
  );

  return (
    <Fragment>
      {atLeastOneBioFieldSet || !onEnterBioEditMode ? (
        <View style={styles.bioWrapper}>
          {isOwnProfile && onEnterBioEditMode ? (
            <View style={styles.editBioButtonWrapper}>
              <Button
                type="secondary"
                size={36}
                onPress={onEnterBioEditMode}
                leading={(color) => <IconEdit size={18} color={color} />}
                testID={`${testID}-edit-button`}
              >
                Edit Bio
              </Button>
            </View>
          ) : null}
          <View style={styles.bioIntroOuterWrapper}>
            <View style={styles.bioIntroWrapper}>
              <Text
                style={{
                  ...Typography.Body1,
                  fontSize: Typography.Heading3.fontSize,
                  lineHeight: Typography.Heading3.lineHeight,
                  color: Color.White,
                }}
                testID={`${testID}-intro`}
              >
                {user.intro}
              </Text>
            </View>
          </View>
          {user.locationName || user.favoriteRapperName || user.favoriteSongName ? (
            <View style={styles.profileInfoWrapper}>
              {user.locationName ? (
                <UserProfileBioLabelField
                  label="Location"
                  value={user.locationName}
                  testID={`${testID}-location-name`}
                />
              ) : null}
              {user.favoriteRapperName ? (
                <UserProfileBioLabelField
                  label="Favorite Rapper"
                  value={user.favoriteRapperName}
                  testID={`${testID}-favorite-rapper-name`}
                />
              ) : null}
              {user.favoriteSongName ? (
                <UserProfileBioLabelField
                  label="Favorite Song"
                  value={user.favoriteSongName}
                  subValue={
                    user.favoriteSongArtistName ? `by ${user.favoriteSongArtistName}` : undefined
                  }
                  testID={`${testID}-favorite-song-name`}
                />
              ) : null}
            </View>
          ) : null}
          {user.instagramHandle ? (
            <UserProfileBioSocialMediaField
              leading={(color) => <IconInstagram size={12} color={color} />}
              handle={user.instagramHandle}
              onPress={() => {
                WebBrowser.openBrowserAsync(`https://instagram.com/${user.instagramHandle}`);
              }}
              testID={`${testID}-instagram-handle`}
            />
          ) : null}
          {user.soundcloudHandle ? (
            <UserProfileBioSocialMediaField
              leading={(color) => <IconSoundcloud size={12} color={color} />}
              handle={user.soundcloudHandle}
              onPress={() => {
                WebBrowser.openBrowserAsync(`https://soundcloud.com/${user.soundcloudHandle}`);
              }}
              testID={`${testID}-soundcloud-handle`}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyTabPageWrapperOuter}>
          <View style={styles.emptyTabPageWrapper}>
            {isOwnProfile ? (
              <Fragment>
                <Text style={{ ...Typography.Heading3, color: Color.White }}>Add Bio</Text>
                <Text
                  style={{ ...Typography.Body2, color: Color.Gray.Dark11, textAlign: 'center' }}
                >
                  Show us who you are by writing an intro, sharing your musical influences, plugging
                  us your tracks, and more
                </Text>
                <View style={{ paddingTop: 12 }}>
                  <Button
                    size={36}
                    onPress={onEnterBioEditMode}
                    testID={`${testID}-get-started-button`}
                  >
                    Get Started
                  </Button>
                </View>
              </Fragment>
            ) : (
              <Fragment>
                <Text style={{ ...Typography.Heading3, color: Color.White }}>Bio Empty</Text>
                <Text
                  style={{ ...Typography.Body1, color: Color.Gray.Dark11, textAlign: 'center' }}
                >
                  This user has not added a bio yet.
                </Text>
              </Fragment>
            )}
          </View>
        </View>
      )}
    </Fragment>
  );
};

const UserProfile: React.FunctionComponent<Props> = ({
  user,

  onFollow,
  onUnFollow,
  followUnFollowLoading = false,

  mode,
  onEnterEditMode,
  onEnterBioEditMode,

  workingUserSavingToClerk = false,
  workingUserMeName,
  onChangeWorkingUserMeName,
  workingUserMeHandle,
  onChangeWorkingUserMeHandle,
  workingUserSavingImageToClerk = false,
  onChangeWorkingUserMeProfileImageUrl,

  workingUserSavingBioDataToApi = false,
  showRequiredToBattleFieldMarkers = false,
  workingUserMeIntro,
  onChangeWorkingUserMeIntro,
  workingUserMeRoughLocation,
  onChangeWorkingUserMeRoughLocation,
  workingUserMeFavoriteRapper,
  onChangeWorkingUserMeFavoriteRapper,
  workingUserMeFavoriteSong,
  onChangeWorkingUserMeFavoriteSong,
  workingUserMeInstagramHandle,
  onChangeWorkingUserMeInstagramHandle,
  workingUserMeSoundcloudHandle,
  onChangeWorkingUserMeSoundcloudHandle,

  onNavigateToSettingsPage,
  onPickFavoriteArtist,
  onPickFavoriteSong,
  onPickRoughLocation,
  onNavigateToBattlePlayer,
  onNavigateToFollowingFollowersPage,
  onNavigateToChallengePage,
}) => {
  const [userMe] = useContext(UserDataContext);
  const isOwnProfile = userMe.status === 'COMPLETE' ? userMe.data.id === user.id : false;

  const [focusedTab, setFocusedTab] = useState<'RECENT' | 'TRENDING' | 'BIO'>('RECENT');

  const [battleListReloadCounter, setBattleListReloadCounter] = useState(0);

  if (isOwnProfile && mode === 'EDIT') {
    return (
      <Pressable
        style={styles.editWrapper}
        onPress={Keyboard.dismiss}
        testID="profile-edit-wrapper"
      >
        <View style={{ width: 96, height: 96 }}>
          <UserProfileAvatarImageUpload
            profileImageUrl={user.profileImageUrl}
            loading={workingUserSavingImageToClerk}
            onChangeImageUrl={onChangeWorkingUserMeProfileImageUrl}
          />
        </View>

        <RapperNameField
          value={workingUserMeName || ''}
          label="Rapper Name"
          width="100%"
          placeholder="Battler name"
          onChangeText={(name) => {
            if (onChangeWorkingUserMeName) {
              onChangeWorkingUserMeName(name);
            }
          }}
          editable={!workingUserSavingToClerk && typeof onChangeWorkingUserMeName !== 'undefined'}
          testID="profile-edit-name"
        />

        <TextField
          size={56}
          type="clear"
          value={workingUserMeHandle || ''}
          label="Handle"
          leadingText="@"
          placeholder="Handle"
          onChangeText={(handle) => {
            if (onChangeWorkingUserMeHandle) {
              onChangeWorkingUserMeHandle(handle);
            }
          }}
          editable={!workingUserSavingToClerk && typeof onChangeWorkingUserMeHandle !== 'undefined'}
          testID="profile-edit-handle"
        />
      </Pressable>
    );
  } else if (isOwnProfile && mode === 'EDIT_BIO') {
    return (
      <KeyboardAwareScrollView viewIsInsideTabBar style={{ height: '100%' }}>
        <Pressable
          style={styles.editWrapper}
          onPress={Keyboard.dismiss}
          testID="profile-bio-edit-wrapper"
        >
          <View>
            <View style={{ maxHeight: 150 }}>
              <TextField
                size={56}
                type="clear"
                label="Intro"
                labelRequired={showRequiredToBattleFieldMarkers}
                placeholder="Tell us what you're about"
                value={workingUserMeIntro}
                onChangeText={onChangeWorkingUserMeIntro}
                editable={!workingUserSavingBioDataToApi}
                multiline
                maxLength={140}
                testID="profile-bio-edit-intro-field"
              />
            </View>
            <Text style={{ ...Typography.Body2, color: Color.Gray.Dark10, marginTop: 8 }}>
              140 characters max
            </Text>
          </View>

          <UserProfileFakePressableTextField
            label="Location"
            labelRequired={showRequiredToBattleFieldMarkers}
            value={workingUserMeRoughLocation ? workingUserMeRoughLocation.name : undefined}
            placeholder="Add your location"
            disabled={workingUserSavingBioDataToApi}
            onPress={() => {
              onPickRoughLocation()
                .then((location) => {
                  onChangeWorkingUserMeRoughLocation(location);
                })
                .catch((err) => {
                  console.error('Error picking location!', err);
                  showMessage({
                    message: 'Error picking location!',
                    type: 'info',
                  });
                });
            }}
            testID="profile-bio-edit-location-field"
          />
          <UserProfileFakePressableTextField
            label="Favorite Rapper"
            labelRequired={showRequiredToBattleFieldMarkers}
            value={workingUserMeFavoriteRapper ? workingUserMeFavoriteRapper.name : undefined}
            placeholder="Add your favorite rapper"
            disabled={workingUserSavingBioDataToApi}
            onPress={() => {
              onPickFavoriteArtist()
                .then((favoriteArtist) => {
                  onChangeWorkingUserMeFavoriteRapper(favoriteArtist);
                })
                .catch((err) => {
                  console.error('Error picking favorite artist!', err);
                  showMessage({
                    message: 'Error picking favorite artist!',
                    type: 'info',
                  });
                });
            }}
            testID="profile-bio-edit-favorite-artist-field"
          />
          <UserProfileFakePressableTextField
            label="Favorite Song"
            labelRequired={showRequiredToBattleFieldMarkers}
            value={workingUserMeFavoriteSong ? workingUserMeFavoriteSong.name : undefined}
            placeholder="Add your favorite song"
            disabled={workingUserSavingBioDataToApi}
            onPress={() => {
              onPickFavoriteSong()
                .then((favoriteSong) => {
                  onChangeWorkingUserMeFavoriteSong(favoriteSong);
                })
                .catch((err) => {
                  console.error('Error picking favorite song!', err);
                  showMessage({
                    message: 'Error picking favorite song!',
                    type: 'info',
                  });
                });
            }}
            testID="profile-bio-edit-favorite-song-field"
          />
          {/* TODO: Links */}
          <TextField
            size={56}
            type="clear"
            label="Instagram"
            leadingText="@"
            placeholder="yourusername"
            value={workingUserMeInstagramHandle}
            onChangeText={onChangeWorkingUserMeInstagramHandle}
            editable={!workingUserSavingBioDataToApi}
            autoCapitalize="none"
            testID="profile-bio-edit-instagram-field"
          />
          {/* TODO: Spotify */}
          <TextField
            size={56}
            type="clear"
            label="Soundcloud"
            leadingText="soundcloud.com/"
            placeholder="profile-url"
            value={workingUserMeSoundcloudHandle}
            onChangeText={onChangeWorkingUserMeSoundcloudHandle}
            editable={!workingUserSavingBioDataToApi}
            autoCapitalize="none"
            testID="profile-bio-edit-soundcloud-field"
          />
          {/* TODO: Photos */}
        </Pressable>
      </KeyboardAwareScrollView>
    );
  } else {
    return (
      <FlatList
        nestedScrollEnabled
        data={['HEADER' as const, 'SELECTED_TAB_CONTENTS' as const]}
        keyExtractor={(n) => n}
        style={styles.scrollWrapper}
        refreshControl={
          <RefreshControl
            // NOTE: On android, make the pull to refresh indicator NOT white because then it's
            // white on a white background
            colors={Platform.select({ ios: [Color.White], android: [Color.Black] })}
            tintColor={Color.White}
            refreshing={false}
            onRefresh={() => setBattleListReloadCounter((n) => n + 1)}
          />
        }
        testID="profile-scroll"
        renderItem={({ item }) => {
          switch (item) {
            case 'HEADER':
              return (
                <Pressable
                  style={styles.wrapper}
                  onPress={Keyboard.dismiss}
                  testID="profile-wrapper"
                >
                  <UserProfileHeader
                    user={user}
                    testID="profile"
                    onNavigateToFollowingFollowersPage={onNavigateToFollowingFollowersPage}
                  />

                  {isOwnProfile ? (
                    <View style={styles.buttonsRowWrapper}>
                      <Button
                        size={36}
                        type="outline"
                        disabled={!onEnterEditMode}
                        testID="profile-edit-profile"
                        onPress={onEnterEditMode}
                      >
                        Edit Profile
                      </Button>
                      <Button
                        size={36}
                        type="outline"
                        disabled={!onNavigateToSettingsPage}
                        testID="profile-settings"
                        onPress={onNavigateToSettingsPage}
                        leading={(color, iconSize) => (
                          <IconCog color={Color.White} size={iconSize} />
                        )}
                      />
                    </View>
                  ) : (
                    <View style={styles.buttonsRowWrapper}>
                      {user.computedIsBeingFollowedByUserMe ? (
                        <Button
                          size={40}
                          type="secondary"
                          disabled={!onUnFollow || followUnFollowLoading}
                          testID="profile-unfollow"
                          onPress={onUnFollow}
                        >
                          {followUnFollowLoading ? 'Loading...' : 'Following'}
                        </Button>
                      ) : (
                        <Button
                          size={40}
                          type="outlineAccent"
                          disabled={!onFollow || followUnFollowLoading}
                          testID="profile-follow"
                          onPress={onFollow}
                        >
                          {followUnFollowLoading ? 'Loading...' : 'Follow'}
                        </Button>
                      )}
                      {onNavigateToChallengePage ? (
                        <Button
                          size={40}
                          type="outline"
                          onPress={() => onNavigateToChallengePage(user.id)}
                          leading={(color) => <IconChallenge size={20} color={color} />}
                          testID="profile-challenge"
                        >
                          Challenge
                        </Button>
                      ) : null}
                    </View>
                  )}
                  <View style={styles.segmentedControlWrapper}>
                    <SegmentedControl>
                      <SegmentedControlOption
                        type="icon"
                        testID="profile-recent-tab"
                        icon={(color) => <IconClock color={color} />}
                        active={focusedTab === 'RECENT'}
                        onPressAction={() => setFocusedTab('RECENT')}
                      />
                      <SegmentedControlOption
                        type="icon"
                        testID="profile-trending-tab"
                        icon={(color) => <IconFire color={color} />}
                        active={focusedTab === 'TRENDING'}
                        onPressAction={() => setFocusedTab('TRENDING')}
                      />
                      <SegmentedControlOption
                        type="icon"
                        testID="profile-bio-tab"
                        icon={(color) => <IconBio color={color} />}
                        active={focusedTab === 'BIO'}
                        onPressAction={() => setFocusedTab('BIO')}
                      />
                    </SegmentedControl>
                  </View>
                </Pressable>
              );

            case 'SELECTED_TAB_CONTENTS':
              return (
                <Fragment>
                  <UserProfileBattleList
                    // NOTE: I am using this visible prop to toggle whether the battle list is shown or not
                    // ensures that the state is persisted when a user switches tabs, rather than unmounting
                    // and remounting the component, which would force the list of battle recordings to be
                    // refetched
                    visible={focusedTab === 'RECENT'}
                    reloadCounter={battleListReloadCounter}
                    userId={user.id}
                    sort="RECENT"
                    testID="profile-recent-battle-list"
                    onPressBattle={onNavigateToBattlePlayer}
                  />
                  <UserProfileBattleList
                    // NOTE: I am using this visible prop to toggle whether the battle list is shown or not
                    // ensures that the state is persisted when a user switches tabs, rather than unmounting
                    // and remounting the component, which would force the list of battle recordings to be
                    // refetched
                    visible={focusedTab === 'TRENDING'}
                    reloadCounter={battleListReloadCounter}
                    userId={user.id}
                    sort="TRENDING"
                    testID="profile-trending-battle-list"
                    onPressBattle={onNavigateToBattlePlayer}
                  />
                  {focusedTab === 'BIO' ? (
                    <UserProfileBioDetails
                      user={user}
                      isOwnProfile={isOwnProfile}
                      onEnterBioEditMode={onEnterBioEditMode}
                      testID="profile-bio"
                    />
                  ) : null}
                </Fragment>
              );
          }
        }}
      />
    );
  }
};

export default UserProfile;
