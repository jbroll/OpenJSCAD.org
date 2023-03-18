/**
 * Core functionality for JSCAD Applications
 * @jscad/core
 * Version 2.6.4
 * MIT License
 */

import stripBom from 'strip-bom';
import { deserializers, supportedFormats } from '@jscad/io';
import path from 'path';
import { createRequire } from 'module';
import * as jscadModule from '@jscad/modeling';
import { geometries } from '@jscad/modeling';
import JSON5 from 'json5';
import { flatten, toArray } from '@jscad/array-utils';

// FIXME: the unregistering does not work, look into it
const registerJscadExtension = (fs, _require) => {
  _require.extensions['.jscad'] = (module, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    module._compile(stripBom(content), filename);
  };
};
const unRegisterJscadExtension = (fs, _require) => {
  delete _require.extensions['.jscad'];
};

const registerDeserializer = (extension, fs, _require) => {
  const deserializer = deserializers[extension];
  const fileExtension = '.' + extension;
  _require.extensions[fileExtension] = (module, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    const parsed = deserializer({ filename, output: 'geometry' }, content);
    module.exports = parsed;
  };
};
const unregisterDeserializer = (extension, fs, _require) => {
  const fileExtension = '.' + extension;
  delete _require.extensions[fileExtension];
};

const registerAllExtensions = (fs, _require) => {
  registerJscadExtension(fs, _require);

  for (const extension of Object.keys(deserializers)) {
    registerDeserializer(extension, fs, _require);
  }
};

const unRegisterAllExtensions = (fs, _require) => {
  unRegisterJscadExtension(fs, _require);

  for (const extension of Object.keys(deserializers)) {
    unregisterDeserializer(extension, fs, _require);
  }
};

/*
 * Transform the entry into a ready-to-use module.
 */
const modulifyTransform = (options, entry) => Object.assign({}, entry, { source: entry.source });

/*
 * Create a new entry for a script (JSCAD) from the given entry and source
 */
const createJscadEntry = (entry, source) => {
  const ext = 'jscad';
  const name = entry.name.substring(0, entry.name.lastIndexOf('.') + 1) + ext;
  const fullPath = '/' + name;

  return Object.assign({}, entry, { ext, name, fullPath, source })
};

/*
 * Transform the given files and folders if necessary.
 * Transforms are only applied to single files as current deserializers create source with a main() function. Only one.
 * Transforms are NOT applied to projects.
 */
const transformSources = (options, filesAndFolders) => {
  if (filesAndFolders && filesAndFolders.length > 1) return filesAndFolders // skip projects

  const codeTransforms = {
    js: [modulifyTransform],
    jscad: [modulifyTransform]
  };

  const updateEntry = (entry) => {
    if (entry.source && entry.ext) {
      const transformOptions = Object.assign({}, options, { filename: entry.name, output: 'script' });
      if (entry.ext in deserializers) {
        const deserializer = deserializers[entry.ext];
        const source = deserializer(transformOptions, entry.source);
        return createJscadEntry(entry, source)
      }
      if (entry.ext in codeTransforms) {
        const transforms = codeTransforms[entry.ext];
        const transformedEntry = transforms.reduce((entry, transform) => transform(transformOptions, entry), entry);
        return transformedEntry
      }
    }
    return entry
  };

  if (filesAndFolders) {
    filesAndFolders = filesAndFolders.map((entry) => updateEntry(entry));
  }
  return filesAndFolders
};

const makeFakeFs = (filesAndFolders) => {
  const findMatch = (path, inputs = filesAndFolders) => {
    for (let i = 0; i < inputs.length; i++) {
      const entry = inputs[i];
      if (path === entry.fullPath || ('/' + path) === entry.fullPath) {
        return entry
      }
      if (entry.children) {
        const res = findMatch(path, entry.children);
        if (res !== undefined) {
          return res
        }
      }
    }
    return undefined
  };

  const statSync = (path) => {
    const entry = findMatch(path);
    return {
      isFile: (_) => (entry && ('source' in entry && !('children' in entry))),
      isDirectory: (_) => (entry && (!('source' in entry) && ('children' in entry)))
    }
  };

  const fakeFs = {
    statSync,
    existsSync: (path) => {
      const entry = findMatch(path);
      return entry !== undefined
    },
    readdirSync: (path) => {
      const entry = findMatch(path);
      return entry.children.map((x) => x.name)
    },
    readDir: (path, callback) => {
      const entry = findMatch(path);
      callback(null, entry);
    },
    readFile: (path, encoding, callback) => {
      const entry = findMatch(path);
      if (!entry) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      }
      if (!statSync(path).isFile()) {
        callback(new Error(`${entry} is not a file, cannot read`));
      } else {
        callback(null, entry.source);
      }
    },
    readFileSync: (path, encoding) => {
      const entry = findMatch(path);
      if (!entry) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      }
      if (!statSync(path).isFile()) {
        throw new Error(`${entry} is not a file, cannot read`)
      } else {
        return entry.source
      }
    }
  };
  return fakeFs
};

var fsModule = /*#__PURE__*/Object.freeze({
  __proto__: null,
  makeFakeFs: makeFakeFs
});

const getFileExtensionFromString = (input) => {
  if (input.indexOf('.') === -1) {
    return undefined
  }
  return (input.substring(input.lastIndexOf('.') + 1)).toLowerCase()
};

/* Count leading spaces in a line.
This helps provide more descriptive comments after the parameter.

When comment is foundm the number of spaces can be compared with previous parameter definition.
When comment line is indented more than parameter(incl. parameter name)
it is considered as description of previous parameter and not a group definition.

*/
const countSpaces = (line) => {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') count++;
    else if (line[i] === '\t') count += 2;
    else break
  }
  return count
};

