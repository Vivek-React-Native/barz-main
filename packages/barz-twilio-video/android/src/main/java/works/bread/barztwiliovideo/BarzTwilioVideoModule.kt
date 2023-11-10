package works.bread.barztwiliovideo

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.util.Base64
import android.util.Log
import android.view.View
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.SessionState
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.twilio.video.AudioDevice
import com.twilio.video.AudioDeviceContext
import com.twilio.video.AudioFormat
import com.twilio.video.BaseTrackStats
import com.twilio.video.ConnectOptions
import com.twilio.video.H264Codec
import com.twilio.video.LocalAudioTrack
import com.twilio.video.LocalAudioTrackPublication
import com.twilio.video.LocalAudioTrackStats
import com.twilio.video.LocalDataTrack
import com.twilio.video.LocalDataTrackPublication
import com.twilio.video.LocalParticipant
import com.twilio.video.LocalTrackStats
import com.twilio.video.LocalVideoTrack
import com.twilio.video.LocalVideoTrackPublication
import com.twilio.video.LocalVideoTrackStats
import com.twilio.video.NetworkQualityConfiguration
import com.twilio.video.NetworkQualityLevel
import com.twilio.video.NetworkQualityVerbosity
import com.twilio.video.Participant
import com.twilio.video.RemoteAudioTrack
import com.twilio.video.RemoteAudioTrackPublication
import com.twilio.video.RemoteAudioTrackStats
import com.twilio.video.RemoteDataTrack
import com.twilio.video.RemoteDataTrackPublication
import com.twilio.video.RemoteParticipant
import com.twilio.video.RemoteTrackStats
import com.twilio.video.RemoteVideoTrack
import com.twilio.video.RemoteVideoTrackPublication
import com.twilio.video.RemoteVideoTrackStats
import com.twilio.video.Room
import com.twilio.video.TrackPublication
import com.twilio.video.TwilioException
import com.twilio.video.Video
import com.twilio.video.VideoCodec
import com.twilio.video.VideoDimensions
import com.twilio.video.VideoFormat
import com.twilio.video.VideoScaleType
import com.twilio.video.Vp8Codec
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import tvi.webrtc.Camera2Capturer
import tvi.webrtc.Camera2Enumerator
import tvi.webrtc.CameraVideoCapturer
import tvi.webrtc.HardwareVideoDecoderFactory
import tvi.webrtc.HardwareVideoEncoderFactory
import tvi.webrtc.RendererCommon
import tvi.webrtc.ThreadUtils
import tvi.webrtc.voiceengine.WebRtcAudioManager
import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.URL
import java.nio.ByteBuffer


typealias SendEvent = (String, WritableNativeMap) -> Unit

// NOTE: inside `Camera2Capture`, the `getCameraName()` methid is protected, which means that it can be only accessed from inside the class.
// However, this camera name value is important as it is the currently active camera. This is key for
// much of the logic to work. So, provide it under a different getter name to expose it outside.
class Camera2CapturerExposingCameraName(context: Context?, cameraName: String?, eventsHandler: CameraVideoCapturer.CameraEventsHandler?) : Camera2Capturer(context, cameraName, eventsHandler) {
    fun getExposedCameraName(): String {
        return this.cameraName
    }

}

class BarzTwilioVideo(private val appContext: AppContext) : View(appContext.reactContext), LifecycleEventListener, AudioManager.OnAudioFocusChangeListener, ActivityCompat.OnRequestPermissionsResultCallback {
    companion object {
        private const val TAG = "BarzTwilioVideo"
        private const val DATA_TRACK_MESSAGE_THREAD_NAME = "DataTrackMessages"
        private const val FRONT_CAMERA_TYPE = "front"
        private const val BACK_CAMERA_TYPE = "back"

        private lateinit var frontFacingDevice: String
        private lateinit var backFacingDevice: String

        private var room: Room? = null
        private var thumbnailVideoView: PatchedVideoView? = null
        private var localVideoTrack: LocalVideoTrack? = null

        private var cameraCapturer: Camera2CapturerExposingCameraName? = null

        private fun isCurrentCameraSourceBackFacing(): Boolean {
            return cameraCapturer?.getExposedCameraName() == backFacingDevice
        }

        private fun setThumbnailMirror() {
            if (cameraCapturer != null) {
                val isBackCamera = isCurrentCameraSourceBackFacing()
                if (thumbnailVideoView?.visibility == View.VISIBLE) {
                    thumbnailVideoView!!.setMirror(!isBackCamera)
                }
            }
        }
        fun registerPrimaryVideoView(v: PatchedVideoView?, trackSid: String) {
            if (room != null) {
                for (participant in room!!.remoteParticipants) {
                    for (publication in participant.remoteVideoTracks) {
                        val track = publication.remoteVideoTrack ?: continue
                        if (publication.trackSid == trackSid) {
                            track.addSink(v!!)
                        } else {
                            track.removeSink(v!!)
                        }
                    }
                }
            }
        }

        fun unregisterPrimaryVideoView(v: PatchedVideoView?, trackSid: String) {
            if (room != null) {
                for (participant in room!!.remoteParticipants) {
                    for (publication in participant.remoteVideoTracks) {
                        val track = publication.remoteVideoTrack ?: continue
                        if (publication.trackSid == trackSid) {
                            track.removeSink(v!!)
                            break
                        }
                    }
                }
            }
        }

        fun registerThumbnailVideoView(v: PatchedVideoView) {
            thumbnailVideoView = v
            if (localVideoTrack != null) {
                localVideoTrack!!.addSink(v)
            }
            setThumbnailMirror()
        }

        fun unregisterThumbnailVideoView(v: PatchedVideoView) {
            if (thumbnailVideoView != null && localVideoTrack != null) {
                localVideoTrack!!.removeSink(thumbnailVideoView!!)
            }
            thumbnailVideoView = null
        }
    }

    private var enableRemoteAudio = false
    private var enableNetworkQualityReporting = false
    private var isVideoEnabled = false
    private var dominantSpeakerEnabled = false
    private var maintainVideoTrackInBackground = false
    // private var cameraType = ""
    private var enableH264Codec = false

    // This value is a callback that can be called to send an event to the react native javascript code
    private var sendEvent: SendEvent? = null

    private var audioFocusRequest: AudioFocusRequest? = null
    private var playbackAttributes: AudioAttributes

    private var roomName: String? = null
    private var accessToken: String? = null
    private var localParticipant: LocalParticipant? = null

