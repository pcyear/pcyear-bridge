import { runPublish } from './publish-common.mjs';

const dryRun = process.argv.includes('--dry-run');
runPublish('beta', { dryRun }).catch((e) => {
  console.error('[publish-beta] 失败：', e && e.message ? e.message : e);
  process.exit(1);
});
