"""Delimiter framing and length locking, matching sdk/core/framer.js."""

from .frame import _integer

DEFAULT_DELIMITER = bytes((0xAA, 0x55, 0x03, 0x99))


class Framer:
    def __init__(self, *, delimiter: bytes = DEFAULT_DELIMITER, min_length: int = 8,
                 max_length: int = 8192, lock_length: bool = True):
        self.delimiter = bytes(delimiter)
        if not self.delimiter:
            raise ValueError("delimiter cannot be empty")
        self.min_length = _integer(min_length, "min_length", 1)
        self.max_length = _integer(max_length, "max_length", self.min_length)
        self.lock_length = lock_length
        self.reset()

    @property
    def dropped_count(self) -> int:
        return self._dropped

    @property
    def frame_length(self) -> int:
        return self._locked

    def reset(self) -> None:
        self._buffer = bytearray()
        self._dropped = self._locked = self._run_length = self._run_count = 0

    def _accept(self, length: int) -> bool:
        if not self.lock_length:
            return True
        self._run_count = self._run_count + 1 if length == self._run_length else 1
        self._run_length = length
        if not self._locked:
            if self._run_count >= 3:
                self._locked = length
            return True
        if length == self._locked:
            return True
        if self._run_count >= 12:
            self._locked = length
            return True
        return False

    def push(self, chunk: bytes | bytearray | memoryview) -> list[bytes]:
        if not isinstance(chunk, (bytes, bytearray, memoryview)):
            raise TypeError("chunk must be bytes, bytearray or memoryview")
        if not chunk:
            return []
        self._buffer.extend(chunk)
        frames: list[bytes] = []
        size = len(self.delimiter)
        start = self._buffer.find(self.delimiter)
        if start < 0:
            if len(self._buffer) > size:
                # Keep a possible split delimiter (also works for a 1-byte delimiter).
                del self._buffer[:len(self._buffer) - size + 1]
            return []
        while True:
            end = self._buffer.find(self.delimiter, start + size)
            if end < 0:
                break
            length = end - start - size
            if self.min_length <= length <= self.max_length and self._accept(length):
                frames.append(bytes(self._buffer[start + size:end]))
            else:
                self._dropped += 1
            start = end
        del self._buffer[:start]
        if len(self._buffer) > self.max_length * 4:
            del self._buffer[:-self.max_length]
        return frames
