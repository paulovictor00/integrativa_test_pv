using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using integrativa_api.funcoes;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddCors(p => p.AddDefaultPolicy(b => b.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<IConfiguration>(builder.Configuration);

integrativaServer.Conexao = builder.Configuration.GetConnectionString("Default") ?? "";

var app = builder.Build();
app.UseCors();
app.MapControllers();
app.Run();