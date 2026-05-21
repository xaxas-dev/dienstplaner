"""Lokales conftest für Services-Tests.

Da absence_service.create_absence/update_absence/delete_absence db.commit() aufrufen,
reicht session.rollback() im globalen db-Fixture nicht zur Isolation aus.
Dieses Fixture überschreibt db und löscht nach jedem Test alle Tabellen explizit.
"""
import pytest
from sqlalchemy.orm import Session

from app.database import Base


@pytest.fixture
def db(engine):  # type: ignore[override]
    with Session(engine) as session:
        yield session
        session.rollback()
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