const getParameterDefinitionsFromSource = (script) => {
  const lines = [];
  script.split('\n').forEach((l, i) => {
    const trim = l.trim();
    if (trim) {
      lines.push({ code: trim, line: l, lineNum: i + 1, indent: countSpaces(l) });
    }
  });

  let i = 0; let lineNum; let code; let prev; let prevIndent;
  while (i < lines.length) {
    code = lines[i].code;
    i++;
    if (code.length > 12 && code.indexOf('@jscad-params') !== -1) break
  }

  let groupIndex = 1;
  const defs = [];

  while (i < lines.length) {
    code = lines[i].code;
    lineNum = lines[i].lineNum;
    if (code[0] === '}') break

    const isGroup = code[0] === '/';
    if (isGroup && prev) {
      const isHint = prev.type === 'group' || prevIndent + prev.name.length <= lines[i].indent;
      if (isHint) {
        prev.hint = prev.hint ? prev.hint + '\n' : '';
        prev.hint += extractTextFromComment(code, lineNum);
        i++;
        continue
      }
    }

    prevIndent = lines[i].indent;
    if (isGroup) {
      // group
      const name = '_group_' + (groupIndex++);
      const def = parseComment(code, lineNum, name);
      let caption = def.caption;
      if (caption[0] === '>') {
        caption = caption.substring(1).trim();
        if (!def.options) def.options = {};
        def.options.initial = 'closed';
      }

      defs.push(prev = { name, type: 'group', caption, ...def.options });
    } else {
      const idx = code.indexOf('/');
      if (idx === -1) {
        // also handle case when closing bracket is in same line as last parameter
        //   width=11}
        // it is not an exhaustive check but covers aditional case to simplify it for users
        const bracketIdx = code.indexOf('}');
        if (bracketIdx !== -1) code = code.substring(0, bracketIdx);

        const def = parseDef(code, lineNum);
        def.caption = def.name;
        defs.push(prev = def);

        if (bracketIdx !== -1) break
      } else {
        defs.push(prev = parseOne(
          code.substring(idx).trim(),
          code.substring(0, idx).trim(),
          lineNum, lineNum
        ));
      }
    }
    i++;
  }

  return defs
};

const parseOne = (comment, code, line1, line2) => {
  let def = parseDef(code, line2);
  const { caption, options } = parseComment(comment, line1, def.name);
  def.caption = caption || def.name;
  if (options) {
    def = { ...def, ...options };
    if (def.type === 'checkbox' && 'initial' in def) def.checked = true;
    if (def.type === 'slider') {
      if (def.min === undefined) {
        def.min = 0;
      }
      if (def.max === undefined) {
        def.max = 100;
      }
    }
  }

  return def
};

const extractTextFromComment = (c, lineNum) => {
  const prefix = c.substring(0, 2);
  // after cutting-out the comment marker, there could be more spaces to trim
  if (prefix === '//') c = c.substring(2).trim();
  if (prefix === '/*') {
    if (c.substring(c.length - 2) !== '*/') throw new EvalError(`Multi-line comments not supported in parsed parameter definitions, line:${lineNum}`, 'code', lineNum)
    c = c.substring(2, c.length - 2).trim();
  }

  return c
};

const parseComment = (comment, lineNum, paramName) => {
  comment = extractTextFromComment(comment, lineNum);

  const ret = {};
  const idx = comment.indexOf('{');
  if (idx !== -1) {
    try {
      ret.options = JSON5.parse(comment.substring(idx));
    } catch (e) {
      throw new EvalError(`${e.message}, parameter:${paramName}, line:${lineNum}: ${comment.substring(idx)}`, 'code', lineNum)
    }
    comment = comment.substring(0, idx).trim();
  }

  ret.caption = comment;

  return ret
};

const parseDef = (code, line) => {
  if (code[code.length - 1] === ',') code = code.substring(0, code.length - 1).trim();
  let idx = code.indexOf('=');

  if (idx === -1) idx = code.indexOf(':');

  if (idx === -1) {
    return { name: code, type: 'text' }
  } else {
    const initial = code.substring(idx + 1).trim();

    const ret = { type: 'text', name: code.substring(0, idx).trim() };

    if (initial === 'true' || initial === 'false') {
      ret.type = 'checkbox';
      ret.checked = initial === 'true';
    } else if (/^[0-9]+$/.test(initial)) {
      ret.type = 'int';
      ret.initial = parseFloat(initial);
    } else if (/^[0-9]+\.[0-9]+$/.test(initial)) {
      ret.type = 'number';
      ret.initial = parseFloat(initial);
    } else {
      try {
        ret.initial = JSON5.parse(initial);
      } catch (e) {
        throw new EvalError(`Error in the initial value definition for ${code}  ${e.message}, line:${line}`, 'code', line)
      }
    }

    return ret
  }
};

const combineParameterDefinitions = (paramDefFromSource, extraDef) => {
  const def = [...paramDefFromSource];
  if (extraDef) {
    extraDef.forEach((param) => {
      const idx = def.findIndex((p) => p.name === param.name);
      if (idx !== -1) def[idx] = param;
      else def.push(param);
    });
  }
  return def
};

// use posix versions of path, even in the browser
const posix = path.posix ? path.posix : path;

/* find matching path in inputs
 * @param  {} path
 * @param  {} inputs=filesAndFolders
 */
const findMatch = (path, inputs) => {
  for (let i = 0; i < inputs.length; i++) {
    const entry = inputs[i];
    if (path === entry.fullPath || ('/' + path) === entry.fullPath) {
      return entry
    }
    if (entry.children) {
      const res = findMatch(path, entry.children);
      if (res !== undefined) {
        return res
      }
    }
  }
  return undefined
};

const registerJsExtension = (fs, _require) => {
  _require.extensions['.js'] = (module, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    module._compile(stripBom(content), filename);
  };
};

