"""Run with python -m shroom_sdk, or the installed shroom-demo command."""

import argparse
from dataclasses import asdict
import json
import sys

from . import Shroom


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Shroom serial / mock pressure sensor demo")
    parser.add_argument("path", nargs="?", help="COM3, /dev/ttyUSB0, etc.; omit for mock")
    parser.add_argument("--list", action="store_true", help="List serial ports")
    parser.add_argument("--frames", type=int, default=0, help="Stop after N frames; 0 = run until Ctrl+C")
    parser.add_argument("--json", action="store_true", help="One JSON object per frame")
    parser.add_argument("--rows", type=int)
    parser.add_argument("--cols", type=int)
    parser.add_argument("--layout", choices=("raw", "mat32"), default="raw")
    parser.add_argument("--baud-rate", type=int, default=1_000_000)
    parser.add_argument("--fps", type=float, default=30, help="Mock frame rate")
    parser.add_argument("--timeout", type=float, default=5.0, help="Seconds to wait for a complete frame")
    args = parser.parse_args(argv)
    if args.frames < 0:
        parser.error("--frames must be >= 0")
    if (args.rows is None) != (args.cols is None):
        parser.error("Use --rows and --cols together")
    try:
        if args.list:
            ports = Shroom.list_ports()
            if args.json:
                print(json.dumps([asdict(p) for p in ports]))
            else:
                for p in ports:
                    print(f"{p.path}: {p.description or ''}")
                if not ports:
                    print("No serial ports found.")
            return 0
        options = {"layout": args.layout}
        if args.rows is not None:
            options.update(rows=args.rows, cols=args.cols)
        device = (Shroom.connect(args.path, baud_rate=args.baud_rate, **options) if args.path
                  else Shroom.mock(fps=args.fps, **options))
        with device:
            count = 0
            while not device.closed:
                frame = device.read_frame(timeout=args.timeout)
                if frame is None:
                    print("No complete frame before timeout. Check port, baud rate and delimiter.", file=sys.stderr)
                    return 1
                if args.json:
                    print(json.dumps(frame.to_dict()))
                else:
                    print(Shroom.render_ascii(frame))
                    print(f"{frame.rows}x{frame.cols} max={frame.max:.3f} area={frame.area} "
                          f"center=({frame.center.x:.3f}, {frame.center.y:.3f})")
                count += 1
                if args.frames and count >= args.frames:
                    break
        return 0
    except KeyboardInterrupt:
        return 0
    except (ImportError, OSError, ValueError, RuntimeError) as exc:
        print(f"shroom: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
