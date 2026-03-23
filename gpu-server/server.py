"""
GPU Inference Server
====================
WebSocket server that:
  1. Receives a job config (video URL + ROI definitions) from client
  2. Downloads the video from Cloudflare R2
  3. Runs YOLOv8 + ByteTrack + ROI + near-miss analysis frame by frame
  4. Streams progress + per-frame results back via WebSocket
  5. Sends a final summary when done

Deploy on RunPod with a GPU instance.
Run: python server.py
"""

import asyncio
import base64
import json
import os
import cv2
import numpy as np
import websockets
from ultralytics import YOLO

from core.session import TrafficAnalysisSession

PORT = int(os.environ.get('PORT', 8765))
MODEL_PATH = os.environ.get('MODEL_PATH', 'yolov8m.pt')
DEVICE = os.environ.get('DEVICE', 'cuda')        # set to 'cpu' for local dev
SKIP_FRAMES = int(os.environ.get('SKIP_FRAMES', '3'))  # process every Nth frame

print(f"Loading YOLOv8 model: {MODEL_PATH} on {DEVICE} ...")
model = YOLO(MODEL_PATH)
model.to(DEVICE)
print("Model loaded and ready.")


async def send_json(ws, data: dict):
    await ws.send(json.dumps(data))


async def handle_client(websocket):
    client = websocket.remote_address
    print(f"[+] Client connected: {client}")

    try:
        # ── wait for job config message ───────────────────────────────────────
        raw = await websocket.recv()
        job = json.loads(raw)

        if job.get('type') != 'job':
            await send_json(websocket, {'type': 'error', 'msg': 'expected job config'})
            return

        video_url = job.get('video_url')
        if not video_url:
            await send_json(websocket, {'type': 'error', 'msg': 'missing video_url'})
            return

        skip = job.get('every_n_frames', SKIP_FRAMES)

        # ── open video from URL (R2 public URL) ───────────────────────────────
        print(f"    Video URL: {video_url}")
        await send_json(websocket, {'type': 'status', 'msg': 'Opening video...'})
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            await send_json(websocket, {'type': 'error', 'msg': f'Cannot open video: {video_url}'})
            return

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        await send_json(websocket, {
            'type': 'video_info',
            'total_frames': total_frames,
            'fps': fps,
            'width': width,
            'height': height,
        })

        # ── reset tracker state from any previous job ────────────────────────
        model.predictor = None  # force fresh tracker for each job

        # ── configure session with ROIs and lines from client ─────────────────
        session = TrafficAnalysisSession(model=model, fps=fps)
        session.configure(job)

        print(f"    ROIs configured: {[r.name for r in session.rois]}")
        print(f"    ROI points: {[r.points[:2] for r in session.rois]}")

        await send_json(websocket, {
            'type': 'status',
            'msg': f'Analysing {total_frames} frames at {fps:.1f}fps...'
        })

        # ── process frames ────────────────────────────────────────────────────
        frame_idx = 0
        processed = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1

            if frame_idx % skip != 0:
                continue

            processed += 1
            result = session.process_frame(frame)
            percent = round(frame_idx / max(total_frames, 1) * 100, 1)

            # debug: log first few frames
            if processed <= 3:
                det_count = len(result.get('detections', []))
                print(f"    Frame {frame_idx}: {det_count} detections, roi_counts={result.get('roi_counts', {})}")

            await send_json(websocket, {
                'type': 'frame_result',
                'frame': frame_idx,
                'total': total_frames,
                'percent': percent,
                **result,
            })

            # yield to event loop so WebSocket stays responsive
            await asyncio.sleep(0)

        cap.release()

        # ── send final summary ────────────────────────────────────────────────
        summary = session.get_summary()
        await send_json(websocket, {'type': 'done', **summary})
        print(f"[✓] Job complete for {client}: {processed} frames processed")

    except websockets.exceptions.ConnectionClosed:
        print(f"[-] Client disconnected: {client}")
    except Exception as e:
        print(f"[!] Error for {client}: {e}")
        try:
            await send_json(websocket, {'type': 'error', 'msg': str(e)})
        except Exception:
            pass


async def handle_first_frame(websocket):
    """
    Special endpoint: client sends {'type':'first_frame','video_url':'...'}
    Server returns base64 JPEG of first frame so user can draw ROIs on it.
    """
    try:
        raw = await websocket.recv()
        msg = json.loads(raw)
        if msg.get('type') != 'first_frame':
            return

        cap = cv2.VideoCapture(msg['video_url'])
        ret, frame = cap.read()
        cap.release()

        if not ret:
            await send_json(websocket, {'type': 'error', 'msg': 'Cannot read frame'})
            return

        _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64 = base64.b64encode(jpeg).decode()

        await send_json(websocket, {
            'type': 'first_frame',
            'frame': b64,
            'width': frame.shape[1],
            'height': frame.shape[0],
        })
    except Exception as e:
        await send_json(websocket, {'type': 'error', 'msg': str(e)})


async def router(websocket):
    """Route connections based on URL path."""
    path = websocket.request.path if hasattr(websocket, 'request') else '/'

    if '/first-frame' in path:
        await handle_first_frame(websocket)
    else:
        await handle_client(websocket)


async def main():
    print(f"GPU server listening on ws://0.0.0.0:{PORT}")
    async with websockets.serve(router, '0.0.0.0', PORT):
        await asyncio.Future()  # run forever


if __name__ == '__main__':
    asyncio.run(main())
