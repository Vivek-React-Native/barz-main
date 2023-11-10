import * as React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Image,
  View,
  Text,
  FlatList,
  ViewToken,
  Platform,
} from 'react-native';
import { Fragment, useState, useRef, useMemo, useCallback, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@clerk/clerk-expo';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from '@barz/mobile/src/features/battle';
import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import Button from '@barz/mobile/src/ui/Button';
import { FixMe } from '@barz/mobile/src/lib/fixme';
import { UserDataContext } from '@barz/mobile/src/user-data';

// @ts-ignore
import battleLiveSource from '@barz/mobile/src/assets/battle-intro/battle-live.png';
// @ts-ignore
import buildYourRapLegend from '@barz/mobile/src/assets/battle-intro/build-your-rap-legend.png';
// @ts-ignore
import buildYourRapLegendBg from '@barz/mobile/src/assets/battle-intro/build-your-rap-legeng-bg.png';
// @ts-ignore
import fillOutYourProfile from '@barz/mobile/src/assets/battle-intro/fill-out-your-profile.png';
// @ts-ignore
import robHead from '@barz/mobile/src/assets/battle-intro/rob-head.png';

import {
  Crown as IconCrown,
  Close as IconClose,
  ChevronUpFill as IconChevronUpFill,
  ChevronDownFill as IconChevronDownFill,
} from '@barz/mobile/src/ui/icons';
import { UserMe } from '@barz/mobile/src/lib/api';

export const doesUserNeedsRapTag = (user: NonNullable<ReturnType<typeof useUser>['user']>) => {
  return !user.unsafeMetadata.rapperNameChangedFromDefault;
};

export const doesUserNeedsAvatarImage = (user: NonNullable<ReturnType<typeof useUser>['user']>) => {
  return !user.unsafeMetadata.avatarImageUploaded;
};

export const doesUserNeedToFillOutBio = (userMe: UserMe) => {
  return (
    userMe.intro.length === 0 ||
    userMe.locationName === null ||
    userMe.favoriteRapperName === null ||
    userMe.favoriteSongName === null
  );
};

export const IntroSlideshowContents: React.FunctionComponent<{
  onPressStartBattle: () => void;
  onPressFillOutProfile: () => void;
  onPressMaybeLater: () => void;
  onPressClose: () => void;
}> = ({ onPressStartBattle, onPressFillOutProfile, onPressMaybeLater, onPressClose }) => {
  const { isLoaded, isSignedIn, user } = useUser();

  const [userMe] = useContext(UserDataContext);

  const isAllUserMetadataFilledOutAlready = useMemo(() => {
    if (!isSignedIn) {
      return false;
    }
    if (userMe.status !== 'COMPLETE') {
      return false;
    }
    return (
      !doesUserNeedsRapTag(user) &&
      !doesUserNeedsAvatarImage(user) &&
      !doesUserNeedToFillOutBio(userMe.data)
    );
  }, [isSignedIn, user, userMe]);

  const pageIndexArray = useMemo(() => {
    if (isAllUserMetadataFilledOutAlready) {
      return [0, 1, 2]; // If all user metadata is filled out, then the last page of the slideshow can be skipped
    } else {
      return [0, 1, 2, 3];
    }
  }, [isAllUserMetadataFilledOutAlready]);
  const [smallestViewableIndex, setSmallestViewableIndex] = useState(0);

  // FIXME: this is in a ref on purpose, a usecallback doesn't work... for more info:
  // https://stackoverflow.com/questions/65256340/keep-getting-changing-onviewableitemschanged-on-the-fly-is-not-supported
  const onViewableItemsChangedRef = useRef(
    (data: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
      if (data.viewableItems.length < 1) {
        return;
      }
      const smallestIndex = Math.min(
        ...data.viewableItems
          .filter((i) => i.isViewable)
          .map((i) => i.index)
          .filter((i): i is number => i !== null),
      );
      setSmallestViewableIndex(smallestIndex);
    },
  );

  const [[innerWidth, innerHeight], setInnerSize] = useState([0, 0]);

  const flatListRef = useRef<FlatList | null>(null);

  const pageGradientNode = (
    /*
    FIXME: `rgba(0,0,0,0.01)` is working around an android issue where when the color is fully
    transparent, android renders the gradients as big black rectangles
    */
    <LinearGradient
      style={[styles.pageGradient, { width: innerWidth, height: innerHeight * 0.66 }]}
      colors={['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.9)', 'black']}
      locations={[0, 0.15, 0.4, 0.75]}
    />
  );

  return (
    <SafeAreaView style={{ width: '100%', height: '100%', backgroundColor: 'black' }}>
      <View
        style={styles.container}
        onLayout={(event) => {
          setInnerSize([event.nativeEvent.layout.width, event.nativeEvent.layout.height]);
        }}
      >
        <StatusBar style="light" />

        <FlatList
          ref={flatListRef}
          data={pageIndexArray}
          onViewableItemsChanged={onViewableItemsChangedRef.current}
          keyExtractor={(i) => `${i}`}
          pagingEnabled
          getItemLayout={(_data, index) => ({
            length: innerWidth,
            offset: innerWidth * index,
            index,
          })}
          horizontal
          renderItem={({ item }) => {
            switch (item) {
              case 0:
                return (
                  <View
                    style={[
                      styles.pageContainer,
                      { width: innerWidth, height: innerHeight, paddingTop: 24 },
                    ]}
                    testID="battle-intro-slideshow-0"
                  >
                    <Image source={battleLiveSource} style={styles.phoneImage} />

                    <View style={styles.pageTextContainer}>
                      <Text style={styles.pageHeaderText}>Battle Live</Text>
                      <Text style={styles.pageBodyText}>
                        Match against another rapper and enter a live, one-on-one rap battle.
                      </Text>
                      <Text style={styles.pageBodyText}>
                        Battles are one round, with each battler getting 40 seconds: a 10 second
                        warmup, and then 30 seconds to spit. A coin flip decides who goes first.
                      </Text>
                    </View>

                    {/*
                    NOTE: render the gradient on each page rather than globally so swiping on
                    the gradient works to move between pages
                    */}
                    {pageGradientNode}
                  </View>
                );

              case 1:
                return (
                  <View
                    style={[styles.pageContainer, { width: innerWidth, height: innerHeight }]}
                    testID="battle-intro-slideshow-1"
                  >
                    <View style={styles.cloutDiagramWrapper}>
                      <View style={styles.cloutDiagramWrapperLeft}>
                        <View style={styles.cloutWrapper}>
                          <Text
                            style={{
                              ...Typography.Body1Bold,
                              fontSize: 18,
                              lineHeight: 21.6,
                              color: Color.White,
                            }}
                          >
                            YOU
                          </Text>
                          <Image source={robHead} style={{ width: 48, height: 48 }} />
                          <View style={styles.cloutLabel}>
                            <IconCrown size={16} />
                            <Text style={{ ...Typography.Body1Bold, color: Color.White }}>
                              267K
                            </Text>
                          </View>
                        </View>

                        <Text style={{ ...Typography.Body2Bold, color: Color.White }}>VS</Text>

                        <View style={styles.cloutWrapper}>
                          <Text style={{ ...Typography.Body2Bold, color: Color.Gray.Dark11 }}>
                            OPPONENT
                          </Text>
                          <Image source={robHead} style={{ width: 32, height: 32 }} />
                          <View style={styles.cloutLabel}>
                            <IconCrown size={14} />
                            <Text style={{ ...Typography.Body2Bold, color: Color.Gray.Dark11 }}>
                              267K
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.cloutDiagramWrapperRight}>
                        <View style={styles.cloutOutcomeWrapper}>
                          <Text style={{ ...Typography.Body1Bold, color: Color.White }}>WIN</Text>
                          <View style={styles.cloutLabel}>
                            <IconChevronUpFill size={20} color={Color.Green.Dark10} />
                            <IconCrown size={28} color={Color.White} />
                            <Text style={{ ...Typography.Heading3, color: Color.White }}>10K</Text>
                          </View>
                        </View>
                        <View style={styles.cloutOutcomeWrapper}>
                          <Text style={{ ...Typography.Body1Bold, color: Color.White }}>TIE</Text>
                          <View style={styles.cloutLabel}>
                            <IconChevronUpFill size={20} color={Color.Green.Dark10} />
                            <IconCrown size={28} color={Color.White} />
                            <Text style={{ ...Typography.Heading3, color: Color.White }}>1K</Text>
                          </View>
                        </View>
                        <View style={styles.cloutOutcomeWrapper}>
                          <Text style={{ ...Typography.Body1Bold, color: Color.White }}>LOSE</Text>
                          <View style={styles.cloutLabel}>
                            <IconChevronDownFill size={20} color={Color.Red.Dark10} />
                            <IconCrown size={28} color={Color.White} />
                            <Text style={{ ...Typography.Heading3, color: Color.White }}>8.5K</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.pageTextContainer}>
                      <Text style={styles.pageHeaderText}>Clout Score</Text>
                      <Text style={styles.pageBodyText}>
                        Every rapper has a score that represents their skill level, called your{' '}
                        <Text style={{ ...Typography.Body1, color: Color.Yellow.Dark10 }}>
                          Clout Score
                        </Text>
                        .
                      </Text>
                      <Text style={styles.pageBodyText}>
                        Your Clout Score will increase when you beat your opponent. The better your
                        opponent, the more points you’ll gain, and vice versa.
                      </Text>
                    </View>

                    {/*
                    NOTE: render the gradient on each page rather than globally so swiping on
                    the gradient works to move between pages
                    */}
                    {pageGradientNode}
                  </View>
                );

              case 2:
                return (
                  <View
                    style={[styles.pageContainer, { width: innerWidth, height: innerHeight }]}
                    testID="battle-intro-slideshow-2"
                  >
                    <Image source={buildYourRapLegend} style={styles.phoneImage} />

                    <View
                      style={[
                        styles.pageTextContainer,
                        { marginBottom: isAllUserMetadataFilledOutAlready ? 54 : 0 },
                      ]}
                    >
                      <Text style={styles.pageHeaderText}>Build Your Rap Legend</Text>
                      <Text style={styles.pageBodyText}>
                        As you win battles and build up your Clout Score, your skill level will
                        improve, you will face better rappers, and your fan base will grow.
                      </Text>
                    </View>

                    <Image
                      source={buildYourRapLegendBg}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '-10%',
                        width: '120%',
                      }}
                    />

                    {/* NOTE: The below gradients bleed over onto the previous and next pages - this is purposeful */}
                    {/*
                    FIXME: `rgba(0,0,0,0.01)` is working around an android issue where when the color is fully
                    transparent, android renders the gradients as big black rectangles
                    */}
                    <LinearGradient
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '-10%',
                        width: '20%',
                        height: innerHeight,
                        zIndex: 0,
                      }}
                      start={{ x: 1, y: 0.5 }}
                      end={{ x: 0, y: 0.5 }}
                      colors={['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.2)', 'black']}
                      locations={[0, 0.15, 1]}
                    />
                    <LinearGradient
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: '-10%',
                        width: '20%',
                        height: innerHeight,
                        zIndex: 0,
                      }}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      colors={['rgba(0, 0, 0, 0.01)', 'rgba(0, 0, 0, 0.2)', 'black']}
                      locations={[0, 0.15, 1]}
                    />

                    {/*
                    NOTE: render the gradient on each page rather than globally so swiping on
                    the gradient works to move between pages
                    */}
                    {pageGradientNode}
                  </View>
                );

              case 3:
                return (
                  <View
                    style={[styles.pageContainer, { width: innerWidth, height: innerHeight }]}
                    testID="battle-intro-slideshow-3"
                  >
                    <Image source={fillOutYourProfile} style={styles.phoneImage} />

                    <View style={[styles.pageTextContainer, { marginBottom: 54 }]}>
                      <Text style={styles.pageHeaderText}>Fill out your profile</Text>
                      <Text style={styles.pageBodyText}>
                        Tell the world what you’re about by filling out the bio section. Better bios
                        also lead to more entertaining battles.
                      </Text>
                      <Text style={styles.pageBodyText}>
                        Then match against another rapper and enter a live, one-on-one rap battle.
                      </Text>
                    </View>

                    {/*
                    NOTE: render the gradient on each page rather than globally so swiping on
                    the gradient works to move between pages
                    */}
                    {pageGradientNode}
                  </View>
                );

              default:
                return null;
            }
          }}
        />

        <View style={styles.actionsWrapper}>
          <View style={styles.pageDotsWrapper}>
            {pageIndexArray.map((index) => (
              <View
                key={index}
                style={[
                  styles.pageDot,
                  index === smallestViewableIndex ? styles.pageDotActive : null,
                ]}
              />
            ))}
          </View>
          <View style={styles.buttonsWrapper}>
            {smallestViewableIndex === pageIndexArray.at(-1) ? (
              // If at the end of all of the pages, show a different set of buttons
              <Fragment>
                <Button
                  size={48}
                  type="text"
                  width="100%"
                  testID="battle-intro-slideshow-cancel-button"
                  onPress={onPressMaybeLater}
                >
                  Maybe later
                </Button>
                {isAllUserMetadataFilledOutAlready ? (
                  <Button
                    size={48}
                    type="outlineAccent"
                    width="100%"
                    testID="battle-intro-slideshow-start-battle-button"
                    onPress={onPressStartBattle}
                  >
                    Start Battle
                  </Button>
                ) : (
                  <Button
                    size={48}
                    type="outlineAccent"
                    width="100%"
                    testID="battle-intro-slideshow-fill-out-profile-button"
                    onPress={onPressFillOutProfile}
                  >
                    Fill out profile
                  </Button>
                )}
              </Fragment>
            ) : (
              <Fragment>
                <Button
                  size={48}
                  type="outlineAccent"
                  width="100%"
                  testID="battle-intro-slideshow-next-button"
                  onPress={() => {
                    if (!flatListRef.current) {
                      return;
                    }
                    flatListRef.current.scrollToIndex({
                      animated: true,
                      index: smallestViewableIndex + 1,
                    });
                  }}
                >
                  Next
                </Button>
              </Fragment>
            )}
          </View>
        </View>

        {/* This global close button lets one get out of this slideshow at any point */}
        <View
          style={{ position: 'absolute', top: Platform.select({ ios: 16, android: 32 }), left: 16 }}
        >
          <Button
            type="text"
            leading={(color) => <IconClose size={24} color={color} />}
            onPress={onPressClose}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const IntroSlideshow: React.FunctionComponent<PageProps<'Battle > Intro Slideshow'>> = ({
  navigation,
  route,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { matchingScreenParams } = route.params;

  const [userMe] = useContext(UserDataContext);

  // FIXME: refactoring this to be a callback that fires on the 'blur' page navigation event would
  // be ideal, but I tried that and the event never seems to fire for some reason...
  const onMarkSlideshowAsViewed = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return false;
    }

    // If the flag is already set, then skip setting it again
    if (user.unsafeMetadata.battleIntroSlideshowViewed) {
      return;
    }

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          battleIntroSlideshowViewed: true,
        },
      });
    } catch (err: FixMe) {
      console.log(`Error marking slideshow as viewed!`, err);
    }
  }, [isLoaded, isSignedIn, user]);

  return (
    <IntroSlideshowContents
      onPressStartBattle={() => {
        onMarkSlideshowAsViewed();
        navigation.push('Battle > Matching', matchingScreenParams);
      }}
      onPressFillOutProfile={() => {
        onMarkSlideshowAsViewed();

        if (isSignedIn && doesUserNeedsRapTag(user)) {
          navigation.navigate('Battle > Create Rap Tag', { matchingScreenParams });
        } else if (isSignedIn && doesUserNeedsAvatarImage(user)) {
          navigation.navigate('Battle > Upload Avatar', { matchingScreenParams });
        } else if (userMe.status === 'COMPLETE' && doesUserNeedToFillOutBio(userMe.data)) {
          navigation.navigate('Battle > Complete Bio', { matchingScreenParams });
        }
      }}
      onPressMaybeLater={() => {
        onMarkSlideshowAsViewed();
        navigation.goBack();
      }}
      onPressClose={() => {
        onMarkSlideshowAsViewed();
        navigation.goBack();
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    position: 'relative',
    backgroundColor: 'black',
  },

  pageContainer: {
    alignItems: 'center',
    position: 'relative',
  },

  pageTextContainer: {
    position: 'absolute',
    bottom: 136,
    left: 0,
    right: 0,
    gap: 16,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    paddingHorizontal: 46,
    alignItems: 'center',
  },

  pageHeaderText: {
    display: 'flex',
    width: '100%',
    textAlign: 'center',
    ...Typography.Heading1,
    color: Color.White,
    alignItems: 'center',
  },
  pageBodyText: {
    ...Typography.Body1,
    color: Color.Gray.Dark11,
    textAlign: 'center',
    width: '100%',
  },

  pageGradient: {
    position: 'absolute',
    bottom: 0,
    zIndex: 6,
  },

  phoneImage: {
    width: 284,
    height: 575,
    marginTop: 44,
    zIndex: 5,
  },

  cloutDiagramWrapper: {
    flexDirection: 'row',
    width: 250,
    top: '17.5%',
    position: 'absolute',
    zIndex: 1,
  },
  cloutDiagramWrapperLeft: {
    width: '50%',
    gap: 12,
  },
  cloutDiagramWrapperRight: {
    width: '50%',
    gap: 24,
    alignItems: 'flex-end',
    borderLeftColor: Color.Gray.Dark7,
    borderLeftWidth: 1,
  },

  cloutWrapper: {
    gap: 2,
  },

  cloutLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  cloutOutcomeWrapper: {
    gap: 2,
    width: '100%',
    paddingLeft: 24,
  },

  actionsWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,

    flexDirection: 'column',
    alignItems: 'center',
  },

  buttonsWrapper: {
    position: 'relative',
    paddingTop: Platform.select({ ios: 32, android: 24 }),
    flexDirection: 'column',
    width: '100%',
    gap: 6,
  },

  pageDotsWrapper: {
    flexDirection: 'row',
    gap: 12,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: Color.Gray.Dark11,
  },
  pageDotActive: {
    backgroundColor: Color.White,
  },
});

export default IntroSlideshow;
