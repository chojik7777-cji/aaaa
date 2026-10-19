"""Hermetic notifier tests: never invoke the real Hermes CLI or real outbox."""
import importlib.util
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path('/Users/chojiks/.hermes/scripts/aaaa_security_notify.py')


def load():
    spec = importlib.util.spec_from_file_location('security_notify', SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Outbox:
    def __init__(self, events):
        self.events = list(events)
        self.acked = []

    def pending(self, limit):
        return self.events[:limit]

    def ack(self, event_id):
        self.acked.append(event_id)
        self.events = [e for e in self.events if e['id'] != event_id]


def event(index=1, **extra):
    return dict(id=f'alert-{index}', time='2026-10-19T00:00:00Z',
                ip='192.0.2.1', page='note.html', room='test-room',
                count=5, ipSource='socket', **extra)


class NotifierTests(unittest.TestCase):
    def test_math_auth_pages_are_named_in_alerts(self):
        m = load()
        for page in ['math-control.html', 'math-level.html']:
            e = event()
            e['page'] = page
            self.assertIn('페이지: ' + page, m.format_alert(e))

    def test_state_symlinks_fail_closed_without_send_or_target_chmod(self):
        m = load()
        with tempfile.TemporaryDirectory() as d, contextlib.redirect_stderr(io.StringIO()):
            root = Path(d)
            target = root / 'target'
            target.mkdir(mode=0o755)
            state = root / 'state'
            state.symlink_to(target, target_is_directory=True)
            messages = []
            self.assertEqual(m.run(Outbox([event()]), state, messages.append), 1)
            self.assertEqual(target.stat().st_mode & 0o777, 0o755)
            state.unlink()
            state.mkdir(mode=0o700)
            victim = root / 'victim'
            victim.write_text('untouched')
            (state / 'delivered.sqlite3').symlink_to(victim)
            self.assertEqual(m.run(Outbox([event()]), state, messages.append), 1)
            self.assertEqual(victim.read_text(), 'untouched')
            self.assertEqual(messages, [])

    def test_node_snapshot_real_backend_lock_filter_and_readonly(self):
        import subprocess
        m = load()
        with tempfile.TemporaryDirectory() as d:
            root = Path(d).resolve()
            audit_dir = root / 'audit'
            subprocess.run(['/Users/chojiks/.hermes/node/bin/node', '-e',
                "const a=require('/Users/chojiks/github-aaaa/server/security-audit').createSecurityAudit({dir:process.argv[1]});"
                "for(let i=0;i<7;i++)a.record({socket:{remoteAddress:'192.0.2.1'},url:'/api/auth',headers:{}},{page:'note.html',outcome:'failure'});",
                str(audit_dir)], check=True, capture_output=True)
            before = (audit_dir / 'audit.json').read_bytes()
            box = m.NodeOutbox(audit_dir)
            pending = box.pending(2000)
            self.assertEqual(len(pending), 1)
            self.assertEqual(pending[0]['count'], 5)
            self.assertNotIn('userAgent', pending[0])
            self.assertEqual((audit_dir / 'audit.json').read_bytes(), before)
            lock = audit_dir / 'audit.lock'
            lock.touch(mode=0o600)
            self.assertEqual(len(box.pending(2000)), 1)
            self.assertTrue(lock.exists())
            lock.unlink()
            messages = []
            self.assertEqual(m.run(box, root / 'state', messages.append), 0)
            self.assertEqual(m.run(box, root / 'state', messages.append), 0)
            self.assertEqual(len(messages), 1)

    def test_main_empty_outbox_no_stdout_no_transport(self):
        import subprocess
        with tempfile.TemporaryDirectory() as d:
            root = Path(d).resolve()
            (root / 'audit').mkdir(mode=0o700)
            result = subprocess.run(['python3', str(SCRIPT), '--audit-dir', str(root / 'audit'),
                                     '--state-dir', str(root / 'state')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, '')
            self.assertEqual(result.stderr, '')
            self.assertTrue((root / 'state' / 'delivered.sqlite3').exists())

    def test_hermes_cli_uses_stdin_fixed_target_timeout_and_checks_exit(self):
        import subprocess
        from unittest.mock import patch
        m = load()
        with patch('subprocess.run') as execute:
            execute.return_value = subprocess.CompletedProcess([], 0, stdout='{"success":true,"chat_id":"7874523438","message_id":"fixture-123"}')
            m.send_telegram('테스트')
            args, kwargs = execute.call_args
            self.assertEqual(args[0], ['/Users/chojiks/.hermes/hermes-agent/venv/bin/hermes',
                                     'send', '--to', 'telegram:7874523438', '--file', '-', '--json'])
            self.assertEqual(kwargs['input'], '테스트')
            self.assertLessEqual(kwargs['timeout'], 12)
            self.assertTrue(kwargs['check'])
            execute.side_effect = subprocess.CalledProcessError(1, [], stderr='SECRET')
            with self.assertRaises(subprocess.CalledProcessError):
                m.send_telegram('retry')
            execute.side_effect = subprocess.TimeoutExpired([], 12)
            with self.assertRaises(subprocess.TimeoutExpired):
                m.send_telegram('retry')

    def test_durable_ledger_does_not_starve_later_pending_alerts(self):
        m = load()
        class Persistent(Outbox):
            def ack(self, event_id):
                pass
        box = Persistent([event(i) for i in range(25)])
        messages = []
        with tempfile.TemporaryDirectory() as d:
            for _ in range(4):
                self.assertEqual(m.run(box, Path(d), messages.append), 0)
        self.assertEqual(len(messages), 25)

    def test_format_whitelists_fields_and_removes_unsafe_text(self):
        m = load()
        e = event(userAgent='password=SECRET' * 100, password='SECRET',
                  message='SECRET', endpoint='/?token=SECRET')
        e.update(page='note.html?password=SECRET', room='room\n\\x00<b>evil</b>\u202e' + 'x' * 500,
                 ipSource='socket\nforged', ip='192.0.2.1\nFAKE')
        text = m.format_alert(e)
        self.assertNotIn('SECRET', text)
        self.assertNotIn('FAKE', text)
        self.assertNotIn('<', text)
        self.assertNotIn('\u202e', text)
        self.assertNotIn('forged', text)
        self.assertLess(len(text), 700)
        for label in ['시간:', 'IP:', '페이지:', '방:', '실패 횟수:', '출처:']:
            self.assertIn(label, text)

    def test_lock_overlap_is_silent_and_hard_cap_is_ten(self):
        import fcntl
        m = load()
        class Greedy(Outbox):
            def pending(self, limit):
                return self.events[:]
        box = Greedy([event(i) for i in range(15)])
        messages = []
        with tempfile.TemporaryDirectory() as d:
            lock = open(Path(d) / 'notify.lock', 'a')
            with lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.assertEqual(m.run(box, Path(d), messages.append), 0)
                self.assertEqual(messages, [])
            self.assertEqual(m.run(box, Path(d), messages.append), 0)
            self.assertEqual(len(messages), 10)
            self.assertEqual(len(box.acked), 10)

    def test_ack_failure_does_not_resend_after_restart(self):
        m = load()
        box = Outbox([event()])
        ack = box.ack
        box.ack = lambda _: (_ for _ in ()).throw(OSError('secret'))
        messages = []
        with tempfile.TemporaryDirectory() as d, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(m.run(box, Path(d), messages.append), 1)
            box.ack = ack
            self.assertEqual(load().run(box, Path(d), messages.append), 0)
            self.assertEqual(len(messages), 1)
            self.assertEqual(box.acked, ['alert-1'])
            self.assertEqual((Path(d) / 'delivered.sqlite3').stat().st_mode & 0o777, 0o600)

    def test_send_failure_retains_pending_and_redacts_error(self):
        m = load()
        box = Outbox([event()])
        def failed_sender(text):
            raise RuntimeError('SECRET_FROM_TRANSPORT')
        with tempfile.TemporaryDirectory() as d, contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(m.run(box, Path(d), failed_sender), 1)
            self.assertEqual(box.acked, [])
            self.assertEqual(len(box.events), 1)
            self.assertNotIn('SECRET', err.getvalue())
            self.assertIn('failed', err.getvalue())
            messages = []
            self.assertEqual(m.run(box, Path(d), messages.append), 0)
            self.assertEqual(len(messages), 1)

    def test_success_sends_then_ack_and_second_run_is_silent(self):
        m = load()
        box = Outbox([event()])
        calls = []
        def sender(text):
            self.assertEqual(box.acked, [])
            calls.append(text)
        with tempfile.TemporaryDirectory() as d, contextlib.redirect_stdout(io.StringIO()) as stdout:
            self.assertEqual(m.run(box, Path(d), sender), 0)
            self.assertEqual(box.acked, ['alert-1'])
            self.assertEqual(m.run(box, Path(d), sender), 0)
            self.assertEqual(stdout.getvalue(), '')
        self.assertEqual(len(calls), 1)
        self.assertIn('보안', calls[0])


if __name__ == '__main__':
    unittest.main(verbosity=2)
