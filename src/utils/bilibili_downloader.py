#!/usr/bin/env python3
"""
B站视频下载器 - 基于yt-dlp实现B站视频和字幕下载
集成到自动切片工具项目中
"""

import os
import re
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from datetime import datetime
import yt_dlp
import subprocess

try:
    from .error_handler import FileIOError, ValidationError, ProcessingError
except ImportError:
    # 独立运行时的导入
    import sys
    sys.path.append(str(Path(__file__).parent.parent))
    from utils.error_handler import FileIOError, ValidationError, ProcessingError

logger = logging.getLogger(__name__)

class BilibiliVideoInfo:
    """Informações normalizadas de um vídeo do YouTube ou Bilibili."""
    def __init__(self, info_dict: Dict[str, Any]):
        self.bvid = info_dict.get('id', '')
        self.title = info_dict.get('title', 'video_sem_titulo')
        self.duration = info_dict.get('duration', 0) or 0
        self.uploader = info_dict.get('uploader') or info_dict.get('channel') or 'Desconhecido'
        self.description = info_dict.get('description', '') or ''
        self.thumbnail_url = info_dict.get('thumbnail', '') or ''
        self.view_count = info_dict.get('view_count', 0) or 0
        self.upload_date = info_dict.get('upload_date', '') or ''
        self.webpage_url = info_dict.get('webpage_url', '') or ''
        extractor = str(info_dict.get('extractor_key') or info_dict.get('extractor') or '').lower()
        self.platform = 'youtube' if 'youtube' in extractor else 'bilibili' if 'bilibili' in extractor else extractor
    
    def to_dict(self) -> Dict[str, Any]:
        """Converte as informações para o formato usado pela API."""
        return {
            'bvid': self.bvid,
            'title': self.title,
            'duration': self.duration,
            'uploader': self.uploader,
            'description': self.description,
            'thumbnail_url': self.thumbnail_url,
            'view_count': self.view_count,
            'upload_date': self.upload_date,
            'webpage_url': self.webpage_url,
            'platform': self.platform
        }

