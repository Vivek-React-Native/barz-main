import ExpoModulesCore
import AVFoundation
import UIKit
import TwilioVideo
import Foundation

typealias SendEvent = (String, [String : Any?]) -> ()

func serializeParticipantToDictionary(_ participant: Participant) -> [String: Any?] {
    return [
        "identity": participant.identity,
        "sid": participant.sid,
        "state": participant.state,
        "networkQualityLevel": participant.networkQualityLevel,
        "videoTrackSids": participant.videoTracks.map { $0.trackSid },
        "audioTrackSids": participant.audioTracks.map { $0.trackSid },
        "dataTrackSids": participant.dataTracks.map { $0.trackSid },
    ]
}

func serializePublicationToDictionary(_ publication: TrackPublication) -> [String: Any?] {
    let track: [String: Any?]? = publication.track != nil ? [
        "isEnabled": publication.track!.isEnabled,
        "name": publication.track!.name,
        "state": publication.track!.state,
    ] : nil
    return [
        "track": track,
        "trackEnabled": publication.isTrackEnabled,
        "trackName": publication.trackName,
        "trackSid": publication.trackSid,
    ]
}

class BarzTwilioVideo: NSObject, RoomDelegate, CameraSourceDelegate, AppScreenSourceDelegate,
RemoteParticipantDelegate, LocalParticipantDelegate, RemoteDataTrackDelegate {
    var camera: CameraSource?
    var localVideoTrack: LocalVideoTrack?
    var localAudioTrack: LocalAudioTrack?
    var localDataTrack: LocalDataTrack?
    var screen: AppScreenSource?
    var localParticipant: LocalParticipant?
    var room: Room?
    var listening = false

    // If true, use Swift BarzCustomAudioDevice. If false, use ObjC BarzTwilioAudioDevice instead
    let kUseBarzCustomAudioDevice = false

    var barzAudioDevice: BarzCustomAudioDevice?
    var barzTwilioAudioDevice: BarzTwilioAudioDevice?

    var sendEvent: SendEvent?
    public func setSendEvent(sendEvent: SendEvent?) {
        self.sendEvent = sendEvent
    }

    func sendJavascriptEvent(_ name: String, _ args: [String: Any?]) {
        if self.sendEvent == nil {
            return
        }
        self.sendEvent!(name, args)
    }

    func addLocalView(view: VideoView) {
        if self.localVideoTrack != nil {
            self.localVideoTrack!.addRenderer(view)
        }
        self.updateLocalViewMirroring(view: view)
    }

    func updateLocalViewMirroring(view: VideoView) {
        if self.camera == nil {
            return
        }
        if self.camera!.device == nil {
            return
        }
        if self.camera!.device!.position == AVCaptureDevice.Position.front {
            view.shouldMirror = true
        }
    }

    func removeLocalView(view: VideoView) {
        if self.localVideoTrack != nil {
            self.localVideoTrack!.removeRenderer(view);
        }
    }

    func removeParticipantView(view: VideoView, sid: String, trackSid: String) {
        // TODO: Implement this nicely
    }

    func addParticipantView(view: VideoView, sid: String, trackSid: String) {
        // Lookup for the participant in the room
        if self.room == nil {
            return
        }
        if let participant = self.room!.getRemoteParticipant(sid: sid) {
            for publication in participant.remoteVideoTracks {
                if publication.trackSid == trackSid && publication.videoTrack != nil {
                    publication.videoTrack!.addRenderer(view)
                }
            }
        }
    }

    public func changeListenerStatus(value: Bool) {
        self.listening = value
    }

    public func setRemoteAudioPlayback(participantSid: String, enabled: Bool) {
        if self.room == nil {
            print("WARNING: when attempting to call setRemoteAudioPlayback(\(participantSid), \(enabled), room was nil - skipping...")
            return
        }
        if let participant = self.room!.getRemoteParticipant(sid: participantSid) {
            for remoteAudioTrack in participant.remoteAudioTracks {
                if remoteAudioTrack.remoteTrack == nil {
                    continue
                }
                remoteAudioTrack.remoteTrack!.isPlaybackEnabled = enabled
            }
        }
    }

    public func startLocalVideo() {
        let options = CameraSourceOptions() { builder in
        }
        camera = CameraSource(options: options, delegate: self)
        if camera != nil {
            self.localVideoTrack = LocalVideoTrack(source: camera!, enabled: false, name: "camera")
        }
    }


    func startCameraCapture(cameraType: String) {
        if self.camera == nil {
            return
        }
        var camera: AVCaptureDevice!
        if cameraType == "back" {
            camera = CameraSource.captureDevice(position: AVCaptureDevice.Position.back)
        } else {
            camera = CameraSource.captureDevice(position: AVCaptureDevice.Position.front)
        }

        self.camera!.startCapture(device: camera) { (device, startFormat, error) in
            if error != nil {
                return
            }
            if self.localVideoTrack != nil {
                return
            }

            // FIXME: the below causes a compile error because VideoRenderer cannot be passed
            // in as a VideoView
            //
            // for renderer in self.localVideoTrack!.renderers {
            //     self.updateLocalViewMirroring(view: renderer)
            // }

            self.sendJavascriptEvent("cameraDidStart", [:])
        }
    }

    public func startLocalAudio() {
        self.localAudioTrack = LocalAudioTrack(options: nil, enabled: true, name: "microphone")
        
        // Once the audio is initialized, send an event to inform that the microphone
        // is no longer muted
        self.sendJavascriptEvent("audioChanged", [
            "audioEnabled": self.localAudioTrack!.isEnabled
        ])
    }

    public func stopLocalVideo() {
        self.clearCameraInstance()
    }

    public func stopLocalAudio() {
        if self.localAudioTrack == nil {
            print("WARNING: when attempting to call stopLocalAudio(), localAudioTrack was nil - skipping...")
            return
        }
        // Disable the audio track
        self.localAudioTrack!.isEnabled = false
        
        // Remove the track from the room
        if self.room != nil && self.room!.localParticipant != nil {
            self.room!.localParticipant!.unpublishAudioTrack(self.localAudioTrack!)
        }
        
        self.localAudioTrack = nil
    }

    public func publishLocalVideo() {
        if self.room == nil {
            print("WARNING: when attempting to call publishLocalVideo(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call publishLocalVideo(), room!.localParticipant was nil - skipping...")
            return
        }
        if self.localVideoTrack == nil {
            print("WARNING: when attempting to call publishLocalVideo(), localVideoTrack was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        localParticipant.publishVideoTrack(self.localVideoTrack!)
    }

    public func publishLocalAudio() {
        if self.room == nil {
            print("WARNING: when attempting to call publishLocalAudio(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call publishLocalAudio(), room!.localParticipant was nil - skipping...")
            return
        }
        if self.localAudioTrack == nil {
            print("WARNING: when attempting to call publishLocalAudio(), localAudioTrack was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        localParticipant.publishAudioTrack(self.localAudioTrack!)
    }
    
    public func publishLocalData() {
        if self.room == nil {
            print("WARNING: when attempting to call publishLocalData(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call publishLocalData(), room!.localParticipant was nil - skipping...")
            return
        }
        if self.localDataTrack == nil {
            print("WARNING: when attempting to call publishLocalData(), localDataTrack was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        localParticipant.publishDataTrack(self.localDataTrack!)
    }

    public func unpublishLocalVideo() {
        if self.room == nil {
            print("WARNING: when attempting to call unpublishLocalVideo(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call unpublishLocalVideo(), room!.localParticipant was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        if self.localVideoTrack != nil {
            localParticipant.unpublishVideoTrack(self.localVideoTrack!)
        }
    }

    public func unpublishLocalAudio() {
        if self.room == nil {
            print("WARNING: when attempting to call unpublishLocalAudio(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call unpublishLocalAudio(), room!.localParticipant was nil - skipping...")
            return
        }
        if self.localAudioTrack == nil {
            print("WARNING: when attempting to call unpublishLocalAudio(), localAudioTrack was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        localParticipant.unpublishAudioTrack(self.localAudioTrack!)
    }
    
    public func unpublishLocalData() {
        if self.room == nil {
            print("WARNING: when attempting to call unpublishLocalData(), room was nil - skipping...")
            return
        }
        if self.room!.localParticipant == nil {
            print("WARNING: when attempting to call unpublishLocalData(), room!.localParticipant was nil - skipping...")
            return
        }
        if self.localDataTrack == nil {
            print("WARNING: when attempting to call unpublishLocalData(), localDataTrack was nil - skipping...")
            return
        }
        let localParticipant = self.room!.localParticipant!
        localParticipant.unpublishDataTrack(self.localDataTrack!)
    }

    public func setLocalAudioEnabled(enabled: Bool) {
        if self.localAudioTrack == nil {
            print("WARNING: when attempting to call setLocalAudioEnabled(\(enabled)), localAudioTrack was nil - skipping...")
            return
        }
        self.localAudioTrack!.isEnabled = enabled
        
        self.sendJavascriptEvent("audioChanged", [
            "audioEnabled": enabled
        ])
    }

    // set a default for setting local video enabled
    public func setLocalVideoEnabled(
        enabled: Bool,
        cameraType: String
    ) -> Bool {
        if self.localVideoTrack == nil {
            print("WARNING: when attempting to call setLocalVideoEnabled(\(enabled), \(cameraType)), localVideoTrack was nil - skipping...")
            return false;
        }
        self.localVideoTrack!.isEnabled = enabled

        if self.camera == nil {
            print("WARNING: when attempting to call setLocalVideoEnabled(\(enabled), \(cameraType)), camera was nil - skipping...")
            return false
        }

        if (enabled) {
            self.startCameraCapture(cameraType: cameraType)
        } else {
            self.clearCameraInstance()
        }
        
        self.sendJavascriptEvent("videoChanged", [
            "videoEnabled": enabled
        ])
        
        return enabled
    }

    public func flipCamera() {
        if self.camera != nil {
            return
        }
        if self.camera!.device != nil {
            return
        }

        let position = self.camera!.device!.position;
        let nextPosition = position == AVCaptureDevice.Position.front ? AVCaptureDevice.Position.back : AVCaptureDevice.Position.front;
        // let mirror = nextPosition == AVCaptureDevice.Position.front;

        let captureDevice = CameraSource.captureDevice(position: nextPosition)
        if captureDevice != nil {
            return
        }

        self.camera!.startCapture(device: captureDevice!) { (device, startFormat, error) in
            if self.localVideoTrack == nil {
                return;
            }

            if error != nil {
                // FIXME: the below causes a compile error because VideoRenderer cannot be passed
                // in as a VideoView
                // for renderer in self.localVideoTrack!.renderers {
                //     renderer.shouldMirror = mirror;
                // }
            }
        }
    }

    public func toggleScreenSharing(value: Bool) {
        if room != nil {
            return
        }

        if (value) {
            let options = AppScreenSourceOptions.init() { (builder) in
            }

            self.screen = AppScreenSource.init(options: options, delegate: self)
            if self.screen == nil {
                return
            }

            self.localVideoTrack = LocalVideoTrack.init(
                source: self.screen!,
                enabled: true,
                name:"screen"
            )
            if self.room != nil && self.room!.localParticipant != nil && self.localVideoTrack != nil {
                let localParticipant = self.room!.localParticipant!
                localParticipant.publishVideoTrack(self.localVideoTrack!)
            }

            self.screen!.startCapture()
        } else {
            if self.screen == nil {
                return
            }
            self.unpublishLocalVideo()
            self.screen!.stopCapture()

            self.localVideoTrack = nil
        }
    }


    public func toggleSoundSetup(speaker: Bool) {
        // Change the audio route after connecting to a Room.
        // TODO(chriseagleston): It would be better to manipulate AVAudioSession directly, this code is sketchy.
        let audioDevice = DefaultAudioDevice()

        audioDevice.block = {
            do {
                DefaultAudioDevice.DefaultAVAudioSessionConfigurationBlock()

                let audioSession = AVAudioSession.sharedInstance()
                try audioSession.setMode(speaker ? .videoChat : .voiceChat)
                // FIXME: where do I import AVAudioSessionPortOverrideNone?
                // try session.overrideOutputAudioPort(AVAudioSessionPortOverrideNone)
            } catch let error as NSError {
                print("Failure configuring twilio sound setup: \(error.localizedDescription)")
            }
        }

        TwilioVideoSDK.audioDevice = audioDevice
    }
    

    public func getStats() {
        if self.room == nil {
            return
        }

        self.room!.getStats() { (statsReports) in
            var eventBody: Dictionary<String, Dictionary<String, Any>> = [:]
            for statsReport in statsReports {
                eventBody[statsReport.peerConnectionId] = [
                    "remoteAudioTrackStats": statsReport.remoteAudioTrackStats.map({ (stats) -> Dictionary<String, Any> in
                        return [
                            "trackSid": stats.trackSid,
                            "packetsLost": stats.packetsLost,
                            "codec": stats.codec,
                            "ssrc": stats.ssrc,
                            "timestamp": stats.timestamp,
                            "bytesReceived": stats.bytesReceived,
                            "packetsReceived": stats.packetsReceived,
                            "audioLevel": stats.audioLevel,
                            "jitter": stats.jitter,
                        ]
                    }),
                    "remoteVideoTrackStats": statsReport.remoteVideoTrackStats.map({ (stats) -> Dictionary<String, Any> in
                        return [
                            "trackSid": stats.trackSid,
                            "packetsLost": stats.packetsLost,
                            "codec": stats.codec,
                            "ssrc": stats.ssrc,
                            "timestamp": stats.timestamp,
                            "bytesReceived": stats.bytesReceived,
                            "packetsReceived": stats.packetsReceived,
                            "dimensions": [ "width": stats.dimensions.width, "height": stats.dimensions.height ],
                            "frameRate": stats.frameRate,
                        ]
                    }),
                    "localAudioTrackStats": statsReport.localAudioTrackStats.map({ (stats) -> Dictionary<String, Any> in
                        return [
                            "trackSid": stats.trackSid,
                            "packetsLost": stats.packetsLost,
                            "codec": stats.codec,
                            "ssrc": stats.ssrc,
                            "timestamp": stats.timestamp,
                            "bytesSent": stats.bytesSent,
                            "packetsSent": stats.packetsSent,
                            "roundTripTime": stats.roundTripTime,
                            "audioLevel": stats.audioLevel,
                            "jitter": stats.jitter,
                        ]
                    }),
                    "localVideoTrackStats": statsReport.localVideoTrackStats.map({ (stats) -> Dictionary<String, Any> in
                        return [
                            "trackSid": stats.trackSid,
                            "packetsLost": stats.packetsLost,
                            "codec": stats.codec,
                            "ssrc": stats.ssrc,
                            "timestamp": stats.timestamp,
                            "bytesSent": stats.bytesSent,
                            "packetsSent": stats.packetsSent,
                            "roundTripTime": stats.roundTripTime,
                            "dimensions": [ "width": stats.dimensions.width, "height": stats.dimensions.height ],
                            "frameRate": stats.frameRate,
                        ]
                    }),
                ]
            }
            self.sendJavascriptEvent("statsReceived", eventBody)
        }
    }

    public func connect(
        accessToken: String,
        roomName: String,
        enableAudio: Bool,
        enableVideo: Bool,
        enableH264Codec: Bool,
        audioBitrate: UInt?,
        videoBitrate: UInt?,
        enableNetworkQualityReporting: Bool,
        dominantSpeakerEnabled: Bool,
        cameraType: String
    ) {
        let connectOptions = ConnectOptions(token: accessToken) { [self] builder in
            if let localVideoTrack {
                builder.videoTracks = [localVideoTrack]
            } else {
                print("WARNING: when calling create(...), localVideoTrack was nil - no video tracks were added to the twilio video connection!")
            }

            if let localAudioTrack {
                builder.audioTracks = [localAudioTrack]
            } else {
                print("WARNING: when calling create(...), localAudioTrack was nil - no audio tracks were added to the twilio video connection!")
            }

            localDataTrack = LocalDataTrack()

            if let localDataTrack {
                builder.dataTracks = [localDataTrack]
            }

            builder.isDominantSpeakerEnabled = dominantSpeakerEnabled ? true : false

            builder.roomName = roomName

            if enableH264Codec {
                builder.preferredVideoCodecs = [H264Codec()]
            }

            if audioBitrate != nil && videoBitrate != nil {
                builder.encodingParameters = EncodingParameters(
                    audioBitrate: (audioBitrate != 0) ? audioBitrate! : 40,
                    videoBitrate: (videoBitrate != 0) ? videoBitrate! : 1500
                )
            }

            // if enableNetworkQualityReporting {
            //     builder.networkQualityEnabled = true
            //     builder.networkQualityConfiguration = NetworkQualityConfiguration(
            //         localVerbosity: NetworkQualityVerbosityMinimal,
            //         remoteVerbosity: NetworkQualityVerbosityMinimal
            //     )
            // }
        }

        self.room = TwilioVideoSDK.connect(options: connectOptions, delegate: self)
    }

    public func sendString(message: String) {
        if self.localDataTrack == nil {
            return
        }
        self.localDataTrack!.send(message)
        //NSData *data = [message dataUsingEncoding:NSUTF8StringEncoding];
        //[self.localDataTrack sendString:message];
    }
    
    public func isConnected() -> Bool {
        return self.room != nil
    }

    public func disconnect() {
        self.clearCameraInstance()
        if self.room != nil {
            self.room!.disconnect()
        }
    }
    
    public func releaseResources() {
        // NOTE: the swift version of this code does not have any resources to clean up when the component unmounts
        // If this becomes important in the future, this is where this work can be done.
    }

    func clearCameraInstance() {
        // We are done with camera
        if self.camera != nil {
            self.camera!.stopCapture()
        }
    }


    // MARK - CameraSourceDelegate

    func cameraSourceWasInterrupted(
        source: CameraSource,
        reason: AVCaptureSession.InterruptionReason
    ) {
        var reasonStr = "unknown"
        if #available(iOS 9.0, *) {
            if (reason == AVCaptureSession.InterruptionReason.videoDeviceNotAvailableInBackground) {
                reasonStr = "video device not available in background";
            } else if (reason == AVCaptureSession.InterruptionReason.audioDeviceInUseByAnotherClient) {
                reasonStr = "audio device in use by another client";
            } else if (reason == AVCaptureSession.InterruptionReason.videoDeviceInUseByAnotherClient) {
                reasonStr = "video device in use by another client";
            } else if (reason == AVCaptureSession.InterruptionReason.videoDeviceNotAvailableWithMultipleForegroundApps) {
                reasonStr = "video device not available with multiple foreground apps";
            }
        }
        if #available(iOS 11.1, *) {
            if (reason == AVCaptureSession.InterruptionReason.videoDeviceNotAvailableDueToSystemPressure) {
                reasonStr = "video device not available due to system pressure";
            }
        }

        self.sendJavascriptEvent("cameraWasInterrupted", ["reason": reasonStr])
    }

    func cameraSourceInterruptionEnded(source: CameraSource) {
        self.sendJavascriptEvent("cameraInterruptionEnded", [:])
    }

    func cameraSourceDidFailWithError(source: CameraSource, error: NSError) {
        self.sendJavascriptEvent(
            "cameraDidStopRunning",
            [ "error": error.localizedDescription ]
        )
    }


    // MARK - RoomDelegate

    func dominantSpeakerDidChange(room: Room, participant: RemoteParticipant?) {
        self.sendJavascriptEvent("dominantSpeakerDidChange", [
            "participant": participant != nil ? serializeParticipantToDictionary(participant!) : "",
            "roomName": room.name,
            "roomSid": room.sid
        ])
    }

    func roomDidConnect(room: Room) {
        var participants = room.remoteParticipants.map({ (p) in
            p.delegate = self
            return serializeParticipantToDictionary(p)
        })

        self.localParticipant = room.localParticipant
        if self.localParticipant == nil {
            return
        }
        self.localParticipant!.delegate = self

        participants.append(serializeParticipantToDictionary(self.localParticipant!))

        self.sendJavascriptEvent("roomDidConnect", [
            "roomName": room.name,
            "roomSid": room.sid,
            "participants": participants,
            "localParticipant": serializeParticipantToDictionary(self.localParticipant!)
        ])
    }

    func roomDidDisconnect(room: Room, error: Error?) {
        self.localDataTrack = nil;
        self.room = nil;

        var body = [
            "roomName": room.name,
            "roomSid": room.sid,
            "error": nil,
        ]

        if error != nil {
            body["error"] = error!.localizedDescription
        }
        self.sendJavascriptEvent("roomDidDisconnect", body)
        
        DispatchQueue.main.async {
            self.stopMusic()
        }
    }

    func roomDidFailToConnect(room: Room, error: Error) {
        self.localDataTrack = nil
        self.room = nil

        let body = [
            "roomName": room.name,
            "roomSid": room.sid,
            "error": error.localizedDescription,
        ]

        self.sendJavascriptEvent("roomDidFailToConnect", body)
    }

    func participantDidConnect(room: Room, participant: RemoteParticipant) {
        participant.delegate = self

        self.sendJavascriptEvent("roomParticipantDidConnect", [
            "roomName": room.name,
            "roomSid": room.sid,
            "participant": serializeParticipantToDictionary(participant)
        ])
    }

    func participantDidDisconnect(room: Room, participant: RemoteParticipant) {
        self.sendJavascriptEvent("roomParticipantDidDisconnect", [
            "roomName": room.name,
            "roomSid": room.sid,
            "participant": serializeParticipantToDictionary(participant)
        ])
    }

    // MARK - RemoteParticipantDelegate

    func didSubscribeToDataTrack(
        dataTrack: RemoteDataTrack,
        publication: RemoteDataTrackPublication,
        participant: RemoteParticipant
    ) {
        dataTrack.delegate = self
        self.sendJavascriptEvent("participantAddedDataTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func didUnsubscribeFromDataTrack(
        dataTrack: RemoteDataTrack,
        publication: RemoteDataTrackPublication,
        participant: RemoteParticipant
    ) {
        self.sendJavascriptEvent("participantRemovedDataTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func didSubscribeToVideoTrack(
        videoTrack: RemoteVideoTrack,
        publication: RemoteVideoTrackPublication,
        participant: RemoteParticipant
    ) {
        self.sendJavascriptEvent("participantAddedVideoTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func didUnsubscribeFromVideoTrack(
        videoTrack: RemoteVideoTrack,
        publication: RemoteVideoTrackPublication,
        participant: RemoteParticipant
    ) {
        self.sendJavascriptEvent("participantRemovedVideoTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func didSubscribeToAudioTrack(
        audioTrack: RemoteAudioTrack,
        publication: RemoteAudioTrackPublication,
        participant: RemoteParticipant
    ) {
        self.sendJavascriptEvent("participantAddedAudioTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func didUnsubscribeFromAudioTrack(
        audioTrack: RemoteAudioTrack,
        publication: RemoteAudioTrackPublication,
        participant: RemoteParticipant
    ) {
        self.sendJavascriptEvent("participantRemovedAudioTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func remoteParticipantDidEnableVideoTrack(
        participant: RemoteParticipant,
        publication: RemoteVideoTrackPublication
    ) {
        self.sendJavascriptEvent("participantEnabledVideoTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func remoteParticipantDidDisableVideoTrack(
        participant: RemoteParticipant,
        publication: RemoteVideoTrackPublication
    ) {
        self.sendJavascriptEvent("participantDisabledVideoTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func remoteParticipantDidEnableAudioTrack(
        participant: RemoteParticipant,
        publication: RemoteAudioTrackPublication
    ) {
        print("participantEnabledAudioTrack!")
        self.sendJavascriptEvent("participantEnabledAudioTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func remoteParticipantDidDisableAudioTrack(
        participant: RemoteParticipant,
        publication: RemoteAudioTrackPublication
    ) {
        print("participantDisabledAudioTrack!")
        self.sendJavascriptEvent("participantDisabledAudioTrack", [
            "participant": serializeParticipantToDictionary(participant),
            "track": serializePublicationToDictionary(publication),
        ])
    }

    func remoteParticipantNetworkQualityLevelDidChange(
        participant: RemoteParticipant,
        networkQualityLevel: NetworkQualityLevel
    ) {
        self.sendJavascriptEvent("networkQualityLevelsChanged", [
            "participant": serializeParticipantToDictionary(participant),
            "isLocalUser": false,
            "quality": networkQualityLevel,
        ])
    }

    // MARK - TVIRemoteDataTrackDelegate
    
    func remoteDataTrackDidReceiveString(
        remoteDataTrack: RemoteDataTrack,
        message: String
    ) {
        print("DataTrack didReceiveString: \(message)");
        self.sendJavascriptEvent("dataTrackMessageReceived", [
            "message": message,
            "trackSid": remoteDataTrack.sid,
        ])
    }
    
    func remoteDataTrackDidReceiveData(remoteDataTrack: RemoteDataTrack, message: Data) {
        // TODO: Handle didReceiveData
        print("DataTrack didReceiveData: \(message)");
    }


    // MARK - TVILocalParticipantDelegate

    func localParticipantNetworkQualityLevelDidChange(
        participant localParticipant: LocalParticipant,
        networkQualityLevel: NetworkQualityLevel
    ) {
        self.sendJavascriptEvent("networkQualityLevelsChanged", [
            "participant": serializeParticipantToDictionary(localParticipant),
            "isLocalUser": true,
            "quality": networkQualityLevel,
        ])
    }
    
    public func prepareLocalMedia() {
        // I received TVIAudioDeviceMustBeSetBeforeMediaStackSetup errors when using DispatchQueue.main.async.
        // Wait for creation of the device before creating Twilio resources.
        DispatchQueue.main.sync {
            // ref: https://github.com/twilio/video-quickstart-ios/issues/226#issuecomment-804299461
            // TwilioVideoSDK.setLogLevel(.debug)
            // TwilioVideoSDK.setLogLevel(.debug, module: .core)
            // TwilioVideoSDK.setLogLevel(.debug, module: .webRTC)
            
            /*
            * A few important things to remember when using a custom AudioDevice:
            * - The device must be set before performing any other actions with the SDK (such as creating Tracks,
            *   or connecting to a Room).
            * - If this class is torn down and reconstructed, the old audioDevice instance must be used, because
            *   reassigning TwilioVideoSDK.audioDevice AFTER the objects have already been created throws an
            *   TVIAudioDeviceMustBeSetBeforeMediaStackSetup error.
            */
            let existingAudioDeviceAsCustom = TwilioVideoSDK.audioDevice
            if existingAudioDeviceAsCustom as? BarzCustomAudioDevice != nil {
                print("WARNING: reusing existing audio device BarzCustomAudioDevice instance!")
            } else if existingAudioDeviceAsCustom as? BarzTwilioAudioDevice != nil {
                print("WARNING: reusing existing audio device BarzTwilioAudioDevice instance!")
            } else if self.kUseBarzCustomAudioDevice {
                self.barzAudioDevice = BarzCustomAudioDevice()
                TwilioVideoSDK.audioDevice = self.barzAudioDevice!
            } else {
                self.barzTwilioAudioDevice = BarzTwilioAudioDevice()
                TwilioVideoSDK.audioDevice = self.barzTwilioAudioDevice!
            }
        }
    }
    
    public func playMusic() {
        if let barzDevice = self.barzAudioDevice {
            barzDevice.playMusic(continuous: true)
        } else if let exampleDevice = self.barzTwilioAudioDevice {
            exampleDevice.playMusic(true)
        }
    }
    
    public func stopMusic() {
        if let barzDevice = self.barzAudioDevice {
            barzDevice.stopMusic()
        } else {
            barzTwilioAudioDevice?.stopMusic()
        }
    }
    
    public func getMusicPlaybackPosition() -> Double? {
        if let barzDevice = self.barzAudioDevice {
            return barzDevice.getMusicPlaybackPosition()
        } else if let barzTwiloDevice = self.barzTwilioAudioDevice {
            return Double(barzTwiloDevice.musicPlaybackPosition)
        } else {
            return Double(0)
        }
    }
    
    public func pauseMusic() {
        if let barzDevice = self.barzAudioDevice {
            barzDevice.pauseMusic()
        } else {
            // TODO(chriseagleston): Is it needed to pause or just stop?
            barzTwilioAudioDevice?.stopMusic()
        }
    }
    
    public func resumeMusic() {
        if let barzDevice = self.barzAudioDevice {
            barzDevice.resumeMusic()
        } else {
            barzTwilioAudioDevice?.playMusic(true)
        }
    }
    
    public func setMusicVolume(toVolume: Float) {
        if let barzDevice = self.barzAudioDevice {
            barzDevice.setMusicVolume(toVolume: toVolume)
        } else {
            self.barzTwilioAudioDevice?.setMusicVolume(toVolume)
        }
    }
    
    public func fadeMusicVolume(duration: TimeInterval, to: Float, stepTime: Double = 0.01, completion: (() -> ())?) {
        self.barzAudioDevice?.fadeMusicVolume(duration: duration, to: to, stepTime: stepTime, completion: completion)
    }
    
    public func downloadMusicFromURLAndMakeActive(url: URL, done: @escaping (Error?, URL, Bool) -> Void) {
        downloadAndCacheAudioFile(url: url) { (error, url, cacheHit) in
            if error != nil {
                done(error, url, cacheHit)
                return
            }
            self.barzAudioDevice?.activeMusicFileURL = url
            self.barzTwilioAudioDevice?.musicUrl = url
            done(nil, url, cacheHit)
        }
    }
    
    public func removeCachedMusicForURL(url: URL) {
        removeCachedMusicForURLExternal(url: url)
    }
    
    public func requestCameraPermissions(callback: @escaping (String?, Bool) -> Void) {
        let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch cameraStatus {
        case .authorized:
            callback(nil, true)
            
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    callback(nil, false)
                } else {
                    callback("Camera access denied!", false)
                }
            }
            
        case .denied:
            callback("Camera access denied!", false)
            
        case .restricted:
            callback("Camera access restricted!", false)
            
        @unknown default:
            callback(
                "Unknown camera authorization status: \(cameraStatus)",
                false
            )
        }
    }
    
    public func requestMicrophonePermissions(callback: @escaping (String?, Bool) -> Void) {
        let microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        
        switch microphoneStatus {
        case .authorized:
            callback(nil, true)
            
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                if granted {
                    callback(nil, false)
                } else {
                    callback("Microphone access denied!", false)
                }
            }
            
        case .denied:
            callback(
                "Microphone access denied!",
                false
            )
            
        case .restricted:
            callback(
                "Microphone access restricted!",
                false
            )
            
        @unknown default:
            callback(
                "Unknown microphone authorization status: \(microphoneStatus)",
                false
            )
        }
    }
    
    public func requestMediaPermissions(callback: @escaping (String?, Bool) -> Void) {
        self.requestCameraPermissions() { (error, success) in
            if !success {
                callback(error, false)
                return
            }
            
            self.requestMicrophonePermissions(callback: callback)
        }
    }
}


public class BarzTwilioVideoModule: Module {
    let twilioVideo = BarzTwilioVideo()

    func resetFileModificationTime(_ filePathURL: URL) {
        let fileManager = FileManager.default
        do {
            let filePath = filePathURL.path
            let now = Date()
            
            // Set the new modification date for the file
            try fileManager.setAttributes([.modificationDate: now], ofItemAtPath: filePath)
            
            // Verify that the modification date has been updated
            let updatedAttributes = try fileManager.attributesOfItem(atPath: filePath)
            if let updatedModificationDate = updatedAttributes[.modificationDate] as? Date {
                // Print the updated modification date
                print("Reset modification date of \(filePathURL) to \(updatedModificationDate)")
            }
        } catch {
            print("Error running resetFileModificationTime: \(error.localizedDescription)")
        }
    }

    // Each module class must implement the definition function. The definition consists of components
    // that describes the module's functionality and behavior.
    // See https://docs.expo.dev/modules/module-api for more details about available components.
    public func definition() -> ModuleDefinition {
        // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
        // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
        // The module will be accessible from `requireNativeModule('Twiliovideo')` in JavaScript.
        Name("BarzTwilioVideo")
    
        // Defines event names that the module can send to JavaScript.

        // CUSTOM ANDROID AND IOS EVENTS
        // NOTE: All events in the below list are implemented by both the android and ios native code.
        Events("roomDidConnect")
        Events("roomDidDisconnect")
        Events("roomDidFailToConnect")
        Events("roomParticipantDidConnect")
        Events("roomParticipantDidDisconnect")
        Events("participantAddedVideoTrack")
        Events("participantRemovedVideoTrack")
        Events("participantAddedDataTrack")
        Events("participantRemovedDataTrack")
        Events("participantAddedAudioTrack")
        Events("participantRemovedAudioTrack")
        Events("participantEnabledVideoTrack")
        Events("participantDisabledVideoTrack")
        Events("participantEnabledAudioTrack")
        Events("participantDisabledAudioTrack")
        Events("dataTrackMessageReceived")
        Events("statsReceived")
        Events("networkQualityLevelsChanged")
        Events("dominantSpeakerDidChange")
        Events("videoChanged")
        Events("audioChanged")
        
        // CUSTOM IOS EVENTS:
        // NOTE - these events are ONLY implemented in the ios code!
        Events("cameraDidStopRunning")
        Events("cameraDidStart")
        Events("cameraWasInterrupted")
        Events("cameraInterruptionEnded")
    
        // CUSTOM ANDROID EVENTS:
        // NOTE - None of these are supported by this code.
        // If you add support for one, move it up to the main section!
        // Events("cameraSwitched")
        // Events("localParticipantSupportedCodecs")

        Function("resetFileModificationTime") { (filePathUrlAsString: String) in
            resetFileModificationTime(URL(string: filePathUrlAsString)!)
        }
        
        Function("connect") { (
            accessToken: String,
            roomName: String,
            enableAudio: Bool,
            enableVideo: Bool,
            enableH264Codec: Bool,
            // audioBitrate: Int,
            // videoBitrate: Int,
            enableNetworkQualityReporting: Bool,
            dominantSpeakerEnabled: Bool,
            cameraType: String
        ) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.connect(
                accessToken: accessToken,
                roomName: roomName,
                enableAudio: enableAudio,
                enableVideo: enableVideo,
                enableH264Codec: enableH264Codec,
                audioBitrate: nil,
                videoBitrate: nil,
                enableNetworkQualityReporting: enableNetworkQualityReporting,
                dominantSpeakerEnabled: dominantSpeakerEnabled,
                cameraType: cameraType
            )
        }

        Function("changeListenerStatus") { (value: Bool) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.changeListenerStatus(value: value)
        }

        Function("setRemoteAudioPlayback") { (participantSid: String, enabled: Bool) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.setRemoteAudioPlayback(participantSid: participantSid, enabled: enabled)
        }

        Function("prepareLocalMedia") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.prepareLocalMedia()
        }
        
        Function("playMusic") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.playMusic()
        }
        
        Function("stopMusic") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.stopMusic()
        }
        
        Function("pauseMusic") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.pauseMusic()
        }
        Function("getMusicPlaybackPosition") { () -> Double? in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            return twilioVideo.getMusicPlaybackPosition()
        }
        
        Function("resumeMusic") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.resumeMusic()
        }
        
        Function("setMusicVolume") { (toVolume: Float) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.setMusicVolume(toVolume: toVolume)
        }
        
        AsyncFunction("fadeMusicVolume") { (durationInSeconds: Float, to: Float, promise: Promise) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.fadeMusicVolume(duration: TimeInterval(durationInSeconds), to: to) {
                DispatchQueue.main.async {
                    promise.resolve(nil)
                }
            }
        }
        
        AsyncFunction("downloadMusicFromURLAndMakeActive") { (urlAsString: String, promise: Promise) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.downloadMusicFromURLAndMakeActive(url: URL(string: urlAsString)!) { (error, url, cacheHit) in
                DispatchQueue.main.async {
                    promise.resolve([
                        "error": error != nil ? error!.localizedDescription : nil,
                        "fileUrl": url.absoluteString,
                        "cacheHit": cacheHit,
                    ] as [String : Any])
                }
            }
        }
        
        Function("removeCachedMusicForURL") { (urlAsString: String) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.removeCachedMusicForURL(url: URL(string: urlAsString)!)
        }
        
        AsyncFunction("requestMediaPermissions") { (promise: Promise) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }
            
            twilioVideo.requestMediaPermissions() { (error, success) in
                promise.resolve([
                    "error": error as Any,
                    "success": success,
                ] as [String : Any])
            }
        }
        
        AsyncFunction("startLocalVideo") { (promise: Promise) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.startLocalVideo()
            
            promise.resolve(["success": true, "error": nil])
        }

        AsyncFunction("startLocalAudio") { (promise: Promise) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.startLocalAudio()
            
            promise.resolve(["success": true, "error": nil])
        }

        Function("stopLocalVideo") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.stopLocalVideo()
        }

        Function("stopLocalAudio") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }
        }

        Function("publishLocalVideo") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.publishLocalVideo()
        }

        Function("publishLocalAudio") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.publishLocalAudio()
        }
        
        Function("publishLocalData") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.publishLocalData()
        }

        Function("unpublishLocalVideo") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.unpublishLocalVideo()
        }

        Function("unpublishLocalAudio") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.unpublishLocalAudio()
        }
        
        Function("unpublishLocalData") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.unpublishLocalData()
        }

        Function("setLocalAudioEnabled") { (enabled: Bool) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.setLocalAudioEnabled(enabled: enabled)
        }

        // set a default for setting local video enabled
        Function("setLocalVideoEnabled") { (enabled: Bool, cameraType: String) -> Bool in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            return twilioVideo.setLocalVideoEnabled(enabled: enabled, cameraType: cameraType)
        }

        Function("flipCamera") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.flipCamera()
        }

        Function("toggleScreenSharing") { (value: Bool) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.toggleScreenSharing(value: value)
        }

        Function("toggleSoundSetup") { (speaker: Bool) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.toggleSoundSetup(speaker: speaker)
        }

        Function("getStats") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.getStats()
        }

        Function("sendString") { (message: String) in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.sendString(message: message)
        }
        
        Function("isConnected") { () -> Bool in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            return twilioVideo.isConnected()
        }

        Function("disconnect") { () in
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.disconnect()
        }
        
        Function("releaseResources") {
            // FIXME: this is a hack - inject "sendEvent" into the BarzTwilioVideo instance so that it
            // can emit events later
            //
            // There is probably a better way to do this, but as it is, this is the only way I can
            // figure out how to work around sendEvent not being an escaping closure
            twilioVideo.setSendEvent() { self.sendEvent($0, $1) }

            twilioVideo.releaseResources()
        }
    
        View(TwiliovideoLocalOrRemoteParticipantVideoView.self) {
            Prop("scalesType") { (view, scalesType: Int) in
                view.subviews[0].contentMode = scalesType == 1 ? .scaleAspectFit : .scaleAspectFill
            }
            Prop("local") { (view, local: Bool) in
                view.isLocal = local
                view.syncSubView()
            }
            Prop("remoteParticipantSid") { (view, remoteParticipantSid: String?) in
                view.remoteParticipantSid = remoteParticipantSid
                view.syncSubView()
            }
            Prop("remoteParticipantTrackSid") { (view, remoteParticipantTrackSid: String?) in
                view.remoteParticipantTrackSid = remoteParticipantTrackSid
                view.syncSubView()
            }
            Prop("enabled") { (view, enabled: Bool) in
                view.isEnabled = enabled
                view.syncSubView()
            }
        }
    }
}

