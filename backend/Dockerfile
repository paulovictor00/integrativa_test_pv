FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copia os arquivos de projeto primeiro para otimizar o cache de dependências
COPY integrativa_test_pv.sln ./
COPY backend/integrativa_api/integrativa_api.csproj backend/integrativa_api/

RUN dotnet restore integrativa_test_pv.sln

# Copia o restante do código e publica em modo Release
COPY backend/ backend/

RUN dotnet publish backend/integrativa_api/integrativa_api.csproj \
    -c Release \
    -o /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:5000 \
    ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5000

ENTRYPOINT ["dotnet", "integrativa_api.dll"]
