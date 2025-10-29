using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using integrativa_api.funcoes;

#nullable enable

namespace integrativa_api.controler
{
    public record LoginPayload(string usuario, string senha);

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

        [HttpPost]
        [Route("api/auth/login")]
        public IActionResult Login([FromBody] LoginPayload body)
        {
            if (body is null)
                return BadRequest(new { erro = "Corpo da requisição inválido." });

            return SafeExecute(() => integrativaServer.Login(body.usuario, body.senha));
        }

        // -------- Processos (GET: listar/obter) --------
        [HttpGet]
        [Route("api/processos")]
        public IActionResult ListarProcessos([FromQuery] string? numero = null)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ListarProcessos(token, numero));
        }

        [HttpGet]
        [Route("api/processos/{id:int}")]
        public IActionResult ObterProcesso(int id)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.ObterProcesso(token, id));
        }

        // -------- Processos (POST: inserir/editar/excluir via op) --------
        [HttpPost]
        [Route("api/processos")]
        public IActionResult Processos([FromBody] BsonDocument body)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.Processos(token, body));
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
        [HttpPost]
        [Route("api/historicos")]
        public IActionResult Historicos([FromBody] BsonDocument body)
        {
            var token = Request.Headers.Authorization.ToString();
            return SafeExecute(() => integrativaServer.Historicos(token, body));
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
            var json = r.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.CanonicalExtendedJson });
            return new ContentResult { Content = json, ContentType = "application/json", StatusCode = statusCode };
        }
    }
}