const registerJsonExtension = (fs, _require) => {
  _require.extensions['.json'] = (module, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    module.exports = JSON.parse(content);
  };
};

/*
 * Make require callback functions based on the given file system.
 */
const makeWebRequire = (filesAndFolders, options) => {
  const defaults = {
    apiMainPath: '@jscad/modeling',
    fakeFs: null
  };
  const { apiMainPath, fakeFs } = Object.assign({}, defaults, options);

  // HACK create the require function if necessary
  if (typeof self === 'undefined') {
    // create require via Node API
    createRequire(import.meta.url);
  }

  const { makeFakeFs } = fsModule;

  // FIXME const apiModule = apiMainPath === '@jscad/modeling' ? jscadModule : require(apiMainPath)
  const apiModule = apiMainPath === '@jscad/modeling' ? jscadModule : import(apiMainPath);
  // const fsModule = fakeFs ? fakeFs : makeFakeFs

  // preset core modules
  // FIXME this list of modules should be an option, replacing apiMainPath
  const coreModules = {
    // '@jscad/io': {
    //   exports: require('@jscad/io')
    // },
    // '@jscad/array-utils': {
    //   exports: require('@jscad/array-utils')
    // },
    '@jscad/modeling': {
      exports: apiModule
    },
    // expose the fake fs module
    fs: {
      exports: fsModule
    }
  };

  const extensions = {};
  const moduleCache = {};

  /* Require (obtain) the exports for the given require path, relative to the given current path.
   * The logic is based on the original NODE require() function.
   * @see https://nodejs.org/dist/latest-v12.x/docs/api/modules.html#modules_all_together
   */
  const _require = (currentPath, requirePath) => {
    // core modules
    const directModule = coreModules[requirePath];
    if (directModule) {
      return directModule.exports
    }

    if (!currentPath || requirePath.startsWith('/')) {
      currentPath = '/';
    }

    const loadAsFile = (requirePath) => {
      let baseExt = getFileExtensionFromString(requirePath);
      if (!baseExt) {
        baseExt = 'js'; // for lookups
        requirePath = requirePath + '.js';
      }
      baseExt = '.' + baseExt;

      const entry = findMatch(requirePath, filesAndFolders);
      if (!entry) return null

      if (entry.children) return null // directory

      if (extensions[baseExt]) {
        if (moduleCache[requirePath]) return moduleCache[requirePath]
        // evaluate the content
        const matchingModule = {
          exports: {},
          _compile: (content, fileName) => {
            try {
              const moduleMakerFunction = new Function('require', 'module', content); // eslint-disable-line no-new-func
              moduleMakerFunction(_require.bind(null, entry.fullPath), matchingModule);
            } catch (e) {
              // catch errors and build a context specific error, with file name and stack trace
              // the stack trace mimics the style of nodejs
              const message = e.message;
              fileName = fileName.replace('/', '');
              // NOTE: only firefox provides line and column numbers
              const lineNumber = e.lineNumber ? e.lineNumber - 2 : 0; // the call to Function (above) adds two lines
              const columnNumber = e.columnNumber ? e.columnNumber : 0;
              if (e.stack.startsWith('Object')) {
                e.stack = `${e.stack}\nObject.<anonymous> (${fileName}:${lineNumber}:${columnNumber})`;
              } else {
                e = new SyntaxError(message, fileName, lineNumber);
                e.columnNumber = columnNumber;
                e.stack = `Object.<anonymous> (${fileName}:${lineNumber}:${columnNumber})`;
              }
              throw e
            }

            const paramDefFromSource = content.includes('@jscad-params') ? getParameterDefinitionsFromSource(content) : [];
            const originalFunc = matchingModule.exports.getParameterDefinitions;
            // replace getParameterDefinitions in the module, with version taht adds parsed definitions
            matchingModule.exports.getParameterDefinitions = () => combineParameterDefinitions(paramDefFromSource, originalFunc ? originalFunc() || [] : []);
          }
        };
        extensions[baseExt](matchingModule, entry.fullPath);
        moduleCache[requirePath] = matchingModule.exports;
        return moduleCache[requirePath]
      }
      return null
    };

    const loadIndex = (requirePath) => {
      const entry = findMatch(requirePath, filesAndFolders);
      if (!entry) return null

      if (requirePath === '/') requirePath = ''; // FIXME hack for multiple file dragNdrop

      let indexPath = requirePath + '/index.js';
      let matchingModule = loadAsFile(indexPath);
      if (matchingModule) return matchingModule

      indexPath = requirePath + '/index.json';
      matchingModule = loadAsFile(indexPath);
      if (matchingModule) return matchingModule

      return null
    };

    const loadAsDirectory = (requirePath) => {
      let entry = findMatch(requirePath, filesAndFolders);
      if (!entry) return null

      if (!entry.children) return null // file

      // load from main definition
      let matchingModule;
      const jsonPath = requirePath + '/package.json';
      entry = findMatch(jsonPath, filesAndFolders);
      if (entry) {
        const main = JSON.parse(entry.source).main;
        if (main) {
          const mainPath = posix.normalize(requirePath + '/' + main);
          matchingModule = loadAsFile(mainPath);
          if (matchingModule) return matchingModule

          matchingModule = loadIndex(mainPath);
          if (matchingModule) return matchingModule

          return null
        }
      }

      // load index
      matchingModule = loadIndex(requirePath);
      if (matchingModule) return matchingModule

      return null
    };

    // relative paths (POSIX style)
    if (requirePath.startsWith('./') || requirePath.startsWith('/') || requirePath.startsWith('../')) {
      requirePath = posix.normalize(posix.dirname(currentPath) + posix.sep + requirePath);
      // load as file
      let loadedModule = loadAsFile(requirePath);
      if (loadedModule) return loadedModule

      // load as directory
      loadedModule = loadAsDirectory(requirePath);
      if (loadedModule) return loadedModule

      throw new Error(`Cannot find relative path to module ${requirePath}`)
    }

    // TODO load self-reference

    const nodeModulesPaths = (basePath) => {
      const parts = basePath.split('/');
      const dirs = [];
      for (let i = parts.length - 1; i > 0; i--) {
        if (parts[i] === 'node_modules') continue
        const dir = posix.sep + posix.join(...parts.slice(1, i + 1), 'node_modules');
        dirs.push(dir);
      }
      return dirs
    };

    const loadNodeModules = (requirePath, basePath) => {
      const dirs = nodeModulesPaths(basePath);
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const relPath = posix.join(dir, requirePath);
        // load as file
        let loadedModule = loadAsFile(relPath);
        if (loadedModule) return loadedModule
        // load as directory
        loadedModule = loadAsDirectory(relPath);
        if (loadedModule) return loadedModule
      }
      return null
    };

    // load node_module
    const loadedModule = loadNodeModules(requirePath, posix.dirname(currentPath));
    if (loadedModule) return loadedModule

    throw new Error(`Cannot find module ${requirePath}`)
  };

  // create a top level require for the whole file system
  const req = _require.bind(null, '/');
  req.extensions = extensions;
  req.resolve = () => {};

  registerJsExtension(makeFakeFs(filesAndFolders), req);
  registerJsonExtension(makeFakeFs(filesAndFolders), req);
  return req
};

