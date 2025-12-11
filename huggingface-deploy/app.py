"""
Yoga Pose Detection API - Hugging Face Spaces Deployment
FastAPI server for pose detection using MoveNet Thunder model
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import uvicorn

app = FastAPI(title="Yoga Pose Detection API")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load MoveNet model
print("Loading MoveNet Thunder model...")
interpreter = tf.lite.Interpreter(model_path="movenet_thunder.tflite")
interpreter.allocate_tensors()
print("Model loaded successfully!")

def preprocess_image(image):
    """Preprocess image for MoveNet model"""
    # Resize to 256x256 (MoveNet Thunder input size)
    image = image.resize((256, 256))
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')
    # Convert to numpy array and normalize
    image_np = np.array(image, dtype=np.uint8)
    # Add batch dimension
    input_image = np.expand_dims(image_np, axis=0)
    return input_image

def run_inference(image):
    """Run pose detection inference"""
    # Get input and output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Preprocess image
    input_image = preprocess_image(image)
    
    # Set input tensor
    interpreter.set_tensor(input_details[0]['index'], input_image)
    
    # Run inference
    interpreter.invoke()
    
    # Get output
    keypoints_with_scores = interpreter.get_tensor(output_details[0]['index'])
    
    # Extract keypoints (17 keypoints with y, x, score)
    keypoints = keypoints_with_scores[0][0]  # Shape: [17, 3]
    
    # Convert to list format
    result = []
    for i in range(17):
        result.append({
            'y': float(keypoints[i][0]),
            'x': float(keypoints[i][1]),
            'score': float(keypoints[i][2])
        })
    
    return result

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"message": "Yoga Pose Detection Server Running", "status": "ok"}

@app.post("/detect")
async def detect_pose(file: UploadFile = File(...)):
    """Detect pose from uploaded image file"""
    try:
        # Read image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Run inference
        keypoints = run_inference(image)
        
        return JSONResponse(content={"keypoints": keypoints})
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.post("/detect_base64")
async def detect_pose_base64(image_data: str = Form(...)):
    """Detect pose from base64 encoded image"""
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Run inference
        keypoints = run_inference(image)
        
        return JSONResponse(content={"keypoints": keypoints})
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
