"""Add persistent remote browser contexts and sessions.

Revision ID: 20260902_0002
Revises: 20260902_0001
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260902_0002"
down_revision: str | None = "20260902_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("remote_context_id", sa.String(length=128), nullable=True))
    op.create_index("uq_profiles_remote_context_id", "profiles", ["remote_context_id"], unique=True)
    op.add_column(
        "browser_sessions",
        sa.Column("provider", sa.String(length=24), nullable=False, server_default="disabled"),
    )
    op.add_column(
        "browser_sessions", sa.Column("remote_session_id", sa.String(length=128), nullable=True)
    )
    op.add_column(
        "browser_sessions", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "uq_browser_sessions_remote_session_id",
        "browser_sessions",
        ["remote_session_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_browser_sessions_remote_session_id", table_name="browser_sessions")
    op.drop_column("browser_sessions", "expires_at")
    op.drop_column("browser_sessions", "remote_session_id")
    op.drop_column("browser_sessions", "provider")
    op.drop_index("uq_profiles_remote_context_id", table_name="profiles")
    op.drop_column("profiles", "remote_context_id")
