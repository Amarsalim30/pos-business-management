import datetime
import io
import os
import shutil
import subprocess
from typing import Generator
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings


def generate_sqlite_dump(db: Session) -> Generator[bytes, None, None]:
    """Generates an SQL dump stream for SQLite database sessions."""
    header = (
        f"-- POS & Business Management System Database Backup (SQLite)\n"
        f"-- Timestamp: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n"
        f"-- Application: {settings.PROJECT_NAME}\n\n"
    )
    yield header.encode("utf-8")

    try:
        raw_conn = db.connection().connection
        if hasattr(raw_conn, "iterdump"):
            for statement in raw_conn.iterdump():
                yield f"{statement}\n".encode("utf-8")
            return
    except Exception:
        pass

    # Fallback generic metadata dump
    yield b"-- Fallback table data dump\n"
    for table_name in db.bind.table_names() if hasattr(db.bind, "table_names") else []:
        yield f"-- Table: {table_name}\n".encode("utf-8")


def generate_postgres_dump(db_url: str) -> Generator[bytes, None, None]:
    """Runs pg_dump and yields output chunks."""
    header = (
        f"-- POS & Business Management System Database Backup (PostgreSQL)\n"
        f"-- Timestamp: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n"
        f"-- Application: {settings.PROJECT_NAME}\n\n"
    )
    yield header.encode("utf-8")

    pg_dump_bin = shutil.which("pg_dump")
    if not pg_dump_bin:
        yield b"-- WARNING: pg_dump utility not found on host machine.\n"
        yield b"-- Please ensure postgresql-client is installed.\n"
        return

    # Parse connection string or pass db_url directly to pg_dump
    env = os.environ.copy()
    try:
        proc = subprocess.Popen(
            [pg_dump_bin, "--dbname", db_url, "--clean", "--if-exists", "--no-owner", "--no-privileges"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env
        )

        while True:
            chunk = proc.stdout.read(65536)
            if not chunk:
                break
            yield chunk

        proc.stdout.close()
        proc.wait()
    except Exception as e:
        yield f"\n-- Error during pg_dump execution: {str(e)}\n".encode("utf-8")


def export_database_sql(db: Session) -> Generator[bytes, None, None]:
    """Determines database dialect and returns a streaming SQL generator."""
    dialect_name = db.bind.dialect.name.lower()
    if "sqlite" in dialect_name:
        yield from generate_sqlite_dump(db)
    else:
        yield from generate_postgres_dump(settings.DATABASE_URL)


def get_backup_metadata() -> dict:
    """Returns local backup status and directories."""
    backup_dir = os.path.expanduser("~/.pos_backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    files = [
        f for f in os.listdir(backup_dir) 
        if f.endswith(".sql") or f.endswith(".sql.gz")
    ]
    
    recent_backups = []
    total_size = 0
    
    for f in sorted(files, reverse=True)[:10]:
        fpath = os.path.join(backup_dir, f)
        stat = os.stat(fpath)
        total_size += stat.st_size
        recent_backups.append({
            "filename": f,
            "size_bytes": stat.st_size,
            "created_at": datetime.datetime.fromtimestamp(stat.st_mtime, tz=datetime.timezone.utc).isoformat()
        })
        
    return {
        "backup_directory": backup_dir,
        "total_backups_count": len(files),
        "total_size_bytes": total_size,
        "recent_backups": recent_backups,
        "status": "ready"
    }
