import { View, Platform, Text, StyleSheet, Pressable, Keyboard, ViewToken } from 'react-native';
import {
  Fragment,
  useState,
  useMemo,
  memo,
  useRef,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { showMessage } from 'react-native-flash-message';
import debounce from 'lodash.debounce';
import alpha from 'color-alpha';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Share from 'react-native-share';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { intervalToDuration } from 'date-fns';
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetFooterProps,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useAuth } from '@clerk/clerk-expo';
import { PusherEvent, PusherChannel } from '@pusher/pusher-websocket-react-native';

import { PusherContext } from '@barz/mobile/src/pusher';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import TextField from '@barz/mobile/src/ui/TextField';
import { EnvironmentContext } from '@barz/mobile/src/environment-data';
import {
  BarzAPI,
  Battle,
  BattleParticipant,
  BattleRecording,
  BattleComment,
  User,
} from '@barz/mobile/src/lib/api';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import formatDurationAsString from '@barz/mobile/src/lib/format-duration-as-string';
import { BattleStateMachineTypestate } from '@barz/mobile/src/lib/state-machine';
import Button from '@barz/mobile/src/ui/Button';
import ListItem from '@barz/mobile/src/ui/ListItem';
import ListItemContainer from '@barz/mobile/src/ui/ListItemContainer';
import BarsStackIcon from '@barz/mobile/src/components/BarsStackIcon';
import AvatarImage from '@barz/mobile/src/components/AvatarImage';
import PressableChangesOpacity from '@barz/mobile/src/components/PressableChangesOpacity';
import {
  MicrophoneFilled as IconMicrophoneFilled,
  Crown as IconCrown,
  ChevronLeft as IconChevronLeft,
  ChevronDown as IconChevronDown,
  ChevronUp as IconChevronUp,
  Fire as IconFire,
  FireFilled as IconFireFilled,
  Chat as IconChat,
  Menu as IconMenu,
  Download as IconDownload,
  Share as IconShare,
  Lock as IconLock,
} from '@barz/mobile/src/ui/icons';
import { UserDataContext } from '@barz/mobile/src/user-data';
import { InfiniteScrollListState } from '@barz/mobile/src/lib/infinite-scroll-list';

const PROGRESS_BAR_HEIGHT_PX = 4;
const PROGRESS_BAR_FOCUSED_PHASE_HEIGHT_PX = 16;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  videoList: {},
  videoContainer: {
    position: 'relative',
    height: '50%',
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `rgba(0, 0, 0, 0.25)`,

    padding: 8,

    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  videoUserName: {
    fontFamily: 'menlo',
    fontSize: 16,
    color: 'white',
  },

  videoViewportContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,

    width: '100%',
    height: '100%',
    flexShrink: 1,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoViewportContainerText: {
    color: 'white',
  },
  videoProgressBar: {
    flexDirection: 'row',
    height: PROGRESS_BAR_HEIGHT_PX,
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  videoProgressBarSpacer: {
    height: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  videoProgressBarSegment: {
    height: '100%',
    backgroundColor: alpha(Color.White, 0.2),
    flexGrow: 0,
    flexShrink: 0,
  },
  videoProgressBarSegmentSeeking: {
    height: PROGRESS_BAR_FOCUSED_PHASE_HEIGHT_PX,
    marginTop: PROGRESS_BAR_HEIGHT_PX - PROGRESS_BAR_FOCUSED_PHASE_HEIGHT_PX,
  },
  videoProgressBarSegmentInner: {
    height: '100%',
    width: '100%',
    backgroundColor: Color.Brand.Yellow,
  },
  videoProgressBarSegmentInnerSeeking: {},

  commentsButtonContainer: {
    zIndex: 9999,

    gap: 2,
    alignItems: 'center',
  },

  moreButtonContainer: {
    zIndex: 9999,
    gap: 2,
    alignItems: 'center',
  },

  buttonShadow1: {
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1,
    shadowColor: Color.Black,
    shadowOpacity: 0.25,
  },

  buttonShadow2: {
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowRadius: 2,
    shadowColor: Color.Black,
    shadowOpacity: 0.25,
  },

  textShadow1: {
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1,
    shadowColor: Color.Black,
    shadowOpacity: 0.5,
  },

  textShadow2: {
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowRadius: 2,
    shadowColor: Color.Black,
    shadowOpacity: 0.25,
  },

  backButton: {
    position: 'absolute',
    // NOTE: on android, move the back button downwards so it doesn't intersect with the status bar
    top: Platform.select({ android: 48, ios: 16 }),
    left: 16,
    zIndex: 9999,

    width: 36,
    height: 36,
    borderRadius: 24,
    backgroundColor: alpha(Color.Black, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoCommentPressableWrapper: {
    flexGrow: 1,
    flexShrink: 1,
  },

  videoParticipantHeader: {
    flexDirection: 'column',
    gap: 4,
    marginTop: 16,
    marginRight: 16,
    alignItems: 'flex-end',
  },
  videoParticipantHeaderName: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    height: 22,
    display: 'flex',
  },
  videoParticipantHeaderNameActive: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    height: 22,
    paddingLeft: 4,
    paddingRight: 4,
    backgroundColor: Color.Yellow.Dark10,
  },
  videoParticipantHeaderNamePressed: {
    opacity: 0.7,
  },
  videoParticipantHeaderNameText: {
    ...Typography.Body2Bold,
    color: Color.White,
  },
  videoParticipantHeaderNameTextActive: {
    ...Typography.Body2Bold,
    color: Color.Black,
  },
  videoParticipantHeaderRowTwo: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    height: 22,
  },
  videoParticipantHeaderActive: {
    height: 24,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Color.Red.Dark10,
  },
  videoParticipantHeaderScore: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 4,
    gap: 4,
    backgroundColor: Color.Gray.Dark1,
    height: 22,
  },
  videoParticipantHeaderScoreText: {
    ...Typography.Body2,
    color: Color.White,
  },

  videoVoteButtonWrapper: {
    position: 'relative',
    flexDirection: 'column-reverse',
    alignItems: 'center',
    gap: 8,
  },
  videoVoteButtonNumber: {
    borderRadius: 16,
    width: 32,
    height: 32,
    backgroundColor: Color.Brand.Yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoVoteButtonNumberText: {
    ...Typography.Body2Bold,
    color: Color.Black,
  },
  videoVotingEndedWrapper: {
    position: 'relative',
    marginBottom: 4,
    height: 24,
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 12,
    backgroundColor: Color.Red.Dark11,
  },
  videoVoteButtonPressTarget: {
    height: 42,
    borderRadius: 21,
    backgroundColor: alpha(Color.Black, 0.4),
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 16,
  },
  videoVoteButtonPressTargetPressed: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Color.Brand.Yellow,
  },
  videoVoteButtonPressTargetDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  videoVoteButtonPressTargetText: {
    ...Typography.Body2Bold,
    color: Color.White,
  },

  videoFeedSwitcherContainer: {
    position: 'absolute',
    // NOTE: on android, move the video trending/following control downwards so it doesn't
    // intersect with the status bar
    top: Platform.select({ android: 48, ios: 16 }),
    left: 16,
    zIndex: 9999,
  },

  videoFeedSwitcherContainerToggled: {
    display: 'flex',
    position: 'absolute',
    flexDirection: 'column',
    width: '100%',
    gap: 8,
    paddingTop: Platform.select({ ios: 16, android: 48 }),
    paddingBottom: 8,
    backgroundColor: Color.Gray.Dark1,
    zIndex: 10002,
  },

  trendingFollowingButtonRow: {
    display: 'flex',
    flexDirection: 'row',
    paddingLeft: 16,
  },

  listGroup: {
    display: 'flex',
    flexDirection: 'column',
  },

  videoFeedSwitcherBackground: {
    width: '100%',
    height: '100%',
    zIndex: 10001,
    backgroundColor: Color.Black,
    opacity: 0.5,
    position: 'absolute',
  },

  videoVoteCountdownContainer: {
    position: 'absolute',
    bottom: 44,
    right: 16,
    alignItems: 'flex-end',
    gap: 2,
    zIndex: 9999,
  },
  videoVoteCountdownContainerLabel: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  videoVoteCountdownAgoWrapper: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  videoVoteCountdownContainerValue: {
    height: 24,
    borderRadius: 12,
    paddingLeft: 6,
    paddingRight: 6,
    backgroundColor: alpha(Color.Black, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoCommentBottomSheetHeader: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
  },
  videoCommentBottomSheetEmptyStateWrapper: {
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  videoCommentWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  videoCommentInner: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
  },
  videoCommentHeader: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'baseline',
  },
  videoCommentVoteWrapper: {
    width: 24,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCommentVoteWrapperPressed: {
    opacity: 0.75,
  },
  videoCommentBottomSheetFooter: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 56,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Color.Gray.Dark1,
    paddingBottom: 16,
    paddingTop: 16,
    paddingHorizontal: 16,

    // FIXME: this is required for android to get this view to show up properly above the keyboard
    // - NOT double-offset upwards, and NOT underneath the keyboard
    ...(Platform.OS === 'android'
      ? {
          position: 'absolute',
          bottom: 0,
        }
      : {}),
  },

  videoPrivateLabelContainer: {
    position: 'absolute',
    bottom: 48,
    right: 24,
    zIndex: 9999,

    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
    backgroundColor: alpha(Color.Black, 0.4),
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 10,
  },
});

