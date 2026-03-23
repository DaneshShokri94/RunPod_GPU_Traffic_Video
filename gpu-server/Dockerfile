FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# pre-download YOLOv8 weights
RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"

COPY . .

EXPOSE 8765

ENV DEVICE=cuda
ENV PORT=8765
ENV SKIP_FRAMES=3

CMD ["python3", "server.py"]
