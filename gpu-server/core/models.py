"""
Core data models extracted from the original desktop app.
No GUI dependencies — pure Python logic only.
"""

import math
import numpy as np
import cv2
from collections import defaultdict

VEHICLE_CLASSES = {2: 'Car', 3: 'Motorcycle', 5: 'Bus', 7: 'Truck'}
CONF_THRESHOLD = 0.4

ROI_COLORS_BGR = [
    (68, 68, 255), (255, 170, 68), (68, 255, 68), (0, 170, 255),
    (255, 68, 255), (221, 221, 0), (68, 136, 255), (255, 68, 136),
]

TURN_COLORS = {
    'Straight':   {'hex': '#44FF44', 'bgr': (68, 255, 68)},
    'Left Turn':  {'hex': '#FF4444', 'bgr': (68, 68, 255)},
    'Right Turn': {'hex': '#44AAFF', 'bgr': (255, 170, 68)},
    'U-Turn':     {'hex': '#FF44FF', 'bgr': (255, 68, 255)},
    'Unknown':    {'hex': '#888888', 'bgr': (136, 136, 136)},
}

NM_TTC_THRESHOLD = 2.0
NM_PET_THRESHOLD = 1.5
NM_MIN_DIST = 50
NM_MAX_DIST = 300

SEVERITY_LEVELS = {
    'CRITICAL': {'ttc': 0.5,  'pet': 0.3},
    'HIGH':     {'ttc': 1.0,  'pet': 0.7},
    'MODERATE': {'ttc': 1.5,  'pet': 1.0},
    'LOW':      {'ttc': 2.0,  'pet': 1.5},
}


def get_severity(ttc, pet):
    for level, t in SEVERITY_LEVELS.items():
        if ttc < t['ttc'] or pet < t['pet']:
            return level
    return 'LOW'


class ROI:
    def __init__(self, name, color_idx=0):
        self.name = name
        self.points = []
        self.color_idx = color_idx
        self.vehicle_ids = set()
        self.counts = defaultdict(int)
        self.entry_times = {}
        self.current_occupants = set()
        self.dwell_records = []
        self.queue_count = 0
        self.queue_history = []

    def contains(self, x, y):
        if len(self.points) < 3:
            return False
        pts = np.array(self.points, dtype=np.int32)
        return cv2.pointPolygonTest(pts, (float(x), float(y)), False) >= 0

    def to_dict(self):
        return {
            'name': self.name,
            'total': len(self.vehicle_ids),
            'counts': dict(self.counts),
        }


class CountingLine:
    def __init__(self, name, pt1, pt2, color_idx=0):
        self.name = name
        self.pt1 = tuple(pt1)
        self.pt2 = tuple(pt2)
        self.color_idx = color_idx
        self.counted_ids = set()
        self.counts_fwd = defaultdict(int)
        self.counts_bwd = defaultdict(int)
        self.crossing_times = []

    def side_of_line(self, px, py):
        dx = self.pt2[0] - self.pt1[0]
        dy = self.pt2[1] - self.pt1[1]
        return (px - self.pt1[0]) * dy - (py - self.pt1[1]) * dx

    def check_crossing(self, prev_x, prev_y, curr_x, curr_y):
        s1 = self.side_of_line(prev_x, prev_y)
        s2 = self.side_of_line(curr_x, curr_y)
        if s1 * s2 < 0:
            return 'forward' if s2 > 0 else 'backward'
        return None

    def to_dict(self):
        return {
            'name': self.name,
            'forward': dict(self.counts_fwd),
            'backward': dict(self.counts_bwd),
            'total_fwd': sum(self.counts_fwd.values()),
            'total_bwd': sum(self.counts_bwd.values()),
        }


class Trajectory:
    def __init__(self, track_id, class_name):
        self.id = track_id
        self.class_name = class_name
        self.positions = []   # (frame_idx, cx, cy)
        self.turn_type = 'Unknown'
        self.entry_angle = 0.0
        self.exit_angle = 0.0

    def update(self, frame_idx, cx, cy):
        self.positions.append((frame_idx, cx, cy))

    def classify_turn(self):
        if len(self.positions) < 6:
            self.turn_type = 'Unknown'
            return
        pts = self.positions
        n = len(pts)
        # entry vector: first 20% of trajectory
        seg = max(2, n // 5)
        dx_e = pts[seg][1] - pts[0][1]
        dy_e = pts[seg][2] - pts[0][2]
        # exit vector: last 20%
        dx_x = pts[-1][1] - pts[-seg][1]
        dy_x = pts[-1][2] - pts[-seg][2]

        self.entry_angle = math.degrees(math.atan2(dy_e, dx_e))
        self.exit_angle  = math.degrees(math.atan2(dy_x, dx_x))

        diff = (self.exit_angle - self.entry_angle + 360) % 360
        if diff > 180:
            diff -= 360

        if abs(diff) < 25:
            self.turn_type = 'Straight'
        elif diff > 25 and diff < 160:
            self.turn_type = 'Right Turn'
        elif diff < -25 and diff > -160:
            self.turn_type = 'Left Turn'
        else:
            self.turn_type = 'U-Turn'

    def to_dict(self):
        return {
            'id': self.id,
            'class': self.class_name,
            'turn_type': self.turn_type,
            'entry_angle': round(self.entry_angle, 1),
            'exit_angle': round(self.exit_angle, 1),
            'num_points': len(self.positions),
        }


class TrackedVehicleNM:
    """Vehicle state for near-miss TTC calculation."""
    def __init__(self, track_id, class_id):
        self.id = track_id
        self.class_id = class_id
        self.class_name = VEHICLE_CLASSES.get(class_id, 'Unknown')
        self.positions = []
        self.velocity = (0.0, 0.0)

    def update(self, frame_idx, cx, cy):
        self.positions.append((frame_idx, cx, cy))
        if len(self.positions) >= 2:
            n = min(5, len(self.positions))
            old = self.positions[-n]
            new = self.positions[-1]
            dt = new[0] - old[0]
            if dt > 0:
                self.velocity = (
                    (new[1] - old[1]) / dt,
                    (new[2] - old[2]) / dt,
                )

    def last_pos(self):
        if self.positions:
            return (self.positions[-1][1], self.positions[-1][2])
        return None


class ConflictZoneTracker:
    def __init__(self, cell_size=40):
        self.cell_size = cell_size
        self.occupancy = defaultdict(dict)

    def update(self, tid, cx, cy, frame_idx):
        cell = (int(cx // self.cell_size), int(cy // self.cell_size))
        self.occupancy[cell][tid] = frame_idx

    def compute_pet(self, tid, cx, cy, frame_idx, fps):
        cell = (int(cx // self.cell_size), int(cy // self.cell_size))
        min_pet, other_id = float('inf'), None
        for t, last_f in self.occupancy[cell].items():
            if t == tid:
                continue
            pet = abs(frame_idx - last_f) / fps
            if pet < min_pet:
                min_pet, other_id = pet, t
        return min_pet, other_id


def compute_ttc(v1: TrackedVehicleNM, v2: TrackedVehicleNM, fps: float) -> float:
    p1, p2 = v1.last_pos(), v2.last_pos()
    if p1 is None or p2 is None:
        return float('inf')
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 1:
        return 0.0
    rel_vx = v1.velocity[0] - v2.velocity[0]
    rel_vy = v1.velocity[1] - v2.velocity[1]
    approach = (dx * rel_vx + dy * rel_vy) / dist
    if approach <= 0:
        return float('inf')
    return (dist / approach) / fps