export const VideoCommentsButton: React.FunctionComponent<{
  battleCommentTotal: BattleRecording['battleCommentTotal'];
  testID?: string;
  onPress: () => void;
}> = ({ battleCommentTotal, testID, onPress }) => {
  return (
    <PressableChangesOpacity
      onPress={onPress}
      testID={testID}
      style={[styles.commentsButtonContainer]}
    >
      <View style={[styles.buttonShadow1]}>
        <View style={[styles.buttonShadow2]}>
          <IconChat size={32} color={Color.White} />
        </View>
      </View>
      <View style={[styles.textShadow1]}>
        <View style={[styles.textShadow2]}>
          <Text
            style={{
              ...Typography.Body2SemiBold,
              color: Color.White,
            }}
          >
            {battleCommentTotal}
          </Text>
        </View>
      </View>
    </PressableChangesOpacity>
  );
};

export const VideoMoreButton: React.FunctionComponent<{
  onPress: () => void;
}> = ({ onPress }) => {
  return (
    <PressableChangesOpacity
      onPress={onPress}
      style={[styles.moreButtonContainer, styles.buttonShadow1, styles.buttonShadow2]}
    >
      <IconMenu size={32} color={Color.White} />
    </PressableChangesOpacity>
  );
};

export const VideoBackButton: React.FunctionComponent<{
  onPress: () => void;
}> = ({ onPress }) => {
  return (
    <PressableChangesOpacity style={styles.backButton} onPress={onPress}>
      <IconChevronLeft color={Color.White} />
    </PressableChangesOpacity>
  );
};

export const VideoFeedSwitcherControl: React.FunctionComponent<{
  feed: 'FOLLOWING' | 'TRENDING';
  disabled: boolean;
  testID?: string;
  onChangeFeed: (newFeed: 'FOLLOWING' | 'TRENDING') => void;
}> = ({ feed, disabled, testID, onChangeFeed }) => {
  // internal state to track if the feed switcher button is toggled (rendering the list of options)
  // or not
  const [isButtonToggled, setIsButtonToggled] = useState(false);

  const handleButtonToggle = () => {
    setIsButtonToggled(!isButtonToggled);
  };

  /*to make sure the feed switcher is not toggled when you
  load the page */
  useEffect(() => {
    setIsButtonToggled(false);
  }, []);

  return !isButtonToggled ? (
    <View style={styles.videoFeedSwitcherContainer}>
      <Button
        size={36}
        type="blurred"
        trailing={<IconChevronDown color={Color.White} />}
        disabled={disabled}
        testID={feed === 'FOLLOWING' ? `${testID}-following-active` : `${testID}-trending-active`}
        // onPress={() => onChangeFeed(feed === 'FOLLOWING' ? 'TRENDING' : 'FOLLOWING')}
        onPress={handleButtonToggle}
      >
        {feed === 'FOLLOWING' ? 'Following' : 'Trending'}
      </Button>
    </View>
  ) : (
    <>
      <View style={styles.videoFeedSwitcherContainerToggled}>
        <View style={styles.trendingFollowingButtonRow}>
          <Button
            size={36}
            type="secondary"
            trailing={<IconChevronUp color={Color.White} />}
            disabled={disabled}
            testID={
              feed === 'FOLLOWING' ? `${testID}-following-active` : `${testID}-trending-active`
            }
            onPress={handleButtonToggle}
          >
            {feed === 'FOLLOWING' ? 'Following' : 'Trending'}
          </Button>
        </View>
        <ListItemContainer>
          <ListItem
            onPress={() => {
              onChangeFeed('TRENDING');
              handleButtonToggle();
            }}
            testID={`${testID}-trending-button`}
          >
            Trending
          </ListItem>
          <ListItem
            onPress={() => {
              onChangeFeed('FOLLOWING');
              handleButtonToggle();
            }}
            testID={`${testID}-following-button`}
          >
            Following
          </ListItem>
        </ListItemContainer>
      </View>
      {/* This is a gray background that overlays the video */}
      <View style={styles.videoFeedSwitcherBackground} />
    </>
  );
};

