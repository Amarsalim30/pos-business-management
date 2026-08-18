from decimal import Decimal
from typing import Optional, Tuple


def format_roll_display(quantity: Decimal, meters_per_roll: Optional[Decimal]) -> str:
    """
    Format decimal meter quantity into clean 'X rolls + Y.Xm loose' string.
    Example: 485.0 meters with 100m/roll -> '4 rolls + 85.0m loose (485.0m total)'
    """
    if not meters_per_roll or meters_per_roll <= 0:
        return f"{quantity:.2f}".rstrip("0").rstrip(".")
    
    qty = Decimal(str(quantity))
    mpr = Decimal(str(meters_per_roll))
    
    full_rolls = int(qty // mpr)
    loose_meters = qty % mpr
    
    if full_rolls > 0 and loose_meters > 0:
        return f"{full_rolls} rolls + {loose_meters:.1f}m loose ({qty:.1f}m total)"
    elif full_rolls > 0:
        return f"{full_rolls} rolls ({qty:.1f}m)"
    else:
        return f"{loose_meters:.1f}m loose"


def parse_roll_breakdown(quantity: Decimal, meters_per_roll: Optional[Decimal]) -> Tuple[int, Decimal]:
    """Return tuple of (full_rolls, loose_meters)."""
    if not meters_per_roll or meters_per_roll <= 0:
        return 0, quantity
    qty = Decimal(str(quantity))
    mpr = Decimal(str(meters_per_roll))
    full_rolls = int(qty // mpr)
    loose_meters = qty % mpr
    return full_rolls, loose_meters


def roll_count_to_meters(rolls: int, loose_meters: Decimal, meters_per_roll: Decimal) -> Decimal:
    """Convert (rolls + loose meters) into total meters base quantity."""
    return (Decimal(rolls) * Decimal(str(meters_per_roll))) + Decimal(str(loose_meters))
