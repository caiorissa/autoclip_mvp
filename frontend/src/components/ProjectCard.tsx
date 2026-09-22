import React, { useState, useEffect } from 'react'
import { Card, Tag, Button, Space, Typography, Popconfirm, message, Tooltip } from 'antd'
import { PlayCircleOutlined, DeleteOutlined, DownloadOutlined, ReloadOutlined, LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Project } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

const { Text } = Typography

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRetry?: (id: string) => void
  onClick?: () => void
}

interface LogEntry {
  timestamp: string
  module: string
  level: string
  message: string
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onRetry, onClick }) => {
  const navigate = useNavigate()
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentLogIndex, setCurrentLogIndex] = useState(0)

  // Obtém informações da categoria
  const getCategoryInfo = (category?: string) => {
    const categoryMap: Record<string, { name: string; icon: string; color: string }> = {
      'default': { name: 'Padrão', icon: '🎬', color: '#4facfe' },
      'knowledge': { name: 'Conhecimento', icon: '📚', color: '#52c41a' },
      'business': { name: 'Negócios e finanças', icon: '💼', color: '#faad14' },
      'opinion': { name: 'Opinião e comentários', icon: '💭', color: '#722ed1' },
      'experience': { name: 'Experiências e dicas', icon: '🌟', color: '#13c2c2' },
      'speech': { name: 'Palestras e entrevistas', icon: '🎤', color: '#eb2f96' },
      'content_review': { name: 'Análise de conteúdo', icon: '🎭', color: '#f5222d' },
      'entertainment': { name: 'Entretenimento', icon: '🎪', color: '#fa8c16' }
    }
    return categoryMap[category || 'default'] || categoryMap['default']
  }

  // Gerenciamento do cache de miniaturas
  const thumbnailCacheKey = `thumbnail_${project.id}`
  
  // Gera a miniatura do vídeo do projeto com cache
  useEffect(() => {
    const generateThumbnail = async () => {
      if (!project.video_path) return
      
      // Verifica o cache
      const cachedThumbnail = localStorage.getItem(thumbnailCacheKey)
      if (cachedThumbnail) {
        setVideoThumbnail(cachedThumbnail)
        return
      }
      
      setThumbnailLoading(true)
      
      try {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        
        const videoUrl = projectApi.getProjectFileUrl(project.id, 'input/input.mp4')
        
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(5, video.duration / 4) // Captura um quadro em 1/4 do vídeo ou aos 5 segundos
        }
        
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            
            // Define um tamanho adequado para a miniatura
            const maxWidth = 320
            const maxHeight = 180
            const aspectRatio = video.videoWidth / video.videoHeight
            
            let width = maxWidth
            let height = maxHeight
            
            if (aspectRatio > maxWidth / maxHeight) {
              height = maxWidth / aspectRatio
            } else {
              width = maxHeight * aspectRatio
            }
            
            canvas.width = width
            canvas.height = height
            ctx.drawImage(video, 0, 0, width, height)
            
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
            setVideoThumbnail(thumbnail)
            
            // Salva a miniatura no cache
            try {
              localStorage.setItem(thumbnailCacheKey, thumbnail)
            } catch (e) {
              // Se o localStorage estiver cheio, remove caches antigos
              const keys = Object.keys(localStorage).filter(key => key.startsWith('thumbnail_'))
              if (keys.length > 50) { // Mantém no máximo 50 miniaturas em cache
                keys.slice(0, 10).forEach(key => localStorage.removeItem(key))
                localStorage.setItem(thumbnailCacheKey, thumbnail)
              }
            }
          } catch (error) {
            console.error('Falha ao gerar miniatura:', error)
          } finally {
            setThumbnailLoading(false)
          }
        }
        
        video.onerror = (error) => {
          console.error('Falha ao carregar vídeo:', error)
          setThumbnailLoading(false)
        }
        
        video.src = videoUrl
      } catch (error) {
        console.error('Erro ao gerar miniatura:', error)
        setThumbnailLoading(false)
      }
    }
    
    generateThumbnail()
  }, [project.id, project.video_path, thumbnailCacheKey])

  // Obtém os logs do projeto apenas durante o processamento
  useEffect(() => {
    if (project.status !== 'processing') {
      setLogs([])
      return
    }

    const fetchLogs = async () => {
      try {
        const response = await projectApi.getProjectLogs(project.id, 20)
        setLogs(response.logs.filter(log => 
          log.message.includes('Step') || 
          log.message.includes('inici') || 
          log.message.includes('conclu') ||
          log.message.includes('process') ||
          log.level === 'ERROR'
        ))
      } catch (error) {
        console.error('Falha ao obter logs:', error)
      }
    }

    // Executa uma consulta imediatamente
    fetchLogs()
    
    // Atualiza os logs a cada 3 segundos
    const logInterval = setInterval(fetchLogs, 3000)
    
    return () => clearInterval(logInterval)
  }, [project.id, project.status])

  // Rotação dos logs
  useEffect(() => {
    if (logs.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentLogIndex(prev => (prev + 1) % logs.length)
    }, 2000) // Alterna uma mensagem de log a cada 2 segundos
    
    return () => clearInterval(interval)
  }, [logs.length])





  const handleRetry = async () => {
    if (isRetrying) return
    
    setIsRetrying(true)
    try {
      await projectApi.retryProcessing(project.id)
      message.success('Nova tentativa de processamento iniciada')
      if (onRetry) {
        onRetry(project.id)
      }
    } catch (error) {
      console.error('Falha ao tentar novamente:', error)
      message.error('Falha ao tentar novamente. Tente mais tarde.')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Card
      hoverable
      className="project-card"
      style={{ 
        width: 200, 
        height: 240,
        borderRadius: '4px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        marginBottom: '0px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
      bodyStyle={{
        padding: '12px',
        background: 'transparent',
        height: 'calc(100% - 120px)',
        display: 'flex',
        flexDirection: 'column'
      }}
      cover={
        <div 
          style={{ 
            height: 120, 
            position: 'relative',
            background: videoThumbnail 
              ? `url(${videoThumbnail}) center/cover` 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          onClick={() => {
            if (onClick) {
              onClick()
            } else {
              navigate(`/project/${project.id}`)
            }
          }}
        >
          {/* Estado de carregamento da miniatura */}
          {thumbnailLoading && (
            <div style={{ 
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <LoadingOutlined 
                style={{ 
                  fontSize: '24px', 
                  marginBottom: '4px'
                }} 
              />
              <div style={{ 
                fontSize: '12px',
                fontWeight: 500
              }}>
                Gerando capa...
              </div>
            </div>
          )}
          
          {/* Exibição padrão quando não há miniatura */}
          {!videoThumbnail && !thumbnailLoading && (
            <div style={{ textAlign: 'center' }}>
              <PlayCircleOutlined 
                style={{ 
                  fontSize: '40px', 
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '4px',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                }} 
              />
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '12px',
                fontWeight: 500
              }}>
                Clique para visualizar
              </div>
            </div>
          )}
          
          {/* Etiqueta da categoria — canto superior esquerdo */}
          {project.video_category && project.video_category !== 'default' && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px'
            }}>
              <Tag
                style={{
                  background: `${getCategoryInfo(project.video_category).color}15`,
                  border: `1px solid ${getCategoryInfo(project.video_category).color}40`,
                  borderRadius: '3px',
                  color: getCategoryInfo(project.video_category).color,
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '2px 6px',
                  lineHeight: '14px',
                  height: '18px',
                  margin: 0
                }}
              >
                <span style={{ marginRight: '2px' }}>{getCategoryInfo(project.video_category).icon}</span>
                {getCategoryInfo(project.video_category).name}
              </Tag>
            </div>
          )}
          
          {/* Remove o indicador de status do canto superior direito por ser redundante */}
          
          {/* Data de atualização e ações — movidas para a parte inferior da capa */}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0',
            padding: '6px 8px',
            height: '28px'
          }}>
            <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {dayjs(project.updated_at).fromNow()}
            </Text>
            
            {/* Botões de ação */}
            <div 
              className="card-action-buttons"
              style={{
                display: 'flex',
                gap: '4px',
                opacity: 0,
                transition: 'opacity 0.3s ease'
              }}
            >
              {/* Estado de falha: mostra apenas tentar novamente e excluir */}
              {project.status === 'error' ? (
                <>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={isRetrying}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    style={{
                      height: '20px',
                      width: '20px',
                      borderRadius: '3px',
                      color: '#52c41a',
                      border: '1px solid rgba(82, 196, 26, 0.5)',
                      background: 'rgba(82, 196, 26, 0.1)',
                      padding: 0,
                      minWidth: '20px',
                      fontSize: '10px'
                    }}
                  />
                  
                  <Popconfirm
                    title="Tem certeza de que deseja excluir este projeto?"
                    description="Esta ação não pode ser desfeita"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      onDelete(project.id)
                    }}
                    onCancel={(e) => {
                      e?.stopPropagation()
                    }}
                    okText="Confirmar"
                    cancelText="Cancelar"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      style={{
                        height: '20px',
                        width: '20px',
                        borderRadius: '3px',
                        color: '#ff6b6b',
                        border: '1px solid rgba(255, 107, 107, 0.5)',
                        background: 'rgba(255, 107, 107, 0.1)',
                        padding: 0,
                        minWidth: '20px',
                        fontSize: '10px'
                      }}
                    />
                  </Popconfirm>
                </>
              ) : (
                /* Outros estados: mostra baixar e excluir */
                <>
                  <Space size={4}>
                    {/* Botão de download — somente quando concluído */}
                    {project.status === 'completed' && (
                      <Tooltip title="Baixar todos os arquivos em ZIP" placement="top">
                        <Button
                          type="text"
                          icon={<DownloadOutlined />}
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              message.loading('Preparando download...', 0)
                              await projectApi.downloadProjectAll(project.id)
                              message.destroy()
                              message.success('Download concluído!')
                            } catch (error) {
                              message.destroy()
                              console.error('Falha no download:', error)
                              message.error('Falha no download. Tente novamente mais tarde.')
                            }
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: 0,
                            minWidth: '20px',
                            fontSize: '10px'
                          }}
                        />
                      </Tooltip>
                    )}
                    
                    {/* Botão de excluir */}
                    <Popconfirm
                      title="Tem certeza de que deseja excluir este projeto?"
                      description="Esta ação não pode ser desfeita"
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        onDelete(project.id)
                      }}
                      onCancel={(e) => {
                        e?.stopPropagation()
                      }}
                      okText="Confirmar"
                      cancelText="Cancelar"
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: 0,
                          minWidth: '20px',
                          fontSize: '10px'
                        }}
                      />
                    </Popconfirm>
                  </Space>
                 </>
               )}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Exibe logs em tempo real somente durante o processamento */}
          {project.status === 'processing' && logs.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '3px',
                  padding: '6px 8px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <LoadingOutlined style={{ color: '#667eea', fontSize: '12px' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Text style={{ 
                      fontSize: '10px', 
                      color: '#ffffff',
                      lineHeight: '12px',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {logs[currentLogIndex]?.message || 'Processando...'}
                    </Text>
                    <Text style={{ 
                      fontSize: '9px', 
                      color: '#999999',
                      lineHeight: '10px'
                    }}>
                      {logs[currentLogIndex]?.timestamp ? 
                        dayjs(logs[currentLogIndex].timestamp).format('HH:mm:ss') : 
                        ''
                      }
                    </Text>
                  </div>
                  {logs.length > 1 && (
                    <div style={{
                      display: 'flex',
                      gap: '2px'
                    }}>
                      {logs.slice(0, Math.min(3, logs.length)).map((_, index) => (
                        <div
                          key={index}
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: index === currentLogIndex % Math.min(3, logs.length) ? '#667eea' : 'rgba(255, 255, 255, 0.3)',
                            transition: 'background 0.3s'
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
            </div>
          )}
          
          {/* Nome do projeto */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Tooltip title={project.name} placement="top">
              <Text 
                strong 
                style={{ 
                  fontSize: '13px', 
                  color: '#ffffff',
                  fontWeight: 600,
                  lineHeight: '16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'help',
                  height: '32px'
                }}
              >
                {project.name}
              </Text>
            </Tooltip>
          </div>
          
          {/* Status e estatísticas */}
          <div style={{ 
            display: 'flex', 
            gap: '6px'
          }}>
            {/* Exibição do status */}
            <div style={{
              background: project.status === 'completed' ? 'rgba(82, 196, 26, 0.15)' :
                         project.status === 'processing' ? 'rgba(24, 144, 255, 0.15)' :
                         project.status === 'error' ? 'rgba(255, 77, 79, 0.15)' :
                         'rgba(217, 217, 217, 0.15)',
              border: project.status === 'completed' ? '1px solid rgba(82, 196, 26, 0.3)' :
                      project.status === 'processing' ? '1px solid rgba(24, 144, 255, 0.3)' :
                      project.status === 'error' ? '1px solid rgba(255, 77, 79, 0.3)' :
                      '1px solid rgba(217, 217, 217, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ 
                color: project.status === 'completed' ? '#52c41a' :
                       project.status === 'processing' ? '#1890ff' :
                       project.status === 'error' ? '#ff4d4f' :
                       '#d9d9d9',
                fontSize: '12px', 
                fontWeight: 600, 
                lineHeight: '14px' 
              }}>
                {project.status === 'processing' && project.current_step && project.total_steps 
                  ? `${Math.round((project.current_step / project.total_steps) * 100)}%`
                  : project.status === 'completed' ? '✓'
                  : project.status === 'error' ? '✗'
                  : '○'
                }
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                {project.status === 'completed' ? 'Concluído' :
                 project.status === 'processing' ? 'Processando' :
                 project.status === 'error' ? 'Falha' :
                 'Aguardando'
                }
              </div>
            </div>
            
            {/* Quantidade de clipes */}
            <div style={{
              background: 'rgba(102, 126, 234, 0.15)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ color: '#667eea', fontSize: '12px', fontWeight: 600, lineHeight: '14px' }}>
                {project.clips?.length || 0}
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                Clipes
              </div>
            </div>
            
            {/* Quantidade de coleções */}
            <div style={{
              background: 'rgba(118, 75, 162, 0.15)',
              border: '1px solid rgba(118, 75, 162, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ color: '#764ba2', fontSize: '12px', fontWeight: 600, lineHeight: '14px' }}>
                {project.collections?.length || 0}
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                Coleções
              </div>
            </div>
          </div>

        </div>
      </div>
    </Card>
  )
}

export default ProjectCard