class TwiliovideoLocalOrRemoteParticipantVideoView: ExpoView {
    var isEnabled = false
    
    var isLocal = true
    var remoteParticipantSid: String? = nil
    var remoteParticipantTrackSid: String? = nil
    
    var previousIsLocal: Bool? = nil
    var previousRemoteParticipantSid: String? = nil
    var previousRemoteParticipantTrackSid: String? = nil

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)

        clipsToBounds = true

        let inner = VideoView()
        inner.autoresizingMask = [.flexibleWidth, .flexibleHeight];
        addSubview(inner)
    }
    
    func syncSubView() {
        let barzTwilioVideo = self.appContext!.moduleRegistry.get(
            moduleWithName: "BarzTwilioVideo"
        ) as! BarzTwilioVideoModule?
        if barzTwilioVideo == nil {
            return
        }

        print("VIEW: \(self.isLocal) \(self.remoteParticipantSid) \(self.remoteParticipantTrackSid)")
        
        // Unassign the old view
        if self.previousIsLocal == true {
            barzTwilioVideo!.twilioVideo.removeLocalView(
                view: self.subviews[0] as! VideoView
            )
        } else if self.previousIsLocal == false && self.previousRemoteParticipantSid != nil && self.previousRemoteParticipantTrackSid != nil {
            barzTwilioVideo!.twilioVideo.removeParticipantView(
                view: self.subviews[0] as! VideoView,
                sid: self.previousRemoteParticipantSid!,
                trackSid: self.previousRemoteParticipantTrackSid!
            )
        }
        
        // Reassign the new view
        if (self.isLocal) {
            self.previousIsLocal = true
            if (self.isEnabled) {
                barzTwilioVideo!.twilioVideo.addLocalView(
                    view: self.subviews[0] as! VideoView
                )
            } else {
                barzTwilioVideo!.twilioVideo.removeLocalView(
                    view: self.subviews[0] as! VideoView
                )
            }
        } else {
            self.previousIsLocal = false
            self.previousRemoteParticipantSid = self.remoteParticipantSid
            self.previousRemoteParticipantTrackSid = self.remoteParticipantTrackSid
            
            if self.remoteParticipantSid == nil {
                print("Failure creating/removing remote participant view: remoteParticipantSid is null")
                return
            }
            if self.remoteParticipantTrackSid == nil {
                print("Failure creating/removing remote participant view: remoteParticipantTrackSid is null")
                return
            }
            
            if (self.isEnabled) {
                print("ADD REMOTE PARTICIPANT VIEW: \(self.remoteParticipantSid!) \(self.remoteParticipantTrackSid!)")
                barzTwilioVideo!.twilioVideo.addParticipantView(
                    view: self.subviews[0] as! VideoView,
                    sid: self.remoteParticipantSid!,
                    trackSid: self.remoteParticipantTrackSid!
                )
            } else {
                print("REMOVE REMOTE PARTICIPANT VIEW: \(self.remoteParticipantSid!) \(self.remoteParticipantTrackSid!)")
                barzTwilioVideo!.twilioVideo.removeParticipantView(
                    view: self.subviews[0] as! VideoView,
                    sid: self.remoteParticipantSid!,
                    trackSid: self.remoteParticipantTrackSid!
                )
            }
        }
    }
}














