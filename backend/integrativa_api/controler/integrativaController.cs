using System.Net;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using integrativa_api.funcoes;

namespace integrativa_api.controler
{
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
            var r = new BsonDocument();
            try { r = integrativaServer.Status(); }
            catch (Exception ex) { r = new BsonDocument { { "erro", ex.Message } }; }
            return Retorno(r);
        }

        [HttpGet]
        [Route("api")]
        public IActionResult Status()
        {
            var r = new BsonDocument();
            try { r = integrativaServer.Status(); }
            catch (Exception ex) { r = new BsonDocument { { "erro", ex.Message } }; }
            return Retorno(r);
        }

        // -------- Processos (GET: listar/obter) --------
        [HttpGet]
        [Route("api/processos")]
        public IActionResult ListarProcessos([FromQuery] string? numero = null)
        {
            var r = new BsonDocument();
            try { r = integrativaServer.ListarProcessos(Request.Headers.Authorization.ToString(), numero); }
            catch (Exception ex) { r["erro"] = ex.Message; }
            return Retorno(r);
        }

        [HttpGet]
        [Route("api/processos/{id:int}")]
        public IActionResult ObterProcesso(int id)
        {
            var r = new BsonDocument();
            try { r = integrativaServer.ObterProcesso(Request.Headers.Authorization.ToString(), id); }
            catch (Exception ex) { r["erro"] = ex.Message; }
            return Retorno(r);
        }

        // -------- Processos (POST: inserir/editar/excluir via op) --------
        [HttpPost]
        [Route("api/processos")]
        public IActionResult Processos([FromBody] BsonDocument body)
        {
            var r = new BsonDocument();
            try { r = integrativaServer.Processos(Request.Headers.Authorization.ToString(), body); }
            catch (Exception ex) { r["erro"] = ex.Message; }
            return Retorno(r);
        }

        // -------- Históricos (GET: listar por processo) --------
        [HttpGet]
        [Route("api/processos/{processoId:int}/historicos")]
        public IActionResult ListarHistoricos(int processoId)
        {
            var r = new BsonDocument();
            try { r = integrativaServer.ListarHistoricos(Request.Headers.Authorization.ToString(), processoId); }
            catch (Exception ex) { r["erro"] = ex.Message; }
            return Retorno(r);
        }

        // -------- Históricos (POST: inserir/editar/excluir via op) --------
        [HttpPost]
        [Route("api/historicos")]
        public IActionResult Historicos([FromBody] BsonDocument body)
        {
            var r = new BsonDocument();
            try { r = integrativaServer.Historicos(Request.Headers.Authorization.ToString(), body); }
            catch (Exception ex) { r["erro"] = ex.Message; }
            return Retorno(r);
        }

        private ContentResult Retorno(BsonDocument r)
        {
            var json = r.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.Strict });
            return new ContentResult { Content = json, ContentType = "application/json", StatusCode = (int)HttpStatusCode.OK };
        }
    }
}