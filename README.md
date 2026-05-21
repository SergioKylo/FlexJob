# FlexJob

FlexJob é um projeto de marketplace de trabalho temporário em Portugal, com:
- frontend em React + TypeScript + Vite
- backend em ASP.NET Core (.NET 8)
- base de dados MySQL via Docker Compose

O objetivo é ligar rapidamente empresas/particulares que precisam de serviços com trabalhadores flexíveis disponíveis.

## Estrutura do repositório

- `frontend/` - aplicação React + TypeScript
- `backend/` - API ASP.NET Core e lógica de autenticação
- `docker-compose.yml` - orquestração das três peças: frontend, backend e MySQL

## Pré-requisitos

Instale os seguintes itens no seu computador:

1. Git: https://git-scm.com/
2. Node.js LTS: https://nodejs.org/
3. .NET 8 SDK: https://dotnet.microsoft.com/
4. Docker Desktop: https://www.docker.com/products/docker-desktop

> Se não usar Docker, o frontend e backend também podem ser executados localmente separadamente.

## Como começar

### 1. Executar usando Docker Compose

No diretório raiz do projeto:

```bash
docker compose up --build
```

O Docker irá criar e executar:
- frontend na porta `5173`
- backend na porta `8080`
- MySQL na porta `3306`

### 2. Executar apenas o frontend localmente

```bash
cd frontend
npm install
npm run dev
```

Depois abra no navegador o endereço que o Vite mostrar, normalmente:

```bash
http://localhost:5173
```

### 3. Executar apenas o backend localmente

```bash
cd backend
dotnet restore
dotnet run
```

O backend ficará disponível em:

```bash
http://localhost:8080
```

> O backend usa MySQL. Para executar localmente sem Docker, deve ter uma instância MySQL disponível e atualizar a string de ligação em `backend/Program.cs` ou em variáveis de ambiente.

## Como publicar no GitHub

1. Inicializar o repositório Git localmente:

```bash
git init
```

2. Adicionar todos os ficheiros e fazer o primeiro commit:

```bash
git add .
git commit -m "Initial commit for FlexJob"
```

3. Criar um repositório no GitHub (pelo site) e copiar o URL remoto.

4. Adicionar o remoto e enviar:

```bash
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git branch -M main
git push -u origin main
```

## Observações importantes

- O frontend está configurado com Leaflet e OpenStreetMap.
- O backend usa cookies para autenticação e uma base de dados MySQL.
- O `docker-compose.yml` já inclui as definições para frontend, backend e MySQL.
- O projeto ainda é uma demo e não está pronto para produção sem ajustes de segurança e dados reais.

## Pontos de melhoria

- Autenticação real com JWT ou OAuth
- Validação de formulários e regras de negócio
- Base de dados real para tarefas e perfis
- Segurança de passwords e conexões HTTPS
- Deploy para um serviço em nuvem
