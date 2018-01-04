const fs = require('fs')
const glob = require('glob')
const docgen = require('react-docgen')
const { createDisplayNameHandler } = require('react-docgen-displayname-handler')
const chokidar = require('chokidar')
const { info, warn } = require('prettycli')

/* CLI param for watch mode */
const watch = process.argv.includes('-w') || process.argv.includes('--watch')

/* Helper function */
const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

/* Get list of js and md files from atoms and molecules */
const javascriptFiles = glob.sync('src/components/+(atoms|molecules)/**/*.js')
let markdownFiles = glob.sync('src/components/+(atoms|molecules)/**/*.md')

const run = () => {
  info('DOCS', 'Generating metadata')
  let metadata = javascriptFiles
    .map(path => {
      try {
        /* skip secondary files in molecules */
        if (path.includes('molecules') && !path.includes('index.js')) return

        /* append display name handler to handlers list */
        const handlers = docgen.defaultHandlers.concat(createDisplayNameHandler(path))

        /* read file to get source code */
        const code = fs.readFileSync(path, 'utf8')

        /* parse the component code to get metadata */
        const data = docgen.parse(code, null, handlers)

        /* add filepath to metadata */
        data.filepath = path

        /* get documentation file path */
        let documentationPath

        if (path.includes('molecules')) {
          /* molecule roots are called index.js, doc is named after directory */
          const directoryName = path.split('/').splice(-2, 1)[0]
          documentationPath = path.replace('index.js', `${directoryName}.md`)
        } else {
          /* for atoms, the name is same as the javascript filename */
          documentationPath = path.replace('.js', '.md')
        }

        /* add documentation if exists */
        if (fs.existsSync(documentationPath)) {
          data.documentation = fs.readFileSync(documentationPath, 'utf8')
          /* remove from markdown files list (useful later) */
          markdownFiles = markdownFiles.filter(path => path !== documentationPath)
        } else {
          warn('documentation not found for ' + path)
        }

        return data
      } catch (err) {
        /* warn if there was a problem with getting metadata */
        warn('Could not parse metadata for ' + path)
      }
    })
    /*
      filter out null values,
      this protects against components that don't have metadata yet
    */
    .filter(meta => meta)

  /* Add documentation files that are not implemented yet */

  markdownFiles.map(path => {
    const data = {}

    /* attach content of documentation file */
    data.documentation = fs.readFileSync(path, 'utf8')

    /* attach temporary filepath */
    data.filepath = path

    /* infer display name from path */
    data.displayName = capitalize(
      path
        .split('/')
        .pop()
        .replace('.md', '')
    )

    metadata.push(data)
  })

  /*
    Write the file in docs folder
    TODO: Rethink tooling for docs which works across packages
  */
  fs.writeFileSync('src/docs/metadata.json', JSON.stringify({ metadata }, null, 2), 'utf8')
}

/* watch mode 👀 */
if (watch) {
  console.log('running in watch mode')
  chokidar
    .watch('src/components', { ignored: ['node_modules'] })
    .on('ready', run)
    .on('change', run)
    .on('unlink', run)
} else {
  run()
}
