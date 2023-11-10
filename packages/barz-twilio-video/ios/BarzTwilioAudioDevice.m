//
//  BarzTwilioAudioDevice.h
//
//  Copyright © 2023 MadeByBread LLC. All rights reserved.
//
//  This code was adapted from the ExampleAVAudioEngineDevice class in the twilio-video-ios repo here:
//  https://github.com/twilio/video-quickstart-ios/tree/master/AudioDeviceExample
//
//  Copyright © 2018-2019 Twilio Inc. All rights reserved.

#import "BarzTwilioAudioDevice.h"

/**
 * It is typical to target a 20 ms I/O duration on iOS with libwebrtc in order to reduce processing resources.
 * This might add a small amount of audio delay, but reduces overhead and the likeliness of crackling audio when the system is under load.
 * Capturing on an iPhone XS, iOS 15.7 at 48 kHz in Twilio's AudioDeviceExample:
 *
 * 1. 256 samples or ~ 5.3 ms per callback @ 0.005 duration.
 * 2. 512 samples or ~ 10.7 ms per callback @ 0.01 duration.
 * 3. 1024 samples or ~ 21.3 ms per callback @ 0.02 duration.
 *
 * libwebrtc wants 480 samples (10 ms) at a time but this is impossible on iOS.
 */
static double const kPreferredIOBufferDurationSec = 0.02;

/**
 * TODO(chriseagleston): Consider if playback should occur in stereo, at least on the sender side.
 * At the moment both playback and recording occur in mono via the Audio Unit.
 * AFAICT libwebrtc's OPUS encoder is not being configured for two channel publishing in the iOS Video SDK.
 * Playback of stereo OPUS streams is not a problem as long as the TVIAudioDevice is configured for two channels.
 */
static size_t const kPreferredNumberOfChannels = 1;

// An audio sample is a signed 16-bit integer.
static size_t const kAudioSampleSize = 2;

/**
 * Most music is available at 44.1 kHz, but libwebrtc and iOS prefer to work in 48 kHz.
 * It is probably the lesser of two evils to upsample all music content to 48 kHz in this app.
 */
static uint32_t const kPreferredSampleRate = 48000;

/*
 * Calls to AudioUnitInitialize() can fail if called back-to-back after a format change or adding and removing tracks.
 * A fall-back solution is to allow multiple sequential calls with a small delay between each. This factor sets the max
 * number of allowed initialization attempts.
 */
static const int kMaxNumberOfAudioUnitInitializeAttempts = 5;
/*
 * Calls to AudioOutputUnitStart() can fail if called during CallKit performSetHeldAction (as a workaround for Apple's own bugs when the remote caller ends a call that interrupted our own)
 * Repeated attempts to call this function will allow time for the call to actually be unheld by CallKit thereby allowing us to start our AudioUnit
 */
static const int kMaxNumberOfAudioUnitStartAttempts = 5;

/*
 * Calls to setupAVAudioSession can fail if called during CallKit performSetHeldAction (as a workaround for Apple's own bugs when the remote caller ends a call that interrupted our own)
 * Repeated attempts to call this function will allow time for the call to actually be unheld by CallKit thereby allowing us to activate the AVAudioSession
 */
static const int kMaxNumberOfSetupAVAudioSessionAttempts = 5;

// Audio renderer contexts used in core audio's playout callback to retrieve the sdk's audio device context.
typedef struct AudioRendererContext {
    // Audio device context received in AudioDevice's `startRendering:context` callback.
    TVIAudioDeviceContext deviceContext;

    // Maximum frames per buffer.
    size_t maxFramesPerBuffer;

    // Buffer passed to AVAudioEngine's manualRenderingBlock to receive the mixed audio data.
    AudioBufferList *bufferList;

    /*
     * Points to AVAudioEngine's manualRenderingBlock. This block is called from within the VoiceProcessingIO playout
     * callback in order to receive mixed audio data from AVAudioEngine in real time.
     */
    void *renderBlock;
} AudioRendererContext;

// Audio renderer contexts used in core audio's record callback to retrieve the sdk's audio device context.
typedef struct AudioCapturerContext {
    // Audio device context received in AudioDevice's `startCapturing:context` callback.
    TVIAudioDeviceContext deviceContext;

    // Preallocated buffer list. Please note the buffer itself will be provided by Core Audio's VoiceProcessingIO audio unit.
    AudioBufferList *bufferList;

    // Preallocated mixed (AudioUnit mic + AVAudioPlayerNode file) audio buffer list.
    AudioBufferList *mixedAudioBufferList;

    // Core Audio's VoiceProcessingIO audio unit.
    AudioUnit audioUnit;

    /*
     * Points to AVAudioEngine's manualRenderingBlock. This block is called from within the VoiceProcessingIO playout
     * callback in order to receive mixed audio data from AVAudioEngine in real time.
     */
    void *renderBlock;
} AudioCapturerContext;

// The VoiceProcessingIO audio unit uses bus 0 for ouptut, and bus 1 for input.
static int kOutputBus = 0;
static int kInputBus = 1;

// This is the maximum slice size for VoiceProcessingIO (as observed in the field). We will double check at initialization time.
static size_t kMaximumFramesPerBuffer = 3072;

// The format used to work with the music backing track. If the track is not in this format it is converted.
static AVAudioFormat *kMusicProcessingFormat = nil;

@interface BarzTwilioAudioDevice()

@property (nonatomic, assign, getter=isInterrupted) BOOL interrupted;
@property (nonatomic, assign) AudioUnit audioUnit;
@property (nonatomic, assign) AudioBufferList captureBufferList;

@property (nonatomic, strong, nullable) TVIAudioFormat *renderingFormat;
@property (nonatomic, strong, nullable) TVIAudioFormat *capturingFormat;
@property (atomic, assign) AudioRendererContext *renderingContext;
@property (nonatomic, assign) AudioCapturerContext *capturingContext;

// AudioEngine properties
@property (nonatomic, strong) AVAudioEngine *playoutEngine;
@property (nonatomic, strong) AVAudioPlayerNode *playoutFilePlayer;
@property (nonatomic, strong) AVAudioUnitReverb *playoutReverb;
@property (nonatomic, strong) AVAudioEngine *recordEngine;
@property (nonatomic, strong) AVAudioPlayerNode *recordFilePlayer;
@property (nonatomic, strong) AVAudioUnitReverb *recordReverb;

@property (nonatomic, strong) AVAudioPCMBuffer *musicBuffer;

@property (atomic, assign) BOOL continuousMusic;

@end

@implementation BarzTwilioAudioDevice

#pragma mark - Init & Dealloc

- (id)init {
    self = [super init];

    if (self) {
        /*
         * Initialize rendering and capturing context. The deviceContext will be be filled in when startRendering or
         * startCapturing gets called.
         */

        _enabled = true;

        // Initialize the rendering context
        self.renderingContext = malloc(sizeof(AudioRendererContext));
        memset(self.renderingContext, 0, sizeof(AudioRendererContext));

        // Setup the AVAudioEngine along with the rendering context
        if (![self setupPlayoutAudioEngine]) {
            NSLog(@"Failed to setup AVAudioEngine");
        }

        // Initialize the capturing context
        self.capturingContext = malloc(sizeof(AudioCapturerContext));
        memset(self.capturingContext, 0, sizeof(AudioCapturerContext));
        self.capturingContext->bufferList = &_captureBufferList;

        // Setup the AVAudioEngine along with the rendering context
        if (![self setupRecordAudioEngine]) {
            NSLog(@"Failed to setup AVAudioEngine");
        }

        [self setupAVAudioSession];
        [self registerAVAudioSessionObservers];
    }

    return self;
}

