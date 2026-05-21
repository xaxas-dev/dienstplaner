from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_migration_module():
    path = Path(__file__).parents[2] / "alembic" / "versions" / "0007_doctor_titles.py"
    spec = spec_from_file_location("doctor_title_migration", path)
    assert spec is not None
    assert spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_extracts_known_doctor_title_prefixes() -> None:
    migration = _load_migration_module()

    assert migration._split_title_from_name("Dr. Anna Berger") == ("Dr.", "Anna Berger")
    assert migration._split_title_from_name("PD Max Meyer") == ("PD", "Max Meyer")
    assert migration._split_title_from_name("Prof. Dr. Clara Dietrich") == (
        "Prof. Dr.",
        "Clara Dietrich",
    )


def test_leaves_names_without_known_title_unchanged() -> None:
    migration = _load_migration_module()

    assert migration._split_title_from_name("Anna Berger") == (None, "Anna Berger")
