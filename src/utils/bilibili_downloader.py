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
import sys

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
        self._raw_info = info_dict
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
        """Obtém os metadados do vídeo sem fazer o download."""
        if not self.validate_video_url(url):
            raise ValidationError(f"Link de vídeo não suportado: {url}")

        platform = self.detect_platform(url)
        base_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }

        attempts = []

        if platform == 'youtube':
            # Workaround atual do yt-dlp para falhas do cliente padrão do YouTube.
            public_opts = dict(base_opts)
            public_opts['extractor_args'] = {
                'youtube': {
                    'player_client': ['default', 'web_embedded']
                }
            }
            attempts.append(('público', public_opts))

            if self.browser:
                browser = self.browser.lower()
                cookie_opts = dict(public_opts)
                cookie_opts['cookiesfrombrowser'] = (browser,)
                attempts.append((f'cookies de {browser}', cookie_opts))
        else:
            attempts.append(('padrão', dict(base_opts)))
            if self.browser:
                browser = self.browser.lower()
                cookie_opts = dict(base_opts)
                cookie_opts['cookiesfrombrowser'] = (browser,)
                attempts.append((f'cookies de {browser}', cookie_opts))

        errors = []

        for label, opts in attempts:
            try:
                loop = asyncio.get_event_loop()
                info_dict = await loop.run_in_executor(
                    None,
                    self._extract_info_sync,
                    url,
                    opts
                )
                return BilibiliVideoInfo(info_dict)
            except Exception as exc:
                clean = self._clean_error_text(str(exc))
                errors.append((label, clean))
                logger.warning("Falha ao obter metadados (%s): %s", label, clean)

        if platform == 'youtube':
            combined = " | ".join(f"{label}: {msg}" for label, msg in errors)

            if "The page needs to be reloaded" in combined:
                raise ProcessingError(
                    "O YouTube recusou a extração dos dados do vídeo. "
                    "Isso é um problema conhecido do yt-dlp/YouTube. "
                    "Atualize o yt-dlp e tente novamente. "
                    "Se o vídeo for público, deixe o navegador desativado nas configurações; "
                    "se exigir login, mantenha o YouTube aberto e autenticado no navegador selecionado."
                )

            if errors:
                raise ProcessingError(
                    f"Não foi possível obter os dados do vídeo do YouTube: {errors[0][1]}"
                )

        if errors:
            raise ProcessingError(f"Falha ao obter informações do vídeo: {errors[0][1]}")

        raise ProcessingError("Falha ao obter informações do vídeo por um motivo desconhecido.")

    @staticmethod
    def _clean_error_text(text: str) -> str:
        """Remove sequências ANSI e reduz mensagens de erro do yt-dlp."""
        if not text:
            return ""
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\\[[0-?]*[ -/]*[@-~])')
        cleaned = ansi_escape.sub('', text)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

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
            'subtitle_candidates': self._get_subtitle_candidates(video_info),
            'outtmpl': str(self.download_dir / f'{safe_title}.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'progress': True,
        }
        
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
            
            if not subtitle_path:
                raise ProcessingError(
                    "Não foi possível obter legendas para este vídeo. "
                    "O AutoClip precisa de legendas manuais ou automáticas para analisar o conteúdo."
                )

            if progress_callback:
                progress_callback("Download concluído", 100)
            
            result = {
                'video_path': str(video_path) if video_path else '',
                'subtitle_path': str(subtitle_path) if subtitle_path else '',
                'video_info': video_info.to_dict()
            }
            
            logger.info(f"Download concluído: {video_info.title}")
            return result
            
        except Exception as e:
            error_msg = f"Falha no download: {self._clean_error_text(str(e))}"
            if progress_callback:
                progress_callback(error_msg, 0)
            raise ProcessingError(error_msg)
    
    def _get_subtitle_candidates(self, video_info: BilibiliVideoInfo) -> list:
        """Escolhe poucas legendas, priorizando faixas originais em vez de traduções automáticas."""
        raw = getattr(video_info, '_raw_info', {}) or {}
        manual = raw.get('subtitles') or {}
        automatic = raw.get('automatic_captions') or {}
        source_language = (raw.get('language') or '').strip()

        candidates = []

        def add(source: Dict[str, Any], language: str):
            if language and language in source and language not in candidates:
                candidates.append(language)

        # Legendas manuais costumam ser mais estáveis.
        add(manual, source_language)
        for language in ('pt-BR', 'pt-PT', 'pt', 'en-orig', 'en-US', 'en'):
            add(manual, language)
        for language in manual.keys():
            add(manual, language)

        # Em legendas automáticas, prioriza a faixa original para evitar
        # requisições extras de tradução que podem receber HTTP 429.
        original_auto = [lang for lang in automatic.keys() if lang.endswith('-orig')]
        if source_language:
            add(automatic, f"{source_language}-orig")
        for language in original_auto:
            add(automatic, language)
        add(automatic, source_language)
        for language in ('en-orig', 'en-US', 'en', 'pt-BR', 'pt-PT', 'pt'):
            add(automatic, language)
        for language in automatic.keys():
            add(automatic, language)

        # Evita bombardear o endpoint de legendas do YouTube.
        return candidates[:5]

    def _download_sync(self, url: str, ydl_opts: Dict[str, Any]):
        """Baixa o vídeo primeiro e a legenda separadamente, com fallbacks para YouTube."""
        browser = self.browser.lower() if self.browser else None
        platform = self.detect_platform(url)
        safe_title = (Path(ydl_opts.get('outtmpl', '')).name.replace('%(ext)s', '').rstrip('.') or 'video')
        subtitle_candidates = ydl_opts.get('subtitle_candidates') or []

        progress_callback = None
        if ydl_opts.get('progress_hooks'):
            original_hook = ydl_opts['progress_hooks'][0]
            if hasattr(original_hook, '__closure__') and original_hook.__closure__:
                try:
                    progress_callback = original_hook.__closure__[0].cell_contents
                except Exception:
                    progress_callback = None

        youtube_args = ["--extractor-args", "youtube:player_client=default,web_embedded"]

        video_base = [
            sys.executable, "-m", "yt_dlp",
            "--no-playlist",
            "--no-colors",
            "--format", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--output", f"{safe_title}.%(ext)s",
            "--progress",
            "--retries", "3"
        ]
        if platform == "youtube":
            video_base.extend(youtube_args)

        def run_command(label: str, cmd: list):
            full_cmd = cmd + [url]
            logger.info("[yt-dlp] %s", label)

            process = subprocess.Popen(
                full_cmd,
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
                    line = self._clean_error_text(output.strip())
                    output_lines.append(line)
                    logger.info("[yt-dlp] %s", line)
                    if progress_callback:
                        match = progress_pattern.search(line)
                        if match:
                            try:
                                progress = float(match.group(1))
                                progress_callback(f"Baixando vídeo... {progress:.1f}%", progress * 0.9)
                            except ValueError:
                                pass

            return process.poll(), output_lines

        # 1) Baixa o vídeo. Para vídeos públicos do YouTube, tenta sem cookies primeiro.
        video_attempts = [("Baixando vídeo sem cookies", list(video_base))]
        if browser:
            with_cookies = list(video_base)
            with_cookies.extend(["--cookies-from-browser", browser])
            video_attempts.append((f"Baixando vídeo com cookies de {browser}", with_cookies))

        video_errors = []
        video_ok = False

        for label, cmd in video_attempts:
            code, output_lines = run_command(label, cmd)
            if code == 0:
                video_ok = True
                break
            video_errors.extend(output_lines[-8:])

        if not video_ok:
            tail = self._clean_error_text(" ".join(video_errors[-10:]))
            if "The page needs to be reloaded" in tail:
                raise ProcessingError(
                    "O YouTube recusou a extração do vídeo. Atualize o yt-dlp e tente novamente."
                )
            raise ProcessingError(
                f"Não foi possível baixar o vídeo. {tail or 'O yt-dlp não retornou detalhes.'}"
            )

        if progress_callback:
            progress_callback("Vídeo baixado. Obtendo legenda...", 92)

        # 2) Baixa somente uma legenda por tentativa. Prioriza a faixa original.
        if not subtitle_candidates:
            raise ProcessingError(
                "Este vídeo não possui uma legenda manual ou automática disponível para o AutoClip."
            )

        subtitle_errors = []

        for language in subtitle_candidates:
            subtitle_base = [
                sys.executable, "-m", "yt_dlp",
                "--no-playlist",
                "--no-colors",
                "--skip-download",
                "--write-sub",
                "--write-auto-sub",
                "--sub-langs", language,
                "--sub-format", "srt/vtt/best",
                "--convert-subs", "srt",
                "--output", f"{safe_title}.%(ext)s",
                "--retries", "3",
                "--sleep-requests", "1"
            ]
            if platform == "youtube":
                subtitle_base.extend(youtube_args)

            subtitle_attempts = [(f"Baixando legenda '{language}'", list(subtitle_base))]
            if browser:
                with_cookies = list(subtitle_base)
                with_cookies.extend(["--cookies-from-browser", browser])
                subtitle_attempts.append(
                    (f"Baixando legenda '{language}' com cookies de {browser}", with_cookies)
                )

            for label, cmd in subtitle_attempts:
                if progress_callback:
                    progress_callback(f"Tentando legenda: {language}", 95)

                code, output_lines = run_command(label, cmd)
                if code == 0 and self._find_downloaded_subtitle(safe_title):
                    if progress_callback:
                        progress_callback("Legenda obtida com sucesso", 99)
                    logger.info("[yt-dlp] Legenda selecionada: %s", language)
                    return

                clean_lines = [self._clean_error_text(line) for line in output_lines[-8:]]
                subtitle_errors.extend(clean_lines)

                # Se o YouTube estiver limitando traduções, tenta outra faixa em vez de
                # abortar todo o projeto.
                if any("HTTP Error 429" in line or "Too Many Requests" in line for line in clean_lines):
                    logger.warning(
                        "[yt-dlp] Legenda '%s' recebeu HTTP 429; tentando o próximo idioma",
                        language
                    )
                    break

        tail = self._clean_error_text(" ".join(subtitle_errors[-10:]))
        if "HTTP Error 429" in tail or "Too Many Requests" in tail:
            raise ProcessingError(
                "O vídeo foi baixado, mas o YouTube limitou temporariamente o download das legendas (HTTP 429). "
                "Aguarde alguns minutos e tente novamente. O AutoClip tentou também a legenda original como fallback."
            )

        raise ProcessingError(
            "O vídeo foi baixado, mas não foi possível obter uma legenda compatível. "
            + (tail if tail else "")
        )

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
        
        # Prioriza legendas em português, depois inglês e chinês.
        preferred_suffixes = [
            '.pt-BR.srt', '.pt.srt', '.en.srt', '.en-US.srt',
            '.zh-Hans.srt', '.zh-CN.srt', '.zh.srt', '.ai-zh.srt'
        ]
        for suffix in preferred_suffixes:
            candidate = self.download_dir / f"{title}{suffix}"
            if candidate.exists():
                standard_path = self.download_dir / f"{title}.srt"
                if candidate != standard_path and not standard_path.exists():
                    candidate.rename(standard_path)
                    return standard_path
                return candidate

        # Compatibilidade com o formato antigo do Bilibili.
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