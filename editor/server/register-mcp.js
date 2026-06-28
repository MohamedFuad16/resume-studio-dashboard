import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'claude_desktop_config.json'
);

const SERVER_PATH = '/Users/mfuad16/Documents/Resume/editor/server/mcp-server.js';

async function register() {
  console.log(`Checking Claude configuration at: ${CONFIG_PATH}`);
  try {
    let config = {};
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf8');
      config = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('No existing config found. Creating a new one.');
        // Ensure parent directories exist
        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      } else {
        throw e;
      }
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers['resume-editor'] = {
      command: 'node',
      args: [SERVER_PATH]
    };

    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log('Successfully registered "resume-editor" in Claude Desktop config!');
    console.log('Please restart your Claude Desktop client to activate the new tools.');
  } catch (e) {
    console.error('Failed to register MCP server:', e.message);
    process.exit(1);
  }
}

register();
