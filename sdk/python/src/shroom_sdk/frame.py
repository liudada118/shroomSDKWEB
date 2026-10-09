"""Decode the same one-byte-per-point frames as sdk/core/frame.js."""

from array import array
from dataclasses import dataclass
from functools import lru_cache
from math import isfinite, isqrt
from time import time_ns
from typing import Sequence


@dataclass(frozen=True)
class Center:
    x: float
    y: float


@dataclass(frozen=True)
class Frame:
    raw: bytes
    values: array  # float32, compatible with numpy.frombuffer(frame.values, dtype=np.float32)
    rows: int
    cols: int
    min: float
    max: float
    avg: float
    area: int  # Count of points above threshold, not a physical area.
    center: Center
    timestamp: int  # Unix milliseconds, matching Date.now().

    def to_dict(self) -> dict:
        """A JSON-serializable snapshot with the JavaScript Frame field names."""
        return {
            "raw": list(self.raw), "values": list(self.values),
            "rows": self.rows, "cols": self.cols,
            "min": self.min, "max": self.max, "avg": self.avg,
            "area": self.area, "center": {"x": self.center.x, "y": self.center.y},
            "timestamp": self.timestamp,
        }

    def matrix(self) -> list[list[float]]:
        """Row-major matrix, without requiring NumPy."""
        return [list(self.values[y * self.cols:(y + 1) * self.cols]) for y in range(self.rows)]


def _integer(value: int, name: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")
    return value


def resolve_shape(points: int, *, rows: int | None = None, cols: int | None = None) -> tuple[int, int]:
    _integer(points, "points")
    if rows is not None or cols is not None:
        if rows is None or cols is None:
            raise ValueError("Specify both rows and cols")
        return _integer(rows, "rows", 1), _integer(cols, "cols", 1)
    side = isqrt(points)
    return (side, side) if side * side == points else (1, points)


@lru_cache(maxsize=32)
def _builtin_layout(name: str, rows: int, cols: int) -> tuple[int, ...] | None:
    if name == "raw":
        return None
    if name != "mat32":
        raise ValueError(f"Unknown layout: {name!r}; use 'raw', 'mat32' or a permutation")
    if (rows, cols) != (32, 32):
        raise ValueError("mat32 requires rows=32 and cols=32")
    return tuple((15 + y if y <= 16 else 31 - y) * cols + x
                 for y in range(rows) for x in range(cols))


def get_layout(layout: str | Sequence[int] | None, rows: int, cols: int) -> tuple[int, ...] | None:
    """Return perm[display_index] = raw_index; None means raw order."""
    _integer(rows, "rows")
    _integer(cols, "cols")
    if layout is None or isinstance(layout, str):
        return _builtin_layout(layout or "raw", rows, cols)
    perm = tuple(layout)
    size = rows * cols
    if (len(perm) != size or any(isinstance(i, bool) or not isinstance(i, int) for i in perm)
            or set(perm) != set(range(size))):
        raise ValueError("layout must be a permutation of 0 .. rows*cols-1")
    return perm


def decode_frame(
    payload: bytes | bytearray | memoryview, *, rows: int | None = None,
    cols: int | None = None, points: int | None = None, full_scale: float = 255,
    threshold: float = 0.02, layout: str | Sequence[int] | None = "raw",
) -> Frame:
    """One byte = one ADC point; values are relative, never kPa/N."""
    if not isinstance(payload, (bytes, bytearray, memoryview)):
        raise TypeError("payload must be bytes, bytearray or memoryview")
    if not isfinite(full_scale) or full_scale <= 0:
        raise ValueError("full_scale must be finite and > 0")
    if not isfinite(threshold) or threshold < 0:
        raise ValueError("threshold must be finite and >= 0")
    data = bytes(payload)
    count = len(data) if points is None else min(_integer(points, "points"), len(data))
    rows, cols = resolve_shape(count, rows=rows, cols=cols)
    perm = get_layout(layout, rows, cols)
    raw = data[:count]
    values = array("f")
    low, high, total, weight, cx, cy, area = float("inf"), 0.0, 0.0, 0.0, 0.0, 0.0, 0
    for i in range(rows * cols):
        src = perm[i] if perm is not None else i
        value = raw[src] / full_scale if src < count else 0.0
        values.append(value)
        # JS computes statistics before storing values as float32.
        low, high = min(low, value), max(high, value)
        total += value
        if value > threshold:
            area += 1
            weight += value
            cx += (i % cols) * value
            cy += (i // cols) * value
    center = Center(cx / weight / max(1, cols - 1), cy / weight / max(1, rows - 1)) if weight else Center(0.5, 0.5)
    return Frame(raw, values, rows, cols, low if values else 0.0, high,
                 total / len(values) if values else 0.0, area, center, time_ns() // 1_000_000)
