import resolve  from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'node_modules/fuzzaldrin-plus/lib/fuzzaldrin.js',
  plugins: [ resolve(), commonjs() ],
  output: {
    file: 'bin/fuzzaldrinPlus.js',
    format: 'es',
    exports: 'named'
  }
}