using System;
using System.Linq;

namespace integrativa_api.funcoes
{
    public static class CnjTribunalHelper
    {
        public static CnjTribunalInfo Obter(string numeroCnj)
        {
            if (string.IsNullOrWhiteSpace(numeroCnj))
                throw new ArgumentException("Número CNJ não informado.", nameof(numeroCnj));

            var normalizado = numeroCnj.Trim();
            var partes = normalizado.Split('.', StringSplitOptions.RemoveEmptyEntries);

            string segmento;
            string regiao;

            if (partes.Length >= 4)
            {
                segmento = partes[2];
                regiao = partes[3];
            }
            else
            {
                var apenasDigitos = new string(normalizado.Where(char.IsDigit).ToArray());
                if (apenasDigitos.Length != 20)
                    throw new ArgumentException("Número CNJ inválido.", nameof(numeroCnj));

                segmento = apenasDigitos.Substring(13, 1);
                regiao = apenasDigitos.Substring(14, 2);
            }

            if (string.IsNullOrWhiteSpace(segmento) || string.IsNullOrWhiteSpace(regiao))
                throw new ArgumentException("Número CNJ inválido.", nameof(numeroCnj));

            var codigo = $"{segmento}.{regiao}";
            return Mapear(segmento, regiao, codigo);
        }

        private static CnjTribunalInfo Mapear(string segmento, string regiao, string codigo) =>
            segmento switch
            {
                "1" => new CnjTribunalInfo(codigo, "STF", "Supremo Tribunal Federal", "DF", "Justiça Superior"),
                "2" => new CnjTribunalInfo(codigo, "CNJ", "Conselho Nacional de Justiça", "DF", "Órgão de Controle"),
                "3" => new CnjTribunalInfo(codigo, "STJ", "Superior Tribunal de Justiça", "DF", "Justiça Superior"),
                "4" => MapearJusticaFederal(regiao, codigo),
                "5" => MapearJusticaDoTrabalho(regiao, codigo),
                "6" => MapearJusticaEleitoral(regiao, codigo),
                "7" => MapearJusticaMilitarDaUniao(regiao, codigo),
                "8" => MapearJusticaEstadual(regiao, codigo),
                "9" => MapearJusticaMilitarEstadual(regiao, codigo),
                _ => CnjTribunalInfo.Desconhecido(codigo)
            };

        private static CnjTribunalInfo MapearJusticaEstadual(string regiao, string codigo)
        {
            var estado = ObterEstado(regiao);
            if (estado is null)
                return CnjTribunalInfo.Desconhecido(codigo);

            return new CnjTribunalInfo(codigo, $"TJ{estado.Value.Sigla}", $"Tribunal de Justiça de {estado.Value.Nome}", estado.Value.Sigla, "Justiça Estadual");
        }

        private static CnjTribunalInfo MapearJusticaFederal(string regiao, string codigo)
        {
            switch (regiao)
            {
                case "00":
                    return new CnjTribunalInfo(codigo, "CJF", "Conselho da Justiça Federal", "DF", "Justiça Federal");
                case "01":
                    return new CnjTribunalInfo(codigo, "TRF1", "Tribunal Regional Federal da 1ª Região", "BR", "Justiça Federal");
                case "02":
                    return new CnjTribunalInfo(codigo, "TRF2", "Tribunal Regional Federal da 2ª Região", "BR", "Justiça Federal");
                case "03":
                    return new CnjTribunalInfo(codigo, "TRF3", "Tribunal Regional Federal da 3ª Região", "BR", "Justiça Federal");
                case "04":
                    return new CnjTribunalInfo(codigo, "TRF4", "Tribunal Regional Federal da 4ª Região", "BR", "Justiça Federal");
                case "05":
                    return new CnjTribunalInfo(codigo, "TRF5", "Tribunal Regional Federal da 5ª Região", "BR", "Justiça Federal");
                case "06":
                    return new CnjTribunalInfo(codigo, "TRF6", "Tribunal Regional Federal da 6ª Região", "MG", "Justiça Federal");
            }

            var estado = ObterEstado(regiao);
            if (estado is null)
                return CnjTribunalInfo.Desconhecido(codigo);

            return estado.Value.Sigla switch
            {
                "AC" or "AM" or "AP" or "BA" or "DF" or "GO" or "MA" or "MT" or "PA" or "PI" or "RO" or "RR" or "TO"
                    => new CnjTribunalInfo(codigo, "TRF1", "Tribunal Regional Federal da 1ª Região", estado.Value.Sigla, "Justiça Federal"),
                "ES" or "RJ"
                    => new CnjTribunalInfo(codigo, "TRF2", "Tribunal Regional Federal da 2ª Região", estado.Value.Sigla, "Justiça Federal"),
                "MS" or "SP"
                    => new CnjTribunalInfo(codigo, "TRF3", "Tribunal Regional Federal da 3ª Região", estado.Value.Sigla, "Justiça Federal"),
                "PR" or "RS" or "SC"
                    => new CnjTribunalInfo(codigo, "TRF4", "Tribunal Regional Federal da 4ª Região", estado.Value.Sigla, "Justiça Federal"),
                "AL" or "CE" or "PB" or "PE" or "RN" or "SE"
                    => new CnjTribunalInfo(codigo, "TRF5", "Tribunal Regional Federal da 5ª Região", estado.Value.Sigla, "Justiça Federal"),
                "MG"
                    => new CnjTribunalInfo(codigo, "TRF6", "Tribunal Regional Federal da 6ª Região", estado.Value.Sigla, "Justiça Federal"),
                _ => CnjTribunalInfo.Desconhecido(codigo)
            };
        }

