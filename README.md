# OpenNeutron UI

A web-based email client for [OpenNeutron](https://github.com/OpenNeutron/Openneutron) - a privacy-focused, end-to-end encrypted email platform. All encryption and decryption happens client-side using RSA and AES-256, so the server never sees plaintext content.

## Features

- End-to-end encrypted email (RSA + AES-256, client-side)
- Rich text composing (bold, italic, lists, links) via Tiptap editor
- File attachments
- Folders, starred messages, and custom groups
- Drafts with auto-save
- Search and filtering
- Admin panel for user management
- Dark-themed, responsive UI built with Tailwind CSS and Radix UI

## Prerequisites

- **Node.js** ≥ 18
- **npm** (or any compatible package manager)

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens a local dev server (default: `http://localhost:5173`) with hot module replacement.

## Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory. Serve it with any static file server or use:

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## Configuration

The API base URL is set in `src/api.js`. By default it proxies to `/api/` - adjust the Vite proxy config in `vite.config.js` or change the `baseURL` to point at your OpenNeutron backend.

## License

See [LICENSE](LICENSE) for details.
