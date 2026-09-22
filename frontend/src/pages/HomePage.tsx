import React, { useState, useEffect } from 'react'
import { 
  Layout, 
  Typography, 
  Select, 
  Spin, 
  Empty,
  message 
} from 'antd'
import { useNavigate } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import FileUpload from '../components/FileUpload'
import BilibiliDownload from '../components/BilibiliDownload'

import { projectApi } from '../services/api'
import { Project, useProjectStore } from '../store/useProjectStore'
import { useProjectPolling } from '../hooks/useProjectPolling'

const { Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { projects, setProjects, deleteProject, loading, setLoading } = useProjectStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'upload' | 'bilibili'>('upload')

  // Usa o hook de polling de projetos
  const { refreshNow } = useProjectPolling({
    onProjectsUpdate: (updatedProjects) => {
      setProjects(updatedProjects || [])
    },
    enabled: true,
    interval: 10000 // Polling a cada 10 segundos
  })

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      // Obtém os dados reais dos projetos pela API
      const projects = await projectApi.getProjects()
      setProjects(projects || [])
    } catch (error) {
      message.error('Falha ao carregar os projetos')
      console.error('Load projects error:', error)
      // Se a chamada da API falhar, usa uma lista vazia
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      await projectApi.deleteProject(id)
      deleteProject(id)
      message.success('Projeto excluído com sucesso')
    } catch (error) {
      message.error('Falha ao excluir o projeto')
      console.error('Delete project error:', error)
    }
  }

  const handleRetryProject = async () => {
    // Recarrega a lista de projetos para obter o status mais recente
    await loadProjects()
  }

  const handleStartProcessing = async (projectId: string) => {
    try {
      await projectApi.startProcessing(projectId)
      message.success('O processamento do projeto foi iniciado. Acompanhe o progresso em instantes.')
      // Atualiza a lista imediatamente para mostrar o status mais recente
      setTimeout(async () => {
        try {
          await refreshNow()
        } catch (refreshError) {
          console.error('Failed to refresh after starting processing:', refreshError)
        }
      }, 1000)
    } catch (error: unknown) {
      const errorMessage = (error as { userMessage?: string })?.userMessage || 'Falha ao iniciar o processamento'
      message.error(errorMessage)
      console.error('Start processing error:', error)
      
      // Em caso de timeout, avisa que o projeto pode continuar processando
      if ((error as { code?: string; message?: string })?.code === 'ECONNABORTED' || (error as { code?: string; message?: string })?.message?.includes('timeout')) {
        message.info('A solicitação expirou, mas o projeto pode ter iniciado. Verifique o status.', 5)
        // Atualiza a lista de projetos após um pequeno intervalo
        setTimeout(async () => {
          try {
            await refreshNow()
          } catch (refreshError) {
            console.error('Failed to refresh after timeout:', refreshError)
          }
        }, 3000)
      }
    }
  }

  const handleProjectCardClick = (project: Project) => {
    // Abre diretamente os detalhes do projeto independentemente do status
    navigate(`/project/${project.id}`)
  }

  const filteredProjects = projects
    .filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesStatus
    })
    .sort((a, b) => {
      // Ordena por data de criação, com os mais recentes primeiro
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <Layout style={{ 
      minHeight: '100vh', 
      background: '#0f0f0f'
    }}>
      <Content style={{ padding: '40px 24px', position: 'relative' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Área de importação */}
          <div style={{ 
            marginBottom: '48px',
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '800px',
              background: 'rgba(26, 26, 46, 0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: '1px solid rgba(79, 172, 254, 0.2)',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}>
              {/* Alternância de abas */}
              <div style={{
                display: 'flex',
                marginBottom: '16px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '3px'
              }}>
                 <button 
                   style={{
                     flex: 1,
                     padding: '12px 24px',
                     borderRadius: '8px',
                     background: activeTab === 'bilibili' ? 'rgba(79, 172, 254, 0.2)' : 'transparent',
                     color: activeTab === 'bilibili' ? '#4facfe' : '#cccccc',
                     cursor: 'pointer',
                     fontSize: '16px',
                     fontWeight: 600,
                     transition: 'all 0.3s ease',
                     border: activeTab === 'bilibili' ? '1px solid rgba(79, 172, 254, 0.4)' : '1px solid transparent'
                   }}
                   onClick={() => setActiveTab('bilibili')}
                 >
                   📺 Importar por link
                 </button>
                <button 
                   style={{
                     flex: 1,
                     padding: '12px 24px',
                     borderRadius: '8px',
                     background: activeTab === 'upload' ? 'rgba(79, 172, 254, 0.2)' : 'transparent',
                     color: activeTab === 'upload' ? '#4facfe' : '#cccccc',
                     cursor: 'pointer',
                     fontSize: '16px',
                     fontWeight: 600,
                     transition: 'all 0.3s ease',
                     border: activeTab === 'upload' ? '1px solid rgba(79, 172, 254, 0.4)' : '1px solid transparent'
                   }}
                   onClick={() => setActiveTab('upload')}
                 >
                   📁 Importar arquivo
                 </button>
              </div>
              
              {/* Área de conteúdo */}
              <div>
                {activeTab === 'bilibili' && (
                  <BilibiliDownload onDownloadSuccess={async (projectId: string) => {
                    // Atualiza a lista de projetos após concluir
                    await loadProjects()
                    
                    // Aguarda brevemente antes de iniciar para garantir que o status foi atualizado
                    setTimeout(async () => {
                      try {
                        await handleStartProcessing(projectId)
                      } catch (error) {
                        // 如果Falha ao iniciar o processamento，至少确保项目列表是最新的
                        console.error('Failed to start processing after download:', error)
                        loadProjects()
                      }
                    }, 500)
                  }} />
                )}
                {activeTab === 'upload' && (
                  <FileUpload onUploadSuccess={async (projectId: string) => {
                    // Atualiza a lista de projetos após concluir
                    await loadProjects()
                    
                    // Aguarda brevemente antes de iniciar para garantir que o status foi atualizado
                    setTimeout(async () => {
                      try {
                        await handleStartProcessing(projectId)
                      } catch (error) {
                        // 如果Falha ao iniciar o processamento，至少确保项目列表是最新的
                        console.error('Failed to start processing after upload:', error)
                        loadProjects()
                      }
                    }, 500)
                  }} />
                )}
              </div>
            </div>
          </div>

          {/* Área de gerenciamento de projetos */}
          <div style={{
            background: 'rgba(26, 26, 46, 0.7)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(79, 172, 254, 0.15)',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.03)'
          }}>
            {/* Cabeçalho da lista de projetos */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(79, 172, 254, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Title 
                  level={2} 
                  style={{ 
                    margin: 0,
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Meus projetos
                </Title>
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(79, 172, 254, 0.1)',
                  borderRadius: '20px',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Text style={{ color: '#4facfe', fontWeight: 600, fontSize: '14px' }}>
                    {filteredProjects.length} projetos
                  </Text>
                </div>
              </div>
              
              {/* Filtro de status movido para a direita */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center'
              }}>
                <Select
                  placeholder="Selecionar status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ 
                    minWidth: '140px',
                    height: '36px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(79, 172, 254, 0.2)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px'
                  }}
                  dropdownStyle={{
                    background: 'rgba(26, 26, 46, 0.95)',
                    border: '1px solid rgba(79, 172, 254, 0.3)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }}
                  suffixIcon={
                    <span style={{ 
                      color: '#8c8c8c', 
                      fontSize: '10px',
                      transition: 'all 0.2s ease'
                    }}>
                      ⌄
                    </span>
                  }
                  allowClear
                >
                  <Option value="all" style={{ color: '#ffffff' }}>Todos os status</Option>
                  <Option value="completed" style={{ color: '#52c41a' }}>Concluído</Option>
                  <Option value="processing" style={{ color: '#1890ff' }}>Processando</Option>
                  <Option value="error" style={{ color: '#ff4d4f' }}>Falha no processamento</Option>
                </Select>
              </div>
            </div>

            {/* Conteúdo da lista de projetos */}
             <div>
               {loading ? (
                 <div style={{ 
                   textAlign: 'center', 
                   padding: '60px 0',
                   background: '#262626',
                   borderRadius: '12px',
                   border: '1px solid #404040'
                 }}>
                   <Spin size="large" />
                   <div style={{ 
                     marginTop: '20px', 
                     color: '#cccccc',
                     fontSize: '16px'
                   }}>
                     Carregando lista de projetos...
                   </div>
                 </div>
               ) : filteredProjects.length === 0 ? (
                 <div style={{
                   textAlign: 'center',
                   padding: '60px 0',
                   background: '#262626',
                   borderRadius: '12px',
                   border: '1px solid #404040'
                 }}>
                   <Empty
                     image={Empty.PRESENTED_IMAGE_SIMPLE}
                     description={
                       <div>
                         <Text type="secondary">
                           {projects.length === 0 ? 'Ainda não há projetos. Use a área de importação acima para criar o primeiro.' : 'Nenhum projeto correspondente encontrado'}
                         </Text>
                       </div>
                     }
                   />
                 </div>
               ) : (
                 <div style={{
                   display: 'grid',
                   gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                   gap: '16px',
                   justifyContent: 'start',
                   padding: '6px 0'
                 }}>
                   {filteredProjects.map((project: Project) => (
                     <div key={project.id} style={{ position: 'relative', zIndex: 1 }}>
                       <ProjectCard 
                         project={project} 
                         onDelete={handleDeleteProject}
                         onRetry={handleRetryProject}
                         onClick={() => handleProjectCardClick(project)}
                       />
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </div>
      </Content>
    </Layout>
  )
}

export default HomePage