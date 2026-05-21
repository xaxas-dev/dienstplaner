"""Arzt-Titel als eigenes Feld

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-21
"""

from __future__ import annotations

import re

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels = None
depends_on = None

TITLE_PREFIXES = ("Prof. Dr.", "Prof Dr.", "Prof.", "Prof", "Dr.", "Dr", "PD")


def _split_title_from_name(name: str) -> tuple[str | None, str]:
    normalized = name.strip()
    for title in TITLE_PREFIXES:
        match = re.match(rf"^{re.escape(title)}\s+(.+)$", normalized, flags=re.IGNORECASE)
        if match is None:
            continue
        canonical_title = {
            "prof dr.": "Prof. Dr.",
            "prof. dr.": "Prof. Dr.",
            "prof": "Prof.",
            "prof.": "Prof.",
            "dr": "Dr.",
            "dr.": "Dr.",
            "pd": "PD",
        }[title.lower()]
        return canonical_title, match.group(1).strip()
    return None, normalized


def upgrade() -> None:
    op.add_column("doctors", sa.Column("title", sa.String(50), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, name FROM doctors")).mappings().all()
    for row in rows:
        title, clean_name = _split_title_from_name(row["name"])
        if title is None:
            continue
        connection.execute(
            sa.text("UPDATE doctors SET title = :title, name = :name WHERE id = :id"),
            {"title": title, "name": clean_name, "id": row["id"]},
        )


def downgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, title, name FROM doctors WHERE title IS NOT NULL AND title != ''")
    ).mappings().all()
    for row in rows:
        connection.execute(
            sa.text("UPDATE doctors SET name = :name WHERE id = :id"),
            {"name": f"{row['title']} {row['name']}", "id": row["id"]},
        )

    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("title")
