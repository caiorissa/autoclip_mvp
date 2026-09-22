import React from 'react'
import { Layout, Card, Form, Input, Button, Typography, Space, Alert, Divider, Row, Col } from 'antd'
import { KeyOutlined, SaveOutlined, ApiOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons'
import './SettingsPage.css'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

const SettingsPageTest: React.FC = () => {
  const [form] = Form.useForm()

  return (
    <Content className="settings-page">
      <div className="settings-container">
        <Title level={2} className="settings-title">
          <SettingOutlined /> Teste das configurações do sistema
        </Title>
        
        <Card title="Configuração da API" className="settings-card">
          <Alert
            message="Como configurar"
            description="Configure uma chave de API para ativar o clipping automático com IA."
            type="info"
            showIcon
            className="settings-alert"
          />
          
          <Form
            form={form}
            layout="vertical"
            className="settings-form"
            initialValues={{
              model_name: 'qwen-plus',
              chunk_size: 5000,
              min_score_threshold: 0.7,
              max_clips_per_collection: 5
            }}
          >
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
                placeholder="Digite a chave da API"
                prefix={<KeyOutlined />}
                className="settings-input"
              />
            </Form.Item>

            <Form.Item className="form-item">
              <Button
                type="default"
                icon={<ApiOutlined />}
                className="test-button"
              >
                Testar conexão
              </Button>
            </Form.Item>

            <Divider className="settings-divider" />

            <Title level={4} className="section-title">Configuração do modelo</Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Nome do modelo"
                  name="model_name"
                  className="form-item"
                >
                  <Input placeholder="qwen-plus" className="settings-input" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Tamanho dos blocos de texto"
                  name="chunk_size"
                  className="form-item"
                >
                  <Input 
                    type="number" 
                    placeholder="5000" 
                    addonAfter="caracteres" 
                    className="settings-input"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Pontuação mínima"
                  name="min_score_threshold"
                  className="form-item"
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
              <Col span={12}>
                <Form.Item
                  label="Máximo de clipes por coleção"
                  name="max_clips_per_collection"
                  className="form-item"
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

            <Form.Item className="form-item">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                size="large"
                className="save-button"
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
                Acesse o painel do seu provedor de IA e crie uma nova chave de API
              </Paragraph>
            </div>
            
            <div className="instruction-item">
              <Title level={5} className="instruction-title">
                <InfoCircleOutlined /> 2. Entender os parâmetros
              </Title>
              <Paragraph className="instruction-text">
                • <Text strong>Tamanho dos blocos de texto</Text>：影响处理速度和精度，建议5000caracteres<br />
                • <Text strong>Pontuação mínima</Text>: somente clipes acima desse valor serão mantidos<br />
                • <Text strong>Clipes por coleção</Text>: controla quantos clipes cada coleção temática pode conter
              </Paragraph>
            </div>
            
            <div className="instruction-item">
              <Title level={5} className="instruction-title">
                <InfoCircleOutlined /> 3. Testar conexão
              </Title>
              <Paragraph className="instruction-text">
                Antes de salvar, teste a chave da API para verificar se o serviço está funcionando
              </Paragraph>
            </div>
          </Space>
        </Card>
      </div>
    </Content>
  )
}

export default SettingsPageTest 