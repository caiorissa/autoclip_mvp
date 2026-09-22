import React, { useState, useEffect } from 'react'
import { Button, message, Progress, Input, Card, Typography, Space, Spin, Alert } from 'antd'
import { DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { projectApi, bilibiliApi, VideoCategory, BilibiliDownloadTask, BilibiliVideoInfo, BilibiliDownloadRequest } from '../services/api'


const { Text } = Typography

interface BilibiliDownloadProps {
  onDownloadSuccess?: (projectId: string) => void
}

// Usa o tipo BilibiliDownloadTask importado da API

const BilibiliDownload: React.FC<BilibiliDownloadProps> = ({ onDownloadSuccess }) => {
  const [url, setUrl] = useState('')
  const [projectName, setProjectName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [currentTask, setCurrentTask] = useState<BilibiliDownloadTask | null>(null)
  const [pollingInterval, setPollingInterval] = useState<number | null>(null)
  const [videoInfo, setVideoInfo] = useState<BilibiliVideoInfo | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [defaultBrowser, setDefaultBrowser] = useState<string>('')
  


  // Obtém o navegador padrão das configurações
  const loadDefaultBrowser = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const settings = await response.json()
        setDefaultBrowser(settings.default_browser || '')
      }
    } catch (error) {
      console.error('Falha ao obter a configuração do navegador padrão:', error)
    }
  }

  // Carrega as categorias de vídeo e o navegador padrão
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true)
      try {
        const response = await projectApi.getVideoCategories()
        setCategories(response.categories)
        if (response.default_category) {
          setSelectedCategory(response.default_category)
        } else if (response.categories.length > 0) {
          setSelectedCategory(response.categories[0].value)
        }
      } catch (error) {
        console.error('Failed to load video categories:', error)
        message.error('Falha ao carregar as categorias de vídeo')
      } finally {
        setLoadingCategories(false)
      }
    }

    loadCategories()
    loadDefaultBrowser()
  }, [])

  // Limpa o polling
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const validateVideoUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl.trim())
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '')

      if (host === 'youtu.be') {
        return parsed.pathname.split('/').filter(Boolean)[0]?.length >= 6
      }

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (parsed.pathname === '/watch') {
          return (parsed.searchParams.get('v') || '').length >= 6
        }

        const parts = parsed.pathname.split('/').filter(Boolean)
        return ['shorts', 'live', 'embed'].includes(parts[0]) && (parts[1] || '').length >= 6
      }

      if (host === 'b23.tv') {
        return parsed.pathname.split('/').filter(Boolean).length > 0
      }

      if (host === 'bilibili.com') {
        return /^\/video\/(BV[0-9A-Za-z]+|av\d+)/i.test(parsed.pathname)
      }

      return false
    } catch {
      return false
    }
  }

  const parseVideoInfo = async () => {
    if (!url.trim()) {
      setError('Insira um link de vídeo válido')
      return
    }

    if (!validateVideoUrl(url.trim())) {
      setError('Insira um link de vídeo válido')
      return
    }

    setParsing(true)
    setError('') // Limpa a mensagem de erro anterior
    
    try {
      const requestBody: { url: string; browser?: string } = { url: url.trim() }
      if (defaultBrowser) {
        requestBody.browser = defaultBrowser
      }

      const response = await bilibiliApi.parseVideoInfo(url.trim(), defaultBrowser)
      const parsedVideoInfo = response.video_info
      
      setVideoInfo(parsedVideoInfo)
      setError('') // Análise concluída; limpa a mensagem de erro
      
      // Preenche automaticamente o nome do projeto
      if (!projectName && parsedVideoInfo.title) {
        setProjectName(parsedVideoInfo.title)
      }
      
      return parsedVideoInfo
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { detail?: string } }
        userMessage?: string
        message?: string
      }

      const detail =
        apiError.response?.data?.detail ||
        apiError.userMessage ||
        apiError.message ||
        'Não foi possível obter as informações deste vídeo.'

      setError(detail)
      setVideoInfo(null)
    } finally {
      setParsing(false)
    }
  }

  const startPolling = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const task = await bilibiliApi.getTaskStatus(taskId)
        setCurrentTask(task)
        
        if (task.status === 'completed') {
          clearInterval(interval)
          setPollingInterval(null)
          setDownloading(false)
          message.success('Download do vídeo concluído e projeto criado com sucesso!')
          
          if (task.project_id && onDownloadSuccess) {
            onDownloadSuccess(task.project_id)
          }
          
          // Redefine o estado
          resetForm()
        } else if ((task.status === 'failed' || task.status === 'error')) {
          clearInterval(interval)
          setPollingInterval(null)
          setDownloading(false)
          message.error(`Falha no download: ${task.error_message || task.error || 'Erro desconhecido'}`)
        }
      } catch (error: unknown) {
        console.error('Falha ao consultar o status da tarefa:', error)
      }
    }, 2000)
    
    setPollingInterval(interval)
  }

  const handleDownload = async () => {
    if (!url.trim()) {
      message.error('Insira um link do YouTube ou Bilibili')
      return
    }

    if (!validateVideoUrl(url.trim())) {
      message.error('Insira um link válido do YouTube ou Bilibili')
      return
    }

    setDownloading(true)
    
    try {
      const requestBody: BilibiliDownloadRequest = {
        url: url.trim(),
        project_name: projectName.trim() || 'Projeto sem nome',
        video_category: selectedCategory
      }
      
      if (defaultBrowser) {
        requestBody.browser = defaultBrowser
      }

      const response = await bilibiliApi.createDownloadTask(requestBody)
      message.success('Tarefa de download criada com sucesso. Processando...')
      
      setCurrentTask({
        task_id: response.task_id,
        url: url.trim(),
        project_name: projectName.trim() || '',
        video_category: selectedCategory,
        browser: defaultBrowser,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      // Inicia o polling do status da tarefa
      startPolling(response.task_id)
      
    } catch (error: unknown) {
      setDownloading(false)
      const errorMessage = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (error as Error)?.message || 'Falha ao criar a tarefa de download'
      message.error(errorMessage)
    }
  }

  const resetForm = () => {
    setUrl('')
    setProjectName('')
    setCurrentTask(null)
    setVideoInfo(null)
    if (categories.length > 0) {
      setSelectedCategory(categories[0].value)
    }
  }

  const stopDownload = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    setDownloading(false)
    setCurrentTask(null)
    message.info('Monitoramento do download interrompido')
  }

  return (
    <div style={{
      width: '100%',
      margin: '0 auto'
    }}>

      {/* Formulário de entrada */}
      <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Input.TextArea
              placeholder="Cole um link do YouTube ou Bilibili. Ex.: https://youtu.be/... • https://www.youtube.com/watch?v=... • https://www.bilibili.com/video/BV..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                // Limpa o resultado anterior e as mensagens de erro
                if (videoInfo) {
                  setVideoInfo(null)
                  setProjectName('')
                }
                if (error) {
                  setError('')
                }
              }}
              onBlur={() => {
                // Analisa automaticamente ao perder o foco
                if (url.trim() && !videoInfo && validateVideoUrl(url.trim())) {
                  parseVideoInfo();
                }
              }}
              style={{
                background: 'rgba(38, 38, 38, 0.8)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                resize: 'none'
              }}
              rows={2}
              disabled={downloading || parsing}
            />
            {parsing && (
               <div style={{
                 marginTop: '8px',
                 color: '#4facfe',
                 fontSize: '14px',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px'
               }}>
                 <span>Analisando informações do vídeo...</span>
               </div>
             )}
             {error && !parsing && (
               <div style={{
                 marginTop: '8px',
                 color: '#ff6b6b',
                 fontSize: '14px',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px'
               }}>
                 <span>{error}</span>
               </div>
             )}
          </div>
          
          {/* Exibe as informações do vídeo analisado */}
          {videoInfo && (
            <div style={{
              background: 'rgba(102, 126, 234, 0.1)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <Text style={{ color: '#667eea', fontWeight: 600, fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                Informações do vídeo carregadas com sucesso
              </Text>
              <Text style={{ color: '#ffffff', fontSize: '14px', display: 'block' }}>
                {videoInfo.title}
              </Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                Autor: {videoInfo.uploader || 'Desconhecido'} • Duração: {videoInfo.duration ? `${Math.floor(videoInfo.duration / 60)}:${String(Math.floor(videoInfo.duration % 60)).padStart(2, '0')}` : 'Desconhecido'}
              </Text>
            </div>
          )}
          
          {/* Só exibe nome e categoria após a análise do vídeo */}
          {videoInfo && (
            <>
              <div>
                <Text style={{ color: '#ffffff', marginBottom: '12px', display: 'block', fontSize: '16px', fontWeight: 500 }}>Nome do projeto (opcional)</Text>
                <Input
                  placeholder="Deixe em branco para usar o título do vídeo como nome do projeto"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    background: 'rgba(38, 38, 38, 0.8)',
                    border: '1px solid rgba(79, 172, 254, 0.3)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    height: '48px',
                    fontSize: '14px'
                  }}
                  disabled={downloading}
                />
              </div>
              
              {defaultBrowser && (
                <div>
                  <Alert
                    message="Configuração do navegador"
                    description={`Será usado o ${defaultBrowser} para acessar sua sessão quando necessário. Para alterar, configure o navegador padrão em Configurações.`}
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    style={{
                      background: 'rgba(79, 172, 254, 0.1)',
                      border: '1px solid rgba(79, 172, 254, 0.3)',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}
                  />
                </div>
              )}
              
              <div>
                <Text style={{ color: '#ffffff', marginBottom: '12px', display: 'block', fontSize: '16px', fontWeight: 500 }}>Categoria do vídeo</Text>
                {loadingCategories ? (
                  <Spin size="small" />
                ) : (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {categories.map(category => {
                      const isSelected = selectedCategory === category.value
                      return (
                        <div
                          key={category.value}
                          onClick={() => setSelectedCategory(category.value)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: isSelected 
                              ? `2px solid ${category.color}` 
                              : '2px solid rgba(255, 255, 255, 0.1)',
                            background: isSelected 
                              ? `${category.color}25` 
                              : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                            boxShadow: isSelected 
                              ? `0 0 12px ${category.color}40` 
                              : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 400,
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                            }
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>{category.icon}</span>
                          <span>{category.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </Space>
      </div>

      {/* Botões de ação — exibidos somente após a análise */}
      {videoInfo && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            loading={downloading}
            disabled={!url.trim()}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '12px',
              height: '48px',
              padding: '0 32px',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(79, 172, 254, 0.3)',
              minWidth: '160px'
            }}
          >
            {downloading ? 'Importando...' : 'Iniciar importação'}
          </Button>
          
          {downloading && (
            <Button
              onClick={stopDownload}
              size="large"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                borderRadius: '12px',
                height: '48px',
                padding: '0 24px',
                fontSize: '14px'
              }}
            >
              Parar monitoramento
            </Button>
          )}
        </div>
      )}

      {/* Progresso do download */}
      {currentTask && (
        <Card
          style={{
            background: 'rgba(38, 38, 38, 0.8)',
            border: '1px solid rgba(79, 172, 254, 0.3)',
            borderRadius: '12px',
            marginTop: '16px',
            backdropFilter: 'blur(10px)'
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <div style={{ marginBottom: '16px' }}>
            <Text style={{ color: '#ffffff', fontWeight: 600, fontSize: '18px' }}>Progresso da importação</Text>
          </div>
          
          {currentTask.video_info && (
            <div style={{ marginBottom: '16px' }}>
              <Text style={{ color: '#4facfe', fontWeight: 600, fontSize: '16px' }}>{currentTask.video_info.title}</Text>
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Text style={{ color: '#cccccc', fontSize: '14px' }}>Status: {currentTask.status === 'error' || currentTask.status === 'failed' ? 'erro' : currentTask.status === 'completed' ? 'concluído' : currentTask.status === 'processing' ? 'processando' : currentTask.status === 'downloading' ? 'baixando' : 'aguardando'}</Text>
              <Text style={{ color: '#cccccc', fontSize: '14px' }}>{Math.round(currentTask.progress)}%</Text>
            </div>
            
            <Progress
              percent={Math.round(currentTask.progress)}
              status={(currentTask.status === 'failed' || currentTask.status === 'error') ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#4facfe',
                '100%': '#00f2fe'
              }}
              trailColor="rgba(255, 255, 255, 0.1)"
              strokeWidth={8}
              showInfo={false}
            />
          </div>
          
          {(currentTask.error_message || currentTask.error) && (
            <div style={{ 
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255, 77, 79, 0.1)',
              border: '1px solid rgba(255, 77, 79, 0.3)',
              borderRadius: '8px'
            }}>
              <Text style={{ color: '#ff4d4f', fontSize: '14px' }}>Erro: {(currentTask.error_message || currentTask.error)}</Text>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default BilibiliDownload