    private var localAudioTrack: LocalAudioTrack? = null
    private val audioManager
        get() = requireNotNull(appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE)) as AudioManager
    private var previousAudioMode: Int = AudioManager.MODE_INVALID
    private var disconnectedFromOnDestroy = false
    private val intentFilter = IntentFilter(Intent.ACTION_HEADSET_PLUG)
    private var myNoisyAudioStreamReceiver: BecomingNoisyReceiver? = BecomingNoisyReceiver()

    // Dedicated thread and handler for messages received from a RemoteDataTrack
    private val dataTrackMessageThread = HandlerThread(DATA_TRACK_MESSAGE_THREAD_NAME)
    private lateinit var dataTrackMessageThreadHandler: Handler

    private lateinit var localDataTrack: LocalDataTrack

    // Map used to map remote data tracks to remote participants
    private val dataTrackRemoteParticipantMap: MutableMap<RemoteDataTrack, RemoteParticipant> = HashMap()

    var fileAndMicAudioDevice: FileAndMicAudioDevice? = null

    private var requestMediaPermissionsCallback: ((Error?, Boolean) -> Unit)? = null

    init {
        // Set up custom audio device
        fileAndMicAudioDevice = FileAndMicAudioDevice(appContext.reactContext!!)
        Video.setAudioDevice(fileAndMicAudioDevice!!)
        Log.d(TAG, "Configured Custom Audio Device!")

        /*
         * Needed for setting/abandoning audio focus during call
         */
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        previousAudioMode = audioManager.mode

        playbackAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()

        // Create the local data track
        localDataTrack = appContext.reactContext?.let { LocalDataTrack.create(it) }!!

        // Start the thread where data messages are received
        dataTrackMessageThread.start()
        dataTrackMessageThreadHandler = Handler(dataTrackMessageThread.looper)
    }

    fun setSendEvent(sendEvent: SendEvent?) {
        this.sendEvent = sendEvent
    }

    fun sendJavascriptEvent(name: String, args: WritableNativeMap) {
        this.sendEvent?.let { it(name, args) }
    }

    // ===== SETUP =================================================================================

    private fun buildVideoFormat(): VideoFormat {
        return VideoFormat(VideoDimensions.CIF_VIDEO_DIMENSIONS, 15)
    }

    private fun createCameraCapturer(
        context: Context,
        cameraId: String,
        onCameraSuccess: (() -> Unit)?,
        onCameraError: ((error: String) -> Unit)?
    ): Camera2CapturerExposingCameraName? {
        var newCameraCapturer: Camera2CapturerExposingCameraName? = null
        try {
            newCameraCapturer = Camera2CapturerExposingCameraName(
                    context,
                    cameraId,
                    object : CameraVideoCapturer.CameraEventsHandler {
                        override fun onFirstFrameAvailable() {
                            if (onCameraSuccess != null) {
                                onCameraSuccess()
                            }
                        }
                        override fun onCameraClosed() {}
                        override fun onCameraError(e: String) {
                            Log.i("CustomTwilioVideoView", "Error getting camera: $e")
                            if (onCameraError != null) {
                                onCameraError(e)
                            }
                        }
                        override fun onCameraDisconnected() {}
                        override fun onCameraFreezed(p0: String?) {}
                        override fun onCameraOpening(p0: String?) {}
                    }
            )
            return newCameraCapturer
        } catch (e: Exception) {
            return null
        }
    }

    private fun buildDeviceInfo() {
        val enumerator = Camera2Enumerator(appContext.reactContext!!)
        val deviceNames = enumerator.deviceNames
        for (deviceName in deviceNames) {
            if (enumerator.isBackFacing(deviceName) && enumerator.getSupportedFormats(deviceName)!!.size > 0) {
                backFacingDevice = deviceName
            } else if (enumerator.isFrontFacing(deviceName) && enumerator.getSupportedFormats(deviceName)!!.size > 0) {
                frontFacingDevice = deviceName
            }
        }
    }

    private fun createLocalVideo(enableVideo: Boolean, cameraType: String, onCameraSuccess: (() -> Unit)?, onCameraError: ((error: String) -> Unit)?): Boolean {
        isVideoEnabled = enableVideo

        // Check to make sure that camera permissions have been granted
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            // Permission is not granted
            Log.d("checkCameraPermissions", "No Camera Permissions")
            ActivityCompat.requestPermissions(appContext.currentActivity!!, arrayOf<String>(Manifest.permission.CAMERA),
                    100)
        }

        // Share your camera
        buildDeviceInfo()

        cameraCapturer = if (cameraType == FRONT_CAMERA_TYPE) {
            if (frontFacingDevice != null) {
                createCameraCapturer(appContext.reactContext!!, frontFacingDevice, onCameraSuccess, onCameraError)
            } else {
                // IF the camera is unavailable try the other camera
                createCameraCapturer(appContext.reactContext!!, backFacingDevice, onCameraSuccess, onCameraError)
            }
        } else {
            if (backFacingDevice != null) {
                createCameraCapturer(appContext.reactContext!!, backFacingDevice, onCameraSuccess, onCameraError)
            } else {
                // IF the camera is unavailable try the other camera
                createCameraCapturer(appContext.reactContext!!, frontFacingDevice, onCameraSuccess, onCameraError)
            }
        }

        // If no camera is available let the caller know
        if (cameraCapturer == null) {
            val event = WritableNativeMap()
            event.putString("error", "No camera is supported on this device")
            sendJavascriptEvent("roomDidFailToConnect", event)
            return false
        }

        localVideoTrack = LocalVideoTrack.create(
                appContext.reactContext!!,
                enableVideo,
                cameraCapturer!!,
                buildVideoFormat()
        )
        if (thumbnailVideoView != null && localVideoTrack != null) {
            localVideoTrack!!.addSink(thumbnailVideoView!!)
        }
        setThumbnailMirror()
        return true
    }

    // ===== LIFECYCLE EVENTS ======================================================================

    override fun onHostResume() {
        /*
         * In case it wasn't set.
         */
        if (appContext.currentActivity != null) {
            /*
             * If the local video track was released when the app was put in the background, recreate.
             */
            if (cameraCapturer != null && localVideoTrack == null) {
                localVideoTrack = LocalVideoTrack.create(context, isVideoEnabled, cameraCapturer!!, buildVideoFormat())
            }

            if (localVideoTrack != null) {
                if (thumbnailVideoView != null) {
                    localVideoTrack!!.addSink(thumbnailVideoView!!)
                }

                /*
                 * If connected to a Room then share the local video track.
                 */
                if (localParticipant != null) {
                    localParticipant!!.publishTrack(localVideoTrack!!)
                }
            }

            if (room != null) {
                appContext.currentActivity!!.volumeControlStream = AudioManager.STREAM_VOICE_CALL
            }
        }
    }

    override fun onHostPause() {
        /*
         * Release the local video track before going in the background. This ensures that the
         * camera can be used by other applications while this app is in the background.
         */
        if (localVideoTrack != null && !maintainVideoTrackInBackground) {
            /*
             * If this local video track is being shared in a Room, remove from local
             * participant before releasing the video track. Participants will be notified that
             * the track has been removed.
             */
            if (localParticipant != null) {
                localParticipant!!.unpublishTrack(localVideoTrack!!)
            }

            localVideoTrack!!.release()
            localVideoTrack = null
        }
    }

    override fun onHostDestroy() {
        /*
         * Remove stream voice control
         */
        if (appContext.currentActivity != null) {
            appContext.currentActivity!!.volumeControlStream = AudioManager.USE_DEFAULT_STREAM_TYPE
        }
        /*
         * Always disconnect from the room before leaving the Activity to
         * ensure any memory allocated to the Room resource is freed.
         */
        if (room != null && room!!.state != Room.State.DISCONNECTED) {
            room!!.disconnect()
            disconnectedFromOnDestroy = true
        }

        /*
         * Release the local media ensuring any memory allocated to audio or video is freed.
         */
        if (localVideoTrack != null) {
            localVideoTrack!!.release()
            localVideoTrack = null
        }

        if (localAudioTrack != null) {
            stopLocalAudio()
            audioManager.stopBluetoothSco()
        }

        // Quit the data track message thread
        dataTrackMessageThread.quit()
    }

    fun releaseResource() {
        room = null
        localVideoTrack = null
        thumbnailVideoView = null
        cameraCapturer = null
    }

    fun connect(
        accessToken: String,
        roomName: String,
        enableAudio: Boolean,
        enableVideo: Boolean,
        enableH264Codec: Boolean,
        audioBitrate: Int?,
        videoBitrate: Int?,
        enableNetworkQualityReporting: Boolean,
        dominantSpeakerEnabled: Boolean,
        cameraType: String
    ) {
        this.roomName = roomName
        this.accessToken = accessToken
        this.enableRemoteAudio = true
        this.enableNetworkQualityReporting = enableNetworkQualityReporting
        this.dominantSpeakerEnabled = dominantSpeakerEnabled
        this.maintainVideoTrackInBackground = maintainVideoTrackInBackground
//        this.cameraType = cameraType
        this.enableH264Codec = enableH264Codec

        assert(enableAudio) { "The android native code does not support setting enableAudio to false!" }

        startLocalAudio()
        if (enableVideo) {
            startLocalVideo()
        } else {
            isVideoEnabled = false
        }

        val connectOptionsBuilder = ConnectOptions.Builder(accessToken!!)

        if (roomName != null) {
            connectOptionsBuilder.roomName(roomName!!)
        }

        if (localAudioTrack != null) {
            connectOptionsBuilder.audioTracks(listOf(localAudioTrack))
        }

        if (localVideoTrack != null) {
            connectOptionsBuilder.videoTracks(listOf(localVideoTrack))
        }

        if (localDataTrack != null) {
            connectOptionsBuilder.dataTracks(listOf(localDataTrack))
        }

        // H264 Codec Support Detection: https://www.twilio.com/docs/video/managing-codecs
        val hardwareVideoEncoderFactory = HardwareVideoEncoderFactory(null, true, true)
        val hardwareVideoDecoderFactory = HardwareVideoDecoderFactory(null)

        var h264EncoderSupported = false
        for (videoCodecInfo in hardwareVideoEncoderFactory.supportedCodecs) {
            if (videoCodecInfo.name.equals("h264", true)) {
                h264EncoderSupported = true
                break
            }
        }
        var h264DecoderSupported = false
        for (videoCodecInfo in hardwareVideoDecoderFactory.supportedCodecs) {
            if (videoCodecInfo.name.equals("h264", true)) {
                h264DecoderSupported = true
                break
            }
        }

        val isH264Supported = h264EncoderSupported && h264DecoderSupported

        Log.d(TAG, "H264 supported by hardware: $isH264Supported")

        val supportedCodecs = WritableNativeArray()

        var videoCodec: VideoCodec = Vp8Codec()
        // VP8 is supported on all android devices by default
        supportedCodecs.pushString(videoCodec.toString())

        if (isH264Supported && enableH264Codec) {
            videoCodec = H264Codec()
            supportedCodecs.pushString(videoCodec.toString())
        }

        val event = WritableNativeMap()

        event.putArray("supportedCodecs", supportedCodecs)

        sendJavascriptEvent("localParticipantSupportedCodecs", event)

        connectOptionsBuilder.preferVideoCodecs(listOf(videoCodec))

        connectOptionsBuilder.enableDominantSpeaker(dominantSpeakerEnabled)

        if (enableNetworkQualityReporting) {
            connectOptionsBuilder.enableNetworkQuality(true)
            connectOptionsBuilder.networkQualityConfiguration(NetworkQualityConfiguration(
                    NetworkQualityVerbosity.NETWORK_QUALITY_VERBOSITY_MINIMAL,
                    NetworkQualityVerbosity.NETWORK_QUALITY_VERBOSITY_MINIMAL))
        }

        room = Video.connect(context, connectOptionsBuilder.build(), roomListener()!!)
    }

    fun setAudioType() {
        val devicesInfo: Array<AudioDeviceInfo> = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        var hasNonSpeakerphoneDevice = false
        for (deviceInfo in devicesInfo) {
            val deviceType: Int = deviceInfo.type
            if (deviceType == AudioDeviceInfo.TYPE_WIRED_HEADSET || deviceType == AudioDeviceInfo.TYPE_WIRED_HEADPHONES) {
                hasNonSpeakerphoneDevice = true
            }
            if (deviceType == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || deviceType == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
                audioManager.startBluetoothSco()
                audioManager.isBluetoothScoOn = true
                hasNonSpeakerphoneDevice = true
            }
        }
        audioManager.isSpeakerphoneOn = !hasNonSpeakerphoneDevice
    }

    @SuppressLint("WrongConstant")
    private fun setAudioFocus(focus: Boolean) {
        if (focus) {
            previousAudioMode = audioManager.mode
            // Request audio focus before making any device switch.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                audioManager.requestAudioFocus(this,
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            } else {
                playbackAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                audioFocusRequest = AudioFocusRequest
                        .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(playbackAttributes)
                        // FIXME: the below two lines seem to cause a NullPointerException?
                        // More info: https://developer.android.com/guide/topics/media-apps/audio-focus
                        // .setAcceptsDelayedFocusGain(true)
                        // .setOnAudioFocusChangeListener(this, handler)
                        .build()
                audioManager.requestAudioFocus(audioFocusRequest!!)
            }

            /*
             * Use MODE_IN_COMMUNICATION as the default audio mode. It is required
             * to be in this mode when playout and/or recording starts for the best
             * possible VoIP performance. Some devices have difficulties with
             * speaker mode if this is not set.
             */
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            setAudioType()
            context.registerReceiver(myNoisyAudioStreamReceiver, intentFilter)
        } else {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                audioManager.abandonAudioFocus(this)
            } else if (audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
            }
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = previousAudioMode
            try {
                if (myNoisyAudioStreamReceiver != null) {
                    context.unregisterReceiver(myNoisyAudioStreamReceiver)
                }
                myNoisyAudioStreamReceiver = null
            } catch (e: Exception) {
                // already registered
                e.printStackTrace()
            }
        }
    }

    private inner class BecomingNoisyReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            // audioManager.setSpeakerphoneOn(true);
            if (Intent.ACTION_HEADSET_PLUG == intent.action) {
                setAudioType()
            }
        }
    }

    override fun onAudioFocusChange(focusChange: Int) {
        Log.e(TAG, "audioFocusChange: focuschange: $focusChange")
    }

    fun isConnected(): Boolean {
        return room != null
    }

    // ====== DISCONNECTING ========================================================================

    fun disconnect() {
        room?.disconnect()
        stopLocalAudio()
        audioManager.stopBluetoothSco()
        localVideoTrack?.release()
        localVideoTrack = null
        audioManager.stopBluetoothSco()
        setAudioFocus(false)
        cameraCapturer?.stopCapture()
        cameraCapturer = null
    }

    // ===== SEND STRING ON DATA TRACK ======================================================================
    fun sendString(message: String) {
        localDataTrack?.send(message)
    }


    // ===== BUTTON LISTENERS ======================================================================

    fun flipCamera() {
        if (cameraCapturer != null) {
            val isBackCamera = isCurrentCameraSourceBackFacing()
            if (frontFacingDevice != null && (isBackCamera || backFacingDevice == null)) {
                cameraCapturer!!.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                    override fun onCameraSwitchDone(p0: Boolean) {}
                    override fun onCameraSwitchError(p0: String?) {}
                }, frontFacingDevice)
            } else {
                cameraCapturer!!.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                    override fun onCameraSwitchDone(p0: Boolean) {}
                    override fun onCameraSwitchError(p0: String?) {}
                }, backFacingDevice)
            }
        }
    }

    fun toggleSoundSetup(speaker: Boolean) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.isSpeakerphoneOn = speaker
    }

    // NOTE: This function seems to be unused but is exposed by react-native-twilio-video-webrtc,
    // so this might become important in the future if one wants to use bluetooth headphones on android
    // with this?
    fun toggleBluetoothHeadset(enabled: Boolean) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (enabled) {
            audioManager.startBluetoothSco()
            audioManager.isSpeakerphoneOn = false
        } else {
            audioManager.stopBluetoothSco()
            audioManager.isSpeakerphoneOn = true
        }
    }

    private fun convertBaseTrackStats(bs: BaseTrackStats, result: WritableMap) {
        result.putString("codec", bs.codec)
        result.putInt("packetsLost", bs.packetsLost)
        result.putString("ssrc", bs.ssrc)
        result.putDouble("timestamp", bs.timestamp)
        result.putString("trackSid", bs.trackSid)
    }

    private fun convertLocalTrackStats(ts: LocalTrackStats, result: WritableMap) {
        result.putDouble("bytesSent", ts.bytesSent as Double)
        result.putInt("packetsSent", ts.packetsSent)
        result.putDouble("roundTripTime", ts.roundTripTime as Double)
    }

    private fun convertRemoteTrackStats(ts: RemoteTrackStats, result: WritableMap) {
        result.putDouble("bytesReceived", ts.bytesReceived as Double)
        result.putInt("packetsReceived", ts.packetsReceived)
    }

    private fun convertAudioTrackStats(ras: RemoteAudioTrackStats): WritableMap {
        val result = WritableNativeMap()
        result.putInt("audioLevel", ras.audioLevel)
        result.putInt("jitter", ras.jitter)
        convertBaseTrackStats(ras, result)
        convertRemoteTrackStats(ras, result)
        return result
    }

    private fun convertLocalAudioTrackStats(las: LocalAudioTrackStats): WritableMap {
        val result = WritableNativeMap()
        result.putInt("audioLevel", las.audioLevel)
        result.putInt("jitter", las.jitter)
        convertBaseTrackStats(las, result)
        convertLocalTrackStats(las, result)
        return result
    }

    private fun convertVideoTrackStats(vs: RemoteVideoTrackStats): WritableMap {
        val result = WritableNativeMap()
        val dimensions = WritableNativeMap()
        dimensions.putInt("height", vs.dimensions.height)
        dimensions.putInt("width", vs.dimensions.width)
        result.putMap("dimensions", dimensions)
        result.putInt("frameRate", vs.frameRate)
        convertBaseTrackStats(vs, result)
        convertRemoteTrackStats(vs, result)
        return result
    }

    private fun convertLocalVideoTrackStats(vs: LocalVideoTrackStats): WritableMap {
        val result = WritableNativeMap()
        val dimensions = WritableNativeMap()
        dimensions.putInt("height", vs.dimensions.height)
        dimensions.putInt("width", vs.dimensions.width)
        result.putMap("dimensions", dimensions)
        result.putInt("frameRate", vs.frameRate)
        convertBaseTrackStats(vs, result)
        convertLocalTrackStats(vs, result)
        return result
    }

    fun getStats() {
        room?.getStats { statsReports ->
            val event = WritableNativeMap()
            for (sr in statsReports) {
                val connectionStats: WritableMap = WritableNativeMap()
                val asArray: WritableArray = WritableNativeArray()
                for (s in sr.remoteAudioTrackStats) {
                    asArray.pushMap(convertAudioTrackStats(s))
                }
                connectionStats.putArray("remoteAudioTrackStats", asArray)
                val vsArray: WritableArray = WritableNativeArray()
                for (s in sr.remoteVideoTrackStats) {
                    vsArray.pushMap(convertVideoTrackStats(s))
                }
                connectionStats.putArray("remoteVideoTrackStats", vsArray)
                val lasArray: WritableArray = WritableNativeArray()
                for (s in sr.localAudioTrackStats) {
                    lasArray.pushMap(convertLocalAudioTrackStats(s))
                }
                connectionStats.putArray("localAudioTrackStats", lasArray)
                val lvsArray: WritableArray = WritableNativeArray()
                for (s in sr.localVideoTrackStats) {
                    lvsArray.pushMap(convertLocalVideoTrackStats(s))
                }
                connectionStats.putArray("localVideoTrackStats", lvsArray)
                event.putMap(sr.peerConnectionId, connectionStats)
            }
            sendJavascriptEvent("statsReceived", event)
        }
    }

    // NOTE: this function can be called to disable hardware-based echo cancellation. As of late
    // april 2023, this hasn't seemed to be needed but could become important in the future.
    fun disableOpenSLES() {
        WebRtcAudioManager.setBlacklistDeviceForOpenSLESUsage(true)
    }

    // ====== ROOM LISTENER ========================================================================
    /*
     * Room events listener
     */
    private fun roomListener(): Room.Listener? {
        return object : Room.Listener {
            override fun onConnected(room: Room) {
                /*
                 * Enable changing the volume using the up/down keys during a conversation
                 */
                if (appContext.currentActivity != null) {
                    appContext.currentActivity!!.volumeControlStream = AudioManager.STREAM_VOICE_CALL
                }
                localParticipant = room.localParticipant!!
                localParticipant!!.setListener(localListener()!!)

                val event = WritableNativeMap()
                event.putString("roomName", room.name)
                event.putString("roomSid", room.sid)

                val participants = room.remoteParticipants
                val participantsArray: WritableArray = WritableNativeArray()
                for (participant in participants) {
                    participantsArray.pushMap(buildParticipant(participant))
                }
                participantsArray.pushMap(buildParticipant(localParticipant!!))
                event.putArray("participants", participantsArray)
                event.putMap("localParticipant", buildParticipant(localParticipant!!))

                sendJavascriptEvent("roomDidConnect", event)

                // There is not .publish it's publishTrack
                localParticipant!!.publishTrack(localDataTrack)
                for (participant in participants) {
                    addParticipant(room, participant)
                }
            }

            override fun onConnectFailure(room: Room, e: TwilioException) {
                Log.d(TAG, "Connect Failure! room:$room error:$e")
                val event = WritableNativeMap()
                event.putString("roomName", room.name)
                event.putString("roomSid", room.sid)
                event.putString("error", e.message)
                sendJavascriptEvent("roomDidFailToConnect", event)
            }

            override fun onReconnecting(room: Room, twilioException: TwilioException) {}

            override fun onReconnected(room: Room) {}

            override fun onDisconnected(fromRoom: Room, e: TwilioException?) {
                Log.d(TAG, "Disconnected! room:$room error:$e")
                val event = WritableNativeMap()

                /*
                 * Remove stream voice control
                 */
                if (appContext.currentActivity != null) {
                    appContext.currentActivity!!.volumeControlStream = AudioManager.STREAM_VOICE_CALL
                }
                if (localParticipant != null) {
                    event.putString("participant", localParticipant!!.identity)
                }
                event.putString("roomName", fromRoom.name)
                event.putString("roomSid", fromRoom.sid)
                if (e != null) {
                    event.putString("error", e.message)
                }
                sendJavascriptEvent("roomDidDisconnect", event)

                localParticipant = null
                roomName = null
                accessToken = null
                room = null

                // Only reinitialize the UI if disconnect was not called from onDestroy()
                if (!disconnectedFromOnDestroy) {
                    setAudioFocus(false)
                }
            }

            override fun onParticipantConnected(room: Room, participant: RemoteParticipant) {
                addParticipant(room, participant)
            }

            override fun onParticipantDisconnected(room: Room, participant: RemoteParticipant) {
                removeParticipant(room, participant)
            }

            override fun onRecordingStarted(room: Room) {}

            override fun onRecordingStopped(room: Room) {}

            override fun onDominantSpeakerChanged(room: Room, remoteParticipant: RemoteParticipant?) {
                val event = WritableNativeMap()
                event.putString("roomName", room.name)
                event.putString("roomSid", room.sid)
                if (remoteParticipant == null) {
                    event.putString("participant", "")
                } else {
                    event.putMap("participant", buildParticipant(remoteParticipant))
                }
                sendJavascriptEvent("dominantSpeakerDidChange", event)
            }
        }
    }

    /*
     * Called when participant joins the room
     */
    private fun addParticipant(room: Room, remoteParticipant: RemoteParticipant) {
        val event = WritableNativeMap()
        event.putString("roomName", room.name)
        event.putString("roomSid", room.sid)
        event.putMap("participant", buildParticipant(remoteParticipant))
        sendJavascriptEvent("roomParticipantDidConnect", event)

        /*
         * Start listening for participant media events
         */remoteParticipant.setListener(mediaListener())
        for (remoteDataTrackPublication in remoteParticipant.remoteDataTracks) {
            /*
             * Data track messages are received on the thread that calls setListener. Post the
             * invocation of setting the listener onto our dedicated data track message thread.
             */
            if (remoteDataTrackPublication.isTrackSubscribed) {
                dataTrackMessageThreadHandler.post {
                    addRemoteDataTrack(remoteParticipant,
                            remoteDataTrackPublication.remoteDataTrack)
                }
            }
        }
    }

    /*
     * Called when participant leaves the room
     */
    private fun removeParticipant(room: Room, participant: RemoteParticipant) {
        val event = WritableNativeMap()
        event.putString("roomName", room.name)
        event.putString("roomSid", room.sid)
        event.putMap("participant", buildParticipant(participant))
        sendJavascriptEvent("roomParticipantDidDisconnect", event)
    }

    private fun addRemoteDataTrack(remoteParticipant: RemoteParticipant, remoteDataTrack: RemoteDataTrack?) {
        dataTrackRemoteParticipantMap[remoteDataTrack!!] = remoteParticipant
        remoteDataTrack.setListener(remoteDataTrackListener())
    }

    // ====== MEDIA LISTENER =======================================================================
    private fun mediaListener(): RemoteParticipant.Listener? {
        return object : RemoteParticipant.Listener {
            override fun onAudioTrackSubscribed(participant: RemoteParticipant, publication: RemoteAudioTrackPublication, audioTrack: RemoteAudioTrack) {
                audioTrack.enablePlayback(enableRemoteAudio)
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantAddedAudioTrack", event)
            }

            override fun onAudioTrackUnsubscribed(participant: RemoteParticipant, publication: RemoteAudioTrackPublication, audioTrack: RemoteAudioTrack) {
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantRemovedAudioTrack", event)
            }

            override fun onAudioTrackSubscriptionFailed(participant: RemoteParticipant, publication: RemoteAudioTrackPublication, twilioException: TwilioException) {}
            override fun onAudioTrackPublished(participant: RemoteParticipant, publication: RemoteAudioTrackPublication) {}
            override fun onAudioTrackUnpublished(participant: RemoteParticipant, publication: RemoteAudioTrackPublication) {}
            override fun onDataTrackSubscribed(remoteParticipant: RemoteParticipant, remoteDataTrackPublication: RemoteDataTrackPublication, remoteDataTrack: RemoteDataTrack) {
                val event = buildParticipantDataEvent(remoteParticipant, remoteDataTrackPublication)
                sendJavascriptEvent("participantAddedDataTrack", event)
                dataTrackMessageThreadHandler.post { addRemoteDataTrack(remoteParticipant, remoteDataTrack) }
            }

            override fun onDataTrackUnsubscribed(remoteParticipant: RemoteParticipant, remoteDataTrackPublication: RemoteDataTrackPublication, remoteDataTrack: RemoteDataTrack) {
                val event = buildParticipantDataEvent(remoteParticipant, remoteDataTrackPublication)
                sendJavascriptEvent("participantRemovedDataTrack", event)
            }

            override fun onDataTrackSubscriptionFailed(participant: RemoteParticipant, publication: RemoteDataTrackPublication, twilioException: TwilioException) {}
            override fun onDataTrackPublished(participant: RemoteParticipant, publication: RemoteDataTrackPublication) {}
            override fun onDataTrackUnpublished(participant: RemoteParticipant, publication: RemoteDataTrackPublication) {}
            override fun onVideoTrackSubscribed(participant: RemoteParticipant, publication: RemoteVideoTrackPublication, videoTrack: RemoteVideoTrack) {
                addParticipantVideo(participant, publication)
            }

            override fun onVideoTrackUnsubscribed(participant: RemoteParticipant, publication: RemoteVideoTrackPublication, videoTrack: RemoteVideoTrack) {
                removeParticipantVideo(participant, publication)
            }

            override fun onVideoTrackSubscriptionFailed(participant: RemoteParticipant, publication: RemoteVideoTrackPublication, twilioException: TwilioException) {}
            override fun onVideoTrackPublished(participant: RemoteParticipant, publication: RemoteVideoTrackPublication) {}
            override fun onVideoTrackUnpublished(participant: RemoteParticipant, publication: RemoteVideoTrackPublication) {}
            override fun onAudioTrackEnabled(participant: RemoteParticipant, publication: RemoteAudioTrackPublication) {
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantEnabledAudioTrack", event)
            }

            override fun onAudioTrackDisabled(participant: RemoteParticipant, publication: RemoteAudioTrackPublication) {
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantDisabledAudioTrack", event)
            }

            override fun onVideoTrackEnabled(participant: RemoteParticipant, publication: RemoteVideoTrackPublication) {
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantEnabledVideoTrack", event)
            }

            override fun onVideoTrackDisabled(participant: RemoteParticipant, publication: RemoteVideoTrackPublication) {
                val event = buildParticipantVideoEvent(participant, publication)
                sendJavascriptEvent("participantDisabledVideoTrack", event)
            }

            override fun onNetworkQualityLevelChanged(remoteParticipant: RemoteParticipant, networkQualityLevel: NetworkQualityLevel) {
                val event = WritableNativeMap()
                event.putMap("participant", buildParticipant(remoteParticipant))
                event.putBoolean("isLocalUser", false)

                // The Twilio SDK defines Enum 0 as UNKNOWN and 1 as Quality ZERO, so subtract one to get the correct quality level as an integer
                event.putInt("quality", networkQualityLevel.ordinal - 1)
                sendJavascriptEvent("networkQualityLevelsChanged", event)
            }
        }
    }

    // ====== LOCAL LISTENER =======================================================================
    private fun localListener(): LocalParticipant.Listener? {
        return object : LocalParticipant.Listener {
            override fun onAudioTrackPublished(localParticipant: LocalParticipant, localAudioTrackPublication: LocalAudioTrackPublication) {}
            override fun onAudioTrackPublicationFailed(localParticipant: LocalParticipant, localAudioTrack: LocalAudioTrack, twilioException: TwilioException) {}
            override fun onVideoTrackPublished(localParticipant: LocalParticipant, localVideoTrackPublication: LocalVideoTrackPublication) {}
            override fun onVideoTrackPublicationFailed(localParticipant: LocalParticipant, localVideoTrack: LocalVideoTrack, twilioException: TwilioException) {}
            override fun onDataTrackPublished(localParticipant: LocalParticipant, localDataTrackPublication: LocalDataTrackPublication) {}
            override fun onDataTrackPublicationFailed(localParticipant: LocalParticipant, localDataTrack: LocalDataTrack, twilioException: TwilioException) {}
            override fun onNetworkQualityLevelChanged(localParticipant: LocalParticipant, networkQualityLevel: NetworkQualityLevel) {
                val event = WritableNativeMap()
                event.putMap("participant", buildParticipant(localParticipant))
                event.putBoolean("isLocalUser", true)

                // Twilio SDK defines Enum 0 as UNKNOWN and 1 as Quality ZERO, so we subtract one to get the correct quality level as an integer
                event.putInt("quality", networkQualityLevel.ordinal - 1)
                sendJavascriptEvent("networkQualityLevelsChanged", event)
            }
        }
    }

    private fun buildParticipant(participant: Participant): WritableMap? {
        val participantMap: WritableMap = WritableNativeMap()
        participantMap.putString("identity", participant.identity)
        participantMap.putString("sid", participant.sid)
        participantMap.putInt("state", participant.state.ordinal)
        // Twilio SDK defines Enum 0 as UNKNOWN and 1 as Quality ZERO, so we subtract one to get the correct quality level as an integer
        participantMap.putInt("networkQualityLevel", participant.networkQualityLevel.ordinal - 1)

        val videoTrackSids = WritableNativeArray()
        participant.videoTracks.forEach {
            videoTrackSids.pushString(it.trackSid)
        }
        participantMap.putArray("videoTrackSids", videoTrackSids as ReadableArray)

        val audioTrackSids = WritableNativeArray()
        participant.audioTracks.forEach {
            audioTrackSids.pushString(it.trackSid)
        }
        participantMap.putArray("audioTrackSids", audioTrackSids as ReadableArray)

        val dataTrackSids = WritableNativeArray()
        participant.dataTracks.forEach {
            dataTrackSids.pushString(it.trackSid)
        }
        participantMap.putArray("dataTrackSids", dataTrackSids as ReadableArray)

        return participantMap
    }

    private fun buildTrack(publication: TrackPublication): WritableMap {
        val trackMap: WritableMap = WritableNativeMap()
        trackMap.putString("trackSid", publication.trackSid)
        trackMap.putString("trackName", publication.trackName)
        trackMap.putBoolean("enabled", publication.isTrackEnabled)
        return trackMap
    }

    private fun buildParticipantDataEvent(participant: Participant, publication: TrackPublication): WritableNativeMap {
        val participantMap = buildParticipant(participant)
        val trackMap = buildTrack(publication)
        val event = WritableNativeMap()
        event.putMap("participant", participantMap)
        event.putMap("track", trackMap)
        return event
    }

    private fun buildParticipantVideoEvent(participant: Participant, publication: TrackPublication): WritableNativeMap {
        val participantMap = buildParticipant(participant)
        val trackMap = buildTrack(publication)
        val event = WritableNativeMap()
        event.putMap("participant", participantMap)
        event.putMap("track", trackMap)
        return event
    }

    private fun buildDataTrackEvent(remoteDataTrack: RemoteDataTrack, message: String): WritableNativeMap {
        val event = WritableNativeMap()
        event.putString("message", message)
        event.putString("trackSid", remoteDataTrack.sid)
        return event
    }

    private fun addParticipantVideo(participant: Participant, publication: RemoteVideoTrackPublication) {
        val event = buildParticipantVideoEvent(participant, publication)
        sendJavascriptEvent("participantAddedVideoTrack", event)
    }

    private fun removeParticipantVideo(participant: Participant, deleteVideoTrack: RemoteVideoTrackPublication) {
        val event = buildParticipantVideoEvent(participant, deleteVideoTrack)
        sendJavascriptEvent("participantRemovedVideoTrack", event)
    }

    // ===== EVENTS TO RN ==========================================================================

    private fun remoteDataTrackListener(): RemoteDataTrack.Listener? {
        return object : RemoteDataTrack.Listener {
            override fun onMessage(remoteDataTrack: RemoteDataTrack, byteBuffer: ByteBuffer) {}
            override fun onMessage(remoteDataTrack: RemoteDataTrack, message: String) {
                val event = buildDataTrackEvent(remoteDataTrack, message)
                sendJavascriptEvent("dataTrackMessageReceived", event)
            }
        }
    }

    fun changeListenerStatus(value: Boolean) {
    }

    fun setRemoteAudioPlayback(participantSid: String, enabled: Boolean) {
        room?.let { room ->
            for (rp in room.remoteParticipants) {
                if (rp.sid != participantSid) {
                    continue
                }

                for (at in rp.audioTracks) {
                    if (at.audioTrack != null) {
                        (at.audioTrack as? RemoteAudioTrack)?.enablePlayback(enabled)
                    }
                }
            }
        }
    }

    fun prepareLocalMedia() {
        // NOTE: on android, nothing needs to be done in here because the custom AudioDevice is injected
        // in the constructor of BarzTwilioVideo!
    }

    fun playMusic() {
        fileAndMicAudioDevice!!.playMusic()
    }

    fun stopMusic() {
        fileAndMicAudioDevice!!.stopMusic()
    }

    fun pauseMusic() {
        fileAndMicAudioDevice!!.pauseMusic()
    }

    fun resumeMusic() {
        fileAndMicAudioDevice!!.resumeMusic()
    }

    fun downloadMusicFromURLAndMakeActive(url: URL, callback: (Error?, String, Boolean) -> Unit) {
        fileAndMicAudioDevice!!.downloadAndCacheAudioFile(url, callback)
    }

    fun removeCachedMusicForURL(url: URL) {
        fileAndMicAudioDevice!!.removeCachedMusicForURL(url)
    }

    fun setMusicVolume(volume: Float) {
        fileAndMicAudioDevice!!.setMusicVolume(volume)
    }

    fun requestMediaPermissions(callback: (Error?, Boolean) -> Unit) {
        if (requestMediaPermissionsCallback != null) {
            return
        }

        var needsMicrophonePermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
        ) != PackageManager.PERMISSION_GRANTED
        var needsCameraPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
        ) != PackageManager.PERMISSION_GRANTED

        var permissionArray = mutableListOf<String>()
        if (needsCameraPermission) {
            permissionArray.add(Manifest.permission.CAMERA)
        }
        if (needsMicrophonePermission) {
            permissionArray.add(Manifest.permission.RECORD_AUDIO)
        }

        // Already have permissions for both camera and microphone? Bail out early!
        if (permissionArray.size == 0) {
            callback(null, true)
            return
        }

        requestMediaPermissionsCallback = callback

        // Request permissions
        ActivityCompat.requestPermissions(
            appContext.currentActivity!!,
            permissionArray.toTypedArray(),
            100
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestMediaPermissionsCallback == null) {
            return
        }

        when (requestCode) {
            0 -> {
                // Check if the user granted all permissions
                if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                    requestMediaPermissionsCallback!!(null, true)
                } else {
                    // Permission has been denied
                    // Handle the error gracefully
                    requestMediaPermissionsCallback!!(Error("Permissions were not granted"), true)
                }
                return
            }
        }
    }

    fun startLocalVideo(onCameraSuccess: (() -> Unit)? = null, onCameraError: ((error: String) -> Unit)? = null) {
        if (cameraCapturer == null) {
            val createVideoStatus = createLocalVideo(true, FRONT_CAMERA_TYPE, onCameraSuccess, onCameraError)
            if (!createVideoStatus) {
                Log.d(TAG, "Failed to create local video")
                // No need to connect to room if video creation failed
                return
            }
        }
    }

    fun stopLocalVideo() {
        localVideoTrack?.release()
        localVideoTrack = null
    }

    fun startLocalAudio() {
        // Check to make sure that microphone permissions have been granted
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            // Permission is not granted
            Log.d("checkAudioPermissions", "No Audio Recording Permissions")
            ActivityCompat.requestPermissions(appContext.currentActivity!!, arrayOf<String>(Manifest.permission.RECORD_AUDIO),
                    100)
        }

        // Share your microphone
        localAudioTrack = LocalAudioTrack.create(context, true)
        setAudioFocus(true)

        // Once the audio is initialized, send an event to inform that the microphone
        // is no longer muted
        val event = WritableNativeMap()
        event.putBoolean("audioEnabled", localAudioTrack!!.isEnabled)
        sendJavascriptEvent("audioChanged", event)
    }

    fun stopLocalAudio() {
        localAudioTrack?.release()
        localAudioTrack = null
    }

    fun publishLocalVideo() {
        if (localParticipant != null && localVideoTrack != null) {
            localParticipant!!.publishTrack(localVideoTrack!!)
        }
    }

    fun publishLocalAudio() {
        if (localParticipant != null && localAudioTrack != null) {
            localParticipant!!.publishTrack(localAudioTrack!!)
        }
    }

    fun publishLocalData() {
        if (localParticipant != null && localDataTrack != null) {
            localParticipant!!.publishTrack(localDataTrack!!)
        }
    }

    fun unpublishLocalVideo() {
        if (localParticipant != null && localVideoTrack != null) {
            localParticipant!!.unpublishTrack(localVideoTrack!!)
        }
    }

    fun unpublishLocalAudio() {
        if (localParticipant != null && localAudioTrack != null) {
            localParticipant!!.unpublishTrack(localAudioTrack!!)
        }
    }

    fun unpublishLocalData() {
        if (localParticipant != null && localDataTrack != null) {
            localParticipant!!.unpublishTrack(localDataTrack!!)
        }
    }

    fun setLocalAudioEnabled(enabled: Boolean) {
        if (localAudioTrack != null) {
            localAudioTrack!!.enable(enabled)

            val event = WritableNativeMap()
            event.putBoolean("audioEnabled", enabled)
            sendJavascriptEvent("audioChanged", event)
        }
    }

    fun setLocalVideoEnabled(
        enabled: Boolean,
        cameraType: String,
        onCameraSuccess: (() -> Unit)? = null,
        onCameraError: ((error: String) -> Unit)? = null
    ) {
        if (localVideoTrack == null) {
            return
        }
        // localVideoTrack!!.enable(enabled)

        if (cameraCapturer == null) {
            return
        }

        stopLocalVideo()
        if (enabled) {
            createLocalVideo(true, cameraType, onCameraSuccess, onCameraError)
        }

        val event = WritableNativeMap()
        event.putBoolean("videoEnabled", enabled)
        sendJavascriptEvent("videoChanged", event)
    }

    fun toggleScreenSharing(value: Boolean) {
    }

}

