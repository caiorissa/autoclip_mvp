# AutoClip MVP Frontend

Aplicação frontend para clipping automático de vídeos, construída com React, TypeScript, Vite e Ant Design.

## Recursos

### 🎯 Principais funções
- **Upload de vídeo**: envie vídeos e arquivos de legenda por clique ou arrastando os arquivos.
- **Processamento inteligente**: a IA identifica e seleciona trechos relevantes do vídeo.
- **Gerenciamento de clipes**: visualize, edite e baixe os clipes gerados.
- **Criação de coleções**: use coleções recomendadas pela IA ou crie coleções manualmente.
- **Monitoramento em tempo real**: acompanhe o progresso do processamento.

### 🎨 Interface
- **Design moderno**: baseado em componentes do Ant Design.
- **Layout responsivo**: compatível com desktop e dispositivos móveis.
- **Uso intuitivo**: reordenação por arrastar e ações rápidas de download.
- **Feedback de status**: progresso e estados de processamento claros.

## Tecnologias

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI**: Ant Design
- **Estado**: Zustand
- **Rotas**: React Router DOM
- **HTTP**: Axios
- **Arrastar e soltar**: React Beautiful DnD
- **Reprodução de vídeo**: React Player
- **Upload**: React Dropzone

## Início rápido

### Requisitos
- Node.js >= 16
- npm ou yarn

### Instalar dependências
```bash
npm install
# ou
yarn install
```

### Iniciar o servidor de desenvolvimento
```bash
npm run dev
# ou
yarn dev
```

Acesse o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

### Gerar build de produção
```bash
npm run build
# ou
yarn build
```

## Estrutura do projeto

```text
frontend/
├── public/                    # Arquivos estáticos
├── src/
│   ├── components/            # Componentes reutilizáveis
│   │   ├── Header.tsx         # Cabeçalho
│   │   ├── FileUpload.tsx     # Upload de arquivos
│   │   ├── ProjectCard.tsx    # Card de projeto
│   │   ├── ClipCard.tsx       # Card de clipe
│   │   └── CollectionCard.tsx # Card de coleção
│   ├── pages/                 # Páginas
│   │   ├── HomePage.tsx       # Página inicial
│   │   └── ProjectDetailPage.tsx # Detalhes do projeto
│   ├── services/              # Serviços de API
│   │   └── api.ts             # Definições da API
│   ├── store/                 # Estado global
│   │   └── useProjectStore.ts # Estado dos projetos
│   ├── App.tsx                # Componente principal
│   ├── main.tsx               # Entrada da aplicação
│   └── index.css              # Estilos globais
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Páginas

### Página inicial (`/`)
- Lista de projetos
- Busca e filtros
- Importação de vídeos
- Monitoramento do status dos projetos

### Detalhes do projeto (`/project/:id`)
- Informações e status do projeto
- Gerenciamento dos clipes
- Coleções recomendadas pela IA
- Criação manual de coleções
- Downloads e exportações

## Componentes principais

### FileUpload
- Upload por clique ou arrastar e soltar
- Validação de tipos de arquivo
- Progresso do upload
- Criação automática do projeto

### ProjectCard
- Informações do projeto
- Indicadores de status
- Ações rápidas
- Barra de progresso

### ClipCard
- Informações do clipe
- Prévia online
- Edição e download
- Adição a coleções

### CollectionCard
- Informações da coleção
- Gerenciamento da lista de clipes
- Reordenação por arrastar
- Geração do vídeo da coleção

## API

O frontend se comunica com o backend por meio do proxy `/api`. Entre os principais endpoints estão:

- `GET /api/projects` - lista os projetos
- `POST /api/projects` - cria um novo projeto
- `GET /api/projects/:id` - obtém os detalhes do projeto
- `POST /api/projects/:id/upload` - envia arquivos
- `POST /api/projects/:id/process` - inicia o processamento
- `GET /api/projects/:id/status` - obtém o status do processamento
- `PUT /api/projects/:id/clips/:clipId` - atualiza um clipe
- `PUT /api/projects/:id/collections/:collectionId` - atualiza uma coleção
- `GET /api/projects/:id/download` - baixa um vídeo

## Desenvolvimento

### Estado
O Zustand é usado para gerenciar:
- lista de projetos e projeto atual;
- dados de clipes e coleções;
- estados de carregamento e erros.

### Estilos
- Tema baseado no Ant Design
- Layout responsivo
- Espaçamentos e bordas consistentes
- Scrollbars e efeitos de hover personalizados

### Tipagem
As estruturas de dados usam tipos TypeScript para melhorar a segurança e a manutenção do código.

## Deploy

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm run preview
```

### Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Melhorias futuras

### Recursos
- [ ] Edição de vídeo no navegador
- [ ] Operações em lote
- [ ] Exportação em vários formatos
- [ ] Controle de usuários e permissões
- [ ] Integração com armazenamento em nuvem

### Desempenho
- [ ] Rolagem virtual
- [ ] Carregamento preguiçoso de imagens
- [ ] Divisão de código
- [ ] Estratégias de cache

### Experiência do usuário
- [ ] Atalhos de teclado
- [ ] Alternância de tema
- [ ] Internacionalização
- [ ] Acessibilidade

## Contribuição

1. Faça um fork do projeto.
2. Crie uma branch para sua alteração.
3. Faça os commits.
4. Envie a branch.
5. Abra um Pull Request.

## Licença

MIT License
