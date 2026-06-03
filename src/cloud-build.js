'use strict';

const { execSync } = require('child_process');
const { isInitialized, loadConfig, updateLastBuild, hasSuccessfulBuild } = require('./cloud-config');
const ui = require('./ui');

/**
 * Triggers a cloud iOS build via GitHub Actions.
 * @param {Object} options
 * @param {string} options.export - Export method (development, ad-hoc, app-store)
 * @param {boolean} options.submit - Submit to App Store
 */
async function cloudBuild(options = {}) {
  const exportMethod = options.export || 'development';
  const submit = options.submit || false;

  ui.banner();

  // Gate 1: Check cloud init
  if (!isInitialized()) {
    ui.error(
      'Cloud not initialized',
      'Run "starship cloud init" first to set up GitHub Actions + Apple signing.'
    );
    process.exit(1);
  }

  // Gate 2: Check submit prerequisites
  if (submit) {
    if (exportMethod !== 'app-store') {
      ui.error(
        'Submit requires app-store export',
        'Use: starship build ios --cloud --export app-store --submit'
      );
      process.exit(1);
    }
    if (!hasSuccessfulBuild()) {
      ui.error(
        'No previous successful build',
        'Run "starship build ios --cloud" first to verify your setup works.'
      );
      process.exit(1);
    }
  }

  const config = loadConfig();
  const repo = config.github.repo;

  console.log(`  ${ui.c.bold}Cloud iOS Build${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Repo: ${repo}${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Export: ${exportMethod}${ui.c.reset}`);
  if (submit) console.log(`  ${ui.c.dim}Submit: App Store Connect${ui.c.reset}`);
  console.log('');

  // Check gh CLI
  try {
    execSync('gh --version', { stdio: 'pipe' });
  } catch {
    ui.error('GitHub CLI (gh) not installed', 'Install: brew install gh');
    process.exit(1);
  }

  // Check auth
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch {
    ui.error('Not logged in to GitHub', 'Run: gh auth login');
    process.exit(1);
  }

  // Step 1: Commit and push current changes
  console.log(`  ${ui.c.bold}[1/4]${ui.c.reset} Pushing latest code...`);
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (status) {
      execSync('git add -A', { stdio: 'pipe' });
      execSync('git commit -m "chore: starship cloud build" --allow-empty', { stdio: 'pipe' });
    }
    execSync('git push', { stdio: 'pipe', timeout: 30000 });
    ui.success('Code pushed');
  } catch (err) {
    ui.warn('Push failed — continuing with remote code');
  }

  // Step 2: Trigger workflow
  console.log(`  ${ui.c.bold}[2/4]${ui.c.reset} Triggering GitHub Actions build...`);
  try {
    const triggerCmd = `gh workflow run starship-ios-build.yml --repo ${repo} -f export_method=${exportMethod} -f submit=${submit}`;
    execSync(triggerCmd, { stdio: 'pipe', encoding: 'utf8', timeout: 15000 });
    ui.success('Build triggered');
  } catch (err) {
    ui.error('Failed to trigger workflow', err.message);
    console.log(`  ${ui.c.dim}Make sure the workflow file is committed and pushed.${ui.c.reset}`);
    console.log(`  ${ui.c.dim}Run: git add .github/ && git commit -m "add workflow" && git push${ui.c.reset}`);
    process.exit(1);
  }

  // Step 3: Wait for build
  console.log(`  ${ui.c.bold}[3/4]${ui.c.reset} Waiting for build to complete...`);
  console.log(`  ${ui.c.dim}This usually takes 10-20 minutes.${ui.c.reset}`);
  console.log('');

  const runId = await waitForRun(repo);

  if (!runId) {
    ui.error('Build failed or timed out');
    updateLastBuild({ success: false });
    process.exit(1);
  }

  // Step 4: Download artifact
  console.log(`  ${ui.c.bold}[4/4]${ui.c.reset} Downloading IPA...`);
  const ipaPath = downloadArtifact(repo, runId);

  if (ipaPath) {
    updateLastBuild({ success: true, ipaPath, exportMethod });
    console.log('');
    ui.success('iOS build complete!');
    console.log(`  ${ui.c.dim}IPA: ${ipaPath}${ui.c.reset}`);

    if (submit) {
      console.log(`  ${ui.c.green}✔${ui.c.reset}  Submitted to App Store Connect`);
      console.log(`  ${ui.c.dim}Check status at: https://appstoreconnect.apple.com${ui.c.reset}`);
    }

    console.log('');
  } else {
    updateLastBuild({ success: false });
    ui.error('Failed to download IPA');
    process.exit(1);
  }
}

/**
 * Waits for the GitHub Actions run to complete.
 * @param {string} repo - owner/name
 * @returns {Promise<string|null>} Run ID or null
 */
async function waitForRun(repo) {
  const maxWait = 30 * 60 * 1000; // 30 minutes
  const pollInterval = 15000; // 15 seconds
  const startTime = Date.now();

  // Wait a few seconds for the run to appear
  await sleep(5000);

  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIdx = 0;

  while (Date.now() - startTime < maxWait) {
    try {
      const output = execSync(
        `gh run list --repo ${repo} --workflow starship-ios-build.yml --limit 1 --json databaseId,status,conclusion`,
        { encoding: 'utf8', stdio: 'pipe', timeout: 10000 }
      );

      const runs = JSON.parse(output);
      if (runs.length === 0) {
        await sleep(pollInterval);
        continue;
      }

      const run = runs[0];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (run.status === 'completed') {
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        if (run.conclusion === 'success') {
          ui.success(`Build completed in ${elapsed}s`);
          return String(run.databaseId);
        } else {
          ui.error(`Build failed (${run.conclusion})`, `Check: gh run view ${run.databaseId} --repo ${repo}`);
          return null;
        }
      }

      spinnerIdx = (spinnerIdx + 1) % spinner.length;
      process.stdout.write(`\r  ${spinner[spinnerIdx]}  Building... ${elapsed}s elapsed`);

    } catch {
      // Network error, retry
    }

    await sleep(pollInterval);
  }

  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  ui.error('Build timed out (30 min)', 'Check GitHub Actions manually');
  return null;
}

/**
 * Downloads the IPA artifact from a completed run.
 * @param {string} repo
 * @param {string} runId
 * @returns {string|null} Path to downloaded IPA
 */
function downloadArtifact(repo, runId) {
  try {
    const outputDir = './starship-builds';
    execSync(`gh run download ${runId} --repo ${repo} --name ios-ipa --dir ${outputDir}`, {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 120000,
    });

    // Find the IPA file
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(outputDir);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const ipa = files.find(f => f.endsWith('.ipa'));
      if (ipa) return path.join(dir, ipa);
    }
  } catch (err) {
    console.log(`  ${ui.c.dim}Download error: ${err.message}${ui.c.reset}`);
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { cloudBuild };
