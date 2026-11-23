import unittest
from unittest.mock import patch

from src.agent import run_agent


class PreflightTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_task_is_rejected_before_query(self):
        with patch("src.agent.query", side_effect=AssertionError("SDK must not start")):
            with self.assertRaisesRegex(ValueError, "Enter a task"):
                await run_agent("   ")

    async def test_missing_key_is_rejected_before_query(self):
        with patch.dict("os.environ", {}, clear=True):
            with patch("src.agent.query", side_effect=AssertionError("SDK must not start")):
                with self.assertRaisesRegex(ValueError, "ANTHROPIC_API_KEY"):
                    await run_agent("Reply with READY.")


if __name__ == "__main__":
    unittest.main()
