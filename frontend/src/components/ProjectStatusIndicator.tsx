import React from 'react'
import { Badge, Progress, Tooltip, Typography } from 'antd'
import { 
  LoadingOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { Project } from '../store/useProjectStore'

const { Text } = Typography

interface ProjectStatusIndicatorProps {
  project: Project
  showProgress?: boolean
  size?: 'small' | 'default' | 'large'
}

const ProjectStatusIndicator: React.FC<ProjectStatusIndicatorProps> = ({
  project,
  showProgress = true,
  size = 'default'
}) => {
  const getStatusConfig = () => {
    switch (project.status) {
      case 'uploading':
        return {
          color: '#1890ff',
          icon: <ClockCircleOutlined />,
          text: 'Aguardando processamento',
          badgeStatus: 'processing' as const
        }
      case 'processing':
        return {
          color: '#52c41a',
          icon: <LoadingOutlined spin />,
          text: `Processando (${project.current_step || 0}/${project.total_steps || 6})`,
          badgeStatus: 'processing' as const
        }
      case 'completed':
        return {
          color: '#52c41a',
          icon: <CheckCircleOutlined />,
          text: 'Processamento concluído',
          badgeStatus: 'success' as const
        }
      case 'error':
        return {
          color: '#ff4d4f',
          icon: <ExclamationCircleOutlined />,
          text: 'Falha no processamento',
          badgeStatus: 'error' as const
        }
      default:
        return {
          color: '#d9d9d9',
          icon: <ClockCircleOutlined />,
          text: 'Status desconhecido',
          badgeStatus: 'default' as const
        }
    }
  }

  const statusConfig = getStatusConfig()
  const progress = project.status === 'processing' 
    ? ((project.current_step || 0) / (project.total_steps || 6)) * 100
    : project.status === 'completed' ? 100 : 0

  const getStepName = () => {
    if (project.status === 'processing' && project.current_step) {
      const stepNames = {
        1: 'Análise da estrutura do conteúdo',
        2: 'Geração da linha do tempo',
        3: 'Avaliação dos clipes',
        4: 'Geração de títulos',
        5: 'Agrupamento por tema',
        6: 'Geração de vídeo'
      }
      return stepNames[project.current_step as keyof typeof stepNames] || 'Processando'
    }
    return statusConfig.text
  }

  if (size === 'small') {
    return (
      <Tooltip title={getStepName()}>
        <Badge status={statusConfig.badgeStatus} text={statusConfig.text} />
      </Tooltip>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ color: statusConfig.color, fontSize: size === 'large' ? '16px' : '14px' }}>
        {statusConfig.icon}
      </div>
      <div style={{ flex: 1 }}>
        <Text style={{ 
          color: statusConfig.color, 
          fontSize: size === 'large' ? '14px' : '12px',
          fontWeight: 500
        }}>
          {getStepName()}
        </Text>
        {showProgress && project.status === 'processing' && (
          <div style={{ marginTop: '4px' }}>
            <Progress 
              percent={progress} 
              size="small" 
              strokeColor={statusConfig.color}
              showInfo={false}
            />
          </div>
        )}
        {project.error_message && (
          <div style={{ marginTop: '4px' }}>
            <Text type="danger" style={{ fontSize: '11px' }}>
              {project.error_message}
            </Text>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectStatusIndicator