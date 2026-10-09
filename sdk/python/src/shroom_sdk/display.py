"""Portable text heatmap; no terminal color or GUI dependency required."""

from math import isfinite

from .frame import Frame, _integer


def render_ascii(frame: Frame, *, width: int = 32, gain: float = 1.0) -> str:
    _integer(width, "width", 1)
    if not isfinite(gain) or gain <= 0:
        raise ValueError("gain must be finite and > 0")
    if frame.rows == 0 or frame.cols == 0:
        return ""
    shades = " .:-=+*#%@"
    cols = min(width, frame.cols)
    rows = max(1, int(frame.rows * cols / frame.cols / 2 + 0.5))
    lines = []
    for y in range(rows):
        sy = min(frame.rows - 1, y * frame.rows // rows)
        line = []
        for x in range(cols):
            sx = min(frame.cols - 1, x * frame.cols // cols)
            value = max(0.0, min(1.0, frame.values[sy * frame.cols + sx] * gain))
            line.append(shades[int(value * (len(shades) - 1))])
        lines.append("".join(line))
    return "\n".join(lines)
