"""Network-free cache regressions. Run: python hooks/sdd-cache-test.py"""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("sdd_cache", Path(__file__).parent / "lib/sdd_cache.py")
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sdd-cache-test-")
        self.addCleanup(self.temp.cleanup)
        # macOS /var commonly links to /private/var. Resolve this trusted
        # fixture root; deliberate symlink-path tests still use explicit links.
        self.root = Path(self.temp.name).resolve()
        self.project = self.root / "project"
        self.project.mkdir()
        self.directory = self.root / "private-cache"
        env = mock.patch.dict(os.environ, {"SDD_CACHE_DIR": str(self.directory), "CLAUDE_PROJECT_DIR": str(self.project), "SDD_CACHE_ALLOWED_HOSTS": "docs.example.com"})
        env.start()
        self.addCleanup(env.stop)
        network = mock.patch.object(cache.socket, "getaddrinfo", side_effect=AssertionError("unexpected live DNS"))
        network.start()
        self.addCleanup(network.stop)
        self.payload = {
            "tool_input": {"url": "https://docs.example.com/guide", "prompt": "extract the signature", "headers": dict(cache.REQUEST_HEADERS)},
            "tool_response": {"code": 200, "url": "https://docs.example.com/guide", "method": "GET", "headers": {"ETag": '"v1"'}, "request_headers": dict(cache.REQUEST_HEADERS), "result": "signature(a, b)"},
        }

    def target(self):
        return self.directory / cache.key(cache.request(self.payload))

    def seed(self):
        cache.post(self.payload)
        return json.loads(self.target().read_text(encoding="utf-8"))

    def alter(self, **fields):
        entry = self.seed()
        entry.update(fields)
        self.target().write_text(json.dumps(entry), encoding="utf-8")

    def main(self, value, mode="pre"):
        encoded = value if isinstance(value, bytes) else json.dumps(value).encode()
        stream = io.TextIOWrapper(io.BytesIO(encoded), encoding="utf-8")
        output = io.StringIO()
        with mock.patch.object(sys, "stdin", stream), mock.patch.object(sys, "stderr", output), mock.patch.object(sys, "argv", ["sdd_cache.py", mode]):
            return cache.main(), output.getvalue()

    def test_native_responses_neither_store_nor_consume_custom_cache(self):
        self.seed()
        self.payload["tool_input"].pop("headers")
        self.payload["tool_response"].pop("headers")
        self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("native request verified")))
        before = list(self.directory.iterdir())
        cache.post(self.payload)
        self.assertEqual(before, list(self.directory.iterdir()))

    def test_unknown_response_shapes_and_metadata_bypass(self):
        for value in (None, 42, "legacy body", [], {"result": "body"}):
            with self.subTest(value=value):
                self.payload["tool_response"] = value
                self.assertEqual(self.main(self.payload, "post")[0], 0)
                self.assertFalse(self.directory.exists())

    def test_post_requires_same_response_url_status_and_request_profile(self):
        original = copy.deepcopy(self.payload["tool_response"])
        for changed in ({"url": "https://docs.example.com/other"}, {"code": 500}, {"code": "200"}, {"method": "HEAD"}, {"request_headers": {}}, {"headers": {}}, {"result": ""}):
            with self.subTest(changed=changed):
                self.payload["tool_response"] = {**original, **changed}
                cache.post(self.payload)
                self.assertFalse(self.directory.exists())

    def test_missing_provenance_cannot_attach_later_validator(self):
        self.payload["tool_response"].pop("request_headers")
        with mock.patch.object(cache, "revalidate", side_effect=AssertionError("post must not fetch")):
            cache.post(self.payload)
        self.assertFalse(self.directory.exists())

    def test_roundtrip_preserves_hostile_text_and_unicode(self):
        text = 'Line `ticks` $HOME \\backslash *glob* [x] "quote"\n$(must not execute)\n雪\n'
        self.payload["tool_response"]["result"] = text
        self.seed()
        self.assertEqual(cache.pre(self.payload, verify=lambda _: True), text)
        with mock.patch.object(cache, "revalidate", return_value=True):
            code, stderr = self.main(self.payload)
        self.assertEqual(code, 2)
        self.assertIn(text, stderr)
        self.assertIn("untrusted evidence", stderr)

    def test_cache_miss_and_malformed_input_are_silent(self):
        for value in ({}, {"tool_input": None}, None, [], b"NOT_JSON{{{", b"\xff", b"[" * 2000 + b"0" + b"]" * 2000):
            with self.subTest(value=value):
                self.assertEqual(self.main(value), (0, ""))
        self.assertEqual(self.main(self.payload), (0, ""))

    def test_wrong_prompt_and_project_miss(self):
        self.seed()
        original = self.payload["tool_input"]["prompt"]
        self.payload["tool_input"]["prompt"] = "unrelated question"
        self.assertEqual(self.main(self.payload), (0, ""))
        self.payload["tool_input"]["prompt"] = original
        with mock.patch.dict(os.environ, {"CLAUDE_PROJECT_DIR": str(self.root / "other-project")}):
            self.assertEqual(self.main(self.payload), (0, ""))

    def test_entry_metadata_mismatch_never_verifies(self):
        for changed in ({"url": "https://docs.example.com/other"}, {"prompt": "different"}, {"project": "different"}, {"version": 2}, {"request_headers": {}}):
            with self.subTest(changed=changed):
                self.alter(**changed)
                self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("mismatched metadata verified")))

    def test_invalid_age_and_content_never_verifies(self):
        for changed in ({"fetched_at": time.time() - cache.MAX_AGE - 2}, {"fetched_at": time.time() + 60}, {"fetched_at": "now"}, {"fetched_at": True}, {"fetched_at": float("nan")}, {"content": ""}, {"content": 42}, {"content": "x" * (cache.MAX_CONTENT + 1)}):
            with self.subTest(changed=list(changed)):
                self.alter(**changed)
                self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("invalid entry verified")))

    def test_missing_or_injected_validators_never_verify(self):
        for changed in ({"etag": "", "last_modified": ""}, {"etag": '"v1"\r\nCookie: secret'}, {"etag": [], "last_modified": ""}, {"last_modified": "bad\nheader"}):
            with self.subTest(changed=changed):
                self.alter(**changed)
                self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("invalid validator verified")))

    def test_header_case_duplicates_and_controls_rejected(self):
        for headers in ({"ETag": '"v1"', "etag": '"v2"'}, {"ETag": "bad\r\nheader"}, {"ETag": []}, {"ETag": "雪"}, {"bad name": "x"}):
            with self.subTest(headers=headers):
                self.payload["tool_response"]["headers"] = headers
                cache.post(self.payload)
                self.assertFalse(self.directory.exists())

    def test_private_negotiated_or_cookie_response_rejected(self):
        for extra in ({"Cache-Control": "private"}, {"Cache-Control": 'private="X-User"'}, {"Cache-Control": 'private = "X-User"'}, {"Cache-Control": "public, no-store"}, {"Cache-Control": "no-cache"}, {"Vary": "Accept-Language"}, {"Vary": "*"}, {"Set-Cookie": "id=secret"}):
            with self.subTest(extra=extra):
                self.payload["tool_response"]["headers"] = {"ETag": '"v1"', **extra}
                cache.post(self.payload)
                self.assertFalse(self.directory.exists())

    def test_caller_credentials_headers_and_extra_fields_rejected(self):
        original = copy.deepcopy(self.payload["tool_input"])
        for changed in ({"headers": {"Authorization": "secret"}}, {"headers": {"Cookie": "id=secret"}}, {"headers": {"Accept-Language": "en"}}, {"headers": {}}, {"prompt": None}, {"method": "POST"}):
            with self.subTest(changed=changed):
                self.payload["tool_input"] = {**original, **changed}
                self.assertIsNone(cache.request(self.payload))

    def test_url_allowlist_https_and_public_hostname_requirements(self):
        urls = ("http://docs.example.com/a", "https://elsewhere.example/a", "https://docs.example.com:444/a", "https://user:pass@docs.example.com/a", "https://@docs.example.com/a", "https://docs.example.com/a?secret=1", "https://docs.example.com/a?", "https://docs.example.com/a#fragment", "https://docs.example.com/a\\b", "https://docs.example.com/雪", "https://docs.example.com/a\n", "file:///etc/passwd", "--output=target", "https://docs.example.com./a")
        for url in urls:
            with self.subTest(url=url):
                self.assertIsNone(cache.origin(url))
        with mock.patch.dict(os.environ, {"SDD_CACHE_ALLOWED_HOSTS": "127.0.0.1,8.8.8.8"}):
            self.assertIsNone(cache.origin("https://127.0.0.1/a"))
            self.assertIsNone(cache.origin("https://8.8.8.8/a"))
        with mock.patch.dict(os.environ, {"SDD_CACHE_ALLOWED_HOSTS": ""}):
            self.assertIsNone(cache.origin("https://docs.example.com/a"))
        self.assertIsNone(cache.origin("https://docs.example.com/" + "a" * cache.MAX_URL))

    def test_dns_vets_every_result_not_only_selected_address(self):
        for address in ("127.0.0.1", "10.0.0.1", "169.254.169.254", "192.0.2.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"):
            with self.subTest(address=address), mock.patch.object(cache.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443)), (2, 1, 6, "", (address, 443))]):
                with self.assertRaises(ValueError):
                    cache.public_address("docs.example.com")
        with mock.patch.object(cache.socket, "getaddrinfo", return_value=[]):
            with self.assertRaises(ValueError):
                cache.public_address("docs.example.com")
        with mock.patch.object(cache.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443))]):
            self.assertEqual(cache.public_address("docs.example.com"), "8.8.8.8")

    def test_version_sensitive_special_use_ranges_are_conservatively_denied(self):
        for address in ("192.0.0.8", "192.0.0.9", "192.0.0.10", "2002:a9fe:a9fe::1", "2002:c0a8:1::1", "2002:808:808::1", "::ffff:192.0.0.8", "::ffff:169.254.169.254"):
            with self.subTest(address=address), mock.patch.object(cache.socket, "getaddrinfo", return_value=[(2, 1, 6, "", (address, 443))]):
                with self.assertRaises(ValueError):
                    cache.public_address("docs.example.com")

    def test_deprecated_site_local_ipv6_is_denied_alone_and_in_mixed_dns(self):
        # Supported Python releases can label these internal addresses global
        # and non-reserved. Every answer must be rejected, not only the selected
        # connection address, even when a public answer appears first.
        for address in ("fec0::1", "fedc:ba98::1", "feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"):
            local = (socket.AF_INET6, socket.SOCK_STREAM, 6, "", (address, 443, 0, 0))
            public = (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:4860:4860::8888", 443, 0, 0))
            for answers in ([local], [public, local], [local, public]):
                with self.subTest(address=address, mixed=len(answers) > 1), mock.patch.object(cache.socket, "getaddrinfo", return_value=answers):
                    with self.assertRaises(ValueError):
                        cache.public_address("docs.example.com")

    def test_deprecated_ipv4_compatible_and_other_internal_ipv6_answers_are_denied(self):
        for address in ("::10.0.0.1", "::127.0.0.1", "::169.254.169.254", "fe80::1", "fc00::1", "2001::a9fe:a9fe"):
            with self.subTest(address=address), mock.patch.object(cache.socket, "getaddrinfo", return_value=[(socket.AF_INET6, socket.SOCK_STREAM, 6, "", (address, 443, 0, 0))]):
                with self.assertRaises(ValueError):
                    cache.public_address("docs.example.com")

    def test_ordinary_public_ipv4_and_ipv6_remain_usable(self):
        for address in ("8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "2606:4700:4700::1111"):
            with self.subTest(address=address), mock.patch.object(cache.socket, "getaddrinfo", return_value=[(2, 1, 6, "", (address, 443))]):
                self.assertEqual(cache.public_address("docs.example.com"), address)

    def test_socket_pins_address_and_tls_verifies_original_hostname(self):
        raw = mock.Mock()
        context = mock.Mock()
        with mock.patch.object(cache.socket, "socket", return_value=raw), mock.patch.object(cache.ssl, "create_default_context", return_value=context):
            connection = cache.PinnedHTTPSConnection("docs.example.com", "8.8.8.8")
            connection.connect()
        raw.connect.assert_called_once_with(("8.8.8.8", 443))
        context.wrap_socket.assert_called_once_with(raw, server_hostname="docs.example.com")

    def test_tls_failure_closes_socket(self):
        raw = mock.Mock()
        context = mock.Mock()
        context.wrap_socket.side_effect = OSError("certificate failed")
        with mock.patch.object(cache.socket, "socket", return_value=raw), mock.patch.object(cache.ssl, "create_default_context", return_value=context):
            with self.assertRaises(OSError):
                cache.PinnedHTTPSConnection("docs.example.com", "8.8.8.8").connect()
        raw.close.assert_called_once()

    def direct(self, status=304, headers=()):
        entry = self.seed()
        connection = mock.Mock()
        connection.getresponse.return_value.status = status
        connection.getresponse.return_value.getheaders.return_value = headers
        with mock.patch.object(cache, "public_address", return_value="8.8.8.8"), mock.patch.object(cache, "PinnedHTTPSConnection", return_value=connection):
            result = cache.revalidate_direct(entry)
        connection.close.assert_called_once()
        return result, connection

    def test_revalidation_uses_identical_profile_and_conditional_validator(self):
        result, connection = self.direct(headers=(("ETag", '"v1"'),))
        self.assertTrue(result)
        connection.request.assert_called_once_with("HEAD", "/guide", headers={**cache.REQUEST_HEADERS, "If-None-Match": '"v1"'})

    def test_last_modified_only_revalidation(self):
        self.payload["tool_response"]["headers"] = {"Last-Modified": "Wed, 01 Jan 2026 00:00:00 GMT"}
        result, connection = self.direct()
        self.assertTrue(result)
        self.assertIn("If-Modified-Since", connection.request.call_args.kwargs["headers"])

    def test_changed_redirect_error_and_policy_responses_miss(self):
        for status, headers in ((200, ()), (301, (("Location", "https://127.0.0.1/"),)), (500, ()), (304, (("ETag", '"v2"'),)), (304, (("Vary", "Accept-Encoding"),)), (304, (("Cache-Control", "no-store"),)), (304, (("Bad Name", "unsafe"),)), (304, (("ETag", '"v1"'), ("ETag", '"v2"')))):
            with self.subTest(status=status, headers=headers):
                result, connection = self.direct(status, headers)
                self.assertFalse(result)
                self.assertEqual(connection.request.call_count, 1, "redirect must not be followed")

    def test_network_child_timeout_and_failure_bypass(self):
        for failure in (subprocess.TimeoutExpired("python", 5), OSError("unavailable")):
            with self.subTest(failure=failure), mock.patch.object(cache.subprocess, "run", side_effect=failure):
                self.assertFalse(cache.revalidate({}))
        with mock.patch.object(cache.subprocess, "run", return_value=mock.Mock(returncode=1)) as child:
            self.assertFalse(cache.revalidate({}))
            self.assertEqual(child.call_args.kwargs["timeout"], 5)

    def test_false_verification_leaves_tool_unblocked(self):
        self.seed()
        with mock.patch.object(cache, "revalidate", return_value=False):
            self.assertEqual(self.main(self.payload), (0, ""))

    def test_cache_path_must_be_external_absolute(self):
        for directory in ("relative-cache", str(self.project), str(self.project / "cache"), str(self.root / "nonexistent" / ".." / "project" / "cache")):
            with self.subTest(directory=directory), mock.patch.dict(os.environ, {"SDD_CACHE_DIR": directory}):
                self.assertEqual(self.main(self.payload, "post"), (0, ""))
        self.assertFalse((self.project / "cache").exists())

    def test_nonregular_cache_target_rejected(self):
        cache.cache_directory(create=True)
        self.target().mkdir()
        cache.post(self.payload)
        self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("directory read")))

    def test_symlink_cache_target_neither_read_nor_written(self):
        cache.cache_directory(create=True)
        user = self.root / "user-file"
        user.write_text("USER WORK", encoding="utf-8")
        try:
            self.target().symlink_to(user)
        except OSError:
            self.skipTest("file symlink creation unavailable")
        cache.post(self.payload)
        self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("symlink read")))
        self.assertEqual(user.read_text(encoding="utf-8"), "USER WORK")

    def test_symlink_cache_parent_rejected(self):
        actual = self.root / "actual"
        actual.mkdir()
        link = self.root / "linked"
        try:
            link.symlink_to(actual, target_is_directory=True)
        except OSError:
            self.skipTest("directory symlink creation unavailable")
        with mock.patch.dict(os.environ, {"SDD_CACHE_DIR": str(link / "cache")}):
            self.assertEqual(self.main(self.payload, "post"), (0, ""))
        self.assertFalse((actual / "cache").exists())

    def test_windows_reparse_metadata_rejected(self):
        self.assertTrue(cache.reparse(mock.Mock(st_mode=stat.S_IFDIR, st_file_attributes=0x400)))

    def test_reparse_target_is_rejected_without_symlink_privilege(self):
        self.seed()
        target = self.target()
        original_lstat = Path.lstat
        def lstat(value):
            if value == target:
                return mock.Mock(st_mode=stat.S_IFREG, st_file_attributes=0x400)
            return original_lstat(value)
        before = target.read_bytes()
        with mock.patch.object(Path, "lstat", lstat):
            cache.post(self.payload)
            self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("reparse entry read")))
        self.assertEqual(target.read_bytes(), before)

    def test_reparse_parent_is_rejected_without_symlink_privilege(self):
        original_lstat = Path.lstat
        def lstat(value):
            if value == self.root:
                return mock.Mock(st_mode=stat.S_IFDIR, st_file_attributes=0x400)
            return original_lstat(value)
        with mock.patch.object(Path, "lstat", lstat):
            self.assertEqual(self.main(self.payload, "post"), (0, ""))
        self.assertFalse(self.directory.exists())

    def test_malformed_entry_is_silent(self):
        self.seed()
        for value in (b"NOT JSON", b"[]", b"null", b"\xff"):
            self.target().write_bytes(value)
            self.assertEqual(self.main(self.payload), (0, ""))

    @unittest.skipUnless(hasattr(os, "getuid"), "POSIX permissions")
    def test_public_directory_or_entry_rejected(self):
        self.seed()
        self.directory.chmod(0o755)
        self.assertEqual(self.main(self.payload), (0, ""))
        self.directory.chmod(0o700)
        self.target().chmod(0o644)
        self.assertEqual(self.main(self.payload), (0, ""))

    def test_atomic_write_failure_preserves_prior_entry(self):
        self.seed()
        original = self.target().read_bytes()
        self.payload["tool_response"]["result"] = "new reading"
        with mock.patch.object(cache.os, "replace", side_effect=OSError("disk failure")):
            self.assertEqual(self.main(self.payload, "post"), (0, ""))
        self.assertEqual(self.target().read_bytes(), original)
        self.assertFalse(list(self.directory.glob(".entry-*")))

    def test_content_and_input_bounds(self):
        self.payload["tool_response"]["result"] = "x" * (cache.MAX_CONTENT + 1)
        cache.post(self.payload)
        self.assertFalse(self.directory.exists())
        self.assertEqual(self.main(b" " * (cache.MAX_INPUT + 1)), (0, ""))
        cache.cache_directory(create=True)
        self.target().write_bytes(b" " * (cache.MAX_INPUT + 1))
        self.assertIsNone(cache.pre(self.payload, verify=lambda _: self.fail("oversize entry verified")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
