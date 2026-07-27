"""
normalize.py — Pure, deterministic merchant string normalizer.

Pipeline (order is significant):
 1. Strip trailing bracketed tokens   e.g. [ID], [123]
 2. Strip known pass-through processor prefixes  e.g. SQ *, AMZN MKTP *
 3. Strip punctuation (keep letters, digits, whitespace)
 4. Lowercase
 5. Strip trailing PH city/location suffixes
 6. Collapse and strip whitespace

No I/O, no side effects.  Can be freely imported in tests.
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# 1. Trailing bracket tokens  [ID], [123456ABC], etc.
# ---------------------------------------------------------------------------
_TRAILING_BRACKETS = re.compile(r"\s*\[[^\]]*\]\s*$")

# ---------------------------------------------------------------------------
# 2. Known pass-through processor prefixes — strip them entirely.
#    These are payment intermediaries; the merchant follows after "*".
#    PAYPAL is intentionally excluded: it is itself a merchant that
#    users buy things through and should remain in the normalized key.
# ---------------------------------------------------------------------------
_PROCESSOR_PREFIX = re.compile(
    r"^(?:SQ|AMZN\s+MKTP|AMZN|UBER|UPWORK|STRIPE)\s*\*\s*",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# 3. Punctuation — keep word characters (\w) and whitespace only.
# ---------------------------------------------------------------------------
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)

# ---------------------------------------------------------------------------
# 5. Trailing PH city/location tags (applied *after* lowercase).
#    The leading \s+ guard prevents false-positives where the location
#    is embedded in the merchant name itself.
# ---------------------------------------------------------------------------
_TRAILING_LOCATION = re.compile(
    r"""
    \s+
    (?:
        bgc
      | makati
      | manila
      | mandaluyong
      | pasig
      | pasay
      | quezon\s+city
      | qc
      | paranaque
      | paran[aá]aque
      | taguig
      | muntinlupa
      | cavite
      | laguna
      | cebu
      | cdo
      | davao
      | dav
      | ceb
      | marikina
      | valenzuela
      | caloocan
      | malabon
      | las\s+pinas
      | san\s+juan
      | cainta
      | antipolo
      | binan
      | sta\s+rosa
      | santa\s+rosa
      | batangas
    )
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

# ---------------------------------------------------------------------------
# 6. Multiple whitespace → single space
# ---------------------------------------------------------------------------
_MULTI_SPACE = re.compile(r"\s+")


def normalize(raw: str) -> str:
    """
    Normalize a raw merchant string into a stable dictionary key.

    >>> normalize("PAYPAL *NBA LG PASS, [ID]")
    'paypal nba lg pass'
    >>> normalize("SQ *STARBUCKS BGC")
    'starbucks'
    >>> normalize("SM SUPERMARKET MAKATI")
    'sm supermarket'
    >>> normalize("JOLLIBEE SM NORTH")
    'jollibee sm north'
    >>> normalize("")
    ''
    """
    s = raw.strip()
    if not s:
        return ""

    # 1. Trailing bracketed tokens
    s = _TRAILING_BRACKETS.sub("", s).strip()

    # 2. Known processor prefixes
    s = _PROCESSOR_PREFIX.sub("", s).strip()

    # 3. Punctuation → space
    s = _PUNCT.sub(" ", s)

    # 4. Lowercase
    s = s.lower()

    # 5. Trailing location suffix (single pass)
    s = _TRAILING_LOCATION.sub("", s).strip()

    # 6. Collapse whitespace
    s = _MULTI_SPACE.sub(" ", s).strip()

    return s
