# Padrão de Textos do CRM

Este projeto deve manter todos os textos de interface em `pt-BR`, salvos em `UTF-8`.

Regras obrigatórias:
- usar acentuação correta em todos os textos visíveis ao usuário
- nunca inserir texto corrompido por encoding; qualquer ocorrência de mojibake deve ser corrigida antes de publicar
- preferir linguagem clara, curta e operacional
- manter consistência entre botões, mensagens de sucesso, erro e estados vazios
- usar caixa normal em frases e títulos curtos; evitar excesso de maiúsculas
- revisar textos novos antes de finalizar qualquer edição visual ou de fluxo

Checklist para novas edições:
- o texto aparece corretamente no navegador
- o português está natural e sem abreviações confusas
- ações usam verbos consistentes, como `Salvar`, `Descartar`, `Atualizar`, `Excluir`
- mensagens de erro explicam o problema sem ambiguidade

Regra de manutenção:
- sempre que um texto novo for adicionado ou alterado no CRM, validar se ele segue este padrão antes de enviar para o git