class BarzTwilioVideoModule : Module() {
    private var twilioVideo: BarzTwilioVideo? = null

    // NOTE: This is sort of a weird way to initialize the BarzTwilioVideo class. It has to be done
    // this way because when this BarzTwilioVideoModule is constructed, `appContext.reactContext` is
    // still being set up and any attempts to use it will result in a crash or null pointer
    // exception.
    private fun initializeAndReturnBarzTwilioVideo(): BarzTwilioVideo {
        if (this.twilioVideo == null) {
            this.twilioVideo = BarzTwilioVideo(appContext)
        }

        // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
        // can emit events later
        //
        // There is probably a better way to do this, but I want to make sure that sendEvent is
        // always set before anything is called on twiliovideo
        this.twilioVideo!!.setSendEvent { name, body ->
            sendEvent(name, body.toHashMap().toMap())
        }

        return this.twilioVideo!!
    }

    fun resetFileModificationTime(filePathURL: String) {
        // Convert the file URL to a Uri
        val uri = Uri.parse(filePathURL)

        val filePath = uri.path
        val file = File(filePath)

        if (!file.exists()) {
            Log.d("resetFileModificationTime", "Reset modification date of $filePathURL FAILED - file did not exist!")
            return
        }
        // Replace with your desired timestamp in milliseconds
        val newTimestamp = System.currentTimeMillis()

        // Set the new modification timestamp
        if (file.setLastModified(newTimestamp)) {
            Log.d("resetFileModificationTime", "Reset modification date of $filePathURL to ${file.lastModified()}")
        } else {
            Log.d("resetFileModificationTime", "Reset modification date of $filePathURL FAILED!")
        }
    }

