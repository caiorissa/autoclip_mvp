"""
Cliente OpenRouter usando a API compatível com OpenAI.
"""
import json
import logging
import os
from typing import Any

from openai import OpenAI

from .siliconflow_client import SiliconFlowClient

logger = logging.getLogger(__name__)


class OpenRouterClient(SiliconFlowClient):
    """Cliente OpenRouter compatível com a interface usada pelo pipeline."""

    def __init__(self, api_key: str = None, model: str = "qwen/qwen3.8-27b:free"):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model = model or "qwen/qwen3.8-27b:free"
        self.base_url = "https://openrouter.ai/api/v1"

        if not self.api_key:
            raise ValueError(
                "Configure a chave do OpenRouter em Configurações ou na variável OPENROUTER_API_KEY."
            )

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AutoClip"
            }
        )

    def call(self, prompt: str, input_data: Any = None) -> str:
        """Envia uma solicitação ao modelo configurado no OpenRouter."""
        try:
            if input_data:
                if isinstance(input_data, dict):
                    full_input = f"{prompt}\n\nConteúdo de entrada:\n{json.dumps(input_data, ensure_ascii=False, indent=2)}"
                else:
                    full_input = f"{prompt}\n\nConteúdo de entrada:\n{input_data}"
            else:
                full_input = prompt

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": full_input}],
                stream=False
            )

            if response and response.choices:
                content = response.choices[0].message.content
                if content:
                    return content

            raise RuntimeError("O OpenRouter não retornou uma resposta válida.")
        except Exception as exc:
            logger.error("Falha na chamada ao OpenRouter: %s", exc)
            raise

    def call_with_retry(self, prompt: str, input_data: Any = None, max_retries: int = 3) -> str:
        """Executa chamadas com tentativas adicionais para falhas temporárias."""
        import time

        for attempt in range(max_retries):
            try:
                return self.call(prompt, input_data)
            except ValueError:
                raise
            except Exception:
                if attempt == max_retries - 1:
                    raise
                time.sleep(2 ** attempt)

        return ""
