# Changelog

## 0.1.0-alpha.3

### Added

- checkbox to keep unfinished files under a `.part` suffix until all their pieces are verified;
- per-file automatic rename on verification, rather than waiting for the whole torrent;
- resume support for existing `.part` downloads when the setting changes or the app restarts;
- protection against collisions between normal and temporary filenames.

### Compatibility

- existing normal filenames remain untouched;
- disabling the setting affects only new files and will not discard incomplete `.part` data;
- this prevents accidental double-click opening, but doesn't prohibit manually reading an incomplete file.


## 0.1.0-alpha.2

### Fixed

- handle torrents containing thousands of small files without exhausting OS file descriptors, using a bounded lazy file-handle cache;
- prevent potential peer-table deadlock when changing selected files (backport of upstream rqbit 9cb9709);
- prevent duplicate downloads of already validated pieces after selection changes (upstream 5f0d0ba);
- forward vectored writes through boxed torrent storage for better write efficiency (upstream 176484e).

### Validation

- tests for sequential access to 1,024 files and concurrent eviction across 300 files;
- the reported 16,879-file torrent metadata was analyzed without adding it to the repository.


## 0.1.0-alpha.1

First public Simplest Torrent alpha for Apple Silicon macOS.

### Added

- focused one-window torrent workflow;
- `.torrent` file selection and drag-and-drop;
- magnet-link input;
- immediate downloads to the macOS Downloads folder;
- configurable destination folder;
- automatic creation of missing destination folders;
- progress, speed and remaining-time display;
- pause, resume and safe removal from the list;
- session persistence for interrupted downloads;
- automatic pause after completion;
- dedicated application icon and macOS DMG packaging;
- permanent GitHub Release publishing workflow;
- bundled Apache-2.0 license and upstream notices.

### Known limitations

- Apple Silicon only;
- unsigned and not notarized, requiring a one-time quarantine removal command on recent macOS versions;
- early alpha interface and limited real-world testing.
