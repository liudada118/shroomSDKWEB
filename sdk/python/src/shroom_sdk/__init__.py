"""Shroom SDK for Python. Core and mock work without third-party packages."""

from .device import Device, MockDevice, PortInfo, SerialDevice, connect, list_ports, mock
from .display import render_ascii
from .frame import Center, Frame, decode_frame, get_layout, resolve_shape
from .framer import DEFAULT_DELIMITER, Framer

__version__ = "0.1.0"
__all__ = ["Shroom", "Device", "SerialDevice", "MockDevice", "PortInfo", "Frame", "Center",
           "connect", "mock", "list_ports", "render_ascii", "decode_frame", "resolve_shape",
           "get_layout", "Framer", "DEFAULT_DELIMITER", "__version__"]


class Shroom:
    version = __version__
    connect = staticmethod(connect)
    mock = staticmethod(mock)
    list_ports = staticmethod(list_ports)
    render_ascii = staticmethod(render_ascii)
