"""
TrafficAnalysisSession — one instance per client job.
Wraps YOLOv8 tracking + ROI + trajectory + near-miss logic.
"""

import cv2
import numpy as np
import math
from collections import defaultdict

from core.models import (
    ROI, CountingLine, Trajectory,
    TrackedVehicleNM, ConflictZoneTracker, compute_ttc,
    get_severity, VEHICLE_CLASSES, CONF_THRESHOLD,
    NM_MAX_DIST, NM_TTC_THRESHOLD, NM_PET_THRESHOLD,
)


class TrafficAnalysisSession:
    def __init__(self, model, fps: float = 25.0):
        self.model = model          # shared YOLO model (loaded once in server)
        self.fps = fps
        self.frame_idx = 0

        # configured by client
        self.rois: list[ROI] = []
        self.lines: list[CountingLine] = []

        # tracking state
        self.trajectories: dict[int, Trajectory] = {}
        self.prev_positions: dict[int, tuple] = {}

        # near-miss state
        self.nm_vehicles: dict[int, TrackedVehicleNM] = {}
        self.conflict_zone = ConflictZoneTracker()
        self.nm_events: list[dict] = []
        self.nm_cooldown: dict[tuple, float] = {}  # pair -> last_event_frame

    # ── configuration ─────────────────────────────────────────────────────────

    def configure(self, config: dict):
        """Receive ROI / line definitions drawn by user in browser."""
        self.rois = []
        for i, r in enumerate(config.get('rois', [])):
            roi = ROI(r['name'], r.get('color_idx', i))
            roi.points = [tuple(p) for p in r['points']]
            self.rois.append(roi)

        self.lines = []
        for i, l in enumerate(config.get('lines', [])):
            line = CountingLine(
                l['name'],
                tuple(l['pt1']),
                tuple(l['pt2']),
                l.get('color_idx', i),
            )
            self.lines.append(line)

    # ── per-frame processing ───────────────────────────────────────────────────

    def process_frame(self, frame: np.ndarray) -> dict:
        self.frame_idx += 1

        results = self.model.track(
            frame,
            persist=True,
            classes=list(VEHICLE_CLASSES.keys()),
            conf=CONF_THRESHOLD,
            verbose=False,
        )

        detections = []
        roi_counts = {r.name: len(r.vehicle_ids) for r in self.rois}
        nm_this_frame = []

        for r in results:
            for box in r.boxes:
                if box.id is None:
                    continue

                tid = int(box.id)
                cls = int(box.cls)
                cls_name = VEHICLE_CLASSES.get(cls, 'Unknown')
                x1, y1, x2, y2 = [round(v, 1) for v in box.xyxy[0].tolist()]
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

                # ── ROI counting ──────────────────────────────────────────────
                for roi in self.rois:
                    if roi.contains(cx, cy):
                        if tid not in roi.vehicle_ids:
                            roi.vehicle_ids.add(tid)
                            roi.counts[cls_name] += 1
                        roi_counts[roi.name] = len(roi.vehicle_ids)

                # ── counting line crossing ────────────────────────────────────
                crossings = []
                if tid in self.prev_positions:
                    px, py = self.prev_positions[tid]
                    for line in self.lines:
                        direction = line.check_crossing(px, py, cx, cy)
                        if direction:
                            if direction == 'forward':
                                line.counts_fwd[cls_name] += 1
                            else:
                                line.counts_bwd[cls_name] += 1
                            crossings.append({
                                'line': line.name,
                                'direction': direction,
                            })

                # ── trajectory ───────────────────────────────────────────────
                if tid not in self.trajectories:
                    self.trajectories[tid] = Trajectory(tid, cls_name)
                self.trajectories[tid].update(self.frame_idx, cx, cy)

                # ── near-miss tracking ────────────────────────────────────────
                if tid not in self.nm_vehicles:
                    self.nm_vehicles[tid] = TrackedVehicleNM(tid, cls)
                self.nm_vehicles[tid].update(self.frame_idx, cx, cy)
                self.conflict_zone.update(tid, cx, cy, self.frame_idx)

                self.prev_positions[tid] = (cx, cy)
                detections.append({
                    'id': tid,
                    'class': cls_name,
                    'bbox': [x1, y1, x2, y2],
                    'cx': round(cx), 'cy': round(cy),
                    'crossings': crossings,
                })

        # ── near-miss computation (pair-wise) ─────────────────────────────────
        ids = list(self.nm_vehicles.keys())
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                v1 = self.nm_vehicles[ids[i]]
                v2 = self.nm_vehicles[ids[j]]
                p1, p2 = v1.last_pos(), v2.last_pos()
                if p1 is None or p2 is None:
                    continue
                dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                if dist > NM_MAX_DIST:
                    continue

                ttc = compute_ttc(v1, v2, self.fps)
                pet, _ = self.conflict_zone.compute_pet(
                    v1.id, p1[0], p1[1], self.frame_idx, self.fps
                )

                if ttc < NM_TTC_THRESHOLD or pet < NM_PET_THRESHOLD:
                    pair_key = (min(v1.id, v2.id), max(v1.id, v2.id))
                    last = self.nm_cooldown.get(pair_key, -999)
                    if self.frame_idx - last < self.fps * 2:
                        continue  # cooldown — skip duplicate
                    self.nm_cooldown[pair_key] = self.frame_idx

                    severity = get_severity(ttc, pet)
                    event = {
                        'frame': self.frame_idx,
                        'time_sec': round(self.frame_idx / self.fps, 2),
                        'severity': severity,
                        'ttc': round(ttc, 2) if ttc != float('inf') else None,
                        'pet': round(pet, 2) if pet != float('inf') else None,
                        'v1_id': v1.id, 'v1_class': v1.class_name,
                        'v2_id': v2.id, 'v2_class': v2.class_name,
                        'location': [round(p1[0]), round(p1[1])],
                    }
                    self.nm_events.append(event)
                    nm_this_frame.append(event)

        return {
            'frame': self.frame_idx,
            'detections': detections,
            'roi_counts': roi_counts,
            'line_counts': {l.name: l.to_dict() for l in self.lines},
            'near_miss': nm_this_frame,
        }

    # ── final summary ──────────────────────────────────────────────────────────

    def get_summary(self) -> dict:
        # classify trajectories
        turn_counts = defaultdict(int)
        traj_list = []
        for traj in self.trajectories.values():
            traj.classify_turn()
            turn_counts[traj.turn_type] += 1
            traj_list.append(traj.to_dict())

        severity_counts = defaultdict(int)
        for ev in self.nm_events:
            severity_counts[ev['severity']] += 1

        return {
            'total_vehicles': len(self.nm_vehicles),
            'total_frames': self.frame_idx,
            'duration_sec': round(self.frame_idx / self.fps, 1),
            'roi_totals': {r.name: r.to_dict() for r in self.rois},
            'line_totals': {l.name: l.to_dict() for l in self.lines},
            'turning_movements': dict(turn_counts),
            'trajectories': traj_list,
            'near_miss_events': self.nm_events,
            'near_miss_by_severity': dict(severity_counts),
        }
