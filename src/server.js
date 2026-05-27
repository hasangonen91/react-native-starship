'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const HOST = '0.0.0.0';

/**
 * Finds the app icon from the Android project.
 * Looks for ic_launcher in mipmap directories (highest res first).
 * @returns {string|null} Absolute path to icon file, or null if not found
 */
function findAppIcon() {
  const resDir = path.resolve('android', 'app', 'src', 'main', 'res');
  const densities = ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi'];
  const names = ['ic_launcher_round.png', 'ic_launcher.png', 'ic_launcher.webp'];

  for (const density of densities) {
    for (const name of names) {
      const iconPath = path.join(resDir, density, name);
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }
  }
  return null;
}

/**
 * Generates HTML for the download page.
 * @param {string} appName - Application name to display
 * @param {string} apkFilename - APK filename for the download link
 * @param {string} metroHost - The Metro bundler host:port
 * @param {boolean} hasIcon - Whether app icon is available at /icon
 * @returns {string} HTML string
 */
function generateDownloadPage(appName, apkFilename, metroHost, hasIcon) {
  const escapedAppName = escapeHtml(appName);
  const escapedFilename = escapeHtml(apkFilename);
  const escapedMetroHost = escapeHtml(metroHost || '');

  const iconHtml = hasIcon
    ? `<img class="app-icon" src="/icon" alt="${escapedAppName}" />`
    : `<div class="app-icon-fallback">${escapedAppName.charAt(0).toUpperCase()}</div>`;

  return `<!DOCTYPE html>
<!-- 🌹 küçükçekmece kanaryaya selam olsun -->
<!-- 🍓 çilekli sütlaç sevenlere selamlar -->
<!-- 🌷 -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${escapedAppName} — Dev Build</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --card: #16162a;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.15);
      --text: #f1f1f4;
      --text-dim: #71717a;
      --success: #34d399;
      --warning: #fbbf24;
      --border: #27273a;
      --code-bg: #1e1e32;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 44px 32px 36px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .app-icon {
      width: 88px;
      height: 88px;
      border-radius: 22px;
      margin: 0 auto 24px;
      display: block;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .app-icon-fallback {
      width: 88px;
      height: 88px;
      border-radius: 22px;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
    }
    .app-name {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(52, 211, 153, 0.08);
      color: var(--success);
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 32px;
      border: 1px solid rgba(52, 211, 153, 0.15);
    }
    .badge::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: blink 1.5s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .download-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      padding: 18px 28px;
      border-radius: 14px;
      font-size: 17px;
      font-weight: 600;
      transition: all 0.15s ease;
      box-shadow: 0 4px 20px var(--accent-glow);
    }
    .download-btn:active {
      transform: scale(0.96);
      box-shadow: 0 2px 10px var(--accent-glow);
    }
    .section {
      text-align: left;
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
    }
    .step-num {
      width: 26px;
      height: 26px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      flex-shrink: 0;
    }
    .step-text {
      font-size: 14px;
      color: var(--text-dim);
      line-height: 26px;
    }
    .host-value {
      display: inline-block;
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 6px;
      font-family: 'SF Mono', 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--success);
      margin-top: 4px;
      user-select: all;
      cursor: pointer;
    }
    .note {
      margin-top: 20px;
      padding: 14px 16px;
      background: rgba(251, 191, 36, 0.05);
      border: 1px solid rgba(251, 191, 36, 0.15);
      border-radius: 10px;
      font-size: 13px;
      color: var(--warning);
      text-align: left;
      line-height: 1.5;
    }
    .footer {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-dim);
    }
    .footer code {
      background: var(--code-bg);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', monospace;
      font-size: 11px;
      color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="card">
    ${iconHtml}
    <div class="app-name">${escapedAppName}</div>
    <div class="badge">Development Build</div>

    <a class="download-btn" href="/${escapedFilename}" id="downloadBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download APK
    </a>

    <div class="section">
      <div class="section-title">Setup (one time only)</div>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Install the APK and open the app</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Shake your phone → tap "Settings"</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">
          Set "Debug server host & port" to:
          <br><span class="host-value" onclick="copyHost()">${escapedMetroHost}</span>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Go back → Shake → "Reload" — done! 🎉</div>
      </div>
    </div>

    <div class="note">
      💡 You only need to do this once. After setup, code changes appear instantly via Fast Refresh.
    </div>

    <div class="footer">
      Powered by <code>starship</code>
    </div>
  </div>

  <script>
    function copyHost() {
      navigator.clipboard.writeText('${escapedMetroHost}').then(function() {
        var el = document.querySelector('.host-value');
        var original = el.textContent;
        el.textContent = 'Copied!';
        el.style.color = '#6366f1';
        setTimeout(function() { el.textContent = original; el.style.color = ''; }, 1500);
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Constructs a URL string from host and port.
 */
function buildUrl(host, port) {
  return `http://${host}:${port}`;
}

/**
 * Starts an HTTP server serving the APK download page and file.
 */
function startServer(options) {
  const { apkPath, host, appName } = options;
  const apkFilename = path.basename(apkPath);
  const metroHost = `${host}:8081`;
  const iconPath = findAppIcon();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/') {
        const html = generateDownloadPage(appName, apkFilename, metroHost, !!iconPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else if (req.method === 'GET' && req.url === '/icon' && iconPath) {
        const ext = path.extname(iconPath).toLowerCase();
        const mime = ext === '.webp' ? 'image/webp' : 'image/png';
        fs.stat(iconPath, (err, stats) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stats.size, 'Cache-Control': 'public, max-age=3600' });
          fs.createReadStream(iconPath).pipe(res);
        });
      } else if (req.method === 'GET' && req.url === `/${apkFilename}`) {
        fs.stat(apkPath, (err, stats) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': `attachment; filename="${apkFilename}"`,
            'Content-Length': stats.size,
          });
          fs.createReadStream(apkPath).pipe(res);
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${PORT} is already in use. Please free the port and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(PORT, HOST, () => {
      resolve(server);
    });
  });
}

module.exports = { startServer, generateDownloadPage, buildUrl, findAppIcon };