/**
 * TODO(chriseagleston):
 * It is typical to target a 20 ms I/O duration on iOS with libwebrtc in order to reduce processing resources.
 * This might add a small amount of audio delay, but it should result in enough samples to mix every time.
 * Capturing on an iPhone XS, iOS 15.7 at 48 kHz in Twilio's AudioDeviceExample:
 *
 * 1. 256 samples or ~ 5.3 ms per callback @ 0.005 duration.
 * 2. 512 samples or ~ 10.7 ms per callback @ 0.01 duration.
 * 3. 1024 samples or ~ 21.3 ms per callback @ 0.02 duration.
 *
 * libwebrtc wants 480 samples (10 ms) at a time but this is impossible on iOS.
 * AVAudioEngine wants at least N samples for each mixing operation.
 *
 * N >= ??
 */
let kPreferredIOBufferDuration: Double = 0.02

/**
 * TODO(chriseagleston): Consider if playback should occur in stereo, at least on the sender side.
 * At the moment both playback and recording occur in mono via the Audio Unit.
 * AFAICT libwebrtc's OPUS encoder is not being configured for two channel publishing in the iOS Video SDK.
 * Playback of stereo OPUS streams is not a problem as long as the TVIAudioDevice is configured for two channels.
 */
let kPreferredNumberOfChannels: size_t = 1