- (void)dealloc {
    [self unregisterAVAudioSessionObservers];

    [self teardownAudioEngine];

    free(self.renderingContext);
    self.renderingContext = NULL;

    AudioBufferList *mixedAudioBufferList = self.capturingContext->mixedAudioBufferList;
    if (mixedAudioBufferList) {
        for (size_t i = 0; i < mixedAudioBufferList->mNumberBuffers; i++) {
            free(mixedAudioBufferList->mBuffers[i].mData);
        }
        free(mixedAudioBufferList);
    }
    free(self.capturingContext);
    self.capturingContext = NULL;
}

- (void)checkAndStartPlayback {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSString *currentCategory = session.category;

    // Check if the audio session category is set to allow playback and recording.
    if ([currentCategory isEqual:AVAudioSessionCategoryPlayAndRecord] || [currentCategory isEqual:AVAudioSessionCategoryMultiRoute]) {
        // Check and start playback for recordFilePlayer.
        if (self.recordFilePlayer && !self.recordFilePlayer.isPlaying) {
            [self.recordFilePlayer play];
            NSLog(@"recordFilePlayer playback started.");
        }
        
        // Check and start playback for playoutFilePlayer.
        if (self.playoutFilePlayer && !self.playoutFilePlayer.isPlaying) {
            [self.playoutFilePlayer play];
            NSLog(@"playoutFilePlayer playback started.");
        }
        
        // Add checks and starts for any additional AVAudioPlayerNodes here.
        
    } else {
        NSLog(@"WARNING!: The AVAudioSession category is not set to allow playback and recording. Current category: %@", currentCategory);
    }
}

+ (NSString *)description {
    return @"AVAudioEngine Audio Mixing";
}

/*
 * Determine at runtime the maximum slice size used by VoiceProcessingIO. Setting the stream format and sample rate
 * doesn't appear to impact the maximum size so we prefer to read this value once at initialization time.
 */
+ (void)initialize {
    AudioComponentDescription audioUnitDescription = [self audioUnitDescription];
    AudioComponent audioComponent = AudioComponentFindNext(NULL, &audioUnitDescription);
    AudioUnit audioUnit;
    OSStatus status = AudioComponentInstanceNew(audioComponent, &audioUnit);
    if (status != 0) {
        NSLog(@"Could not find VoiceProcessingIO AudioComponent instance!");
        return;
    }

    UInt32 framesPerSlice = 0;
    UInt32 propertySize = sizeof(framesPerSlice);
    status = AudioUnitGetProperty(audioUnit, kAudioUnitProperty_MaximumFramesPerSlice,
                                  kAudioUnitScope_Global, kOutputBus,
                                  &framesPerSlice, &propertySize);
    if (status != 0) {
        NSLog(@"Could not read VoiceProcessingIO AudioComponent instance!");
        AudioComponentInstanceDispose(audioUnit);
        return;
    }

    if (framesPerSlice < kMaximumFramesPerBuffer) {
        framesPerSlice = (UInt32) kMaximumFramesPerBuffer;
        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_MaximumFramesPerSlice,
                                      kAudioUnitScope_Global, kOutputBus,
                                      &framesPerSlice, sizeof(framesPerSlice));
    } else {
        kMaximumFramesPerBuffer = (size_t)framesPerSlice;
    }

    NSLog(@"This device uses a maximum slice size of %d frames.", (unsigned int)framesPerSlice);
    AudioComponentInstanceDispose(audioUnit);
    
    kMusicProcessingFormat = [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32 sampleRate:48000 channels:1 interleaved:NO];
}

#pragma mark - Public

- (void)setEnabled:(BOOL)enabled {
    @synchronized(self) {
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            TVIAudioDeviceExecuteWorkerBlock(context, ^{
                @synchronized(self) {
                    // Disabling audio
                    if (!enabled && self.enabled) {
                        NSLog(@"ExampleAVAudioEngineDevice disabling");
                        [self stopAndTeardownAudioUnit];
                    }

                    // Enabling audio
                    if (enabled && !self.enabled) {
                        NSLog(@"ExampleAVAudioEngineDevice reenabling");
                        [self reinitialize];
                    }

                    self->_enabled = enabled;
                }
            });
        }
        else {
            NSLog(@"ExampleAVAudioEngineDevice has no device context. Setting enabled to %@", enabled ? @"YES" : @"NO");
            _enabled = enabled;
        }
    }
}

#pragma mark - Private (AVAudioEngine)

- (BOOL)setupAudioEngine {
    return [self setupPlayoutAudioEngine] && [self setupRecordAudioEngine];
}

- (BOOL)setupRecordAudioEngine {
    NSAssert(_recordEngine == nil, @"AVAudioEngine is already configured");

    /*
     * By default AVAudioEngine will render to/from the audio device, and automatically establish connections between
     * nodes, e.g. inputNode -> effectNode -> outputNode.
     */
    _recordEngine = [AVAudioEngine new];

    // AVAudioEngine operates on the same format as the Core Audio output bus.
    NSError *error = nil;
    const AudioStreamBasicDescription asbd = [[[self class] activeFormat] streamDescription];
    AVAudioFormat *manualRenderingFormat = [[AVAudioFormat alloc] initWithStreamDescription:&asbd];

    // Switch to manual rendering mode
    [_recordEngine stop];
    BOOL success = [_recordEngine enableManualRenderingMode:AVAudioEngineManualRenderingModeRealtime
                                                      format:manualRenderingFormat
                                           maximumFrameCount:(uint32_t)kMaximumFramesPerBuffer
                                                       error:&error];
    if (!success) {
        NSLog(@"Failed to setup manual rendering mode, error = %@", error);
        return NO;
    }

    /*
     * In manual rendering mode, AVAudioEngine won't receive audio from the microhpone. Instead, it will receive the
     * audio data from the Video SDK and mix it in MainMixerNode. Here we connect the input node to the main mixer node.
     * InputNode -> MainMixer -> OutputNode
     */
    [_recordEngine connect:_recordEngine.inputNode to:_recordEngine.mainMixerNode format:manualRenderingFormat];

    /*
     * Attach AVAudioPlayerNode node to play music from a file.
     * AVAudioPlayerNode -> ReverbNode -> MainMixer -> OutputNode (note: ReverbNode is optional)
     */
    [self attachMusicNodeToEngine:_recordEngine];

    // Set the block to provide input data to engine
    AVAudioInputNode *inputNode = _recordEngine.inputNode;
    AudioBufferList *captureBufferList = &_captureBufferList;
    success = [inputNode setManualRenderingInputPCMFormat:manualRenderingFormat
                                               inputBlock: ^const AudioBufferList * _Nullable(AVAudioFrameCount inNumberOfFrames) {
                                                   assert(inNumberOfFrames <= kMaximumFramesPerBuffer);
                                                   return captureBufferList;
                                               }];
    if (!success) {
        NSLog(@"Failed to set the manual rendering block");
        return NO;
    }

    // The manual rendering block (called in Core Audio's VoiceProcessingIO's playout callback at real time)
    self.capturingContext->renderBlock = (__bridge void *)(_recordEngine.manualRenderingBlock);

    // Ensure that the mixer outputs in the same format as the manual rendering format used by the output node.
    [_recordEngine connect:_recordEngine.mainMixerNode to:_recordEngine.outputNode format:manualRenderingFormat];

    success = [_recordEngine startAndReturnError:&error];
    if (!success) {
        NSLog(@"Failed to start AVAudioEngine, error = %@", error);
        return NO;
    }

    NSLog(@"Start record AVAudioEngine with mixer output format: %@, record input format: %@, record output format: %@",
          [_recordEngine.mainMixerNode outputFormatForBus:0], [_recordEngine.outputNode inputFormatForBus:0], [_recordEngine.outputNode outputFormatForBus:0]);

    return YES;
}

