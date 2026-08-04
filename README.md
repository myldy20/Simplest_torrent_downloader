# Simplest Torrent

<p align="center">
  <img src="docs/hero.svg" alt="Simplest Torrent macOS app" width="100%" />
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Platform: macOS" src="https://img.shields.io/badge/platform-macOS-black.svg">
  <img alt="UI: Tauri + React" src="https://img.shields.io/badge/UI-Tauri%20%2B%20React-6c70f5.svg">
  <a href="https://github.com/ikatson/rqbit"><img alt="Engine: rqbit" src="https://img.shields.io/badge/engine-rqbit-5b7cfa.svg"></a>
</p>

A deliberately tiny torrent downloader for macOS.

Choose a `.torrent` file, drop it onto the window, or paste a magnet link. The download starts immediately in the configured folder. No browser UI, no setup wizard, no media server, no statistics cockpit.

> The repository name contains the historical typo `Simpliest_torrent_downloader`. The product name is **Simplest Torrent**.

## What it does

- opens local `.torrent` files;
- accepts drag-and-drop;
- accepts magnet links;
- downloads to the macOS Downloads folder by default;
- lets you change the destination path;
- shows progress, speed and remaining time;
- supports pause and resume;
- remembers unfinished downloads;
- stops completed torrents automatically;
- removes entries from the list without deleting downloaded files.

That is intentionally almost the entire feature list.

## Status

Early alpha. The interface has been replaced, but the torrent engine remains the battle-tested Rust implementation from [rqbit](https://github.com/ikatson/rqbit).

The first supported target is macOS. The underlying Tauri project can also be built elsewhere, but cross-platform polish is not a current goal.

## Build locally

Requirements:

- current stable Rust toolchain;
- Node.js 22 or newer;
- npm;
- Xcode Command Line Tools on macOS.

```bash
npm ci
npm run build --workspace desktop
npm run tauri --workspace desktop -- build
```

For development:

```bash
npm ci
npm run tauri --workspace desktop -- dev
```

## Architecture

```text
Simplest Torrent
├── desktop/                 focused Tauri + React application
├── crates/librqbit/         embedded torrent session and API
├── crates/dht/              DHT implementation for magnet links
├── crates/*                 rqbit protocol and storage components
└── docs/                    project artwork and documentation
```

The UI talks directly to the embedded `librqbit` session through Tauri commands. The local HTTP API and upstream Web UI are not required for the minimal workflow.

## Privacy and behaviour

- The default download destination is the current user's Downloads folder.
- Session persistence is enabled so interrupted downloads can resume.
- New installations disable the optional local HTTP API.
- Completed torrents are paused automatically instead of seeding indefinitely.
- Removing a row keeps the downloaded files.

BitTorrent still exchanges data with peers while a download is active. Use the application only for content you are authorized to download and share.

## Upstream and licensing

This repository is a downstream fork of [ikatson/rqbit](https://github.com/ikatson/rqbit).

The codebase remains under the **Apache License 2.0**. The original copyright notice and license must remain with redistributed source or binaries. The new interface and project-specific modifications are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Apache-2.0 permits modification, redistribution and commercial use. It does **not** permit removing upstream attribution or using upstream trademarks to imply endorsement.

## Contributing

The product principle is simple: every new control must justify the attention it consumes. See [CONTRIBUTING.md](CONTRIBUTING.md).
