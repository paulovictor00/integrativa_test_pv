using System.Data;
using Npgsql;
using MongoDB.Bson;

namespace integrativa_api.funcoes
{
    public static class integrativaServer
    {
        public static string Conexao = "";

        public static BsonDocument Status() => new BsonDocument { { "status", "ON" } };

        public static void ValidaToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) throw new Exception("Token ausente.");
        }

        // -------- Helpers DB --------
        static int ExecNonQuery(string sql, params (string, object?)[] pars)
        {
            using (var cn = new NpgsqlConnection(Conexao))
            {
                cn.Open();
                using (var cmd = new NpgsqlCommand(sql, cn))
                {
                    foreach (var p in pars) cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
                    return cmd.ExecuteNonQuery();
                }
            }
        }

        static object? ExecScalar(string sql, params (string, object?)[] pars)
        {
            using (var cn = new NpgsqlConnection(Conexao))
            {
                cn.Open();
                using (var cmd = new NpgsqlCommand(sql, cn))
                {
                    foreach (var p in pars) cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
                    return cmd.ExecuteScalar();
                }
            }
        }

        static BsonDocument ExecSelect(string sql, params (string, object?)[] pars)
        {
            var outDoc = new BsonDocument();
            var lista = new BsonArray();

            using (var cn = new NpgsqlConnection(Conexao))
            {
                cn.Open();
                using (var cmd = new NpgsqlCommand(sql, cn))
                {
                    foreach (var p in pars) cmd.Parameters.AddWithValue(p.Item1, p.Item2 ?? DBNull.Value);
                    using (var rd = cmd.ExecuteReader())
                    {
                        while (rd.Read())
                        {
                            var doc = new BsonDocument();
                            for (int i = 0; i < rd.FieldCount; i++)
                                doc[rd.GetName(i)] = BsonValue.Create(rd.GetValue(i));
                            lista.Add(doc);
                        }
                    }
                }
            }

            outDoc["resultado"] = lista;
            return outDoc;
        }

        static DateTime ReadUtc(BsonDocument b, string key, DateTime def)
        {
            if (!b.Contains(key)) return def;
            var v = b[key];
            return v.IsValidDateTime ? v.ToUniversalTime() : def;
        }

        // ===================== PROCESSOS =====================

        // GET listar
        public static BsonDocument ListarProcessos(string token, string? numero)
        {
            ValidaToken(token);
            if (string.IsNullOrWhiteSpace(numero))
                return ExecSelect("SELECT * FROM processos ORDER BY id DESC");
            return ExecSelect("SELECT * FROM processos WHERE numeroprocesso ILIKE @n ORDER BY id DESC", ("@n", "%" + numero + "%"));
        }

        // GET obter (com históricos)
        public static BsonDocument ObterProcesso(string token, int id)
        {
            ValidaToken(token);
            var proc = ExecSelect("SELECT * FROM processos WHERE id=@id", ("@id", id));
            var hist = ExecSelect("SELECT * FROM historicos WHERE processoid=@id ORDER BY id DESC", ("@id", id));
            return new BsonDocument { { "processo", proc["resultado"] }, { "historicos", hist["resultado"] } };
        }

        // POST /api/processos  -> body.op in {inserir, editar, excluir}
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
                if (existe != null) throw new Exception("Número de processo já existe.");

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
                if (existe != null) throw new Exception("Número de processo já existe.");

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
                throw new Exception("Op inválida. Use: inserir | editar | excluir.");
            }
        }

        // ===================== HISTÓRICOS =====================

        // GET listar por processo
        public static BsonDocument ListarHistoricos(string token, int processoId)
        {
            ValidaToken(token);
            return ExecSelect("SELECT * FROM historicos WHERE processoid=@p ORDER BY id DESC", ("@p", processoId));
        }

        // POST /api/historicos -> body.op in {inserir, editar, excluir}
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
                if (existe == null) throw new Exception("Processo não encontrado.");

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
                throw new Exception("Op inválida. Use: inserir | editar | excluir.");
            }
        }
    }
}