from datetime import datetime


def merge_bookings(bookings: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    """Merge room bookings that overlap or touch into single bookings.

    Input is unsorted. Each booking is (start, end) with start <= end.
    The result is sorted by start and has no two bookings that overlap or
    share an endpoint. A booking with start > end raises ValueError.
    """
    raise NotImplementedError
