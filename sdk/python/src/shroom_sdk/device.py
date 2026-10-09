"""Synchronous devices: one reader, explicit lifetime and bounded serial reads."""

from collections import deque
from dataclasses import dataclass
from math import cos, exp, isfinite, sin
from random import Random
from threading import Event
from time import monotonic
from typing import Iterator

from .frame import Frame, _integer, decode_frame, resolve_shape
from .framer import DEFAULT_DELIMITER, Framer


def _timeout(value: float | None) -> float | None:
    if value is not None and (not isfinite(value) or value <= 0):
        raise ValueError("timeout must be > 0 or None")
    return value


class Device:
    """Use with a context manager; read in one thread only. No background acquisition."""

    def __init__(self, info: dict):
        self.info = info
        self._closed = Event()

    @property
    def closed(self) -> bool:
        return self._closed.is_set()

    def _ensure_open(self) -> None:
        if self.closed:
            raise RuntimeError("Device is closed")

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        raise NotImplementedError

    def frames(self, timeout: float | None = 1.0) -> Iterator[Frame]:
        """Keep waiting through timeouts; close/break/KeyboardInterrupt ends iteration."""
        _timeout(timeout)
        while not self.closed:
            frame = self.read_frame(timeout)
            if frame is not None:
                yield frame

    def __iter__(self) -> Iterator[Frame]:
        return self.frames()

    def close(self) -> None:
        self._closed.set()

    def __enter__(self):
        self._ensure_open()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()


@dataclass(frozen=True)
class PortInfo:
    path: str
    description: str | None
    manufacturer: str | None
    serial_number: str | None
    vendor_id: int | None
    product_id: int | None


def _serial_module():
    try:
        import serial
    except ImportError as exc:
        raise ImportError("Serial support requires pySerial: python -m pip install pyserial") from exc
    if not hasattr(serial, "serial_for_url"):
        raise ImportError("Install 'pyserial', not the unrelated package named 'serial'")
    return serial


def list_ports() -> list[PortInfo]:
    _serial_module()
    from serial.tools.list_ports import comports
    return [PortInfo(p.device, p.description, p.manufacturer, p.serial_number, p.vid, p.pid)
            for p in sorted(comports())]


class SerialDevice(Device):
    def __init__(self, path: str | None = None, *, baud_rate: int = 1_000_000,
                 delimiter: bytes = DEFAULT_DELIMITER, min_length: int = 8,
                 max_length: int = 8192, lock_length: bool = True, **decode_options):
        # Validate before opening a port, so invalid options cannot leak a serial handle.
        _integer(baud_rate, "baud_rate", 1)
        validation_options = dict(decode_options)
        if validation_options.get("rows") is None and validation_options.get("cols") is None:
            layout = validation_options.get("layout")
            if layout is not None and not isinstance(layout, str):
                shape = resolve_shape(len(layout))
                validation_options.update(rows=shape[0], cols=shape[1])
            elif layout == "mat32":
                validation_options.update(rows=32, cols=32)
        decode_frame(b"", **validation_options)
        self._framer = Framer(delimiter=delimiter, min_length=min_length,
                              max_length=max_length, lock_length=lock_length)
        serial = _serial_module()
        if path is None:
            ports = list_ports()
            if not ports:
                raise OSError("No serial ports found; connect the device and check drivers/permissions")
            if len(ports) != 1:
                raise ValueError("Multiple serial ports found; pass path explicitly: " + ", ".join(p.path for p in ports))
            path = ports[0].path
        super().__init__({"source": "python-serial", "path": path, "baud_rate": baud_rate,
                          "rows": decode_options.get("rows"), "cols": decode_options.get("cols")})
        self._options = decode_options
        self._pending: deque[bytes] = deque()
        self._bytes_received = self._frame_count = 0
        # serial_for_url accepts normal OS port names and loop:// for hardware-free tests.
        self._port = serial.serial_for_url(path, baudrate=baud_rate, timeout=0.1, write_timeout=1.0)

    @property
    def bytes_received(self) -> int:
        return self._bytes_received

    @property
    def frame_count(self) -> int:
        return self._frame_count

    @property
    def dropped_count(self) -> int:
        return self._framer.dropped_count

    @property
    def frame_length(self) -> int:
        return self._framer.frame_length

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        self._ensure_open()
        _timeout(timeout)
        deadline = monotonic() + timeout if timeout is not None else None
        while not self.closed:
            if self._pending:
                return decode_frame(self._pending.popleft(), **self._options)
            remaining = deadline - monotonic() if deadline is not None else 0.1
            if remaining <= 0:
                return None
            self._port.timeout = min(0.1, remaining)
            # Read buffered bytes immediately; otherwise block for only one byte.
            chunk = self._port.read(min(4096, max(1, self._port.in_waiting)))
            self._bytes_received += len(chunk)
            payloads = self._framer.push(chunk)
            self._frame_count += len(payloads)
            self._pending.extend(payloads)
        return None

    def write(self, data: bytes) -> int:
        """Send a caller-supplied device command. No start/calibration command is invented."""
        self._ensure_open()
        return self._port.write(data)

    def close(self) -> None:
        if not self.closed:
            super().close()
            self._pending.clear()
            self._port.close()


class MockDevice(Device):
    def __init__(self, *, rows: int = 32, cols: int = 32, fps: float = 30,
                 seed: int | None = None, **decode_options):
        _integer(rows, "rows", 1)
        _integer(cols, "cols", 1)
        if not isfinite(fps) or fps <= 0:
            raise ValueError("fps must be finite and > 0")
        self._options = {**decode_options, "rows": rows, "cols": cols}
        decode_frame(b"", **self._options)
        super().__init__({"source": "mock", "rows": rows, "cols": cols, "fps": fps})
        self._random = Random(seed)
        self._phase = 0.0
        self._next_frame = monotonic()

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        self._ensure_open()
        _timeout(timeout)
        delay = max(0.0, self._next_frame - monotonic())
        if timeout is not None and delay > timeout:
            self._closed.wait(timeout)
            return None
        if self._closed.wait(delay):
            return None
        rows, cols = self.info["rows"], self.info["cols"]
        self._phase += 0.08
        phase = self._phase
        blobs = ((0.5 + 0.28 * cos(phase), 0.5 + 0.28 * sin(phase), 0.18, 235),
                 (0.5 + 0.22 * cos(-phase * 1.7), 0.5 + 0.22 * sin(-phase * 1.7), 0.12, 180))
        raw = bytearray()
        for y in range(rows):
            for x in range(cols):
                nx, ny = (x / (cols - 1) if cols > 1 else 0.5), (y / (rows - 1) if rows > 1 else 0.5)
                v = sum(peak * exp(-((nx - bx) ** 2 + (ny - by) ** 2) / (2 * radius ** 2))
                        for bx, by, radius, peak in blobs)
                raw.append(min(255, int(v + 3 * self._random.random())))
        self._next_frame = monotonic() + 1.0 / self.info["fps"]
        return decode_frame(raw, **self._options)


def connect(path: str | None = None, **options) -> SerialDevice:
    return SerialDevice(path, **options)


def mock(**options) -> MockDevice:
    return MockDevice(**options)
