using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using integrativa_api.funcoes;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddCors(p => p.AddDefaultPolicy(b => b.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<IConfiguration>(builder.Configuration);

integrativaServer.Conexao = builder.Configuration.GetConnectionString("Default") ?? "";
if (string.IsNullOrWhiteSpace(integrativaServer.Conexao))
    throw new InvalidOperationException("Connection string 'Default' não configurada.");

var secaoAutenticacao = builder.Configuration.GetSection("Auth");
var usuarioAutorizado = secaoAutenticacao.GetValue<string>("Usuario") ?? "";
var senhaAutorizada = secaoAutenticacao.GetValue<string>("Senha") ?? "";
var segredoAutenticacao = secaoAutenticacao.GetValue<string>("Secret") ?? "";
var validadeMinutos = secaoAutenticacao.GetValue<int?>("ExpireMinutes") ?? 60;

integrativaServer.ConfigurarCredenciais(usuarioAutorizado, senhaAutorizada);
TokenService.Configurar(segredoAutenticacao, validadeMinutos);

integrativaServer.CriarTabelasSeNecessario();

var app = builder.Build();
app.UseCors();
app.MapControllers();
app.Run();
