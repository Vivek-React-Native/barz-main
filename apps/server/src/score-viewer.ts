import { spawn } from 'child_process';
import User from './lib/user.ts';

User.generateWebViewerLink(['cli3ishy300f6pk0q9fmbc2g8']).then((url) => {
  spawn('open', ['-a', 'Google Chrome', url]);
  process.exit(0);
});
