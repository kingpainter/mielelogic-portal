# VERSION = "2.5.4"
"""Spam filter for MieleLogic notifications.

Prevents the same notification from being sent more than once per minute,
e.g. when a calendar sync trigger fires twice in quick succession.
"""
from __future__ import annotations

import logging
import time

_LOGGER = logging.getLogger(__name__)

SPAM_FILTER_SECONDS = 60
_CLEANUP_AGE = 3600  # Remove entries older than 1 hour


class NotificationSpamFilter:
    """Prevent duplicate notifications within SPAM_FILTER_SECONDS."""

    def __init__(self) -> None:
        """Initialize the spam filter."""
        self._last_sent: dict[str, float] = {}

    def should_send(self, notification_key: str) -> bool:
        """Return True if the notification may be sent now.

        notification_key examples:
          "booking_created:1_2026-06-11T14:00:00"
          "booking_canceled:1_2026-06-11T14:00:00"
          "reminder_15min:1_2026-06-11T14:00:00"
          "test:booking_created"
        """
        now = time.monotonic()
        self._cleanup(now)

        last = self._last_sent.get(notification_key)
        if last is not None and (now - last) < SPAM_FILTER_SECONDS:
            remaining = int(SPAM_FILTER_SECONDS - (now - last))
            _LOGGER.debug(
                "Spam filter blocked '%s' — retry in %ds",
                notification_key,
                remaining,
            )
            return False

        self._last_sent[notification_key] = now
        return True

    def reset(self, notification_key: str) -> None:
        """Reset the filter for a specific key (used in tests and test_notification)."""
        self._last_sent.pop(notification_key, None)

    def _cleanup(self, now: float) -> None:
        """Remove stale entries to prevent unbounded memory growth."""
        stale = [k for k, t in self._last_sent.items() if (now - t) > _CLEANUP_AGE]
        for k in stale:
            del self._last_sent[k]
