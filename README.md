# Integrativa – Ambiente Dockerizado

Este repositório oferece um ambiente completo em contêineres para a aplicação Integrativa, composto por:

- **Frontend** Angular (servido via NGINX).
- **Backend** ASP.NET Core 8.
- **Banco de Dados** PostgreSQL.

Tudo é orquestrado via `docker-compose` para que qualquer pessoa possa subir o projeto rapidamente, sem etapas manuais.

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) (Engine ou Desktop).
- [Docker Compose](https://docs.docker.com/compose/) v2 ou superior (já embutido no Docker Desktop).

Verifique se os comandos `docker --version` e `docker compose version` estão disponíveis no terminal.

---

## Subindo o ambiente

1. Clone o repositório.
2. Na raiz do projeto, execute:

   ```bash
   docker compose up --build
   ```

   O primeiro `--build` garante que as imagens do backend e do frontend sejam geradas.

3. Aguarde a conclusão do build. Ao final, os serviços estarão disponíveis em:

   | Serviço   | URL                         | Descrição                         |
   |-----------|-----------------------------|-----------------------------------|
   | Frontend  | http://localhost:8080       | SPA Angular servida via NGINX     |
   | Backend   | http://localhost:5500/api   | API ASP.NET Core (exposto externamente) |
   | PostgreSQL| localhost:5432 (externo)    | Banco de dados                    |

   > As requisições feitas pelo frontend para `/api/...` são automaticamente encaminhadas pelo NGINX do contêiner para o backend, eliminando problemas de CORS. O endereço externo `http://localhost:5500` fica disponível apenas para inspeção direta da API (opcional).

4. O frontend detecta automaticamente a URL da API quando está rodando em produção (docker). Durante o desenvolvimento local (`ng serve` na porta 4200), ele continua apontando para `http://localhost:5000`.

5. Credenciais padrão:

   | Serviço            | Usuário | Senha       |
   |--------------------|---------|-------------|
   | Painel Integrativa | admin   | Senha@123   |
   | Banco PostgreSQL   | integrativa | senha_forte |

6. Para encerrar os serviços:

   ```bash
   docker compose down
   ```

   Para remover também os dados do banco (volume):

   ```bash
   docker compose down -v
   ```

---

## Estrutura dos contêineres

- `integrativa_frontend`: constrói a aplicação Angular e serve os arquivos com NGINX (porta 8080).
- `integrativa_api`: publica o projeto ASP.NET Core e expõe a API internamente na porta 5000 (mapeada externamente para 5500). O connection string e as credenciais de autenticação são fornecidos via variáveis de ambiente.
- `integrativa_db`: instancia o PostgreSQL 15 com um volume persistente (`db_data`).

O backend cria automaticamente as tabelas necessárias na primeira execução, graças ao método `CriarTabelasSeNecessario`.

---

## Customizações rápidas

- **Alterar portas externas**: ajuste as portas mapeadas na seção `ports` do `docker-compose.yml`. Se trocar a porta pública do backend, o proxy do NGINX continua funcionando sem alterações adicionais.
- **Modificar credenciais/segredo**: atualize as variáveis de ambiente do serviço `backend` no `docker-compose.yml`.
- **Mudar a URL da API no frontend em ambiente de desenvolvimento**: caso utilize outra porta para o backend local, ajuste a função `resolverApiBase()` em `frontend/src/app/core/services/*.service.ts`.

Após qualquer alteração, execute novamente:

```bash
docker compose up --build
```

---

## Solução de problemas

- **Portas já em uso**: ajuste as portas mapeadas em `docker-compose.yml` ou encerre o processo que ocupa a porta.
- **Erros de build no frontend**: certifique-se de ter memória suficiente. Você também pode experimentar `npm ci --legacy-peer-deps` caso utilize uma versão antiga de dependências.
- **Reset do banco**: use `docker compose down -v` para remover o volume persistente e iniciar com um banco novo.

---

Com isso, o ambiente dockerizado está pronto para uso. Bons testes! 🚀

==============

# Executando Localmente (sem Docker)

Se preferir rodar cada parte manualmente, siga as instruções abaixo. Esse modo é útil para desenvolvimento diário ou quando você precisa depurar o backend/frontend separadamente.

---

## Pré-requisitos

Instale as dependências na sua máquina:

1. **.NET SDK 8.0**
   - Download: <https://dotnet.microsoft.com/pt-br/download/dotnet/8.0>
   - Verifique a instalação: `dotnet --version`

2. **Node.js 20.x + npm**
   - Download: <https://nodejs.org/en/download/>
   - Verifique: `node --version` e `npm --version`

3. **PostgreSQL 15** (ou superior compatível)
   - Download: <https://www.postgresql.org/download/>
   - Garanta acesso ao utilitário `psql` para executar scripts SQL.

4. **Ferramenta de migração/opcional**
   - Opcionalmente, você pode usar clientes como pgAdmin, DBeaver ou TablePlus para inspecionar o banco.

---

## Configurando o banco de dados

1. Crie um banco chamado `integrativa` e um usuário `integrativa` com senha `senha_forte` (ou escolha as credenciais que preferir).
mas lembre de mudar no arquivo appsettings.json e no appsettings.Development.json caso dev mode.

   Exemplo via psql:

   ```sql
   CREATE DATABASE integrativa;
   CREATE USER integrativa WITH ENCRYPTED PASSWORD 'senha_forte';
   GRANT ALL PRIVILEGES ON DATABASE integrativa TO integrativa;
   ```

2. Ajuste a string de conexão em `backend/integrativa_api/appsettings.Development.json`, se necessário:

   ```json
   "ConnectionStrings": {
     "Default": "Host=localhost;Port=5432;Database=integrativa;Username=integrativa;Password=senha_forte"
   }
   ```

3. Ao iniciar a API, o método `CriarTabelasSeNecessario` criará automaticamente as tabelas.

---

## Rodando o backend (.NET)

1. No terminal, navegue até a pasta `backend/integrativa_api`.
2. Execute:

   ```bash
   dotnet restore
   dotnet run
   ```

3. A API ficará disponível em `http://localhost:5000`. As credenciais padrão (configuradas em `appsettings.Development.json`) são:

   - Usuário: `admin`
   - Senha: `Senha@123`
   - Segredo JWT: `integrativa_super_secreta_chave_123456`

   Ajuste esses valores conforme necessário.

---

## Rodando o frontend (Angular)

1. Abra um novo terminal e vá até `frontend`.
2. Instale dependências:

   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:

   ```bash
   npm start
   ```

4. A aplicação ficará acessível em `http://localhost:4200`. O frontend detecta que está em modo desenvolvimento e usa a API em `http://localhost:5000`.

---

## Fluxo de desenvolvimento

- Backend e frontend podem ser executados simultaneamente em terminais diferentes.
- Após alterar a API, recompilará automaticamente (por causa do `dotnet run`). O Angular recarrega o navegador ao salvar arquivos.
- Se a API estiver em outra porta, ajuste a função `resolverApiBase()` em `frontend/src/app/core/services/auth.service.ts` e `processos.service.ts`.

---

## Parando os serviços

- Backend: finalize o processo (`Ctrl+C` no terminal).
- Frontend: finalize o processo (`Ctrl+C` no terminal).
- Banco: apenas mantenha o PostgreSQL rodando como serviço; se quiser derrubar, siga os procedimentos da sua instalação (ex.: `brew services stop postgresql` no macOS, `sudo systemctl stop postgresql` no Linux, etc.).

---

Com isso, você pode optar por executar a aplicação via Docker ou manualmente, conforme preferir. Boas implementações! 🚀