    // Each module class must implement the definition function. The definition consists of components
    // that describes the module's functionality and behavior.
    // See https://docs.expo.dev/modules/module-api for more details about available components.
    override fun definition() = ModuleDefinition {
        // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
        // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
        // The module will be accessible from `requireNativeModule('BarzTwilioVideo')` in JavaScript.
        Name("BarzTwilioVideo")

        Events(
          // CUSTOM ANDROID AND IOS EVENTS
          // NOTE: All events in the below list are implemented by both the android and ios native code.
          "roomDidConnect",
          "roomDidDisconnect",
          "roomDidFailToConnect",
          "roomParticipantDidConnect",
          "roomParticipantDidDisconnect",
          "participantAddedVideoTrack",
          "participantRemovedVideoTrack",
          "participantAddedDataTrack",
          "participantRemovedDataTrack",
          "participantAddedAudioTrack",
          "participantRemovedAudioTrack",
          "participantEnabledVideoTrack",
          "participantDisabledVideoTrack",
          "participantEnabledAudioTrack",
          "participantDisabledAudioTrack",
          "dataTrackMessageReceived",
          "statsReceived",
          "networkQualityLevelsChanged",
          "dominantSpeakerDidChange",
          "videoChanged",
          "audioChanged",

          // CUSTOM ANDROID EVENTS:
          // NOTE - these events are ONLY implemented in the android code!
          "cameraSwitched",
          "localParticipantSupportedCodecs",

          // CUSTOM IOS EVENTS:
          // NOTE - None of these are supported by this code.
          // If you add support for one, move it up to the main section!
          // "cameraDidStopRunning",
          // "cameraDidStart",
          // "cameraWasInterrupted",
          // "cameraInterruptionEnded",
        )


        Function("resetFileModificationTime") { filePathURLAsString: String ->
            resetFileModificationTime(filePathURLAsString)
        }

        Function("connect") {
            accessToken: String,
            roomName: String,
            enableAudio: Boolean,
            enableVideo: Boolean,
            enableH264Codec: Boolean,
            // audioBitrate: Int,
            // videoBitrate: Int,
            enableNetworkQualityReporting: Boolean,
            dominantSpeakerEnabled: Boolean,
            cameraType: String
        ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()

            twilioVideo.connect(
                accessToken = accessToken,
                roomName = roomName,
                enableAudio = enableAudio,
                enableVideo = enableVideo,
                enableH264Codec = enableH264Codec,
                audioBitrate = null,
                videoBitrate = null,
                enableNetworkQualityReporting = enableNetworkQualityReporting,
                dominantSpeakerEnabled = dominantSpeakerEnabled,
                cameraType = cameraType
            )
        }

        Function("changeListenerStatus") { value: Boolean ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.changeListenerStatus(value = value)
        }

        Function("setRemoteAudioPlayback") { participantSid: String, enabled: Boolean ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.setRemoteAudioPlayback(participantSid = participantSid, enabled = enabled)
        }

        Function("prepareLocalMedia") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.prepareLocalMedia()
        }

