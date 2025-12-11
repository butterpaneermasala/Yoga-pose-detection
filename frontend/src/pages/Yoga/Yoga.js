import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import React, { useRef, useState, useEffect } from 'react'
import backend from '@tensorflow/tfjs-backend-webgl'
import Webcam from 'react-webcam'
import { count } from '../../utils/music'; 
import { detectPoseOnServer, checkServerHealth, imageDataToBase64 } from '../../services/serverPoseService';
 
import Instructions from '../../components/Instrctions/Instructions';

import './Yoga.css'
 
import DropDown from '../../components/DropDown/DropDown';
import { poseImages } from '../../utils/pose_images';
import { POINTS, keypointConnections } from '../../utils/data';
import { drawPoint, drawSegment } from '../../utils/helper'



let skeletonColor = 'rgb(255,255,255)'
let poseList = [
  'Tree', 'Chair', 'Cobra', 'Warrior', 'Dog',
  'Shoulderstand', 'Traingle'
]

let interval

// flag variable is used to help capture the time when AI just detect 
// the pose as correct(probability more than threshold)
let flag = false


function Yoga() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)


  const [startingTime, setStartingTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [poseTime, setPoseTime] = useState(0)
  const [bestPerform, setBestPerform] = useState(0)
  const [currentPose, setCurrentPose] = useState('Tree')
  const [isStartPose, setIsStartPose] = useState(false)
  const [detectionStatus, setDetectionStatus] = useState('Waiting...')
  const [useServer, setUseServer] = useState(true) // Server mode by default
  const [serverAvailable, setServerAvailable] = useState(false)
  const [confidence, setConfidence] = useState(0) // Pose confidence percentage
  const [isLoading, setIsLoading] = useState(false) // Server processing indicator
  const [facingMode, setFacingMode] = useState('user') // 'user' or 'environment'
  const [errorMessage, setErrorMessage] = useState('')

  
  useEffect(() => {
    const timeDiff = (currentTime - startingTime)/1000
    if(flag) {
      setPoseTime(timeDiff)
    }
    if((currentTime - startingTime)/1000 > bestPerform) {
      setBestPerform(timeDiff)
    }
  }, [currentTime])


  useEffect(() => {
    setCurrentTime(0)
    setPoseTime(0)
    setBestPerform(0)
  }, [currentPose])

  const CLASS_NO = {
    Chair: 0,
    Cobra: 1,
    Dog: 2,
    No_Pose: 3,
    Shoulderstand: 4,
    Traingle: 5,
    Tree: 6,
    Warrior: 7,
  }

  function get_center_point(landmarks, left_bodypart, right_bodypart) {
    let left = tf.gather(landmarks, left_bodypart, 1)
    let right = tf.gather(landmarks, right_bodypart, 1)
    const center = tf.add(tf.mul(left, 0.5), tf.mul(right, 0.5))
    return center
    
  }

  function get_pose_size(landmarks, torso_size_multiplier=2.5) {
    let hips_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    let shoulders_center = get_center_point(landmarks,POINTS.LEFT_SHOULDER, POINTS.RIGHT_SHOULDER)
    let torso_size = tf.norm(tf.sub(shoulders_center, hips_center))
    let pose_center_new = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    pose_center_new = tf.expandDims(pose_center_new, 1)

    pose_center_new = tf.broadcastTo(pose_center_new,
        [1, 17, 2]
      )
      // return: shape(17,2)
    let d = tf.gather(tf.sub(landmarks, pose_center_new), 0, 0)
    let max_dist = tf.max(tf.norm(d,'euclidean', 0))

    // normalize scale
    let pose_size = tf.maximum(tf.mul(torso_size, torso_size_multiplier), max_dist)
    return pose_size
  }

  function normalize_pose_landmarks(landmarks) {
    let pose_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    pose_center = tf.expandDims(pose_center, 1)
    pose_center = tf.broadcastTo(pose_center, 
        [1, 17, 2]
      )
    landmarks = tf.sub(landmarks, pose_center)

    let pose_size = get_pose_size(landmarks)
    landmarks = tf.div(landmarks, pose_size)
    return landmarks
  }

  function landmarks_to_embedding(landmarks) {
    // normalize landmarks 2D
    landmarks = normalize_pose_landmarks(tf.expandDims(landmarks, 0))
    let embedding = tf.reshape(landmarks, [1,34])
    return embedding
  }

  const runMovenet = async () => {
    try {
      console.log('Initializing TensorFlow.js...')
      await tf.ready()
      console.log('TensorFlow.js ready, backend:', tf.getBackend())
      
      // Use LIGHTNING model for better mobile performance
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true
      };
      console.log('Loading MoveNet detector (LIGHTNING for mobile)...')
      const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
      console.log('MoveNet loaded successfully')
      
      console.log('Loading pose classifier...')
      const poseClassifier = await tf.loadLayersModel('https://models.s3.jp-tok.cloud-object-storage.appdomain.cloud/model.json')
      console.log('Pose classifier loaded successfully')
      
      const countAudio = new Audio(count)
      countAudio.loop = true
      
      // Wait for webcam to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Starting pose detection...')
      
      interval = setInterval(() => { 
          detectPose(detector, poseClassifier, countAudio)
      }, 400)  // Increased to 400ms for smooth mobile performance (~2.5 FPS)
    } catch (error) {
      console.error('Error initializing pose detection:', error)
      setErrorMessage('Failed to load AI models. Please check your internet connection.')
      setTimeout(() => setErrorMessage(''), 5000)
    }
  }

  const detectPose = async (detector, poseClassifier, countAudio) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      let notDetected = 0 
      const video = webcamRef.current.video
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight
      
      // Set canvas size to match video
      canvasRef.current.width = videoWidth
      canvasRef.current.height = videoHeight
      
      const pose = await detector.estimatePoses(video)
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Check if pose was detected
      if (!pose || pose.length === 0 || !pose[0] || !pose[0].keypoints) {
        console.log('No pose detected in frame')
        setDetectionStatus('No pose detected - move into frame')
        return
      }
      
      console.log('Pose detected! Keypoints:', pose[0].keypoints.length)
      setDetectionStatus(`✓ Pose detected! ${pose[0].keypoints.length} keypoints`)
      
      try {
        const keypoints = pose[0].keypoints 
        let input = keypoints.map((keypoint) => {
          if(keypoint.score > 0.2) {  // Lowered from 0.4 to 0.2 for better mobile detection
            if(!(keypoint.name === 'left_eye' || keypoint.name === 'right_eye')) {
              drawPoint(ctx, keypoint.x, keypoint.y, 8, 'rgb(255,255,255)')
              console.log('Drawing point:', keypoint.name, 'at', keypoint.x, keypoint.y)
              let connections = keypointConnections[keypoint.name]
              try {
                connections.forEach((connection) => {
                  let conName = connection.toUpperCase()
                  drawSegment(ctx, [keypoint.x, keypoint.y],
                      [keypoints[POINTS[conName]].x,
                       keypoints[POINTS[conName]].y]
                  , skeletonColor)
                })
              } catch(err) {
                console.error('Error drawing segment:', err)
              }
              
            }
          } else {
            notDetected += 1
          } 
          return [keypoint.x, keypoint.y]
        }) 
        if(notDetected > 4) {
          skeletonColor = 'rgb(255,255,255)'
          return
        }
        const processedInput = landmarks_to_embedding(input)
        const classification = poseClassifier.predict(processedInput)

        classification.array().then((data) => {         
          const classNo = CLASS_NO[currentPose]
          const poseConfidence = data[0][classNo] * 100 // Convert to percentage
          setConfidence(Math.round(poseConfidence))
          console.log('Confidence:', poseConfidence.toFixed(1) + '%')
          
          // Color-coded skeleton based on confidence
          if(poseConfidence >= 97) {
            skeletonColor = 'rgb(0,255,0)' // Green - Perfect!
            if(!flag) {
              countAudio.play()
              setStartingTime(new Date(Date()).getTime())
              flag = true
            }
            setCurrentTime(new Date(Date()).getTime())
          } else if(poseConfidence >= 80) {
            skeletonColor = 'rgb(255,165,0)' // Orange - Almost there
            flag = false
            countAudio.pause()
            countAudio.currentTime = 0
          } else if(poseConfidence >= 50) {
            skeletonColor = 'rgb(255,255,0)' // Yellow - Getting close
            flag = false
            countAudio.pause()
            countAudio.currentTime = 0
          } else {
            skeletonColor = 'rgb(255,255,255)' // White - Try again
            flag = false
            countAudio.pause()
            countAudio.currentTime = 0
          }
        })
      } catch(err) {
        console.log(err)
      }
      
      
    }
  }

  function startYoga(){
    setIsStartPose(true)
    setErrorMessage('') // Clear any previous errors
    if (useServer) {
      // Check server availability first
      checkServerHealth().then(available => {
        setServerAvailable(available);
        if (available) {
          console.log('Using server-based detection');
          setErrorMessage('');
          runServerDetection();
        } else {
          setErrorMessage('Server unavailable. Switching to local detection...');
          setTimeout(() => setErrorMessage(''), 3000);
          setUseServer(false);
          runMovenet();
        }
      }).catch(err => {
        setErrorMessage('Connection error. Using local detection...');
        setTimeout(() => setErrorMessage(''), 3000);
        setUseServer(false);
        runMovenet();
      });
    } else {
      runMovenet();
    }
  } 

  function stopPose() {
    setIsStartPose(false)
    clearInterval(interval)
    setConfidence(0)
    setIsLoading(false)
  }

  function toggleCamera() {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user')
  }

  const runServerDetection = async () => {
    console.log('Loading pose classifier for server mode...')
    const poseClassifier = await tf.loadLayersModel('https://models.s3.jp-tok.cloud-object-storage.appdomain.cloud/model.json')
    console.log('Pose classifier loaded')
    
    const countAudio = new Audio(count);
    countAudio.loop = true;
    
    // Create a hidden canvas for capturing frames
    const captureCanvas = document.createElement('canvas');
    
    // Keypoint names in MoveNet order
    const keypointNames = [
      'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
      'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
      'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    interval = setInterval(async () => {
      if (
        typeof webcamRef.current !== "undefined" &&
        webcamRef.current !== null &&
        webcamRef.current.video.readyState === 4
      ) {
        setIsLoading(true) // Start loading
        
        const video = webcamRef.current.video;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Update canvas size
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        
        // Convert frame to base64
        const base64Image = imageDataToBase64(captureCanvas, video);
        
        // Send to server
        const serverKeypoints = await detectPoseOnServer(base64Image);
        
        setIsLoading(false) // Stop loading
        
        if (!serverKeypoints || serverKeypoints.length === 0) {
          setDetectionStatus('No pose detected - move into frame');
          setConfidence(0);
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          skeletonColor = 'rgb(255,255,255)';
          flag = false;
          countAudio.pause();
          countAudio.currentTime = 0;
          return;
        }
        
        setDetectionStatus(`✓ Server detected! ${serverKeypoints.length} keypoints`);
        
        // Add names to keypoints
        const keypoints = serverKeypoints.map((kp, i) => ({
          ...kp,
          name: keypointNames[i],
          x: kp.x,
          y: kp.y,
          score: kp.score
        }));
        
        // Draw keypoints on canvas
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        let notDetected = 0;
        
        // Draw skeleton and prepare input for classifier
        const input = keypoints.map((keypoint) => {
          if (keypoint.score > 0.2) {
            if (keypoint.name !== 'left_eye' && keypoint.name !== 'right_eye') {
              const x = keypoint.x * videoWidth;
              const y = keypoint.y * videoHeight;
              drawPoint(ctx, x, y, 8, skeletonColor);
              
              // Draw connections
              if (keypointConnections[keypoint.name]) {
                keypointConnections[keypoint.name].forEach(targetName => {
                  const targetKeypoint = keypoints.find(kp => kp.name === targetName);
                  if (targetKeypoint && targetKeypoint.score > 0.2) {
                    const x2 = targetKeypoint.x * videoWidth;
                    const y2 = targetKeypoint.y * videoHeight;
                    drawSegment(ctx, [x, y], [x2, y2], skeletonColor);
                  }
                });
              }
            }
          } else {
            notDetected += 1;
          }
          return [keypoint.x * videoWidth, keypoint.y * videoHeight];
        });
        
        if (notDetected > 4) {
          skeletonColor = 'rgb(255,255,255)';
          flag = false;
          countAudio.pause();
          countAudio.currentTime = 0;
          return;
        }
        
        // Run pose classification
        try {
          const processedInput = landmarks_to_embedding(input);
          const classification = poseClassifier.predict(processedInput);
          
          classification.array().then((data) => {
            const classNo = CLASS_NO[currentPose];
            const poseConfidence = data[0][classNo] * 100;
            setConfidence(Math.round(poseConfidence));
            console.log('Pose confidence:', poseConfidence.toFixed(1) + '%');
            
            // Color-coded skeleton based on confidence
            if (poseConfidence >= 97) {
              if (!flag) {
                countAudio.play();
                setStartingTime(new Date(Date()).getTime());
                flag = true;
              }
              setCurrentTime(new Date(Date()).getTime());
              skeletonColor = 'rgb(0,255,0)'; // Green - Perfect!
            } else if (poseConfidence >= 80) {
              flag = false;
              skeletonColor = 'rgb(255,165,0)'; // Orange - Almost there
              countAudio.pause();
              countAudio.currentTime = 0;
            } else if (poseConfidence >= 50) {
              flag = false;
              skeletonColor = 'rgb(255,255,0)'; // Yellow - Getting close
              countAudio.pause();
              countAudio.currentTime = 0;
            } else {
              flag = false;
              skeletonColor = 'rgb(255,255,255)'; // White - Try again
              countAudio.pause();
              countAudio.currentTime = 0;
            }
          });
        } catch (err) {
          console.error('Classification error:', err);
        }
      }
    }, 500); // 500ms for server round-trip
  };

    

  if(isStartPose) {
    return (
      <div className="yoga-container">
        <div className="performance-container">
            <div className="pose-performance">
              <h4 style={{ fontSize: '24px', margin: '5px 0' }}>⏱️ {poseTime.toFixed(1)}s</h4>
            </div>
            <div className="pose-performance">
              <h4 style={{ fontSize: '18px', margin: '5px 0' }}>🏆 Best: {bestPerform.toFixed(1)}s</h4>
            </div>
          </div>
        
        {/* Confidence Meter */}
        <div style={{ padding: '10px 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '5px', color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
            Accuracy: {confidence}%
          </div>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            backgroundColor: '#333', 
            borderRadius: '10px',
            overflow: 'hidden',
            border: '2px solid #555'
          }}>
            <div style={{ 
              width: `${confidence}%`, 
              height: '100%', 
              backgroundColor: confidence >= 97 ? '#00ff00' : confidence >= 80 ? '#ffa500' : confidence >= 50 ? '#ffff00' : '#fff',
              transition: 'width 0.3s ease, background-color 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#000'
            }}>
              {confidence > 10 && `${confidence}%`}
            </div>
          </div>
          <div style={{ marginTop: '5px', fontSize: '12px', color: '#aaa' }}>
            {confidence >= 97 ? '✓ Perfect!' : confidence >= 80 ? '⚠️ Almost there!' : confidence >= 50 ? '↗️ Getting close' : '↻ Keep trying'}
          </div>
        </div>

        {/* Error Messages */}
        {errorMessage && (
          <div style={{ 
            padding: '10px', 
            margin: '10px 20px', 
            backgroundColor: 'rgba(255, 165, 0, 0.2)', 
            border: '1px solid orange',
            borderRadius: '5px',
            color: 'orange',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ textAlign: 'center', color: 'white', fontSize: '14px', margin: '5px 0' }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Processing...
          </div>
        )}

        <div style={{ textAlign: 'center', color: 'white', margin: '10px 0', fontSize: '16px', fontWeight: 'bold' }}>
          {detectionStatus}
        </div>
        
        <div style={{ position: 'relative', display: 'inline-block' }}>
          
          <Webcam 
          id="webcam"
          ref={webcamRef}
          videoConstraints={{ facingMode }}
          style={{
            display: 'block',
            margin: '0 auto',
            width: '100%',
            maxWidth: '640px',
          }}
        />
          <canvas
            ref={canvasRef}
            id="my-canvas"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 1
            }}
          >
          </canvas>
        <div>
            <img 
              src={poseImages[currentPose]}
              className="pose-img"
              alt={currentPose + " pose"}
            />
          </div>
         
        </div>
        
        <div style={{ textAlign: 'center', margin: '15px 0' }}>
          <button
            onClick={toggleCamera}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🔄 Flip Camera
          </button>
          <button
            onClick={stopPose}
            className="secondary-btn"    
          >Stop Pose</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="yoga-container"
    >
      <DropDown
        poseList={poseList}
        currentPose={currentPose}
        setCurrentPose={setCurrentPose}
      />
      <Instructions
          currentPose={currentPose}
        />
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <label style={{ color: 'white', fontSize: '16px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={useServer} 
            onChange={(e) => setUseServer(e.target.checked)}
            style={{ marginRight: '10px', transform: 'scale(1.5)' }}
          />
          Use Server Detection (More Accurate)
        </label>
      </div>
      <button
          onClick={startYoga}
          className="secondary-btn"    
        >Start Pose</button>
    </div>
  )
}

export default Yoga