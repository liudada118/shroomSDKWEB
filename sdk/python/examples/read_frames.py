"""python examples/read_frames.py [COM3]; omit the port to use mock data."""

from itertools import islice
import sys

from shroom_sdk import Shroom

device = Shroom.connect(sys.argv[1]) if len(sys.argv) > 1 else Shroom.mock()
try:
    with device:
        for frame in islice(device, 100):
            print(frame.timestamp, frame.max, frame.area, frame.center)
except KeyboardInterrupt:
    pass
