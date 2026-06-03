'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const { saveConfig, isInitialized, CONFIG_DIR } = require('./cloud-config');
const ui = require('./ui');

/**
 * Prompts user for input.
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Runs the cloud init wizard.
 * Sets up GitHub Actions workflow + Apple signing for iOS cloud builds.
 */
async function cloudInit() {
  ui.banner();
  console.log(`  ${ui.c.bold}Cloud Init — Setup iOS builds without a Mac${ui.c.reset}`);
  console.log(`  ${ui.c.dim}This will configure GitHub Actions to build your iOS app in the cloud.${ui.c.reset}`);
  console.log('');

  if (isInitialized()) {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  Cloud already initialized.`);
    const answer = await ask(`  ${ui.c.dim}Reconfigure? (y/N): ${ui.c.reset}`);
    if (answer.toLowerCase() !== 'y') {
      console.log(`  ${ui.c.dim}Cancelled.${ui.c.reset}`);
      return;
    }
  }

  // Step 1: Detect GitHub repo
  console.log(`  ${ui.c.bold}[1/5]${ui.c.reset} Detecting GitHub repository...`);
  let repoUrl = '';
  try {
    repoUrl = execSync('git remote get-url origin', { encoding: 'utf8', stdio: 'pipe' }).trim();
    ui.success(`Repo: ${repoUrl}`);
  } catch {
    repoUrl = await ask(`  ${ui.c.dim}GitHub repo URL: ${ui.c.reset}`);
  }

  // Extract owner/repo
  const repoMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!repoMatch) {
    ui.error('Invalid GitHub URL', 'Expected format: github.com/owner/repo');
    process.exit(1);
  }
  const repoOwner = repoMatch[1];
  const repoName = repoMatch[2];
  const repoFullName = `${repoOwner}/${repoName}`;

  // Step 2: Apple credentials
  console.log('');
  console.log(`  ${ui.c.bold}[2/5]${ui.c.reset} Apple Developer credentials`);
  console.log(`  ${ui.c.dim}Get these from https://developer.apple.com/account${ui.c.reset}`);
  console.log('');

  const appleTeamId = await ask(`  Apple Team ID (10 chars, e.g. ABC1234DEF): `);
  const bundleId = await ask(`  Bundle ID (e.g. com.yourapp): `);

  // Step 3: Signing files
  console.log('');
  console.log(`  ${ui.c.bold}[3/5]${ui.c.reset} Signing certificate & provisioning profile`);
  console.log(`  ${ui.c.dim}Export your distribution certificate as .p12 from Keychain Access${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Download provisioning profile from developer.apple.com${ui.c.reset}`);
  console.log('');

  const certPath = await ask(`  Certificate (.p12) path: `);
  const certPassword = await ask(`  Certificate password: `);
  const profilePath = await ask(`  Provisioning profile (.mobileprovision) path: `);

  // Validate files exist
  const resolvedCert = path.resolve(certPath);
  const resolvedProfile = path.resolve(profilePath);

  if (!fs.existsSync(resolvedCert)) {
    ui.error('Certificate not found', resolvedCert);
    process.exit(1);
  }
  if (!fs.existsSync(resolvedProfile)) {
    ui.error('Provisioning profile not found', resolvedProfile);
    process.exit(1);
  }

  // Step 4: Upload secrets to GitHub
  console.log('');
  console.log(`  ${ui.c.bold}[4/5]${ui.c.reset} Uploading secrets to GitHub...`);

  const certBase64 = fs.readFileSync(resolvedCert).toString('base64');
  const profileBase64 = fs.readFileSync(resolvedProfile).toString('base64');

  try {
    // Check if gh is available
    execSync('gh --version', { stdio: 'pipe' });
  } catch {
    ui.error('GitHub CLI (gh) not installed', 'Install with: brew install gh');
    console.log(`  ${ui.c.dim}Then run: gh auth login${ui.c.reset}`);
    process.exit(1);
  }

  // Set GitHub secrets
  const secrets = {
    IOS_CERTIFICATE_BASE64: certBase64,
    IOS_CERTIFICATE_PASSWORD: certPassword,
    IOS_PROVISION_PROFILE_BASE64: profileBase64,
    APPLE_TEAM_ID: appleTeamId,
  };

  for (const [name, value] of Object.entries(secrets)) {
    try {
      execSync(`echo "${value}" | gh secret set ${name} --repo ${repoFullName}`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      ui.success(`Secret set: ${name}`);
    } catch (err) {
      ui.error(`Failed to set secret: ${name}`, err.message);
      process.exit(1);
    }
  }

  // Step 5: Create GitHub Actions workflow
  console.log('');
  console.log(`  ${ui.c.bold}[5/5]${ui.c.reset} Creating GitHub Actions workflow...`);

  const workflowDir = path.resolve('.github', 'workflows');
  if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });

  const workflowPath = path.join(workflowDir, 'starship-ios-build.yml');
  const workflowContent = generateWorkflow({ bundleId, appleTeamId, repoFullName });
  fs.writeFileSync(workflowPath, workflowContent);
  ui.success(`Workflow created: .github/workflows/starship-ios-build.yml`);

  // Save config
  const config = {
    initialized: true,
    github: {
      repo: repoFullName,
      secretsConfigured: true,
    },
    apple: {
      teamId: appleTeamId,
      bundleId,
    },
    lastBuild: null,
    submitReady: false,
  };
  saveConfig(config);

  // Add .starship to .gitignore if not already
  const gitignorePath = path.resolve('.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.starship/')) {
      fs.appendFileSync(gitignorePath, '\n.starship/\n');
    }
  }

  console.log('');
  console.log(`  ${ui.c.green}${ui.c.bold}✔ Cloud init complete!${ui.c.reset}`);
  console.log('');
  console.log(`  ${ui.c.dim}Next steps:${ui.c.reset}`);
  console.log(`  ${ui.c.white}1.${ui.c.reset} Commit and push the workflow: ${ui.c.cyan}git add . && git push${ui.c.reset}`);
  console.log(`  ${ui.c.white}2.${ui.c.reset} Build: ${ui.c.cyan}starship build ios --cloud${ui.c.reset}`);
  console.log(`  ${ui.c.white}3.${ui.c.reset} Submit to App Store: ${ui.c.cyan}starship build ios --cloud --export app-store --submit${ui.c.reset}`);
  console.log('');
}

