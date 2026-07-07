"""
Centralized logging configuration for the QMS application.

All logging should use these utilities instead of print() statements.
This enables structured logging, filtering, and future integration with external systems.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "qms.log")
LOG_MAX_BYTES = 10 * 1024 * 1024
LOG_BACKUP_COUNT = 5


def _setup_logger(name: str) -> logging.Logger:
    """Configure a logger with both console and file output."""
    logger = logging.getLogger(name)
    logger.setLevel(LOG_LEVEL)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    try:
        file_handler = RotatingFileHandler(
            LOG_FILE,
            maxBytes=LOG_MAX_BYTES,
            backupCount=LOG_BACKUP_COUNT,
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except OSError as e:
        logger.warning(f"Could not create file handler for {LOG_FILE}: {e}")

    return logger


logger = _setup_logger("qms")


# Specialized loggers for different subsystems
email_logger = _setup_logger("qms.email")
db_logger = _setup_logger("qms.db")
auth_logger = _setup_logger("qms.auth")
api_logger = _setup_logger("qms.api")
