import React, { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, message, Typography, Space, Alert, Divider, Row, Col, Spin, Select } from 'antd'
import { KeyOutlined, SaveOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { settingsApi } from '../services/api'
import './SettingsPage.css'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

interface BrowserInfo {
  name: string
  value: string
  available: boolean
  priority: number
}

interface ApiSettings {
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
  default_browser?: string
}

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [availableBrowsers, setAvailableBrowsers] = useState<BrowserInfo[]>([])
  const [detectingBrowsers, setDetectingBrowsers] = useState(false)
  const [selectedBrowser, setSelectedBrowser] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('openrouter')

  useEffect(() => {
    loadSettings()
    detectAvailableBrowsers()
  }, [])

  // Detecta navegadores disponíveis
  const detectAvailableBrowsers = async () => {
    setDetectingBrowsers(true)
    try {
      const response = await fetch('http://localhost:8000/api/browsers/detect')
      if (response.ok) {
        const data = await response.json()
        const browsers: BrowserInfo[] = data.browsers
        setAvailableBrowsers(browsers)
        
        // Seleciona automaticamente o primeiro navegador disponível, priorizando o Chrome
        const chromeBrowser = browsers.find(b => b.value === 'chrome' && b.available)
        const firstAvailable = chromeBrowser || browsers.find(b => b.available)
        if (firstAvailable) {
          form.setFieldValue('default_browser', firstAvailable.value)
          setSelectedBrowser(firstAvailable.value)
        }
      } else {
        // Se a API falhar, usa a configuração padrão
        const browsers: BrowserInfo[] = [
          { name: 'Chrome', value: 'chrome', available: true, priority: 1 },
          { name: 'Edge', value: 'edge', available: true, priority: 2 },
          { name: 'Firefox', value: 'firefox', available: true, priority: 3 },
          { name: 'Safari', value: 'safari', available: true, priority: 4 }
        ]
        setAvailableBrowsers(browsers)
        form.setFieldValue('default_browser', 'chrome')
        setSelectedBrowser('chrome')
      }
    } catch (error) {
      console.error('Falha ao detectar navegadores:', error)
      // Usa a configuração padrão
      const browsers: BrowserInfo[] = [
        { name: 'Chrome', value: 'chrome', available: true, priority: 1 },
        { name: 'Edge', value: 'edge', available: true, priority: 2 },
        { name: 'Firefox', value: 'firefox', available: true, priority: 3 },
        { name: 'Safari', value: 'safari', available: true, priority: 4 }
      ]
      setAvailableBrowsers(browsers)
      form.setFieldValue('default_browser', 'chrome')
      setSelectedBrowser('chrome')
    } finally {
      setDetectingBrowsers(false)
    }
  }

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getSettings()
      form.setFieldsValue(data)
      if (data.default_browser) setSelectedBrowser(data.default_browser)
      if (data.api_provider) setSelectedProvider(data.api_provider)
    } catch (error) {
      message.error('Falha ao carregar as configurações')
      console.error('Load settings error:', error)
    }
  }

  const handleSave = async (values: ApiSettings) => {
    setLoading(true)
    try {
      await settingsApi.updateSettings(values)
      message.success('Configurações salvas com sucesso')
    } catch (error) {
      message.error('Falha ao salvar as configurações')
      console.error('Save settings error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestApi = async () => {
    const values = form.getFieldsValue()
    const provider = values.api_provider || selectedProvider
    
    let apiKey = ''
    let model = ''
    
    if (provider === 'dashscope') {
      apiKey = values.dashscope_api_key
      model = values.model_name
    } else if (provider === 'siliconflow') {
      apiKey = values.siliconflow_api_key
      model = values.siliconflow_model
    } else if (provider === 'openrouter') {
      apiKey = values.openrouter_api_key
      model = values.openrouter_model
    }
    
    if (!apiKey) {
      message.error('Digite a chave da API primeiro')
      return
    }
    
    setLoading(true)
    try {
      const result = await settingsApi.testApiKey(apiKey, provider, model)
      if (result.success) {
        message.success('Conexão com a API realizada com sucesso')
      } else {
        message.error(`Falha ao testar a API: ${result.error}`)
      }
    } catch (error) {
      message.error('Falha ao testar a conexão com a API')
      console.error('Test API error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value)
    form.setFieldValue('api_provider', value)
  }

  return (
    <Content className="settings-page">
      <div className="settings-container">
        <Title level={2} className="settings-title">
          <SettingOutlined /> Configurações do sistema
        </Title>
        
        <Card title="Configuração da API" className="settings-card">
          <Alert
            message="Como configurar"
            description="Escolha um provedor de API e informe a chave correspondente para ativar o clipping automático com IA."
            type="info"
            showIcon
            className="settings-alert"
          />
          
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            className="settings-form"
            initialValues={{
              api_provider: 'openrouter',
              model_name: 'qwen-plus',
              siliconflow_model: 'Qwen/Qwen2.5-72B-Instruct',
              openrouter_model: 'qwen/qwen3.8-27b:free',
              chunk_size: 5000,
              min_score_threshold: 0.7,
              max_clips_per_collection: 5
            }}
          >
            {/* Seleção do provedor de API */}
            <Form.Item
              label="Provedor de API"
              name="api_provider"
              className="form-item"
              rules={[{ required: true, message: 'Selecione um provedor de API' }]}
            >
              <Select 
                placeholder="Selecione um provedor de API" 
                className="settings-input"
                onChange={handleProviderChange}
                value={selectedProvider}
              >
                <Select.Option value="openrouter">OpenRouter (recomendado)</Select.Option>
                <Select.Option value="dashscope">Alibaba Cloud (DashScope)</Select.Option>
                <Select.Option value="siliconflow">SiliconFlow</Select.Option>
              </Select>
            </Form.Item>

            {/* Configuração do DashScope */}
            {selectedProvider === 'dashscope' && (
              <>
                <Form.Item
                  label="DashScope API Key"
                  name="dashscope_api_key"
                  className="form-item"
                  rules={[
                    { required: true, message: 'Digite a chave da API' },
                    { min: 10, message: 'A chave da API deve ter pelo menos 10 caracteres' }
                  ]}
                >
                  <Input.Password
                    placeholder="Digite a chave da API do DashScope"
                    prefix={<KeyOutlined />}
                    className="settings-input"
                  />
                </Form.Item>

                <Form.Item
                  label="Modelo DashScope"
                  name="model_name"
                  className="form-item"
                  rules={[{ required: true, message: 'Selecione um modelo' }]}
                >
                  <Select placeholder="Selecione um modelo" className="settings-input">
                    <Select.Option value="qwen-plus">Qwen Plus</Select.Option>
                    <Select.Option value="qwen-turbo">Qwen Turbo</Select.Option>
                    <Select.Option value="qwen-max">Qwen Max</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}

            {/* Configuração do SiliconFlow */}
            {selectedProvider === 'siliconflow' && (
              <>
                <Form.Item
                  label="SiliconFlow API Key"
                  name="siliconflow_api_key"
                  className="form-item"
                  rules={[
                    { required: true, message: 'Digite a chave da API' },
                    { min: 10, message: 'A chave da API deve ter pelo menos 10 caracteres' }
                  ]}
                >
                  <Input.Password
                    placeholder="Digite a chave da API do SiliconFlow"
                    prefix={<KeyOutlined />}
                    className="settings-input"
                  />
                </Form.Item>

                <Form.Item
                  label="Modelo SiliconFlow"
                  name="siliconflow_model"
                  className="form-item"
                  rules={[{ required: true, message: 'Selecione um modelo' }]}
                >
                  <Select placeholder="Selecione um modelo" className="settings-input">
                    <Select.Option value="Qwen/Qwen2.5-72B-Instruct">Qwen2.5-72B-Instruct</Select.Option>
                    <Select.Option value="Qwen/Qwen3-8B">Qwen3-8B</Select.Option>
                    <Select.Option value="Pro/deepseek-ai/DeepSeek-R1">DeepSeek-R1</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}


            {/* OpenRouter */}
            {selectedProvider === 'openrouter' && (
              <>
                <Alert
                  message="Opção gratuita recomendada"
                  description="Use uma chave do OpenRouter com um modelo :free. O modelo padrão é Qwen3.8 27B Free."
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />

                <Form.Item
                  label="OpenRouter API Key"
                  name="openrouter_api_key"
                  className="form-item"
                  rules={[
                    { required: true, message: 'Digite sua chave do OpenRouter' },
                    { min: 10, message: 'A chave da API parece curta demais' }
                  ]}
                >
                  <Input.Password
                    placeholder="sk-or-v1-..."
                    prefix={<KeyOutlined />}
                    className="settings-input"
                  />
                </Form.Item>

                <Form.Item
                  label="Modelo OpenRouter"
                  name="openrouter_model"
                  className="form-item"
                  rules={[{ required: true, message: 'Escolha ou informe um modelo' }]}
                >
                  <Select
                    placeholder="Escolha um modelo"
                    className="settings-input"
                    showSearch
                    allowClear={false}
                  >
                    <Select.Option value="qwen/qwen3.8-27b:free">Qwen3.8 27B — grátis</Select.Option>
                    <Select.Option value="openrouter/free">OpenRouter Free Router — grátis, modelo variável</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}

            {/* Botões de ação */}
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  icon={<SaveOutlined />} 
                  htmlType="submit" 
                  loading={loading}
                >
                  Salvar configuração
                </Button>
                <Button 
                  type="default" 
                  onClick={handleTestApi}
                  loading={loading}
                >
                  Testar conexão da API
                </Button>
              </Space>
            </Form.Item>

            <Divider className="settings-divider" />

            <Title level={4} className="section-title">Parâmetros de processamento</Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Tamanho dos blocos de texto"
                  name="chunk_size"
                  className="form-item"
                  rules={[{ required: true, message: 'Digite o tamanho dos blocos' }]}
                >
                  <Input 
                    type="number" 
                    placeholder="5000" 
                    addonAfter="caracteres" 
                    className="settings-input"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Pontuação mínima"
                  name="min_score_threshold"
                  className="form-item"
                  rules={[{ required: true, message: 'Digite a pontuação mínima' }]}
                >
                  <Input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="1" 
                    placeholder="0.7" 
                    className="settings-input"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Máximo de clipes por coleção"
                  name="max_clips_per_collection"
                  className="form-item"
                  rules={[{ required: true, message: 'Digite o número máximo de clipes' }]}
                >
                  <Input 
                    type="number" 
                    placeholder="5" 
                    addonAfter="clipes" 
                    className="settings-input"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider className="settings-divider" />

            <Title level={4} className="section-title">Configuração do navegador</Title>
            
            <Alert
              message="Importação por link"
              description="Configure o navegador padrão para reutilizar sua sessão quando necessário e acessar legendas. Sem isso, somente conteúdo público poderá ser obtido."
              type="info"
              showIcon
              style={{
                background: 'rgba(79, 172, 254, 0.1)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            />

            {detectingBrowsers ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                background: 'rgba(79, 172, 254, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                marginBottom: '16px'
              }}>
                <Spin size="small" />
                <Text style={{ color: '#4facfe', fontSize: '14px' }}>
                  Detectando navegadores disponíveis...
                </Text>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '16px'
              }}>
                {availableBrowsers.map(browser => {
                  const isSelected = selectedBrowser === browser.value
                  return (
                    <div
                      key={browser.value}
                      onClick={() => {
                        if (!browser.available) return
                        setSelectedBrowser(browser.value)
                        form.setFieldValue('default_browser', browser.value)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: isSelected 
                          ? '2px solid #4facfe' 
                          : '2px solid rgba(255, 255, 255, 0.1)',
                        background: isSelected 
                          ? 'rgba(79, 172, 254, 0.2)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                        cursor: browser.available ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 400,
                        userSelect: 'none',
                        opacity: browser.available ? 1 : 0.5
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected && browser.available) {
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
                      {browser.name}
                      {!browser.available && <span style={{ fontSize: '10px', opacity: 0.6 }}> (não instalado)</span>}
                    </div>
                  )
                })}
              </div>
            )}

            <Form.Item className="form-item">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
                size="large"
                className="save-button"
                onClick={() => {
                  // Sincroniza selectedBrowser com o formulário ao salvar
                  form.setFieldValue('default_browser', selectedBrowser)
                }}
              >
                Salvar configuração
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="Como usar" className="settings-card">
          <Space direction="vertical" size="large" className="instructions-space">
            <div className="instruction-item">
              <Title level={5} className="instruction-title">
                <InfoCircleOutlined /> 1. Obter uma chave de API
              </Title>
              <Paragraph className="instruction-text">
                <strong>OpenRouter:</strong> crie uma chave em <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">OpenRouter → Keys</a> e cole no campo acima.<br />
                <strong>DashScope:</strong> use uma chave da plataforma Alibaba Cloud.<br />
                <strong>SiliconFlow:</strong> use uma chave do SiliconCloud.
              </Paragraph>
            </div>
            
            <div className="instruction-item">
              <Title level={5} className="instruction-title">
                <InfoCircleOutlined /> 2. Entender os parâmetros
              </Title>
              <Paragraph className="instruction-text">
                • <Text strong>Tamanho dos blocos de texto</Text>: afeta velocidade e precisão; recomendamos 5000 caracteres<br />
                • <Text strong>Pontuação mínima</Text>: somente clipes acima desse valor serão mantidos<br />
                • <Text strong>Clipes por coleção</Text>: controla quantos clipes cada coleção temática pode conter
              </Paragraph>
            </div>
            
          </Space>
        </Card>
      </div>
    </Content>
  )
}

export default SettingsPage