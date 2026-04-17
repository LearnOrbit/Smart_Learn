"""
Migration: Add announcements table
Run: python migrate_announcements.py
"""

import uuid
from sqlalchemy import create_engine, Column, String, Text, DateTime, Boolean, ForeignKey, inspect
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./core_quest.db")
engine = create_engine(DATABASE_URL, echo=False)
Base = declarative_base()


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(String, ForeignKey("users.id"),
                        nullable=False, index=True)
    subject_id = Column(String, ForeignKey(
        "subjects.id"), nullable=True, index=True)
    title = Column(String, nullable=True, default="")
    message = Column(Text, nullable=False)
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())


def run_migration():
    """Create announcements table if it doesn't exist"""
    inspector = inspect(engine)
    if "announcements" in inspector.get_table_names():
        print("✅ Table 'announcements' already exists — skipping.")
        return

    Announcement.__table__.create(engine)
    print("✅ Created table: announcements")
    print("   - Fields: id, teacher_id, subject_id, title, message, pinned, created_at, updated_at")
    print("   - FK teacher_id → users.id")
    print("   - FK subject_id → subjects.id")
    print("   - Indexes: teacher_id, subject_id, created_at")


if __name__ == "__main__":
    run_migration()