- (BOOL)setupPlayoutAudioEngine {
    NSAssert(_playoutEngine == nil, @"AVAudioEngine is already configured");

    /*
     * By default AVAudioEngine will render to/from the audio device, and automatically establish connections between
     * nodes, e.g. inputNode -> effectNode -> outputNode.
     */
    _playoutEngine = [AVAudioEngine new];

    // AVAudioEngine operates on the same format as the Core Audio output bus.
    NSError *error = nil;
    const AudioStreamBasicDescription asbd = [[[self class] activeFormat] streamDescription];
    AVAudioFormat *format = [[AVAudioFormat alloc] initWithStreamDescription:&asbd];
    NSLog(@"Setup playout audio engine with manual rendering format: %@", format);
    
    // Switch to manual rendering mode
    [_playoutEngine stop];
    BOOL success = [_playoutEngine enableManualRenderingMode:AVAudioEngineManualRenderingModeRealtime
                                                      format:format
                                           maximumFrameCount:(uint32_t)kMaximumFramesPerBuffer
                                                       error:&error];
    if (!success) {
        NSLog(@"Failed to setup manual rendering mode, error = %@", error);
        return NO;
    }

    /*
     * In manual rendering mode, AVAudioEngine won't receive audio from the microhpone. Instead, it will receive the
     * audio data from the Video SDK and mix it in MainMixerNode. Here we connect the input node to the main mixer node.
     * InputNode -> MainMixer -> OutputNode
     */
    [_playoutEngine connect:_playoutEngine.inputNode to:_playoutEngine.mainMixerNode format:format];

    /*
     * Attach AVAudioPlayerNode node to play music from a file.
     * AVAudioPlayerNode -> ReverbNode -> MainMixer -> OutputNode (note: ReverbNode is optional)
     */
    [self attachMusicNodeToEngine:_playoutEngine];

    // Set the block to provide input data to engine
    AudioRendererContext *context = _renderingContext;
    AVAudioInputNode *inputNode = _playoutEngine.inputNode;
    success = [inputNode setManualRenderingInputPCMFormat:format
                                               inputBlock: ^const AudioBufferList * _Nullable(AVAudioFrameCount inNumberOfFrames) {
                                                   assert(inNumberOfFrames <= kMaximumFramesPerBuffer);

                                                   AudioBufferList *bufferList = context->bufferList;
                                                   int8_t *audioBuffer = (int8_t *)bufferList->mBuffers[0].mData;
                                                   UInt32 audioBufferSizeInBytes = bufferList->mBuffers[0].mDataByteSize;

                                                   if (context->deviceContext) {
                                                       /*
                                                        * Pull decoded, mixed audio data from the media engine into the
                                                        * AudioUnit's AudioBufferList.
                                                        */
                                                       TVIAudioDeviceReadRenderData(context->deviceContext, audioBuffer, audioBufferSizeInBytes);

                                                   } else {

                                                       /*
                                                        * Return silence when we do not have the playout device context. This is the
                                                        * case when the remote participant has not published an audio track yet.
                                                        * Since the audio graph and audio engine has been setup, we can still play
                                                        * the music file using AVAudioEngine.
                                                        */
                                                       memset(audioBuffer, 0, audioBufferSizeInBytes);
                                                   }

                                                   return bufferList;
                                               }];
    if (!success) {
        NSLog(@"Failed to set the manual rendering block");
        return NO;
    }

    // The manual rendering block (called in Core Audio's VoiceProcessingIO's playout callback at real time)
    self.renderingContext->renderBlock = (__bridge void *)(_playoutEngine.manualRenderingBlock);

    success = [_playoutEngine startAndReturnError:&error];
    if (!success) {
        NSLog(@"Failed to start AVAudioEngine, error = %@", error);
        return NO;
    }

    return YES;
}

- (void)teardownRecordAudioEngine {
    [_recordEngine stop];
    _recordEngine = nil;
}

- (void)teardownPlayoutAudioEngine {
    [_playoutEngine stop];
    _playoutEngine = nil;
}

- (void)teardownAudioEngine {
    [self teardownFilePlayers];
    [self teardownPlayoutAudioEngine];
    [self teardownRecordAudioEngine];
}

/**
 * An ideal backing track would be in the following format for mixing:
 *
 * 1. Bit depth is 32-bit floating point.
 * 2. The sample rate is 48 kHz.
 * 3. The channel count is 1 (mono).
 * 4. The loudness is -10 LUFS in order to mix seamlessly with voice processed audio.
 *
 * Tracks that don't match the technical requirements 1-3 above are converted. The device does not process audio to correct for LUFS.
 */
