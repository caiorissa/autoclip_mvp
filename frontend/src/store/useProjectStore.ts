import { create } from 'zustand'
import { projectApi } from '../services/api'

export interface Clip {
  id: string
  title?: string  // Pode não haver um título original
  start_time: string
  end_time: string
  final_score: number  // Corresponde ao nome do campo no backend
  recommend_reason: string  // Corresponde ao nome do campo no backend
  generated_title?: string
  outline: string
  content: string[]
  chunk_index?: number  // Adiciona o campo ausente
}

export interface Collection {
  id: string
  collection_title: string
  collection_summary: string
  clip_ids: string[]
  collection_type?: string // "ai_recommended" or "manual"
  created_at?: string
}

export interface Project {
  id: string
  name: string
  video_path: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  created_at: string
  updated_at: string
  video_category?: string
  clips: Clip[]
  collections: Collection[]
  current_step?: number
  total_steps?: number
  error_message?: string
}

interface ProjectStore {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  error: string | null
  lastEditTimestamp: number
  isDragging: boolean
  
  // Actions
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updateClip: (projectId: string, clipId: string, updates: Partial<Clip>) => void
  updateCollection: (projectId: string, collectionId: string, updates: Partial<Collection>) => void
  addCollection: (projectId: string, collection: Collection) => void
  deleteCollection: (projectId: string, collectionId: string) => void
  removeClipFromCollection: (projectId: string, collectionId: string, clipId: string) => void
  reorderCollectionClips: (projectId: string, collectionId: string, newClipIds: string[]) => Promise<void>
  addClipToCollection: (projectId: string, collectionId: string, clipIds: string[]) => Promise<void>
  setDragging: (isDragging: boolean) => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
  lastEditTimestamp: 0,
  isDragging: false,

