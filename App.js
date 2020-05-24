import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';
import io from 'socket.io-client';

const dimensions = Dimensions.get('window');

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConn, setPeerConn] = useState(null);
  const [sdp, setSdp] = useState('');
  const [socket, setSocket] = useState(null);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    setSocket(io('https://d566ee81.ngrok.io/webrtcPeer'));

    const pc_config = {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
      ],
    };
    setPeerConn(new RTCPeerConnection(pc_config));
  }, []);

  useEffect(() => {
    console.log('Use Effect Called');
    const constraint = {video: true};
    if (peerConn) {
      peerConn.onicecandidate = e => {
        if (e.candidate) {
          console.log('onicecandidate Candidate ', e.candidate);
          sendToServer('candidate', e.candidate);
        }
      };

      peerConn.oniceconnectionstatechange = e => {
        console.log('Ice connection changed', e);
      };

      peerConn.onaddstream = e => {
        setRemoteStream(e.stream);
      };

      let isFront = true;
      mediaDevices.enumerateDevices().then(sourceInfos => {
        console.log(sourceInfos);
        let videoSourceId;
        for (let i = 0; i < sourceInfos.length; i++) {
          const sourceInfo = sourceInfos[i];
          if (
            sourceInfo.kind == 'videoinput' &&
            sourceInfo.facing == (isFront ? 'front' : 'environment')
          ) {
            videoSourceId = sourceInfo.deviceId;
          }
        }
        mediaDevices
          .getUserMedia({
            audio: true,
            video: {
              mandatory: {
                minWidth: 500, // Provide your own width, height and frame rate here
                minHeight: 300,
                minFrameRate: 30,
              },
              facingMode: isFront ? 'user' : 'environment',
              optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
            },
          })
          .then(stream => {
            setLocalStream(stream);
            if (peerConn) peerConn.addStream(stream);
          })
          .catch(error => {
            console.log('Error while getting camera ', error);
          });
      });
    }
  }, [peerConn]);

  useEffect(() => {
    if (socket) {
      socket.on('connection-success', success => {
        console.log(success);
      });
      socket.on('offerOrAnswer', sdp => {
        setSdp(JSON.stringify(sdp));
        peerConn.setRemoteDescription(new RTCSessionDescription(sdp));
      });
      socket.on('candidate', candidate => {
        console.log('on candidate ', candidate);
        peerConn.addIceCandidate(new RTCIceCandidate(candidate));
      });
    }
    return () => {
      if (socket) socket.close();
    };
  }, [socket]);

  const createOffer = () => {
    peerConn.createOffer({offerToReceiveVideo: 1}).then(
      sdp => {
        peerConn.setLocalDescription(sdp);
        sendToServer('offerOrAnswer', sdp);
      },
      e => {
        console.log('Error create offer', e);
      },
    );
  };

  const createAnswer = () => {
    peerConn.createAnswer({offerToReceiveVideo: 1}).then(
      sdp => {
        peerConn.setLocalDescription(sdp);
        sendToServer('offerOrAnswer', sdp);
      },
      e => {
        console.log('Error create answer', e);
      },
    );
  };

  const sendToServer = (type, payload) => {
    socket.emit(type, {
      socketId: socket.id,
      payload,
    });
  };

  const remoteVideo = () => {
    return remoteStream ? (
      <RTCView
        key={2}
        mirror={true}
        objectFit="contain"
        style={styles.rtcRemoteView}
        streamURL={remoteStream && remoteStream.toURL()}
      />
    ) : (
      <View>
        <Text style={styles.loadingText}>Waiting for Peer Connection...</Text>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.mainContainer}>
        <View style={styles.allBtnContainer}>
          <View style={styles.btnContainer}>
            <TouchableOpacity onPress={createOffer}>
              <Text style={styles.btnText}>Call</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.btnContainer}>
            <TouchableOpacity onPress={createAnswer}>
              <Text style={styles.btnText}>Answer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.videosContainer}>
          <ScrollView style={styles.scrollView}>
            <View style={styles.remoteVideoContainer}>{remoteVideo()}</View>
          </ScrollView>
          <View style={styles.localVideoContainer}>
            <TouchableOpacity onPress={() => localStream._tracks[1]._switchCamera()}>
              <RTCView
                key={1}
                zOrder={0}
                objectFit="cover"
                style={styles.rtcLocalView}
                streamURL={localStream && localStream.toURL()}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  allBtnContainer: {flexDirection: 'row'},
  btnContainer: {
    paddingVertical: 8,
    margin: 4,
    backgroundColor: 'green',
    borderRadius: 5,
    flex: 1,
  },
  btnText: {color: 'white', fontSize: 18, textAlign: 'center'},
  videosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  localVideoContainer: {
    position: 'absolute',
    backgroundColor: 'black',
    height: 250,
    width: 150,
    bottom: 10,
    right: 10,
    elevation: 10,
    zIndex: 1000,
  },
  rtcLocalView: {
    width: 150,
    height: 250,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
    padding: 16,
    backgroundColor: 'teal',
  },
  remoteVideoContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 22,
    padding: 16,
  },
  rtcRemoteView: {
    width: dimensions.width - 30,
    height: dimensions.height,
    backgroundColor: 'black',
  },
});

export default App;
