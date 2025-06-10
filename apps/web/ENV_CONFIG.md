# Web Frontend Environment Configuration

This document describes the environment variables used to configure the web frontend application.

## Homepage Behavior Configuration

### VITE_HOMEPAGE_SHOW_AUTH

Controls whether the homepage shows the login/signup page or the marketing landing page for unauthenticated users.

**Values:**
- `true` - Show login/signup page directly on homepage (/)
- `false` or unset - Show marketing landing page (default behavior)

**Examples:**

```bash
# Show login page on homepage
VITE_HOMEPAGE_SHOW_AUTH=true pnpm dev

# Show landing page on homepage (default)
VITE_HOMEPAGE_SHOW_AUTH=false pnpm dev
# or simply
pnpm dev
```

## Available Routes

With this configuration, the following routes are available:

- `/` - Homepage (login page or landing page based on VITE_HOMEPAGE_SHOW_AUTH)
- `/auth` - Always shows login/signup page
- `/landing` - Always shows marketing landing page
- `/canvas/empty` - Main workspace (requires authentication)

## Other Environment Variables

### API Configuration
- `REFLY_API_URL` - Backend API server URL (default: http://localhost:5800)
- `COLLAB_URL` - Collaboration WebSocket URL (default: http://localhost:5801)

### Feature Flags
- `SUBSCRIPTION_ENABLED` - Enable subscription and billing features
- `VITE_RUNTIME` - Runtime environment (web/desktop)

## Setup Instructions

1. Copy the environment configuration:
   ```bash
   # From project root
   pnpm copy-env:develop
   ```

2. Create a local environment file if needed:
   ```bash
   # In apps/web directory
   cp .env.example .env.local
   ```

3. Edit `.env.local` with your specific configuration:
   ```env
   VITE_HOMEPAGE_SHOW_AUTH=true
   REFLY_API_URL=http://localhost:5800
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ``` 