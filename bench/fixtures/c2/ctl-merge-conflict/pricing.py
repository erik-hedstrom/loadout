from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")

<<<<<<< HEAD
VOLUME_TIERS = [(100, Decimal("0.15")), (50, Decimal("0.10")), (10, Decimal("0.05"))]


def volume_discount(quantity: int) -> Decimal:
    """Fraction off the unit price for orders of this size."""
    for minimum, discount in VOLUME_TIERS:
        if quantity >= minimum:
            return discount
    return Decimal("0")


def line_total(unit_price: Decimal, quantity: int) -> Decimal:
    discount = volume_discount(quantity)
    return (unit_price * quantity * (1 - discount)).quantize(CENT, rounding=ROUND_HALF_UP)
=======
TAX_RATES = {"OR": Decimal("0"), "WA": Decimal("0.065"), "CA": Decimal("0.0725")}


def line_total(unit_price: Decimal, quantity: int, state: str = "OR") -> Decimal:
    rate = TAX_RATES[state]
    return (unit_price * quantity * (1 + rate)).quantize(CENT, rounding=ROUND_HALF_UP)
>>>>>>> feature/sales-tax


def order_total(lines: list[tuple[Decimal, int]], state: str = "OR") -> Decimal:
    return sum((line_total(price, qty, state) for price, qty in lines), Decimal("0"))