- (AVAudioPCMBuffer *)musicBuffer {
    if (_musicBuffer != nil) {
        return _musicBuffer;
    }

    NSURL *url = _musicUrl;
    if (url == nil) {
        NSLog(@"WARNING: attempted to call musicBuffer() and musicUrl was nil!");
        return nil;
    }
    
    NSError *error = nil;
    AVAudioFile *file = [[AVAudioFile alloc] initForReading:url error:nil];
    
    // Decide if a sample rate or channel count conversion is required. It is not ideal to convert on-device and while blocking the UI.
    // If a sample rate conversion isn't done, the audio will play, but it will be pitched incorrectly (due to the sample rates not matching up).
    AVAudioFormat *format = kMusicProcessingFormat;
    BOOL isFormatConversionRequired = format.sampleRate != file.processingFormat.sampleRate || format.channelCount != file.processingFormat.channelCount;

    if (isFormatConversionRequired) {
        NSLog(@"Format conversion is required. Converting the input file from: %@, to: %@", file.processingFormat, format);
        
        AVAudioConverter *converter = [[AVAudioConverter alloc] initFromFormat:file.processingFormat toFormat:format];
        AVAudioFrameCount convertedLength = ((double)file.length * (format.sampleRate / file.processingFormat.sampleRate));
        AVAudioPCMBuffer *conversionBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:file.processingFormat frameCapacity:(AVAudioFrameCount)file.length];
        _musicBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format
                                                     frameCapacity:convertedLength];
        
        NSError *converterError = nil;
        AVAudioConverterOutputStatus status = [converter convertToBuffer:_musicBuffer error:&converterError withInputFromBlock:^AVAudioBuffer * _Nullable(AVAudioPacketCount inNumberOfPackets, AVAudioConverterInputStatus * _Nonnull outStatus) {
            NSLog(@"Called the audio converter input block with inNumberOfPackets = %d.", inNumberOfPackets);

            NSError *readError = nil;
            if ([file readIntoBuffer:conversionBuffer frameCount:inNumberOfPackets error:&readError]) {
                *outStatus = AVAudioConverterInputStatus_HaveData;
            } else {
                // FIXME: this isn't a great assumption, but I can't come up with another reliable way to figure this out
                *outStatus = AVAudioConverterInputStatus_EndOfStream;
                NSLog(@"File reading for sample rate conversion ended with error: %@", readError);
            }
            
            return conversionBuffer;
        }];
        
        if (status != AVAudioConverterOutputStatus_HaveData) {
            NSLog(@"The audio conversion failed with status: %ld, %@", (long)status, converterError);
            _musicBuffer = nil;
        }
    } else {
        NSLog(@"The music input file is already in the correct format. %@", file.processingFormat);

        _musicBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:file.processingFormat
                                                     frameCapacity:(AVAudioFrameCount)file.length];
        BOOL success = [file readIntoBuffer:_musicBuffer error:&error];
        if (!success) {
            NSLog(@"Failed to read audio file into buffer. error = %@", error);
            _musicBuffer = nil;
        }
    }

    return _musicBuffer;
}

- (void)scheduleMusicOnRecordEngine {
    [self.recordFilePlayer scheduleBuffer:self.musicBuffer
                                   atTime:nil
                                  options:AVAudioPlayerNodeBufferInterrupts
                        completionHandler:^{
        NSLog(@"Downstream file player finished buffer playing");

        dispatch_async(dispatch_get_main_queue(), ^{
            // Completed playing file via AVAudioEngine.
            // `nil` context indicates TwilioVideo SDK does not need core audio either.
            if (![self deviceContext]) {
                [self tearDownAudio];
            }
        });
    }];
    [self.recordFilePlayer play];

    /*
     * TODO: The upstream AVAudioPlayerNode and downstream AVAudioPlayerNode schedule playout of the buffer
     * "now". In order to ensure full synchronization, choose a time in the near future when scheduling playback.
     */
}

- (void)scheduleMusicOnPlayoutEngine {
    [self.playoutFilePlayer scheduleBuffer:self.musicBuffer
                                    atTime:nil
                                   options:AVAudioPlayerNodeBufferInterrupts
                         completionHandler:^{
        NSLog(@"Upstream file player finished buffer playing");
        dispatch_async(dispatch_get_main_queue(), ^{
            // Completed playing file via AVAudioEngine.
            // `nil` context indicates TwilioVideo SDK does not need core audio either.
            if (![self deviceContext]) {
                [self tearDownAudio];
            }
        });
    }];
    [self.playoutFilePlayer play];

    /*
     * TODO: The upstream AVAudioPlayerNode and downstream AVAudioPlayerNode schedule playout of the buffer
     * "now". In order to ensure full synchronization, choose a time in the near future when scheduling playback.
     */
}

- (void)playMusic:(BOOL)continuous {
    @synchronized(self) {
        if (continuous) {
            if (!self.renderingFormat) {
                self.renderingFormat = [self renderFormat];
            }
            if (!self.capturingFormat) {
                self.capturingFormat = [self captureFormat];
            }
            // If device context is null, we will setup the audio unit by invoking the
            // rendring and capturing.
            [self initializeCapturer];
            [self initializeRenderer];

            [self startRendering:self.renderingContext->deviceContext];
            [self startCapturing:self.capturingContext->deviceContext];
        }
        self.continuousMusic = continuous;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        [self scheduleMusicOnPlayoutEngine];
        [self scheduleMusicOnRecordEngine];
    });
}

- (void)stopMusic {
    // Note: This code is borrowed from the previous Swift class BarzCustomAudioDevice.
    @synchronized(self) {
        if (self.playoutFilePlayer.isPlaying) {
            [self.playoutFilePlayer pause];
        }
        if (self.recordFilePlayer.isPlaying) {
            [self.recordFilePlayer pause];
        }

        // Make sure the music buffer is cleared so that if another track is played, the old track's data isn't cached
        _musicBuffer = nil;
    }
}

- (void)tearDownAudio {
    @synchronized(self) {
        [self teardownAudioUnit];
        [self teardownAudioEngine];
        self.continuousMusic = NO;
    }
}

// When called, instantaneously set the volume of the backing track to the given value (0 <= toVolume <= 1)
//
// NOTE: this is kinda counterintuitive, but it seems setting the "output" volume is what is needed here
// since this is the output of the media mixing chain. This seems to be applied BEFORE the mix is done with
// the microphone audio.
- (void)setMusicVolume:(float)toVolume {
    self.playoutFilePlayer.volume = toVolume;
    self.recordFilePlayer.volume = toVolume;
    
    // This was being set in Swift, but the Eq does not exist in the Objective-C implementation.
    // self.playoutEq.globalGain = 15.0;
    // self.recordEq.globalGain = 15.0;
}

- (float)musicPlaybackPosition {
    if (self.playoutFilePlayer.lastRenderTime != nil) {
        return self.playoutFilePlayer.lastRenderTime.sampleTime / kPreferredSampleRate;
    } else {
        return 0.0;
    }
}

- (void)attachMusicNodeToEngine:(AVAudioEngine *)engine {
    if (!engine) {
        NSLog(@"Cannot play music. AudioEngine has not been created yet.");
        return;
    }

    AVAudioPlayerNode *player = nil;
    AVAudioUnitReverb *reverb = nil;

    BOOL isPlayoutEngine = [self.playoutEngine isEqual:engine];

    /*
     * Attach an AVAudioPlayerNode as an input to the main mixer.
     * AVAudioPlayerNode -> AVAudioUnitReverb -> MainMixerNode -> Core Audio
     */

    player = [[AVAudioPlayerNode alloc] init];
    reverb = [[AVAudioUnitReverb alloc] init];

    [reverb loadFactoryPreset:AVAudioUnitReverbPresetMediumHall];
    reverb.wetDryMix = 0;

    [engine attachNode:player];
    [engine attachNode:reverb];
    [engine connect:player to:reverb format:kMusicProcessingFormat];
    [engine connect:reverb to:engine.mainMixerNode format:kMusicProcessingFormat];

    if (isPlayoutEngine) {
        self.playoutReverb = reverb;
        self.playoutFilePlayer = player;
    } else {
        self.recordReverb = reverb;
        self.recordFilePlayer = player;
    }
}

- (void)teardownRecordFilePlayer {
    if (self.recordFilePlayer) {
        if (self.recordFilePlayer.isPlaying) {
            [self.recordFilePlayer stop];
        }
        [self.recordEngine detachNode:self.recordFilePlayer];
        [self.recordEngine detachNode:self.recordReverb];
        self.recordReverb = nil;
    }
}

