import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CurrentDesktopState,
  RqbitDesktopConfig,
} from "./configuration";

type TorrentState = "initializing" | "paused" | "live" | "error";

interface Speed {
  human_readable: string;
}

interface TorrentStats {
  state: TorrentState;
  error: string | null;
  progress_bytes: number;
  finished: boolean;
  total_bytes: number;
  live: {
    download_speed: Speed;
    upload_speed: Speed;
    time_remaining: { human_readable: string } | null;
  } | null;
}

interface TorrentListItem {
  id: number;
  info_hash: string;
  name: string | null;
  output_folder: string;
  stats?: TorrentStats;
}

interface ListTorrentsResponse {
  torrents: TorrentListItem[];
}

interface InvokeError {
  human_readable?: string;
  status_text?: string;
  message?: string;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as InvokeError;
    return value.human_readable ?? value.message ?? value.status_text ?? "Unknown error";
  }
  return "Unknown error";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function progressFor(torrent: TorrentListItem): number {
  const stats = torrent.stats;
  if (!stats) return 0;
  if (stats.finished) return 1;
  if (stats.total_bytes <= 0) return 0;
  return Math.max(0, Math.min(1, stats.progress_bytes / stats.total_bytes));
}

function statusFor(torrent: TorrentListItem): string {
  const stats = torrent.stats;
  if (!stats) return "Starting";
  if (stats.error) return "Error";
  if (stats.finished) return "Done";
  if (stats.state === "paused") return "Paused";
  if (stats.state === "initializing") return "Connecting";
  return "Downloading";
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the torrent file"));
        return;
      }
      const encoded = result.split(",")[1];
      encoded ? resolve(encoded) : reject(new Error("Could not encode the torrent file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the torrent file"));
    reader.readAsDataURL(file);
  });
}

async function ensureConfigured(): Promise<RqbitDesktopConfig> {
  const [current, defaults] = await Promise.all([
    invoke<CurrentDesktopState>("config_current"),
    invoke<RqbitDesktopConfig>("config_default"),
  ]);

  if (current.configured && current.config) return current.config;

  const config: RqbitDesktopConfig = {
    ...defaults,
    persistence: {
      ...defaults.persistence,
      fastresume: true,
    },
    http_api: {
      ...defaults.http_api,
      disable: true,
    },
  };

  await invoke("config_change", { config });
  return config;
}

