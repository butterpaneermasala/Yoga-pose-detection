import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import { useRef, useState, useEffect } from 'react'
import Webcam from 'react-webcam'
import { count } from '../../utils/music';
import { detectPoseOnServer, checkServerHealth, imageDataToBase64 } from '../../services/serverPoseService';
import voiceFeedback from '../../utils/voiceFeedback';
import statistics from '../../utils/statistics';
import Achievements from '../../components/Achievements/Achievements';
import { useAuth } from '../../contexts/AuthContext';

import Instructions from '../../components/Instrctions/Instructions';

import './Yoga.css'

import DropDown from '../../components/DropDown/DropDown';
import { poseImages } from '../../utils/pose_images';
import { POINTS, keypointConnections } from '../../utils/data';
import { drawPoint, drawSegment } from '../../utils/helper'



const poseList = [
  'Tree', 'Chair', 'Cobra', 'Warrior', 'Dog',
  'Shoulderstand', 'Traingle'
]


function Yoga() {
  const { user, addSession, addAchievement, getStats } = useAuth()
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const flagRef = useRef(false)
  const skeletonColorRef = useRef('rgb(255,255,255)')
  const sessionStartRef = useRef(null)
  const sessionDataRef = useRef({
    bestHold: 0,
    perfectHolds: 0,
    totalAccuracy: 0,
    accuracyReadings: 0,
    attempts: 1
  })



  const [startingTime, setStartingTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [poseTime, setPoseTime] = useState(0)
  const [bestPerform, setBestPerform] = useState(0)
  const [currentPose, setCurrentPose] = useState('Tree')
  const [isStartPose, setIsStartPose] = useState(false)
  const [newBestTime, setNewBestTime] = useState(false)
  const [previousBest, setPreviousBest] = useState(0)
  const [detectionStatus, setDetectionStatus] = useState('Waiting...')
  const [useServer, setUseServer] = useState(true) // Server mode by default
  const [confidence, setConfidence] = useState(0) // Pose confidence percentage
  const [isLoading, setIsLoading] = useState(false) // Server processing indicator
  const [facingMode, setFacingMode] = useState('user') // 'user' or 'environment'
  const [errorMessage, setErrorMessage] = useState('')
  const [showAchievements, setShowAchievements] = useState(false)
  const [, setNewAchievements] = useState([])
  const [userStats, setUserStats] = useState({})
  const [settings] = useState(() => {
    const saved = localStorage.getItem('yogaSettings')
    return saved ? JSON.parse(saved) : {
      difficulty: 'intermediate',
      voiceFeedback: true,
      confidenceThreshold: 95
    }
  })


  useEffect(() => {
    const timeDiff = (currentTime - startingTime) / 1000
    if (flagRef.current) {
      setPoseTime(timeDiff)
    }
    if ((currentTime - startingTime) / 1000 > bestPerform) {
      // New best time achieved!
      if (bestPerform > 0) { // Only show notification if there was a previous best
        setNewBestTime(true)
        setPreviousBest(bestPerform)
        // Hide notification after 3 seconds
        setTimeout(() => setNewBestTime(false), 3000)
        
        // Voice feedback for new best
        if (settings.voiceFeedback) {
          setTimeout(() => {
            voiceFeedback.speak(`New personal best! ${Math.round(timeDiff)} seconds!`)
          }, 500)
        }
      }
      setBestPerform(timeDiff)
    }
  }, [currentTime, startingTime, bestPerform, settings.voiceFeedback])


  useEffect(() => {
    setCurrentTime(0)
    setPoseTime(0)
    setBestPerform(0)
    setNewBestTime(false)
    setPreviousBest(0)
  }, [currentPose])

  // Cleanup effect to clear intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

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

  function get_pose_size(landmarks, torso_size_multiplier = 2.5) {
    let hips_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    let shoulders_center = get_center_point(landmarks, POINTS.LEFT_SHOULDER, POINTS.RIGHT_SHOULDER)
    let torso_size = tf.norm(tf.sub(shoulders_center, hips_center))
    let pose_center_new = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    pose_center_new = tf.expandDims(pose_center_new, 1)

    pose_center_new = tf.broadcastTo(pose_center_new,
      [1, 17, 2]
    )
    // return: shape(17,2)
    let d = tf.gather(tf.sub(landmarks, pose_center_new), 0, 0)
    let max_dist = tf.max(tf.norm(d, 'euclidean', 0))

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
    let embedding = tf.reshape(landmarks, [1, 34])
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

      intervalRef.current = setInterval(() => {
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
          if (keypoint.score > 0.2) {  // Lowered from 0.4 to 0.2 for better mobile detection
            if (!(keypoint.name === 'left_eye' || keypoint.name === 'right_eye')) {
              drawPoint(ctx, keypoint.x, keypoint.y, 8, 'rgb(255,255,255)')
              console.log('Drawing point:', keypoint.name, 'at', keypoint.x, keypoint.y)
              let connections = keypointConnections[keypoint.name]
              try {
                connections.forEach((connection) => {
                  let conName = connection.toUpperCase()
                  drawSegment(ctx, [keypoint.x, keypoint.y],
                    [keypoints[POINTS[conName]].x,
                    keypoints[POINTS[conName]].y]
                    , skeletonColorRef.current)
                })
              } catch (err) {
                console.error('Error drawing segment:', err)
              }

            }
          } else {
            notDetected += 1
          }
          return [keypoint.x, keypoint.y]
        })
        if (notDetected > 4) {
          skeletonColorRef.current = 'rgb(255,255,255)'
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
          const threshold = settings.confidenceThreshold || 95

          // Track accuracy for every frame
          sessionDataRef.current.totalAccuracy += poseConfidence
          sessionDataRef.current.accuracyReadings += 1

          if (poseConfidence >= threshold) {
            skeletonColorRef.current = 'rgb(0,255,0)' // Green - Perfect!
            if (!flagRef.current) {
              countAudio.play()
              setStartingTime(new Date(Date()).getTime())
              flagRef.current = true

              // Voice feedback for perfect pose
              if (settings.voiceFeedback && Math.random() < 0.3) { // 30% chance
                voiceFeedback.speak(voiceFeedback.getConfidenceMessage(poseConfidence))
              }
            }
            setCurrentTime(new Date(Date()).getTime())

            // Update session statistics in real-time
            const holdTime = (new Date(Date()).getTime() - startingTime) / 1000
            sessionDataRef.current.bestHold = Math.max(sessionDataRef.current.bestHold, holdTime)

            // Count perfect holds (when accuracy is very high)
            if (poseConfidence >= 97 && holdTime >= 1) { // Must hold for at least 1 second
              sessionDataRef.current.perfectHolds += 0.1 // Increment gradually
            }

            statistics.updateSession(holdTime, poseConfidence)

          } else if (poseConfidence >= 80) {
            skeletonColorRef.current = 'rgb(255,165,0)' // Orange - Almost there
            if (flagRef.current && settings.voiceFeedback && Math.random() < 0.1) { // 10% chance
              voiceFeedback.speak(voiceFeedback.getPoseCorrectionMessage(currentPose))
            }
            flagRef.current = false
            countAudio.pause()
            countAudio.currentTime = 0
          } else if (poseConfidence >= 50) {
            skeletonColorRef.current = 'rgb(255,255,0)' // Yellow - Getting close
            flagRef.current = false
            countAudio.pause()
            countAudio.currentTime = 0
          } else {
            skeletonColorRef.current = 'rgb(255,255,255)' // White - Try again
            flagRef.current = false
            countAudio.pause()
            countAudio.currentTime = 0
          }
        })
      } catch (err) {
        console.log(err)
      }


    }
  }

  function startYoga() {
    setIsStartPose(true)
    setErrorMessage('') // Clear any previous errors

    // Start session tracking
    sessionStartRef.current = new Date()
    sessionDataRef.current = {
      bestHold: 0,
      perfectHolds: 0,
      totalAccuracy: 0,
      accuracyReadings: 0,
      attempts: 1
    }
    statistics.startSession(currentPose)

    // Voice feedback for pose start
    if (settings.voiceFeedback) {
      voiceFeedback.speak(voiceFeedback.getPoseStartMessage(currentPose))
    }

    if (useServer) {
      // Check server availability first
      checkServerHealth().then(available => {
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

  async function stopPose() {
    setIsStartPose(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // End session and get results
    const sessionResults = statistics.endSession()
    if (sessionStartRef.current && user) {
      // Calculate average accuracy from tracked data
      const averageAccuracy = sessionDataRef.current.accuracyReadings > 0
        ? sessionDataRef.current.totalAccuracy / sessionDataRef.current.accuracyReadings
        : 0

      const sessionData = {
        pose: currentPose,
        startTime: sessionStartRef.current.toISOString(),
        endTime: new Date().toISOString(),
        bestHold: Math.max(sessionDataRef.current.bestHold, sessionResults?.bestHold || 0),
        averageAccuracy: Math.max(averageAccuracy, sessionResults?.averageAccuracy || 0),
        perfectHolds: Math.round(Math.max(sessionDataRef.current.perfectHolds, sessionResults?.perfectHolds || 0)),
        attempts: 1,
        detectionMode: useServer ? 'server' : 'local'
      }

      // Save session to backend
      try {
        await addSession(sessionData)

        // Voice feedback for session complete
        if (settings.voiceFeedback) {
          voiceFeedback.speak(voiceFeedback.getSessionCompleteMessage(
            Math.round(sessionResults.duration),
            Math.round(sessionResults.averageAccuracy)
          ))
        }

        // Check for new achievements
        const achievements = statistics.checkAchievements()
        if (achievements.length > 0) {
          // Save achievements to backend
          for (const achievementId of achievements) {
            await addAchievement({
              achievementId,
              title: getAchievementTitle(achievementId),
              description: getAchievementDescription(achievementId)
            })
          }

          setNewAchievements(achievements)
          setShowAchievements(true)

          // Voice feedback for achievements
          if (settings.voiceFeedback) {
            achievements.forEach(achievement => {
              setTimeout(() => {
                voiceFeedback.speak(voiceFeedback.getAchievementMessage(achievement))
              }, 2000)
            })
          }
        }

        // Update stats display
        const updatedStats = await getStats()
        if (updatedStats) {
          setUserStats(updatedStats)
        }
      } catch (error) {
        console.error('Error saving session:', error)
        // Fallback to local storage if backend fails
        setUserStats(statistics.getStats())
      }
    }

    setConfidence(0)
    setIsLoading(false)
    flagRef.current = false
    skeletonColorRef.current = 'rgb(255,255,255)'
    setDetectionStatus('Waiting...')
  }

  // Helper functions for achievements
  function getAchievementTitle(achievementId) {
    const titles = {
      'first_perfect': 'First Perfect Pose',
      'pose_master': 'Pose Master',
      'streak_7': '7-Day Warrior',
      'time_master': 'Time Master',
      'dedicated': 'Dedicated Practitioner',
      'consistency_king': 'Consistency King',
      'accuracy_expert': 'Accuracy Expert'
    }
    return titles[achievementId] || 'Achievement Unlocked'
  }

  function getAchievementDescription(achievementId) {
    const descriptions = {
      'first_perfect': 'Achieve 97% accuracy on any pose',
      'pose_master': 'Perfect all 7 yoga poses',
      'streak_7': 'Practice yoga for 7 consecutive days',
      'time_master': 'Hold a pose for 30+ seconds',
      'dedicated': 'Complete 100 practice sessions',
      'consistency_king': '30-day practice streak',
      'accuracy_expert': 'Maintain 95% average accuracy'
    }
    return descriptions[achievementId] || 'You achieved something great!'
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

    intervalRef.current = setInterval(async () => {
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
          skeletonColorRef.current = 'rgb(255,255,255)';
          flagRef.current = false;
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
              drawPoint(ctx, x, y, 8, skeletonColorRef.current);

              // Draw connections
              if (keypointConnections[keypoint.name]) {
                keypointConnections[keypoint.name].forEach(targetName => {
                  const targetKeypoint = keypoints.find(kp => kp.name === targetName);
                  if (targetKeypoint && targetKeypoint.score > 0.2) {
                    const x2 = targetKeypoint.x * videoWidth;
                    const y2 = targetKeypoint.y * videoHeight;
                    drawSegment(ctx, [x, y], [x2, y2], skeletonColorRef.current);
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
          skeletonColorRef.current = 'rgb(255,255,255)';
          flagRef.current = false;
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

            // Track accuracy for every frame (server mode)
            sessionDataRef.current.totalAccuracy += poseConfidence
            sessionDataRef.current.accuracyReadings += 1

            // Color-coded skeleton based on confidence
            const threshold = settings.confidenceThreshold || 95

            if (poseConfidence >= threshold) {
              if (!flagRef.current) {
                countAudio.play();
                setStartingTime(new Date(Date()).getTime());
                flagRef.current = true;
              }
              setCurrentTime(new Date(Date()).getTime());

              // Update session statistics in real-time (server mode)
              const holdTime = (new Date(Date()).getTime() - startingTime) / 1000
              sessionDataRef.current.bestHold = Math.max(sessionDataRef.current.bestHold, holdTime)

              // Count perfect holds (when accuracy is very high)
              if (poseConfidence >= 97 && holdTime >= 1) { // Must hold for at least 1 second
                sessionDataRef.current.perfectHolds += 0.1 // Increment gradually
              }

              skeletonColorRef.current = 'rgb(0,255,0)'; // Green - Perfect!
            } else if (poseConfidence >= 80) {
              flagRef.current = false;
              skeletonColorRef.current = 'rgb(255,165,0)'; // Orange - Almost there
              countAudio.pause();
              countAudio.currentTime = 0;
            } else if (poseConfidence >= 50) {
              flagRef.current = false;
              skeletonColorRef.current = 'rgb(255,255,0)'; // Yellow - Getting close
              countAudio.pause();
              countAudio.currentTime = 0;
            } else {
              flagRef.current = false;
              skeletonColorRef.current = 'rgb(255,255,255)'; // White - Try again
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



  if (isStartPose) {
    return (
      <div className="yoga-container">

        {/* New Best Time Notification */}
        {newBestTime && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'slideDown 0.5s ease-out'
          }}>
            🎉 New Personal Best! 
            <div style={{ fontSize: '14px', marginTop: '5px' }}>
              Previous: {previousBest.toFixed(1)}s → New: {bestPerform.toFixed(1)}s
            </div>
          </div>
        )}

        {/* Achievements Popup */}
        {showAchievements && (
          <div className="achievements-popup">
            <div className="achievements-popup-content">
              <h2>🎉 New Achievements!</h2>
              <Achievements userStats={userStats} />
              <button
                onClick={() => setShowAchievements(false)}
                className="close-achievements-btn"
              >
                Continue
              </button>
            </div>
          </div>
        )}
        <div className="performance-container">
          <div className="pose-performance">
            <h4 style={{ fontSize: '20px', margin: '5px 0' }}>⏱️ {poseTime.toFixed(1)}s</h4>
          </div>
          <div className="pose-performance">
            <h4 style={{ fontSize: '16px', margin: '5px 0' }}>🏆 Best: {bestPerform.toFixed(1)}s</h4>
          </div>
          <div className="pose-performance">
            <h4 style={{ fontSize: '16px', margin: '5px 0' }}>✨ Perfect: {Math.round(sessionDataRef.current.perfectHolds)}</h4>
          </div>
          <div className="pose-performance">
            <h4 style={{ fontSize: '16px', margin: '5px 0' }}>📊 Avg: {sessionDataRef.current.accuracyReadings > 0 ? Math.round(sessionDataRef.current.totalAccuracy / sessionDataRef.current.accuracyReadings) : 0}%</h4>
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

        {/* Processing indicator - show loading state */}
        <div style={{ textAlign: 'center', color: 'white', fontSize: '14px', margin: '5px 0', pointerEvents: 'none' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 8 }}>⏳</span>
          {isLoading ? 'Server Processing...' : 'AI Processing...'}
        </div>

        <div style={{ textAlign: 'center', color: 'white', margin: '10px 0', fontSize: '16px', fontWeight: 'bold' }}>
          {detectionStatus}
        </div>

        <div className="video-container">
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
                zIndex: 1,
                pointerEvents: 'none'
              }}
            >
            </canvas>
          </div>
        </div>

        <img
          src={poseImages[currentPose]}
          className="pose-img"
          alt={currentPose + " pose"}
        />

        <div style={{ textAlign: 'center', margin: '15px 0', position: 'relative', zIndex: 100 }}>
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
              cursor: 'pointer',
              position: 'relative',
              zIndex: 100
            }}
          >
            🔄 Flip Camera
          </button>
          <button
            onClick={stopPose}
            className="secondary-btn"
            style={{
              position: 'relative',
              zIndex: 100
            }}
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