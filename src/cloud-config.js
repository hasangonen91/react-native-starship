'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = '.starship';
const CONFIG_FILE = 'cloud.json';

/**
 * Gets the config file path (relative to cwd).
 * @returns {string}
 */
function getConfigPath() {
  return path.resolve(CONFIG_DIR, CONFIG_FILE);
}

/**
 * Checks if cloud has been initialized.
 * @returns {boolean}
 */
function isInitialized() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.initialized === true;
  } catch {
    return false;
  }
}

/**
 * Loads the cloud config.
 * @returns {Object|null}
 */
function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Saves the cloud config.
 * @param {Object} config
 */
function saveConfig(config) {
  const dir = path.resolve(CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

/**
 * Checks if a previous cloud build was successful.
 * @returns {boolean}
 */
function hasSuccessfulBuild() {
  const config = loadConfig();
  return config && config.lastBuild && config.lastBuild.success === true;
}

/**
 * Updates the last build status.
 * @param {Object} buildInfo
 */
function updateLastBuild(buildInfo) {
  const config = loadConfig() || {};
  config.lastBuild = {
    timestamp: new Date().toISOString(),
    ...buildInfo,
  };
  saveConfig(config);
}

module.exports = {
  isInitialized,
  loadConfig,
  saveConfig,
  hasSuccessfulBuild,
  updateLastBuild,
  getConfigPath,
  CONFIG_DIR,
};