/*
 * Normalize the given design module for internal use.
 */
const normalizeDesignModule = (rootModule) => {
  if (!rootModule) {
    throw new Error('no root module found, please check the project structure')
  }
  if (typeof (rootModule) === 'function') {
    console.warn('please refactor the exports, assigning main() as a property, i.e. module.exports = { main }');
    rootModule = { main: rootModule };
  }
  if (!rootModule.main) {
    throw new Error('no main() function found, please check the module.exports')
  }
  if (typeof (rootModule.main) !== 'function') {
    throw new Error('main is not a function, please check the module.exports')
  }
  return rootModule
};

/**
 * casts the parameters/ get their correct values based on the
 * raw parameters (passed into the CLI tool for example) and the
 * parameter defintions as present in the jscad script
 * @param {Object} inputParameters: input parameter as an object {paramName: paramValue}
 * @param {Array} parameterDefinitions
 * @returns {Object} the parameter values, as an object
 */
const applyParameterDefinitions = (inputParameters, parameterDefinitions, throwOnNoDefinition = false) => {
  const values = Object.keys(inputParameters).reduce((paramValues, paramName) => {
    let value = inputParameters[paramName];

    const definitions = parameterDefinitions.filter((definition) => definition.name === paramName);
    const definition = definitions.length > 0 ? definitions[0] : { type: 'unknown' };

    switch (definition.type) {
      case 'choice':
        value = valueForChoices(value, definition);
        break
      case 'float':
      case 'number':
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          value = parseFloat(value);
        } else {
          throw new Error('Parameter (' + paramName + ') is not a valid number (' + value + ')')
        }
        break
      case 'int':
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          value = parseInt(value);
        } else {
          throw new Error('Parameter (' + paramName + ') is not a valid number (' + value + ')')
        }
        break
      case 'checkbox':
        value = !!value;
        break
      case 'radio':
        value = valueForChoices(value, definition);
        break
      case 'slider':
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          value = parseFloat(value);
        } else {
          throw new Error('Parameter (' + paramName + ') is not a valid number (' + value + ')')
        }
        break
      default:
        if (throwOnNoDefinition) {
          throw new Error(`Parameter (${paramName}) has no matching definition`)
        }
        break
    }
    paramValues[paramName] = value;
    return paramValues
  }, {});
  return values
};

const isNumber = (value) => (!isNaN(parseFloat(value)) && isFinite(value));

const valueForChoices = (inputValue, definition) => {
  let value = inputValue;
  // we try to match values against captions, then parse as numbers if applicable, then fallback to original value
  const valueIndex = definition.captions ? definition.captions.indexOf(value) : definition.values.indexOf(value);
  const valueInDefinition = valueIndex > -1;
  const valueInDefinitionCaptionsAndValue = valueInDefinition && definition.values.length >= valueIndex;
  value = valueInDefinitionCaptionsAndValue ? definition.values[valueIndex] : value;
  value = definition.values.length > 0 && isNumber(definition.values[0]) ? parseFloat(value) : value;
  value = definition.values.length > 0 && typeof value === 'boolean' ? !!value : value;
  return value
};

/*
 * @param  {} parameterDefinitions
 * @param  {} inputParameters
 */
const getParameterValuesFromParameters = (parameterDefinitions, inputParameters) => {
  const parameterValues = {};
  for (const a in parameterDefinitions) { // defaults, given by getParameterDefinitions()
    const x = parameterDefinitions[a];
    if ('default' in x) {
      parameterValues[parameterDefinitions[a].name] = parameterDefinitions[a].default;
    } else if ('initial' in x) {
      parameterValues[parameterDefinitions[a].name] = parameterDefinitions[a].initial;
    } else if ('checked' in x) {
      parameterValues[parameterDefinitions[a].name] = parameterDefinitions[a].checked;
    }
  }
  for (const parameterName in inputParameters) { // given by command-line or other source
    parameterValues[parameterName] = inputParameters[parameterName];
  }
  return parameterValues
};

const doesModuleExportParameterDefiniitions = (moduleToCheck) => moduleToCheck && 'getParameterDefinitions' in moduleToCheck;