export function SimplestTorrentApp() {
  const [config, setConfig] = useState<RqbitDesktopConfig | null>(null);
  const [torrents, setTorrents] = useState<TorrentListItem[]>([]);
  const [magnet, setMagnet] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refreshInFlight = useRef(false);
  const autoPaused = useRef(new Set<number>());

  const totalSpeed = useMemo(() => {
    const active = torrents
      .map((torrent) => torrent.stats?.live?.download_speed.human_readable)
      .filter(Boolean);
    return active.length === 1 ? active[0] : null;
  }, [torrents]);

  const refresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const response = await invoke<ListTorrentsResponse>("torrents_list");
      const list = response.torrents ?? [];
      setTorrents(list);

      const completed = list.filter(
        (torrent) =>
          torrent.stats?.finished &&
          torrent.stats.state !== "paused" &&
          !autoPaused.current.has(torrent.id),
      );
      for (const torrent of completed) {
        autoPaused.current.add(torrent.id);
        void invoke("torrent_action_pause", { id: torrent.id });
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      refreshInFlight.current = false;
    }
  };

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    ensureConfigured()
      .then(async (loadedConfig) => {
        if (!active) return;
        setConfig(loadedConfig);
        setFolderDraft(loadedConfig.default_download_location);
        await refresh();
        if (active) timer = window.setInterval(refresh, 1200);
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const addTorrent = async (source: string | File) => {
    setBusy(true);
    setError(null);
    try {
      if (source instanceof File) {
        if (!source.name.toLowerCase().endsWith(".torrent")) {
          throw new Error("Drop a .torrent file");
        }
        const contents = await readFileAsBase64(source);
        await invoke("torrent_create_from_base64_file", {
          contents,
          opts: { overwrite: true },
        });
      } else {
        const url = source.trim();
        if (!url.toLowerCase().startsWith("magnet:?")) {
          throw new Error("Paste a magnet link beginning with magnet:?");
        }
        await invoke("torrent_create_from_url", {
          url,
          opts: { overwrite: true },
        });
        setMagnet("");
      }
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.item(0);
    if (file) void addTorrent(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const toggleTorrent = async (torrent: TorrentListItem) => {
    setError(null);
    try {
      const command = torrent.stats?.state === "paused" ? "torrent_action_start" : "torrent_action_pause";
      await invoke(command, { id: torrent.id });
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const forgetTorrent = async (torrent: TorrentListItem) => {
    setError(null);
    try {
      await invoke("torrent_action_forget", { id: torrent.id });
      autoPaused.current.delete(torrent.id);
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const saveFolder = async () => {
    if (!config || !folderDraft.trim()) return;
    const nextConfig = {
      ...config,
      default_download_location: folderDraft.trim(),
    };
    setBusy(true);
    setError(null);
    try {
      await invoke("config_change", { config: nextConfig });
      setConfig(nextConfig);
      setSettingsOpen(false);
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-row">
            <span className="brand-mark" aria-hidden="true">↓</span>
            <h1>Simplest Torrent</h1>
          </div>
          <p>Drop. Download. Done.</p>
        </div>
        <div className="header-actions">
          {totalSpeed && <span className="speed-pill">↓ {totalSpeed}</span>}
          <button
            className="icon-button"
            type="button"
            aria-label="Download folder settings"
            title="Download folder"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            ⚙︎
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-card" aria-label="Settings">
          <label htmlFor="download-folder">Download folder</label>
          <div className="settings-row">
            <input
              id="download-folder"
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              spellCheck={false}
              placeholder="/Users/you/Downloads"
            />
            <button type="button" onClick={saveFolder} disabled={busy || !folderDraft.trim()}>
              Save
            </button>
          </div>
          <small>Use an absolute macOS path. Existing downloads remain where they are.</small>
        </section>
      )}

      <section
        className={`drop-card ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept=".torrent,application/x-bittorrent"
          onChange={handleFileInput}
        />
        <button
          className="drop-target"
          type="button"
          disabled={busy || loading}
          onClick={() => fileInput.current?.click()}
        >
          <span className="drop-icon" aria-hidden="true">＋</span>
          <strong>{dragging ? "Drop it" : "Choose or drop a .torrent"}</strong>
          <span>It starts immediately in your download folder</span>
        </button>

        <div className="divider"><span>or</span></div>

        <form
          className="magnet-form"
          onSubmit={(event) => {
            event.preventDefault();
            void addTorrent(magnet);
          }}
        >
          <input
            value={magnet}
            onChange={(event) => setMagnet(event.target.value)}
            placeholder="Paste magnet link"
            aria-label="Magnet link"
            spellCheck={false}
          />
          <button type="submit" disabled={busy || loading || !magnet.trim()}>
            Download
          </button>
        </form>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      <section className="queue" aria-label="Downloads">
        <div className="queue-title">
          <h2>Downloads</h2>
          <span>{torrents.length}</span>
        </div>

        {loading ? (
          <div className="empty-state">Starting the torrent engine…</div>
        ) : torrents.length === 0 ? (
          <div className="empty-state">Nothing here. That is the whole point.</div>
        ) : (
          <div className="torrent-list">
            {torrents.map((torrent) => {
              const stats = torrent.stats;
              const progress = progressFor(torrent);
              const paused = stats?.state === "paused";
              return (
                <article className="torrent-row" key={`${torrent.id}-${torrent.info_hash}`}>
                  <div className="torrent-main">
                    <div className="torrent-heading">
                      <strong title={torrent.name ?? torrent.info_hash}>
                        {torrent.name ?? "Resolving magnet…"}
                      </strong>
                      <span className={`status status-${stats?.state ?? "initializing"}`}>
                        {statusFor(torrent)}
                      </span>
                    </div>
                    <div className="progress-track" aria-label={`${Math.round(progress * 100)} percent`}>
                      <span style={{ width: `${progress * 100}%` }} />
                    </div>
                    <div className="torrent-meta">
                      <span>{Math.round(progress * 100)}%</span>
                      <span>{formatBytes(stats?.progress_bytes ?? 0)} / {formatBytes(stats?.total_bytes ?? 0)}</span>
                      {stats?.live?.download_speed.human_readable && (
                        <span>↓ {stats.live.download_speed.human_readable}</span>
                      )}
                      {stats?.live?.time_remaining?.human_readable && (
                        <span>{stats.live.time_remaining.human_readable} left</span>
                      )}
                    </div>
                  </div>
                  <div className="torrent-actions">
                    {!stats?.finished && (
                      <button type="button" onClick={() => void toggleTorrent(torrent)}>
                        {paused ? "Resume" : "Pause"}
                      </button>
                    )}
                    <button
                      className="quiet-button"
                      type="button"
                      title="Remove from the list and keep downloaded files"
                      onClick={() => void forgetTorrent(torrent)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer>
        <span>Completed torrents stop seeding automatically.</span>
        <span>Powered by rqbit · Apache-2.0</span>
      </footer>
    </main>
  );
}
