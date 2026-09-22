import { useState } from 'react'
import { message } from 'antd'
import { projectApi } from '../services/api'

export const useCollectionVideoDownload = () => {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateAndDownloadCollectionVideo = async (
    projectId: string, 
    collectionId: string
  ) => {
    if (isGenerating) return

    setIsGenerating(true)
    
    try {
      // Etapa 1: inicia a geração do vídeo
      message.info('Gerando vídeo da coleção...')
      await projectApi.generateCollectionVideo(projectId, collectionId)
      
      // Etapa 2: aguarda o backend concluir o arquivo e inicia o download
      message.success('Vídeo da coleção gerado com sucesso. Iniciando download...')
      
      setTimeout(async () => {
        try {
          await projectApi.downloadVideo(projectId, undefined, collectionId)
          message.success('Download do vídeo da coleção concluído')
        } catch (downloadError) {
          console.error('Falha no download:', downloadError)
          message.error('Falha no download. Tente novamente em instantes.')
        }
      }, 3000) // Aguarda o backend concluir a geração do arquivo
      
    } catch (error) {
      console.error('Falha ao gerar o vídeo da coleção:', error)
      message.error('Falha ao exportar o vídeo da coleção')
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    isGenerating,
    generateAndDownloadCollectionVideo
  }
} 