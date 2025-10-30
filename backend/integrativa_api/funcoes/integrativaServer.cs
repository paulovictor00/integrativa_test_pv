using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Npgsql;
using MongoDB.Bson;

#nullable enable

namespace integrativa_api.funcoes
{
    public static class integrativaServer
    {
        const string StatusExcluido = "Excluido";
        public static string Conexao { get; set; } = string.Empty;
        public static BsonDocument Status() => new BsonDocument { { "status", "ON" } };

        public static void ValidaToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                throw new UnauthorizedAccessException("Token ausente.");

            const string prefixo = "Bearer ";
            if (!token.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Cabeçalho Authorization inválido.");

            var conteudo = token[prefixo.Length..].Trim();
            if (!TokenService.ValidarToken(conteudo, out _))
                throw new UnauthorizedAccessException("Token inválido ou expirado.");
        }

        public static void CriarTabelasSeNecessario()
        {
            const string sql = @"
            CREATE TABLE IF NOT EXISTS processos (
                id SERIAL PRIMARY KEY,
                numeroprocesso VARCHAR(100) UNIQUE NOT NULL,
                autor VARCHAR(200) NOT NULL,
                reu VARCHAR(200) NOT NULL,
                tribunal VARCHAR(50),
                dataajuizamento DATE NOT NULL,
                status VARCHAR(50) NOT NULL,
                descricao TEXT
            );

            CREATE TABLE IF NOT EXISTS historicos (
                id SERIAL PRIMARY KEY,
                processoid INT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
                descricao TEXT NOT NULL,
                datainclusao TIMESTAMP NOT NULL,
                dataalteracao TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS movimentacoes (
                id SERIAL PRIMARY KEY,
                processoid INT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
                descricao TEXT NOT NULL,
                datainclusao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                dataalteracao TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(200) NOT NULL,
                usuario VARCHAR(100) UNIQUE NOT NULL,
                senha_hash VARCHAR(200) NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP
            );
            ";

            using var cn = CreateConnection();
            cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn);
            cmd.ExecuteNonQuery();

            using var alter = new NpgsqlCommand("ALTER TABLE processos ADD COLUMN IF NOT EXISTS tribunal VARCHAR(50);", cn);
            alter.ExecuteNonQuery();
        }

        static NpgsqlConnection CreateConnection()
        {
            if (string.IsNullOrWhiteSpace(Conexao))
                throw new InvalidOperationException("Connection string não configurada.");
            return new NpgsqlConnection(Conexao);
        }

        static int ExecNonQuery(string sql, params (string, object?)[] pars)
        {
            using var cn = CreateConnection();
            cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn);
            foreach (var p in pars)
                cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
            return cmd.ExecuteNonQuery();
        }

