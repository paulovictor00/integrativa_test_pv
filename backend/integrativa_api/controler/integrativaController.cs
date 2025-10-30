using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using integrativa_api.funcoes;

#nullable enable

namespace integrativa_api.controler
{
    public record LoginPayload(string usuario, string senha);

    public class RegistrarUsuarioPayload
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        [Required]
        public string Usuario { get; set; } = string.Empty;

        [Required]
        [MinLength(4)]
        public string Senha { get; set; } = string.Empty;
    }

    public class ProcessoPayload
    {
        [Required]
        public string NumeroProcesso { get; set; } = string.Empty;

        [Required]
        public string Autor { get; set; } = string.Empty;

        [Required]
        public string Reu { get; set; } = string.Empty;

        [Required]
        public DateTime DataAjuizamento { get; set; }
            = DateTime.UtcNow;

        [Required]
        public string Status { get; set; } = "EmAndamento";

        public string? Descricao { get; set; }
            = string.Empty;

        public string Tribunal { get; set; } = string.Empty;
    }

    public class HistoricoPayload
    {
        [Required]
        public string Descricao { get; set; } = string.Empty;
    }

    public class MovimentacaoPayload
    {
        [Required]
        public string Descricao { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("")]
    public class integrativaController : ControllerBase
    {
        public integrativaController(IConfiguration cfg)
        {
            integrativaServer.Conexao = cfg.GetConnectionString("Default") ?? "";
        }

        [HttpGet]
        [Route("")]
        public IActionResult StatusApi()
        {
            return SafeExecute(() => integrativaServer.Status());
        }

        [HttpGet]
        [Route("api")]
        public IActionResult Status()
        {
            return SafeExecute(() => integrativaServer.Status());
        }

        [HttpGet("api/processos/cnj-info")]
        public IActionResult ObterInformacoesCnj([FromQuery] string numero)
        {
            if (string.IsNullOrWhiteSpace(numero))
                return BadRequest(new { erro = "Número CNJ é obrigatório." });

            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ObterInformacoesCnj(token, numero));
        }

        [HttpPost]
        [Route("api/auth/login")]
        public IActionResult Login([FromBody] LoginPayload body)
        {
            if (body is null)
                return BadRequest(new { erro = "Corpo da requisição inválido." });

            return SafeExecute(() => integrativaServer.Login(body.usuario, body.senha));
        }

        [HttpPost("api/auth/register")]
        public IActionResult RegistrarUsuario([FromBody] RegistrarUsuarioPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            return SafeExecute(() => integrativaServer.RegistrarUsuario(body.Nome, body.Usuario, body.Senha));
        }

        // -------- Processos (GET: listar/obter) --------
        [HttpGet]
        [Route("api/processos")]
        public IActionResult ListarProcessos([FromQuery] string? numero = null)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ListarProcessos(token, numero));
        }

        [HttpGet("api/processos/ultimos")]
        public IActionResult ListarUltimosProcessos(
            [FromQuery] int pagina = 1,
            [FromQuery] int tamanho = 5,
            [FromQuery] string? numero = null,
            [FromQuery] string? autor = null,
            [FromQuery] string? reu = null,
            [FromQuery] string? status = null)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ListarUltimosProcessos(token, pagina, tamanho, numero, autor, reu, status));
        }

        [HttpGet("api/processos/{id:int}")]
        public IActionResult ObterProcesso(int id)
        {
            var token = Request.Headers.Authorization.ToString();
            if (id <= 0)
                return BadRequest(new { erro = "Id inválido." });

            return SafeExecute(() => integrativaServer.ObterProcesso(token, id));
        }

        // -------- Processos (POST: inserir/editar/excluir via op) --------
        [HttpPost("api/processos")]
        public IActionResult CriarProcesso([FromBody] ProcessoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.Processos(token, MontarProcessoDocumento("inserir", body)));
        }

        [HttpPut("api/processos/{id:int}")]
        public IActionResult AtualizarProcesso(int id, [FromBody] ProcessoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            var documento = MontarProcessoDocumento("editar", body, id);
            return SafeExecute(() => integrativaServer.Processos(token, documento));
        }

        [HttpDelete("api/processos/{id:int}")]
        public IActionResult ExcluirProcesso(int id)
        {
            var token = Request.Headers.Authorization.ToString();
            var doc = new BsonDocument
            {
                { "op", "excluir" },
                { "Id", id }
            };
            return SafeExecute(() => integrativaServer.Processos(token, doc));
        }

        // -------- Históricos (GET: listar por processo) --------
        [HttpGet]
        [Route("api/processos/{processoId:int}/historicos")]
        public IActionResult ListarHistoricos(int processoId)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ListarHistoricos(token, processoId));
        }

        // -------- Históricos (POST: inserir/editar/excluir via op) --------
        [HttpPost("api/processos/{processoId:int}/historicos")]
        public IActionResult CriarHistorico(int processoId, [FromBody] HistoricoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            var doc = MontarHistoricoDocumento("inserir", processoId, descricao: body.Descricao);
            return SafeExecute(() => integrativaServer.Historicos(token, doc));
        }

        [HttpPut("api/historicos/{id:int}")]
        public IActionResult AtualizarHistorico(int id, [FromBody] HistoricoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            var doc = MontarHistoricoDocumento("editar", processoId: null, id: id, descricao: body.Descricao);
            return SafeExecute(() => integrativaServer.Historicos(token, doc));
        }

        [HttpDelete("api/historicos/{id:int}")]
        public IActionResult ExcluirHistorico(int id)
        {
            var token = Request.Headers.Authorization.ToString();
            var doc = MontarHistoricoDocumento("excluir", processoId: null, id: id);
            return SafeExecute(() => integrativaServer.Historicos(token, doc));
        }

        // -------- Movimentações do Processo --------
        [HttpGet("api/processos/{processoId:int}/movimentacoes")]
        public IActionResult ListarMovimentacoes(
            int processoId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamanho = 5)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ListarMovimentacoes(token, processoId, pagina, tamanho));
        }

        [HttpPost("api/processos/{processoId:int}/movimentacoes")]
        public IActionResult CriarMovimentacao(int processoId, [FromBody] MovimentacaoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            var doc = MontarMovimentacaoDocumento("inserir", processoId, null, body.Descricao);
            return SafeExecute(() => integrativaServer.Movimentacoes(token, doc));
        }

        [HttpPut("api/processos/{processoId:int}/movimentacoes/{id:int}")]
        public IActionResult AtualizarMovimentacao(int processoId, int id, [FromBody] MovimentacaoPayload body)
        {
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            var token = Request.Headers.Authorization.ToString();
            var doc = MontarMovimentacaoDocumento("editar", processoId, id, body.Descricao);
            return SafeExecute(() => integrativaServer.Movimentacoes(token, doc));
        }

        [HttpDelete("api/processos/{processoId:int}/movimentacoes/{id:int}")]
        public IActionResult ExcluirMovimentacao(int processoId, int id)
        {
            var token = Request.Headers.Authorization.ToString();
            var doc = MontarMovimentacaoDocumento("excluir", processoId, id, null);
            return SafeExecute(() => integrativaServer.Movimentacoes(token, doc));
        }

        private ContentResult SafeExecute(Func<BsonDocument> action)
        {
            try
            {
                var doc = action();
                return Retorno(doc, StatusCodes.Status200OK);
            }
            catch (Exception ex)
            {
                var doc = new BsonDocument { { "erro", ex.Message } };
                return Retorno(doc, MapStatus(ex));
            }
        }

        private static int MapStatus(Exception ex) => ex switch
        {
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            KeyNotFoundException => StatusCodes.Status404NotFound,
            ArgumentException => StatusCodes.Status400BadRequest,
            InvalidOperationException => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError
        };

        private ContentResult Retorno(BsonDocument r, int statusCode)
        {
            var json = r.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.RelaxedExtendedJson });
            return new ContentResult { Content = json, ContentType = "application/json", StatusCode = statusCode };
        }

        static BsonDocument MontarProcessoDocumento(string operacao, ProcessoPayload body, int? id = null)
        {
            var doc = new BsonDocument
            {
                { "op", operacao },
                { "NumeroProcesso", body.NumeroProcesso },
                { "Autor", body.Autor },
                { "Reu", body.Reu },
                { "Tribunal", body.Tribunal },
                { "DataAjuizamento", body.DataAjuizamento },
                { "Status", body.Status },
                { "Descricao", body.Descricao ?? string.Empty }
            };

            if (id.HasValue)
                doc["Id"] = id.Value;

            return doc;
        }

        static BsonDocument MontarHistoricoDocumento(string operacao, int? processoId, int? id = null, string? descricao = null)
        {
            var doc = new BsonDocument { { "op", operacao } };

            if (processoId.HasValue)
                doc["ProcessoId"] = processoId.Value;

            if (id.HasValue)
                doc["Id"] = id.Value;

            if (descricao is not null)
                doc["Descricao"] = descricao;

            return doc;
        }

        static BsonDocument MontarMovimentacaoDocumento(string operacao, int processoId, int? id, string? descricao)
        {
            var doc = new BsonDocument { { "op", operacao } };

            if (processoId > 0)
                doc["ProcessoId"] = processoId;

            if (id.HasValue)
                doc["Id"] = id.Value;

            if (!string.IsNullOrWhiteSpace(descricao))
                doc["Descricao"] = descricao;

            return doc;
        }
    }
}
