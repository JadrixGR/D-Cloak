"""Initial NovaShield schema.

Revision ID: 20260902_0001
Revises:
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260902_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("auth_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_status", "users", ["status"])

    op.create_table(
        "platform_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("singleton_key", sa.String(length=16), nullable=False),
        sa.Column("default_server_ip", sa.String(length=64), nullable=False),
        sa.Column("default_timezone", sa.String(length=64), nullable=False),
        sa.Column("default_locale", sa.String(length=16), nullable=False),
        sa.Column("auto_start_on_create", sa.Boolean(), nullable=False),
        sa.Column("max_concurrent_profiles", sa.Integer(), nullable=False),
        sa.Column("webrtc_protection", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("singleton_key", name="uq_platform_settings_singleton"),
    )

    op.create_table(
        "proxies",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("owner_id", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("encrypted_password", sa.LargeBinary(), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("detected_ip", sa.String(length=64), nullable=True),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("healthy", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_proxies_owner_id", "proxies", ["owner_id"])

    op.create_table(
        "profiles",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("owner_id", sa.String(length=40), nullable=False),
        sa.Column("proxy_id", sa.String(length=40), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("os", sa.String(length=32), nullable=False),
        sa.Column("fingerprint", sa.String(length=160), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=16), nullable=False),
        sa.Column("use_default_ip", sa.Boolean(), nullable=False),
        sa.Column("effective_ip", sa.String(length=64), nullable=False),
        sa.Column("storage_namespace", sa.String(length=80), nullable=False),
        sa.Column("last_session_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proxy_id"], ["proxies.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("storage_namespace", name="uq_profiles_storage_namespace"),
    )
    op.create_index("ix_profiles_owner_id", "profiles", ["owner_id"])
    op.create_index("ix_profiles_status", "profiles", ["status"])

    op.create_table(
        "profile_vaults",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("profile_id", sa.String(length=40), nullable=False),
        sa.Column("encrypted_payload", sa.LargeBinary(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_profile_vaults_profile_id", "profile_vaults", ["profile_id"], unique=True)

    op.create_table(
        "browser_sessions",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("profile_id", sa.String(length=40), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_browser_sessions_profile_id", "browser_sessions", ["profile_id"])
    op.create_index("ix_browser_sessions_started_at", "browser_sessions", ["started_at"])

    op.create_table(
        "activity",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("actor_id", sa.String(length=40), nullable=False),
        sa.Column("actor_name", sa.String(length=120), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("target", sa.String(length=160), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=16), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_activity_actor_id", "activity", ["actor_id"])
    op.create_index("ix_activity_action", "activity", ["action"])
    op.create_index("ix_activity_at", "activity", ["at"])


def downgrade() -> None:
    op.drop_table("activity")
    op.drop_table("browser_sessions")
    op.drop_table("profile_vaults")
    op.drop_table("profiles")
    op.drop_table("proxies")
    op.drop_table("platform_settings")
    op.drop_table("users")