        Function("playMusic") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.playMusic()
        }

        Function("stopMusic") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.stopMusic()
        }

        Function("pauseMusic") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.pauseMusic()
        }

        Function("resumeMusic") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.resumeMusic()
        }

        AsyncFunction("downloadMusicFromURLAndMakeActive") { urlAsString: String, promise: Promise ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.downloadMusicFromURLAndMakeActive(URL(urlAsString)) { error, url, cacheHit ->
                promise.resolve(mapOf(
                    "error" to error,
                    "fileUrl" to url,
                    "cacheHit" to cacheHit
                ))
            }
        }

        Function("removeCachedMusicForURL") { urlAsString: String ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.removeCachedMusicForURL(URL(urlAsString))
        }

        Function("setMusicVolume") { volume: Float ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.setMusicVolume(volume)
        }

        AsyncFunction("requestMediaPermissions") { promise: Promise ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.requestMediaPermissions() { error, success ->
                promise.resolve(mapOf(
                        "error" to error,
                        "success" to success,
                ))
            }
        }

        AsyncFunction("startLocalVideo") { promise: Promise ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.startLocalVideo(
                onCameraSuccess = { ->
                    promise.resolve(mapOf(
                            "success" to true,
                            "error" to null
                    ))
                },
                onCameraError = { error: String ->
                    promise.resolve(mapOf(
                            "success" to false,
                            "error" to error
                    ))
                },
            )
        }

        AsyncFunction("startLocalAudio") { promise: Promise ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.startLocalAudio()
            promise.resolve(mapOf(
                "success" to true,
                "error" to null
            ))
        }

        Function("stopLocalVideo") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.stopLocalVideo()
        }

        Function("stopLocalAudio") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.stopLocalAudio()
        }

        Function("publishLocalVideo") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.publishLocalVideo()
        }

        Function("publishLocalAudio") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.publishLocalAudio()
        }

        Function("publishLocalData") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.publishLocalData()
        }

        Function("unpublishLocalVideo") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.unpublishLocalVideo()
        }

        Function("unpublishLocalAudio") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.unpublishLocalAudio()
        }

        Function("unpublishLocalData") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.unpublishLocalData()
        }

        Function("setLocalAudioEnabled") { enabled: Boolean ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.setLocalAudioEnabled(enabled = enabled)
        }

        // set a default for setting local video enabled
        Function("setLocalVideoEnabled") { enabled: Boolean, cameraType: String ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.setLocalVideoEnabled(enabled = enabled, cameraType = cameraType)
        }

        Function("flipCamera") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.flipCamera()
        }

        Function("toggleScreenSharing") { value: Boolean ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.toggleScreenSharing(value = value)
        }

        Function("toggleSoundSetup") { speaker: Boolean ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.toggleSoundSetup(speaker = speaker)
        }

        Function("getStats") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.getStats()
        }

        Function("sendString") { message: String ->
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.sendString(message = message)
        }

        Function("isConnected") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            return@Function twilioVideo.isConnected()
        }

        Function("disconnect") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.disconnect()
        }

        Function("releaseResources") {
            var twilioVideo = initializeAndReturnBarzTwilioVideo()
            twilioVideo.releaseResource()
        }

        // When used as a view, this class can be used to render local or remote participant video data.
        View(BarzTwilioVideoLocalOrRemoteParticipantVideoView::class) {
            Prop("scalesType") { view: BarzTwilioVideoLocalOrRemoteParticipantVideoView, scaleType: Int ->
                if (scaleType == 1) {
                    view.scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FIT
                } else {
                    view.scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FILL
                }
            }
            Prop("local") { view: BarzTwilioVideoLocalOrRemoteParticipantVideoView, local: Boolean ->
                view.isLocal = local
                view.syncSubView()
            }
            Prop("remoteParticipantSid") { view: BarzTwilioVideoLocalOrRemoteParticipantVideoView, remoteParticipantSid: String? ->
                view.remoteParticipantSid = remoteParticipantSid
                view.syncSubView()
            }
            Prop("remoteParticipantTrackSid") { view: BarzTwilioVideoLocalOrRemoteParticipantVideoView, remoteParticipantTrackSid: String? ->
                view.remoteParticipantTrackSid = remoteParticipantTrackSid
                view.syncSubView()
            }
            Prop("enabled") { view: BarzTwilioVideoLocalOrRemoteParticipantVideoView, enabled: Boolean ->
                view.isSubviewEnabled = enabled
                view.syncSubView()
            }
        }
    }
}