// An audio sample is a signed 16-bit integer.
let kAudioSampleSize: size_t = 2

/**
 * Most music is available at 44.1 kHz, but libwebrtc and iOS prefer to work in 48 kHz.
 * It is probably the lesser of two evils to upsample all music content to 48 kHz in this app.
 */
let kPreferredSampleRate: UInt32 = 48000

/*
 * Calls to AudioUnitInitialize() can fail if called back-to-back after a format change or adding and removing tracks.
 * A fall-back solution is to allow multiple sequential calls with a small delay between each. This factor sets the max
 * number of allowed initialization attempts.
 */
let kMaxNumberOfAudioUnitInitializeAttempts: Int32 = 5

// Audio renderer contexts used in core audio's playout callback to retrieve the sdk's audio device context.
struct AudioRendererContext {
    // Audio device context received in AudioDevice's `startRendering:context` callback.
    var deviceContext: AudioDeviceContext?

    // Maximum frames per buffer.
    var maxFramesPerBuffer: Int

    // Buffer passed to AVAudioEngine's manualRenderingBlock to receive the mixed audio data.
    var bufferList: UnsafeMutablePointer<AudioBufferList>!

    /*
     * Points to AVAudioEngine's manualRenderingBlock. This block is called from within the VoiceProcessingIO playout
     * callback in order to receive mixed audio data from AVAudioEngine in real time.
     */
    var renderBlock: AVAudioEngineManualRenderingBlock?
}

// Audio renderer contexts used in core audio's record callback to retrieve the sdk's audio device context.
struct AudioCapturerContext {
    // Audio device context received in AudioDevice's `startCapturing:context` callback.
    var deviceContext: AudioDeviceContext?

    // Preallocated buffer list. Please note the buffer itself will be provided by Core Audio's VoiceProcessingIO audio unit.
    var bufferList: UnsafeMutablePointer<AudioBufferList>!

    // Preallocated mixed (AudioUnit mic + AVAudioPlayerNode file) audio buffer list.
    var mixedAudioBufferList: UnsafeMutablePointer<AudioBufferList>!

    // Core Audio's VoiceProcessingIO audio unit.
    var audioUnit: AudioUnit!

    /*
     * Points to AVAudioEngine's manualRenderingBlock. This block is called from within the VoiceProcessingIO playout
     * callback in order to receive mixed audio data from AVAudioEngine in real time.
     */
    var renderBlock: AVAudioEngineManualRenderingBlock?
}

// The VoiceProcessingIO audio unit uses bus 0 for ouptut, and bus 1 for input.
let kOutputBus = 0
let kInputBus = 1

// This is the maximum slice size for VoiceProcessingIO (as observed in the field). We will double check at initialization time.
var kMaximumFramesPerBuffer: size_t = 3072


// ref: https://www.advancedswift.com/download-and-cache-images-in-swift/#download-an-image-or-file-from-a-url
func downloadAndCacheAudioFile(url: URL, completion: @escaping (Error?, URL, Bool) -> Void) {
    // Remove query parameters from the url
    // This is important to keep the url from getting too long which will hit the ios file name length limit
    var urlComponents = URLComponents(string: url.absoluteString)!
    urlComponents.query = nil
    let urlWithoutQueryParams = urlComponents.url!
    
    // Generate a cache key by base 64 encoding the url and putting the proper file extension on the end
    let base64EncodedUrl = urlWithoutQueryParams.absoluteString.data(using: .utf8)!.base64EncodedString()
    let cacheKey = "\(base64EncodedUrl).\(url.pathExtension)"
    let tempLocalFilePath = FileManager.default.temporaryDirectory.appendingPathComponent(
        cacheKey,
        isDirectory: false
    )
    
    // If this cache key already exists, then the file has been downloaded before.
    //
    // NOTE: This code assumes that the file hosted at a given url will never change - if one wants
    // a different audio file, they would need to publish it under a new url path!
    
    if FileManager.default.fileExists(atPath: tempLocalFilePath.path) {
        completion(nil, tempLocalFilePath, true)
        return
    }
    
    // Since the key didn't exist, download the remote URL to a file
    let task = URLSession.shared.downloadTask(with: url) {
        (tempURL, response, error) in
        // Early exit on error
        guard let tempURL = tempURL else {
            completion(error, tempLocalFilePath, false)
            return
        }

        do {
            // Copy the tempURL to file
            try FileManager.default.copyItem(
                at: tempURL,
                to: tempLocalFilePath
            )

            completion(nil, tempLocalFilePath, false)
        }

        // Handle potential file system errors
        catch let fileError {
            completion(fileError, tempLocalFilePath, false)
        }
    }

    // Start the download
    task.resume()
}

func removeCachedMusicForURLExternal(url: URL) {
    // Generate a cache key by base 64 encoding the url and putting the proper file extension on the end
    let base64EncodedUrl = url.absoluteString.data(using: .utf8)!.base64EncodedString()
    let cacheKey = "\(base64EncodedUrl).\(url.pathExtension)"
    let tempLocalFilePath = FileManager.default.temporaryDirectory.appendingPathComponent(
        cacheKey,
        isDirectory: false
    )
    
    // Force delete this cache key so that the file will have to be downloaded again
    try! FileManager.default.removeItem(at: tempLocalFilePath)
}

// This code was adapted from the example in the twilio-video-ios repo here:
// https://github.com/twilio/video-quickstart-ios/tree/master/AudioDeviceExample
class BarzCustomAudioDevice: NSObject, AudioDevice {
    private var interrupted: Bool = false
    private var audioUnit: AudioUnit!
    private var captureBufferList: AudioBufferList = AudioBufferList()
    
    private var renderingFormat: AudioFormat?
    private var capturingFormat: AudioFormat?
    private var renderingContext: AudioRendererContext! = AudioRendererContext(
        deviceContext: nil,
        maxFramesPerBuffer: 0
    )
    private var capturingContext: AudioCapturerContext! = AudioCapturerContext()
    
