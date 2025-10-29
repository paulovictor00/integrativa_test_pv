using System.Security.Cryptography;
using System.Text;

#nullable enable

namespace integrativa_api.funcoes;

public static class TokenService
{
    static byte[]? _bytesSegredo;
    static TimeSpan _tempoValidade = TimeSpan.FromMinutes(60);

    public static int ValidadeEmMinutos => (int)Math.Round(_tempoValidade.TotalMinutes);

    public static void Configurar(string segredo, int validadeMinutos)
    {
        if (string.IsNullOrWhiteSpace(segredo))
            throw new InvalidOperationException("Segredo para geração de token não configurado.");

        if (segredo.Length < 16)
            throw new InvalidOperationException("Segredo para geração de token deve ter ao menos 16 caracteres.");

        _bytesSegredo = Encoding.UTF8.GetBytes(segredo);
        _tempoValidade = TimeSpan.FromMinutes(validadeMinutos > 0 ? validadeMinutos : 60);
    }

    public static string GerarToken(string usuario)
    {
        if (_bytesSegredo is null)
            throw new InvalidOperationException("TokenService não configurado.");

        if (string.IsNullOrWhiteSpace(usuario))
            throw new ArgumentException("Usuário inválido para geração do token.", nameof(usuario));

        var instanteAtual = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var conteudoToken = $"{usuario}|{instanteAtual}";
        var assinatura = GerarAssinatura(conteudoToken);
        var tokenCompleto = $"{conteudoToken}|{assinatura}";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(tokenCompleto));
    }

    public static bool ValidarToken(string token, out string? usuario)
    {
        usuario = null;

        if (_bytesSegredo is null)
            throw new InvalidOperationException("TokenService não configurado.");

        if (string.IsNullOrWhiteSpace(token))
            return false;

        byte[] bytesToken;
        try
        {
            bytesToken = Convert.FromBase64String(token);
        }
        catch
        {
            return false;
        }

        var textoToken = Encoding.UTF8.GetString(bytesToken);
        var partes = textoToken.Split('|');
        if (partes.Length != 3)
            return false;

        usuario = partes[0];
        if (!long.TryParse(partes[1], out var instanteGeracaoSegundos))
            return false;

        var instanteGeracao = DateTimeOffset.FromUnixTimeSeconds(instanteGeracaoSegundos);
        if (instanteGeracao.Add(_tempoValidade) < DateTimeOffset.UtcNow)
            return false;

        var conteudoToken = $"{partes[0]}|{partes[1]}";
        var assinaturaEsperada = GerarAssinatura(conteudoToken);

        return AssinaturasCoincidem(assinaturaEsperada, partes[2]);
    }

    static string GerarAssinatura(string conteudo)
    {
        using var hmac = new HMACSHA256(_bytesSegredo!);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(conteudo));
        return Convert.ToBase64String(hash);
    }

    static bool AssinaturasCoincidem(string assinaturaEsperada, string assinaturaInformada)
    {
        var bytesEsperados = Encoding.UTF8.GetBytes(assinaturaEsperada);
        var bytesInformados = Encoding.UTF8.GetBytes(assinaturaInformada);

        if (bytesEsperados.Length != bytesInformados.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(bytesEsperados, bytesInformados);
    }
}
