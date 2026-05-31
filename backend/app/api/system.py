import hashlib
import platform
import uuid

from fastapi import APIRouter

router = APIRouter()


@router.get("/hardware-id")
def get_hardware_id() -> dict:
    raw = platform.node() + str(uuid.getnode())
    hardware_id = hashlib.md5(raw.encode()).hexdigest()[:12]
    return {"hardware_id": hardware_id}