    // AudioEngine properties
    private var playoutEngine: AVAudioEngine!
    private var playoutFilePlayer: AVAudioPlayerNode!
    private var playoutReverb: AVAudioUnitReverb!
    private var playoutEq: AVAudioUnitEQ!
    private var recordEngine: AVAudioEngine!
    private var recordFilePlayer: AVAudioPlayerNode!
    private var recordEq: AVAudioUnitEQ!
    private var recordReverb: AVAudioUnitReverb!
    
    private var musicBuffer: AVAudioPCMBuffer?
    
    private var continuousMusic: Bool = false
    var activeMusicFileURL: URL? = nil
    
    // This audio format is what all audio files that get played through EITHER the playout AVAudioEngine or
    // the record AVAudioEngine need to be formated as. If audio files are not in this format, they must be
    // converted to match, or else weird things like pitch modulation might happen.
    static var engineAVAudioFormat = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!

    // MARK - Init & Dealloc

    override init() {
        super.init()

        // Initialize the rendering context
//        renderingContext = malloc(
//            MemoryLayout<AudioRendererContext>.size
//        ).bindMemory(to: AudioRendererContext.self, capacity: 1)
//        memset(renderingContext, 0, MemoryLayout<AudioRendererContext>.size)

        // Setup AVAudioSession first, just in case AVAudioEngineInputNode is left in an inconsistent state.
        setupAVAudioSession()
      
        // Setup the AVAudioEngine along with the rendering context
        if !setupPlayoutAudioEngine() {
            print("Failed to setup AVAudioEngine")
        }

        // Initialize the capturing context
//        capturingContext = malloc(
//            MemoryLayout<AudioCapturerContext>.size
//        ).bindMemory(to: AudioCapturerContext.self, capacity: 1)
//        memset(capturingContext, 0, MemoryLayout<AudioCapturerContext>.size)
//        // FIXME: the next line might be doing a copy?
//        capturingContext!.pointee.bufferList = withUnsafeMutablePointer(to: &self.captureBufferList) { $0 }
        capturingContext.bufferList = withUnsafeMutablePointer(to: &self.captureBufferList) { $0 }

        // Setup the AVAudioEngine along with the rendering context
        if !setupRecordAudioEngine() {
            print("Failed to setup AVAudioEngine")
        }

        // initialize
        var audioUnitDescription = Self.audioUnitDescription()
        guard let audioComponent = AudioComponentFindNext(nil, &audioUnitDescription) else {
            print("Could not find VoiceProcessingIO AudioComponent instance!")
            return
        }

        var audioUnit: AudioUnit?
        let status = AudioComponentInstanceNew(audioComponent, &audioUnit)
        guard status == 0 else {
            print("Could not create VoiceProcessingIO AudioComponent instance!")
            return
        }

        var framesPerSlice: UInt32 = 0
        var propertySize: UInt32 = UInt32(MemoryLayout<UInt32>.size)
        let outputBus: UInt32 = 0
        let result = AudioUnitGetProperty(audioUnit!, kAudioUnitProperty_MaximumFramesPerSlice,
                                           kAudioUnitScope_Global, outputBus,
                                           &framesPerSlice, &propertySize)
        if result != 0 {
            print("Could not read VoiceProcessingIO AudioComponent instance!")
            AudioComponentInstanceDispose(audioUnit!)
            return
        }

        if framesPerSlice < UInt32(kMaximumFramesPerBuffer) {
            framesPerSlice = UInt32(kMaximumFramesPerBuffer)
            let status = AudioUnitSetProperty(audioUnit!, kAudioUnitProperty_MaximumFramesPerSlice,
                                               kAudioUnitScope_Global, outputBus,
                                               &framesPerSlice, UInt32(MemoryLayout<UInt32>.size))
            if status != 0 {
                print("Could not set maximum frames per slice on VoiceProcessingIO AudioComponent instance!")
            }
        } else {
            kMaximumFramesPerBuffer = Int(framesPerSlice)
        }

        print("This device uses a maximum slice size of \(framesPerSlice) frames.")
        AudioComponentInstanceDispose(audioUnit!)
    }

    deinit {
        unregisterAVAudioSessionObservers()
        teardownAudioEngine()

//        var mixedAudioBufferList = self.capturingContext!.mixedAudioBufferList
//        if mixedAudioBufferList != nil {
////            for i in 0..<mixedAudioBufferList.pointee.mNumberBuffers {
////                free(mixedAudioBufferList.pointee.mBuffers[Int(i)].mData)
////            }
//            free(mixedAudioBufferList.pointee.mBuffers.mData)
//            free(mixedAudioBufferList)
//        }
    }

    // MARK - Private (AVAudioEngine)

    func setupAudioEngine() -> Bool {
        return setupPlayoutAudioEngine() && setupRecordAudioEngine()
    }

    func setupRecordAudioEngine() -> Bool {
        assert(recordEngine == nil, "AVAudioEngine is already configured")
        
        // By default, AVAudioEngine will render to/from the audio device, and automatically establish connections between nodes.
        recordEngine = AVAudioEngine()
        
        // AVAudioEngine operates on the same format as the Core Audio output bus.
        var asbd = Self.activeFormat()!.streamDescription()
        let manualRenderingFormat = AVAudioFormat(streamDescription: &asbd)!
        print("Setup record audio engine with manual rendering format: ", manualRenderingFormat)
        
        // Switch to manual rendering mode
        recordEngine.stop()
        do {
            try recordEngine.enableManualRenderingMode(
                .realtime,
                format: manualRenderingFormat,
                maximumFrameCount: UInt32(kMaximumFramesPerBuffer)
            )
        } catch let error {
            print("Failed to setup manual rendering mode, error = \(String(describing: error))")
            return false
        }
        
        // In manual rendering mode, AVAudioEngine won't receive audio from the microphone. Instead, it will receive the audio data from the Video SDK and mix it in MainMixerNode.
        // Here we connect the input node to the main mixer node. InputNode -> MainMixer -> OutputNode
        recordEngine.connect(recordEngine.inputNode, to: recordEngine.mainMixerNode, format: manualRenderingFormat)
        
        // Attach AVAudioPlayerNode node to play music from a file. AVAudioPlayerNode -> ReverbNode -> MainMixer -> OutputNode (note: ReverbNode is optional)
        attachMusicNodeToEngine(recordEngine)
        
        // Set the block to provide input data to engine
        let inputNode = recordEngine.inputNode
        // TODO(chriseagleston): In a release build this block is still called but the rendering operation always fails.
        let success = inputNode.setManualRenderingInputPCMFormat(manualRenderingFormat) { inNumberOfFrames -> UnsafePointer<AudioBufferList>? in
            // print("Manual input block called. Frames requested = ", inNumberOfFrames)
            // print("Input buffer list = ", self.captureBufferList)
            assert(inNumberOfFrames <= kMaximumFramesPerBuffer)
            
            var mutableAudioBufferList = self.captureBufferList // Create a mutable copy of the AudioBufferList
            return withUnsafeBytes(of: &mutableAudioBufferList) { ptr -> UnsafePointer<AudioBufferList>? in
                return ptr.baseAddress?.assumingMemoryBound(to: AudioBufferList.self)
            }
        }
        if !success {
            print("Failed to set the manual rendering block")
            return false
        }
        
        // The manual rendering block (called in Core Audio's VoiceProcessingIO's playout callback at real time)
        capturingContext!.renderBlock = recordEngine.manualRenderingBlock

        // TODO(chriseagleston): Ensure that the mixer outputs in the same format as the manual rendering format used by the output node.
        // recordEngine.connect(recordEngine.mainMixerNode, to: recordEngine.outputNode, format: manualRenderingFormat)
        
        do {
            try recordEngine.start()
        } catch let error {
            print("Failed to start AVAudioEngine, error = \(String(describing: error))")
            return false
        }
        NSLog("Setup record AVAudioEngine with input node input format: %@, input node output format: %@, mixer output format: %@, record output input format: %@, record output output format: %@",
              recordEngine.inputNode.inputFormat(forBus: 0), recordEngine.inputNode.outputFormat(forBus: 0), recordEngine.mainMixerNode.outputFormat(forBus: 0), recordEngine.outputNode.inputFormat(forBus: 0), recordEngine.outputNode.outputFormat(forBus: 0));

        return true
    }

    func setupPlayoutAudioEngine() -> Bool {
        assert(playoutEngine == nil, "AVAudioEngine is already configured")
        
        /*
         * By default AVAudioEngine will render to/from the audio device, and automatically establish connections between
         * nodes, e.g. inputNode -> effectNode -> outputNode.
         */
        playoutEngine = AVAudioEngine()

        // AVAudioEngine operates on the same format as the Core Audio output bus.
        var asbd = Self.activeFormat()!.streamDescription()
        let format = AVAudioFormat(streamDescription: &asbd)!
        print("Setup playout audio engine with manual rendering format: ", format)

        // Switch to manual rendering mode
        playoutEngine.stop()
        do {
            try playoutEngine.enableManualRenderingMode(.realtime, format: format, maximumFrameCount: UInt32(kMaximumFramesPerBuffer))
        } catch let error {
            print("Failed to setup manual rendering mode, error = \(error)")
            return false
        }

        /*
         * In manual rendering mode, AVAudioEngine won't receive audio from the microphone. Instead, it will receive the
         * audio data from the Video SDK and mix it in MainMixerNode. Here we connect the input node to the main mixer node.
         * InputNode -> MainMixer -> OutputNode
         */
        playoutEngine.connect(playoutEngine.inputNode, to: playoutEngine.mainMixerNode, format: format)

        /*
         * Attach AVAudioPlayerNode node to play music from a file.
         * AVAudioPlayerNode -> ReverbNode -> MainMixer -> OutputNode (note: ReverbNode is optional)
         */
        attachMusicNodeToEngine(playoutEngine)

        // Set the block to provide input data to engine
        let inputNode = playoutEngine.inputNode
        inputNode.setManualRenderingInputPCMFormat(format, inputBlock: { (inNumberOfFrames) -> UnsafePointer<AudioBufferList>? in
            assert(inNumberOfFrames <= kMaximumFramesPerBuffer)

            let bufferList = self.renderingContext!.bufferList
            let audioBuffer = bufferList!.pointee.mBuffers.mData
            let audioBufferSizeInBytes = bufferList!.pointee.mBuffers.mDataByteSize

            if let deviceContext = self.renderingContext!.deviceContext {
                /*
                 * Pull decoded, mixed audio data from the media engine into the
                 * AudioUnit's AudioBufferList.
                 */
                AudioDeviceReadRenderData(
                    context: deviceContext,
                    data: audioBuffer!.assumingMemoryBound(to: Int8.self),
                    sizeInBytes: Int(audioBufferSizeInBytes)
                )
            } else {
                /*
                 * Return silence when we do not have the playout device context. This is the
                 * case when the remote participant has not published an audio track yet.
                 * Since the audio graph and audio engine has been setup, we can still play
                 * the music file using AVAudioEngine.
                 */
                memset(audioBuffer, 0, Int(audioBufferSizeInBytes))
            }

            return UnsafePointer(bufferList)
        })

        // The manual rendering block (called in Core Audio's VoiceProcessingIO's playout callback at real time)
        renderingContext!.renderBlock = playoutEngine.manualRenderingBlock

        do {
            try playoutEngine.start()
        } catch let error {
            print("Failed to start AVAudioEngine, error = \(error)")
            return false
        }

        return true
    }

    func teardownRecordAudioEngine() {
        recordEngine.stop()
        recordEngine = nil
        capturingContext!.renderBlock = nil
    }

    func teardownPlayoutAudioEngine() {
        playoutEngine.stop()
        playoutEngine = nil
        renderingContext!.renderBlock = nil
    }

    func teardownAudioEngine() {
        teardownFilePlayers()
        teardownPlayoutAudioEngine()
        teardownRecordAudioEngine()
    }