  setProjects: (projects) => {
    const state = get()
    const now = Date.now()
    const timeSinceLastEdit = now - state.lastEditTimestamp
    
    console.log('setProjects called:', {
      timeSinceLastEdit,
      lastEditTimestamp: state.lastEditTimestamp,
      isDragging: state.isDragging,
      shouldSkipUpdate: state.isDragging || timeSinceLastEdit < 5000,
      projectsCount: projects.length
    })
    
    // Se houver arraste ou edição nos últimos 5 segundos, ignora a atualização para evitar conflitos
    if (state.isDragging) {
      console.log('Skipping update: dragging in progress')
      return
    }
    
    if (timeSinceLastEdit < 5000) {
      console.log('Skipping update: recent edit detected, preserving user changes')
      return
    }
    
    console.log('Applying normal update')
    set({ projects })
  },
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  addProject: (project) => set((state) => ({ 
    projects: [project, ...state.projects] 
  })),
  
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
    currentProject: state.currentProject?.id === id 
      ? { ...state.currentProject, ...updates } 
      : state.currentProject
  })),
  
  deleteProject: (id) => {
    // Limpa o cache de miniaturas
    const thumbnailCacheKey = `thumbnail_${id}`
    localStorage.removeItem(thumbnailCacheKey)
    
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject
    }))
  },
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  updateClip: (projectId, clipId, updates) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, clips: p.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) }
        : p
    ),
    currentProject: state.currentProject?.id === projectId
      ? { 
          ...state.currentProject, 
          clips: state.currentProject.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
        }
      : state.currentProject
  })),
  
  updateCollection: (projectId, collectionId, updates) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, collections: p.collections.map(c => c.id === collectionId ? { ...c, ...updates } : c) }
        : p
    ),
    currentProject: state.currentProject?.id === projectId
      ? { 
          ...state.currentProject, 
          collections: state.currentProject.collections.map(c => c.id === collectionId ? { ...c, ...updates } : c)
        }
      : state.currentProject
  })),

  addCollection: (projectId: string, collection: Collection) => {
    set((state) => ({
      projects: state.projects.map(project => 
        project.id === projectId 
          ? {
              ...project,
              collections: [...(project.collections || []), collection]
            }
          : project
      ),
      currentProject: state.currentProject?.id === projectId
        ? {
            ...state.currentProject,
            collections: [...(state.currentProject.collections || []), collection]
          }
        : state.currentProject
    }))
  },

  deleteCollection: (projectId: string, collectionId: string) => {
    set((state) => ({
      projects: state.projects.map(project => 
        project.id === projectId 
          ? {
              ...project,
              collections: project.collections.filter(c => c.id !== collectionId)
            }
          : project
      ),
      currentProject: state.currentProject?.id === projectId
        ? {
            ...state.currentProject,
            collections: state.currentProject.collections.filter(c => c.id !== collectionId)
          }
        : state.currentProject
    }))
  },

  removeClipFromCollection: async (projectId: string, collectionId: string, clipId: string) => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)
    const collection = project?.collections.find(c => c.id === collectionId)
    
    if (!collection) {
      throw new Error('Collection not found')
    }
    
    const originalClipIds = [...collection.clip_ids]
    const updatedClipIds = collection.clip_ids.filter(id => id !== clipId)
    
    // Verifica se houve alguma alteração real
    if (originalClipIds.length === updatedClipIds.length) {
      console.log('Clip not found in collection, skipping update')
      return
    }
    
    // Atualização otimista: altera o estado do frontend imediatamente
    const updateState = (clipIds: string[]) => {
      set((state) => ({
        projects: state.projects.map(project => 
          project.id === projectId 
            ? {
                ...project,
                collections: project.collections.map(collection =>
                  collection.id === collectionId
                    ? {
                        ...collection,
                        clip_ids: clipIds
                      }
                    : collection
                )
              }
            : project
        ),
        currentProject: state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              collections: state.currentProject.collections.map(collection =>
                collection.id === collectionId
                  ? {
                      ...collection,
                      clip_ids: clipIds
                    }
                  : collection
              )
            }
          : state.currentProject,
        lastEditTimestamp: Date.now()
      }))
    }
    
    // Aplica a atualização imediatamente
    updateState(updatedClipIds)
    
    // Chama a API do backend
    try {
      console.log('Removing clip from collection:', { projectId, collectionId, clipId })
      await projectApi.updateCollection(projectId, collectionId, { clip_ids: updatedClipIds })
      console.log('Clip removed successfully')
    } catch (error) {
      console.error('Failed to remove clip from collection, rolling back:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: (error as unknown)?.response?.status,
        statusText: (error as unknown)?.response?.statusText,
        data: (error as unknown)?.response?.data
      })
      // Reverte para o estado original
      updateState(originalClipIds)
      throw error
    }
  },

  setDragging: (isDragging) => set({ isDragging }),

  reorderCollectionClips: async (projectId: string, collectionId: string, newClipIds: string[]) => {
    console.log('Starting reorderCollectionClips:', { projectId, collectionId, newClipIds })
    
    // Obtém o estado original
    const state = get()
    const originalProject = state.projects.find(p => p.id === projectId)
    const originalCollection = originalProject?.collections.find(c => c.id === collectionId)
    
    if (!originalCollection) {
      throw new Error('Collection not found')
    }
    
    const originalClipIds = [...originalCollection.clip_ids]
    
    // Verifica se houve alguma alteração real
    if (JSON.stringify(originalClipIds) === JSON.stringify(newClipIds)) {
      console.log('No changes detected, skipping update')
      return
    }
    
    // Registra o horário da edição
    const now = Date.now()
    
    // Atualização otimista: altera o estado do frontend imediatamente
    const updateState = (clipIds: string[]) => {
      set((state) => ({
        projects: state.projects.map(project => 
          project.id === projectId 
            ? {
                ...project,
                collections: project.collections.map(collection =>
                  collection.id === collectionId
                    ? { ...collection, clip_ids: clipIds }
                    : collection
                )
              }
            : project
        ),
        currentProject: state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              collections: state.currentProject.collections.map(collection =>
                collection.id === collectionId
                  ? { ...collection, clip_ids: clipIds }
                  : collection
              )
            }
          : state.currentProject,
        lastEditTimestamp: now
      }))
    }
    
    // Aplica a nova ordem imediatamente
    updateState(newClipIds)
    
    // Chama a API do backend
    try {
      console.log('Calling backend API:', { projectId, collectionId, newClipIds })
      const result = await projectApi.updateCollection(projectId, collectionId, { clip_ids: newClipIds })
      console.log('Backend update successful, result:', result)
    } catch (error) {
      console.error('Backend update failed, rolling back:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: (error as unknown)?.response?.status,
        statusText: (error as unknown)?.response?.statusText,
        data: (error as unknown)?.response?.data
      })
      // Reverte para o estado original
      updateState(originalClipIds)
      throw error
    }
  },

  addClipToCollection: async (projectId: string, collectionId: string, clipIds: string[]) => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)
    const collection = project?.collections.find(c => c.id === collectionId)
    
    if (!collection) {
      throw new Error('Collection not found')
    }
    
    const originalClipIds = [...collection.clip_ids]
    // Combina os clip_ids existentes com os novos clipIds, removendo duplicados
    const updatedClipIds = [...new Set([...collection.clip_ids, ...clipIds])]
    
    // Verifica se houve alguma alteração real
    if (originalClipIds.length === updatedClipIds.length) {
      console.log('No new clips to add, skipping update')
      return
    }
    
    // Atualização otimista: altera o estado do frontend imediatamente
    const updateState = (clipIds: string[]) => {
      set((state) => ({
        projects: state.projects.map(project => 
          project.id === projectId 
            ? {
                ...project,
                collections: project.collections.map(collection =>
                  collection.id === collectionId
                    ? {
                        ...collection,
                        clip_ids: clipIds
                      }
                    : collection
                )
              }
            : project
        ),
        currentProject: state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              collections: state.currentProject.collections.map(collection =>
                collection.id === collectionId
                  ? {
                      ...collection,
                      clip_ids: clipIds
                    }
                  : collection
              )
            }
          : state.currentProject,
        lastEditTimestamp: Date.now()
      }))
    }
    
    // Aplica a atualização imediatamente
    updateState(updatedClipIds)
    
    // Chama a API do backend para salvar a atualização
    try {
      console.log('Adding clips to collection:', { projectId, collectionId, clipIds, updatedClipIds })
      await projectApi.updateCollection(projectId, collectionId, { clip_ids: updatedClipIds })
      console.log('Clips added successfully')
    } catch (error) {
      console.error('Failed to add clips to collection, rolling back:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: (error as unknown)?.response?.status,
        statusText: (error as unknown)?.response?.statusText,
        data: (error as unknown)?.response?.data
      })
      // Reverte para o estado original
      updateState(originalClipIds)
      throw error
    }
  }
}))