export const VideoVoteCountdown: React.FunctionComponent<{
  votingEndsAt: string | null;
  children?: (isVotingComplete: boolean) => React.ReactNode;
}> = ({ votingEndsAt, children }) => {
  const parsedVotingEndsAt = useMemo(
    () => (votingEndsAt ? new Date(votingEndsAt) : null),
    [votingEndsAt],
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
    <Fragment>
      <View style={styles.videoVoteCountdownContainer}>
        <View style={styles.videoVoteCountdownContainerLabel}>
          <BarsStackIcon size={16} />
          <Text style={{ ...Typography.Body2, color: Color.White }}>
            {
              {
                ONGOING: 'Voting ends in',
                COMPLETED: 'Voting ended',
                UNKNOWN: 'Voting open',
              }[countdownStatus]
            }
          </Text>
        </View>
        {countdownFormatted.length > 0 ? (
          <View style={styles.videoVoteCountdownAgoWrapper}>
            {countdownStatus === 'COMPLETED' ? (
              <>
                <View>
                  <Text style={{ ...Typography.Body2Bold, color: Color.White }}>
                    {countdownFormatted}
                  </Text>
                </View>
                <Text style={{ ...Typography.Body2, color: Color.White }}>ago</Text>
              </>
            ) : null}
            {countdownStatus === 'ONGOING' ? (
              <View style={styles.videoVoteCountdownContainerValue}>
                <Text style={{ ...Typography.Body2Bold, color: Color.White }}>
                  {countdownFormatted}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {children ? children(countdownStatus === 'COMPLETED') : null}
    </Fragment>
  );
};

export const VideoPrivateIndicator: React.FunctionComponent = () => (
  <View style={styles.videoPrivateLabelContainer}>
    <IconLock size={16} color={Color.White} />
    <Text style={{ ...Typography.Body3SemiBold, color: Color.White }}>Private</Text>
  </View>
);

const VIDEO_VOTE_BUTTON_DEBOUNCE_THRESHOLD_MILLISECONDS = 1500;
export const VideoVoteButton: React.FunctionComponent<{
  participant: Pick<BattleRecording['participants'][0], 'id' | 'user' | 'computedTotalVoteAmount'>;
  inFlightCastedVoteAmounts: Array<number>;
  testID?: string;
  maxVotes?: number;
  disabled?: boolean;
  onCastVote: (
    participantId: BattleParticipant['id'],
    amount: number,
    startedCastingAt: Date,
    endedCastingAt: Date,
  ) => void;
}> = ({
  participant,
  inFlightCastedVoteAmounts,
  testID,
  maxVotes,
  disabled = false,
  onCastVote,
}) => {
  const [pressed, setPressed] = useState(false);

  // NOTE: store `onCastVote` into a ref so that `debouncedOnCastVote` can call the latest
  // `onCastVote` without having to depend on `onCastVote` - if there was a dependency, then the
  // debounce logic would get reset quite often since `onCastVote` changes reference quite often
  // (because it depends on the current video playback position)
  const onCastVoteRef = useRef<typeof onCastVote | null>(null);
  useEffect(() => {
    onCastVoteRef.current = onCastVote;
  }, [onCastVote]);

  const [counter, setCounter] = useState(0);

  const [votingEndedVisible, setVotingEndedVisible] = useState(false);
  const [votingEndedOpacity, setVotingEndedOpacity] = useState(0);

  // NOTE: for a similar reason as `onCastVote`, store a copy of `counter` in a ref so
  // `debouncedOnCastVote` doesn't have to depend on `counter` since it changes often
  const counterRef = useRef(0);
  useEffect(() => {
    counterRef.current = counter;
  }, [counter]);

  const startCastTimestampRef = useRef<Date | null>(null);

  const debouncedOnCastVote = useMemo(() => {
    return debounce(() => {
      if (!onCastVoteRef.current) {
        return;
      }
      if (!startCastTimestampRef.current) {
        return;
      }
      const now = new Date();
      onCastVoteRef.current(participant.id, counterRef.current, startCastTimestampRef.current, now);
      setCounter(0);
      startCastTimestampRef.current = null;
    }, VIDEO_VOTE_BUTTON_DEBOUNCE_THRESHOLD_MILLISECONDS);
  }, [participant.id, setCounter]);

  const totalVoteOptimisticAmount = inFlightCastedVoteAmounts.reduce((acc, v) => acc + v, 0);
  const totalVoteAmount = participant.computedTotalVoteAmount + totalVoteOptimisticAmount + counter;

  const handleVotingEndedPress = () => {
    setVotingEndedVisible(true);
    setVotingEndedOpacity(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      setVotingEndedVisible(false);
      setVotingEndedOpacity(0);
    }, 2000);
  };

  return (
    <View style={styles.videoVoteButtonWrapper} pointerEvents="auto">
      <Pressable
        style={[
          styles.videoVoteButtonPressTarget,
          (pressed || counter > 0) && !disabled ? styles.videoVoteButtonPressTargetPressed : null,
          disabled ? styles.videoVoteButtonPressTargetDisabled : null,
        ]}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        onPress={() => {
          if (disabled) {
            handleVotingEndedPress();
          } else {
            if (counter === 0) {
              startCastTimestampRef.current = new Date();
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            setCounter((n) => {
              if (typeof maxVotes === 'undefined') {
                return n + 1;
              } else if (n < maxVotes) {
                return n + 1;
              } else {
                return n;
              }
            });
            debouncedOnCastVote();
          }
        }}
      >
        <View style={disabled ? { opacity: 0.6 } : null}>
          <BarsStackIcon />
        </View>
        <Text style={styles.videoVoteButtonPressTargetText}>{`${totalVoteAmount}`}</Text>
      </Pressable>

      {counter > 0 ? (
        <View style={styles.videoVoteButtonNumber}>
          <Text style={styles.videoVoteButtonNumberText}>{`+${counter}`}</Text>
        </View>
      ) : null}

      {votingEndedVisible ? (
        <View style={styles.videoVotingEndedWrapper}>
          <Text style={{ ...Typography.Body2SemiBold, color: Color.Black }}>Voting Ended</Text>
        </View>
      ) : null}
    </View>
  );
};

type VideoPlaybackSeekBarProps = {
  width: number;
  gutterSpacing?: number;
  battleRecording: BattleRecording;
  battleToCurrentPlaybackTimeMillisecondsRef: React.MutableRefObject<Map<Battle['id'], number>>;
  seekEnabled: boolean;
  onSeekStart: () => void;
  onSeekComplete: () => void;
  onChangeSeek: (seekPositionInMilliseconds: number) => void;
  onBattleHasReachedLastVisiblePhase: () => void;
};

export const VideoPlaybackSeekBar: React.FunctionComponent<VideoPlaybackSeekBarProps> = ({
  width,
  gutterSpacing = 0,
  battleRecording,
  battleToCurrentPlaybackTimeMillisecondsRef,
  seekEnabled,
  onSeekStart,
  onSeekComplete,
  onChangeSeek,
  onBattleHasReachedLastVisiblePhase,
}) => {
  // On an interval, get the current playback offset out of the ref written to by the video player
  // and rerender the component to show the playback offset
  const [currentPlaybackTimeMilliseconds, setCurrentPlaybackTimeMilliseconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const offsetInSeconds = battleToCurrentPlaybackTimeMillisecondsRef.current.get(
        battleRecording.battleId,
      );
      setCurrentPlaybackTimeMilliseconds(offsetInSeconds || 0);
    }, 250);

    return () => clearInterval(id);
  }, [battleRecording.battleId]);

  const widthWithoutGutter = width - gutterSpacing - gutterSpacing;

  // The initial x position in pixels from the left of the screen of the touch to start seeking the video
  const [initialSeekTouchXPixels, setInitialSeekTouchXPixels] = useState<number | null>(null);

  // The position of the video playback in PIXELS from the left of the screen when seeking begins
  const [initialSeekPositionPixels, setInitialSeekPositionPixels] = useState<number | null>(null);

  // The position of the video playback in PIXELS from the left of the screen after the the finger
  // moved last
  const [currentSeekPositionPixels, setCurrentSeekPositionPixels] = useState<number | null>(null);

  // The position of the video playback in MILLISECONDS from the left of the screen after the the
  // finger moved last
  const [currentSeekPositionMilliseconds, setCurrentSeekPositionMilliseconds] = useState<
    number | null
  >(null);

  // If the user is currently seeking, then use the current seek position. If they are not seeking,
  // then use the playback position.
  const seekHeadPositionMilliseconds =
    currentSeekPositionMilliseconds !== null
      ? currentSeekPositionMilliseconds
      : currentPlaybackTimeMilliseconds;

  const maxMediaOffsetMilliseconds = Math.max(
    ...battleRecording.participants.map((p) => p.mediaOffsetMilliseconds),
  );

  const [battlePhases, totalBattleTimeInMilliseconds] = useMemo(() => {
    let totalBattleTimeSoFarInMilliseconds = 0;

    const battlePhases = battleRecording.phases.map((phase) => {
      let lengthInMilliseconds =
        new Date(phase.endsAt).getTime() - new Date(phase.startsAt).getTime();
      if (
        phase.startsAtVideoStreamOffsetMilliseconds !== null &&
        phase.endsAtVideoStreamOffsetMilliseconds !== null
      ) {
        lengthInMilliseconds =
          phase.endsAtVideoStreamOffsetMilliseconds - phase.startsAtVideoStreamOffsetMilliseconds;
      }
      switch (phase.state) {
        case 'CREATED':
        case 'COIN_TOSS':
        case 'TRANSITION_TO_SUMMARY':
        case 'COMPLETE': {
          // These states are not rendered - they have zero width.
          lengthInMilliseconds = 0;
        }
      }

      const currentPositionMilliseconds =
        seekHeadPositionMilliseconds - totalBattleTimeSoFarInMilliseconds;
      const percentageComplete = Math.min(
        Math.max((currentPositionMilliseconds / lengthInMilliseconds) * 100, 0),
        100,
      );

      const returnValue = {
        key: phase.startsAt,
        lengthInMilliseconds,
        percentageComplete,
        millisecondsOffset: totalBattleTimeSoFarInMilliseconds,
        state: phase.state as BattleStateMachineTypestate['value'],
      };

      totalBattleTimeSoFarInMilliseconds += lengthInMilliseconds;
      return returnValue;
    });

    return [battlePhases, totalBattleTimeSoFarInMilliseconds];
  }, [battleRecording, maxMediaOffsetMilliseconds, seekHeadPositionMilliseconds]);
  // console.log('PHASE', battlePhases);

  const pixelsPerMillisecond = useMemo(() => {
    if (totalBattleTimeInMilliseconds === 0) {
      return 0;
    }

    let lengthOfAllPhasesInMilliseconds = 0;
    for (const phase of battlePhases) {
      switch (phase.state) {
        case 'CREATED':
        case 'COIN_TOSS':
        case 'TRANSITION_TO_SUMMARY':
        case 'COMPLETE': {
          // These states are not rendered - they have zero width.
          continue;
        }
        default: {
          lengthOfAllPhasesInMilliseconds += phase.lengthInMilliseconds;
        }
      }
    }

    return widthWithoutGutter / lengthOfAllPhasesInMilliseconds;
  }, [battlePhases, totalBattleTimeInMilliseconds, widthWithoutGutter]);

  const convertFromPixelsToMillisecondsOffset = useCallback(
    (xPixelPosition: number, elementWidthInPixels: number) => {
      if (xPixelPosition < 0) {
        return 0;
      }
      if (xPixelPosition > elementWidthInPixels) {
        return totalBattleTimeInMilliseconds;
      }

      let workingOffsetInPixels = 0;
      let workingOffsetInMilliseconds = 0;

      for (const phase of battlePhases) {
        const lengthOfPhaseInPixels = phase.lengthInMilliseconds * pixelsPerMillisecond;

        switch (phase.state) {
          case 'CREATED':
          case 'COIN_TOSS':
          case 'TRANSITION_TO_SUMMARY':
          case 'COMPLETE': {
            // These states are not rendered - they have zero width.
            // So ONLY increment the milliseconds offset, the pixel offset is uneffected
            workingOffsetInMilliseconds += phase.lengthInMilliseconds;
            continue;
          }

          case 'WARM_UP':
          case 'BATTLE':
          default: {
            if (
              workingOffsetInPixels < xPixelPosition &&
              xPixelPosition < workingOffsetInPixels + lengthOfPhaseInPixels
            ) {
              // If the user tapped within the range of pixels represented by the battle phase, then
              // figure out preportioally where in that phase the pixel position is.
              const percentageThroughPhase =
                (xPixelPosition - workingOffsetInPixels) / lengthOfPhaseInPixels;
              const result =
                workingOffsetInMilliseconds + percentageThroughPhase * phase.lengthInMilliseconds;
              return result;
            } else {
              // The user didn't tap in this phase - try the next one
              workingOffsetInMilliseconds += phase.lengthInMilliseconds;
              workingOffsetInPixels += lengthOfPhaseInPixels;
              continue;
            }
          }
        }
      }

      return workingOffsetInMilliseconds - maxMediaOffsetMilliseconds;
    },
    [battlePhases, pixelsPerMillisecond, totalBattleTimeInMilliseconds, maxMediaOffsetMilliseconds],
  );

  const convertFromMillisecondsOffsetToPixels = useCallback(
    (millisecondsOffset: number, elementWidthInPixels: number) => {
      const adjustedMillisecondsOffset = millisecondsOffset + maxMediaOffsetMilliseconds;

      if (adjustedMillisecondsOffset < 0) {
        return 0;
      }
      if (adjustedMillisecondsOffset > totalBattleTimeInMilliseconds) {
        return elementWidthInPixels;
      }

      let workingOffsetInPixels = 0;
      let workingOffsetInMilliseconds = 0;

      for (const phase of battlePhases) {
        const lengthOfPhaseInPixels = phase.lengthInMilliseconds * pixelsPerMillisecond;

        switch (phase.state) {
          case 'CREATED':
          case 'COIN_TOSS':
          case 'TRANSITION_TO_SUMMARY':
          case 'COMPLETE': {
            // These states are not rendered - they have zero width.
            // So ONLY increment the milliseconds offset, the pixel offset is uneffected
            workingOffsetInMilliseconds += phase.lengthInMilliseconds;
            continue;
          }

          default: {
            if (
              workingOffsetInMilliseconds < adjustedMillisecondsOffset &&
              adjustedMillisecondsOffset < workingOffsetInMilliseconds + phase.lengthInMilliseconds
            ) {
              // If the user tapped within the range of pixels represented by the battle phase, then
              // figure out preportioally where in that phase the pixel position is.
              const percentageThroughPhase =
                (adjustedMillisecondsOffset - workingOffsetInMilliseconds) /
                phase.lengthInMilliseconds;
              const result = workingOffsetInPixels + percentageThroughPhase * lengthOfPhaseInPixels;
              return result;
            } else {
              // The user didn't tap in this phase - try the next one
              workingOffsetInMilliseconds += phase.lengthInMilliseconds;
              workingOffsetInPixels += lengthOfPhaseInPixels;
              continue;
            }
          }
        }
      }

      return workingOffsetInPixels;
    },
    [battlePhases, pixelsPerMillisecond, totalBattleTimeInMilliseconds, maxMediaOffsetMilliseconds],
  );

  const debouncedOnChangeSeek = useMemo(() => {
    return debounce(onChangeSeek, 250);
  }, [onChangeSeek]);

  useEffect(() => {
    const lastVisibleBattlePhase = battlePhases
      .slice()
      .reverse()
      .find((phase) => {
        switch (phase.state) {
          case 'WARM_UP':
          case 'BATTLE':
            return true;
          default:
            return false;
        }
      });

    if (!lastVisibleBattlePhase) {
      return;
    }

    if (lastVisibleBattlePhase.percentageComplete === 100) {
      onBattleHasReachedLastVisiblePhase();
    }
  }, [battlePhases, onBattleHasReachedLastVisiblePhase]);

  return (
    <View
      style={[styles.videoProgressBar, { left: gutterSpacing, right: gutterSpacing }]}
      hitSlop={{ top: 48, bottom: 16, left: 0, right: 0 }}
      onStartShouldSetResponder={() => seekEnabled}
      onResponderGrant={(evt) => {
        onSeekStart();

        setInitialSeekTouchXPixels(evt.nativeEvent.pageX);
        setInitialSeekPositionPixels(
          convertFromMillisecondsOffsetToPixels(
            currentPlaybackTimeMilliseconds,
            widthWithoutGutter,
          ),
        );
      }}
      onResponderMove={(evt) => {
        if (initialSeekPositionPixels === null) {
          return;
        }
        if (initialSeekTouchXPixels === null) {
          return;
        }
        const offsetInPixels = evt.nativeEvent.pageX - initialSeekTouchXPixels;
        const positionXPixels = initialSeekTouchXPixels + offsetInPixels;
        setCurrentSeekPositionPixels(positionXPixels);

        const positionXMilliseconds = convertFromPixelsToMillisecondsOffset(
          positionXPixels,
          widthWithoutGutter,
        );
        setCurrentSeekPositionMilliseconds(positionXMilliseconds);

        debouncedOnChangeSeek(positionXMilliseconds);
      }}
      onResponderRelease={() => {
        if (currentSeekPositionMilliseconds !== null) {
          onChangeSeek(currentSeekPositionMilliseconds);
        }
        onSeekComplete();
        setInitialSeekPositionPixels(null);
        setCurrentSeekPositionPixels(null);
        setCurrentSeekPositionMilliseconds(null);
      }}
    >
      {battlePhases.map((phase) => {
        const lengthOfPhaseInPixels = phase.lengthInMilliseconds * pixelsPerMillisecond;

        switch (phase.state) {
          case 'WARM_UP':
          case 'BATTLE':
            // These are main battle states, that get a filled bar section
            const isSeekingWithinPhase =
              currentSeekPositionMilliseconds !== null
                ? phase.millisecondsOffset < currentSeekPositionMilliseconds &&
                  currentSeekPositionMilliseconds <
                    phase.millisecondsOffset + phase.lengthInMilliseconds
                : false;
            return (
              <View
                key={phase.key}
                style={[
                  styles.videoProgressBarSegment,
                  { width: lengthOfPhaseInPixels - 2, marginRight: 2 },
                  isSeekingWithinPhase ? styles.videoProgressBarSegmentSeeking : {},
                ]}
              >
                <View
                  style={[
                    styles.videoProgressBarSegmentInner,
                    { width: `${phase.percentageComplete}%` },
                    isSeekingWithinPhase ? styles.videoProgressBarSegmentInnerSeeking : {},
                  ]}
                />
              </View>
            );

          case 'CREATED':
          case 'COIN_TOSS':
          case 'TRANSITION_TO_SUMMARY':
          case 'COMPLETE':
            // These states are not rendered - they have zero width.
            return null;

          case 'TRANSITION_TO_NEXT_BATTLER':
          case 'TRANSITION_TO_NEXT_ROUND':
          case 'TRANSITION_TO_SUMMARY':
          default:
            // All other states should be rendered as a slight gap in the playback bar
            //
            // NOTE: For any unknown states, this also applies. This should
            // probably not ever show up in regular operation, but this case will be hit when
            // an OLD instance of the app is viewing a battle generated by a potentially newer
            // state machine / instance of the app with events that are not known.
            return (
              <View
                key={phase.key}
                style={[styles.videoProgressBarSpacer, { width: lengthOfPhaseInPixels }]}
              />
            );
        }
      })}

      {currentSeekPositionPixels !== null ? (
        <View
          style={{
            position: 'absolute',
            top: PROGRESS_BAR_HEIGHT_PX - PROGRESS_BAR_FOCUSED_PHASE_HEIGHT_PX,
            left: currentSeekPositionPixels,
            right: 0,
            bottom: 0,
            backgroundColor: Color.Brand.Red,
            width: 2,
            height: PROGRESS_BAR_FOCUSED_PHASE_HEIGHT_PX,
          }}
        />
      ) : null}
    </View>
  );
};

type VideoParticipantHeaderProps = {
  participant: Pick<BattleParticipant, 'id' | 'user'>;
  testID?: string;
  active: boolean;
  onPress: () => void;
};

export const VideoParticipantHeader: React.FunctionComponent<VideoParticipantHeaderProps> = ({
  participant,
  testID,
  active,
  onPress,
}) => {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={styles.videoParticipantHeader} testID={testID}>
      <Pressable
        style={[
          active ? styles.videoParticipantHeaderNameActive : styles.videoParticipantHeaderName,
          pressed ? styles.videoParticipantHeaderNamePressed : null,
        ]}
        onPress={onPress}
        testID={testID ? `${testID}-name` : undefined}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <Text
          style={
            active
              ? styles.videoParticipantHeaderNameTextActive
              : styles.videoParticipantHeaderNameText
          }
        >
          {participant.user.name}
        </Text>
        {active ? <IconMicrophoneFilled size={16} color={Color.Black} /> : null}
      </Pressable>
      <View style={styles.videoParticipantHeaderRowTwo}>
        <View style={styles.videoParticipantHeaderScore}>
          <IconCrown size={16} color={Color.White} />
          <Text style={styles.videoParticipantHeaderScoreText} testID={`${testID}-score`}>
            {`${participant.user.computedScore}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const VideoComment: React.FunctionComponent<{
  user: User;
  commentedAtString: string;
  text: string;
  voteCount: number;
  isVotedByActiveUser: boolean;
  isVotingInProgress: boolean;
  isDeletingInProgress: boolean;
  testID?: string;
  onVotePress: () => void;
  onUserAvatarPress: () => void;
  onDeleteComment: () => void;
}> = memo(
  ({
    user,
    commentedAtString,
    text,
    voteCount,
    isVotedByActiveUser,
    isVotingInProgress,
    isDeletingInProgress,
    testID = '',
    onVotePress,
    onUserAvatarPress,
    onDeleteComment,
  }) => {
    const [userMe] = useContext(UserDataContext);

    const [timeSinceCommentCreated, setTimeSinceCommentCreated] = useState('');
    const [votePressed, setVotePressed] = useState(false);
    const [videoCommentWrapperPressed, setVideoCommentWrapperPressed] = useState(false);

    const commentedAt = useMemo(() => new Date(commentedAtString), [commentedAtString]);

    const { showActionSheetWithOptions } = useActionSheet();

    const commentCreatedByUserMe = userMe.status === 'COMPLETE' && userMe.data.id === user.id;

    // Only allow the long press menu to show if the comment was created by the logged in user
    const showActionSheet = commentCreatedByUserMe;

    // Every second, update the time since the comment has been posted
    useEffect(() => {
      const run = () => {
        const now = new Date();

        const duration = intervalToDuration({
          start: now,
          end: commentedAt,
        });

        setTimeSinceCommentCreated(formatDurationAsString(duration));
      };

      run();
      const id = setInterval(run, 1000);
      return () => {
        clearInterval(id);
      };
    }, [commentedAt]);

    return (
      <Pressable
        style={[
          styles.videoCommentWrapper,
          videoCommentWrapperPressed ? { opacity: 0.75 } : null,
          isDeletingInProgress ? { opacity: 0.25 } : null,
        ]}
        disabled={isDeletingInProgress}
        onPressIn={() => {
          if (showActionSheet) {
            setVideoCommentWrapperPressed(true);
          }
        }}
        onPressOut={() => {
          if (showActionSheet) {
            setVideoCommentWrapperPressed(false);
          }
        }}
        onLongPress={() => {
          if (!showActionSheet) {
            return;
          }

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

          showActionSheetWithOptions(
            {
              options: ['Delete Comment', 'Cancel'],
              cancelButtonIndex: 1,
              destructiveButtonIndex: 0,
            },
            (selectedIndex) => {
              switch (selectedIndex) {
                case 0: {
                  onDeleteComment();
                  break;
                }
                default:
                  break;
              }
            },
          );
        }}
        testID={`${testID}-wrapper`}
      >
        <AvatarImage
          profileImageUrl={user.profileImageUrl}
          onPress={onUserAvatarPress}
          testID={`${testID}-avatar-image`}
        />
        <View style={styles.videoCommentInner}>
          <View style={styles.videoCommentHeader}>
            <PressableChangesOpacity onPress={onUserAvatarPress}>
              <Text style={{ ...Typography.Body1SemiBold, color: Color.White }}>{user.name}</Text>
            </PressableChangesOpacity>
            <Text style={{ ...Typography.Body2, color: Color.Gray.Dark11 }}>
              {timeSinceCommentCreated}
            </Text>
          </View>
          <Text style={{ ...Typography.Body1, color: Color.White }}>{text}</Text>
        </View>
        <Pressable
          style={[
            styles.videoCommentVoteWrapper,
            votePressed ? styles.videoCommentVoteWrapperPressed : null,
          ]}
          onPressIn={() => setVotePressed(true)}
          onPressOut={() => setVotePressed(false)}
          onPress={onVotePress}
          disabled={isVotingInProgress}
          // Give the vote button a bigger touch target to it is easier to press
          hitSlop={{ top: 0, bottom: 0, left: 32, right: 32 }}
          testID={isVotedByActiveUser ? `${testID}-unvote-button` : `${testID}-vote-button`}
        >
          <IconFire
            size={20}
            color={
              !isVotingInProgress
                ? isVotedByActiveUser
                  ? Color.Yellow.Dark10
                  : Color.White
                : Color.Gray.Dark8
            }
          />
          <Text
            style={{
              ...Typography.Label2,
              color: isVotingInProgress ? Color.Gray.Dark8 : Color.White,
            }}
          >
            {voteCount}
          </Text>
        </Pressable>
      </Pressable>
    );
  },
);

const VIDEO_COMMENT_BOTTOM_SHEET_COMMENTS_FROM_BOTTOM_TO_FETCH_NEXT_PAGE = 10;
export const VideoCommentBottomSheet: React.FunctionComponent<{
  battleId: Battle['id'];
  battleToCurrentPlaybackTimeMillisecondsRef: React.MutableRefObject<Map<Battle['id'], number>>;
  open: boolean;
  testID?: string;
  onClose: () => void;
  onVisitUserProfile: (userId: User['id']) => void;
  onChangeCommentTotal?: (newCommentTotal: BattleRecording['battleCommentTotal']) => void;
}> = ({
  battleId,
  battleToCurrentPlaybackTimeMillisecondsRef,
  open,
  testID = '',
  onClose,
  onVisitUserProfile,
  onChangeCommentTotal,
}) => {
  const [userMe] = useContext(UserDataContext);
  if (userMe.status !== 'COMPLETE') {
    throw new Error(
      'VideoCommentBottomSheet is being rendered while userMe.status is not COMPLETE, this is not allowed',
    );
  }

  const commentsBottomSheetRef = useRef<BottomSheet | null>(null);

  // This controls the points at which the bottom sheet "sticks" open
  const snapPoints = useMemo(() => ['70%', '100%'], []);

  const onHandleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const { getToken } = useAuth();

  const [comments, setComments] = useState<
    InfiniteScrollListState<BattleComment & { isVotingInProgress: boolean }>
  >({ status: 'IDLE' });

  const onFetchInitialPageOfComments = useCallback(
    (hasEffectUnmounted: () => boolean = () => false) => {
      if (userMe.status !== 'COMPLETE') {
        return;
      }

      setComments({ status: 'LOADING_INITIAL_PAGE' });

      BarzAPI.getCommentsForBattle(getToken, battleId)
        .then((data) => {
          if (hasEffectUnmounted()) {
            return;
          }

          setComments({
            status: 'COMPLETE',
            total: data.total,
            data: data.results.map((i) => ({ ...i, isVotingInProgress: false })),
            pageNumber: 1,
            nextPageAvailable: data.next,
          });
        })
        .catch((error) => {
          setComments({ status: 'ERROR', error });
        });
    },
    [userMe, battleId],
  );

  useEffect(() => {
    if (userMe.status !== 'COMPLETE') {
      return;
    }

    let complete = false;

    onFetchInitialPageOfComments(() => complete);

    return () => {
      complete = true;
      setComments({ status: 'IDLE' });
    };
  }, [getToken, battleId]);

  const onFetchNextPageOfComments = useCallback(
    (hasEffectUnmounted: () => boolean = () => false) => {
      if (comments.status !== 'COMPLETE') {
        return;
      }

      if (!comments.nextPageAvailable) {
        // There are no more pages of data to fetch!
        return;
      }

      const originalState = comments;

      setComments((old) => {
        if (old.status !== 'COMPLETE') {
          return old;
        }

        return {
          status: 'LOADING_NEW_PAGE',
          data: comments.data,
          total: comments.total,
        };
      });

      const page = comments.pageNumber + 1;

      console.log('FETCH PAGE:', page);
      BarzAPI.getCommentsForBattle(getToken, battleId, page)
        .then((newData) => {
          if (hasEffectUnmounted()) {
            return;
          }
          setComments((old) => {
            if (old.status !== 'LOADING_NEW_PAGE') {
              return old;
            }

            return {
              status: 'COMPLETE',
              total: newData.total,
              pageNumber: page,
              data: [
                ...old.data,
                ...newData.results.map((n) => ({ ...n, isVotingInProgress: false })),
              ],
              nextPageAvailable: newData.next,
            };
          });
        })
        .catch((error) => {
          console.log(`Error fetching comments page ${page} for battle ${battleId}: ${error}`);
          showMessage({
            message: 'Error fetching more comments!',
            type: 'info',
          });

          if (hasEffectUnmounted()) {
            return;
          }
          setComments(originalState);
        });
    },
    [userMe, comments, battleId],
  );

  // When the largest viewable index gets near the end of the list, attempt to load more data - this
  // implements "infinite scroll"
  const [largestViewableIndex, setLargestViewableIndex] = useState(0);
  useEffect(() => {
    if (comments.status !== 'COMPLETE') {
      return;
    }
    if (userMe.status !== 'COMPLETE') {
      return;
    }

    let complete = false;

    if (
      largestViewableIndex >
      comments.data.length - VIDEO_COMMENT_BOTTOM_SHEET_COMMENTS_FROM_BOTTOM_TO_FETCH_NEXT_PAGE
    ) {
      onFetchNextPageOfComments(() => complete);
    }

    // FIXME: if this is uncommented, this causes the onFetchNextPageOfComments to terminate because
    // it calls `setComments` and `comments` is a dependency
    // return () => {
    //   complete = true;
    // };
  }, [largestViewableIndex, comments, onFetchNextPageOfComments]);

  // FIXME: this is in a ref on purpose, a usecallback doesn't work... for more info:
  // https://stackoverflow.com/questions/65256340/keep-getting-changing-onviewableitemschanged-on-the-fly-is-not-supported
  const onViewableItemsChangedRef = useRef(
    (data: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
      if (data.viewableItems.length < 1) {
        return;
      }
      const largestIndex = Math.max(
        ...data.viewableItems
          .filter((i) => i.isViewable)
          .map((i) => i.index)
          .filter((i): i is number => i !== null),
      );
      setLargestViewableIndex(largestIndex);
    },
  );

  // Listen for updates to comments that are associated with the battle, and use these messages to
  // keep the local comments state in sync.
  const pusher = useContext(PusherContext);
  const userMeDataId = userMe.status === 'COMPLETE' ? userMe.data.id : null;
  useEffect(() => {
    if (!pusher) {
      return;
    }
    if (!userMeDataId) {
      return;
    }

    // When new comments are created / updated / deleted, apply those updates
    let battleCommentsSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battle-${battleId}-comments`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);

          switch (event.eventName) {
            case 'battleComment.create':
            case 'battleComment.update':
              setComments((old) => {
                if (
                  old.status === 'IDLE' ||
                  old.status === 'LOADING_INITIAL_PAGE' ||
                  old.status === 'ERROR'
                ) {
                  return old;
                }

                let commentUpdated = false;
                const newData = old.data.map((existingComment) => {
                  if (existingComment.id === payload.id) {
                    commentUpdated = true;
                    return {
                      ...existingComment,
                      ...payload,
                      computedHasBeenVotedOnByUserMe:
                        existingComment.computedHasBeenVotedOnByUserMe,
                    };
                  } else {
                    return existingComment;
                  }
                });

                return {
                  ...old,
                  total: commentUpdated ? old.total : old.total + 1,
                  data: commentUpdated
                    ? newData
                    : [...newData, { ...payload, computedHasBeenVotedOnByUserMe: false }],
                };
              });
              break;

            case 'battleComment.delete':
              setComments((old) => {
                if (
                  old.status === 'IDLE' ||
                  old.status === 'LOADING_INITIAL_PAGE' ||
                  old.status === 'ERROR'
                ) {
                  return old;
                }

                const newData = old.data.filter(
                  (existingComment) => existingComment.id !== payload.id,
                );

                return {
                  ...old,
                  total: old.total - (old.data.length - newData.length),
                  data: newData,
                };
              });
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        battleCommentsSubscription = channel;
      });

    // When the authed user votes/ unvotes a comment, update the state of the comment so that the
    // little indicator next to the comment is focused if the user upvotes on another device
    let battleCommentVoteSubscription: PusherChannel | null = null;
    pusher
      .subscribe({
        channelName: `private-battle-${battleId}-user-${userMeDataId}-commentvotes`,
        onEvent: (event: PusherEvent) => {
          const payload = JSON.parse(event.data);

          switch (event.eventName) {
            case 'battleCommentVote.create':
              setComments((old) => {
                if (
                  old.status === 'IDLE' ||
                  old.status === 'LOADING_INITIAL_PAGE' ||
                  old.status === 'ERROR'
                ) {
                  return old;
                }

                return {
                  ...old,
                  data: old.data.map((existingComment) => {
                    if (existingComment.id === payload.commentId) {
                      // Mark the given comment as having being voted on
                      return {
                        ...existingComment,
                        computedHasBeenVotedOnByUserMe: true,
                      };
                    } else {
                      return existingComment;
                    }
                  }),
                };
              });
              break;

            case 'battleCommentVote.delete':
              setComments((old) => {
                if (
                  old.status === 'IDLE' ||
                  old.status === 'LOADING_INITIAL_PAGE' ||
                  old.status === 'ERROR'
                ) {
                  return old;
                }

                return {
                  ...old,
                  data: old.data.map((existingComment) => {
                    if (existingComment.id === payload.commentId) {
                      // Mark the given comment as having being voted on
                      return {
                        ...existingComment,
                        computedHasBeenVotedOnByUserMe: false,
                      };
                    } else {
                      return existingComment;
                    }
                  }),
                };
              });
              break;
          }
        },
      })
      .then((channel: PusherChannel) => {
        battleCommentVoteSubscription = channel;
      });

    return () => {
      if (battleCommentsSubscription) {
        battleCommentsSubscription.unsubscribe();
      }
      if (battleCommentVoteSubscription) {
        battleCommentVoteSubscription.unsubscribe();
      }
    };
  }, [pusher, userMeDataId, battleId, setComments]);

  // Whenever the total number of comments changes, sync it to the parent context so it can be shown
  // on the comments button that opens this view
  useEffect(() => {
    if (!onChangeCommentTotal) {
      return;
    }
    if (comments.status !== 'COMPLETE' && comments.status !== 'LOADING_NEW_PAGE') {
      return;
    }
    onChangeCommentTotal(comments.total);
  }, [comments]);

  const [messageText, setMessageText] = useState('');
  const [messagePostInProgress, setMessagePostInProgress] = useState(false);
  const [commentIdsWithDeleteInProgress, setCommentIdsWithDeleteInProgress] = useState<
    Array<BattleComment['id']>
  >([]);
  const footerDisabled = ['IDLE', 'LOADING_INITIAL_PAGE', 'ERROR'].includes(comments.status);

  // FIXME: this potentially is bad - rendering the <BottomSheetFooter /> inside of `renderFooter`
  // won't work because `renderFooter` would need to change reference often to have the dependencies
  // required to update the message TextField. And every time it changes reference, it causes the
  // keyboard to close.
  //
  // So instead, render the BottomSheetFooter seperately, but store the props as state and proxy
  // those through to the seperate rendering location. The `useEffect` inside of the `useCallback`
  // like this seems to work, but may prove with time to be a bad choice.
  const [renderFooterProps, setRenderFooterProps] = useState<BottomSheetFooterProps | null>(null);
  const renderFooter = useCallback((props: BottomSheetFooterProps) => {
    useEffect(() => {
      setRenderFooterProps(props);
    }, [props]);
    return null;
  }, []);

  const commentListRenderItem: (data: {
    item: (BattleComment & { isVotingInProgress: boolean }) | 'REFRESH_ITEM';
  }) => React.ReactElement = useCallback(
    ({ item: comment }) => {
      if (comment === 'REFRESH_ITEM') {
        return (
          <View
            style={{
              width: '100%',
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID={`${testID}-refreshing`}
          >
            <Text style={{ ...Typography.Body1, color: Color.White }}>
              Loading more comments...
            </Text>
          </View>
        );
      }

      return (
        <VideoComment
          key={comment.id}
          user={comment.user}
          commentedAtString={comment.commentedAt}
          text={comment.text}
          voteCount={comment.computedVoteTotal}
          isVotedByActiveUser={comment.computedHasBeenVotedOnByUserMe === true}
          isVotingInProgress={comment.isVotingInProgress}
          testID={`${testID}-comment-${comment.id}`}
          onVotePress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            let method = comment.computedHasBeenVotedOnByUserMe
              ? BarzAPI.unvoteCommentForBattle
              : BarzAPI.voteForCommentForBattle;

            // Set a loading flag and perform an optimistic update
            setComments((old) => {
              if (
                old.status === 'IDLE' ||
                old.status === 'LOADING_INITIAL_PAGE' ||
                old.status === 'ERROR'
              ) {
                return old;
              }

              return {
                ...old,
                data: old.data.map((existingComment) => {
                  if (existingComment.id === comment.id) {
                    return {
                      ...existingComment,

                      // Do the optimistic update
                      isVotingInProgress: true,
                      computedVoteTotal:
                        existingComment.computedVoteTotal +
                        (comment.computedHasBeenVotedOnByUserMe ? -1 : 1),

                      // Invert the voted on field locally - a push will be sent from the
                      // server via pusher that will have the definiative value
                      computedHasBeenVotedOnByUserMe: !comment.computedHasBeenVotedOnByUserMe,
                    };
                  } else {
                    return existingComment;
                  }
                }),
              };
            });

            method(getToken, comment.id, battleId)
              .then((newComment) => {
                // Unset the loading flag and update the state from the response data
                setComments((old) => {
                  if (
                    old.status === 'IDLE' ||
                    old.status === 'LOADING_INITIAL_PAGE' ||
                    old.status === 'ERROR'
                  ) {
                    return old;
                  }

                  return {
                    ...old,
                    data: old.data.map((existingComment) => {
                      if (existingComment.id === comment.id) {
                        return {
                          ...existingComment,
                          ...newComment,
                          isVotingInProgress: false,
                          computedHasBeenVotedOnByUserMe:
                            existingComment.computedHasBeenVotedOnByUserMe,
                        };
                      } else {
                        return existingComment;
                      }
                    }),
                  };
                });
              })
              .catch((err) => {
                console.error(`Error voting/unvoting comment: ${err}`);
                showMessage({
                  message: 'Error voting/unvoting comment!',
                  type: 'info',
                });

                // Unset the loading flag and undo the optimistic update
                setComments((old) => {
                  if (
                    old.status === 'IDLE' ||
                    old.status === 'LOADING_INITIAL_PAGE' ||
                    old.status === 'ERROR'
                  ) {
                    return old;
                  }

                  return {
                    ...old,
                    data: old.data.map((existingComment) => {
                      if (existingComment.id === comment.id) {
                        return comment;
                      } else {
                        return existingComment;
                      }
                    }),
                  };
                });
              });
          }}
          onUserAvatarPress={() => onVisitUserProfile(comment.user.id)}
          isDeletingInProgress={commentIdsWithDeleteInProgress.includes(comment.id)}
          onDeleteComment={() => {
            setCommentIdsWithDeleteInProgress((old) => [...old, comment.id]);

            BarzAPI.deleteCommentForBattle(getToken, comment.id, battleId)
              .then(() => {
                setCommentIdsWithDeleteInProgress((old) => old.filter((id) => id !== comment.id));

                // Remove the comment locally
                setComments((old) => {
                  if (
                    old.status === 'IDLE' ||
                    old.status === 'LOADING_INITIAL_PAGE' ||
                    old.status === 'ERROR'
                  ) {
                    return old;
                  }

                  const newData = old.data.filter(
                    (existingComment) => existingComment.id !== comment.id,
                  );

                  return {
                    ...old,
                    total: old.total - (old.data.length - newData.length),
                    data: newData,
                  };
                });
              })
              .catch((err) => {
                setCommentIdsWithDeleteInProgress((old) => old.filter((id) => id !== comment.id));

                console.error(`Error deleting comment: ${err}`);
                showMessage({
                  message: 'Error deleting comment!',
                  type: 'info',
                });
              });
          }}
        />
      );
    },
    [getToken, battleId],
  );

  let innerSheetContents: React.ReactNode = null;
  switch (comments.status) {
    case 'IDLE':
    case 'LOADING_INITIAL_PAGE':
      innerSheetContents = (
        <BottomSheetView style={styles.videoCommentBottomSheetEmptyStateWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11 }}>Loading...</Text>
        </BottomSheetView>
      );
      break;
    case 'ERROR':
      innerSheetContents = (
        <BottomSheetView style={styles.videoCommentBottomSheetEmptyStateWrapper}>
          <Text style={{ ...Typography.Heading3, color: Color.White }}>Error loading comments</Text>
          <Button type="outline" size={32} onPress={() => onFetchInitialPageOfComments()}>
            Refresh
          </Button>
        </BottomSheetView>
      );
      break;
    case 'COMPLETE':
    case 'LOADING_NEW_PAGE':
      if (comments.data.length === 0) {
        innerSheetContents = (
          <BottomSheetView style={styles.videoCommentBottomSheetEmptyStateWrapper}>
            <Text style={{ ...Typography.Heading3, color: Color.White }}>No Comments Yet</Text>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark11 }}>
              Be the first to post
            </Text>
          </BottomSheetView>
        );
      } else if (open) {
        // NOTE: only render the below `FlatList` when the comments popup is open
        //
        // If it is rendered always, then it slows down signifigantly the battle video player that
        // it is embedded within
        innerSheetContents = (
          <Fragment>
            <BottomSheetFlatList
              data={[
                ...comments.data.sort((a, b) => b.commentedAt.localeCompare(a.commentedAt)),
                ...(comments.status === 'LOADING_NEW_PAGE' ? ['REFRESH_ITEM' as const] : []),
              ]}
              testID={`${testID}-comment-list`}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
              initialNumToRender={10}
              renderItem={commentListRenderItem}
              keyExtractor={(item) => (item === 'REFRESH_ITEM' ? 'refresh' : item.id)}
              style={{ marginBottom: 56 }}
            />

            {/* This allows detox to determine programatically how many comments are in the list */}
            <View
              style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, zIndex: 9999 }}
              testID={`${testID}-loaded-comment-count`}
            >
              <Text>{comments.data.length}</Text>
            </View>
          </Fragment>
        );
      }
      break;
  }

  return (
    <BottomSheet
      ref={commentsBottomSheetRef}
      index={open ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={onHandleSheetChanges}
      backgroundStyle={{ backgroundColor: Color.Gray.Dark1 }}
      handleIndicatorStyle={{ backgroundColor: Color.Gray.Dark6 }}
      footerComponent={renderFooter}
      handleStyle={{ paddingTop: 16, paddingBottom: 16 }}
    >
      <Pressable
        style={styles.videoCommentPressableWrapper}
        onPress={Keyboard.dismiss}
        testID={`${testID}-wrapper`}
      >
        <View
          style={[
            styles.videoCommentBottomSheetHeader,
            Platform.OS === 'android' ? { justifyContent: 'flex-start' } : null,
          ]}
          testID={`${testID}-header`}
        >
          <Text style={{ ...Typography.Heading4, color: Color.White }}>Comments</Text>
        </View>

        {innerSheetContents}

        {renderFooterProps ? (
          <BottomSheetFooter {...renderFooterProps} bottomInset={0}>
            <View style={styles.videoCommentBottomSheetFooter}>
              <AvatarImage profileImageUrl={userMe.data.profileImageUrl} />
              <TextField
                type="box"
                bottomSheetTextInputEnabled={Platform.OS !== 'android'}
                width="100%"
                disabled={footerDisabled || messagePostInProgress}
                flexGrow={1}
                flexShrink={1}
                placeholder="What's on your mind"
                value={messageText}
                onChangeText={(text) => setMessageText(text)}
                size={36}
                multiline
                testID={`${testID}-post-comment-text-field`}
              />
              <Button
                size={36}
                type="text"
                disabled={footerDisabled || messagePostInProgress || messageText === ''}
                color={Color.Yellow.Dark10}
                onPress={() => {
                  setMessagePostInProgress(true);

                  const currentPlaybackTimeMilliseconds =
                    battleToCurrentPlaybackTimeMillisecondsRef.current.get(battleId) || 0;

                  BarzAPI.createCommentForBattle(
                    getToken,
                    battleId,
                    messageText,
                    currentPlaybackTimeMilliseconds,
                  )
                    .then((newComment) => {
                      setMessagePostInProgress(false);
                      setMessageText('');

                      // Add the comment locally
                      setComments((old) => {
                        if (
                          old.status === 'IDLE' ||
                          old.status === 'LOADING_INITIAL_PAGE' ||
                          old.status === 'ERROR'
                        ) {
                          return old;
                        }

                        let commentUpdated = false;
                        const newData = old.data.map((existingComment) => {
                          if (existingComment.id === newComment.id) {
                            commentUpdated = true;
                            return {
                              ...existingComment,
                              ...newComment,
                              computedHasBeenVotedOnByUserMe:
                                existingComment.computedHasBeenVotedOnByUserMe,
                            };
                          } else {
                            return existingComment;
                          }
                        });

                        return {
                          ...old,
                          total: commentUpdated ? old.total : old.total + 1,
                          data: commentUpdated
                            ? newData
                            : [
                                ...newData,
                                {
                                  ...newComment,
                                  computedHasBeenVotedOnByUserMe: false,
                                  isVotingInProgress: false,
                                },
                              ],
                        };
                      });
                    })
                    .catch((err) => {
                      setMessagePostInProgress(false);

                      console.error(`Error creating comment: ${err}`);
                      showMessage({
                        message: 'Error creating comment!',
                        type: 'info',
                      });
                    });
                }}
                testID={`${testID}-post-comment-button`}
              >
                Post
              </Button>
            </View>
          </BottomSheetFooter>
        ) : null}
      </Pressable>
    </BottomSheet>
  );
};

