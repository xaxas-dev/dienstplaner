import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 – alle Modelle registrieren
from app.database import Base, get_db
from app.main import app

# StaticPool: alle Threads nutzen dieselbe In-Memory-Verbindung
_ENGINE_KWARGS = {
    "connect_args": {"check_same_thread": False},
    "poolclass": StaticPool,
}


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite:///:memory:", **_ENGINE_KWARGS)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture
def client(engine):
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

    # Alle Daten nach jedem Test löschen (Isolierung)
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
