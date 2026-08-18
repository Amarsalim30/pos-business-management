import sys
import os
from pathlib import Path

# Ensure both backend root and project root are in sys.path
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Support both import paths
try:
    from backend.app.main import app
except ModuleNotFoundError:
    from app.main import app
