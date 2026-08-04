# Contributing

Simplest Torrent is intentionally small. Contributions are welcome when they improve reliability, accessibility, security or the core download workflow without turning the app into a general-purpose torrent dashboard.

## Product rule

A feature belongs here when a person can reasonably need it while doing one of these things:

1. adding a `.torrent` file;
2. adding a magnet link;
3. choosing where files are saved;
4. understanding whether the download is working;
5. pausing, resuming or removing a download.

Everything else needs a strong argument.

## Before opening a pull request

```bash
npm ci
npm run format:check
npm run build --workspace desktop
cargo fmt --all -- --check
cargo check -p rqbit-desktop
```

Keep engine changes separate from interface changes whenever possible. Changes inside the upstream rqbit crates should explain why the behaviour cannot be implemented in the desktop layer.

## Licensing

By contributing, you agree that your contribution is distributed under Apache-2.0. Do not remove upstream copyright notices or third-party license information.
