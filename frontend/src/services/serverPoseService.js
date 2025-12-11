/**
 * Server-based pose detection service
 * Sends camera frames to FastAPI server for more accurate detection
 */

const SERVER_URL = 'https://satyaorz-yoga-pose-detection.hf.space';

export async function detectPoseOnServer(imageData) {
  try {
    // Send base64 image to server
    const formData = new FormData();
    formData.append('image_data', imageData);
    
    const response = await fetch(`${SERVER_URL}/detect_base64`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.keypoints;
    
  } catch (error) {
    console.error('Server pose detection error:', error);
    return null;
  }
}

export async function checkServerHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.status === 'ok';
    }
    return false;
  } catch (error) {
    console.error('Server health check failed:', error);
    return false;
  }
}

export function imageDataToBase64(canvas, video) {
  // Draw video frame to canvas
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  
  // Get base64 data (remove data:image/jpeg;base64, prefix)
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  return base64;
}
