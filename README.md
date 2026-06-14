# FlexJob

FlexJob é um marketplace de trabalho temporário em Portugal que liga empresas e particulares que precisam de serviços a trabalhadores flexíveis disponíveis na sua zona.

O projeto é composto por:

- **Frontend** em React + TypeScript + Vite
- **Backend** em ASP.NET Core (.NET 8), API minimalista
- **Base de dados** SQLite (via Microsoft.Data.Sqlite)

## Funcionalidades

- **Três tipos de conta:** trabalhador, empregador e administrador.
- **Mapa interativo** (Leaflet + OpenStreetMap) com as vagas e os trabalhadores próximos.
- **Disponibilidade do trabalhador:** região, tarifa horária, raio de ação, horário, categoria e dias da semana disponíveis.
- **Vagas e propostas:** o empregador publica vagas ou propõe um trabalho diretamente a um trabalhador; o trabalhador aceita ou recusa.
- **Pagamentos em garantia (escrow):** o pagamento é descontado da carteira do empregador, fica retido, e é libertado para o trabalhador quando o trabalho é confirmado. Inclui gorjetas e carteira digital com histórico.
- **Chat** entre as partes, com avaliações (estrelas) no fim do trabalho e perfis com as avaliações recebidas.
- **Notificações:** sino no topo com contagem de não lidas + avisos (toasts) no canto superior direito.
- **Painel de administração:** estatísticas, gestão de utilizadores e vagas, leitura de conversas e moderação — sistema de avisos em que **3 avisos = suspensão de 30 dias** (o admin pode remover avisos ou desbanir).
- **Internacionalização** (Português / Inglês) e **tema claro/escuro**.

## Contas de demonstração

Todas usam a palavra-passe `123456`:

| Tipo | Email |
|------|-------|
| Trabalhador | `ines@email.com`, `miguel@email.com`, `sara@email.com`, `beatriz@email.com` |
| Empregador | `cafeaurora@email.com`, `lxeventos@email.com`, `nortelog@email.com` |
| Administrador | `admin@flexjob.com` |

## Estrutura do repositório

- `frontend/` — aplicação React + TypeScript
- `backend/` — API ASP.NET Core e lógica de autenticação
- `docker-compose.yml` — orquestração do frontend e backend (a base de dados SQLite fica num volume local em `./data/`)

## Pré-requisitos

Para correr o projeto com Docker (recomendado) basta instalar:

- [Docker Desktop](https://www.docker.com/products/docker-desktop)

Para correr o frontend ou o backend separadamente, sem Docker:

- [Node.js LTS](https://nodejs.org/) — para o frontend
- [.NET 8 SDK](https://dotnet.microsoft.com/) — para o backend

## Como executar

### Opção 1 — Docker Compose (recomendado)

No diretório raiz do projeto:

```bash
docker compose up --build
```

Ficam disponíveis:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

Para parar:

```bash
docker compose down
```

### Opção 2 — Apenas o frontend

```bash
cd frontend
npm install
npm run dev
```

Abra no navegador o endereço que o Vite mostrar (normalmente `http://localhost:5173`).

### Opção 3 — Apenas o backend

```bash
cd backend
dotnet restore
dotnet run
```

O backend fica disponível em `http://localhost:8080`.

> Sem Docker, o ficheiro SQLite é criado automaticamente em `flexjob.db` na pasta `backend/`. O caminho pode ser alterado com a variável de ambiente `DB_PATH`.

## Notas técnicas

- Autenticação por **cookies** (`FlexJobSession`); as palavras-passe são guardadas com SHA-256.
- O backend define todas as rotas inline em `Program.cs` (Minimal API) e usa `Database.cs` como única camada de acesso aos dados.
- As fotos das vagas são guardadas como base64 numa coluna `TEXT`.
- Este projeto é uma **demonstração académica** — não está preparado para produção.

## Possíveis melhorias futuras

- Autenticação real com JWT ou OAuth e palavras-passe individuais por utilizador
- Validação de formulários e regras de negócio mais robustas
- HTTPS e reforço geral de segurança
- Deploy num serviço em nuvem
