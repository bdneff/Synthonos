"""Make the synthmatch package importable when pytest runs from the repo root."""

from __future__ import annotations

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))


def pytest_configure(config) -> None:
    config.addinivalue_line("markers", "slow: long-running search test")
