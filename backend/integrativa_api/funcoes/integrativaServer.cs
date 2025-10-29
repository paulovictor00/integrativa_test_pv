using Npgsql;
using MongoDB.Bson;

#nullable enable

namespace integrativa_api.funcoes
{
    public static class integrativaServer
    {
        public static string Conexao { get; set; } = string.Empty;
        static string? UsuarioPermitido { get; set; }
        static string? SenhaPermitida { get; set; }

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
            ";

            using var cn = CreateConnection();
            cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn);
            cmd.ExecuteNonQuery();
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
                    doc[rd.GetName(i)] = MongoDB.Bson.BsonValue.Create(rd.GetValue(i));
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

            UsuarioPermitido = usuario;
            SenhaPermitida = senha;
        }

        public static BsonDocument Login(string usuario, string senha)
        {
            if (string.IsNullOrWhiteSpace(usuario) || string.IsNullOrWhiteSpace(senha))
                throw new UnauthorizedAccessException("Credenciais inválidas.");

            if (UsuarioPermitido is null || SenhaPermitida is null)
                throw new InvalidOperationException("Credenciais da API não configuradas.");

            if (!string.Equals(usuario, UsuarioPermitido, StringComparison.Ordinal) ||
                !string.Equals(senha, SenhaPermitida, StringComparison.Ordinal))
            {
                throw new UnauthorizedAccessException("Credenciais inválidas.");
            }

            var token = TokenService.GerarToken(usuario);
            var expiraEm = DateTime.UtcNow.AddMinutes(TokenService.ValidadeEmMinutos).ToString("o");
            return new BsonDocument
            {
                { "token", token },
                { "expiraEm", expiraEm },
                { "usuario", usuario }
            };
        }

        // ===================== PROCESSOS =====================

        public static BsonDocument ListarProcessos(string token, string? numero)
        {
            ValidaToken(token);
            if (string.IsNullOrWhiteSpace(numero))
                return ExecSelect("SELECT * FROM processos ORDER BY id DESC");
            return ExecSelect("SELECT * FROM processos WHERE numeroprocesso ILIKE @n ORDER BY id DESC", ("@n", "%" + numero + "%"));
        }

        public static BsonDocument ObterProcesso(string token, int id)
        {
            ValidaToken(token);
            var proc = ExecSelect("SELECT * FROM processos WHERE id=@id", ("@id", id));
            var hist = ExecSelect("SELECT * FROM historicos WHERE processoid=@id ORDER BY id DESC", ("@id", id));
            return new BsonDocument { { "processo", proc["resultado"] }, { "historicos", hist["resultado"] } };
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
                var data   = ReadUtc(body, "DataAjuizamento", DateTime.UtcNow);
                var status = body.GetValue("Status", "EmAndamento").AsString;
                var desc   = body.GetValue("Descricao", "").AsString;

                var existe = ExecScalar("SELECT 1 FROM processos WHERE numeroprocesso=@n LIMIT 1", ("@n", numero));
                if (existe != null) throw new InvalidOperationException("Número de processo já existe.");

                var linhas = ExecNonQuery(
                    "INSERT INTO processos (numeroprocesso, autor, reu, dataajuizamento, status, descricao) " +
                    "VALUES (@n,@a,@r,@d,@s,@desc)",
                    ("@n", numero), ("@a", autor), ("@r", reu), ("@d", data), ("@s", status), ("@desc", (object?)desc ?? DBNull.Value)
                );
                return new BsonDocument { { "resultado", "Processo cadastrado." }, { "linhas", linhas } };
            }
            else if (op == "editar")
            {
                var id     = body.GetValue("Id", 0).ToInt32();
                var numero = body.GetValue("NumeroProcesso", "").AsString;
                var autor  = body.GetValue("Autor", "").AsString;
                var reu    = body.GetValue("Reu", "").AsString;
                var data   = ReadUtc(body, "DataAjuizamento", DateTime.UtcNow);
                var status = body.GetValue("Status", "EmAndamento").AsString;
                var desc   = body.GetValue("Descricao", "").AsString;

                var existe = ExecScalar("SELECT 1 FROM processos WHERE numeroprocesso=@n AND id<>@id LIMIT 1",
                                        ("@n", numero), ("@id", id));
                if (existe != null) throw new InvalidOperationException("Número de processo já existe.");

                var linhas = ExecNonQuery(
                    "UPDATE processos SET numeroprocesso=@n, autor=@a, reu=@r, dataajuizamento=@d, status=@s, descricao=@desc WHERE id=@id",
                    ("@n", numero), ("@a", autor), ("@r", reu), ("@d", data), ("@s", status), ("@desc", (object?)desc ?? DBNull.Value), ("@id", id)
                );
                return new BsonDocument { { "resultado", "Processo atualizado." }, { "linhas", linhas } };
            }
            else if (op == "excluir")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var linhas = ExecNonQuery("DELETE FROM processos WHERE id=@id", ("@id", id));
                return new BsonDocument { { "resultado", "Processo excluído." }, { "linhas", linhas } };
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
            return ExecSelect("SELECT * FROM historicos WHERE processoid=@p ORDER BY id DESC", ("@p", processoId));
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

                var linhas = ExecNonQuery(
                    "UPDATE historicos SET descricao=@d, dataalteracao=@a WHERE id=@id AND processoid=@p",
                    ("@d", desc), ("@a", alt), ("@id", id), ("@p", processoId)
                );
                return new BsonDocument { { "resultado", "Histórico atualizado." }, { "linhas", linhas } };
            }
            else if (op == "excluir")
            {
                var id = body.GetValue("Id", 0).ToInt32();
                var processoId = body.GetValue("ProcessoId", 0).ToInt32();

                var linhas = ExecNonQuery(
                    "DELETE FROM historicos WHERE id=@id AND processoid=@p",
                    ("@id", id), ("@p", processoId)
                );
                return new BsonDocument { { "resultado", "Histórico excluído." }, { "linhas", linhas } };
            }
            else
            {
                throw new ArgumentException("Op inválida. Use: inserir | editar | excluir.");
            }
        }
    }
}
