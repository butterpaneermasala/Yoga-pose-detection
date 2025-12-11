# Yoga Pose Detection API

A FastAPI server for real-time yoga pose detection using MoveNet Thunder model.

## Deployment on Hugging Face Spaces

### Step 1: Create a New Space

1. Go to [Hugging Face Spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Choose:
   - **Space name**: `yoga-pose-detection`
   - **License**: Apache 2.0
   - **Space SDK**: Gradio (will change to custom Docker)
   - **Space hardware**: CPU basic (free)
4. Click "Create Space"

### Step 2: Upload Files

Upload these files to your Space:

1. `app.py` - FastAPI application
2. `requirements.txt` - Python dependencies
3. `movenet_thunder.tflite` - MoveNet model (13MB)

### Step 3: Add Dockerfile

Create a `Dockerfile` in your Space:

```dockerfile
FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
```

### Step 4: Configure Space

Add a `README.md` header to your Space:

```yaml
---
title: Yoga Pose Detection
emoji: 🧘
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---
```

### Alternative: Push via Git

```bash
# Clone your space
git clone https://huggingface.co/spaces/YOUR_USERNAME/yoga-pose-detection
cd yoga-pose-detection

# Copy files
cp app.py requirements.txt movenet_thunder.tflite ./

# Commit and push
git add .
git commit -m "Initial deployment"
git push
```

## API Endpoints

### GET /
Health check endpoint

**Response:**
```json
{
  "message": "Yoga Pose Detection Server Running",
  "status": "ok"
}
```

### POST /detect
Detect pose from uploaded image file

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (image file)

**Response:**
```json
{
  "keypoints": [
    {"x": 0.5, "y": 0.3, "score": 0.95},
    ...
  ]
}
```

### POST /detect_base64
Detect pose from base64 encoded image

**Request:**
- Content-Type: `application/x-www-form-urlencoded`
- Body: `image_data` (base64 string)

**Response:**
```json
{
  "keypoints": [
    {"x": 0.5, "y": 0.3, "score": 0.95},
    ...
  ]
}
```

## Your Space URL

Once deployed, your API will be available at:
```
https://YOUR_USERNAME-yoga-pose-detection.hf.space
```

## Usage in Mobile App

Update `frontend/src/services/serverPoseService.js`:

```javascript
const SERVER_URL = 'https://YOUR_USERNAME-yoga-pose-detection.hf.space';
```

Then rebuild the APK.

## Notes

- **Always online**: Hugging Face Spaces don't sleep
- **Free tier**: CPU basic is free forever
- **13MB model**: Fits within Space limits
- **CORS enabled**: Works from any origin
