import { defineConfig } from 'tsup';
import { cp } from 'fs/promises';
import { join } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react'],
  loader: {
    '.wasm': 'binary',
  },
  onSuccess: async () => {
    // Copy WASM files to dist
    try {
      await cp(
        join(__dirname, 'src/wasm/nnnoiseless_bg.wasm'),
        join(__dirname, 'dist/nnnoiseless_bg.wasm')
      );
      await cp(
        join(__dirname, 'src/wasm/nnnoiseless.js'),
        join(__dirname, 'dist/nnnoiseless.js')
      );
      await cp(
        join(__dirname, 'src/wasm/nnnoiseless.d.ts'),
        join(__dirname, 'dist/nnnoiseless.d.ts')
      );
      console.log('✅ WASM files copied to dist');
    } catch (error) {
      console.error('Failed to copy WASM files:', error);
    }
  },
});