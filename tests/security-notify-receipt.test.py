import importlib.util
import json
import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('security_notify_receipt', Path.home()/'.hermes/scripts/aaaa_security_notify.py')
assert spec is not None and spec.loader is not None
notifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notifier)

class ReceiptTests(unittest.TestCase):
    def test_skipped_cli_success_is_not_a_delivery_receipt(self):
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps({'success': True, 'skipped': True}))
        with patch.object(subprocess, 'run', return_value=result):
            with self.assertRaises(Exception):
                notifier.send_telegram('test')

    def test_actual_known_chat_and_receipt_are_required(self):
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps({'success': True, 'platform': 'telegram', 'chat_id': '7874523438', 'message_id': '123'}))
        with patch.dict(os.environ, {'HERMES_CRON_AUTO_DELIVER_PLATFORM': 'telegram', 'HERMES_CRON_AUTO_DELIVER_CHAT_ID': '7874523438'}):
            with patch.object(subprocess, 'run', return_value=result) as run:
                notifier.send_telegram('test')
                args, kwargs = run.call_args
                self.assertIn('telegram:7874523438', args[0])
                self.assertIn('--json', args[0])
                self.assertNotIn('HERMES_CRON_AUTO_DELIVER_PLATFORM', kwargs['env'])
                self.assertNotIn('HERMES_CRON_AUTO_DELIVER_CHAT_ID', kwargs['env'])

if __name__ == '__main__':
    unittest.main()
