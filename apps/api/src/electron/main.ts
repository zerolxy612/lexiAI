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
import { buildSuccessResponse } from '@/utils/response';

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
let apiBaseUrl = 'http://localhost:5800';

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
  nestApp.enableCors({
    origin: '*', // Allow Electron renderer to access
    credentials: true,
  });
  nestApp.use(cookieParser());
  nestApp.useWebSocketAdapter(new CustomWsAdapter(app, configService.get<number>('wsPort')));
  nestApp.useGlobalFilters(new GlobalExceptionFilter(configService));

  // Set global prefix to match server implementation
  // This ensures routes like /v1/auth are properly handled
  // nestApp.setGlobalPrefix('');

  // Use a free port for internal API server
  const port = await getPort();
  nestApp.listen(port);
  apiBaseUrl = `http://localhost:${port}`;

  console.log(`NestJS API server running at ${apiBaseUrl}`);

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
  await startNestServer();

  initializeStore();

  win = new BrowserWindow({
    height: 1080,
    width: 1920,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  ipcMain.handle('getStore', (_, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('setStore', (_, key: string, value: any) => {
    store.set(key, value);
  });

  // Setup HTTP request proxy
  ipcMain.handle('apiRequest', async (_event, { method, path, headers = {}, body }) => {
    console.log('apiRequest', method, path, headers, body);

    // Handle user settings query and update via electron store
    if (path === '/v1/user/settings') {
      switch (method) {
        case 'GET':
          return buildSuccessResponse(store.get('user'));
        case 'PUT':
          store.set('user', body);
          return buildSuccessResponse();
        default:
          return {};
      }
    }

    try {
      // Ensure path starts with /v1 if not already present
      const url = `${apiBaseUrl}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      console.log('fetch url', url, options);
      const response = await fetch(url, options);
      const contentType = response.headers.get('content-type');

      let data: any;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      console.log('apiRequest data', data);

      return data;
    } catch (error) {
      console.error('HTTP Request Error:', error);
      return { message: 'Internal Server Error' };
    }
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