/**
 * Generates the GitHub Actions workflow YAML for iOS builds.
 */
function generateWorkflow({ bundleId, appleTeamId }) {
  return `name: Starship iOS Build

on:
  workflow_dispatch:
    inputs:
      export_method:
        description: 'Export method'
        required: true
        default: 'development'
        type: choice
        options:
          - development
          - ad-hoc
          - app-store
      submit:
        description: 'Submit to App Store'
        required: false
        default: false
        type: boolean

jobs:
  build:
    runs-on: macos-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Install CocoaPods
        run: |
          cd ios
          pod install

      - name: Install Apple certificate and provisioning profile
        env:
          IOS_CERTIFICATE_BASE64: \${{ secrets.IOS_CERTIFICATE_BASE64 }}
          IOS_CERTIFICATE_PASSWORD: \${{ secrets.IOS_CERTIFICATE_PASSWORD }}
          IOS_PROVISION_PROFILE_BASE64: \${{ secrets.IOS_PROVISION_PROFILE_BASE64 }}
        run: |
          # Create temp keychain
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

          # Import certificate
          CERT_PATH=$RUNNER_TEMP/certificate.p12
          echo -n "$IOS_CERTIFICATE_BASE64" | base64 --decode -o $CERT_PATH
          security import $CERT_PATH -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

          # Install provisioning profile
          PROFILE_PATH=$RUNNER_TEMP/profile.mobileprovision
          echo -n "$IOS_PROVISION_PROFILE_BASE64" | base64 --decode -o $PROFILE_PATH
          mkdir -p ~/Library/MobileDevice/Provisioning\\ Profiles
          cp $PROFILE_PATH ~/Library/MobileDevice/Provisioning\\ Profiles/

      - name: Build archive
        run: |
          cd ios
          xcodebuild archive \\
            -workspace *.xcworkspace \\
            -scheme $(ls -d *.xcworkspace | head -1 | sed 's/.xcworkspace//') \\
            -configuration Release \\
            -archivePath $RUNNER_TEMP/app.xcarchive \\
            DEVELOPMENT_TEAM=${appleTeamId} \\
            CODE_SIGN_IDENTITY="Apple Distribution" \\
            -allowProvisioningUpdates

      - name: Export IPA
        run: |
          cat > $RUNNER_TEMP/ExportOptions.plist << EOF
          <?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
          <plist version="1.0">
          <dict>
              <key>method</key>
              <string>\${{ inputs.export_method }}</string>
              <key>teamID</key>
              <string>${appleTeamId}</string>
              <key>stripSwiftSymbols</key>
              <true/>
              <key>compileBitcode</key>
              <false/>
          </dict>
          </plist>
          EOF

          xcodebuild -exportArchive \\
            -archivePath $RUNNER_TEMP/app.xcarchive \\
            -exportPath $RUNNER_TEMP/export \\
            -exportOptionsPlist $RUNNER_TEMP/ExportOptions.plist

      - name: Upload IPA artifact
        uses: actions/upload-artifact@v4
        with:
          name: ios-ipa
          path: \${{ runner.temp }}/export/*.ipa
          retention-days: 7

      - name: Submit to App Store
        if: \${{ inputs.submit == true && inputs.export_method == 'app-store' }}
        env:
          APPLE_ID: \${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: \${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
        run: |
          IPA_PATH=$(find $RUNNER_TEMP/export -name "*.ipa" | head -1)
          xcrun altool --upload-app \\
            --type ios \\
            --file "$IPA_PATH" \\
            --username "$APPLE_ID" \\
            --password "$APPLE_APP_SPECIFIC_PASSWORD" \\
            --team-id ${appleTeamId}

      - name: Clean up keychain
        if: always()
        run: |
          security delete-keychain $RUNNER_TEMP/app-signing.keychain-db || true
`;
}

module.exports = { cloudInit, generateWorkflow };
