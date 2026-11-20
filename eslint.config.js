// Vérificateur de code (npm run lint) : repère les erreurs probables avant qu'elles arrivent chez les joueurs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'node_modules/', 'apercu-*.html', 'apercu-*.css'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Les « ! » (« je sais que ça existe ») sont courants ici et vérifiés à la main.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Un nom qui commence par « _ » = valeur volontairement ignorée (ex. pour retirer un champ d'un objet).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
);
