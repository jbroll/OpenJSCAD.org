import banner from 'rollup-plugin-banner'

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/jscad-core.min.js',
      format: 'umd',
      name: 'jscadCore'
    },
    {
      file: 'dist/jscad-core.es.js',
      format: 'es'
    }
  ],
  plugins: [
    banner('<%= pkg.description %>\n<%= pkg.name %>\nVersion <%= pkg.version %>\n<%= pkg.license %> License')
  ]
}
