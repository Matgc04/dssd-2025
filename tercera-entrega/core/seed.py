from __future__ import annotations

from typing import Tuple

from werkzeug.security import generate_password_hash

from core.database import db
from core.module.users.model import UserRole, User
from core.module.users.repository import UserRepository


def seed_all(app) -> None:
    """
    Seed the database with baseline data.

    This creates a sysadmin account and an auxiliary demo user with
    a different role so the app has both privileged and standard users.
    """
    with app.app_context():
        repo = UserRepository(db.session)
        admin, admin_dirty = _seed_admin(repo)
        if admin_dirty:
            print(f"Seeded admin user: {admin.username}")
        else:
            print("Seed skipped: admin user already exists.")

        demo_dirty = _seed_demo_users(repo)
        if demo_dirty:
            print("Seeded demo users.")
        else:
            print("Seed skipped: users already exist.")


def _seed_admin(repo: UserRepository) -> Tuple[User, bool]:
    username = "admin"
    existing = repo.get_by_username(username)
    if existing:
        return existing, False

    admin = repo.create(
        username=username,
        password_hash=generate_password_hash("admin123"),
        email="admin@example.com",
        is_sysadmin=True,
        is_active=True,
        role=UserRole.SIN_DEFINIR,
    )
    return admin, True


def _seed_demo_users(repo: UserRepository) -> bool:
    
    existing1 = repo.get_by_username("demo1")
    existing2 = repo.get_by_username("demo2")
    existing3 = repo.get_by_username("demo3")
     # Just return one of them
    
    if existing1 or existing2 or existing3:
        return False

    selectable_roles = [role for role in UserRole]
    selectable_roles.sort(key=lambda r: r.value)
    for idx, role in enumerate(selectable_roles):
        username = f"demo{idx+1}"
        existing = repo.get_by_username(username)
        if not existing:
            user = repo.create(
            username=username,
            password_hash=generate_password_hash("demo123"),
            email=f"{username}@example.com",
            is_sysadmin=False,
            role=role,
            )
            print(f"Seeded user: {user.username} ({user.role.value})")
        
    
    return True
    
        



__all__ = ["seed_all"]
