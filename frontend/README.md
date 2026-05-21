# FlexJob

Aplicacao demo em React + TypeScript para um marketplace de trabalho temporario em Portugal.

FlexJob liga duas entradas no mesmo produto:

- Pessoas/empresas que precisam de ajuda imediata.
- Trabalhadores flexiveis que querem declarar disponibilidade.

O objetivo e reduzir o tempo entre procura e oferta de horas para poucos minutos, usando mapa, reputacao, preco, disponibilidade e tipo de tarefa.

## Tecnologias

- React
- TypeScript
- Vite
- Leaflet
- OpenStreetMap
- LocalStorage para demo local

Nao usa Google Maps, Mapbox, Stripe, backend pago ou base de dados paga.

## Instalar para desenvolvimento

Instala primeiro:

1. Node.js LTS: https://nodejs.org/
2. Visual Studio Code: https://code.visualstudio.com/
3. Git: https://git-scm.com/

Depois, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

O Vite vai mostrar um endereco parecido com:

```bash
http://localhost:5173
```

Abre esse endereco no navegador.

## Estrutura

```text
FlexJob/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    App.tsx
    main.tsx
    types.ts
    data/
      mockData.ts
    i18n/
      translations.ts
    pages/
      LandingPage.tsx
      DashboardPage.tsx
      MapPage.tsx
      JobsPage.tsx
      WalletPage.tsx
      ProfilePage.tsx
    styles/
      global.css
    utils/
      matching.ts
      storage.ts
```

## Paginas

- Landing page com explicacao da aplicacao.
- Criar conta/login demo.
- Dashboard inicial.
- Mapa real com Leaflet e OpenStreetMap.
- Pagina de trabalhos e matches.
- Carteira demo.
- Perfil demo com confianca, competencias e disponibilidade.

## Dados ficticios

A demo inclui empresas, clientes individuais e trabalhadores ficticios, por exemplo:

- Cafe Aurora
- LX Eventos
- Norte Log
- Campus Hub
- Mercado Sol
- Ines Costa
- Miguel Rocha
- Sara Lopes

## O que instalar a seguir

Para transformar em projeto mais serio:

- Supabase: autenticacao gratuita, base de dados Postgres e storage.
- Prisma: modelacao da base de dados se usares backend Node.
- React Hook Form + Zod: formularios e validacao.
- TanStack Query: sincronizacao com API/backend.
- Tailwind CSS ou shadcn/ui: sistema visual mais rapido.
- Vitest + Testing Library: testes automaticos.
- Playwright: testes end-to-end.

## Proximos passos de produto

- Login real com cliente/trabalhador.
- Base de dados real para tarefas, perfis e matches.
- Verificacao de identidade.
- Pagamento real numa fase futura.
- Chat entre cliente e trabalhador.
- Sistema de disputa.
- Painel admin.
- Recibos/faturas conforme regras portuguesas.
