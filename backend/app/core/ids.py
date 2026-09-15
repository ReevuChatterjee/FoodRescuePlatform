"""
Short prefixed ID generator, e.g. new_id("don") -> "don_a1b2c3d4".

Matches the id style used throughout the contract examples (don_9931, ngo_017, ...).
Not sequential/guessable — fine for a student project; swap for a DB sequence if
predictable ordering is ever needed.
"""
import secrets


def new_id(prefix: str, length: int = 10) -> str:
    return f"{prefix}_{secrets.token_hex(max(length, 2) // 2)}"
