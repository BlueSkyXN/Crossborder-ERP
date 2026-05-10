"""Tests for StorageProvider and VirusScanProvider abstractions."""
from __future__ import annotations

import io
import tempfile
from pathlib import Path

import pytest
from django.test import TestCase, override_settings

from apps.files.providers.registry import get_storage_provider, get_virus_scan_provider
from apps.files.providers.storage.base import StorageProvider, StorageResult
from apps.files.providers.storage.disabled import DisabledStorageProvider
from apps.files.providers.storage.fake_object import FakeObjectStorageProvider
from apps.files.providers.storage.local import LocalStorageProvider
from apps.files.providers.virus_scan.base import ScanVerdict, VirusScanProvider
from apps.files.providers.virus_scan.disabled import DisabledVirusScanProvider
from apps.files.providers.virus_scan.fake import FakeVirusScanProvider


# --- Local storage ---

class LocalStorageProviderTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def _provider(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            return LocalStorageProvider()

    def test_save_and_open(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            provider = LocalStorageProvider()
            data = b"hello, world!"
            result = provider.save("test/file.txt", io.BytesIO(data))
            self.assertIsInstance(result, StorageResult)
            self.assertEqual(result.storage_key, "test/file.txt")
            self.assertEqual(result.size_bytes, len(data))
            self.assertTrue(len(result.checksum_sha256) == 64)

            f = provider.open("test/file.txt")
            self.assertEqual(f.read(), data)
            f.close()

    def test_exists_and_delete(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            provider = LocalStorageProvider()
            provider.save("del_me.bin", io.BytesIO(b"x"))
            self.assertTrue(provider.exists("del_me.bin"))
            self.assertTrue(provider.delete("del_me.bin"))
            self.assertFalse(provider.exists("del_me.bin"))
            self.assertFalse(provider.delete("del_me.bin"))

    def test_path_traversal_blocked(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            provider = LocalStorageProvider()
            with self.assertRaises(ValueError):
                provider.save("../../etc/passwd", io.BytesIO(b"bad"))

    def test_sibling_prefix_traversal_blocked(self):
        """Sibling dir whose name starts with MEDIA_ROOT dirname must be rejected."""
        with self.settings(MEDIA_ROOT=self.tmpdir):
            provider = LocalStorageProvider()
            with self.assertRaises(ValueError):
                provider.save("../media_evil/file.txt", io.BytesIO(b"bad"))

    def test_open_nonexistent_raises(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            provider = LocalStorageProvider()
            with self.assertRaises(FileNotFoundError):
                provider.open("no_such_file.txt")

    def test_validate_configuration(self):
        with self.settings(MEDIA_ROOT=self.tmpdir):
            info = LocalStorageProvider().validate_configuration()
            self.assertEqual(info["provider"], "local")
            self.assertTrue(info["writable"])


# --- Fake object storage ---

class FakeObjectStorageTests(TestCase):
    def test_save_and_open(self):
        provider = FakeObjectStorageProvider()
        data = b"test data 123"
        result = provider.save("key1", io.BytesIO(data))
        self.assertEqual(result.size_bytes, len(data))
        self.assertEqual(provider.open("key1").read(), data)

    def test_delete(self):
        provider = FakeObjectStorageProvider()
        provider.save("k", io.BytesIO(b"v"))
        self.assertTrue(provider.delete("k"))
        self.assertFalse(provider.exists("k"))

    def test_open_nonexistent_raises(self):
        provider = FakeObjectStorageProvider()
        with self.assertRaises(FileNotFoundError):
            provider.open("nope")


# --- Disabled storage ---

class DisabledStorageTests(TestCase):
    def test_operations_raise(self):
        provider = DisabledStorageProvider()
        with self.assertRaises(RuntimeError):
            provider.save("x", io.BytesIO(b""))
        with self.assertRaises(RuntimeError):
            provider.open("x")
        with self.assertRaises(RuntimeError):
            provider.delete("x")

    def test_exists_returns_false(self):
        self.assertFalse(DisabledStorageProvider().exists("x"))


# --- Registry ---

class RegistryTests(TestCase):
    @override_settings(STORAGE_PROVIDER="local")
    def test_local_storage(self):
        provider = get_storage_provider()
        self.assertIsInstance(provider, LocalStorageProvider)

    @override_settings(STORAGE_PROVIDER="fake_object")
    def test_fake_storage(self):
        self.assertIsInstance(get_storage_provider(), FakeObjectStorageProvider)

    @override_settings(STORAGE_PROVIDER="disabled")
    def test_disabled_storage(self):
        self.assertIsInstance(get_storage_provider(), DisabledStorageProvider)

    @override_settings(STORAGE_PROVIDER="unknown_xyz")
    def test_unknown_storage_raises(self):
        with self.assertRaises(ValueError):
            get_storage_provider()

    @override_settings(VIRUS_SCAN_PROVIDER="disabled")
    def test_disabled_virus_scan(self):
        self.assertIsInstance(get_virus_scan_provider(), DisabledVirusScanProvider)

    @override_settings(VIRUS_SCAN_PROVIDER="fake")
    def test_fake_virus_scan(self):
        self.assertIsInstance(get_virus_scan_provider(), FakeVirusScanProvider)

    @override_settings(VIRUS_SCAN_PROVIDER="nope")
    def test_unknown_scan_raises(self):
        with self.assertRaises(ValueError):
            get_virus_scan_provider()


# --- Virus scan ---

class FakeVirusScanTests(TestCase):
    def test_default_clean(self):
        result = FakeVirusScanProvider().scan(io.BytesIO(b"data"), "file.txt")
        self.assertEqual(result.verdict, ScanVerdict.CLEAN)

    def test_set_next_verdict(self):
        provider = FakeVirusScanProvider()
        provider.set_next_verdict(ScanVerdict.INFECTED)
        result = provider.scan(io.BytesIO(b"bad"), "virus.exe")
        self.assertEqual(result.verdict, ScanVerdict.INFECTED)
        # next call reverts to default
        self.assertEqual(provider.scan(io.BytesIO(b"ok")).verdict, ScanVerdict.CLEAN)


class DisabledVirusScanTests(TestCase):
    def test_returns_skipped(self):
        result = DisabledVirusScanProvider().scan(io.BytesIO(b"x"))
        self.assertEqual(result.verdict, ScanVerdict.SKIPPED)
