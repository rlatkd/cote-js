const { exec } = require('child_process');

const url = 'http://localhost:3000';

const open = () => {
  const platform = process.platform;

  if (platform === 'darwin') { // macOS
    exec(`open ${url}`);
  } else if (platform === 'win32') { // Windows
    exec(`start ${url}`);
  } else if (platform === 'linux') { // Linux
    exec(`xdg-open ${url}`);
  }
};

open();
