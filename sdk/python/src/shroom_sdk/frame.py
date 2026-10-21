"""Decode the same one-byte-per-point frames as sdk/core/frame.js."""

from array import array
from dataclasses import dataclass
from functools import lru_cache
from math import isfinite, isqrt
from numbers import Real
from time import time_ns
from typing import Sequence

from .errors import ShroomParseTypeError, invalid_config

MAX_MATRIX_POINTS = 1_048_576


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
        raise invalid_config(f"{name} must be an integer >= {minimum}", option=name)
    return value


def _number(value: float, name: str, minimum: float, *, inclusive: bool = True) -> float:
    try:
        valid = (not isinstance(value, bool) and isinstance(value, Real) and isfinite(value)
                 and (value >= minimum if inclusive else value > minimum))
    except (OverflowError, TypeError, ValueError):
        valid = False
    if not valid:
        relation = ">=" if inclusive else ">"
        raise invalid_config(f"{name} must be finite and {relation} {minimum}", option=name)
    return value


def resolve_shape(points: int, *, rows: int | None = None, cols: int | None = None) -> tuple[int, int]:
    _integer(points, "points")
    if points > MAX_MATRIX_POINTS:
        raise invalid_config(f"points must be <= {MAX_MATRIX_POINTS}", option="points")
    if rows is not None or cols is not None:
        if rows is None or cols is None:
            raise invalid_config("Specify both rows and cols", option="rows/cols")
        shape = _integer(rows, "rows", 1), _integer(cols, "cols", 1)
        if shape[0] * shape[1] > MAX_MATRIX_POINTS:
            raise invalid_config(f"rows*cols must be <= {MAX_MATRIX_POINTS}", option="rows/cols")
        return shape
    side = isqrt(points)
    return (side, side) if side * side == points else (1, points)


@lru_cache(maxsize=32)
def _builtin_layout(name: str, rows: int, cols: int) -> tuple[int, ...] | None:
    if name == "raw":
        return None
    if name != "mat32":
        raise invalid_config(f"Unknown layout: {name!r}; use 'raw', 'mat32' or a permutation", option="layout")
    if (rows, cols) != (32, 32):
        raise invalid_config("mat32 requires rows=32 and cols=32", option="layout")
    return tuple((15 + y if y <= 16 else 31 - y) * cols + x
                 for y in range(rows) for x in range(cols))


def get_layout(layout: str | Sequence[int] | None, rows: int, cols: int) -> tuple[int, ...] | None:
    """Return perm[display_index] = raw_index; None means raw order."""
    _integer(rows, "rows")
    _integer(cols, "cols")
    if rows * cols > MAX_MATRIX_POINTS:
        raise invalid_config(f"rows*cols must be <= {MAX_MATRIX_POINTS}", option="rows/cols")
    if layout is None or isinstance(layout, str):
        return _builtin_layout(layout or "raw", rows, cols)
    if not isinstance(layout, Sequence):
        raise invalid_config("layout must be 'raw', 'mat32' or an integer permutation", option="layout")
    size = rows * cols
    if _layout_length(layout) != size:
        raise invalid_config("layout must be a permutation of 0 .. rows*cols-1", option="layout")
    try:
        perm = tuple(layout)
    except (TypeError, ValueError, BufferError, OverflowError, NotImplementedError) as exc:
        raise invalid_config("layout must be a readable integer permutation", option="layout", cause=exc) from exc
    if (len(perm) != size or any(isinstance(i, bool) or not isinstance(i, int) for i in perm)
            or set(perm) != set(range(size))):
        raise invalid_config("layout must be a permutation of 0 .. rows*cols-1", option="layout")
    return perm


def _layout_length(layout: Sequence[int]) -> int:
    try:
        return len(layout)
    except (TypeError, ValueError, BufferError, OverflowError, NotImplementedError) as exc:
        raise invalid_config("layout must be a readable integer permutation", option="layout", cause=exc) from exc


def _validate_decode_options(options: dict) -> dict:
    """Check stream-independent options before acquiring a serial handle."""
    supported = {"rows", "cols", "points", "full_scale", "threshold", "layout"}
    unknown = set(options) - supported
    if unknown:
        name = sorted(unknown)[0]
        raise invalid_config(f"Unknown decode option: {name}", option=name)
    _number(options.get("full_scale", 255), "full_scale", 0, inclusive=False)
    _number(options.get("threshold", 0.02), "threshold", 0)
    points = options.get("points")
    if points is not None:
        _integer(points, "points")
        if points > MAX_MATRIX_POINTS:
            raise invalid_config(f"points must be <= {MAX_MATRIX_POINTS}", option="points")
    rows, cols = options.get("rows"), options.get("cols")
    layout = options.get("layout", "raw")
    if rows is not None or cols is not None:
        shape = resolve_shape(0, rows=rows, cols=cols)
    elif isinstance(layout, str) and layout == "mat32":
        if points is not None and points < 1024:
            raise invalid_config("mat32 requires at least 1024 points", option="points")
        shape = (32, 32)
    elif layout is not None and not isinstance(layout, str):
        if not isinstance(layout, Sequence):
            raise invalid_config("layout must be 'raw', 'mat32' or an integer permutation", option="layout")
        shape = resolve_shape(points if points is not None else _layout_length(layout))
    else:
        shape = resolve_shape(points or 0)
    permutation = get_layout(layout, *shape)
    # Freeze caller-owned permutations so later mutations cannot alter validated options.
    return {**options, **({"layout": permutation} if permutation is not None else {})}


def decode_frame(
    payload: bytes | bytearray | memoryview, *, rows: int | None = None,
    cols: int | None = None, points: int | None = None, full_scale: float = 255,
    threshold: float = 0.02, layout: str | Sequence[int] | None = "raw",
) -> Frame:
    """One byte = one ADC point; values are relative, never kPa/N."""
    if not isinstance(payload, (bytes, bytearray, memoryview)):
        raise ShroomParseTypeError("payload must be bytes, bytearray or memoryview",
                                   code="PARSE_FAILED", stage="parse",
                                   suggestion="请向 decode_frame() 传入 bytes、bytearray 或 memoryview。")
    _number(full_scale, "full_scale", 0, inclusive=False)
    _number(threshold, "threshold", 0)
    try:
        data = bytes(payload)
    except (TypeError, ValueError) as exc:
        raise ShroomParseTypeError(str(exc), code="PARSE_FAILED", stage="parse",
                                   suggestion="请传入可读取的字节数据。", cause=exc) from exc
    if points is not None:
        _integer(points, "points")
        if points > MAX_MATRIX_POINTS:
            raise invalid_config(f"points must be <= {MAX_MATRIX_POINTS}", option="points")
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
