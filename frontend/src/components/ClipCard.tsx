import React, { useState, useEffect, useRef } from 'react'
import { Card, Typography, Button, Tag, Tooltip, Modal } from 'antd'
import { PlayCircleOutlined, DownloadOutlined, ClockCircleOutlined, StarFilled } from '@ant-design/icons'
import ReactPlayer from 'react-player'
import { Clip } from '../store/useProjectStore'
import './ClipCard.css'

const { Text, Title } = Typography

interface ClipCardProps {
  clip: Clip
  videoUrl?: string
  onDownload: (clipId: string) => void
}

const ClipCard: React.FC<ClipCardProps> = ({ 
  clip, 
  videoUrl, 
  onDownload
}) => {

  const [showPlayer, setShowPlayer] = useState(false)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const playerRef = useRef<ReactPlayer>(null)



  // Gera a miniatura do vídeo
  useEffect(() => {
    if (videoUrl) {
      generateThumbnail()
    }
  }, [videoUrl])

  const generateThumbnail = () => {
    if (!videoUrl) return
    
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.currentTime = 1 // Captura o quadro do primeiro segundo como miniatura
    
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
      setVideoThumbnail(thumbnail)
    }
    
    video.src = videoUrl
  }

  const handleDownloadWithTitle = async () => {
    try {
      const fileName = `${clip.generated_title || clip.title || 'Clipe de vídeo'}.mp4`
      
      // Obtém o arquivo de vídeo com fetch
      const response = await fetch(videoUrl || '')
      if (!response.ok) {
        throw new Error('Falha no download')
      }
      
      const blob = await response.blob()
      
      // Cria o link de download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      
      // Inicia o download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Libera o objeto URL
      window.URL.revokeObjectURL(downloadUrl)
      
      // Também chama o método de download existente
      onDownload(clip.id)
    } catch (error) {
      console.error('Falha no download:', error)
      // Se o fetch falhar, usa o método anterior como fallback
      const fileName = `${clip.generated_title || clip.title || 'Clipe de vídeo'}.mp4`
      const link = document.createElement('a')
      link.href = videoUrl || ''
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onDownload(clip.id)
    }
  }

  const handleClosePlayer = () => {
    // Interrompe a reprodução do vídeo
    if (playerRef.current) {
      playerRef.current.seekTo(0)
    }
    setShowPlayer(false)
  }



  const formatTime = (timeStr: string) => {
    // Converte o tempo SRT para o formato exibido
    return timeStr.replace(',', '.').substring(0, 8)
  }

  const getDuration = () => {
    // Calcula a duração de forma simples
    const start = clip.start_time.split(':')
    const end = clip.end_time.split(':')
    const startSeconds = parseInt(start[0]) * 3600 + parseInt(start[1]) * 60 + parseFloat(start[2].replace(',', '.'))
    const endSeconds = parseInt(end[0]) * 3600 + parseInt(end[1]) * 60 + parseFloat(end[2].replace(',', '.'))
    const duration = endSeconds - startSeconds
    return `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return '#52c41a'
    if (score >= 0.8) return '#1890ff'
    if (score >= 0.7) return '#faad14'
    return '#ff4d4f'
  }

  // Gera o conteúdo do tooltip com os pontos principais
  const getContentTooltip = () => {
    if (clip.content && clip.content.length > 0) {
      return (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Pontos principais:</div>
          {clip.content.map((point, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>
              • {point}
            </div>
          ))}
        </div>
      )
    }
    return 'Nenhum ponto principal disponível'
  }

  return (
    <>
      <Tooltip 
        title={getContentTooltip()}
        placement="top"
        overlayStyle={{ maxWidth: '300px' }}
      >
        <Card
          className="clip-card"
          hoverable
          style={{ 
            height: '380px',
            borderRadius: '16px',
            border: '1px solid #303030',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            overflow: 'hidden'
          }}
          bodyStyle={{ padding: 0 }}
          cover={
            <div 
              style={{ 
                height: '200px', 
                background: videoThumbnail 
                  ? `url(${videoThumbnail}) center/cover no-repeat` 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden'
              }}
              onClick={() => setShowPlayer(true)}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }}
                className="video-overlay"
              >
                <PlayCircleOutlined style={{ fontSize: '56px', color: 'white' }} />
              </div>
              
              {/* Barra superior de informações */}
              <div 
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Tag 
                  color="geekblue" 
                  style={{ 
                    margin: 0, 
                    fontSize: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'rgba(24, 144, 255, 0.9)',
                    color: 'white',
                    fontWeight: 500
                  }}
                >
                  {clip.outline}
                </Tag>
                <div 
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ClockCircleOutlined style={{ fontSize: '12px' }} />
                  {getDuration()}
                </div>
              </div>
              
              {/* Barra inferior de informações */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}>
                  {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                </div>
                <div 
                  style={{
                    background: getScoreColor(clip.final_score),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <StarFilled style={{ fontSize: '12px' }} />
                  {(clip.final_score * 100).toFixed(0)} pontos
                </div>
              </div>
            </div>
          }
        >
          <div style={{ padding: '16px', height: '180px', display: 'flex', flexDirection: 'column' }}>
            {/* Área do título */}
            <div style={{ marginBottom: '12px' }}>
              <Title 
                level={5} 
                ellipsis={{ rows: 2 }} 
                style={{ 
                  margin: 0, 
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '1.4',
                  color: '#ffffff',
                  minHeight: '44px'
                }}
              >
                {clip.generated_title || clip.title || 'Clipe sem título'}
              </Title>
            </div>
            
            {/* Motivo da recomendação */}
            <div style={{ flex: 1, marginBottom: '12px' }}>
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: '13px',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.5',
                  color: '#b0b0b0'
                }}
              >
                {clip.recommend_reason || 'Nenhum motivo de recomendação disponível'}
              </Text>
            </div>
            

          </div>
        </Card>
      </Tooltip>

      {/* Modal de reprodução do vídeo */}
      <Modal
        title={clip.generated_title || clip.title || 'Prévia do vídeo'}
        open={showPlayer}
        onCancel={handleClosePlayer}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadWithTitle}>
            Baixar vídeo
          </Button>,
          <Button key="close" onClick={handleClosePlayer}>
            Fechar
          </Button>
        ]}
        width={800}
        centered
        destroyOnClose
      >
        {videoUrl && (
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="400px"
            controls
            playing={showPlayer}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  preload: 'metadata'
                },
                forceHLS: false,
                forceDASH: false
              }
            }}
            onReady={() => {
              console.log('Video ready for seeking')
            }}
            onError={(error) => {
              console.error('ReactPlayer error:', error)
            }}
          />
        )}
      </Modal>
    </>
  )
}

export default ClipCard