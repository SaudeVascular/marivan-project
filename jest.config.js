// Equivalente ao que o react-scripts configurava.
module.exports = {
  testEnvironment: 'jsdom',
  // O jsdom do Jest 30 prefere os pacotes "browser" (só ESM); o Jest
  // carrega CommonJS, então resolvemos como no Node (igual ao Jest do CRA).
  testEnvironmentOptions: { customExportConditions: ['node', 'require', 'default'] },
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/src/testes/ambiente.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  // Apaga a implementação de todo jest.fn() antes de cada teste — por
  // isso os arquivos chamam resetSupabaseMockPadrao() no beforeEach.
  resetMocks: true,
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/testes/estiloVazio.js',
    '\\.(png|jpe?g|gif|svg|ico)$': '<rootDir>/src/testes/arquivoFalso.js',
    '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
    '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
    '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js',
  },
};
