import axios from 'axios'
import { Project, Clip, Collection } from '../store/useProjectStore'

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Endereço do backend FastAPI
  timeout: 300000, // Timeout aumentado para 5 minutos
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de requisições
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor de respostas
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API Error:', error)
    
    // Tratamento especial para erro 429 (sistema ocupado)
    if (error.response?.status === 429) {
      const message = error.response?.data?.detail || 'O sistema está processando outro projeto. Tente novamente em instantes.'
      error.userMessage = message
    }
    // Trata erros de timeout
    else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.userMessage = 'A solicitação expirou, mas o projeto pode continuar processando. Verifique o status em instantes.'
    }
    // Trata erros de rede
    else if (error.code === 'NETWORK_ERROR' || !error.response) {
      error.userMessage = 'Falha na conexão de rede. Verifique sua conexão.'
    }
    // Trata erros do servidor
    else if (error.response?.status >= 500) {
      error.userMessage = 'Erro interno do servidor. Tente novamente mais tarde.'
    }
    
    return Promise.reject(error)
  }
)

export interface UploadFilesRequest {
  video_file: File
  srt_file?: File
  project_name: string
  video_category?: string
}

export interface VideoCategory {
  value: string
  name: string
  description: string
  icon: string
  color: string
}

export interface VideoCategoriesResponse {
  categories: VideoCategory[]
  default_category: string
}

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

// Tipos da API de importação por link
export interface BilibiliVideoInfo {
  bvid?: string
  title: string
  description: string
  duration: number
  uploader: string
  upload_date: string
  view_count: number
  thumbnail_url?: string
  webpage_url?: string
  platform?: 'youtube' | 'bilibili' | string
}

export interface BilibiliDownloadRequest {
  url: string
  project_name: string
  video_category?: string
  browser?: string
}

export interface BilibiliDownloadTask {
  task_id: string
  url: string
  project_name: string
  video_category?: string
  browser?: string
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'error' | 'failed'
  progress: number
  status_message?: string
  error_message?: string
  error?: string
  video_info?: BilibiliVideoInfo
  project_id?: string
  created_at: string
  updated_at: string
}

export interface SystemSettings {
  dashscope_api_key: string
  siliconflow_api_key: string
  openrouter_api_key: string
  api_provider: string
  model_name: string
  siliconflow_model: string
  openrouter_model: string
  chunk_size: number
  min_score_threshold: number
  max_clips_per_collection: number
  default_browser?: string | null
}

// API de configurações
export const settingsApi = {
  // Obtém as configurações do sistema
  getSettings: (): Promise<SystemSettings> => {
    return api.get('/settings')
  },

  // Atualiza as configurações do sistema
  updateSettings: (settings: SystemSettings): Promise<unknown> => {
    return api.post('/settings', settings)
  },

  // Testa a chave da API
  testApiKey: (apiKey: string, provider: string = 'dashscope', model?: string): Promise<{ success: boolean; error?: string }> => {
    return api.post('/settings/test-api-key', { 
      api_key: apiKey,
      provider: provider,
      model: model
    })
  }
}

