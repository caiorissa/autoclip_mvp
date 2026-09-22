import React, { useState, useEffect } from 'react'
import { Modal, Steps, Progress, Typography, Button, Alert, Space, Spin } from 'antd'
import { 
  CheckCircleOutlined, 
  LoadingOutlined, 
  ExclamationCircleOutlined, 
  ReloadOutlined
} from '@ant-design/icons'
import { projectApi } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'

const { Text } = Typography
const { Step } = Steps

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

interface TaskProgressModalProps {
  visible: boolean
  projectId: string | null
  onClose: () => void
  onComplete?: (projectId: string) => void
}

const TaskProgressModal: React.FC<TaskProgressModalProps> = ({
  visible,
  projectId,
  onClose,
  onComplete
}) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const { updateProject } = useProjectStore()

  const steps = [
    { title: 'Extração da estrutura', description: 'Extrai uma estrutura organizada a partir da transcrição do vídeo' },
    { title: 'Localização temporal', description: 'Localiza os intervalos de cada tópico com base nas legendas SRT' },
    { title: 'Avaliação do conteúdo', description: 'Avalia a qualidade e o potencial de engajamento de cada clipe' },
    { title: 'Geração de títulos', description: 'Gera títulos atraentes para os clipes com melhor avaliação' },
    { title: 'Agrupamento por tema', description: '将相关片段聚合为Coleções推荐' },
    { title: 'Corte do vídeo', description: '使用FFmpeg生成Clipes与Coleções视频' }
  ]

  useEffect(() => {
    if (!visible || !projectId) {
      setStatus(null)
      return
    }

    const checkStatus = async () => {
      try {
        const statusData = await projectApi.getProcessingStatus(projectId)
        setStatus(statusData)
        
        // 更新项目状态
        updateProject(projectId, {
          status: statusData.status,
          current_step: statusData.current_step,
          total_steps: statusData.total_steps,
          error_message: statusData.error_message
        })
        
        // 如果Processamento concluído，通知父组件
        if (statusData.status === 'completed') {
          onComplete?.(projectId)
        }
      } catch (error) {
        console.error('Check status error:', error)
      }
    }

    // 立即检查一次状态
    checkStatus()
    
    // 如果任务还在进行中，定期检查状态
    const interval = setInterval(checkStatus, 2000)
    
    return () => clearInterval(interval)
  }, [visible, projectId, updateProject, onComplete])

  const handleRetry = async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      if (status?.current_step !== undefined) {
        // Tentar novamente a partir da etapa atual
        await projectApi.restartStep(projectId, status.current_step)
      } else {
        // 完全重试
        await projectApi.retryProcessing(projectId)
      }
      // 重新开始状态检查
      setStatus(null)
    } catch (error) {
      console.error('Retry error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStepStatus = (stepIndex: number) => {
    if (!status) return 'wait'
    
    if (status.status === 'error' && stepIndex === status.current_step) {
      return 'error'
    }
    
    if (stepIndex < status.current_step) {
      return 'finish'
    }
    
    if (stepIndex === status.current_step) {
      return status.status === 'completed' ? 'finish' : 'process'
    }
    
    return 'wait'
  }

  const getStepIcon = (stepIndex: number) => {
    const stepStatus = getStepStatus(stepIndex)
    
    if (stepStatus === 'error') {
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    }
    
    if (stepStatus === 'finish') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    }
    
    if (stepStatus === 'process') {
      return <LoadingOutlined style={{ color: '#1890ff' }} />
    }
    
    return null
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LoadingOutlined style={{ color: '#1890ff' }} />
          <span>Progresso da tarefa</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Fechar
        </Button>,
        ...(status?.status === 'error' ? [
          <Button 
            key="retry" 
            type="primary" 
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRetry}
          >
            Tentar novamente a partir da etapa atual
          </Button>
        ] : [])
      ]}
      width={600}
      centered
      maskClosable={false}
      destroyOnClose
    >
      <div style={{ padding: '16px 0' }}>
        {!status ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>
              Obtendo status da tarefa...
            </div>
          </div>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Progresso geral */}
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <Text strong>Progresso geral</Text>
                <Text type="secondary">
                  {status.current_step}/{status.total_steps} etapas
                </Text>
              </div>
              <Progress 
                percent={Math.round((status.current_step / status.total_steps) * 100)}
                status={status.status === 'error' ? 'exception' : 'active'}
                strokeColor={{
                  '0%': '#4facfe',
                  '100%': '#00f2fe'
                }}
              />
            </div>

            {/* 当前etapas信息 */}
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {getStepIcon(status.current_step)}
                <Text strong>当前etapas: {status.step_name}</Text>
              </div>
              <Progress 
                percent={status.progress}
                size="small"
                status={status.status === 'error' ? 'exception' : 'active'}
              />
            </div>

            {/* 错误信息 */}
            {status.status === 'error' && status.error_message && (
              <Alert
                message="处理Falha"
                description={status.error_message}
                type="error"
                showIcon
              />
            )}

            {/* etapas列表 */}
            <div>
              <Text strong style={{ marginBottom: '16px', display: 'block' }}>处理etapas</Text>
              <Steps
                direction="vertical"
                size="small"
                current={status.current_step}
                status={status.status === 'error' ? 'error' : 'process'}
              >
                {steps.map((step, index) => (
                  <Step
                    key={index}
                    title={step.title}
                    description={step.description}
                    status={getStepStatus(index)}
                    icon={getStepIcon(index)}
                  />
                ))}
              </Steps>
            </div>

            {/* 完成提示 */}
            {status.status === 'completed' && (
              <Alert
                message="Processamento concluído"
                description="视频已成功处理，您可以查看生成的片段和Coleções。"
                type="success"
                showIcon
              />
            )}
          </Space>
        )}
      </div>
    </Modal>
  )
}

export default TaskProgressModal