    /**
     * TODO(chriseagleston): Is the music buffer in the optimal format for processing (mixing)?
     * AudioDeviceExample uses `AVAudioFile.procesingFormat` for `mixLoop.caf`.
     * But in some cases a sample rate conversion is required here. Also, the entire file needs to be converted before playback begins.
     * What about scheduling playback of an AVAudioFile instead of managing the buffers in the application?
     * Is there an argument to made about using improved SRC given the requirement to operate at 48 kHz?
     */
    func getMusicBuffer() -> AVAudioPCMBuffer? {
        if musicBuffer != nil {
            return musicBuffer
        }

        if self.activeMusicFileURL == nil {
            print("WARNING: attempted to call getMusicBuffer() and activeMusicFileURL was nil!")
            return nil
        }
        let url = self.activeMusicFileURL!
        
        let initialFile = try! AVAudioFile(forReading: url)
        
        let engineFileFormat = Self.engineAVAudioFormat
        
        // Compute the number of output frames by scaling the initial file's size by the change in sample rate from old file
        // to new file. FIXME: this is probably a bad way to do this, this almost certainly won't always work but seems to so far
        let outputMediaFrameCapacity = (
            Double(initialFile.length) *
            (engineFileFormat.sampleRate / initialFile.processingFormat.sampleRate)
        ).rounded()
        musicBuffer = AVAudioPCMBuffer(
            pcmFormat: engineFileFormat,
            frameCapacity: AVAudioFrameCount(outputMediaFrameCapacity)
        )!

        if engineFileFormat == initialFile.processingFormat {
            /*
             * The sample app plays a small in size file `mixLoop.caf`, but if you are playing a bigger file, to unblock the
             * calling (main) thread, you should execute `[file readIntoBuffer:buffer error:&error]` on a background thread,
             * and once the read is completed, schedule buffer playout from the calling (main) thread.
             */
            do {
                try initialFile.read(into: musicBuffer!)
            } catch let error {
                print("Failed to read audio file into buffer. error = \(String(describing: error))")
                musicBuffer = nil
            }
            return musicBuffer
        }
        print("Note: The audio format of the loaded audio file (\(initialFile.processingFormat)) does not match the format of the audio engine (\(engineFileFormat)) - converting it...")
        
        // Convert the audio file to the standard audio file format that the audio processing engines expect it to be in
        // If this isn't done, the audio will play, but it will be pitched incorrectly (due to the sample rates not matching up)
        // TODO: move this off the main thread! It blocks user interactions right now.
        let converter = AVAudioConverter(from: initialFile.processingFormat, to: engineFileFormat)
        let inputBuffer = AVAudioPCMBuffer(
            pcmFormat: initialFile.processingFormat,
            frameCapacity: AVAudioFrameCount(initialFile.length * 2)
        )

        var outError: NSError?
        converter!.convert(to: musicBuffer!, error: &outError) { inNumPackets, outStatus in
            outStatus.pointee = AVAudioConverterInputStatus.haveData

            // print("READ: \(initialFile.length) \(initialFile.fileFormat) \(initialFile.processingFormat) \(inputBuffer?.frameCapacity) \(inNumPackets)")
            do {
                try initialFile.read(into: inputBuffer!, frameCount: inNumPackets)
            } catch {
                // Once reads start failing, assume that the entire file has been read
                // FIXME: this isn't a great assumption, but I can't come up with another reliable way to figure this out
                outStatus.pointee = .endOfStream
            }
            return inputBuffer!
        }
//        print("INPUT LENGTH: \(inputBuffer!.frameCapacity) OUTPUT LENGTH: \(musicBuffer!.frameCapacity)")
        if let error = outError {
            print("Audio conversion error: \(error.localizedDescription)")
            musicBuffer = nil
        }
        return musicBuffer
    }

  func scheduleMusicOnRecordEngine(musicBuffer: AVAudioPCMBuffer, at: AVAudioTime?) {
        recordFilePlayer.scheduleBuffer(musicBuffer, at: at, options: AVAudioPlayerNodeBufferOptions.interrupts, completionHandler: {
            print("Downstream file player finished buffer playing")
            
            DispatchQueue.main.async {
                // Completed playing file via AVAudioEngine.
                // `nil` context indicates TwilioVideo SDK does not need core audio either.
                if self.deviceContext == nil {
                    self.tearDownAudio()
                }
                
                self.musicBuffer = nil
            }
        })
        recordFilePlayer.play()
    }

    func scheduleMusicOnPlayoutEngine(musicBuffer: AVAudioPCMBuffer, at: AVAudioTime?) {
        playoutFilePlayer.scheduleBuffer(musicBuffer, at: at, options: AVAudioPlayerNodeBufferOptions.interrupts, completionHandler: {
            print("Upstream file player finished buffer playing")
            
            DispatchQueue.main.async {
                // Completed playing file via AVAudioEngine.
                // `nil` context indicates TwilioVideo SDK does not need core audio either.
                if self.deviceContext == nil {
                    self.tearDownAudio()
                }
            }
        })
        playoutFilePlayer.play()
    }

    func playMusic(continuous: Bool) {
        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }
        
        if continuous {
            if self.renderingFormat == nil {
                self.renderingFormat = self.renderFormat()
            }
            if self.capturingFormat == nil {
                self.capturingFormat = self.captureFormat()
            }
            // If device context is null, we will setup the audio unit by invoking the
            // rendering and capturing.
            _ = self.initializeCapturer()
            _ = self.initializeRenderer()
            
            if self.renderingContext!.deviceContext != nil {
                _ = self.startRendering(context: self.renderingContext!.deviceContext!)
            }
            if self.capturingContext!.deviceContext != nil {
                _ = self.startCapturing(context: self.capturingContext!.deviceContext!)
            }
        }
        self.continuousMusic = continuous
        