        private static CnjTribunalInfo MapearJusticaMilitarDaUniao(string regiao, string codigo) =>
            regiao == "00"
                ? new CnjTribunalInfo(codigo, "STM", "Superior Tribunal Militar", "DF", "Justiça Militar da União")
                : new CnjTribunalInfo(codigo, "JMU", "Justiça Militar da União", "DF", "Justiça Militar da União");

        private static CnjTribunalInfo MapearJusticaDoTrabalho(string regiao, string codigo)
        {
            if (regiao == "00")
                return new CnjTribunalInfo(codigo, "TST", "Tribunal Superior do Trabalho", "DF", "Justiça do Trabalho");

            if (!int.TryParse(regiao, out var numero) || numero < 1 || numero > 24)
                return CnjTribunalInfo.Desconhecido(codigo);

            return new CnjTribunalInfo(
                codigo,
                $"TRT{numero}",
                $"Tribunal Regional do Trabalho da {numero}ª Região",
                string.Empty,
                "Justiça do Trabalho"
            );
        }

        private static CnjTribunalInfo MapearJusticaEleitoral(string regiao, string codigo)
        {
            if (regiao == "00")
                return new CnjTribunalInfo(codigo, "TSE", "Tribunal Superior Eleitoral", "DF", "Justiça Eleitoral");

            var estado = ObterEstado(regiao);
            if (estado is null)
                return CnjTribunalInfo.Desconhecido(codigo);

            return new CnjTribunalInfo(codigo, $"TRE-{estado.Value.Sigla}", $"Tribunal Regional Eleitoral de {estado.Value.Nome}", estado.Value.Sigla, "Justiça Eleitoral");
        }

        private static CnjTribunalInfo MapearJusticaMilitarEstadual(string regiao, string codigo)
        {
            var estado = ObterEstado(regiao);
            if (estado is null)
                return CnjTribunalInfo.Desconhecido(codigo);

            return estado.Value.Sigla switch
            {
                "MG" => new CnjTribunalInfo(codigo, "TJMMG", "Tribunal de Justiça Militar de Minas Gerais", "MG", "Justiça Militar Estadual"),
                "RS" => new CnjTribunalInfo(codigo, "TJMRS", "Tribunal de Justiça Militar do Rio Grande do Sul", "RS", "Justiça Militar Estadual"),
                "SP" => new CnjTribunalInfo(codigo, "TJMSP", "Tribunal de Justiça Militar de São Paulo", "SP", "Justiça Militar Estadual"),
                _ => CnjTribunalInfo.Desconhecido(codigo)
            };
        }

        private static (string Sigla, string Nome)? ObterEstado(string codigo) =>
            codigo switch
            {
                "01" => ("AC", "Acre"),
                "02" => ("AL", "Alagoas"),
                "03" => ("AP", "Amapá"),
                "04" => ("AM", "Amazonas"),
                "05" => ("BA", "Bahia"),
                "06" => ("CE", "Ceará"),
                "07" => ("DF", "Distrito Federal"),
                "08" => ("ES", "Espírito Santo"),
                "09" => ("GO", "Goiás"),
                "10" => ("MA", "Maranhão"),
                "11" => ("MT", "Mato Grosso"),
                "12" => ("MS", "Mato Grosso do Sul"),
                "13" => ("MG", "Minas Gerais"),
                "14" => ("PA", "Pará"),
                "15" => ("PB", "Paraíba"),
                "16" => ("PR", "Paraná"),
                "17" => ("PE", "Pernambuco"),
                "18" => ("PI", "Piauí"),
                "19" => ("RJ", "Rio de Janeiro"),
                "20" => ("RN", "Rio Grande do Norte"),
                "21" => ("RS", "Rio Grande do Sul"),
                "22" => ("RO", "Rondônia"),
                "23" => ("RR", "Roraima"),
                "24" => ("SC", "Santa Catarina"),
                "25" => ("SE", "Sergipe"),
                "26" => ("SP", "São Paulo"),
                "27" => ("TO", "Tocantins"),
                _ => null
            };
    }

    public record CnjTribunalInfo(string Codigo, string Sigla, string Nome, string Uf, string Segmento)
    {
        public static CnjTribunalInfo Desconhecido(string codigo) =>
            new CnjTribunalInfo(codigo, "DESCONHECIDO", "Órgão não identificado", string.Empty, "Desconhecido");
    }
}
