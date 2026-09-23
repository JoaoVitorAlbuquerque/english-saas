/**
 * Conventional Commits.
 *
 * Formato: <type>(<scope>): <subject>
 * Ex.: feat(learning): add lesson step player
 *
 * Os scopes seguem a tabela de módulos do CLAUDE.md.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'setup',
        'infra',
        'ai',
        'auth',
        'users',
        'onboarding',
        'curriculum',
        'content-studio',
        'learning',
        'learner-model',
        'assessment',
        'srs',
        'planner',
        'billing',
        'tutor',
        'generator',
        'progress',
        'notifications',
        'mobile',
        'admin',
        'deploy',
        'api',
        'web',
        'shared',
        'deps',
        'ci',
      ],
    ],
    'scope-empty': [0],
    'body-max-line-length': [0],
  },
};
