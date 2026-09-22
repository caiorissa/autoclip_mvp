import { useEffect, useRef, useState } from 'react'
import { projectApi } from '../services/api'
import { Project, useProjectStore } from '../store/useProjectStore'

interface UseProjectPollingOptions {
  interval?: number // Intervalo de polling, padrão de 10 segundos
  onProjectsUpdate?: (projects: Project[]) => void
  enabled?: boolean // Define se o polling está ativado
}

export const useProjectPolling = ({
  interval = 10000,
  onProjectsUpdate,
  enabled = true
}: UseProjectPollingOptions = {}) => {
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now())
  const isDragging = useProjectStore(state => state.isDragging)

  const startPolling = () => {
    if (!enabled || intervalRef.current) return

    setIsPolling(true)
    
    const poll = async () => {
      try {
        // Se houver um arraste em andamento, ignora este ciclo de polling
        if (isDragging) {
          console.log('Skipping poll: dragging in progress')
          return
        }
        
        const projects = await projectApi.getProjects()
        const hasProcessingProjects = projects.some(p => p.status === 'processing')
        
        if (onProjectsUpdate) {
          onProjectsUpdate(projects)
        }
        
        setLastUpdateTime(Date.now())
        
        // Se não houver projetos em processamento, a frequência do polling pode ser reduzida
        if (!hasProcessingProjects) {
          // A frequência dinâmica de polling pode ser implementada aqui
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    // Executa imediatamente uma vez
    poll()
    
    // Configura o temporizador
    intervalRef.current = setInterval(poll, interval)
  }

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }

  const refreshNow = async () => {
    try {
      const projects = await projectApi.getProjects()
      if (onProjectsUpdate) {
        onProjectsUpdate(projects)
      }
      setLastUpdateTime(Date.now())
      return projects
    } catch (error) {
      console.error('Manual refresh error:', error)
      throw error
    }
  }

  useEffect(() => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [enabled, interval])

  return {
    isPolling,
    lastUpdateTime,
    startPolling,
    stopPolling,
    refreshNow
  }
}

export default useProjectPolling