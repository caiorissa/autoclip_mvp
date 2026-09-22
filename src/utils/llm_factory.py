"""
LLM客户端工厂 - 根据配置选择使用通义千问或硅基流动API
"""
import logging
from typing import Optional, Union
from .llm_client import LLMClient
from .siliconflow_client import SiliconFlowClient
from .openrouter_client import OpenRouterClient
from ..config import config_manager

logger = logging.getLogger(__name__)

class LLMFactory:
    """LLM客户端工厂"""
    
    @staticmethod
    def create_client(provider: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None) -> Union[LLMClient, SiliconFlowClient, OpenRouterClient]:
        """
        创建LLM客户端
        
        Args:
            provider: Provedor de API: dashscope, siliconflow ou openrouter
            api_key: API密钥
            model: 模型名称
            
        Returns:
            LLM客户端实例
        """
        # 如果没有指定provider，从配置中获取
        if provider is None:
            provider = config_manager.settings.api_provider
        

        
        if provider == "dashscope":
            # 使用通义千问API
            if api_key is None:
                api_key = config_manager.settings.dashscope_api_key
            if model is None:
                model = config_manager.settings.model_name
            
            logger.info(f"创建通义千问客户端，模型: {model}")
            return LLMClient(api_key=api_key, model=model)
            
        elif provider == "siliconflow":
            if api_key is None:
                api_key = config_manager.settings.siliconflow_api_key
            if model is None:
                model = config_manager.settings.siliconflow_model

            logger.info(f"Criando cliente SiliconFlow, modelo: {model}")
            return SiliconFlowClient(api_key=api_key, model=model)

        elif provider == "openrouter":
            if api_key is None:
                api_key = config_manager.settings.openrouter_api_key
            if model is None:
                model = config_manager.settings.openrouter_model

            logger.info(f"Criando cliente OpenRouter, modelo: {model}")
            return OpenRouterClient(api_key=api_key, model=model)

        else:
            raise ValueError(
                f"Provedor de API não suportado: {provider}. "
                "Use dashscope, siliconflow ou openrouter."
            )
    
    @staticmethod
    def get_default_client() -> Union[LLMClient, SiliconFlowClient, OpenRouterClient]:
        """
        获取默认的LLM客户端
        
        Returns:
            默认LLM客户端实例
        """
        return LLMFactory.create_client()
    
    @staticmethod
    def test_connection(provider: str, api_key: str, model: Optional[str] = None) -> bool:
        """
        测试API连接
        
        Args:
            provider: API提供商
            api_key: API密钥
            model: 模型名称
            
        Returns:
            连接是否成功
        """
        try:
            logger.info(f"开始测试API连接: provider={provider}, model={model}")
            client = LLMFactory.create_client(provider=provider, api_key=api_key, model=model)
            # 发送一个简单的测试请求
            test_response = client.call("请简单回复'测试成功'", "这是一个连接测试")
            logger.info(f"API测试响应: {test_response[:100]}...")
            
            # 只要API返回了响应就认为连接成功
            if test_response and len(test_response.strip()) > 0:
                logger.info("API连接测试成功")
                return True
            else:
                logger.warning("API返回空响应")
                return False
        except Exception as e:
            logger.error(f"API连接测试失败: {e}")
            return False 