const getRawParameterDefinitionsAndValues = (rootModule, overrides) => {
  let parameterValues = {};
  let parameterDefinitions = [];
  if (doesModuleExportParameterDefiniitions(rootModule)) {
    parameterDefinitions = rootModule.getParameterDefinitions(overrides) || [];
    parameterValues = getParameterValuesFromParameters(parameterDefinitions);
  }
  return { parameterDefinitions, parameterValues }
};

/*
 * given the root/main module and optional parameter value overrides,
 * returns parameterDefinitions & 'default' parameter values
 * the overrides are passed for to enable the parameter definitions to access the PREVIOUS
 * version of the parameter values
 * @param  {Module} rootModule an object with a structure like { main: function, getParameterDefinitions: function}
 * getParameterDefinitions is optional
 * @param  {Object} overrides an object containing parameter values, used as overrides
 * @returns {Object} { parameterValues, parameterDefinitions }
 */
const getParameterDefinitionsAndValues = (rootModule, overrides) => {
  let { parameterDefinitions, parameterValues } = getRawParameterDefinitionsAndValues(rootModule, overrides);
  parameterValues = Object.assign({}, parameterValues, overrides);
  parameterValues = parameterValues ? applyParameterDefinitions(parameterValues, parameterDefinitions) : parameterValues;

  return { parameterValues, parameterDefinitions }
};

/*
 * extracts the parameter
 * @param {Array} paramControls
 * @param {Boolean} onlyChanged
 * @returns {Object} the parameter values, as an object
 */
const getParameterValuesFromUIControls = (paramControls, parameterDefinitions, onlyChanged) => {
  const parameterValues = {};
  let value;
  for (let i = 0; i < paramControls.length; i++) {
    const control = paramControls[i];

    switch (control.paramType) {
      case 'choice':
        value = control.options[control.selectedIndex].value;
        break
      case 'float':
      case 'number':
        value = control.value;
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          value = parseFloat(value);
        } else {
          throw new Error('Parameter (' + control.paramName + ') is not a valid number (' + value + ')')
        }
        break
      case 'int':
        value = control.value;
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          value = parseInt(value);
        } else {
          throw new Error('Parameter (' + control.paramName + ') is not a valid number (' + value + ')')
        }
        break
      case 'checkbox':
        value = control.checked;
        break
      case 'radio':
        if (!control.checked) {
          continue
        }
        value = control.value;
        break
      case 'group':
        value = control.className.includes('open') ? 'open' : 'closed';
        break
      default:
        value = control.value;
        break
    }
    if (onlyChanged) {
      if ('initial' in control && control.initial === value) {
        continue
      } else if ('default' in control && control.default === value) {
        continue
      }
    }
    parameterValues[control.paramName] = value;
  }
  return parameterValues
};

var index$5 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  applyParameterDefinitions: applyParameterDefinitions,
  getParameterDefinitionsAndValues: getParameterDefinitionsAndValues,
  getParameterValuesFromParameters: getParameterValuesFromParameters,
  getParameterValuesFromUIControls: getParameterValuesFromUIControls
});

/**
 * load a jscad script, injecting the basic dependencies if necessary
 * @param source the source code
 * @param {String} mainPath - file or directory path
 * @param {String} apiMainPath - path to main API module, i.e. '@jscad/modeling'
 * @param {Array} filesAndFolders - array of files and folders to use
 * @param {Object} parameterValuesOverride - the values to use to override the defaults for the current design
 */
const loadDesign = (mainPath, apiMainPath, filesAndFolders, parameterValuesOverride) => {
  // transform the source if passed non-javascript content, i.e. stl
  filesAndFolders = transformSources({ apiMainPath }, filesAndFolders);

  if (filesAndFolders.length > 1) {
    // this only happens if several files were dragNdrop
    // FIXME throw new Error('please create a folder for multiple part projects')
    // create a file structure to house the contents
    filesAndFolders = [
      {
        fullPath: '/',
        name: '',
        children: filesAndFolders
      }
    ];
  }
  const fakeFs = makeFakeFs(filesAndFolders);

  const webRequire = makeWebRequire(filesAndFolders, { apiMainPath });

  // register all extension formats
  registerAllExtensions(fakeFs, webRequire);

  // find the root module
  let rootModule = webRequire(filesAndFolders[0].fullPath);

  rootModule = normalizeDesignModule(rootModule);

  // rootModule SHOULD contain a main() entry and optionally a getParameterDefinitions entry
  // the design (module tree) has been loaded at this stage
  // now we can get our usefull data (definitions and values/defaults)
  const parameters = getParameterDefinitionsAndValues(rootModule, parameterValuesOverride);

  return { rootModule, ...parameters }
};

const { geom2, geom3, path2 } = geometries;

/*
 * Serialize the given solids/objects into web worker message content.
 * @param {Array} solids - list of solids to serialize
 * @return {Array} web worker message contents
 */
const serializeSolids = (solids) => {
  // NOTE: the use of compactBinary formats was removed due to
  // that lack of support for additional attributes, as well as
  // imcomplete support for transfering objects via web workers

  // NOTE: JSON.stringify was used at some point, but was removed because it was no longer needed
  // for postMessage JavaScript engines now use an optimized structured clone alg.
  // which should be at least as fast as JSON.stringify
  solids = solids.map((object) => {
    // apply the transforms before serializing
    if (geom2.isA(object)) geom2.toSides(object);
    if (geom3.isA(object)) geom3.toPolygons(object);
    if (path2.isA(object)) path2.toPoints(object);
    return object
  });
  return solids
};

const isGeom2 = geometries.geom2.isA;
const isGeom3 = geometries.geom3.isA;
const isPath2 = geometries.path2.isA;

/*
 * determine if the given results contain valid geometry
 */