class BarzTwilioVideoLocalOrRemoteParticipantVideoView(
        context: Context,
        appContext: AppContext,
) : ExpoView(context, appContext) {
    var surfaceViewRenderer: PatchedVideoView? = null
    private var videoWidth = 0
    private var videoHeight = 0
    private val layoutSync = Any()
    var scalingType = RendererCommon.ScalingType.SCALE_ASPECT_FILL

    var isSubviewEnabled = false

    var isLocal: Boolean? = null
    var remoteParticipantSid: String? = null
    var remoteParticipantTrackSid: String? = null

    var previousIsLocal: Boolean? = null
    var previousRemoteParticipantSid: String? = null
    var previousRemoteParticipantTrackSid: String? = null

    init {
        surfaceViewRenderer = PatchedVideoView(appContext.reactContext!!)
        surfaceViewRenderer!!.videoScaleType = VideoScaleType.ASPECT_FILL
        addView(surfaceViewRenderer)

        surfaceViewRenderer!!.setListener(
            object : RendererCommon.RendererEvents {
                override fun onFirstFrameRendered() {}
                override fun onFrameResolutionChanged(vw: Int, vh: Int, rotation: Int) {
                    synchronized(layoutSync) {
                        if (rotation == 90 || rotation == 270) {
                            videoHeight = vw
                            videoWidth = vh
                        } else {
                            videoHeight = vh
                            videoWidth = vw
                        }
                        forceLayout()
                    }
                }
            }
        )

        // LOCAL:
//        BarzTwilioVideo.registerThumbnailVideoView(surfaceViewRenderer!!)

        // REMOTE:
        // BarzTwilioVideo.registerPrimaryVideoView(surfaceViewRenderer!!, trackSid);
        this.syncSubView()
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        var l = l
        var t = t
        var r = r
        var b = b
        val height = b - t
        val width = r - l
        if (height == 0 || width == 0) {
            b = 0
            r = b
            t = r
            l = t
        } else {
            var videoHeight: Int
            var videoWidth: Int
            synchronized(layoutSync) {
                videoHeight = this.videoHeight
                videoWidth = this.videoWidth
            }
            if (videoHeight == 0 || videoWidth == 0) {
                // These are Twilio defaults.
                videoHeight = 480
                videoWidth = 640
            }
            val displaySize = RendererCommon.getDisplaySize(
                    scalingType,
                    videoWidth / videoHeight.toFloat(),
                    width,
                    height
            )
            l = (width - displaySize.x) / 2
            t = (height - displaySize.y) / 2
            r = l + displaySize.x
            b = t + displaySize.y
        }
        surfaceViewRenderer!!.layout(l, t, r, b)
    }

    fun syncSubView() {
//        var twilioVideo = appContext.legacyModuleRegistry.getExportedModule(
//                "Twiliovideo"
//        ) as BarzTwilioVideo?
//        if (twilioVideo == null) {
//            return
//        }
        Log.d("DEBUGVIEW", "TOP")
        if (this.surfaceViewRenderer == null) {
            Log.d("DEBUGVIEW", "surfaceViewRenderer not set!")
            return
        }
        Log.d("DEBUGVIEW", "HERE")

        // Unassign the old view
        if (this.previousIsLocal == true) {
            BarzTwilioVideo.unregisterThumbnailVideoView(this.surfaceViewRenderer!!)
        } else if (this.previousIsLocal == false && this.previousRemoteParticipantSid != null && this.previousRemoteParticipantTrackSid != null) {
            BarzTwilioVideo.unregisterPrimaryVideoView(surfaceViewRenderer!!, this.previousRemoteParticipantTrackSid!!)
        }

        // Reassign the new view
        if (this.isLocal == true) {
            this.previousIsLocal = true
            if (this.isSubviewEnabled) {
                BarzTwilioVideo.registerThumbnailVideoView(this.surfaceViewRenderer!!)
            } else {
                BarzTwilioVideo.unregisterThumbnailVideoView(this.surfaceViewRenderer!!)
            }
        } else if (this.isLocal == false) {
            this.previousIsLocal = false
            this.previousRemoteParticipantSid = this.remoteParticipantSid
            this.previousRemoteParticipantTrackSid = this.remoteParticipantTrackSid

            if (this.remoteParticipantSid == null) {
                Log.i("BarzTwilioVideoLocalOrRemoteParticipantVideoView", "Failure creating/removing remote participant view: remoteParticipantSid is null")
                return
            }
            if (this.remoteParticipantTrackSid == null) {
                Log.i("BarzTwilioVideoLocalOrRemoteParticipantVideoView", "Failure creating/removing remote participant view: remoteParticipantTrackSid is null")
                return
            }

            if (this.isSubviewEnabled) {
                BarzTwilioVideo.registerPrimaryVideoView(surfaceViewRenderer!!, this.previousRemoteParticipantTrackSid!!)
            } else {
                BarzTwilioVideo.unregisterPrimaryVideoView(surfaceViewRenderer!!, this.previousRemoteParticipantTrackSid!!)
            }
        }
    }

    fun applyZOrder(applyZOrder: Boolean) {
        this.surfaceViewRenderer?.applyZOrder(applyZOrder)
    }
}










class FileAndMicAudioDevice(private val context: Context) : AudioDevice {
    // Average number of callbacks per second.
    private val BUFFERS_PER_SECOND = 1000 / CALLBACK_BUFFER_SIZE_MS
    private var writeBufferSize = 0

    private var playbackDataInputStream: DataInputStream? = null
    private var playbackInputStream: InputStream? = null
    private lateinit var readByteBuffer: ByteBuffer
    private lateinit var filePlaybackWriteByteBuffer: ByteBuffer
    private lateinit var mixedPlaybackByteBuffer: ByteBuffer
    private lateinit var audioTrack: AudioTrack

    private var captureDataInputStream: DataInputStream? = null
    private var captureInputStream: InputStream? = null
    private lateinit var micWriteBuffer: ByteBuffer
    private lateinit var fileCaptureWriteByteBuffer: ByteBuffer
    private lateinit var mixedCaptureByteBuffer: ByteBuffer
    private lateinit var audioRecord: AudioRecord

