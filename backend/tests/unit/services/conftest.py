"""Lokales conftest für Services-Unit-Tests.

Da shift_service.update_shift db.commit() aufruft, reicht session.rollback()
im globalen db-Fixture nicht zur Isolation aus. Dieses Fixture überschreibt db
und löscht nach jedem Test alle Tabellen explizit (analog zum client-Fixture).
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