        static object? ExecScalar(string sql, params (string, object?)[] pars)
        {
            using var cn = CreateConnection();
            cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn);
            foreach (var p in pars)
                cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
            return cmd.ExecuteScalar();
        }

        static BsonDocument ExecSelect(string sql, params (string, object?)[] pars)
        {
            var lista = new BsonArray();
            using var cn = CreateConnection();
            cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn);
            foreach (var p in pars)
                cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
            using var rd = cmd.ExecuteReader();
            while (rd.Read())
            {
                var doc = new BsonDocument();
                for (int i = 0; i < rd.FieldCount; i++)
                {
                    var valor = rd.GetValue(i);
                    if (valor is DBNull)
                    {
                        doc[rd.GetName(i)] = BsonNull.Value;
                    }
                    else
                    {
                        doc[rd.GetName(i)] = BsonValue.Create(valor);
                    }
                }
                lista.Add(doc);
            }

            return new BsonDocument { { "resultado", lista } };
        }

        static DateTime ReadUtc(BsonDocument b, string key, DateTime def)
        {
            if (!b.TryGetValue(key, out var v) || v.IsBsonNull)
                return def;

            if (v.IsValidDateTime)
                return v.ToUniversalTime();

            if (v.IsString && DateTime.TryParse(v.AsString, System.Globalization.CultureInfo.InvariantCulture,
                                                System.Globalization.DateTimeStyles.AssumeUniversal |
                                                System.Globalization.DateTimeStyles.AdjustToUniversal,
                                                out var parsed))
            {
                return parsed;
            }

            return def;
        }

        public static void ConfigurarCredenciais(string usuario, string senha)
        {
            if (string.IsNullOrWhiteSpace(usuario) || string.IsNullOrWhiteSpace(senha))
                throw new InvalidOperationException("Credenciais da API não configuradas.");

            GarantirUsuario(usuario, usuario, senha);
        }

        public static BsonDocument Login(string usuario, string senha)
        {
            if (string.IsNullOrWhiteSpace(usuario) || string.IsNullOrWhiteSpace(senha))
                throw new UnauthorizedAccessException("Credenciais inválidas.");

            var usuarioEncontrado = ObterUsuario(usuario);
            if (usuarioEncontrado is null)
                throw new UnauthorizedAccessException("Credenciais inválidas.");

            var hashInformado = HashSenha(senha);
            if (!string.Equals(hashInformado, usuarioEncontrado.Value.SenhaHash, StringComparison.Ordinal))
                throw new UnauthorizedAccessException("Credenciais inválidas.");

            var token = TokenService.GerarToken(usuarioEncontrado.Value.Usuario);
            var expiraEm = DateTime.UtcNow.AddMinutes(TokenService.ValidadeEmMinutos).ToString("o");
            return new BsonDocument
            {
                { "token", token },
                { "expiraEm", expiraEm },
                { "usuario", usuarioEncontrado.Value.Nome }
            };
        }

        public static BsonDocument RegistrarUsuario(string nome, string usuario, string senha)
        {
            if (string.IsNullOrWhiteSpace(nome))
                throw new ArgumentException("Nome é obrigatório.");

            if (string.IsNullOrWhiteSpace(usuario))
                throw new ArgumentException("Usuário é obrigatório.");

            if (string.IsNullOrWhiteSpace(senha) || senha.Length < 4)
                throw new ArgumentException("Senha deve ter ao menos 4 caracteres.");

            var existente = ObterUsuario(usuario);
            if (existente is not null)
                throw new InvalidOperationException("Usuário já cadastrado.");

            var hash = HashSenha(senha);
            ExecNonQuery(
                "INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (@n,@u,@s)",
                ("@n", nome.Trim()),
                ("@u", usuario.Trim()),
                ("@s", hash)
            );

            return new BsonDocument { { "resultado", "Usuário cadastrado com sucesso." } };
        }

        // ===================== PROCESSOS =====================

        public static BsonDocument ListarProcessos(string token, string? numero)
        {
            ValidaToken(token);
            if (string.IsNullOrWhiteSpace(numero))
            {
                return ExecSelect(
                    "SELECT * FROM processos WHERE status <> @statusExcluido ORDER BY id DESC",
                    ("@statusExcluido", StatusExcluido)
                );
            }

            return ExecSelect(
                "SELECT * FROM processos WHERE status <> @statusExcluido AND numeroprocesso ILIKE @n ORDER BY id DESC",
                ("@statusExcluido", StatusExcluido),
                ("@n", "%" + numero + "%")
            );
        }

        public static BsonDocument ListarUltimosProcessos(string token, int pagina, int tamanho, string? numero, string? autor, string? reu, string? status)
        {
            ValidaToken(token);

            if (pagina < 1) pagina = 1;
            if (tamanho < 1) tamanho = 5;
            if (tamanho > 50) tamanho = 50;

            var offset = (pagina - 1) * tamanho;

            var parametrosFiltro = new List<(string, object?)>();
            var condicoes = new List<string>
            {
                "status <> @statusExcluido"
            };
            parametrosFiltro.Add(("@statusExcluido", StatusExcluido));

            if (!string.IsNullOrWhiteSpace(numero))
            {
                var apenasDigitos = new string(numero.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrWhiteSpace(apenasDigitos))
                {
                    parametrosFiltro.Add(("@numero", "%" + apenasDigitos + "%"));
                    condicoes.Add("numeroprocesso ILIKE @numero");
                }
            }

            if (!string.IsNullOrWhiteSpace(autor))
            {
                parametrosFiltro.Add(("@autor", "%" + autor.Trim() + "%"));
                condicoes.Add("autor ILIKE @autor");
            }

            if (!string.IsNullOrWhiteSpace(reu))
            {
                parametrosFiltro.Add(("@reu", "%" + reu.Trim() + "%"));
                condicoes.Add("reu ILIKE @reu");
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                parametrosFiltro.Add(("@status", status.Trim()));
                condicoes.Add("status = @status");
            }

            var where = condicoes.Count > 0 ? " WHERE " + string.Join(" AND ", condicoes) : string.Empty;

            var parametrosDados = new List<(string, object?)>(parametrosFiltro)
            {
                ("@limite", tamanho),
                ("@offset", offset)
            };

            var selecao = ExecSelect(
                "SELECT id, numeroprocesso, autor, reu, tribunal, dataajuizamento, status, descricao FROM processos" +
                where +
                " ORDER BY id DESC LIMIT @limite OFFSET @offset",
                parametrosDados.ToArray()
            );

            var totalObj = ExecScalar("SELECT COUNT(1) FROM processos" + where, parametrosFiltro.ToArray());
            var total = totalObj is null ? 0 : Convert.ToInt32(totalObj);

            var itensOrigem = selecao.GetValue("resultado", new BsonArray()).AsBsonArray;
            var itens = new BsonArray();
            foreach (var item in itensOrigem)
            {
                var linha = item.AsBsonDocument;
                var doc = new BsonDocument
                {
                    { "id", linha.GetValue("id", BsonNull.Value) },
                    { "numeroProcesso", linha.GetValue("numeroprocesso", BsonNull.Value) },
                    { "autor", linha.GetValue("autor", BsonNull.Value) },
                    { "reu", linha.GetValue("reu", BsonNull.Value) },
                    { "tribunal", linha.GetValue("tribunal", new BsonString(string.Empty)) },
                    { "dataAjuizamento", FormatarData(linha.GetValue("dataajuizamento", BsonNull.Value)) },
                    { "status", linha.GetValue("status", BsonNull.Value) },
                    { "descricao", linha.GetValue("descricao", new BsonString(string.Empty)) }
                };
                itens.Add(doc);
            }

            return new BsonDocument
            {
                { "itens", itens },
                { "pagina", pagina },
                { "tamanhoPagina", tamanho },
                { "totalRegistros", total }
            };
        }

        public static BsonDocument ObterProcesso(string token, int id)
        {
            ValidaToken(token);

            var procDoc = ExecSelect(
                "SELECT id, numeroprocesso, autor, reu, tribunal, dataajuizamento, status, descricao FROM processos WHERE id=@id",
                ("@id", id)
            );

            var processos = procDoc.GetValue("resultado", new BsonArray()).AsBsonArray;
            if (processos.Count == 0)
                throw new KeyNotFoundException("Processo não encontrado.");

            var processo = processos[0].AsBsonDocument;
            var statusAtual = processo.GetValue("status", new BsonString(string.Empty)).AsString;
            if (string.Equals(statusAtual, StatusExcluido, StringComparison.OrdinalIgnoreCase))
                throw new KeyNotFoundException("Processo não encontrado.");

            var historicosRaw = ExecSelect(
                "SELECT id, processoid, descricao, datainclusao, dataalteracao FROM historicos WHERE processoid=@id ORDER BY id DESC",
                ("@id", id)
            ).GetValue("resultado", new BsonArray()).AsBsonArray;

            var historicos = new BsonArray();
            foreach (var item in historicosRaw)
            {
                var h = item.AsBsonDocument;
                historicos.Add(new BsonDocument
                {
                    { "id", h.GetValue("id", BsonNull.Value) },
                    { "descricao", h.GetValue("descricao", BsonNull.Value) },
                    { "dataInclusao", h.GetValue("datainclusao", BsonNull.Value) },
                    { "dataAlteracao", h.GetValue("dataalteracao", BsonNull.Value) }
                });
            }

            return new BsonDocument
            {
                { "id", processo.GetValue("id", BsonNull.Value) },
                { "numeroProcesso", processo.GetValue("numeroprocesso", BsonNull.Value) },
                { "autor", processo.GetValue("autor", BsonNull.Value) },
                { "reu", processo.GetValue("reu", BsonNull.Value) },
                { "tribunal", processo.GetValue("tribunal", new BsonString(string.Empty)) },
                { "dataAjuizamento", FormatarData(processo.GetValue("dataajuizamento", BsonNull.Value)) },
                { "status", processo.GetValue("status", BsonNull.Value) },
                { "descricao", processo.GetValue("descricao", new BsonString(string.Empty)) },
                { "historicos", historicos }
            };
        }

        public static BsonDocument Processos(string token, BsonDocument body)
        {
            ValidaToken(token);

            var op = body.GetValue("op", "").AsString.ToLowerInvariant();
            if (op == "inserir")
            {
                var numero = body.GetValue("NumeroProcesso", "").AsString;
                var autor  = body.GetValue("Autor", "").AsString;
                var reu    = body.GetValue("Reu", "").AsString;
                var tribunal = body.GetValue("Tribunal", "").AsString;
                tribunal = string.IsNullOrWhiteSpace(tribunal) ? string.Empty : tribunal.Trim().ToUpperInvariant();
                var data   = ReadUtc(body, "DataAjuizamento", DateTime.UtcNow);
                var status = body.GetValue("Status", "EmAndamento").AsString;
                var desc   = body.GetValue("Descricao", "").AsString;

                var existente = ExecScalar("SELECT id FROM processos WHERE numeroprocesso=@n LIMIT 1", ("@n", numero));
                if (existente != null)
                {
                    var idExistente = Convert.ToInt32(existente);
                    var linhasAtualizadas = ExecNonQuery(
                        "UPDATE processos SET autor=@a, reu=@r, tribunal=@t, dataajuizamento=@d, status=@s, descricao=@desc WHERE id=@id",
                        ("@a", autor), ("@r", reu), ("@t", string.IsNullOrWhiteSpace(tribunal) ? DBNull.Value : tribunal),
                        ("@d", data), ("@s", status), ("@desc", (object?)desc ?? DBNull.Value), ("@id", idExistente)
                    );
                    return new BsonDocument
                    {
                        { "resultado", "Processo já existia e foi atualizado." },
                        { "linhas", linhasAtualizadas },
                        { "id", idExistente }
                    };
                }

                var idGeradoObj = ExecScalar(
                    "INSERT INTO processos (numeroprocesso, autor, reu, tribunal, dataajuizamento, status, descricao) " +
                    "VALUES (@n,@a,@r,@t,@d,@s,@desc) RETURNING id",
                    ("@n", numero), ("@a", autor), ("@r", reu), ("@t", string.IsNullOrWhiteSpace(tribunal) ? DBNull.Value : tribunal),
                    ("@d", data), ("@s", status), ("@desc", (object?)desc ?? DBNull.Value)
                );

                var idGerado = idGeradoObj is null ? 0 : Convert.ToInt32(idGeradoObj);
                return new BsonDocument { { "resultado", "Processo cadastrado." }, { "id", idGerado } };
            }
            else if (op == "editar")
            {
                var id     = body.GetValue("Id", 0).ToInt32();
                var numero = body.GetValue("NumeroProcesso", "").AsString;
                var autor  = body.GetValue("Autor", "").AsString;
                var reu    = body.GetValue("Reu", "").AsString;
                var tribunal = body.GetValue("Tribunal", "").AsString;
                tribunal = string.IsNullOrWhiteSpace(tribunal) ? string.Empty : tribunal.Trim().ToUpperInvariant();
                var data   = ReadUtc(body, "DataAjuizamento", DateTime.UtcNow);
                var status = body.GetValue("Status", "EmAndamento").AsString;
                var desc   = body.GetValue("Descricao", "").AsString;

                var existe = ExecScalar("SELECT 1 FROM processos WHERE numeroprocesso=@n AND id<>@id LIMIT 1",
                                        ("@n", numero), ("@id", id));
                if (existe != null) throw new InvalidOperationException("Número de processo já existe.");

                var linhas = ExecNonQuery(
                    "UPDATE processos SET numeroprocesso=@n, autor=@a, reu=@r, tribunal=@t, dataajuizamento=@d, status=@s, descricao=@desc WHERE id=@id",
                    ("@n", numero), ("@a", autor), ("@r", reu), ("@t", string.IsNullOrWhiteSpace(tribunal) ? DBNull.Value : tribunal),
                    ("@d", data), ("@s", status), ("@desc", (object?)desc ?? DBNull.Value), ("@id", id)
                );
                return new BsonDocument { { "resultado", "Processo atualizado." }, { "linhas", linhas }, { "id", id } };
            }
            else if (op == "excluir")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var linhas = ExecNonQuery(
                    "UPDATE processos SET status=@status WHERE id=@id",
                    ("@status", StatusExcluido),
                    ("@id", id)
                );
                return new BsonDocument { { "resultado", "Processo excluído." }, { "linhas", linhas } };
            }
            else
            {
                throw new ArgumentException("Op inválida. Use: inserir | editar | excluir.");
            }
        }

        // ===================== MOVIMENTAÇÕES =====================

        public static BsonDocument ListarMovimentacoes(string token, int processoId, int pagina, int tamanho)
        {
            ValidaToken(token);

            if (processoId <= 0)
                throw new ArgumentException("ProcessoId inválido.");

            var existe = ExecScalar(
                "SELECT status FROM processos WHERE id=@p LIMIT 1",
                ("@p", processoId)
            );

            if (existe is null)
                throw new KeyNotFoundException("Processo não encontrado.");

            if (string.Equals(Convert.ToString(existe), StatusExcluido, StringComparison.OrdinalIgnoreCase))
                throw new KeyNotFoundException("Processo não encontrado.");

            if (pagina < 1) pagina = 1;
            if (tamanho < 1) tamanho = 5;
            if (tamanho > 50) tamanho = 50;

            var offset = (pagina - 1) * tamanho;

            var selecao = ExecSelect(
                "SELECT id, processoid, descricao, datainclusao, dataalteracao FROM movimentacoes WHERE processoid=@p ORDER BY id DESC LIMIT @limite OFFSET @offset",
                ("@p", processoId),
                ("@limite", tamanho),
                ("@offset", offset)
            );

            var lista = new BsonArray();
            foreach (var item in selecao.GetValue("resultado", new BsonArray()).AsBsonArray)
            {
                var mov = item.AsBsonDocument;
                lista.Add(new BsonDocument
                {
                    { "id", mov.GetValue("id", BsonNull.Value) },
                    { "descricao", mov.GetValue("descricao", new BsonString(string.Empty)) },
                    { "dataInclusao", FormatarDataHora(mov.GetValue("datainclusao", BsonNull.Value)) },
                    { "dataAlteracao", FormatarDataHora(mov.GetValue("dataalteracao", BsonNull.Value)) }
                });
            }

            var totalObj = ExecScalar(
                "SELECT COUNT(1) FROM movimentacoes WHERE processoid=@p",
                ("@p", processoId)
            );
            var total = totalObj is null ? 0 : Convert.ToInt32(totalObj);

            return new BsonDocument
            {
                { "itens", lista },
                { "pagina", pagina },
                { "tamanhoPagina", tamanho },
                { "totalRegistros", total }
            };
        }

        public static BsonDocument Movimentacoes(string token, BsonDocument body)
        {
            ValidaToken(token);

            var op = body.GetValue("op", "").AsString.ToLowerInvariant();

            if (op == "inserir")
            {
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();
                var descricao = body.GetValue("Descricao", "").AsString;
                var agora = DateTime.UtcNow;

                if (processoId <= 0)
                    throw new ArgumentException("ProcessoId inválido para movimentação.");

                if (string.IsNullOrWhiteSpace(descricao))
                    throw new ArgumentException("Descrição é obrigatória.");

                var existe = ExecScalar(
                    "SELECT status FROM processos WHERE id=@p LIMIT 1",
                    ("@p", processoId)
                );

                if (existe is null)
                    throw new KeyNotFoundException("Processo não encontrado.");

                if (string.Equals(Convert.ToString(existe), StatusExcluido, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Não é possível adicionar movimentações a processos excluídos.");

                var linhas = ExecNonQuery(
                    "INSERT INTO movimentacoes (processoid, descricao, datainclusao) VALUES (@p,@d,@i)",
                    ("@p", processoId),
                    ("@d", descricao),
                    ("@i", agora)
                );

                return new BsonDocument
                {
                    { "resultado", "Movimentação cadastrada." },
                    { "linhas", linhas }
                };
            }
            else if (op == "editar")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();
                var descricao = body.GetValue("Descricao", "").AsString;
                var agora = DateTime.UtcNow;

                if (id <= 0)
                    throw new ArgumentException("Id inválido para movimentação.");

                if (string.IsNullOrWhiteSpace(descricao))
                    throw new ArgumentException("Descrição é obrigatória.");

                var parametros = new List<(string, object?)>
                {
                    ("@d", descricao),
                    ("@a", agora),
                    ("@id", id)
                };

                var sql = "UPDATE movimentacoes SET descricao=@d, dataalteracao=@a WHERE id=@id";
                if (processoId > 0)
                {
                    sql += " AND processoid=@p";
                    parametros.Add(("@p", processoId));
                }

                var linhas = ExecNonQuery(sql, parametros.ToArray());

                return new BsonDocument
                {
                    { "resultado", "Movimentação atualizada." },
                    { "linhas", linhas }
                };
            }
            else if (op == "excluir")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();

                if (id <= 0)
                    throw new ArgumentException("Id inválido para movimentação.");

                var parametros = new List<(string, object?)>
                {
                    ("@id", id)
                };

                var sql = "DELETE FROM movimentacoes WHERE id=@id";
                if (processoId > 0)
                {
                    sql += " AND processoid=@p";
                    parametros.Add(("@p", processoId));
                }

                var linhas = ExecNonQuery(sql, parametros.ToArray());

                return new BsonDocument
                {
                    { "resultado", "Movimentação excluída." },
                    { "linhas", linhas }
                };
            }
            else
            {
                throw new ArgumentException("Op inválida. Use: inserir | editar | excluir.");
            }
        }

        // ===================== HISTÓRICOS =====================

        public static BsonDocument ListarHistoricos(string token, int processoId)
        {
            ValidaToken(token);
            var hist = ExecSelect("SELECT id, processoid, descricao, datainclusao, dataalteracao FROM historicos WHERE processoid=@p ORDER BY id DESC", ("@p", processoId));
            var lista = new BsonArray();
            foreach (var item in hist.GetValue("resultado", new BsonArray()).AsBsonArray)
            {
                var h = item.AsBsonDocument;
                var doc = new BsonDocument
                {
                    { "id", h.GetValue("id", BsonNull.Value) },
                    { "descricao", h.GetValue("descricao", new BsonString(string.Empty)) },
                    { "dataInclusao", FormatarDataHora(h.GetValue("datainclusao", BsonNull.Value)) },
                    { "dataAlteracao", FormatarDataHora(h.GetValue("dataalteracao", BsonNull.Value)) }
                };
                lista.Add(doc);
            }

            return new BsonDocument { { "historicos", lista } };
        }

        public static BsonDocument Historicos(string token, BsonDocument body)
        {
            ValidaToken(token);

            var op = body.GetValue("op", "").AsString.ToLowerInvariant();

            if (op == "inserir")
            {
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();
                var desc = body.GetValue("Descricao", "").AsString;
                var inc = DateTime.UtcNow;

                if (processoId <= 0)
                    throw new ArgumentException("ProcessoId inválido para cadastro de histórico.");

                var existe = ExecScalar("SELECT 1 FROM processos WHERE id=@p LIMIT 1", ("@p", processoId));
                if (existe == null) throw new KeyNotFoundException("Processo não encontrado.");

                var linhas = ExecNonQuery(
                    "INSERT INTO historicos (processoid, descricao, datainclusao) VALUES (@p,@d,@i)",
                    ("@p", processoId), ("@d", desc), ("@i", inc)
                );
                return new BsonDocument { { "resultado", "Histórico cadastrado." }, { "linhas", linhas } };
            }
            else if (op == "editar")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();
                var desc = body.GetValue("Descricao", "").AsString;
                var alt = DateTime.UtcNow;

                var parametros = new List<(string, object?)>
                {
                    ("@d", desc),
                    ("@a", alt),
                    ("@id", id)
                };

                string sql = "UPDATE historicos SET descricao=@d, dataalteracao=@a WHERE id=@id";
                if (processoId > 0)
                {
                    sql += " AND processoid=@p";
                    parametros.Add(("@p", processoId));
                }

                var linhas = ExecNonQuery(sql, parametros.ToArray());
                return new BsonDocument { { "resultado", "Histórico atualizado." }, { "linhas", linhas } };
            }
            else if (op == "excluir")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();

                var parametros = new List<(string, object?)> { ("@id", id) };
                string sql = "DELETE FROM historicos WHERE id=@id";
                if (processoId > 0)
                {
                    sql += " AND processoid=@p";
                    parametros.Add(("@p", processoId));
                }

                var linhas = ExecNonQuery(sql, parametros.ToArray());
                return new BsonDocument { { "resultado", "Histórico excluído." }, { "linhas", linhas } };
            }
            else
            {
                throw new ArgumentException("Op inválida. Use: inserir | editar | excluir.");
            }
        }

        public static BsonDocument ObterInformacoesCnj(string token, string numeroCnj)
        {
            ValidaToken(token);
            var info = CnjTribunalHelper.Obter(numeroCnj);
            return new BsonDocument
            {
                { "codigo", info.Codigo },
                { "sigla", info.Sigla },
                { "nome", info.Nome },
                { "uf", info.Uf },
                { "segmento", info.Segmento }
            };
        }

        private static BsonValue FormatarData(BsonValue valor)
        {
            if (valor is null || valor.IsBsonNull)
            {
                return BsonNull.Value;
            }
            if (valor is BsonDateTime dt)
            {
                return new BsonString(dt.ToUniversalTime().ToString("yyyy-MM-dd"));
            }

            if (valor.IsValidDateTime)
            {
                return new BsonString(valor.ToUniversalTime().ToString("yyyy-MM-dd"));
            }

            if (valor.IsString)
            {
                return valor;
            }

            return new BsonString(valor.ToString() ?? string.Empty);
        }

        private static BsonValue FormatarDataHora(BsonValue valor)
        {
            if (valor is null || valor.IsBsonNull) return BsonNull.Value;
            if (valor is BsonDateTime dt)
            {
                return new BsonString(dt.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss"));
            }

            if (valor.IsValidDateTime)
            {
                return new BsonString(valor.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss"));
            }

            if (valor.IsString)
            {
                return valor;
            }

            return new BsonString(valor.ToString() ?? string.Empty);
        }

        static (int Id, string Nome, string Usuario, string SenhaHash)? ObterUsuario(string usuario)
        {
            var resultado = ExecSelect(
                "SELECT id, nome, usuario, senha_hash FROM usuarios WHERE usuario=@u LIMIT 1",
                ("@u", usuario)
            ).GetValue("resultado", new BsonArray()).AsBsonArray;

            if (resultado.Count == 0)
                return null;

            var doc = resultado[0].AsBsonDocument;
            return (
                doc.GetValue("id", BsonValue.Create(0)).ToInt32(),
                doc.GetValue("nome", new BsonString(string.Empty)).AsString,
                doc.GetValue("usuario", new BsonString(string.Empty)).AsString,
                doc.GetValue("senha_hash", new BsonString(string.Empty)).AsString
            );
        }

        static void GarantirUsuario(string usuario, string nome, string senha)
        {
            var existente = ObterUsuario(usuario);
            var hash = HashSenha(senha);

            if (existente is null)
            {
                ExecNonQuery(
                    "INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (@n,@u,@s)",
                    ("@n", nome.Trim()),
                    ("@u", usuario.Trim()),
                    ("@s", hash)
                );
            }
            else
            {
                ExecNonQuery(
                    "UPDATE usuarios SET nome=@n, senha_hash=@s, atualizado_em=NOW() WHERE id=@id",
                    ("@n", nome.Trim()),
                    ("@s", hash),
                    ("@id", existente.Value.Id)
                );
            }
        }

        static string HashSenha(string senha)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(senha));
            return Convert.ToHexString(bytes);
        }
    }
}