// API de projetos
export const projectApi = {
  // Obtém as categorias de vídeo
  getVideoCategories: async (): Promise<VideoCategoriesResponse> => {
    return api.get('/video-categories')
  },

  // Obtém todos os projetos
  getProjects: async (): Promise<Project[]> => {
    return api.get('/projects')
  },

  // Obtém um projeto
  getProject: async (id: string): Promise<Project> => {
    return api.get(`/projects/${id}`)
  },

  // Envia arquivos e cria um projeto
  uploadFiles: async (data: UploadFilesRequest): Promise<Project> => {
    const formData = new FormData()
    formData.append('video_file', data.video_file)
    if (data.srt_file) {
      formData.append('srt_file', data.srt_file)
    }
    formData.append('project_name', data.project_name)
    if (data.video_category) {
      formData.append('video_category', data.video_category)
    }
    
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Exclui um projeto
  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },

  // Inicia o processamento do projeto
  startProcessing: async (id: string): Promise<void> => {
    await api.post(`/projects/${id}/process`)
  },

  // Tenta processar o projeto novamente
  retryProcessing: async (id: string): Promise<void> => {
    await api.post(`/projects/${id}/retry`)
  },

  // Obtém o status do processamento
  getProcessingStatus: async (id: string): Promise<ProcessingStatus> => {
    return api.get(`/projects/${id}/status`)
  },

  // Obtém os logs do projeto
  getProjectLogs: async (id: string, lines: number = 50): Promise<{logs: Array<{timestamp: string, module: string, level: string, message: string}>}> => {
    return api.get(`/projects/${id}/logs?lines=${lines}`)
  },

  // Reinicia uma etapa específica
  restartStep: async (id: string, step: number): Promise<void> => {
    await api.post(`/projects/${id}/restart-step`, { step })
  },

  // Atualiza as informações do clipe
  updateClip: (projectId: string, clipId: string, updates: Partial<Clip>): Promise<Clip> => {
    return api.patch(`/projects/${projectId}/clips/${clipId}`, updates)
  },

  // Cria uma coleção
  createCollection: (projectId: string, collectionData: { collection_title: string, collection_summary: string, clip_ids: string[] }): Promise<Collection> => {
    return api.post(`/projects/${projectId}/collections`, collectionData)
  },

  // Atualiza as informações da coleção
  updateCollection: (projectId: string, collectionId: string, updates: Partial<Collection>): Promise<Collection> => {
    return api.patch(`/projects/${projectId}/collections/${collectionId}`, updates)
  },

  // Exclui uma coleção
  deleteCollection: (projectId: string, collectionId: string): Promise<{message: string, deleted_collection: string}> => {
    return api.delete(`/projects/${projectId}/collections/${collectionId}`)
  },

  // Baixa o vídeo do clipe
  downloadClip: (projectId: string, clipId: string): Promise<Blob> => {
    return api.get(`/projects/${projectId}/clips/${clipId}/download`, {
      responseType: 'blob'
    })
  },

  // Baixa o vídeo da coleção
  downloadCollection: (projectId: string, collectionId: string): Promise<Blob> => {
    return api.get(`/projects/${projectId}/collections/${collectionId}/download`, {
      responseType: 'blob'
    })
  },

  // Exporta metadados
  exportMetadata: (projectId: string): Promise<Blob> => {
    return api.get(`/projects/${projectId}/export`, {
      responseType: 'blob'
    })
  },

  // Gera o vídeo da coleção
  generateCollectionVideo: (projectId: string, collectionId: string) => {
    return api.post(`/projects/${projectId}/collections/${collectionId}/generate`)
  },

  downloadVideo: async (projectId: string, clipId?: string, collectionId?: string) => {
    let url = `/projects/${projectId}/download`
    if (clipId) {
      url += `?clip_id=${clipId}`
    } else if (collectionId) {
      url += `?collection_id=${collectionId}`
    }
    
    try {
      // Para respostas blob, usa axios diretamente sem passar pelo interceptor
      const response = await axios.get(`http://localhost:8000/api${url}`, { 
        responseType: 'blob',
        headers: {
          'Accept': 'application/octet-stream'
        }
      })
      
      // Obtém o nome do arquivo pelos headers; usa um nome padrão se necessário
      const contentDisposition = response.headers['content-disposition']
      let filename = clipId ? `clip_${clipId}.mp4` : 
                     collectionId ? `collection_${collectionId}.mp4` : 
                     `project_${projectId}.mp4`
      
      if (contentDisposition) {
        // Tenta primeiro interpretar o parâmetro filename* no formato RFC 6266
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (filenameStarMatch) {
          filename = decodeURIComponent(filenameStarMatch[1])
        } else {
          // Fallback para o parâmetro filename tradicional
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      }
      
      // Cria o link de download
      const blob = new Blob([response.data], { type: 'video/mp4' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      
      // Inicia o download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      return response.data
    } catch (error) {
      console.error('Falha no download:', error)
      throw error
    }
  },

  // Baixa todos os arquivos do projeto em um pacote
  downloadProjectAll: async (projectId: string) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/projects/${projectId}/download-all`, { 
        responseType: 'blob',
        headers: {
          'Accept': 'application/zip'
        }
      })
      
      // Obtém o nome do arquivo pelos headers
      const contentDisposition = response.headers['content-disposition']
      let filename = `project_${projectId}_completo.zip`
      
      if (contentDisposition) {
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (filenameStarMatch) {
          filename = decodeURIComponent(filenameStarMatch[1])
        } else {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      }
      
      // Cria o link de download
      const blob = new Blob([response.data], { type: 'application/zip' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      
      // Inicia o download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      return response.data
    } catch (error) {
      console.error('打包Falha no download:', error)
      throw error
    }
  },

  // Obtém a URL de um arquivo do projeto
  getProjectFileUrl: (projectId: string, filePath: string): string => {
    return `http://localhost:8000/api/projects/${projectId}/files/${filePath}`
  },

  // Obtém a URL do vídeo do clipe
  getClipVideoUrl: (projectId: string, clipId: string): string => {
    // Usa diretamente o clipId e deixa o backend localizar o arquivo
    return `http://localhost:8000/api/projects/${projectId}/clips/${clipId}`
  },

  // Obtém a URL do vídeo da coleção
  getCollectionVideoUrl: (projectId: string, collectionId: string): string => {
    return `http://localhost:8000/api/projects/${projectId}/files/output/collections/${collectionId}.mp4`
  }
}

// API de importação por link
export const bilibiliApi = {
  // Obtém informações do vídeo por link
  parseVideoInfo: async (url: string, browser?: string): Promise<{success: boolean, video_info: BilibiliVideoInfo}> => {
    const formData = new FormData()
    formData.append('url', url)
    if (browser) {
      formData.append('browser', browser)
    }
    return api.post('/bilibili/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Cria a tarefa de download por link
  createDownloadTask: async (data: BilibiliDownloadRequest): Promise<BilibiliDownloadTask> => {
    return api.post('/bilibili/download', data)
  },

  // Obtém o status da tarefa de download
  getTaskStatus: async (taskId: string): Promise<BilibiliDownloadTask> => {
    return api.get(`/bilibili/tasks/${taskId}`)
  },

  // Obtém todas as tarefas de download
  getAllTasks: async (): Promise<BilibiliDownloadTask[]> => {
    return api.get('/bilibili/tasks')
  }
}

// API de status do sistema
export const systemApi = {
  // Obtém o status do sistema
  getSystemStatus: (): Promise<{
    current_processing_count: number
    max_concurrent_processing: number
    total_projects: number
    processing_projects: string[]
  }> => {
    return api.get('/system/status')
  }
}

export default api