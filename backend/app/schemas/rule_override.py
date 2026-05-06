from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.rule_override import OverrideScope


class RuleOverrideBase(BaseModel):
    rule_key: str = Field(max_length=100)
    scope: OverrideScope = OverrideScope.GLOBAL
    doctor_id: int | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    override_value: str = Field(max_length=500)
    reason: str | None = None

    @model_validator(mode="after")
    def validate_scope_doctor_consistency(self) -> "RuleOverrideBase":
        if self.scope == OverrideScope.DOCTOR and self.doctor_id is None:
            raise ValueError("doctor_id ist Pflicht wenn scope=DOCTOR")
        if self.scope == OverrideScope.GLOBAL and self.doctor_id is not None:
            raise ValueError("doctor_id muss null sein wenn scope=GLOBAL")
        return self


class RuleOverrideCreate(RuleOverrideBase): ...


class RuleOverrideUpdate(BaseModel):
    rule_key: str | None = Field(default=None, max_length=100)
    scope: OverrideScope | None = None
    doctor_id: int | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    override_value: str | None = Field(default=None, max_length=500)
    reason: str | None = None


class RuleOverrideResponse(RuleOverrideBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
