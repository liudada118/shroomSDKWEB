"""python examples/read_frames.py [COM3 --license-file sdk.license]."""

import argparse
from itertools import islice
from pathlib import Path

from shroom_sdk import Shroom

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("path", nargs="?")
parser.add_argument("--license-file")
parser.add_argument("--license-mode", choices=("online", "offline"), default="online")
parser.add_argument("--device-id")
args = parser.parse_args()
if args.path:
    if not args.license_file:
        parser.error("Real serial requires the system serial driver and --license-file with a shroom-sdk key authorizing serial")
    Shroom.activate_license(Path(args.license_file).read_text(encoding="utf-8-sig").strip(),
                            mode=args.license_mode, device_id=args.device_id)
device = Shroom.connect(args.path) if args.path else Shroom.mock()
try:
    with device:
        for frame in islice(device, 100):
            print(frame.timestamp, frame.max, frame.area, frame.center)
except KeyboardInterrupt:
    pass
