from __future__ import annotations

from enum import Enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum, func

from core.database import db


class UserRole(str, Enum):
    ONG_ORIGANTE = "ong origante"
    ONG_COLABORADORA = "ong colaboradora"
    CONSSEJO_DIRECTIVO = "consejo directivo"
    SIN_DEFINIR = "sin definir"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    is_sysadmin = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    role = db.Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.SIN_DEFINIR)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at = db.Column(db.DateTime, nullable=True)

    def mark_deleted(self) -> None:
        """Soft-delete the user without removing the row."""
        self.deleted_at = datetime.utcnow()
        self.is_active = False

    def restore(self) -> None:
        """Restore a previously soft-deleted user."""
        self.deleted_at = None
        self.is_active = True