export const VideoMoreBottomSheet: React.FunctionComponent<{
  battleRecording: BattleRecording;
  open: boolean;
  onClose: () => void;
}> = ({ battleRecording, open, onClose }) => {
  const [userMe] = useContext(UserDataContext);
  if (userMe.status !== 'COMPLETE') {
    throw new Error(
      'VideoCommentBottomSheet is being rendered while userMe.exportStatus is not COMPLETE, this is not allowed',
    );
  }

  const [environment] = useContext(EnvironmentContext);

  // Keep track of when this component unmounts so the video export process can be terminated.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commentsBottomSheetRef = useRef<BottomSheet | null>(null);

  // This controls the points at which the bottom sheet "sticks" open
  const snapPoints = useMemo(() => [164], []);

  const onHandleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const [exportStatus, setExportStatus] = useState<'IDLE' | 'LOADING' | 'DOWNLOADED'>('IDLE');

  return (
    <BottomSheet
      ref={commentsBottomSheetRef}
      index={open ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose={exportStatus !== 'LOADING'}
      onChange={onHandleSheetChanges}
      backgroundStyle={{ backgroundColor: Color.Gray.Dark1 }}
      handleIndicatorStyle={{ backgroundColor: Color.Gray.Dark6 }}
      handleStyle={{ paddingVertical: 16 }}
    >
      <BottomSheetView style={{ paddingBottom: 16 }}>
        <ListItemContainer>
          <ListItem
            onPress={async () => {
              if (!battleRecording.battleExportedVideoUrl) {
                return;
              }

              // Generate a temporary file path locally to store the video export
              const url = new URL(battleRecording.battleExportedVideoUrl);
              const fileExtensionMatch = /\.([a-zA-Z0-9]+)$/.exec(url.pathname);
              const fileExtension = fileExtensionMatch ? fileExtensionMatch[1] : 'mp4';
              const temporaryExportFileDirectory = `${FileSystem.cacheDirectory}exports`;
              const temporaryExportFilePath = `${temporaryExportFileDirectory}/battle-${battleRecording.battleId}.${fileExtension}`;

              setExportStatus('LOADING');
              try {
                const dirInfo = await FileSystem.getInfoAsync(temporaryExportFileDirectory);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(temporaryExportFileDirectory, {
                    intermediates: true,
                  });
                }
              } catch (err) {
                console.error('Error making export video directory:', err);
                showMessage({
                  message: 'Error downloading video!',
                  type: 'info',
                });
                setExportStatus('IDLE');
                return;
              }

              if (!mountedRef.current) {
                return;
              }

              let mimeType;
              try {
                const result = await FileSystem.downloadAsync(
                  battleRecording.battleExportedVideoUrl,
                  temporaryExportFilePath,
                );
                mimeType = result.mimeType;
              } catch (err) {
                console.error('Error downloading video:', err);
                showMessage({
                  message: 'Error downloading video!',
                  type: 'info',
                });
                setExportStatus('IDLE');
                return;
              }

              if (!mountedRef.current) {
                return;
              }

              setExportStatus('DOWNLOADED');
              let shareCompleted = false;
              try {
                await Share.open({
                  url: temporaryExportFilePath,
                  type: mimeType || undefined,
                });
                shareCompleted = true;
              } catch (err: FixMe) {
                if (err.message !== 'User did not share') {
                  console.error('Unable to share battle export:', err);
                  showMessage({
                    message: 'Unable to share battle export!',
                    type: 'info',
                  });
                  return;
                }
              }
              try {
                await FileSystem.deleteAsync(temporaryExportFilePath);
              } catch (err) {
                console.error('Unable to delete temporary battle export file:', err);
              }
              setExportStatus('IDLE');

              if (shareCompleted) {
                onClose();
              }
            }}
            leading={(color) => <IconDownload color={color} />}
            disabled={exportStatus === 'LOADING'}
          >
            {exportStatus === 'LOADING' ? 'Downloading...' : 'Download Video'}
          </ListItem>

          <ListItem
            onPress={async () => {
              let shareCompleted = false;
              const environmentQueryString =
                environment.type !== 'PRODUCTION'
                  ? `?environment=${encodeURIComponent(JSON.stringify(environment))}`
                  : '';
              try {
                await Share.open({
                  url: `https://sharing.barzbattles.com/battles/${battleRecording.battleId}${environmentQueryString}`,
                });
                shareCompleted = true;
              } catch (err: FixMe) {
                if (err.message !== 'User did not share') {
                  console.error('Unable to share battle:', err);
                  showMessage({
                    message: 'Unable to share battle!',
                    type: 'info',
                  });
                  return;
                }
              }
              if (shareCompleted) {
                onClose();
              }
            }}
            disabled={battleRecording.battleComputedPrivacyLevel !== 'PUBLIC'}
            leading={(color) => <IconShare color={color} />}
          >
            Share
          </ListItem>
        </ListItemContainer>
      </BottomSheetView>
    </BottomSheet>
  );
};
