"""python examples/heatmap.py [COM3 --license-file sdk.license]; requires [plot]."""

import argparse
from pathlib import Path

from shroom_sdk import Shroom


def main():
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
    import matplotlib.pyplot as plt

    device = Shroom.connect(args.path) if args.path else Shroom.mock()
    try:
        with device:
            fig, ax = plt.subplots()
            fig.canvas.mpl_connect("close_event", lambda event: device.close())
            picture = None
            while plt.fignum_exists(fig.number) and not device.closed:
                frame = device.read_frame(timeout=0.05)
                if frame is not None:
                    if picture is None:
                        picture = ax.imshow(frame.matrix(), vmin=0, vmax=1, cmap="jet", origin="upper")
                        fig.colorbar(picture, ax=ax, label="Relative ADC (0-1)")
                    else:
                        picture.set_data(frame.matrix())
                        picture.set_extent((-0.5, frame.cols - 0.5, frame.rows - 0.5, -0.5))
                    ax.set_title(f"Shroom | max={frame.max:.3f} | active points={frame.area}")
                plt.pause(0.01)
    except KeyboardInterrupt:
        pass
    finally:
        plt.close("all")


if __name__ == "__main__":
    main()