const isResultGeometry = (results) => {
  if (Array.isArray(results) && results.length > 0) {
    return results.reduce((acc, result) => acc || (isGeom3(result) || isGeom2(result) || isPath2(result)), false)
  }
  return false
};

const instanciateDesign = (rootModule, parameterValues, options) => {
  const { serialize } = options;
  // deal with the actual solids generation
  let solids;
  const rawResults = flatten(toArray(rootModule.main(parameterValues)));

  if (isResultGeometry(rawResults)) {
    solids = serialize ? serializeSolids(rawResults) : rawResults;
    return { solids }
  } else {
    throw new Error('bad output from script: expected geom3/geom2/path2 objects')
  }
};

/**
 * Rebuild JSCAD solids from the given filesAndFolders.
 * The provided filesAndFolders is expected to consist of a valid JSCAD design.
 * An array consisting of:
 * - single file or project folder from the results of walkFileTree()
 * - fake single file entry containing { name, ext, source, fullPath }
 * @param {Object} data - data (and options) required for rebuilding
 * @param {Array} data.filesAndFolders - array of files / directories
 * @param {String} [data.mainPath] - path of the file containing the main function (optional)
 * @param {Boolean} [data.serialize] - true to serialize the solids into JSON
 * @param {Object} [data.lookup] - geometry cache lookup (optional)
 * @param {Object} [data.lookupCounts] - geometry cache lookup counts (optional)
 * @param {Object} [data.parameterValues] - over-rides of parameter values (optional)
 * @param {Function} callback - function to process parameters and solids
 * @return NONE
 *
 * This function extracts the parameters first, and then generates the solids.
 * The parsed parameters (definitions and values) are passed back to the given callback function.
 * The generated solids are also passed back to the given callback function.
 * Also, all errors are caught and passed back to the given callback function.
 *
 * Everything is together in a single function, because this is usually run in the context of a web worker
 * And transfering data back & forth is both complex (see transferables) and costly (time)
 **/
const rebuildGeometry = (data, callback) => {
  const defaults = {
    mainPath: '',
    apiMainPath: '@jscad/modeling',
    serialize: false,
    lookup: null,
    lookupCounts: null,
    parameterValues: {}
  };
  let { mainPath, apiMainPath, serialize, lookup, lookupCounts, parameterValues } = Object.assign({}, defaults, data);

  try {
    const filesAndFolders = data.filesAndFolders;

    // let start = new Date()
    const designData = loadDesign(mainPath, apiMainPath, filesAndFolders, parameterValues);
    // send back parameter definitions & values
    // in a worker this would be a postmessage, this is sent back early so that uis can update
    // the parameters editor before the solids are displayed (which takes longer)
    callback(null, {
      type: 'params',
      parameterDefaults: designData.parameterValues,
      parameterDefinitions: designData.parameterDefinitions
    });
    // make sure parameters are correct by applying parameter definitions
    // this might be redundant with ui-side logic, but it makes sure this core piece works regardless of ui
    parameterValues = applyParameterDefinitions(parameterValues, designData.parameterDefinitions);
    parameterValues = Object.assign({}, designData.parameterValues, parameterValues);
    // start = new Date()
    const options = {
      lookup,
      lookupCounts,
      serialize
    };
    const solidsData = instanciateDesign(designData.rootModule, parameterValues, options);

    // send back solids & any other metadata
    callback(null, {
      type: 'solids',
      solids: solidsData.solids,
      lookup: solidsData.lookup,
      lookupCounts: solidsData.lookupCounts
    });
  } catch (error) {
    callback({
      type: 'errors',
      name: error.name ? error.name : 'Error',
      message: error.message ? error.message : error.toString(),
      description: error.description ? error.description : '',
      number: error.number ? error.number : '',
      fileName: error.fileName ? error.fileName : '',
      lineNumber: error.lineNumber ? error.lineNumber : '',
      columnNumber: error.columnNumber ? error.columnNumber : '',
      stack: error.stack ? error.stack : ''
    }, null);
  }
};

const rebuildGeometryCli = async (data) => {
  const defaults = {
    apiMainPath: '@jscad/modeling'
  };
  let { apiMainPath, mainPath, parameterValues, useFakeFs } = Object.assign({}, defaults, data);
  // we need to update the source for our module
  createRequire(import.meta.url);

  // source came from conversion, i.e. not from file system
  if (useFakeFs) {
    const pathParts = path.parse(mainPath);
    const fakeName = `${pathParts.name}.js`;
    const fakePath = `/${pathParts.name}.js`;
    const filesAndFolders = [
      {
        ext: 'js',
        fullPath: fakePath,
        name: fakeName,
        source: data.source
      }
    ];
    makeWebRequire(filesAndFolders, { apiMainPath });

    mainPath = fakePath; // and use the alias as the entry point
  }

  // rootModule should contain exported main and getParameterDefinitions functions
  // const rootModule = requireDesignFromModule(mainPath, requireFn)
  // FIXME HACK for designs with import / export
  const rootModule = await import(mainPath);

  // the design (module tree) has been loaded at this stage
  // now we can get our usefull data (definitions and values/defaults)
  const parameters = getParameterDefinitionsAndValues(rootModule, parameterValues);

  const rawResults = toArray(rootModule.main(parameters.parameterValues));
  return rawResults
};

/**
 * evaluate script & rebuild solids, in seperate thread/webworker
 * @param {String} script the script
 * @param {String} fullurl full url of current script
 * @param {Object} parameters the parameters to use with the script
 * @param {Object} callback the callback to call once evaluation is done /failed
 * @param {Object} options the settings to use when rebuilding the solid
 */

const rebuildGeometryWorker = (self) => {
  self.onmessage = function (event) {
    if (event.data instanceof Object) {
      const { data } = event;
      if (data.cmd === 'generate') {
        rebuildGeometry(data, (error, message) => {
          if (message) self.postMessage(message);
          if (error) self.postMessage(error);
        });
      }
    }
  };
};