        // Kick off the music buffer generation in a background thread since it potentially may have to convert the audio
        DispatchQueue.global(qos: .userInteractive).async {
            let musicBuffer = self.getMusicBuffer()
            
            if musicBuffer != nil {
                DispatchQueue.main.async {
                    // Make sure that any volume changes due to fades in and out in the past have been reset
                    // self.playoutFilePlayer.volume = 1.0
                    // self.recordFilePlayer.volume = 1.0

                    /**
                     * TODO(chriseagleston): It would be nice to schedule audio playback and recording to start at the same timestamp.
                     * At this point there is no guarantee that what the publisher hears from playout
                     * is the same as the subscriber from the recording.
                     */
                    self.scheduleMusicOnPlayoutEngine(musicBuffer: musicBuffer!, at: nil)
                    self.scheduleMusicOnRecordEngine(musicBuffer: musicBuffer!, at: nil)
                }
            }
        }
    }

    func stopMusic() {
        if self.playoutFilePlayer.isPlaying {
            self.playoutFilePlayer.pause()
        }
        if self.recordFilePlayer.isPlaying {
            self.recordFilePlayer.pause()
        }
    }
    
    func getMusicPlaybackPosition() -> Double? {
        if self.playoutFilePlayer.lastRenderTime != nil {
            return Double(self.playoutFilePlayer.lastRenderTime!.sampleTime) / Double(kPreferredSampleRate)
        } else {
            return nil
        }
    }
    
    // When called, instantaneously set the volume of the backing track to the given value (0 <= toVolume <= 1)
    //
    // NOTE: this is kinda counterintuitive, but it seems setting the "output" volume is what is needed here
    // since this is the output of the media mixing chain. This seems to be applied BEFORE the mix is done with
    // the microphone audio.
    func setMusicVolume(toVolume: Float) {
        self.playoutFilePlayer.volume = toVolume
        self.recordFilePlayer.volume = toVolume
        self.playoutEq.globalGain = 15.0
        self.recordEq.globalGain = 15.0
        
//        self.recordEngine.inputNode.volume
        
//        self.playoutEngine.mainMixerNode.outputVolume = toVolume
//        self.recordEngine.mainMixerNode.outputVolume = toVolume
//        self.playoutEngine.mainMixerNode.volume = toVolume
//        self.recordEngine.mainMixerNode.volume = toVolume
    }
    
    // When called, fade the volume of the backing music from its current volume to the volume specified as `to`.
    func fadeMusicVolume(duration: TimeInterval, to: Float, stepTime: Double = 0.01, completion: (() -> ())?) {
        // NOTE: This code is largely taken from https://stackoverflow.com/a/66671890/4115328
        
        // Start at the current volume
        let from = self.playoutFilePlayer.volume
        
        let times = duration / stepTime
        let step = (to - from) / Float(times)
        for i in 0...Int(times) {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * stepTime) {
                let volume = from + Float(i) * step
                if self.playoutFilePlayer.isPlaying {
                    self.playoutFilePlayer.volume = volume
                }
                if self.recordFilePlayer.isPlaying {
                    self.recordFilePlayer.volume = volume
                }

                if i == Int(times) {
                    completion?()
                }
            }
        }
        
    }
    
    func pauseMusic() {
        if self.playoutFilePlayer.isPlaying {
            self.playoutFilePlayer.pause()
        }
        if self.recordFilePlayer.isPlaying {
            self.recordFilePlayer.pause()
        }
    }
    
    func resumeMusic() {
        if self.playoutFilePlayer.isPlaying {
            self.playoutFilePlayer.play()
        }
        if self.recordFilePlayer.isPlaying {
            self.recordFilePlayer.play()
        }
    }
    
    func tearDownAudio() {
        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }
        
        self.teardownAudioUnit()
        self.teardownAudioEngine()
        self.continuousMusic = false
    }

    func attachMusicNodeToEngine(_ engine: AVAudioEngine!) {
        guard let engine = engine else {
            print("Cannot play music. AudioEngine has not been created yet.")
            return
        }
        
        var player: AVAudioPlayerNode?
        var reverb: AVAudioUnitReverb?
        var eq: AVAudioUnitEQ?
        
        let isPlayoutEngine = self.playoutEngine == engine
        
        /*
         * Attach an AVAudioPlayerNode as an input to the main mixer.
         * AVAudioPlayerNode -> AVAudioUnitReverb -> MainMixerNode -> Core Audio
         */
        
        // TODO(chriseagleston): Is it intentional to use AVAudioUnitReverb to apply the hall effect to every song?
        player = AVAudioPlayerNode()
        reverb = AVAudioUnitReverb()
        eq = AVAudioUnitEQ()
        
        reverb!.loadFactoryPreset(.mediumHall)
        reverb!.wetDryMix = 0
        
        engine.attach(player!)
        engine.attach(reverb!)
        engine.attach(eq!)
        
        engine.connect(player!, to: eq!, format: Self.engineAVAudioFormat)
        engine.connect(eq!, to: reverb!, format: Self.engineAVAudioFormat)
        engine.connect(reverb!, to: engine.mainMixerNode, format: Self.engineAVAudioFormat)
        
        if isPlayoutEngine {
            self.playoutReverb = reverb
            self.playoutFilePlayer = player
            self.playoutEq = eq
        } else {
            self.recordReverb = reverb
            self.recordFilePlayer = player
            self.recordEq = eq
        }
    }

    func teardownRecordFilePlayer() {
        if let recordFilePlayer = self.recordFilePlayer {
            if recordFilePlayer.isPlaying {
                recordFilePlayer.stop()
            }
            if let recordEngine = self.recordEngine {
                recordEngine.detach(self.recordFilePlayer)
                recordEngine.detach(self.recordReverb)
                self.recordReverb = nil
            }
        }
    }

    func teardownPlayoutFilePlayer() {
        if let playoutFilePlayer = self.playoutFilePlayer {
            if playoutFilePlayer.isPlaying {
                playoutFilePlayer.stop()
            }
            if let playoutEngine = self.playoutEngine {
                playoutEngine.detach(self.playoutFilePlayer)
                playoutEngine.detach(self.playoutReverb)
                self.playoutReverb = nil
            }
        }
    }

    func teardownFilePlayers() {
        teardownRecordFilePlayer()
        teardownPlayoutFilePlayer()
    }

    // MARK: - TVIAudioDeviceRenderer

    func renderFormat() -> AudioFormat? {
        if self.renderingFormat == nil {
            /*
             * Assume that the AVAudioSession has already been configured and started and that the values
             * for sampleRate and IOBufferDuration are final.
             */
            self.renderingFormat = type(of: self).activeFormat()
            self.renderingContext!.maxFramesPerBuffer = self.renderingFormat!.framesPerBuffer
        }
        return self.renderingFormat
    }

    func initializeRenderer() -> Bool {
        /*
         * In this example we don't need any fixed size buffers or other pre-allocated resources. We will simply write
         * directly to the AudioBufferList provided in the AudioUnit's rendering callback.
         */
        return true
    }

    func startRendering(context: AudioDeviceContext) -> Bool {
        objc_sync_enter(self)
        defer { objc_sync_exit(self) }

        /*
         * In this example, the app always publishes an audio track. So we will start the audio unit from the capturer
         * call backs. We will restart the audio unit if a remote participant adds an audio track after the audio graph is
         * established. Also we will re-establish the audio graph in case the format changes.
         */
        if self.audioUnit != nil {
            _ = stopAudioUnit()
            teardownAudioUnit()
        }

        // If music is being played then we have already setup the engine
        if !continuousMusic {
            // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
            DispatchQueue.main.async {
                let manualRenderingFormat = self.playoutEngine.manualRenderingFormat
                let engineFormat = AudioFormat(channels: Int(manualRenderingFormat.channelCount),
                                                  sampleRate: UInt32(manualRenderingFormat.sampleRate),
                                                  framesPerBuffer: kMaximumFramesPerBuffer)
                if engineFormat == Self.activeFormat() {
                    if self.playoutEngine.isRunning {
                        self.playoutEngine.stop()
                    }

                    do {
                        try self.playoutEngine.start()
                    } catch {
                        print("Failed to start AVAudioEngine, error = \(error.localizedDescription)")
                    }
                } else {
                    self.teardownPlayoutFilePlayer()
                    self.teardownPlayoutAudioEngine()
                    _ = self.setupPlayoutAudioEngine()
                }
            }
        }

        renderingContext!.deviceContext = context

        guard setupAudioUnit(renderContext: &(renderingContext!), captureContext: &(capturingContext!)) else {
            return false
        }

        let success = startAudioUnit()
        return success
    }

    func stopRendering() -> Bool {
        objc_sync_enter(self)
        defer { objc_sync_exit(self) }

        // Continue playing music even after disconnected from a Room.
        if continuousMusic {
            return true
        }

        // If the capturer is runnning, we will not stop the audio unit.
        if capturingContext!.deviceContext == nil {
            _ = stopAudioUnit()
            teardownAudioUnit()
        }
        renderingContext!.deviceContext = nil

        // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
        DispatchQueue.main.async {
            if self.playoutFilePlayer.isPlaying {
                self.playoutFilePlayer.stop()
            }
            if self.playoutEngine.isRunning {
                self.playoutEngine.stop()
            }
        }

        return true
    }

    // MARK: - TVIAudioDeviceCapturer

    func captureFormat() -> AudioFormat? {
        if self.capturingFormat == nil {
            /*
             * Assume that the AVAudioSession has already been configured and started and that the values
             * for sampleRate and IOBufferDuration are final.
             */
            self.capturingFormat = Self.activeFormat()
        }

        return self.capturingFormat
    }

    func initializeCapturer() -> Bool {
        self.captureBufferList.mNumberBuffers = 1
        self.captureBufferList.mBuffers.mNumberChannels = UInt32(kPreferredNumberOfChannels)
        
        var mixedAudioBufferList = self.capturingContext!.mixedAudioBufferList
        if mixedAudioBufferList == nil {
            mixedAudioBufferList = malloc(
                MemoryLayout<AudioBufferList>.size
            ).bindMemory(to: AudioBufferList.self, capacity: 1)
            mixedAudioBufferList!.pointee.mNumberBuffers = 1
            mixedAudioBufferList!.pointee.mBuffers.mNumberChannels = UInt32(kPreferredNumberOfChannels)
            mixedAudioBufferList!.pointee.mBuffers.mDataByteSize = UInt32(kMaximumFramesPerBuffer * kPreferredNumberOfChannels * kAudioSampleSize)
            mixedAudioBufferList!.pointee.mBuffers.mData = malloc(kMaximumFramesPerBuffer * kPreferredNumberOfChannels * kAudioSampleSize)

            self.capturingContext!.mixedAudioBufferList = mixedAudioBufferList
        }

        return true
    }

    func startCapturing(context: AudioDeviceContext) -> Bool {
        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }

        // Restart the audio unit if the audio graph is alreay setup and if we publish an audio track.
        if self.audioUnit != nil {
            _ = stopAudioUnit()
            teardownAudioUnit()
        }

        // If music is being played then we have already setup the engine
        if !continuousMusic {
            // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
            DispatchQueue.main.async {
                let manualRenderingFormat = self.recordEngine.manualRenderingFormat
                let engineFormat = AudioFormat(channels: Int(manualRenderingFormat.channelCount),
                                                  sampleRate: UInt32(Int(manualRenderingFormat.sampleRate)),
                                                  framesPerBuffer: kMaximumFramesPerBuffer)
                if engineFormat == Self.activeFormat() {
                    if self.recordEngine.isRunning {
                        self.recordEngine.stop()
                    }

                    do {
                        try self.recordEngine.start()
                    } catch let error {
                        print("Failed to start AVAudioEngine, error = \(error.localizedDescription)")
                    }
                } else {
                    self.teardownRecordFilePlayer()
                    self.teardownRecordAudioEngine()
                    _ = self.setupRecordAudioEngine()
                }
            }
        }

        capturingContext!.deviceContext = context

        guard setupAudioUnit(renderContext: &(renderingContext!), captureContext: &(capturingContext!)) else {
            return false
        }

        let success = startAudioUnit()
        return success
    }

    func stopCapturing() -> Bool {
        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }

        // Continue playing music even after disconnected from a Room.
        if continuousMusic {
            return true
        }

        // If the renderer is running, we will not stop the audio unit.
        if self.renderingContext!.deviceContext == nil {
            _ = stopAudioUnit()
            teardownAudioUnit()
        }
        self.capturingContext!.deviceContext = nil
        
        // We will make sure AVAudioEngine and AVAudioPlayerNode is accessed on the main queue.
        DispatchQueue.main.async {
            if self.recordFilePlayer.isPlaying {
                self.recordFilePlayer.stop()
            }
            if self.recordEngine.isRunning {
                self.recordEngine.stop()
            }
        }
        
        return true
    }

    // MARK: - Private (AVAudioSession and CoreAudio)

    static func activeFormat() -> AudioFormat? {
        /*
         * Use the pre-determined maximum frame size. AudioUnit callbacks are variable, and in most sitations will be close
         * to the `AVAudioSession.preferredIOBufferDuration` that we've requested.
         */
        let sessionFramesPerBuffer = kMaximumFramesPerBuffer
        let sessionSampleRate = AVAudioSession.sharedInstance().sampleRate

        return AudioFormat(channels: 1,
                              sampleRate: UInt32(sessionSampleRate),
                              framesPerBuffer: sessionFramesPerBuffer)
    }

    static func audioUnitDescription() -> AudioComponentDescription {
        var audioUnitDescription = AudioComponentDescription()
        audioUnitDescription.componentType = kAudioUnitType_Output
        audioUnitDescription.componentSubType = kAudioUnitSubType_VoiceProcessingIO
        audioUnitDescription.componentManufacturer = kAudioUnitManufacturer_Apple
        audioUnitDescription.componentFlags = 0
        audioUnitDescription.componentFlagsMask = 0
        return audioUnitDescription
    }

    func setupAVAudioSession() {
        print("Setup and activate the AVAudioSession.")
        let session = AVAudioSession.sharedInstance()

        do {
            try session.setPreferredSampleRate(Double(kPreferredSampleRate))
        } catch let error {
            print("Error setting sample rate: \(error)")
        }

        // TODO(chriseagleston): Given that music playback is a goal should the session
        // operate in stereo output instead of mono output?
        do {
            try session.setPreferredOutputNumberOfChannels(kPreferredNumberOfChannels)
        } catch let error {
            print("Error setting number of output channels: \(error)")
        }

        /*
         * We want to be as close as possible to the 10 millisecond buffer size that the media engine needs. If there is
         * a mismatch then TwilioVideo will ensure that appropriately sized audio buffers are delivered.
         */
        do {
            try session.setPreferredIOBufferDuration(kPreferredIOBufferDuration)
        } catch let error {
            print("Error setting IOBuffer duration: \(error)")
        }

        do {
            try session.setCategory(.playAndRecord)
        } catch let error {
            print("Error setting session category: \(error)")
        }

        do {
            try session.setMode(.videoChat)
        } catch let error {
            print("Error setting session category: \(error)")
        }

        registerAVAudioSessionObservers()

        do {
            try session.setActive(true)
        } catch let error {
            print("Error activating AVAudioSession: \(error)")
        }

        if session.maximumInputNumberOfChannels > 0 {
            do {
                try session.setPreferredInputNumberOfChannels(1)
            } catch let error {
                print("Error setting number of input channels: \(error)")
            }
        }
    }

    func setupAudioUnit(
        renderContext: UnsafeMutablePointer<AudioRendererContext>,
        captureContext: UnsafeMutablePointer<AudioCapturerContext>
    ) -> Bool {
        // Find and instantiate the VoiceProcessingIO audio unit.
        var audioUnitDescription = Self.audioUnitDescription()
        var audioComponent: AudioComponent? = nil

        audioComponent = AudioComponentFindNext(nil, &audioUnitDescription)

        var status: OSStatus = AudioComponentInstanceNew(audioComponent!, &audioUnit)
        if status != 0 {
            print("Could not find VoiceProcessingIO AudioComponent instance!")
            return false
        }

        /*
         * Configure the VoiceProcessingIO audio unit. Our rendering format attempts to match what AVAudioSession requires
         * to prevent any additional format conversions after the media engine has mixed our playout audio.
         */
        var streamDescription = renderingFormat!.streamDescription()

        var enableOutput: UInt32 = 1
        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Output, AudioUnitElement(kOutputBus),
                                      &enableOutput, UInt32(MemoryLayout<UInt32>.size))
        if status != 0 {
            print("Could not enable out bus!")
            AudioComponentInstanceDispose(audioUnit)
            audioUnit = nil
            return false
        }

        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Output, AudioUnitElement(kInputBus),
                                      &streamDescription, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        if status != 0 {
            // -10868 = kAudioUnitErr_FormatNotSupported
            // ref: https://developer.apple.com/documentation/audiotoolbox/1584138-audio_unit_errors/kaudiouniterr_formatnotsupported
            print("Could not set stream format on input bus! status=\(status) streamDescription=\(streamDescription)")
            return false
        }

        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_StreamFormat,
                                      kAudioUnitScope_Input, AudioUnitElement(kOutputBus),
                                      &streamDescription, UInt32(MemoryLayout<AudioStreamBasicDescription>.size))
        if status != 0 {
            print("Could not set stream format on output bus!")
            return false
        }
        // Enable the microphone input
        var enableInput: UInt32 = 1
        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_EnableIO,
                                      kAudioUnitScope_Input, AudioUnitElement(kInputBus), &enableInput,
                                      UInt32(MemoryLayout<UInt32>.size))

        if status != 0 {
            print("Could not enable input bus!")
            AudioComponentInstanceDispose(audioUnit)
            audioUnit = nil
            return false
        }

        // Setup the rendering callback.
        var renderCallback = AURenderCallbackStruct(
            //                self.BarzCustomAudioDevicePlayoutCallback as AURenderCallback,
            inputProc: { (
                _ refCon: UnsafeMutableRawPointer,
                _ actionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                _ timestamp: UnsafePointer<AudioTimeStamp>,
                _ busNumber: UInt32,
                _ numFrames: UInt32,
                _ bufferList: UnsafeMutablePointer<AudioBufferList>?
            ) -> OSStatus in
                assert(bufferList!.pointee.mNumberBuffers == 1)
                assert(bufferList!.pointee.mBuffers.mNumberChannels <= 2)
                assert(bufferList!.pointee.mBuffers.mNumberChannels > 0)

                let context = refCon.assumingMemoryBound(to: AudioRendererContext.self)
                context.pointee.bufferList = bufferList!

                let audioBuffer = bufferList!.pointee.mBuffers.mData!.assumingMemoryBound(to: Int8.self)
                let audioBufferSizeInBytes = bufferList!.pointee.mBuffers.mDataByteSize

                assert(audioBufferSizeInBytes == (bufferList!.pointee.mBuffers.mNumberChannels * UInt32(kAudioSampleSize) * numFrames))
                var outputStatus = noErr
                
                // Make sure that the renderBlock is set before attempting to execute it
                if context.pointee.renderBlock == nil {
                    print("WARNING: renderCallback ran, but renderingContext.renderBlock was nil, skipping...")
                    return noErr
                }
                
                let status = context.pointee.renderBlock!(numFrames, bufferList!, &outputStatus)

                if numFrames > context.pointee.maxFramesPerBuffer || status != AVAudioEngineManualRenderingStatus.success {
                    if numFrames > context.pointee.maxFramesPerBuffer {
                        print("Can handle a max of %u frames but got %u.", context.pointee.maxFramesPerBuffer, numFrames)
                    }
                    actionFlags.pointee.insert(.unitRenderAction_OutputIsSilence)
                    memset(audioBuffer, 0, Int(audioBufferSizeInBytes))
                }

                return noErr
            },
            inputProcRefCon: renderContext
        )

        status = AudioUnitSetProperty(audioUnit, kAudioUnitProperty_SetRenderCallback,
                                      kAudioUnitScope_Output, AudioUnitElement(kOutputBus), &renderCallback,
                                      UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        if status != 0 {
            print("Could not set rendering callback!")
            AudioComponentInstanceDispose(audioUnit)
            audioUnit = nil
            return false
        }

        // Setup the capturing callback.
        var captureCallback = AURenderCallbackStruct(
            // BarzCustomAudioDeviceRecordCallback
            inputProc: { (
                _ refCon: UnsafeMutableRawPointer,
                _ actionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
                _ timestamp: UnsafePointer<AudioTimeStamp>,
                _ busNumber: UInt32,
                _ numFrames: UInt32,
                _ bufferList: UnsafeMutablePointer<AudioBufferList>?
            ) -> OSStatus in
                if numFrames > kMaximumFramesPerBuffer {
                    print("Expected %u frames but got %u.", kMaximumFramesPerBuffer, numFrames)
                    return noErr
                }

                let context = refCon.assumingMemoryBound(to: AudioCapturerContext.self)

                if context.pointee.deviceContext == nil {
                    return noErr
                }

                let audioBufferList = context.pointee.bufferList
                audioBufferList!.pointee.mBuffers.mDataByteSize = numFrames * UInt32(MemoryLayout<UInt16>.size) * UInt32(kPreferredNumberOfChannels)
                audioBufferList!.pointee.mBuffers.mData = nil

                var status: OSStatus = noErr
                status = AudioUnitRender(context.pointee.audioUnit,
                                         actionFlags,
                                         timestamp,
                                         1,
                                         numFrames,
                                         audioBufferList!)
                
                if status != 0 {
                    print("AudioUnitRender status was \(status)!")
                }

                let mixedAudioBufferList = context.pointee.mixedAudioBufferList
                assert(mixedAudioBufferList != nil)
                assert(mixedAudioBufferList!.pointee.mNumberBuffers == audioBufferList!.pointee.mNumberBuffers)
                
                let audioBufferListPtr = UnsafeMutableAudioBufferListPointer(&audioBufferList!.pointee)
                let mixedAudioBufferListPtr = UnsafeMutableAudioBufferListPointer(&mixedAudioBufferList!.pointee)

                for i in audioBufferListPtr.indices {
//                    print("Initialize mixed audio buffer i = ", i,
//                          "channels = ", audioBufferListPtr[i].mNumberChannels,
//                          "byte size = ", audioBufferListPtr[i].mDataByteSize)
                    mixedAudioBufferListPtr[i].mNumberChannels = audioBufferListPtr[i].mNumberChannels
                    mixedAudioBufferListPtr[i].mDataByteSize = audioBufferListPtr[i].mDataByteSize
                }

                var outputStatus: OSStatus = noErr
                // Make sure that the renderBlock is set before attempting to execute it
                if context.pointee.renderBlock == nil {
                    print("WARNING: captureCallback ran, but capturingContext.renderBlock was nil, skipping...")
                    return noErr
                }
                
                /**
                 * TODO(chriseagleston): There is no strict guarantee that numFrames is sufficient for mixing by AVAudioEngine.
                 * Some strategies to deal with an underrun (AVAudioEngineManualRenderingStatusInsufficientDataFromInputNode):
                 * 1. Buffer the microphone audio from subsequent callbacks until at least N samples are accumulated.
                 * 2. Increase the AVAudioSession I/O buffer duration to prevent underruns.
                 * 3. Ensure that the number of channels in the AVAudioSession are matched.
                 */
                let ret = context.pointee.renderBlock!(numFrames, mixedAudioBufferList!, &outputStatus)
                
                if ret != AVAudioEngineManualRenderingStatus.success {
                    let outputBuffer = UnsafeMutableAudioBufferListPointer(mixedAudioBufferList!)[0]
                    let outputFrameCount = AVAudioFrameCount(
                        outputBuffer.mDataByteSize /
                        outputBuffer.mNumberChannels /
                        UInt32(MemoryLayout<UInt16>.size)
                    )
                    
                    print("AVAudioEngine failed mix audio ret=\(ret.rawValue) outputstatus=\(outputStatus) numFrames=\(numFrames) mixedAudioBufferList=\(String(describing: mixedAudioBufferList?.pointee)) framecount=\(outputFrameCount) sessionRate=\(AVAudioSession.sharedInstance().sampleRate) sessionInputChannels=\(AVAudioSession.sharedInstance().inputNumberOfChannels) sessionPreferredInputChannels=\(AVAudioSession.sharedInstance().preferredInputNumberOfChannels) sessionOutputChannels=\(AVAudioSession.sharedInstance().outputNumberOfChannels) sessionPreferredOutputChannels=\(AVAudioSession.sharedInstance().preferredOutputNumberOfChannels) sessionIOBufferDuration=\(AVAudioSession.sharedInstance().ioBufferDuration)")
                    print("Capture context bufferList = ", context.pointee.bufferList![0])
                } else {
//                    print("AVAudioEngine mixing success. sessionInputChannels=\(AVAudioSession.sharedInstance().inputNumberOfChannels) sessionPreferredInputChannels=\(AVAudioSession.sharedInstance().preferredInputNumberOfChannels) sessionOutputChannels=\(AVAudioSession.sharedInstance().outputNumberOfChannels) sessionPreferredOutputChannels=\(AVAudioSession.sharedInstance().preferredOutputNumberOfChannels) sessionIOBufferDuration=\(AVAudioSession.sharedInstance().ioBufferDuration)")
                }
                
                let audioBuffer = mixedAudioBufferList!.pointee.mBuffers.mData?.assumingMemoryBound(to: Int8.self)
                let audioBufferSizeInBytes = mixedAudioBufferList!.pointee.mBuffers.mDataByteSize
                
                if let deviceContext = context.pointee.deviceContext, let audioBuffer = audioBuffer {
                    AudioDeviceWriteCaptureData(
                        context: deviceContext,
                        data: audioBuffer,
                        sizeInBytes: Int(audioBufferSizeInBytes)
                    )
                }

                return noErr
            },
            inputProcRefCon: captureContext
        )

        status = AudioUnitSetProperty(audioUnit, kAudioOutputUnitProperty_SetInputCallback,
                                      kAudioUnitScope_Input, AudioUnitElement(kInputBus), &captureCallback,
                                      UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        if status != 0 {
            print("Could not set capturing callback!")
            AudioComponentInstanceDispose(audioUnit)
            audioUnit = nil
            return false
        }

        var failedInitializeAttempts = 0
        while status != noErr {
            print("Failed to initialize the Voice Processing I/O unit. Error= %ld.", status)
            failedInitializeAttempts += 1
            if failedInitializeAttempts == kMaxNumberOfAudioUnitInitializeAttempts {
                break
            }
            print("Pause 100ms and try audio unit initialization again.")
            Thread.sleep(forTimeInterval: 0.1)
            status = AudioUnitInitialize(self.audioUnit)
        }

        // Finally, initialize and start the VoiceProcessingIO audio unit.
        if status != 0 {
            print("Could not initialize the audio unit!")
            AudioComponentInstanceDispose(self.audioUnit)
            self.audioUnit = nil
            return false
        }

        captureContext.pointee.audioUnit = self.audioUnit

        return true
    }

    func startAudioUnit() -> Bool {
        let status = AudioOutputUnitStart(self.audioUnit)
        if status != 0 {
            print("Could not start the audio unit!")
            return false
        }
        return true
    }

    func stopAudioUnit() -> Bool {
        let status = AudioOutputUnitStop(self.audioUnit)
        if status != 0 {
            print("Could not stop the audio unit!")
            return false
        }
        return true
    }

    func teardownAudioUnit() {
        if self.audioUnit != nil {
            AudioUnitUninitialize(self.audioUnit)
            AudioComponentInstanceDispose(self.audioUnit)
            self.audioUnit = nil
        }
    }

    // MARK - NSNotification Observers

    var deviceContext: UnsafeMutableRawPointer? {
        if let deviceContext = renderingContext!.deviceContext {
            return deviceContext
        } else if let deviceContext = capturingContext!.deviceContext {
            return deviceContext
        }
        return nil
    }

    func registerAVAudioSessionObservers() {
        let center = NotificationCenter.default

        center.addObserver(self, selector: #selector(handleAudioInterruption(notification:)), name: AVAudioSession.interruptionNotification, object: nil)

        if #available(iOS 10.0, *) {
            // Do nothing, as iOS 10+ behaves correctly with regards to interruptions.
        } else {
            center.addObserver(self, selector: #selector(handleApplicationDidBecomeActive(notification:)), name: UIApplication.didBecomeActiveNotification, object: nil)
        }

        center.addObserver(self, selector: #selector(handleRouteChange(notification:)), name: AVAudioSession.routeChangeNotification, object: nil)
        center.addObserver(self, selector: #selector(handleMediaServiceLost(notification:)), name: AVAudioSession.mediaServicesWereLostNotification, object: nil)
        center.addObserver(self, selector: #selector(handleMediaServiceRestored(notification:)), name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        center.addObserver(self, selector: #selector(handleEngineConfigurationChange(notification:)), name: NSNotification.Name.AVAudioEngineConfigurationChange, object: nil)
    }

    @objc func handleAudioInterruption(notification: Notification) {
        guard let typeRawValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeRawValue) else {
            return
        }

        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }
        
        // If the worker block is executed, then context is guaranteed to be valid.
        guard let context = self.deviceContext else {
            return
        }

        AudioDeviceExecuteWorkerBlock(context: context, block: {
            if type == .began {
                print("Interruption began.")
                self.interrupted = true
                _ = self.stopAudioUnit()
            } else {
                print("Interruption ended.")
                self.interrupted = false
                _ = self.startAudioUnit()
            }
        })
    }

    @objc func handleApplicationDidBecomeActive(notification: Notification) {
        objc_sync_enter(self)
        defer {
            objc_sync_exit(self)
        }
        
        // If the worker block is executed, then context is guaranteed to be valid.
        guard let context = self.deviceContext else {
            return
        }

        AudioDeviceExecuteWorkerBlock(context: context, block: {
            if self.interrupted {
                print("Synthesizing an interruption ended event for iOS 9.x devices.")
                self.interrupted = false
                _ = self.startAudioUnit()
            }
        })
    }

    @objc func handleRouteChange(notification: Notification) {
        guard let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt else { return }
        switch AVAudioSession.RouteChangeReason(rawValue: reason) {
            case .unknown, .newDeviceAvailable, .oldDeviceUnavailable, .categoryChange, .override, .wakeFromSleep, .noSuitableRouteForCategory, .routeConfigurationChange:
                // Each device change might cause the actual sample rate or channel configuration of the session to change.
                // In iOS 9.2+ switching routes from a BT device in control center may cause a category change.
                // With CallKit, AVAudioSession may change the sample rate during a configuration change.
                // If a valid route change occurs we may want to update our audio graph to reflect the new output device.
                objc_sync_enter(self)
                defer { objc_sync_exit(self) }

                if let context = deviceContext {
                    AudioDeviceExecuteWorkerBlock(context: context) {
                        self.handleValidRouteChange()
                    }
                }
            default:
                break
        }
    }

    func handleValidRouteChange() {
        // Nothing to process while we are interrupted. We will interrogate the AVAudioSession once the interruption ends.
        if self.interrupted {
            return
        } else if self.audioUnit == nil {
            return
        }

        print("A route change ocurred while the AudioUnit was started. Checking the active audio format.")

        // Determine if the format actually changed. We only care about sample rate and number of channels.
        let activeFormat = type(of: self).activeFormat()

        // Notify Video SDK about the format change
        if activeFormat != renderingFormat || activeFormat != capturingFormat {
            print("Format changed, restarting with \(String(describing: activeFormat))")

            // Signal a change by clearing our cached format, and allowing TVIAudioDevice to drive the process.
            renderingFormat = nil
            capturingFormat = nil

            objc_sync_enter(self)
            defer { objc_sync_exit(self) }

            if let context = deviceContext {
                AudioDeviceReinitialize(context: context)
            }
        }
    }

    @objc func handleMediaServiceLost(notification: Notification) {
        teardownAudioEngine()

        objc_sync_enter(self)
        defer { objc_sync_exit(self) }

        if let context = deviceContext {
            AudioDeviceExecuteWorkerBlock(context: context) {
                self.teardownAudioUnit()
            }
        }
    }

    @objc func handleMediaServiceRestored(notification: Notification) {
        _ = setupAudioEngine()

        objc_sync_enter(self)
        defer { objc_sync_exit(self) }

        if let context = deviceContext {
            AudioDeviceExecuteWorkerBlock(context: context) {
                _ = self.startAudioUnit()
            }
        }
    }

    @objc func handleEngineConfigurationChange(notification: Notification) {
        print("Engine configuration change: ", notification)
    }

    func unregisterAVAudioSessionObservers() {
        NotificationCenter.default.removeObserver(self)
    }
}
