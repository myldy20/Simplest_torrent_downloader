import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { SimplestTorrentApp } from "./simplest-torrent";

import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <SimplestTorrentApp />
  </StrictMode>,
);
