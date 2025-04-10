import '../register-aliases';

import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import path from 'node:path';
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
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;
let nestApp: NestExpressApplication;

const store = new Store();

async function startNestServer() {
  nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  nestApp.useLogger(nestApp.get(Logger));
  const configService = nestApp.get(ConfigService);
  configService.set('app.mode', 'desktop');
  console.log('configService.get(app.mode)', configService.get('app.mode'));

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
    store.set('user', {
      uid: 'u-local',
      name: 'Refly',
    });
  }
}

async function createWindow() {
  console.log('appPath', app.getPath('userData'));

  await startNestServer();

  initializeStore();

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
  if (nestApp) {
    await nestApp.close();
  }
});
