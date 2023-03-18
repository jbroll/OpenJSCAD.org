import banner from 'rollup-plugin-banner'

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/jscad-web.min.js',
      format: 'umd',
      name: 'jscadWeb'
    },
    {
      file: 'dist/jscad-web.es.js',
      format: 'es'
    }
  ],
  plugins: [
    banner('<%= pkg.description %>\n<%= pkg.name %>\nVersion <%= pkg.version %>\n<%= pkg.license %> License')
  ]
}
