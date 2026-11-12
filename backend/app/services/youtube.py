"""Download the audio track of a YouTube video with yt-dlp."""

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app.config import get_settings
from app.services.common import PipelineError

PLACEHOLDER_TITLE = "Fetching YouTube title…"
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"}


def extract_video_id(url: str) -> str | None:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host not in _HOSTS:
        return None
    candidate = None
    if host.endswith("youtu.be"):
        candidate = parsed.path.lstrip("/").split("/")[0]
    elif parsed.path == "/watch":
        candidate = parse_qs(parsed.query).get("v", [None])[0]
    else:
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2 and parts[0] in {"shorts", "live", "embed", "v"}:
            candidate = parts[1]
    return candidate if candidate and _ID_RE.match(candidate) else None


@dataclass
class YouTubeAudio:
    path: Path
    title: str
    video_id: str
    duration: float | None


def download_youtube_audio(url: str, dest_dir: Path, max_seconds: float) -> YouTubeAudio:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError

    settings = get_settings()
    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": str(dest_dir / "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    if settings.ytdlp_cookies_file:
        opts["cookiefile"] = settings.ytdlp_cookies_file

    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("_type") == "playlist":
                raise PipelineError("Playlists aren't supported — paste a link to a single video.")
            if info.get("is_live"):
                raise PipelineError("Live streams can't be processed until they have ended.")
            duration = info.get("duration")
            if duration and duration > max_seconds:
                raise PipelineError(
                    f"This video is {duration / 60:.0f} min long; the limit is {max_seconds / 60:.0f} min."
                )
            info = ydl.extract_info(url, download=True)
    except DownloadError as exc:
        raise PipelineError(
            f"YouTube download failed: {exc}. If YouTube is blocking the server, "
            "configure YTDLP_COOKIES_FILE or upload the recording directly."
        ) from exc

    video_id = info["id"]
    downloads = info.get("requested_downloads") or []
    path = Path(downloads[0]["filepath"]) if downloads and downloads[0].get("filepath") else None
    if path is None or not path.is_file():
        matches = sorted(dest_dir.glob(f"{video_id}.*"))
        if not matches:
            raise PipelineError("yt-dlp finished but no audio file was produced.")
        path = matches[0]
    return YouTubeAudio(path=path, title=info.get("title") or "YouTube lecture",
                        video_id=video_id, duration=info.get("duration"))
