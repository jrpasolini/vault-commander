# Vault Commander

Leitor local e **somente-leitura** para um Vault Obsidian, com interface inspirada em DOS/Turbo Vision/Norton Commander.

## Rodar agora

```powershell
npm install
npm run dev
```

Abra: `http://127.0.0.1:5173`

Sem `config.json`, o programa inicia em **DEMO MODE** com quatro registros fictícios.

## Conectar o Vault real depois

Copie `config.example.json` para `config.json` e ajuste `vaultPath` e `canonicalPath`. `config.json` não deve ir para o GitHub.

O backend só expõe operações de leitura (`GET`) e valida os caminhos antes de abrir qualquer `.md`.