var index$4 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  rebuildGeometry: rebuildGeometry,
  rebuildGeometryCli: rebuildGeometryCli,
  rebuildGeometryWorker: rebuildGeometryWorker,
  serializeSolids: serializeSolids
});

var index$3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  registerAllExtensions: registerAllExtensions,
  unRegisterAllExtensions: unRegisterAllExtensions
});

// NOTE/ path.parse is NOT included by browserify & co , hence this function ...
// https://github.com/substack/path-browserify/pull/3
const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;
const splitPath = (filename) => splitPathRe.exec(filename).slice(1);
const parsePath = (pathString) => {
  assertPath(pathString);

  const allParts = splitPath(pathString);
  if (!allParts || allParts.length !== 4) {
    throw new TypeError("Invalid path '" + pathString + "'")
  }
  allParts[1] = allParts[1] || '';
  allParts[2] = allParts[2] || '';
  allParts[3] = allParts[3] || '';

  return {
    root: allParts[0],
    dir: allParts[0] + allParts[1].slice(0, allParts[1].length - 1),
    base: allParts[2],
    ext: allParts[3],
    name: allParts[2].slice(0, allParts[2].length - allParts[3].length)
  }
};

const assertPath = (path) => {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + path)// util.inspect(path))
  }
};

/** get main entry point of a design, given a file system instance and a list of paths
 * @param  {Object} fs a file-system like object (either node's fs or some other) providing at least
 * statSync, existSync, readFileSync, readdirSync
 * @param  {} paths
 */
const getDesignEntryPoint = (fs, paths) => {
  if (!paths) {
    return
  }
  const mainPath = toArray(paths)[0];
  let filePath;
  const stats = fs.statSync(mainPath);
  if (stats.isFile()) {
    return mainPath
  } else if (stats.isDirectory()) {
    // first try to use package.json to find main
    const packageFile = path.join(mainPath, 'package.json');
    if (fs.existsSync(packageFile)) {
      const rMain = JSON.parse(fs.readFileSync(packageFile)).main;
      if (rMain) {
        return path.join(mainPath, rMain)
      }
    }

    // if all else fails try to look for index.js/jscad, main.js/jscad or a file with same name
    // as the folder
    const entries = fs.readdirSync(mainPath);
    const acceptableMainFiles = ['main', 'index', parsePath(path.basename(mainPath)).name];
    const jsMainFiles = acceptableMainFiles.map((x) => x + '.js');
    const jscadMainFiles = acceptableMainFiles.map((x) => x + '.jscad');

    const candidates = entries.filter((entry) => jsMainFiles.concat(jscadMainFiles).includes(entry));
    if (candidates.length > 0) {
      filePath = path.join(mainPath, candidates[0]);
    }
    return filePath
  }
  return mainPath
};

/** attempt to extract a package name from a directory
 * @param  {} fs
 * @param  {} dirName
 * @param  {} filePath
 */
const packageNameFromDir = (fs, dirName, filePath) => {
  const packageFile = path.join(dirName, 'package.json'); // if the directory contains a package.json, try that one
  if (fs.existsSync(packageFile)) {
    const name = JSON.parse(fs.readFileSync(packageFile)).name;
    if (name) {
      return name
    }
  }
  return filePath ? parsePath(path.basename(filePath)).name : path.basename(dirName)
};

/** extract the design name from
 * @param  {Object} fs a file-system like object (either node's fs or some other) providing at least statSync, existSync, readFileSync
 * @param  {Array} paths an array of paths (strings) or a single path
 */
const getDesignName = (fs, paths) => {
  if (!paths) {
    return 'undefined'
  }
  const mainPath = toArray(paths)[0];
  const stats = fs.statSync(mainPath);
  if (stats.isFile()) { // if main path is a file, find its folder
    const dirName = path.dirname(mainPath);
    return packageNameFromDir(fs, dirName, mainPath)
  } else if (stats.isDirectory()) { // if main path is a folder , try to find name from package.json
    // try to use package.json & co to find main
    return packageNameFromDir(fs, mainPath)
  }
};

var index$2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  makeFakeFs: makeFakeFs,
  getDesignEntryPoint: getDesignEntryPoint,
  getDesignName: getDesignName
});

const version = '[VI]{version}[/VI]'; // version is injected by rollup

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  getFileExtensionFromString: getFileExtensionFromString,
  version: version
});

const binaryMimetypes = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',

  otc: 'font/otf',
  otf: 'font/otf',
  ttc: 'font/ttf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff',

  stl: 'application/sla'
};

/*
 * Read the given file asyncronously via a promise.
 * @param {File} file
 * @param {Object} fileMeta - meta information about file
 * @returns {Promise} new promise to read and convert the file
 */
const readFileAsync = (file, fileMeta) => {
  const fullPath = file.fullPath ? file.fullPath : fileMeta.fullPath ? fileMeta.fullPath : '';
  const ext = getFileExtensionFromString(file.name);
  const mimetype = file.mimetype;

  const promiseReader = new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target.result;
      if (result.byteLength) {
        resolve({ name: file.name, ext, fullPath, mimetype, source: result });
      } else if (typeof result === 'string') {
        resolve({ name: file.name, ext, fullPath, mimetype, source: result });
      }
    };

    reader.onerror = (event) => {
      reject(new Error(`Failed to load file: ${fullPath} [${reader.error}]`));
    };

    if (binaryMimetypes[ext]) {
      reader.readAsArrayBuffer(file); // result is ArrayBuffer
    } else {
      reader.readAsText(file); // result is String
    }
    // readAsDataURL() - result is data URI
    // readAsBinaryString() - result is raw binary data (OLD)
  });
  return promiseReader
};

