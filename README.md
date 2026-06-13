# FlexJob

FlexJob é um projeto de marketplace de trabalho temporário em Portugal.

O projeto inclui:
- frontend em React + TypeScript + Vite
- backend em ASP.NET Core (.NET 8)
- base de dados SQLite (via Microsoft.Data.Sqlite)

O objetivo é ligar empresas/particulares que precisam de serviços com trabalhadores flexíveis disponíveis.

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

- `frontend/` - aplicação React + TypeScript
- `backend/` - API ASP.NET Core e lógica de autenticação
- `docker-compose.yml` - orquestração do frontend e backend (a base de dados SQLite fica num volume local em `./data/`)

## Pré-requisitos

Instale as seguintes ferramentas no seu computador:

1. Git: https://git-scm.com/
2. Node.js LTS: https://nodejs.org/
3. .NET 8 SDK: https://dotnet.microsoft.com/
4. Docker Desktop: https://www.docker.com/products/docker-desktop

> O Docker é a forma mais fácil de correr o projeto com frontend, backend e base de dados juntos.

## Como começar

### Opção 1 - Executar com Docker Compose (recomendado)

No diretório raiz do projeto:

```bash
docker compose up --build
```

O Docker irá iniciar:
- frontend em `http://localhost:5173`
- backend em `http://localhost:8080`

Para parar:

```bash
docker compose down
```

### Opção 2 - Executar apenas o frontend localmente

```bash
cd frontend
npm install
npm run dev
```

Depois abra no navegador o endereço que o Vite mostrar, normalmente:

```bash
http://localhost:5173
```

### Opção 3 - Executar apenas o backend localmente

```bash
cd backend
dotnet restore
dotnet run
```

O backend ficará disponível em:

```bash
http://localhost:8080
```

> Se executar o backend localmente sem Docker, o ficheiro SQLite é criado automaticamente em `flexjob.db` na pasta `backend/`. Pode alterar o caminho com a variável de ambiente `DB_PATH`.

## Branch principal: `main` vs `master`

No Git, `main` e `master` são apenas nomes de branch; não há diferença técnica entre eles. O GitHub mudou a branch padrão para `main` nos últimos anos, mas projetos mais antigos ainda podem usar `master`.

Neste projeto vamos usar `main` porque é o nome mais comum hoje.

## Como publicar no GitHub

1. Inicialize o repositório Git localmente (se ainda não estiver inicializado):

```bash
git init
```

2. Adicione todos os ficheiros e faça o primeiro commit:

```bash
git add .
git commit -m "Initial commit for FlexJob"
```

3. Adicione o remoto GitHub e envie para `main`:

```bash
git remote add origin https://github.com/SergioKylo/FlexJob.git
git branch -M main
git push -u origin main
```

4. Se quiser remover a branch `master` do GitHub depois de confirmar que `main` está OK:

```bash
git push origin --delete master
```

## Observações importantes

- O frontend está configurado com Leaflet e OpenStreetMap.
- O backend usa cookies para autenticação e uma base de dados SQLite.
- O `docker-compose.yml` inclui frontend e backend (SQLite não requer serviço separado).
- O projeto é uma demo e precisa de melhorias de segurança antes de produção.

## Próximos passos

- Adicionar autenticação real com JWT ou OAuth
- Validação de formulários e regras de negócio
- Guardar dados reais em base de dados
- Proteger passwords e usar HTTPS
- Fazer deploy num serviço em nuvem
