from __future__ import annotations

from typing import Iterable, Optional, Union

from sqlalchemy import inspect as sa_inspect, select
from sqlalchemy.orm import Session

from core.database import db
from .model import User, UserRole


class UserRepository:
    def __init__(self, session: Optional[Session] = None) -> None:
        self._session = session or db.session

    @property
    def session(self) -> Session:
        return self._session

    def create(
        self,
        *,
        username: str,
        password_hash: str,
        email: str,
        is_sysadmin: bool = False,
        is_active: bool = True,
        role: Union[UserRole, str] = UserRole.SIN_DEFINIR
    ) -> User:
        user = User(
            username=username,
            password_hash=password_hash,
            email=email,
            is_sysadmin=is_sysadmin,
            is_active=is_active,
            role=self._coerce_role(role),
        )
        self.session.add(user)
        
        self.session.commit()
        return user

    def get(self, user_id: int) -> Optional[User]:
        return self.session.get(User, user_id)

    def get_by_username(self, username: str) -> Optional[User]:
        stmt = select(User).where(User.username == username)
        return self.session.execute(stmt).scalar_one_or_none()

    def list(self, *, include_deleted: bool = False) -> Iterable[User]:
        stmt = select(User).order_by(User.username)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        return self.session.execute(stmt).scalars().all()

    def update(self, user: User, **changes) -> User:
        mapper = sa_inspect(User)
        column_names = {attr.key for attr in mapper.column_attrs}
        invalid_fields = set(changes) - column_names
        if invalid_fields:
            unknown = ", ".join(sorted(invalid_fields))
            raise AttributeError(f"Unknown field(s) for User: {unknown}")

        immutable_fields = {"id", "created_at", "updated_at"}
        updates = {
            key: value for key, value in changes.items() if key not in immutable_fields
        }

        if "role" in updates:
            updates["role"] = self._coerce_role(updates["role"])

        for field, value in updates.items():
            setattr(user, field, value)

        
        self.session.commit()
        return user

    def delete(self, user: User, *, soft: bool = True, commit: bool = True) -> None:
        if soft:
            user.mark_deleted()
            self.session.add(user)
        else:
            self.session.delete(user)
        if commit:
            self.session.commit()

    def is_sys_admin(self, user_id: int) -> bool:
        user = self.get(user_id)
        return bool(user and user.is_sysadmin and user.deleted_at is None)

    @staticmethod
    def _coerce_role(value: Union[UserRole, str]) -> UserRole:
        if isinstance(value, UserRole):
            return value

        if isinstance(value, str):
            normalized = value.strip()
            for role in UserRole:
                if role.value == normalized:
                    return role

            normalized_name = normalized.replace(" ", "_").upper()
            if normalized_name in UserRole.__members__:
                return UserRole[normalized_name]

        raise ValueError(f"Unsupported user role: {value!r}")
