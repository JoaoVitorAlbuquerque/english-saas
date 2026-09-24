-- Migration inicial. Ainda sem tabela de domínio: as entidades entram
-- módulo a módulo, na ordem da tabela do CLAUDE.md.
--
-- pgcrypto dá o gen_random_uuid() que as tabelas vão usar como default do id.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
