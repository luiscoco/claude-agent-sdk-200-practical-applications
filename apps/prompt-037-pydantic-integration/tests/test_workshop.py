import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from workshop import (
    Workshop,
    consume_workshop,
    corrupt_duration,
    prepare_task,
    validate_mode,
)


class WorkshopTests(unittest.TestCase):
    def test_model_validation_supplies_typed_application_data(self):
        parsed = Workshop.model_validate(prepare_task("basics")["expected"])
        self.assertEqual(consume_workshop(parsed)["totalMinutesWithBreak"], 30)
        self.assertFalse(parsed.published)

    def test_strict_boundary_rejects_string_duration_and_keeps_original(self):
        original = prepare_task("basics")["expected"]
        with self.assertRaises(ValidationError) as caught:
            Workshop.model_validate(corrupt_duration(original))
        self.assertEqual(caught.exception.errors()[0]["loc"], ("duration_minutes",))
        self.assertEqual(original["duration_minutes"], 25)
        with self.assertRaises(ValidationError):
            Workshop.model_validate({**original, "extra": "unexpected"})
        with self.assertRaises(ValueError):
            validate_mode(["valid"])


if __name__ == "__main__":
    unittest.main()