- (void)teardownPlayoutFilePlayer {
    if (self.playoutFilePlayer) {
        if (self.playoutFilePlayer.isPlaying) {
            [self.playoutFilePlayer stop];
        }
        [self.playoutEngine detachNode:self.playoutFilePlayer];
        [self.playoutEngine detachNode:self.playoutReverb];
        self.playoutReverb = nil;
    }
}

- (void)teardownFilePlayers {
    [self teardownRecordFilePlayer];
    [self teardownPlayoutFilePlayer];
}

#pragma mark - TVIAudioDeviceRenderer

- (nullable TVIAudioFormat *)renderFormat {
    if (!_renderingFormat) {

        /*
         * Assume that the AVAudioSession has already been configured and started and that the values
         * for sampleRate and IOBufferDuration are final.
         */
        _renderingFormat = [[self class] activeFormat];
        self.renderingContext->maxFramesPerBuffer = _renderingFormat.framesPerBuffer;
    }

    return _renderingFormat;
}

- (BOOL)initializeRenderer {
    /*
     * In this example we don't need any fixed size buffers or other pre-allocated resources. We will simply write
     * directly to the AudioBufferList provided in the AudioUnit's rendering callback.
     */
    return YES;
}

- (BOOL)startRendering:(nonnull TVIAudioDeviceContext)context {
    @synchronized(self) {
        /*
         * In this example, the app always publishes an audio track. So we will start the audio unit from the capturer
         * call backs. We will restart the audio unit if a remote participant adds an audio track after the audio graph is
         * established. Also we will re-establish the audio graph in case the format changes.
         */
        if (_enabled) {
            [self stopAndTeardownAudioUnit];
        }

        // If music is being played then we have already setup the engine
        if (!self.continuousMusic) {
            // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
            dispatch_async(dispatch_get_main_queue(), ^{
                AVAudioFormat *manualRenderingFormat  = self.playoutEngine.manualRenderingFormat;
                TVIAudioFormat *engineFormat = [[TVIAudioFormat alloc] initWithChannels:manualRenderingFormat.channelCount
                                                                             sampleRate:manualRenderingFormat.sampleRate
                                                                        framesPerBuffer:kMaximumFramesPerBuffer];
                if ([engineFormat isEqual:[[self class] activeFormat]]) {
                    if (self.playoutEngine.isRunning) {
                        [self.playoutEngine stop];
                    }

                    NSError *error = nil;
                    if (![self.playoutEngine startAndReturnError:&error]) {
                        NSLog(@"Failed to start AVAudioEngine, error = %@", error);
                    }
                } else {
                    [self teardownPlayoutFilePlayer];
                    [self teardownPlayoutAudioEngine];
                    [self setupPlayoutAudioEngine];
                }
            });
        }

        self.renderingContext->deviceContext = context;

        if (_enabled) {
            [self setupAndStartAudioUnit];
        } else {
            NSLog(@"ExampleAVAudioEngineDevice will NOT setup/start AudioUnit because it is currently disabled");
        }
        return YES;
    }
}

- (BOOL)stopRendering {
    @synchronized(self) {

        // Continue playing music even after disconnected from a Room.
        if (self.continuousMusic) {
            return YES;
        }

        // If the capturer is runnning, we will not stop the audio unit.
        if (!self.capturingContext->deviceContext && _enabled) {
            [self stopAndTeardownAudioUnit];
        }
        self.renderingContext->deviceContext = NULL;

        // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.playoutFilePlayer.isPlaying) {
                [self.playoutFilePlayer stop];
            }
            if (self.playoutEngine.isRunning) {
                [self.playoutEngine stop];
            }
        });
    }

    return YES;
}

#pragma mark - TVIAudioDeviceCapturer

- (nullable TVIAudioFormat *)captureFormat {
    if (!_capturingFormat) {

        /*
         * Assume that the AVAudioSession has already been configured and started and that the values
         * for sampleRate and IOBufferDuration are final.
         */
        _capturingFormat = [[self class] activeFormat];
    }

    return _capturingFormat;
}

- (BOOL)initializeCapturer {
    _captureBufferList.mNumberBuffers = 1;
    _captureBufferList.mBuffers[0].mNumberChannels = kPreferredNumberOfChannels;

    AudioBufferList *mixedAudioBufferList = self.capturingContext->mixedAudioBufferList;
    if (mixedAudioBufferList == NULL) {
        mixedAudioBufferList = (AudioBufferList*)malloc(sizeof(AudioBufferList));
        mixedAudioBufferList->mNumberBuffers = 1;
        mixedAudioBufferList->mBuffers[0].mNumberChannels = kPreferredNumberOfChannels;
        mixedAudioBufferList->mBuffers[0].mDataByteSize = 0;
        mixedAudioBufferList->mBuffers[0].mData = malloc(kMaximumFramesPerBuffer * kPreferredNumberOfChannels * kAudioSampleSize);

        self.capturingContext->mixedAudioBufferList = mixedAudioBufferList;
    }

    return YES;
}

- (BOOL)startCapturing:(nonnull TVIAudioDeviceContext)context {
    @synchronized (self) {

        // Restart the audio unit if the audio graph is already set up and if we publish an audio track.
        if (_enabled) {
            [self stopAndTeardownAudioUnit];
        }

        // If music is being played then we have already setup the engine
        if (!self.continuousMusic) {
            // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
            dispatch_async(dispatch_get_main_queue(), ^{
                AVAudioFormat *manualRenderingFormat  = self.recordEngine.manualRenderingFormat;
                TVIAudioFormat *engineFormat = [[TVIAudioFormat alloc] initWithChannels:manualRenderingFormat.channelCount
                                                                             sampleRate:manualRenderingFormat.sampleRate
                                                                        framesPerBuffer:kMaximumFramesPerBuffer];
                if ([engineFormat isEqual:[[self class] activeFormat]]) {
                    if (self.recordEngine.isRunning) {
                        [self.recordEngine stop];
                    }

                    NSError *error = nil;
                    if (![self.recordEngine startAndReturnError:&error]) {
                        NSLog(@"Failed to start AVAudioEngine, error = %@", error);
                    }
                } else {
                    [self teardownRecordFilePlayer];
                    [self teardownRecordAudioEngine];
                    [self setupRecordAudioEngine];
                }
            });
        }

        self.capturingContext->deviceContext = context;

        if (_enabled) {
            [self setupAndStartAudioUnit];
        } else {
            NSLog(@"ExampleAVAudioEngineDevice will NOT setup/start AudioUnit because it is currently disabled");
        }
        return YES;
    }
}

- (BOOL)stopCapturing {
    @synchronized(self) {

        // Continue playing music even after disconnected from a Room.
        if (self.continuousMusic) {
            return YES;
        }

        // If the renderer is runnning, we will not stop the audio unit.
        if (!self.renderingContext->deviceContext && _enabled) {
            [self stopAndTeardownAudioUnit];
        }
        self.capturingContext->deviceContext = NULL;

        // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.recordFilePlayer.isPlaying) {
                [self.recordFilePlayer stop];
            }
            if (self.recordEngine.isRunning) {
                [self.recordEngine stop];
            }
        });
    }

    return YES;
}

#pragma mark - Private (AudioUnit callbacks)

