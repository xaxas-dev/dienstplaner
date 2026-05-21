from pydantic import BaseModel


class INAAvailabilityEntry(BaseModel):
    available: bool
    reasons: list[str]