    // Handlers and Threads
    private lateinit var capturerHandler: Handler
    private lateinit var capturerThread: HandlerThread
    private lateinit var rendererHandler: Handler
    private lateinit var rendererThread: HandlerThread
    private lateinit var renderingAudioDeviceContext: AudioDeviceContext
    private lateinit var capturingAudioDeviceContext: AudioDeviceContext

    // By default music capturer is enabled
    var isMusicPlaying = false
        private set

    private var activeMusicFileUrl: File? = null
    private var activeMusicVolumeMultiplier: Float = 1.0F

    // This runnable handles sending audio FROM the microphone and any music files (mixing them in
    // memory) INTO TwilioVideo's audio capture interface.
    private val microphoneAndFileCaptureRunnable = object : Runnable {
        override fun run() {
            Log.d("DEBUGGING", "microphoneAndFileCaptureRunnable invoked!")
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)

            // Make sure the microphone is initialized
            if (audioRecord.state != AudioRecord.STATE_UNINITIALIZED) {
                audioRecord.startRecording()
            }

            while (true) {
                var shouldMixInAudioFile = this@FileAndMicAudioDevice.isMusicPlaying

                val microphoneBytesRead = audioRecord.read(micWriteBuffer, micWriteBuffer.capacity())

                var finalBytesBuffer: ByteBuffer
                if (shouldMixInAudioFile) {
                    if (captureInputStream != null) {
                        var audioFileBytesRead: Int
                        try {
                            audioFileBytesRead = captureDataInputStream!!.read(fileCaptureWriteByteBuffer.array(), 0, microphoneBytesRead)
                        } catch (e: IllegalStateException) {
                            Log.d(TAG, "Error reading captureDataInputStream: $e")
                            e.printStackTrace()
                            return
                        }
                        // Log.d(TAG, "READ! audioFileBytesRead:$audioFileBytesRead microphoneBytesRead:$microphoneBytesRead micPos:${micWriteBuffer.position()} filePos:${fileCaptureWriteByteBuffer.position()}")

                        // Mix all bytes from the mic and audio file buffer by adding their values
                        micWriteBuffer.rewind()
                        fileCaptureWriteByteBuffer.rewind()
                        mixedCaptureByteBuffer.clear()
                        while (micWriteBuffer.hasRemaining() || fileCaptureWriteByteBuffer.hasRemaining()) {
                            val micWriteBufferSample = if (micWriteBuffer.hasRemaining()) micWriteBuffer.short else 0
                            val fileWriteBufferSample = if (fileCaptureWriteByteBuffer.hasRemaining()) fileCaptureWriteByteBuffer.short else 0
//                            val multipliedFileWriteBufferSample = (fileWriteBufferSample * activeMusicVolumeMultiplier).toUInt().toShort()
                            val mixedSample = (micWriteBufferSample + fileWriteBufferSample).toShort()
                            mixedCaptureByteBuffer.putShort(mixedSample)
                        }
                        mixedCaptureByteBuffer.rewind()
                        finalBytesBuffer = mixedCaptureByteBuffer
                    } else {
                        Log.d(TAG, "captureInputStream is null, so cannot mix in audio into capture stream!")
                        continue
                    }
                } else {
                    finalBytesBuffer = micWriteBuffer
                }

                AudioDevice.audioDeviceWriteCaptureData(capturingAudioDeviceContext, finalBytesBuffer)
            }
        }
    }

    // This runnable handles sending audio FROM TwilioVideo's audio render interface and any music
    // files (mixing them in memory) INTO `audioTrack`, which is set to play as soon as data lands
    // in its internal buffer.
    private val speakerPlaybackRendererRunnable = object : Runnable {
        override fun run() {
            // Log.d(TAG, "speakerPlaybackRendererRunnable invoked! - state ${audioTrack!!.getState()}, playState - ${audioTrack!!.getPlayState()}")

            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)

            while (true) {
                var shouldMixInAudioFile = this@FileAndMicAudioDevice.isMusicPlaying

                // Get 10ms of PCM data from the SDK. Audio data is written into the ByteBuffer provided.
                AudioDevice.audioDeviceReadRenderData(renderingAudioDeviceContext, readByteBuffer)

                var finalBytesBuffer: ByteBuffer
                if (shouldMixInAudioFile) {
                    if (playbackDataInputStream != null) {
                        var audioFileBytesRead = playbackDataInputStream!!.read(filePlaybackWriteByteBuffer.array(), 0, readByteBuffer.capacity())
                        // Log.d(TAG, "READ FROM SPEAKER! audioFileBytesRead:$audioFileBytesRead micPos:${micWriteBuffer.position()} filePos:${filePlaybackWriteByteBuffer.position()}")

                        // Mix all bytes from the speaker and audio file buffer by adding their values
                        readByteBuffer.rewind()
                        filePlaybackWriteByteBuffer.rewind()
                        mixedPlaybackByteBuffer.clear()
                        while (readByteBuffer.hasRemaining() || filePlaybackWriteByteBuffer.hasRemaining()) {
                            val readBufferSample = if (readByteBuffer.hasRemaining()) readByteBuffer.short else 0
                            val filePlaybackBufferSample = if (filePlaybackWriteByteBuffer.hasRemaining()) filePlaybackWriteByteBuffer.short else 0
//                            val multipliedFilePlaybackBufferSample = (filePlaybackBufferSample * activeMusicVolumeMultiplier).toUInt().toShort()
                            val mixedSample = (readBufferSample + filePlaybackBufferSample).toShort()
                            mixedPlaybackByteBuffer.putShort(mixedSample)
                        }
                        mixedPlaybackByteBuffer.rewind()
                        finalBytesBuffer = mixedPlaybackByteBuffer
                    } else {
                        Log.d(TAG, "captureInputStream is null, so cannot mix in audio into capture stream!")
                        continue
                    }
                } else {
                    finalBytesBuffer = readByteBuffer
                }

                var bytesWritten: Int
                try {
                    bytesWritten = audioTrack!!.write(
                            finalBytesBuffer!!,
                            finalBytesBuffer.capacity(),
                            AudioTrack.WRITE_BLOCKING,
                    )
                } catch (e: IllegalStateException) {
                    Log.d(TAG, "AudioTrack.write threw an error: $e")
                    e.printStackTrace()
                    return
                }

                if (bytesWritten != finalBytesBuffer.capacity()) {
                    Log.d(TAG, "AudioTrack.write failed: $bytesWritten state:${audioTrack!!.getState()} playState:${audioTrack!!.getPlayState()}")
                    if (bytesWritten == AudioTrack.ERROR_INVALID_OPERATION) {
                        return
                    }
                }

                // The byte buffer must be rewinded since byteBuffer.position() is increased at each
                // call to AudioTrack.write(). If we don't do this, will fail the next  AudioTrack.write().
                finalBytesBuffer.rewind()
            }
        }
    }

    // Begin playing music from the initially loaded audio file.
    // If `initAudioStream` has not been called first, this is a no-op.
    fun playMusic() {
        isMusicPlaying = true
    }

    // Stop playing music, and reset the audio stream back to the start again
    fun stopMusic() {
        isMusicPlaying = false

        // Calling this function will reinitialize the streams, starting them from the beginning again
        initializeCaptureAndPlaybackInputStreams()
    }

    fun pauseMusic() {
        isMusicPlaying = false
    }

    fun resumeMusic() {
        isMusicPlaying = true
    }

    // Initialize the audio stream to play based off of the passed audio file path
    @SuppressLint("MissingPermission")
    fun downloadAndCacheAudioFile(url: URL, callback: (Error?, String, Boolean) -> Unit) {
        val fileExtension = url.path.substringAfterLast(".")

        // Remove query parameters from the url
        // This is important to keep the url from getting too long which will hit the android
        // file name length limit
        val uriBuilder = Uri.parse(url.toString()).buildUpon()
        uriBuilder.clearQuery()
        val urlWithoutQueryParams = uriBuilder.build().toString()

        val encodedFileName = Base64.encodeToString(urlWithoutQueryParams.toString().toByteArray(), Base64.DEFAULT)
        val tempLocalFilePath = context.cacheDir.resolve("$encodedFileName.$fileExtension")
        val finalLocalFilePath = context.cacheDir.resolve("$encodedFileName.wav")

        // If this cache key already exists, then the file has been downloaded before.
        //
        // NOTE: This code assumes that the file hosted at a given url will never change - if one wants
        // a different audio file, they would need to publish it under a new url path!
        if (tempLocalFilePath.exists() && finalLocalFilePath.exists()) {
            // Read it into the capture and playback audio streams
            activeMusicFileUrl = finalLocalFilePath
            initializeCaptureAndPlaybackInputStreams()

            callback(null, "file://${tempLocalFilePath.absolutePath}", true)
            return
        }

        // Download the file to the tempfs
        val connection = url.openConnection()
        connection.connect()

        val input: InputStream = connection.getInputStream()
        val output = FileOutputStream(tempLocalFilePath)

        val buffer = ByteArray(4096)
        var length: Int
        while (input.read(buffer).also { length = it } != -1) {
            output.write(buffer, 0, length)
        }
        output.flush()
        output.close()
        input.close()

        // Convert the file from whatever the source is to be a wav file at the global bitrate
        var command = "-y -i ${tempLocalFilePath.path} -c:v mpeg4 ${finalLocalFilePath.path} -b:a $AUDIO_BITRATE"
        Log.i(TAG, "FFmpeg command: $command")

        FFmpegKit.executeAsync(command, { session ->
            Log.i(TAG, "FFmpeg process exited with state ${session.state} and rc ${session.returnCode}.${session.failStackTrace}")
            if (session.state == SessionState.COMPLETED) {
                // Read it into the capture and playback audio streams
                activeMusicFileUrl = finalLocalFilePath
                initializeCaptureAndPlaybackInputStreams()

                callback(null, "file://${tempLocalFilePath.absolutePath}", false)
            } else {
                callback(
                        Error("FFmpeg process exited with state ${session.state} and rc ${session.returnCode}.${session.failStackTrace}"),
                        "file://${tempLocalFilePath.absolutePath}",
                        false
                )
            }
        }, {
            Log.d(TAG, "FFMPEG LOG: ${it.message}")
        }) {
            Log.d(TAG, "FFMPEG STATISTICS: $it")
        }
    }


    fun removeCachedMusicForURL(url: URL) {
        val fileExtension = url.path.substringAfterLast(".")
        val encodedFileName = Base64.encodeToString(url.toString().toByteArray(), Base64.DEFAULT)
        val tempLocalFilePath = context.cacheDir.resolve("$encodedFileName.$fileExtension")
        val finalLocalFilePath = context.cacheDir.resolve("$encodedFileName.wav")

        // Force delete this cache key so that the file will have to be downloaded again
        tempLocalFilePath.delete()
        finalLocalFilePath.delete()
    }

    fun setMusicVolume(volume: Float) {
        activeMusicVolumeMultiplier = volume
    }


    // This is called after the url stored in activeMusicFileUrl changes to refresh the capture and
    // playback music streams. Note that when they are reinitialized, they start back at the
    // beginning again.
    fun initializeCaptureAndPlaybackInputStreams() {
        if (activeMusicFileUrl == null) {
            captureInputStream = null
            captureDataInputStream = null
            playbackInputStream = null
            playbackDataInputStream = null
            return
        }

        // Initialize the capturing streams
        captureInputStream = BufferedInputStream(FileInputStream(activeMusicFileUrl))
        captureDataInputStream = DataInputStream(captureInputStream)
        try {
            val bytes = captureDataInputStream!!.skipBytes(WAV_FILE_HEADER_SIZE)
            Log.d(TAG, "Number of bytes skipped : $bytes")
        } catch (e: IOException) {
            e.printStackTrace()
        }

        // Initialize the audio stream for playback
        playbackInputStream = BufferedInputStream(FileInputStream(activeMusicFileUrl))
        playbackDataInputStream = DataInputStream(playbackInputStream)
        try {
            val bytes = playbackDataInputStream!!.skipBytes(WAV_FILE_HEADER_SIZE)
            Log.d(TAG, "Number of bytes skipped : $bytes")
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    /*
     * Return the AudioFormat used the capturer. This custom device uses 48kHz sample rate and
     * STEREO channel configuration both for microphone and the music file.
     */
    override fun getCapturerFormat(): AudioFormat? {
        return AudioFormat(AUDIO_BITRATE, AudioFormat.AUDIO_SAMPLE_STEREO)
    }

    /*
     * Init the capturer using the AudioFormat return by getCapturerFormat().
     */
    @SuppressLint("MissingPermission")
    override fun onInitCapturer(): Boolean {
        // Log.d(TAG, "onInitCapturer called!")
        val bytesPerFrame = 2 * (BITS_PER_SAMPLE / 8)
        val framesPerBuffer = capturerFormat!!.sampleRate / BUFFERS_PER_SECOND
        // Calculate the minimum buffer size required for the successful creation of
        // an AudioRecord object, in byte units.
        val channelConfig = channelCountToConfiguration(capturerFormat!!.channelCount)
        val minBufferSize = AudioRecord.getMinBufferSize(capturerFormat!!.sampleRate,
                channelConfig, android.media.AudioFormat.ENCODING_PCM_16BIT)
        micWriteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)
        val tempMicWriteBuffer = micWriteBuffer
        val bufferSizeInBytes = Math.max(BUFFER_SIZE_FACTOR * minBufferSize, tempMicWriteBuffer.capacity())
        audioRecord = AudioRecord(MediaRecorder.AudioSource.MIC, capturerFormat!!.sampleRate,
                android.media.AudioFormat.CHANNEL_OUT_STEREO, android.media.AudioFormat.ENCODING_PCM_16BIT, bufferSizeInBytes)
        fileCaptureWriteByteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)
        mixedCaptureByteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)
        val testFileWriteByteBuffer = fileCaptureWriteByteBuffer
        writeBufferSize = testFileWriteByteBuffer.capacity()

        return true
    }

    override fun onStartCapturing(audioDeviceContext: AudioDeviceContext): Boolean {
        // Log.d(TAG, "onStartCapturing called!")
        // Initialize the AudioDeviceContext
        capturingAudioDeviceContext = audioDeviceContext
        // Create the capturer thread and start
        capturerThread = HandlerThread("CapturerThread")
        capturerThread.start()
        // Create the capturer handler that processes the capturer Runnables.
        capturerHandler = Handler(capturerThread.looper)
//        isMusicPlaying = true
//        capturerHandler.post(fileCapturerRunnable)
//        capturerHandler.post(microphoneCapturerRunnable)
        capturerHandler.post(microphoneAndFileCaptureRunnable)
        return true
    }

    override fun onStopCapturing(): Boolean {
        // Log.d(TAG, "onStopCapturing called!")

        Log.d(TAG, "Remove any pending posts of microphoneAndFileCaptureRunnable that are in the message queue ")
        capturerHandler.removeCallbacks(microphoneAndFileCaptureRunnable)

        try {
            captureDataInputStream?.close()
            captureInputStream?.close()
        } catch (e: IOException) {
            e.printStackTrace()
        }

        stopRecording()
        isMusicPlaying = false

        /*
         * When onStopCapturing is called, the AudioDevice API expects that at the completion
         * of the callback the capturer has completely stopped. As a result, quit the capturer
         * thread and explicitly wait for the thread to complete.
         */
        capturerThread.quit()
        if (!ThreadUtils.joinUninterruptibly(capturerThread, THREAD_JOIN_TIMEOUT_MS)) {
            Log.e(TAG, "Join of capturerThread timed out")
            return false
        }
        return true
    }

    /*
     * Return the AudioFormat used the renderer. This custom device uses 48kHz sample rate and
     * STEREO channel configuration for audio track.
     */
    override fun getRendererFormat(): AudioFormat? {
        return AudioFormat(AUDIO_BITRATE, AudioFormat.AUDIO_SAMPLE_STEREO)
    }

    override fun onInitRenderer(): Boolean {
        // Log.d(TAG, "onInitRenderer called!")
        val bytesPerFrame = rendererFormat!!.channelCount * (BITS_PER_SAMPLE / 8)
        val framesPerBuffer = capturerFormat!!.sampleRate / BUFFERS_PER_SECOND

        readByteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)
        filePlaybackWriteByteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)
        mixedPlaybackByteBuffer = ByteBuffer.allocateDirect(bytesPerFrame * framesPerBuffer)

        val channelConfig = channelCountToConfiguration(rendererFormat!!.channelCount)
        val minBufferSize = AudioRecord.getMinBufferSize(
            rendererFormat!!.sampleRate,
            channelConfig,
            android.media.AudioFormat.ENCODING_PCM_16BIT
        )

        audioTrack = AudioTrack(
            AudioManager.STREAM_VOICE_CALL,
            rendererFormat!!.sampleRate,
            channelConfig,
            android.media.AudioFormat.ENCODING_PCM_16BIT,
            minBufferSize,
            AudioTrack.MODE_STREAM,
        )

        return true
    }

    override fun onStartRendering(audioDeviceContext: AudioDeviceContext): Boolean {
        // Log.d(TAG, "onStartRendering called!")
        renderingAudioDeviceContext = audioDeviceContext

        // Start playing an audio track in the background that will be the "output" of the
        // speakerPlaybackRenderRunnable
        try {
            audioTrack.play()
        } catch (e: IllegalStateException) {
            Log.e(TAG, "AudioTrack.play failed: " + e.message)
            Log.d("DEBUGGINGS", "AudioTrack.play failed: " + e.message)
            releaseAudioResources()
            return false
        }

        // Create the renderer thread and start
        rendererThread = HandlerThread("RendererThread")
        rendererThread.start()

        // Create the capturer handler that processes the renderer Runnables.
        rendererHandler = Handler(rendererThread.looper)
        rendererHandler.post(speakerPlaybackRendererRunnable)
        return true
    }

    override fun onStopRendering(): Boolean {
        Log.d(TAG, "onStopRendering called!")

        try {
            playbackDataInputStream?.close()
            playbackInputStream?.close()
        } catch (e: IOException) {
            e.printStackTrace()
        }

        stopAudioTrack()

        // Quit the rendererThread's looper to stop processing any further messages.
        rendererThread.quit()
        /*
         * When onStopRendering is called, the AudioDevice API expects that at the completion
         * of the callback the renderer has completely stopped. As a result, quit the renderer
         * thread and explicitly wait for the thread to complete.
         */
        if (!ThreadUtils.joinUninterruptibly(rendererThread, THREAD_JOIN_TIMEOUT_MS)) {
            Log.e(TAG, "Join of rendererThread timed out")
            return false
        }
        return true
    }

    private fun stopRecording() {
        Log.d(TAG, "Remove any pending posts of microphoneAndFileCaptureRunnable that are in the message queue ")
        capturerHandler.removeCallbacks(microphoneAndFileCaptureRunnable)

        try {
            audioRecord.stop()
        } catch (e: IllegalStateException) {
            Log.e(TAG, "AudioRecord.stop failed: " + e.message)
        }
    }

    private fun channelCountToConfiguration(channels: Int): Int {
        return if (channels == 1) android.media.AudioFormat.CHANNEL_IN_MONO else android.media.AudioFormat.CHANNEL_IN_STEREO
    }

    fun stopAudioTrack() {
        Log.d(TAG, "Remove any pending posts of speakerPlaybackRendererRunnable that are in the message queue ")
        rendererHandler.removeCallbacks(speakerPlaybackRendererRunnable)

        try {
            audioTrack.stop()
        } catch (e: IllegalStateException) {
            Log.e(TAG, "AudioTrack.stop failed: " + e.message)
        }
        releaseAudioResources()
    }

    private fun releaseAudioResources() {
        audioTrack.apply {
            flush()
            release()
        }
    }

    companion object {
        private val TAG = FileAndMicAudioDevice::class.java.simpleName

        // TIMEOUT for rendererThread and capturerThread to wait for successful call to join()
        private const val THREAD_JOIN_TIMEOUT_MS: Long = 2000

        // We want to get as close to 10 msec buffers as possible because this is what the media engine prefers.
        private const val CALLBACK_BUFFER_SIZE_MS = 10

        // Default audio data format is PCM 16 bit per sample. Guaranteed to be supported by all devices.
        private const val BITS_PER_SAMPLE = 16

        // Ask for a buffer size of BUFFER_SIZE_FACTOR * (minimum required buffer size). The extra space
        // is allocated to guard against glitches under high load.
        private const val BUFFER_SIZE_FACTOR = 2
        private const val WAV_FILE_HEADER_SIZE = 44

        private const val AUDIO_BITRATE = AudioFormat.AUDIO_SAMPLE_RATE_48000
    }
}