static OSStatus ExampleAVAudioEngineDevicePlayoutCallback(void *refCon,
                                                          AudioUnitRenderActionFlags *actionFlags,
                                                          const AudioTimeStamp *timestamp,
                                                          UInt32 busNumber,
                                                          UInt32 numFrames,
                                                          AudioBufferList *bufferList) NS_AVAILABLE(NA, 11_0) {
    assert(bufferList->mNumberBuffers == 1);
    assert(bufferList->mBuffers[0].mNumberChannels <= 2);
    assert(bufferList->mBuffers[0].mNumberChannels > 0);

    AudioRendererContext *context = (AudioRendererContext *)refCon;
    context->bufferList = bufferList;

    int8_t *audioBuffer = (int8_t *)bufferList->mBuffers[0].mData;
    UInt32 audioBufferSizeInBytes = bufferList->mBuffers[0].mDataByteSize;

    // Pull decoded, mixed audio data from the media engine into the AudioUnit's AudioBufferList.
    assert(audioBufferSizeInBytes == (bufferList->mBuffers[0].mNumberChannels * kAudioSampleSize * numFrames));
    OSStatus outputStatus = noErr;

    // Get the mixed audio data from AVAudioEngine's output node by calling the `renderBlock`
    AVAudioEngineManualRenderingBlock renderBlock = (__bridge AVAudioEngineManualRenderingBlock)(context->renderBlock);
    const AVAudioEngineManualRenderingStatus status = renderBlock(numFrames, bufferList, &outputStatus);

    /*
     * Render silence if there are temporary mismatches between CoreAudio and our rendering format or AVAudioEngine
     * could not render the audio samples.
     */
    if (numFrames > context->maxFramesPerBuffer || status != AVAudioEngineManualRenderingStatusSuccess) {
        if (numFrames > context->maxFramesPerBuffer) {
            NSLog(@"Can handle a max of %u frames but got %u.", (unsigned int)context->maxFramesPerBuffer, (unsigned int)numFrames);
        }
        *actionFlags |= kAudioUnitRenderAction_OutputIsSilence;
        memset(audioBuffer, 0, audioBufferSizeInBytes);
    }

    return noErr;
}

static OSStatus ExampleAVAudioEngineDeviceRecordCallback(void *refCon,
                                                         AudioUnitRenderActionFlags *actionFlags,
                                                         const AudioTimeStamp *timestamp,
                                                         UInt32 busNumber,
                                                         UInt32 numFrames,
                                                         AudioBufferList *bufferList) NS_AVAILABLE(NA, 11_0) {

    if (numFrames > kMaximumFramesPerBuffer) {
        NSLog(@"Expected %u frames but got %u.", (unsigned int)kMaximumFramesPerBuffer, (unsigned int)numFrames);
        return noErr;
    }

    AudioCapturerContext *context = (AudioCapturerContext *)refCon;

    if (context->deviceContext == NULL) {
        return noErr;
    }

    AudioBufferList *audioBufferList = context->bufferList;
    audioBufferList->mBuffers[0].mDataByteSize = numFrames * sizeof(UInt16) * kPreferredNumberOfChannels;
    // The buffer will be filled by VoiceProcessingIO AudioUnit
    audioBufferList->mBuffers[0].mData = NULL;

    OSStatus status = noErr;
    status = AudioUnitRender(context->audioUnit,
                             actionFlags,
                             timestamp,
                             1,
                             numFrames,
                             audioBufferList);

    AudioBufferList *mixedAudioBufferList = context->mixedAudioBufferList;
    assert(mixedAudioBufferList != NULL);
    assert(mixedAudioBufferList->mNumberBuffers == audioBufferList->mNumberBuffers);
    for(int i = 0; i < audioBufferList->mNumberBuffers; i++) {
        mixedAudioBufferList->mBuffers[i].mNumberChannels = audioBufferList->mBuffers[i].mNumberChannels;
        mixedAudioBufferList->mBuffers[i].mDataByteSize = audioBufferList->mBuffers[i].mDataByteSize;
    }

    OSStatus outputStatus = noErr;
    AVAudioEngineManualRenderingBlock renderBlock = (__bridge AVAudioEngineManualRenderingBlock)(context->renderBlock);
    const AVAudioEngineManualRenderingStatus ret = renderBlock(numFrames, mixedAudioBufferList, &outputStatus);

    if (ret != AVAudioEngineManualRenderingStatusSuccess) {
        NSLog(@"AVAudioEngine failed mix audio");
    } else {
      // AVAudioSession *session = AVAudioSession.sharedInstance;
      // NSLog(@"AVAudioEngine mixed audio. sessionInputChannels = %ld, sessionSampleRate = %0.0f, sessionIODuration = %f", (long)session.inputNumberOfChannels, session.sampleRate, session.IOBufferDuration);
    }

    int8_t *audioBuffer = (int8_t *)mixedAudioBufferList->mBuffers[0].mData;
    UInt32 audioBufferSizeInBytes = mixedAudioBufferList->mBuffers[0].mDataByteSize;

    if (context->deviceContext && audioBuffer) {
        TVIAudioDeviceWriteCaptureData(context->deviceContext, audioBuffer, audioBufferSizeInBytes);
    }

    return noErr;
}

#pragma mark - Private (AVAudioSession and CoreAudio)

+ (nullable TVIAudioFormat *)activeFormat {
    /*
     * Use the pre-determined maximum frame size. AudioUnit callbacks are variable, and in most sitations will be close
     * to the `AVAudioSession.preferredIOBufferDuration` that we've requested.
     */
    const size_t sessionFramesPerBuffer = kMaximumFramesPerBuffer;
    const double sessionSampleRate = [AVAudioSession sharedInstance].sampleRate;

    return [[TVIAudioFormat alloc] initWithChannels:TVIAudioChannelsMono
                                         sampleRate:sessionSampleRate
                                    framesPerBuffer:sessionFramesPerBuffer];
}

+ (AudioComponentDescription)audioUnitDescription {
    AudioComponentDescription audioUnitDescription;
    audioUnitDescription.componentType = kAudioUnitType_Output;
    audioUnitDescription.componentSubType = kAudioUnitSubType_VoiceProcessingIO;
    audioUnitDescription.componentManufacturer = kAudioUnitManufacturer_Apple;
    audioUnitDescription.componentFlags = 0;
    audioUnitDescription.componentFlagsMask = 0;
    return audioUnitDescription;
}

