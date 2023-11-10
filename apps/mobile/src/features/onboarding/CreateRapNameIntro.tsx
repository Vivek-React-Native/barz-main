import * as React from 'react';
import { StyleSheet, SafeAreaView, View, Text, Image, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

// ref: https://stackoverflow.com/a/75142476/4115328
import { PageProps } from './index';

// @ts-ignore
import buildYourRapLegend from '@barz/mobile/src/assets/battle-intro/build-your-rap-legend.png';

import { Typography, Color } from '@barz/mobile/src/ui/tokens';
import Button from '@barz/mobile/src/ui/Button';

export const CreateRapNameIntroContents: React.FunctionComponent<{
  generatedRapName: string;
  nextLoading: boolean;
  onPressNext: () => void;
}> = ({ generatedRapName, nextLoading, onPressNext }) => {
  const [[innerWidth, innerHeight], setInnerSize] = useState([0, 0]);

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
        testID="onboarding-create-rap-name-wrapper"
      >
        <StatusBar style="light" />

        <Image source={buildYourRapLegend} style={styles.phoneImage} />
        <View style={styles.rapNameOnTopOfPhoneWrapper}>
          <Text style={{ ...Typography.Heading3, color: Color.White, backgroundColor: 'black' }}>
            {generatedRapName}
          </Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.headerText}>{generatedRapName}</Text>
          <Text style={styles.bodyText}>
            A rap name has been automatically generated for you to use in Barz.
          </Text>
          <Text style={styles.bodyText}>
            Feel free to change it in your profile if you'd prefer something different.
          </Text>
        </View>

        {/*
        NOTE: render the gradient on each page rather than globally so swiping on
        the gradient works to move between pages
        */}
        {pageGradientNode}

        <View style={styles.actionsWrapper}>
          <View style={styles.buttonsWrapper}>
            <Button
              size={48}
              disabled={nextLoading}
              type="outlineAccent"
              width="100%"
              testID="onboarding-create-rap-name-next"
              onPress={onPressNext}
            >
              {nextLoading ? 'Loading...' : 'Continue'}
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const CreateRapNameIntro: React.FunctionComponent<
  PageProps<'Onboarding > Create Rap Name Intro'> & {
    nextLoading: boolean;
    onPressNext: () => void;
  }
> = ({ nextLoading, onPressNext }) => {
  const { isSignedIn, user } = useUser();

  // Add an abitrary delay to the loading of the generated rap name so that it's something users see
  // for a longer time
  const [artificialLoadingDelayComplete, setArtificialLoadingDelayComplete] = useState(false);
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    if (user.unsafeMetadata.defaultRapperNameViewed) {
      return;
    }

    const id = setTimeout(() => {
      setArtificialLoadingDelayComplete(true);
    }, 1000);
    return () => clearInterval(id);
  }, [isSignedIn, user?.unsafeMetadata.defaultRapperNameViewed]);

  // NOTE: both of the below cases shouldn't happen
  if (!isSignedIn) {
    return null;
  }
  if (user.unsafeMetadata.defaultRapperNameViewed) {
    return null;
  }

  const generatedRapName = (user.unsafeMetadata.rapperName as string | undefined) || null;
  if (generatedRapName && artificialLoadingDelayComplete) {
    return (
      <CreateRapNameIntroContents
        generatedRapName={generatedRapName}
        nextLoading={nextLoading}
        onPressNext={onPressNext}
      />
    );
  } else {
    return (
      <View style={styles.container}>
        <Text style={{ ...Typography.Body1, color: Color.White }}>Generating rap name...</Text>
      </View>
    );
  }
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

  rapNameOnTopOfPhoneWrapper: {
    position: 'absolute',
    top: Platform.select({ ios: 148, android: 184 }),
    left: 0,
    zIndex: 10,

    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  textContainer: {
    position: 'absolute',
    bottom: 128,
    left: 0,
    right: 0,
    gap: 16,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    paddingHorizontal: 46,
    alignItems: 'center',
  },

  headerText: {
    display: 'flex',
    width: '100%',
    textAlign: 'center',
    ...Typography.Heading1,
    color: Color.White,
    alignItems: 'center',
  },
  bodyText: {
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
    zIndex: 5,
    position: 'relative',
    top: Platform.select({ ios: -48, android: 0 }),
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
    zIndex: 15,

    flexDirection: 'column',
    alignItems: 'center',
  },

  buttonsWrapper: {
    position: 'relative',
    paddingTop: 32,
    flexDirection: 'column',
    width: '100%',
    gap: 6,
  },
});

export default CreateRapNameIntro;
