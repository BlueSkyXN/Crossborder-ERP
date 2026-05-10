"""Tests for structured JSON logging and readiness extensions."""
from __future__ import annotations

import json
import logging

from django.test import TestCase, RequestFactory
from rest_framework.test import APIRequestFactory

from apps.common.logging import StructuredJsonFormatter
from apps.common.views import ReadinessView


class StructuredJsonFormatterTests(TestCase):
    def setUp(self):
        self.formatter = StructuredJsonFormatter()

    def test_basic_fields(self):
        record = logging.LogRecord(
            name="apps.test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="hello %s",
            args=("world",),
            exc_info=None,
        )
        line = self.formatter.format(record)
        data = json.loads(line)
        self.assertEqual(data["level"], "INFO")
        self.assertEqual(data["logger"], "apps.test")
        self.assertEqual(data["message"], "hello world")
        self.assertIn("timestamp", data)

    def test_exception_included(self):
        try:
            raise ValueError("boom")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="apps.err",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg="failed",
            args=(),
            exc_info=exc_info,
        )
        line = self.formatter.format(record)
        data = json.loads(line)
        self.assertIn("exception", data)
        self.assertEqual(data["exception"]["type"], "ValueError")
        self.assertEqual(data["exception"]["message"], "boom")

    def test_extra_fields_propagated(self):
        record = logging.LogRecord(
            name="apps.req",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="req",
            args=(),
            exc_info=None,
        )
        record.request_id = "abc-123"
        record.user_id = 42
        line = self.formatter.format(record)
        data = json.loads(line)
        self.assertEqual(data["request_id"], "abc-123")
        self.assertEqual(data["user_id"], 42)

    def test_output_is_single_line(self):
        record = logging.LogRecord(
            name="apps.x",
            level=logging.WARNING,
            pathname="test.py",
            lineno=1,
            msg="multi\nline\nmessage",
            args=(),
            exc_info=None,
        )
        line = self.formatter.format(record)
        # JSON serialization escapes newlines, so the output should be one line
        self.assertEqual(line.count("\n"), 0)


class ReadinessExtendedTests(TestCase):
    def test_readiness_includes_provider_checks(self):
        factory = APIRequestFactory()
        request = factory.get("/api/readiness/")
        view = ReadinessView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertIn("storage", data["checks"])
        self.assertIn("virus_scan", data["checks"])
