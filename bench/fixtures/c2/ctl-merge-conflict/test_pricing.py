import unittest
from decimal import Decimal

import pricing


class PricingTests(unittest.TestCase):
    def test_discount_tiers(self):
        self.assertEqual(pricing.volume_discount(9), Decimal("0"))
        self.assertEqual(pricing.volume_discount(10), Decimal("0.05"))
        self.assertEqual(pricing.volume_discount(100), Decimal("0.15"))

    def test_discount_applies_before_tax(self):
        # 50 x 10.00 = 500.00, 10% off = 450.00, 6.5% tax = 479.25
        self.assertEqual(pricing.line_total(Decimal("10.00"), 50, "WA"), Decimal("479.25"))

    def test_no_tax_state_keeps_discount(self):
        self.assertEqual(pricing.line_total(Decimal("10.00"), 10), Decimal("95.00"))

    def test_order_total(self):
        lines = [(Decimal("10.00"), 10), (Decimal("2.50"), 4)]
        self.assertEqual(pricing.order_total(lines, "CA"), Decimal("112.62"))


if __name__ == "__main__":
    unittest.main()
