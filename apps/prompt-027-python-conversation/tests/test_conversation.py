import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from conversation import run_conversation, validate_mode


class ConversationTests(unittest.IsolatedAsyncioTestCase):
    def test_supported_mode_validation(self):
        self.assertEqual(validate_mode("conversation"), "conversation")
        with self.assertRaisesRegex(ValueError, "INVALID_MODE"):
            validate_mode("unknown")

    async def test_actual_sdk_rejects_query_before_connecting(self):
        report = await run_conversation("unconnected")
        self.assertTrue(report["verified"])
        self.assertFalse(report["success"])
        self.assertEqual(report["exception"]["type"], "CLIConnectionError")
        self.assertEqual(report["turns"], [])


if __name__ == "__main__":
    unittest.main()
