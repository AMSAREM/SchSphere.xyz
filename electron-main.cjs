const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let serverProcess = null;
let mainWindow = null;

// Determine if we are in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function startBackendServer() {
  if (isDev) {
    // In development, the dev server is started separately via npm run dev
    console.log('Running in development mode, expecting dev server on port 3000');
    return;
  }

  // In production, start the bundled Express backend server
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  console.log(`Starting production backend server at: ${serverPath}`);
  
  // Set production environment for the backend
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start backend server:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Backend server exited with code ${code} and signal ${signal}`);
  });
}

// Helper to poll the server until it's ready
function waitForServer(url, callback, retries = 30) {
  http.get(url, (res) => {
    // Any response means the server is online and listening
    callback(true);
  }).on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(url, callback, retries - 1), 500);
    } else {
      callback(false);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "SchoolSphere Academy",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true, // Clean look without traditional browser menu bars
  });

  const appUrl = 'http://localhost:3000';

  if (isDev) {
    // Wait for dev server to be fully ready before opening the window
    waitForServer(appUrl, () => {
      mainWindow.loadURL(appUrl);
      mainWindow.webContents.openDevTools();
    });
  } else {
    // Production: Wait for fork server to boot
    waitForServer(appUrl, () => {
      mainWindow.loadURL(appUrl);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize Electron app
app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clean up background backend server on exit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    console.log('Killing backend server process...');
    serverProcess.kill();
  }
});