class BilibiliDownloader:
    """B站视频下载器"""
    
    def __init__(self, download_dir: Optional[Path] = None, browser: Optional[str] = None):
        """
        初始化下载器
        
        Args:
            download_dir: 下载目录，默认为当前目录
            browser: 浏览器类型，用于获取cookies
        """
        self.download_dir = download_dir or Path.cwd()
        self.browser = browser
        self.download_dir.mkdir(parents=True, exist_ok=True)
        
    def validate_video_url(self, url: str) -> bool:
        """Valida links de vídeo do YouTube e Bilibili."""
        if not url or not isinstance(url, str):
            return False

        supported_patterns = [
            r'https?://(www\.)?bilibili\.com/video/[Bb][Vv][0-9A-Za-z]+',
            r'https?://(www\.)?bilibili\.com/video/av\d+',
            r'https?://b23\.tv/[0-9A-Za-z]+',
            r'https?://(www\.|m\.|music\.)?youtube\.com/watch\?.*v=[0-9A-Za-z_-]{6,}',
            r'https?://(www\.|m\.)?youtube\.com/(shorts|live)/[0-9A-Za-z_-]{6,}',
            r'https?://youtu\.be/[0-9A-Za-z_-]{6,}'
        ]
        return any(re.match(pattern, url.strip(), re.IGNORECASE) for pattern in supported_patterns)

    def validate_bilibili_url(self, url: str) -> bool:
        """Alias legado para compatibilidade."""
        return self.validate_video_url(url)

    def detect_platform(self, url: str) -> str:
        normalized = (url or '').lower()
        if 'youtu.be' in normalized or 'youtube.com' in normalized:
            return 'youtube'
        if 'bilibili.com' in normalized or 'b23.tv' in normalized:
            return 'bilibili'
        return 'unknown'

    async def get_video_info(self, url: str) -> BilibiliVideoInfo:
        """
        获取视频信息（不下载）
        
        Args:
            url: 视频链接
            
        Returns:
            视频信息对象
        """
        if not self.validate_video_url(url):
            raise ValidationError(f"Link de vídeo não suportado: {url}")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        if self.browser:
            ydl_opts['cookies_from_browser'] = self.browser.lower()
            logger.info(f'yt-dlp cookies_from_browser: {ydl_opts.get("cookies_from_browser")}')
        
        try:
            loop = asyncio.get_event_loop()
            info_dict = await loop.run_in_executor(
                None, 
                self._extract_info_sync, 
                url, 
                ydl_opts
            )
            return BilibiliVideoInfo(info_dict)
        except Exception as e:
            raise ProcessingError(f"获取视频信息失败: {str(e)}")
    
    def _extract_info_sync(self, url: str, ydl_opts: Dict[str, Any]) -> Dict[str, Any]:
        """同步方式提取视频信息"""
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)
    
    async def download_video_and_subtitle(
        self, 
        url: str, 
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> Dict[str, str]:
        """
        下载视频和字幕文件
        
        Args:
            url: 视频链接
            progress_callback: 进度回调函数，参数为(状态信息, 进度百分比)
            
        Returns:
            包含video_path和subtitle_path的字典
        """
        if not self.validate_video_url(url):
            raise ValidationError(f"Link de vídeo não suportado: {url}")
        
        # 获取视频信息
        video_info = await self.get_video_info(url)
        
        # 清理文件名，移除特殊字符
        safe_title = self._sanitize_filename(video_info.title)
        
        # 设置下载选项 - 专注AI字幕
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'writeautomaticsub': True,
            'writesubtitles': True,
            'subtitleslangs': ['pt-BR', 'pt', 'en', 'en-US', 'zh-Hans', 'zh-CN', 'zh', 'ai-zh'],
            'subtitlesformat': 'srt/vtt/best',
            'convertsubtitles': 'srt'
            'outtmpl': str(self.download_dir / f'{safe_title}.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'progress': True,
        }
        
        if self.browser:
            ydl_opts['cookies_from_browser'] = self.browser.lower()
            logger.info(f'yt-dlp cookies_from_browser: {ydl_opts.get("cookies_from_browser")}')
        
        # 添加进度钩子
        if progress_callback:
            ydl_opts['progress_hooks'] = [self._create_progress_hook(progress_callback)]
        
        try:
            if progress_callback:
                progress_callback("Iniciando download do vídeo e das legendas...", 0)
            
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._download_sync,
                url,
                ydl_opts
            )
            
            # 查找下载的文件
            video_path = self._find_downloaded_video(safe_title)
            subtitle_path = self._find_downloaded_subtitle(safe_title)
            
            if progress_callback:
                progress_callback("下载完成", 100)
            
            result = {
                'video_path': str(video_path) if video_path else '',
                'subtitle_path': str(subtitle_path) if subtitle_path else '',
                'video_info': video_info.to_dict()
            }
            
            logger.info(f"下载完成: {video_info.title}")
            return result
            
        except Exception as e:
            error_msg = f"下载失败: {str(e)}"
            if progress_callback:
                progress_callback(error_msg, 0)
            raise ProcessingError(error_msg)
    
    def _download_sync(self, url: str, ydl_opts: Dict[str, Any]):
        """Baixa vídeo e legendas via yt-dlp, com suporte a YouTube e Bilibili."""
        browser = self.browser.lower() if self.browser else None
        safe_title = Path(ydl_opts.get('outtmpl', '')).name.replace('%(ext)s', '') or 'video'

        progress_callback = None
        if ydl_opts.get('progress_hooks'):
            original_hook = ydl_opts['progress_hooks'][0]
            if hasattr(original_hook, '__closure__') and original_hook.__closure__:
                try:
                    progress_callback = original_hook.__closure__[0].cell_contents
                except Exception:
                    progress_callback = None

        cmd = [
            "yt-dlp",
            "--no-playlist",
            "--format", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--write-sub",
            "--write-auto-sub",
            "--sub-langs", "pt-BR,pt.*,en.*,zh.*,ai-zh",
            "--sub-format", "srt/vtt/best",
            "--convert-subs", "srt",
            "--output", f"{safe_title}.%(ext)s",
            "--progress"
        ]
        if browser:
            cmd.extend(["--cookies-from-browser", browser])
        cmd.append(url)

        logger.info("[yt-dlp] Iniciando download da plataforma: %s", self.detect_platform(url))

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(self.download_dir),
            bufsize=1,
            universal_newlines=True
        )

        progress_pattern = re.compile(r'\[download\]\s+(\d+\.?\d*)%')
        output_lines = []

        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                line = output.strip()
                output_lines.append(line)
                logger.info("[yt-dlp] %s", line)
                if progress_callback:
                    match = progress_pattern.search(output)
                    if match:
                        try:
                            progress = float(match.group(1))
                            progress_callback(f"Baixando... {progress:.1f}%", progress)
                        except ValueError:
                            pass

        result = process.poll()
        if result != 0:
            tail = "\n".join(output_lines[-12:])
            raise ProcessingError(f"yt-dlp encerrou com código {result}. {tail}")

        logger.info("[yt-dlp] Download concluído. Arquivos: %s", os.listdir(self.download_dir))

    def _create_progress_hook(self, progress_callback: Callable[[str, float], None]):
        """创建进度回调钩子"""
        def progress_hook(d):
            if d['status'] == 'downloading':
                if 'total_bytes' in d and d['total_bytes']:
                    progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                elif '_percent_str' in d:
                    # 从百分比字符串中提取数字
                    percent_str = d['_percent_str'].strip().rstrip('%')
                    try:
                        progress = float(percent_str)
                    except ValueError:
                        progress = 0
                else:
                    progress = 0
                
                speed = d.get('_speed_str', '')
                eta = d.get('_eta_str', '')
                status = f"Baixando... {speed} ETA: {eta}"
                progress_callback(status, progress)
            elif d['status'] == 'finished':
                progress_callback("Download concluído. Preparando arquivos...", 95)
        
        return progress_hook
    
    def _sanitize_filename(self, filename: str) -> str:
        """清理文件名，移除不安全字符"""
        # 移除或替换不安全的字符
        unsafe_chars = '<>:"/\\|?*'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')
        
        # 限制文件名长度
        if len(filename) > 100:
            filename = filename[:100]
        
        return filename.strip()
    
    def _find_downloaded_video(self, title: str) -> Optional[Path]:
        """查找下载的视频文件"""
        possible_extensions = ['.mp4', '.mkv', '.webm', '.flv']
        
        for ext in possible_extensions:
            video_path = self.download_dir / f"{title}{ext}"
            if video_path.exists():
                return video_path
        
        # 如果精确匹配失败，尝试模糊匹配
        for file_path in self.download_dir.glob(f"{title}*"):
            if file_path.suffix.lower() in possible_extensions:
                return file_path
        
        return None
    
    def _find_downloaded_subtitle(self, title: str) -> Optional[Path]:
        """查找下载的字幕文件 - 简化版本，专注AI字幕"""
        logger.info(f"正在查找字幕文件，标题: {title}")
        
        # 首先检查AI字幕文件
        ai_subtitle_path = self.download_dir / f"{title}.ai-zh.srt"
        if ai_subtitle_path.exists():
            # 重命名为标准格式
            standard_path = self.download_dir / f"{title}.srt"
            if not standard_path.exists():
                ai_subtitle_path.rename(standard_path)
                logger.info(f"重命名AI字幕文件: {title}.ai-zh.srt -> {title}.srt")
                return standard_path
            return ai_subtitle_path
        
        # 检查是否已经是标准格式
        standard_path = self.download_dir / f"{title}.srt"
        if standard_path.exists():
            logger.info(f"找到标准字幕文件: {title}.srt")
            return standard_path
        
        # 模糊匹配字幕文件
        for file_path in self.download_dir.glob(f"{title}*.srt"):
            logger.info(f"找到字幕文件: {file_path.name}")
            return file_path
        
        logger.warning(f"未找到字幕文件，标题: {title}")
        return None
    
    def _convert_vtt_to_srt(self, vtt_path: Path, srt_path: Path):
        """将VTT字幕文件转换为SRT格式"""
        try:
            with open(vtt_path, 'r', encoding='utf-8') as vtt_file:
                vtt_content = vtt_file.read()
            
            # 简单的VTT到SRT转换
            lines = vtt_content.split('\n')
            srt_lines = []
            subtitle_count = 1
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # 跳过VTT头部信息
                if line.startswith('WEBVTT') or line.startswith('NOTE') or not line:
                    i += 1
                    continue
                
                # 查找时间戳行
                if '-->' in line:
                    # 转换时间格式 (VTT使用点，SRT使用逗号)
                    time_line = line.replace('.', ',')
                    srt_lines.append(str(subtitle_count))
                    srt_lines.append(time_line)
                    
                    # 获取字幕文本
                    i += 1
                    subtitle_text = []
                    while i < len(lines) and lines[i].strip():
                        subtitle_text.append(lines[i].strip())
                        i += 1
                    
                    srt_lines.extend(subtitle_text)
                    srt_lines.append('')  # 空行分隔
                    subtitle_count += 1
                
                i += 1
            
            # 写入SRT文件
            with open(srt_path, 'w', encoding='utf-8') as srt_file:
                srt_file.write('\n'.join(srt_lines))
                
        except Exception as e:
            logger.error(f"VTT转SRT转换失败: {e}")
            raise
    
    def cleanup_temp_files(self, title: str):
        """清理临时文件"""
        try:
            # 清理可能的临时文件
            for pattern in [f"{title}*.part", f"{title}*.tmp", f"{title}*.ytdl"]:
                for temp_file in self.download_dir.glob(pattern):
                    temp_file.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"清理临时文件失败: {e}")

    def download(self, url, safe_title):
        # 1. 构造yt-dlp命令
        browser = self.browser.lower() if self.browser else "chrome"
        cmd = [
            "yt-dlp",
            "--write-sub",
            "--sub-lang", "ai-zh",
            "--sub-format", "srt",
            "--output", str(self.download_dir / f'{safe_title}.%(ext)s'),
            "--cookies-from-browser", browser,
            url
        ]
        logger.info(f"[subprocess] yt-dlp命令: {' '.join(cmd)}")
        # 2. 执行命令
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(self.download_dir))
        logger.info(f"[subprocess] yt-dlp stdout: {result.stdout}")
        logger.info(f"[subprocess] yt-dlp stderr: {result.stderr}")
        if result.returncode != 0:
            logger.error(f"yt-dlp命令执行失败，返回码: {result.returncode}")
        # 3. 列出下载目录所有文件
        import os
        files = os.listdir(self.download_dir)
        logger.info(f"[subprocess] 下载目录内容: {files}")
        # 4. 查找字幕文件
        subtitle_file = None
        for f in files:
            if f.endswith('.srt') or f.endswith('.ass'):
                subtitle_file = f
                break
        if subtitle_file:
            logger.info(f"[subprocess] 找到字幕文件: {subtitle_file}")
        else:
            logger.warning(f"[subprocess] 未找到字幕文件，标题: {safe_title}")

# 便捷函数
async def download_bilibili_video(
    url: str, 
    download_dir: Optional[Path] = None,
    browser: Optional[str] = None,
    progress_callback: Optional[Callable[[str, float], None]] = None
) -> Dict[str, str]:
    """
    便捷的B站视频下载函数
    
    Args:
        url: B站视频链接
        download_dir: 下载目录
        browser: 浏览器类型
        progress_callback: 进度回调函数
        
    Returns:
        包含video_path和subtitle_path的字典
    """
    downloader = BilibiliDownloader(download_dir, browser)
    return await downloader.download_video_and_subtitle(url, progress_callback)

async def get_bilibili_video_info(url: str, browser: Optional[str] = None) -> BilibiliVideoInfo:
    """
    便捷的B站视频信息获取函数
    
    Args:
        url: B站视频链接
        browser: 浏览器类型
        
    Returns:
        视频信息对象
    """
    downloader = BilibiliDownloader(browser=browser)
    return await downloader.get_video_info(url)