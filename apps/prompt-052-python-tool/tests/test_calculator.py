import json
import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from calculator import CalculatorInput, calculate, native_outcome


class CalculatorTests(unittest.TestCase):
    def test_four_arithmetic_operations(self):
        for operation, left, right, expected in [
            ("add", 24, 18, 42),
            ("subtract", 24, 18, 6),
            ("multiply", 6, 7, 42),
            ("divide", 42, 7, 6),
        ]:
            value = CalculatorInput(operation=operation, left=left, right=right)
            self.assertEqual(calculate(value).result, expected)

    def test_domain_errors_and_zero_serialization(self):
        self.assertEqual(
            calculate(CalculatorInput(operation="divide", left=24, right=0)).errorCode,
            "DIVISION_BY_ZERO",
        )
        self.assertEqual(
            calculate(
                CalculatorInput(operation="divide", left=1000000, right=5e-324)
            ).errorCode,
            "NON_FINITE_RESULT",
        )
        outcome = calculate(
            CalculatorInput(operation="multiply", left=-1, right=0)
        ).model_dump()
        self.assertEqual(native_outcome(json.dumps(outcome)), outcome)

    def test_strict_schema_rejects_boolean_string_and_out_of_range_operands(self):
        for left in [True, "24", 1000001, float("nan"), float("inf")]:
            with self.assertRaises(ValidationError):
                CalculatorInput(operation="add", left=left, right=18)

    def test_native_text_block_result_and_malformed_content(self):
        outcome = {"ok": True, "result": 42, "errorCode": ""}
        self.assertEqual(
            native_outcome([{"type": "text", "text": json.dumps(outcome)}]), outcome
        )
        self.assertIsNone(native_outcome("plain native error"))
        self.assertIsNone(native_outcome(None))


if __name__ == "__main__":
    unittest.main()
