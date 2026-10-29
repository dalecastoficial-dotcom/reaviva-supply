# REAVIVA SUPPLY · V2 — Catálogo + CMS

## O que foi adicionado
- `admin.html`: login e painel responsivo para gerenciar produtos e banners.
- `admin.js` e `admin.css`: painel com CRUD de produtos e banners, upload de imagens.
- `catalogo-cms.js`: leitura dos produtos publicados no Supabase. Sem Supabase configurado, a V1 continua com produtos demonstrativos.
- `supabase.sql`: banco de dados, tabelas e políticas RLS.

## Preparação (obrigatória)
1. Crie um projeto no https://supabase.com. Em SQL Editor execute todo o arquivo `supabase.sql` uma única vez (políticas não são idempotentes).
2. No Supabase, em Authentication > Users, crie/convide o usuário que será administrador. Confira o UUID do usuário.
3. No SQL Editor execute `insert into public.admins(user_id) values ('UUID-REAL-DO-USUARIO');` substituindo pelo UUID de Cleide ou Agência LENO. Não use e-mail como identificador para esta tabela.
4. Em Project Settings > API (ou Connect), copie **Project URL** e **publishable/anon key**. Preencha em `config.js` `supabaseUrl` e `supabaseAnonKey`. Essas são chaves PÚBLICAS protegidas por RLS. **NUNCA COLOQUE service_role ou senhas em config.js**.
5. Abra `admin.html` em URL HTTPS publicada pela Vercel (ex: `https://seu-site.vercel.app/admin.html`). Faça login.
6. Cadastre produtos usando fotos autorizadas, valores finais e tamanhos reais. Marque "Publicar no catálogo".
7. Para usar o slider pelo CMS, configure exatamente 3 banners com imagem e marque como publicados. Sem banners CMS, os 3 banners originais são exibidos.
8. Em `config.js`, defina WhatsApp comercial da Cleide e Instagram sem `@`.
9. Suba a pasta extraída no GitHub preservando a estrutura. O deploy da Vercel poderá ocorrer automaticamente.

## Segurança e limites
- Não existe cadastro público de administradores, nem senha inserida em código-fonte.
- Autenticação Supabase + RLS: apenas UUIDs em `public.admins` conseguem editar.
- Imagens de produtos são públicas, como convém a um catálogo. Uploads limitados a 5 MB, JPG/PNG/WebP.
- A V2 é uma base para homologação, ainda requer criação do projeto Supabase, contas reais, configuração e testes integrados.
- O catálogo de referência anterior só some quando o Supabase estiver configurado e acessível. Em caso de erro de rede, a página atual mantém o conteúdo demo com aviso; antes de lançar, é prudente desabilitar esse fallback de demonstração.
- E-commerce, checkout, registro de encomendas e controle de estoque de fornecedor ainda **não** estão incluídos.
- O nome `REAVIVA SUPPLY` deve passar por checagem jurídica de marca antes da operação definitiva.
