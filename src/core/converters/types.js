/**
 * Converter contract used by the registry, GUI, and CLI.
 *
 * Every converter is a plain object that describes its identity, input/output
 * shape, declarative option schema, and an async `run(input, context)` method.
 * GUI builds the options panel from the schema; CLI parses flags from it; both
 * paths converge on the same `run` call.
 *
 * @typedef {Object} ConverterOption
 * @property {string} key                Stable identifier used in code, CLI flag, and config object.
 * @property {'boolean'|'string'|'enum'|'number'} type
 * @property {string} [label]            Human-readable label for GUI.
 * @property {string} [description]      Longer help text.
 * @property {*} [default]               Default value when the user does not set it.
 * @property {string[]} [values]         Allowed values for `enum` type.
 * @property {number} [min]              Minimum for `number` type.
 * @property {number} [max]              Maximum for `number` type.
 *
 * @typedef {Object} ConverterIO
 * @property {string[]} extensions       Lowercase file extensions including the dot.
 * @property {'file'|'folder'|'file-or-folder'} type
 *
 * @typedef {Object} ConverterContext
 * @property {(message: string) => void} log
 * @property {(payload: { done: number, total: number, currentFile?: string }) => void} progress
 * @property {AbortSignal} [signal]
 *
 * @typedef {Object} ConverterRunInput
 * @property {string[]} inputs           Absolute paths the user selected (files and/or one folder).
 * @property {string} output             Absolute path of the output folder.
 * @property {Object} options            Already merged with defaults from the schema.
 *
 * @typedef {Object} ConverterRunResult
 * @property {string[]} outputs                                                Paths of files the converter created.
 * @property {{ processed: number, skipped: number, errors: Array<{file: string, error: string}> }} stats
 *
 * @typedef {Object} Converter
 * @property {string} id                                                        Stable kebab-case id (e.g. "kml-to-mif").
 * @property {string} name
 * @property {string} description
 * @property {ConverterIO} inputs
 * @property {ConverterIO} outputs
 * @property {ConverterOption[]} options
 * @property {(input: ConverterRunInput, ctx: ConverterContext) => Promise<ConverterRunResult>} run
 */

module.exports = {}
