import { runPublish } from './publish-common.mjs';

const dryRun = process.argv.includes('--dry-run');
runPublish('official', { dryRun }).catch((e) => {
  console.error('[publish-official] 失败：', e && e.message ? e.message : e);
  process.exit(1);
});
