import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Alert, 
  Spin, 
  Empty,
  message,
  Radio
} from 'antd'
import { 
  ArrowLeftOutlined, 
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useProjectStore } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import ClipCard from '../components/ClipCard'

import CollectionCardMini from '../components/CollectionCardMini'
import CollectionPreviewModal from '../components/CollectionPreviewModal'
import CreateCollectionModal from '../components/CreateCollectionModal'
import { useCollectionVideoDownload } from '../hooks/useCollectionVideoDownload'

const { Content } = Layout
const { Title, Text } = Typography


const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    currentProject, 
    loading, 
    error,
    setCurrentProject,
    updateCollection,
    addCollection,
    deleteCollection,
    removeClipFromCollection,
    reorderCollectionClips,
    addClipToCollection
  } = useProjectStore()
  
  const [statusLoading, setStatusLoading] = useState(false)
  const [showCreateCollection, setShowCreateCollection] = useState(false)
  const [sortBy, setSortBy] = useState<'time' | 'score'>('score')
  const [showCollectionDetail, setShowCollectionDetail] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<unknown>(null)
  const { generateAndDownloadCollectionVideo } = useCollectionVideoDownload()

  useEffect(() => {
    if (id) {
      // Só recarrega quando o store não tem currentProject ou o ID não corresponde ao atual
      if (!currentProject || currentProject.id !== id) {
        loadProject()
      }
      loadProcessingStatus()
    }
  }, [id, currentProject])



  const loadProject = async () => {
    if (!id) return
    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)
    } catch (error) {
      console.error('Failed to load project:', error)
      message.error('Falha ao carregar o projeto')
    }
  }

  const loadProcessingStatus = async () => {
    if (!id) return
    setStatusLoading(true)
    try {
      await projectApi.getProcessingStatus(id)
    } catch (error) {
      console.error('Failed to load processing status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleStartProcessing = async () => {
    if (!id) return
    try {
      await projectApi.startProcessing(id)
      message.success('Iniciar processamento')
      loadProcessingStatus()
    } catch (error) {
      console.error('Failed to start processing:', error)
      message.error('Falha ao iniciar o processamento')
    }
  }

  // Funções handleDownloadProject e handleExportMetadata removidas



  const handleCreateCollection = async (title: string, summary: string, clipIds: string[]) => {
    if (!currentProject) {
      message.error('As informações do projeto não existem')
      return
    }
    
    try {
      const newCollection = await projectApi.createCollection(currentProject.id, {
        collection_title: title,
        collection_summary: summary,
        clip_ids: clipIds
      })
      
      // Atualiza o estado pelo store em vez de recarregar
      addCollection(currentProject.id, newCollection)
      
      message.success('Coleção criada com sucesso')
      setShowCreateCollection(false)
    } catch (error) {
      console.error('Falha ao criar coleção:', error)
      message.error('Falha ao criar coleção')
    }
  }

  const handleViewCollection = (collection: unknown) => {
    setSelectedCollection(collection)
    setShowCollectionDetail(true)
  }

  const handleRemoveClipFromCollection = async (collectionId: string, clipId: string): Promise<void> => {
    if (!id) return
    try {
      await removeClipFromCollection(id, collectionId, clipId)
      message.success('Clipe removido com sucesso')
    } catch (error) {
      console.error('Failed to remove clip from collection:', error)
      message.error('Falha ao remover o clipe')
      throw error // Propaga novamente o erro para informar a falha ao chamador
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!id) return
    try {
      await projectApi.deleteCollection(id, collectionId)
      deleteCollection(id, collectionId)
      message.success('Coleção excluída com sucesso')
      // Se a coleção excluída estiver aberta, fecha a visualização
      if (selectedCollection?.id === collectionId) {
        setShowCollectionDetail(false)
        setSelectedCollection(null)
      }
    } catch (error) {
      console.error('Failed to delete collection:', error)
      message.error('Falha ao excluir a coleção')
    }
  }

  const handleReorderCollectionClips = async (collectionId: string, newClipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await reorderCollectionClips(id, collectionId, newClipIds)
      message.success('Ordem dos clipes atualizada com sucesso')
    } catch (error) {
      console.error('Failed to reorder collection clips:', error)
      message.error('Falha ao ajustar a ordem dos clipes')
      throw error // Propaga novamente o erro para informar a falha ao chamador
    }
  }

  const handleAddClipToCollection = async (collectionId: string, clipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await addClipToCollection(id, collectionId, clipIds)
      message.success(`${clipIds.length} clipes adicionados à coleção com sucesso`)
    } catch (error) {
      console.error('Failed to add clips to collection:', error)
      message.error('Falha ao adicionar clipes à coleção')
      throw error // Propaga novamente o erro para informar a falha ao chamador
    }
  }



  // Ordena os clipes de vídeo
  const getSortedClips = () => {
    if (!currentProject?.clips) return []
    
    const clips = [...currentProject.clips]
    
    if (sortBy === 'score') {
      return clips.sort((a, b) => b.final_score - a.final_score)
    } else {
      // Ordena por tempo convertendo a string para segundos
      return clips.sort((a, b) => {
        const getTimeInSeconds = (timeStr: string) => {
          const parts = timeStr.split(':')
          const hours = parseInt(parts[0])
          const minutes = parseInt(parts[1])
          const seconds = parseFloat(parts[2].replace(',', '.'))
          return hours * 3600 + minutes * 60 + seconds
        }
        
        const aTime = getTimeInSeconds(a.start_time)
        const bTime = getTimeInSeconds(b.start_time)
        return aTime - bTime
      })
    }
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </Content>
    )
  }

  if (error || !currentProject) {
    return (
      <Content style={{ padding: '24px' }}>
        <Alert
          message="Falha ao carregar"
          description={error || 'Projeto não encontrado'}
          type="error"
          action={
            <Button size="small" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          }
        />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px' }}>
      {/* Cabeçalho simplificado do projeto */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ padding: 0, marginBottom: '8px' }}
          >
            Voltar aos projetos
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {currentProject.name}
          </Title>
        </div>
        
        <Space>
          {currentProject.status === 'uploading' && (
            <Button 
              type="primary" 
              onClick={handleStartProcessing}
              loading={statusLoading}
            >
              Iniciar processamento
            </Button>
          )}
          
          {/* Remove os botões de exportação de dados e download do vídeo */}
        </Space>
      </div>

      {/* Conteúdo principal */}
      {currentProject.status === 'completed' ? (
        <div>
          {/* Área horizontal de coleções da IA */}
          {currentProject.collections && currentProject.collections.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>Coleções recomendadas pela IA</Title>
                  <Text type="secondary">
                    A IA recomendou {currentProject.collections.length} coleções temáticas
                  </Text>
                </div>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setShowCreateCollection(true)}
                  style={{
                    borderRadius: '8px',
                    background: 'linear-gradient(45deg, #1890ff, #36cfc9)',
                    border: 'none',
                    fontWeight: 500,
                    height: '40px',
                    padding: '0 20px',
                    fontSize: '14px'
                  }}
                >
                  Criar coleção
                </Button>
              </div>
              
              <div 
                className="collections-scroll-container"
                style={{ 
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  paddingBottom: '8px'
                }}
              >
                {currentProject.collections
                  .sort((a, b) => {
                    // Ordena pela data de criação, com os mais recentes primeiro
                    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
                    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
                    return timeB - timeA
                  })
                  .map((collection) => (
                  <CollectionCardMini
                    key={collection.id}
                    collection={collection}
                    clips={currentProject.clips || []}
                    onView={handleViewCollection}
                    onGenerateVideo={async (collectionId) => {
                      const collection = currentProject.collections.find(c => c.id === collectionId)
                      if (collection) {
                        await generateAndDownloadCollectionVideo(
                          currentProject.id, 
                          collectionId, 
                          collection.collection_title
                        )
                      }
                    }}
                    onDelete={handleDeleteCollection}
                  />
                ))}
              </div>
            </Card>
          )}
          
          {/* Área de clipes de vídeo */}
          <Card 
            style={{
              borderRadius: '16px',
              border: '1px solid #303030',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <Title level={4} style={{ margin: 0, color: '#ffffff', fontWeight: 600 }}>Clipes de vídeo</Title>
                <Text type="secondary" style={{ color: '#b0b0b0', fontSize: '14px' }}>
                  A IA gerou {currentProject.clips?.length || 0} clipes
                </Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Controles de ordenação otimizados para o tema escuro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Text style={{ fontSize: '13px', color: '#b0b0b0', fontWeight: 500 }}>Ordenar</Text>
                  <Radio.Group
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    size="small"
                    buttonStyle="solid"
                    style={{
                      ['--ant-radio-button-bg' as string]: 'transparent',
                      ['--ant-radio-button-checked-bg' as string]: '#1890ff',
                      ['--ant-radio-button-color' as string]: '#b0b0b0',
                      ['--ant-radio-button-checked-color' as string]: '#ffffff'
                    }}
                  >
                    <Radio.Button 
                       value="time" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'time' ? 'linear-gradient(45deg, #1890ff, #36cfc9)' : 'rgba(255,255,255,0.08)',
                         border: sortBy === 'time' ? '1px solid #1890ff' : '1px solid #404040',
                         color: sortBy === 'time' ? '#ffffff' : '#b0b0b0',
                         borderRadius: '6px 0 0 6px',
                         fontWeight: sortBy === 'time' ? 600 : 400,
                         boxShadow: sortBy === 'time' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       时间
                     </Radio.Button>
                     <Radio.Button 
                       value="score" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'score' ? 'linear-gradient(45deg, #1890ff, #36cfc9)' : 'rgba(255,255,255,0.08)',
                         border: sortBy === 'score' ? '1px solid #1890ff' : '1px solid #404040',
                         borderLeft: 'none',
                         color: sortBy === 'score' ? '#ffffff' : '#b0b0b0',
                         borderRadius: '0 6px 6px 0',
                         fontWeight: sortBy === 'score' ? 600 : 400,
                         boxShadow: sortBy === 'score' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       评分
                     </Radio.Button>
                  </Radio.Group>
                </div>
                
                {(!currentProject.collections || currentProject.collections.length === 0) && (
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setShowCreateCollection(true)}
                    style={{
                      borderRadius: '8px',
                      background: 'linear-gradient(45deg, #1890ff, #36cfc9)',
                      border: 'none',
                      fontWeight: 500,
                      height: '40px',
                      padding: '0 20px',
                      fontSize: '14px'
                    }}
                  >
                    Criar coleção
                  </Button>
                )}
              </div>
            </div>
            
            {currentProject.clips && currentProject.clips.length > 0 ? (
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px',
                  padding: '8px 0'
                }}
              >
                {getSortedClips().map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    videoUrl={projectApi.getClipVideoUrl(currentProject.id, clip.id, clip.generated_title || clip.title)}
                    onDownload={(clipId) => projectApi.downloadVideo(currentProject.id, clipId)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '60px 0',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px dashed #404040'
              }}>
                <Empty 
                  description={
                    <Text style={{ color: '#888', fontSize: '14px' }}>暂无Clipes de vídeo</Text>
                  }
                  image={<PlayCircleOutlined style={{ fontSize: '48px', color: '#555' }} />}
                />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <Empty 
            image={<PlayCircleOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
            description={
              <div>
                <Text>O projeto ainda não terminou o processamento</Text>
                <br />
                <Text type="secondary">处理完成后可查看Clipes de vídeo和AI合集</Text>
              </div>
            }
          />
        </Card>
      )}

      {/* Criar coleção模态框 */}
      <CreateCollectionModal
        visible={showCreateCollection}
        clips={currentProject.clips || []}
        onCancel={() => setShowCreateCollection(false)}
        onCreate={handleCreateCollection}
      />
      
      {/* Modal de prévia da coleção */}
      <CollectionPreviewModal
        visible={showCollectionDetail}
        collection={selectedCollection}
        clips={currentProject.clips || []}
        projectId={currentProject.id}
        onClose={() => {
          setShowCollectionDetail(false)
          setSelectedCollection(null)
        }}
        onUpdateCollection={(collectionId, updates) => 
          updateCollection(currentProject.id, collectionId, updates)
        }
        onRemoveClip={handleRemoveClipFromCollection}
        onReorderClips={handleReorderCollectionClips}
        onDelete={handleDeleteCollection}
        onAddClip={handleAddClipToCollection}
      />
    </Content>
  )
}

export default ProjectDetailPage