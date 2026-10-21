"""Structured SDK errors, with compatibility for existing built-in catches."""

import errno


class ShroomError(Exception):
    """An actionable SDK failure; ``cause`` retains the original exception."""

    def __init__(self, message: str, *, code: str, stage: str,
                 suggestion: str, details: dict | None = None,
                 cause: BaseException | None = None):
        super().__init__(message)
        self.code = code
        self.stage = stage
        self.suggestion = suggestion
        self.details = dict(details or {})
        self.cause = cause
        if cause is not None:
            self.__cause__ = cause

    def to_dict(self) -> dict:
        """A serializable snapshot, excluding the original exception object."""
        return {"code": self.code, "message": str(self), "stage": self.stage,
                "suggestion": self.suggestion, "details": dict(self.details)}


class ShroomConfigError(ShroomError, ValueError):
    """Invalid caller configuration (also a ValueError)."""


class ShroomIOError(ShroomError, OSError):
    """Serial query or I/O failure (also an OSError)."""


class ShroomDependencyError(ShroomError, ImportError):
    """An unavailable optional dependency (also an ImportError)."""


class ShroomStateError(ShroomIOError, RuntimeError):
    """A closed device (also a RuntimeError for pre-structured-error callers)."""


class ShroomParseError(ShroomError, ValueError):
    """An invalid payload or parser failure (also a ValueError)."""


class ShroomParseTypeError(ShroomError, TypeError):
    """An invalid payload type (also a TypeError)."""


class ShroomPortAmbiguousError(ShroomIOError, ValueError):
    """More than one candidate port (also a ValueError as in earlier releases)."""


class ShroomLicenseError(ShroomError, PermissionError):
    """A missing, expired or insufficient SDK license."""


def invalid_config(message: str, *, option: str | None = None,
                   cause: BaseException | None = None) -> ShroomConfigError:
    return ShroomConfigError(message, code="INVALID_CONFIG", stage="configure",
                             suggestion="请检查参数类型、取值范围和行列/线序配置后重试。",
                             details={"option": option} if option else {}, cause=cause)


def serial_error(exc: Exception, stage: str, *, path: str | None = None) -> ShroomIOError:
    """Classify OS/pySerial failures without depending on pySerial itself."""
    number = getattr(exc, "errno", None)
    message = str(exc)
    lowered = message.lower()
    code = {"query": "CONNECTION_FAILED", "connect": "CONNECTION_FAILED",
            "read": "READ_FAILED", "write": "WRITE_FAILED", "close": "CLOSE_FAILED"}[stage]
    if stage != "close":
        if number in (errno.EBUSY, errno.EAGAIN) or any(text in lowered for text in (
                "resource busy", "port busy", "already open", "in use", "exclusively lock")):
            code = "PORT_BUSY"
        elif number in (errno.EACCES, errno.EPERM) or isinstance(exc, PermissionError) or any(
                text in lowered for text in ("permission denied", "access is denied", "access denied")):
            code = "PERMISSION_DENIED"
        elif stage in ("read", "write") and (number in (errno.ENODEV, errno.ENXIO, errno.EIO)
                or any(text in lowered for text in (
                    "disconnected", "unplugged", "device not connected", "clearcommerror failed",
                    "device reports readiness to read but returned no data"))):
            code = "DISCONNECTED"
        elif stage == "connect" and (number in (errno.ENOENT, errno.ENODEV, errno.ENXIO)
                or isinstance(exc, FileNotFoundError) or any(text in lowered for text in (
                    "no such file", "cannot find", "could not find", "port not found"))):
            code = "PORT_NOT_FOUND"
    suggestions = {
        "PORT_BUSY": "请关闭其他占用串口的软件，再重试连接。",
        "PERMISSION_DENIED": "请检查串口访问权限，并关闭可能占用串口的软件。",
        "PORT_NOT_FOUND": "请检查设备连接和驱动，并用 list_ports() 确认端口名称。",
        "DISCONNECTED": "设备可能已拔出；请检查线缆和供电，再显式重新连接。",
        "READ_FAILED": "请检查设备连接、串口驱动和读取参数后重试。",
        "WRITE_FAILED": "请检查设备连接，以及待发送数据和设备协议后重试。",
        "CLOSE_FAILED": "关闭串口失败；请检查驱动及操作系统中的端口占用状态。",
        "CONNECTION_FAILED": "请检查设备、驱动、端口名称和串口配置后重试。",
    }
    details = {"path": path} if path is not None else {}
    if number is not None:
        details["errno"] = number
    winerror = getattr(exc, "winerror", None)
    if winerror is not None:
        details["winerror"] = winerror
    return ShroomIOError(message or f"Serial {stage} failed", code=code, stage=stage,
                         suggestion=suggestions[code], details=details, cause=exc)