- (BOOL)setupAVAudioSession {
    BOOL result = YES;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *error = nil;

    if (![session setPreferredSampleRate:kPreferredSampleRate error:&error]) {
        NSLog(@"Error setting sample rate: %@", error);
        result = NO;
    }

    if (![session setPreferredOutputNumberOfChannels:kPreferredNumberOfChannels error:&error]) {
        NSLog(@"Error setting number of output channels: %@", error);
        result = NO;
    }

    /*
     * We want to be as close as possible to the 10 millisecond buffer size that the media engine needs. If there is
     * a mismatch then TwilioVideo will ensure that appropriately sized audio buffers are delivered.
     */
    if (![session setPreferredIOBufferDuration:kPreferredIOBufferDurationSec error:&error]) {
        NSLog(@"Error setting IOBuffer duration: %@", error);
        result = NO;
    }

    if (![session setCategory:AVAudioSessionCategoryPlayAndRecord error:&error]) {
        NSLog(@"Error setting session category: %@", error);
        result = NO;
    }

    if (![session setMode:AVAudioSessionModeVideoChat error:&error]) {
        NSLog(@"Error setting session category: %@", error);
        result = NO;
    }

    if (![session setActive:YES error:&error]) {
        NSLog(@"Error activating AVAudioSession: %@", error);
        result = NO;
    }

    if (session.maximumInputNumberOfChannels > 0) {
        if (![session setPreferredInputNumberOfChannels:TVIAudioChannelsMono error:&error]) {
            NSLog(@"Error setting number of input channels: %@", error);
            result = NO;
        }
    }

    return result;
}

- (BOOL)setupAndStartAudioUnit {
    BOOL setupSuccessful = [self setupAudioUnitWithRenderContext:self.renderingContext
                                                  captureContext:self.capturingContext];
    if (!setupSuccessful) {
        NSLog(@"ExampleAVAudioEngineDevice failed to setup audio unit");
        return NO;
    }

    BOOL startSuccessful = [self startAudioUnit];
    if (!startSuccessful) {
        NSLog(@"ExampleAVAudioEngineDevice failed to start audio unit");
        [self stopAndTeardownAudioUnit];
        return NO;
    }
    return YES;
}

- (void)stopAndTeardownAudioUnit {
    @synchronized(self) {
        if (self.audioUnit) {
            [self stopAudioUnit];
            [self teardownAudioUnit];
        }
    }
}

