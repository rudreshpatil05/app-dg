from typing import Any, Sequence


def paginate_items(items: Sequence[Any], page: int = 1, page_size: int = 10):
    total_items = len(items)
    safe_page = max(1, page)
    safe_page_size = max(1, page_size)
    total_pages = max(1, (total_items + safe_page_size - 1) // safe_page_size) if total_items else 1

    start = (safe_page - 1) * safe_page_size
    end = start + safe_page_size
    page_items = list(items[start:end])

    return {
        "items": page_items,
        "pagination": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_prev": safe_page > 1,
            "has_next": safe_page < total_pages,
        },
    }
