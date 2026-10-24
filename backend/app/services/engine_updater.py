import subprocess
import sys
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class EngineUpdater:
    def get_installed_versions(self) -> Dict[str, str]:
        versions = {}
        try:
            import yt_dlp
            try:
                import yt_dlp.version
                versions["yt_dlp"] = yt_dlp.version.__version__
            except Exception:
                versions["yt_dlp"] = getattr(yt_dlp, "__version__", "unknown")
        except Exception:
            versions["yt_dlp"] = "not installed"

        try:
            import ytmusicapi
            versions["ytmusicapi"] = getattr(ytmusicapi, "__version__", "unknown")
        except Exception:
            versions["ytmusicapi"] = "not installed"

        return versions

    async def update_engines(self) -> Dict[str, Any]:
        """
        Run pip install --upgrade yt-dlp ytmusicapi asynchronously.
        """
        def _run_pip():
            cmd = [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--no-cache-dir",
                "--upgrade",
                "yt-dlp",
                "ytmusicapi",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            return res.returncode == 0, res.stdout, res.stderr

        loop = asyncio.get_event_loop()
        try:
            success, stdout, stderr = await loop.run_in_executor(None, _run_pip)
            # Re-read versions
            versions = self.get_installed_versions()
            return {
                "success": success,
                "versions": versions,
                "output": stdout if success else stderr,
            }
        except Exception as e:
            logger.error(f"Engine update failed: {e}")
            return {
                "success": False,
                "versions": self.get_installed_versions(),
                "error": str(e),
            }

engine_updater = EngineUpdater()
