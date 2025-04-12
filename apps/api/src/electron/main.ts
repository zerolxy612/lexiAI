import '../register-aliases';

import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import path from 'node:path';
import os from 'node:os';
import getPort from 'get-port';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/modules/app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@/utils/filters/global-exception.filter';
import { setTraceID } from '@/utils/middleware/set-trace-id';
import { CustomWsAdapter } from '@/utils/adapters/ws-adapter';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = 'http://localhost:5173';
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;
let nestApp: NestExpressApplication;
let redisProcess: ChildProcess | null = null;

const store = new Store();

/**
 * Starts a Redis server on a free port
 * @returns {Promise<number>} The port the Redis server is running on
 */
async function startRedisServer(): Promise<number> {
  // Get a free port for Redis server
  const redisPort = await getPort();
  const redisServerPath = path.join(process.env.APP_ROOT, 'bin', 'redis-server');
  console.log('redisServerPath', redisServerPath);

  // Check if Redis server binary exists
  if (!fs.existsSync(redisServerPath)) {
    console.error(`Redis server binary not found at ${redisServerPath}`);
    throw new Error('Redis server binary not found');
  }

  // Create a temporary Redis config file to set the port
  const tempDir = app.getPath('temp');
  const configPath = path.join(tempDir, 'redis.conf');
  const dataDir = path.join(app.getPath('userData'), 'redis-data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write Redis config
  fs.writeFileSync(
    configPath,
    `port ${redisPort}\ndir "${dataDir}"\ndbfilename dump.rdb\nsave 60 1\n`,
  );

  // Start Redis server with the config file
  redisProcess = spawn(redisServerPath, [configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    if (!redisProcess) {
      return reject(new Error('Failed to start Redis server'));
    }

    let startupError = '';

    // Listen for Redis startup messages
    redisProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`Redis: ${output}`);

      // When Redis reports it's ready to accept connections, resolve with the port
      if (output.includes('Ready to accept connections')) {
        console.log(`Redis server running on port ${redisPort}`);
        resolve(redisPort);
      }
    });

    redisProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`Redis error: ${errorOutput}`);
      startupError += errorOutput;
    });

    redisProcess.on('error', (error) => {
      console.error('Failed to start Redis server:', error);
      reject(error);
    });

    redisProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Redis server exited with code ${code}`);

        // Check for specific error cases
        if (startupError.includes('Address already in use')) {
          // Port conflict - try again with a different port
          console.log('Redis port conflict, retrying with a different port...');
          if (redisProcess) {
            redisProcess = null;
            startRedisServer().then(resolve).catch(reject);
          }
        } else {
          reject(new Error(`Redis server exited with code ${code}: ${startupError}`));
        }
      }
    });

    // Set a timeout in case Redis doesn't start properly
    setTimeout(() => {
      if (redisProcess?.killed === false) {
        console.log("Redis startup timeout reached, assuming it's running");
        resolve(redisPort); // Assume it's running even if we didn't see the "ready" message
      }
    }, 5000);
  });
}

async function startNestServer() {
  process.env.OBJECT_STORAGE_BACKEND = 'fs';
  process.env.OBJECT_STORAGE_FS_ROOT = path.join(app.getPath('userData'), 'objectStorage');

  nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  nestApp.useLogger(nestApp.get(Logger));
  const configService = nestApp.get(ConfigService);
  configService.set('mode', 'desktop');

  nestApp.useBodyParser('json', { limit: '10mb' });
  nestApp.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  nestApp.useStaticAssets(path.join(__dirname, '..', 'public'));
  nestApp.setBaseViewsDir(path.join(__dirname, '..', 'views'));
  nestApp.setViewEngine('hbs');
  nestApp.set('trust proxy', true);

  nestApp.use(setTraceID);
  nestApp.use(helmet());
  nestApp.enableCors();
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new GlobalExceptionFilter(configService));

  const wsPort = await getPort();
  nestApp.useWebSocketAdapter(new CustomWsAdapter(app, wsPort));
  process.env.RF_COLLAB_URL = `ws://localhost:${wsPort}`;
  console.log(`Collab server running at ${process.env.RF_COLLAB_URL}`);

  // Use a free port for internal API server
  const port = await getPort();
  nestApp.listen(port);
  process.env.RF_API_BASE_URL = `http://localhost:${port}`;

  console.log(`API server running at ${process.env.RF_API_BASE_URL}`);

  // Set the static endpoints for the desktop app
  const publicStaticEndpoint = `http://localhost:${port}/v1/misc/public`;
  const privateStaticEndpoint = `http://localhost:${port}/v1/misc`;
  process.env.RF_PUBLIC_STATIC_ENDPOINT = publicStaticEndpoint;
  process.env.RF_PRIVATE_STATIC_ENDPOINT = privateStaticEndpoint;

  configService.set('static.public.endpoint', publicStaticEndpoint);
  configService.set('static.private.endpoint', privateStaticEndpoint);

  return nestApp;
}

function initializeStore() {
  const user = store.get('user');

  if (!user) {
    const systemUser = os.userInfo().username;
    store.set('user', {
      uid: systemUser,
      name: systemUser,
      nickname: systemUser,
      uiLocale: app.getSystemLocale(),
      outputLocale: 'auto',
    });
  }
}

async function createWindow() {
  console.log('appPath', app.getPath('userData'));
  console.log('systemLocale', app.getSystemLocale());

  initializeStore();

  process.env.DATABASE_URL = `file:${app.getPath('userData')}/refly.db`;

  try {
    // Start Redis server first
    const redisPort = await startRedisServer();
    // Set Redis URL for other parts of the application to use
    process.env.REDIS_PORT = String(redisPort);
    console.log(`Redis port set to ${process.env.REDIS_PORT}`);

    await startNestServer();
  } catch (error) {
    console.error('Failed to start services:', error);
  }

  win = new BrowserWindow({
    height: 1080,
    width: 1920,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.session.setPermissionRequestHandler((webContents, _permission, callback) => {
    const url = webContents.getURL();
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
      callback(true);
      return;
    }

    callback(false);
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `connect-src 'self' ${process.env.RF_API_BASE_URL} ws: wss: http://localhost:* https://localhost:*`,
        ],
      },
    });
  });

  ipcMain.handle('getStore', (_, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('setStore', (_, key: string, value: any) => {
    store.set(key, value);
  });

  ipcMain.handle('getRedisUrl', () => {
    return process.env.REDIS_URL;
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.commandLine.appendSwitch('ignore-certificate-errors');

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// Clean up on app quit
app.on('quit', async () => {
  // Clean up Redis process
  if (redisProcess && !redisProcess.killed) {
    console.log('Shutting down Redis server...');
    try {
      process.kill(redisProcess.pid!, 'SIGTERM');
    } catch (err) {
      console.error('Error shutting down Redis server:', err);
    }
    redisProcess = null;
  }

  if (nestApp) {
    await nestApp.close();
  }
});