- (BOOL)setupAudioUnitWithRenderContext:(AudioRendererContext *)renderContext
                         captureContext:(AudioCapturerContext *)captureContext {

    // Find and instantiate the VoiceProcessingIO audio unit.
    AudioComponentDescription audioUnitDescription = [[self class] audioUnitDescription];
    AudioComponent audioComponent = AudioComponentFindNext(NULL, &audioUnitDescription);

    OSStatus status = AudioComponentInstanceNew(audioComponent, &_audioUnit);
    if (status != 0) {
        NSLog(@"Could not find VoiceProcessingIO AudioComponent instance!");
        return NO;
    }

    /*
     * Configure the VoiceProcessingIO audio unit. Our rendering format attempts to match what AVAudioSession requires
     * to prevent any additional format conversions after the media engine has mixed our playout audio.
     */
    AudioStreamBasicDescription streamDescription = self.renderingFormat.streamDescription;

    UInt32 enableOutput = 1;
    status = AudioUnitSetProperty(_audioUnit, kAudioOutputUnitProperty_EnableIO,
                                  kAudioUnitScope_Output, kOutputBus,
                                  &enableOutput, sizeof(enableOutput));
    if (status != 0) {
        NSLog(@"Could not enable output bus!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    status = AudioUnitSetProperty(_audioUnit, kAudioUnitProperty_StreamFormat,
                                  kAudioUnitScope_Output, kInputBus,
                                  &streamDescription, sizeof(streamDescription));
    if (status != 0) {
        NSLog(@"Could not set stream format on input bus!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    status = AudioUnitSetProperty(_audioUnit, kAudioUnitProperty_StreamFormat,
                                  kAudioUnitScope_Input, kOutputBus,
                                  &streamDescription, sizeof(streamDescription));
    if (status != 0) {
        NSLog(@"Could not set stream format on output bus!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }
    // Enable the microphone input
    UInt32 enableInput = 1;
    status = AudioUnitSetProperty(_audioUnit, kAudioOutputUnitProperty_EnableIO,
                                  kAudioUnitScope_Input, kInputBus, &enableInput,
                                  sizeof(enableInput));

    if (status != 0) {
        NSLog(@"Could not enable input bus!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    // Setup the rendering callback.
    AURenderCallbackStruct renderCallback;
    renderCallback.inputProc = ExampleAVAudioEngineDevicePlayoutCallback;
    renderCallback.inputProcRefCon = (void *)(renderContext);
    status = AudioUnitSetProperty(_audioUnit, kAudioUnitProperty_SetRenderCallback,
                                  kAudioUnitScope_Output, kOutputBus, &renderCallback,
                                  sizeof(renderCallback));
    if (status != 0) {
        NSLog(@"Could not set rendering callback!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    // Setup the capturing callback.
    AURenderCallbackStruct captureCallback;
    captureCallback.inputProc = ExampleAVAudioEngineDeviceRecordCallback;
    captureCallback.inputProcRefCon = (void *)(captureContext);
    status = AudioUnitSetProperty(_audioUnit, kAudioOutputUnitProperty_SetInputCallback,
                                  kAudioUnitScope_Input, kInputBus, &captureCallback,
                                  sizeof(captureCallback));
    if (status != 0) {
        NSLog(@"Could not set capturing callback!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    NSInteger failedInitializeAttempts = 0;
    while (status != noErr) {
        NSLog(@"Failed to initialize the Voice Processing I/O unit. Error= %ld.", (long)status);
        ++failedInitializeAttempts;
        if (failedInitializeAttempts == kMaxNumberOfAudioUnitInitializeAttempts) {
            break;
        }
        NSLog(@"Pause 100ms and try audio unit initialization again.");
        [NSThread sleepForTimeInterval:0.1f];
        status = AudioUnitInitialize(_audioUnit);
    }

    // Finally, initialize and start the VoiceProcessingIO audio unit.
    if (status != 0) {
        NSLog(@"Could not initialize the audio unit!");
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
        return NO;
    }

    captureContext->audioUnit = _audioUnit;

    return YES;
}

- (BOOL)startAudioUnit {
    NSInteger startAttempts = 0;
    OSStatus status = -1;
    while (status != 0){
        if (startAttempts == kMaxNumberOfAudioUnitStartAttempts) {
            return NO;
        } else if (startAttempts > 0) {
            NSLog(@"Pause 100ms and try starting audio unit again.");
            [NSThread sleepForTimeInterval:0.1f];
        }

        status = AudioOutputUnitStart(_audioUnit);
        ++startAttempts;
    }
    return YES;
}

- (BOOL)stopAudioUnit {
    OSStatus status = AudioOutputUnitStop(_audioUnit);
    if (status != 0) {
        NSLog(@"Could not stop the audio unit!");
        return NO;
    }
    return YES;
}

- (void)teardownAudioUnit {
    if (_audioUnit) {
        AudioUnitUninitialize(_audioUnit);
        AudioComponentInstanceDispose(_audioUnit);
        _audioUnit = NULL;
    }
}

#pragma mark - NSNotification Observers

- (TVIAudioDeviceContext)deviceContext {
    if (self.renderingContext->deviceContext) {
        return self.renderingContext->deviceContext;
    } else if (self.capturingContext->deviceContext) {
        return self.capturingContext->deviceContext;
    }
    return NULL;
}

- (void)registerAVAudioSessionObservers {
    // An audio device that interacts with AVAudioSession should handle events like interruptions and route changes.
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];

    [center addObserver:self selector:@selector(handleAudioInterruption:) name:AVAudioSessionInterruptionNotification object:nil];
    /*
     * Interruption handling is different on iOS 9.x. If your application becomes interrupted while it is in the
     * background then you will not get a corresponding notification when the interruption ends. We workaround this
     * by handling UIApplicationDidBecomeActiveNotification and treating it as an interruption end.
     */
    if (![[NSProcessInfo processInfo] isOperatingSystemAtLeastVersion:(NSOperatingSystemVersion){10, 0, 0}]) {
        [center addObserver:self selector:@selector(handleApplicationDidBecomeActive:) name:UIApplicationDidBecomeActiveNotification object:nil];
    }

    [center addObserver:self selector:@selector(handleRouteChange:) name:AVAudioSessionRouteChangeNotification object:nil];
    [center addObserver:self selector:@selector(handleMediaServiceLost:) name:AVAudioSessionMediaServicesWereLostNotification object:nil];
    [center addObserver:self selector:@selector(handleMediaServiceRestored:) name:AVAudioSessionMediaServicesWereResetNotification object:nil];
    [center addObserver:self selector:@selector(handleEngineConfigurationChange:) name:AVAudioEngineConfigurationChangeNotification object:nil];
}

- (void)handleAudioInterruption:(NSNotification *)notification {
    AVAudioSessionInterruptionType type = [notification.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue];
    AVAudioSessionInterruptionOptions options = [[notification.userInfo valueForKey:AVAudioSessionInterruptionOptionKey] unsignedIntegerValue];

    @synchronized(self) {
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            TVIAudioDeviceExecuteWorkerBlock(context, ^{
                if (type == AVAudioSessionInterruptionTypeBegan) {
                    // Interruption began.
                    self.interrupted = YES;
                    if (self.enabled) {
                        [self stopAndTeardownAudioUnit];
                    }
                } else if (type == AVAudioSessionInterruptionTypeEnded) {
                    // Interruption ended.
                    if (options & AVAudioSessionInterruptionOptionShouldResume) {
                        self.interrupted = NO;
                        // Make sure AVAudioSession is configured properly.
                        if ([self setupAVAudioSession]) {
                            [self reinitialize];
                        }
                    }
                }
            });
        }
    }
}

- (void)handleApplicationDidBecomeActive:(NSNotification *)notification {
    @synchronized(self) {
        // If the worker block is executed, then context is guaranteed to be valid.
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            TVIAudioDeviceExecuteWorkerBlock(context, ^{
                if (self.isInterrupted) {
                    NSLog(@"Synthesizing an interruption ended event for iOS 9.x devices.");
                    self.interrupted = NO;
                    [self startAudioUnit];
                }
            });
        }
    }
}

- (void)handleRouteChange:(NSNotification *)notification {
    // Check if the sample rate, or channels changed and trigger a format change if it did.
    AVAudioSessionRouteChangeReason reason = [notification.userInfo[AVAudioSessionRouteChangeReasonKey] unsignedIntegerValue];

    switch (reason) {

        case AVAudioSessionRouteChangeReasonNewDeviceAvailable:
        case AVAudioSessionRouteChangeReasonOldDeviceUnavailable:
            [self reinitialize];
            break;
        case AVAudioSessionRouteChangeReasonUnknown:
            // Each device change might cause the actual sample rate or channel configuration of the session to change.
        case AVAudioSessionRouteChangeReasonCategoryChange:
            // In iOS 9.2+ switching routes from a BT device in control center may cause a category change.
        case AVAudioSessionRouteChangeReasonOverride:
        case AVAudioSessionRouteChangeReasonWakeFromSleep:
        case AVAudioSessionRouteChangeReasonNoSuitableRouteForCategory:
        case AVAudioSessionRouteChangeReasonRouteConfigurationChange:
            // With CallKit, AVAudioSession may change the sample rate during a configuration change.
            // If a valid route change occurs we may want to update our audio graph to reflect the new output device.
            @synchronized(self) {
                // If the worker block is executed, then context is guaranteed to be valid.
                TVIAudioDeviceContext context = [self deviceContext];
                if (context) {
                    TVIAudioDeviceExecuteWorkerBlock(context, ^{
                        [self handleValidRouteChange];
                    });
                }
            }
            break;
    }
}

- (void)handleValidRouteChange {
    // Nothing to process while we are interrupted. We will interrogate the AVAudioSession once the interruption ends.
    if (self.isInterrupted) {
        return;
    } else if (_audioUnit == NULL) {
        return;
    }

    NSLog(@"A route change ocurred while the AudioUnit was started. Checking the active audio format.");

    if ([self didFormatChange]) {
        [self reinitialize];
    }
}

- (BOOL)didFormatChange {
    BOOL formatDidChange = NO;
    TVIAudioFormat *activeFormat = [[self class] activeFormat];

    // Determine if the format actually changed. We only care about sample rate and number of channels.
    if (![activeFormat isEqual:_renderingFormat] ||
        ![activeFormat isEqual:_capturingFormat]) {
        formatDidChange = YES;
        NSLog(@"Format changed: %@", activeFormat);
    }

    return formatDidChange;
}

-(void)reinitialize {
    // Signal a change by clearing our cached format, and allowing TVIAudioDevice to drive the process.
    _renderingFormat = nil;
    _capturingFormat = nil;

    @synchronized(self) {
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            // Setup AVAudioSession preferences
            BOOL setupSession = [self setupAVAudioSession];
            NSInteger setupAttempts = 1;
            while (!setupSession) {
                if (setupAttempts == kMaxNumberOfSetupAVAudioSessionAttempts) {
                    NSLog(@"Failed to setup AVAudioSession after multiple attempts");
                    break;
                }

                NSLog(@"Pause for 100ms and try setting up AVAudioSession again");
                [NSThread sleepForTimeInterval:0.1f];
                setupSession = [self setupAVAudioSession];
                ++setupAttempts;
            }

            // Update FineAudioBuffer and stop+init+start AudioUnit
            TVIAudioDeviceReinitialize(context);
        }
    }

    if (![self setupAVAudioSession]) {
        NSLog(@"Unable to reconfigure AVAudioSession after interruption");
        return;
    }

    // Ensure we resume playback if it was interrupted.
    [self checkAndStartPlayback];

}

- (void)handleMediaServiceLost:(NSNotification *)notification {
    [self teardownAudioEngine];

    @synchronized(self) {
        // If the worker block is executed, then context is guaranteed to be valid.
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            TVIAudioDeviceExecuteWorkerBlock(context, ^{
                [self teardownAudioUnit];
            });
        }
    }
}

- (void)handleMediaServiceRestored:(NSNotification *)notification {
    [self setupAudioEngine];

    @synchronized(self) {
        // If the worker block is executed, then context is guaranteed to be valid.
        TVIAudioDeviceContext context = [self deviceContext];
        if (context) {
            TVIAudioDeviceExecuteWorkerBlock(context, ^{
                [self startAudioUnit];
            });
        }
    }
}

- (void)handleEngineConfigurationChange:(NSNotification *)notification {
    // TODO(chriseagleston): Is there a need to handle and respond to the configuration change explicitly?
    NSLog(@"Engine configuration change: %@", notification);
}

- (void)unregisterAVAudioSessionObservers {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
