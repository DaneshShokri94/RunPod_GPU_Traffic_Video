# Traffic Monitor — Real-Time Vehicle Analysis SaaS

Upload a video, draw ROIs, get vehicle counts, trajectories, and near-miss analysis powered by YOLOv8 on a cloud GPU.

## Architecture

```
Browser (Cloudflare Pages)
  └── uploads video → Cloudflare R2
  └── draws ROIs on canvas
  └── WebSocket → Cloudflare Worker (Durable Objects)
                      └── proxies → GPU Server (RunPod)
                                      └── YOLOv8 + ByteTrack
                                      └── ROI counting
                                      └── Near-miss TTC/PET
                                      └── streams results back
```

## Project Structure

```
traffic-monitor/
├── frontend/        React app → deploy to Cloudflare Pages
├── worker/          Cloudflare Worker → handles routing + Durable Objects
└── gpu-server/      Python WebSocket server → deploy to RunPod (GPU)
```

---

## Quick Start

### 1. GPU Server (RunPod)

```bash
cd gpu-server
pip install -r requirements.txt

# local test (CPU)
python server.py

# deploy to RunPod via Docker
docker build -t traffic-gpu .
# push to Docker Hub, then launch on RunPod with GPU
```

Set environment variable on RunPod:
```
PORT=8765
```

Note your RunPod pod IP/URL — you'll need it for the Worker config.

---

### 2. Cloudflare Worker

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml`:
- Set your R2 bucket name
- Set `GPU_SERVER_URL` = your RunPod WebSocket URL

```bash
# create R2 bucket
npx wrangler r2 bucket create traffic-videos

# create KV namespace
npx wrangler kv:namespace create TRAFFIC_KV

# deploy
npx wrangler deploy
```

---

### 3. Frontend (Cloudflare Pages)

```bash
cd frontend
npm install

# set your Worker URL
echo "VITE_WORKER_URL=https://your-worker.workers.dev" > .env

npm run build

# deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=traffic-monitor
```

---

## Environment Variables

### Worker (`wrangler.toml`)
| Variable | Description |
|---|---|
| `GPU_SERVER_URL` | WebSocket URL of your RunPod GPU server |

### Frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_WORKER_URL` | Your Cloudflare Worker URL |

---

## Features

- Upload any MP4/AVI/MOV video
- Draw unlimited ROI polygons on the first frame
- Draw directional counting lines
- Real-time progress bar during analysis
- Live vehicle counts per ROI
- Turning movement classification (straight, left, right, U-turn)
- Near-miss detection with TTC and PET metrics (CRITICAL / HIGH / MODERATE / LOW)
- Export results as CSV
- Export HTML report

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Hosting | Cloudflare Pages |
| Edge routing | Cloudflare Workers + Durable Objects |
| Video storage | Cloudflare R2 |
| GPU inference | YOLOv8 (Ultralytics) via WebSocket |
| Tracking | ByteTrack (built into Ultralytics) |
| GPU cloud | RunPod (RTX 4090 / A100) |
# RunPod_GPU_Traffic_Video