// all known formats are supported
const isSupportedFormat = (file) => {
  const ext = getFileExtensionFromString(file.name);
  const mimetype = supportedFormats[ext] ? supportedFormats[ext].mimetype : binaryMimetypes[ext];
  file.mimetype = file.type && file.type.length ? file.type : mimetype;
  return file.mimetype && file.mimetype.length
};

const pseudoArraytoArray = (pseudoArray) => {
  const array = [];
  for (let i = 0; i < pseudoArray.length; i++) {
    const item = pseudoArray[i];
    if (item) array.push(item.webkitGetAsEntry ? item.webkitGetAsEntry() : item);
  }
  return array
};

const isEmpty = (x) => x !== null && x !== undefined; // skip empty items

/*
 * Process the given directory entries into a series of promises
 * @returns {Promise} one promise to resolve them all
 */
const processEntries = (items) => {
  const results = pseudoArraytoArray(items.filter(isEmpty))
    .filter(isEmpty) // skip empty items
    .reduce((result, item) => {
      if (item.name.startsWith('.')) return result // skip hidden files and directories
      if (item.isFile) {
        result.push(processFile(item));
      } else if (item.isDirectory) {
        result.push(processDirectory(item));
      } else if (item instanceof File) {
        const fullPath = item.webkitRelativePath ? item.webkitRelativePath : undefined;
        const file = isSupportedFormat(item) ? readFileAsync(item, { fullPath }) : undefined;
        if (!file) {
          throw new Error('Unsuported format (or folder in Safari)!')
        }
        result.push(file);
      }
      return result
    }, []);

  return Promise.all(results)
    .then((x) => x.filter((x) => x !== null && x !== undefined))
};

/*
 * Process the given file
 * @param {FileSytemFileEntry} file
 * @returns {Promise} new promise to read and process the file
 */
const processFile = (fileItem) => {
  const promiseFile = new Promise((resolve, reject) => {
    fileItem.file(
      (fileData) => {
        isSupportedFormat(fileData) ? resolve(readFileAsync(fileData, fileItem)) : resolve(undefined);
      },
      (fileError) => {
        const message = `${fileError.message} (${fileError.code})`;
        reject(new Error(`Failed to load file: ${fileItem.fullPath} [${message}]`));
      }
    );
  });
  return promiseFile
};

/*
 * Process the given directory
 * @param {FileSytemDirectoryEntry} directory
 * @returns {Promise} new promise to read and process the directory
 */
const processDirectory = (directory) => {
  const promiseDirectory = new Promise((resolve, reject) => {
    if (directory.entries) {
      directory.entries.length ? processEntries(directory.entries).then(resolve) : resolve([]);
    } else {
      const reader = directory.createReader();
      reader.readEntries((entries) => {
        entries.length ? processEntries(entries).then(resolve) : resolve([]);
      }, reject);
    }
  })
    .then(flatten)
    .then((children) => {
      children = children.map((child) => {
        if (!child.fullPath.startsWith('/')) {
          child.fullPath = directory.fullPath + '/' + child.name;
        }
        return child
      });
      return { children, fullPath: directory.fullPath, name: directory.name }
    });
  return promiseDirectory
};

/*
 * Transform the flat list of files (from HTML input) to a heiarchy of files (from drag-n-drop).
 */
const transformFileList = (fileList) => {
  if (fileList.length === 1) {
    const file = fileList[0];
    const filePath = file.webkitRelativePath ? file.webkitRelativePath : file.name;
    const fileParts = filePath.split(path.sep);

    if (fileParts.length < 2) {
      // special handling for a single File (not a directory)
      const dirFullPath = path.sep;
      const directory = { fullPath: dirFullPath, name: dirFullPath, isDirectory: true, entries: [] };

      file.fullPath = path.normalize(dirFullPath + filePath);

      directory.entries.push(file);

      return [directory]
    }
  }

  let rootDirectory;
  const directories = new Map();

  const addDirectory = (fullPath, name) => {
    if (!directories.has(fullPath)) {
      const directory = { fullPath, name, isDirectory: true, entries: [] };
      if (!rootDirectory) rootDirectory = directory;
      directories.set(fullPath, directory);

      const pathParts = fullPath.split(path.sep);
      if (pathParts.length > 1) {
        const basePath = path.sep + path.join(...pathParts.slice(0, -1));
        const baseDir = directories.get(basePath);
        if (baseDir) baseDir.entries.push(directory);
      }
    }
  };

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const filePath = file.webkitRelativePath ? file.webkitRelativePath : file.name;
    const fileParts = filePath.split(path.sep);

    const hidden = fileParts.reduce((acc, part) => acc || part.startsWith('.'), false);
    if (hidden) continue

    if (!isSupportedFormat(file)) continue

    const dirParts = fileParts.slice(0, -1);
    for (let i = 0; i < dirParts.length; i++) {
      const dirPath = path.sep + path.join(...dirParts.slice(0, i + 1));
      addDirectory(dirPath, dirParts[i]);
    }

    const dirPath = path.sep + path.join(...dirParts);

    const directory = directories.get(dirPath);
    if (directory) directory.entries.push(file);
  }
  directories.clear();
  return [rootDirectory]
};

// this is the core of the drag'n'drop:
//    1) walk the tree
//    2) read the files (readFileAsync)
//    3) return a flattened list of promises containing all file entries
const walkFileTree = (fileList) => {
  let items = fileList;
  if (fileList.length && (fileList[0] instanceof File)) {
    // transform the flat list of File entries
    items = transformFileList(fileList);
  }
  return processEntries(items)
};

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  walkFileTree: walkFileTree
});

export { index$4 as evaluation, index$3 as io, index$2 as loading, index$5 as parameters, index$1 as utils, index as web };
