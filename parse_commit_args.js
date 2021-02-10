const core = require('@actions/core')
const github = require('@actions/github')
const bent = require('bent')
const get_json_request = bent('GET', 'json')
const path = require('path')
// const request = require('request')

/**
 * @typedef {{
 *  author: {
 *    email: string,
 *    name: string,
 *    username: string,
 *  },
 *  committer: {
 *    email: string,
 *    name: string,
 *    username: string,
 *  },
 *  distinct: boolean,
 *  id: string,
 *  message: string,
 *  timestamp: string,
 *  tree_id: string,
 *  url: string,
 * }} Commit
 */

/**
 *  @typedef {import('@actions/github/lib/context').Context} GithubContext
 */

/**
 * @param {GithubContext} context
 * @returns {[Commit]}
 */
async function get_commits(context = null) {
  context = context || github.context

  if (context.payload.commits != null) return context.payload.commits

  /** @type {string} */
  let commits_url =
    (context.payload.pull_request || {}).commits_url ||
    context.payload.repository.commits_url

  commits_url = commits_url.replace('{/sha}', `/${context.sha}`)

  /**
   * @type {[Object]}
   */
  let all_commits = await get_json_request(commits_url, null, {
    'User-Agent': 'parse-commit-args-action',
  })

  all_commits = Array.isArray(all_commits) ? all_commits : [all_commits]

  return all_commits.map((c) => c.commit)
}

const DEFAULT_ARG_MATCH_REGEX = /[-]{2}([a-zA-Z0-9][\w-]+)/g
const MATCH_ARG_REGEX =
  process.env.MATCH_ARG_REGEX != null
    ? new RegExp(MATCH_ARG_REGEX)
    : DEFAULT_ARG_MATCH_REGEX

const ARG_REGEX_GROUP_JOIN_SYMBOL =
  process.env.ARG_REGEX_GROUP_JOIN_SYMBOL || '_'

const VERSION_MARKER_SPLIT_SYMBOL =
  process.env.VERSION_MARKER_SPLIT_SYMBOL || '.'

let LOAD_MESSAGE_ARGUMENTS_ON_EVENTS =
  process.env.LOAD_MESSAGE_ARGUMENTS_ON_EVENTS == null
    ? ''
    : process.env.LOAD_MESSAGE_ARGUMENTS_ON_EVENTS.split([' ', ','])

LOAD_MESSAGE_ARGUMENTS_ON_EVENTS = LOAD_MESSAGE_ARGUMENTS_ON_EVENTS.trim()
LOAD_MESSAGE_ARGUMENTS_ON_EVENTS =
  LOAD_MESSAGE_ARGUMENTS_ON_EVENTS.length == 0
    ? null
    : LOAD_MESSAGE_ARGUMENTS_ON_EVENTS

class CommitArgs {
  constructor({ match_args_regex = MATCH_ARG_REGEX } = {}) {
    this.is_release = false
    this.event_name = '[unknown]'
    this.is_pull_request = false
    this.ref = '[unknown]'

    /**
     * @type {[Commit]}
     */
    this.commits = {}
    /**
     * @type {Commit}
     */
    this.last_commit = {}
    this.commit_message = ''
    this._match_args_regex = match_args_regex
  }

  /**
   * @param {GithubContext} context
   */
  async load_context(context) {
    context = context || github.context
    const ref = context.ref || 'unknown/unknown/unknown'
    const commits = await get_commits(context)
    const last_commit = commits.length == 0 ? null : commits[commits.length - 1]

    this.is_release = context.eventName == 'release'
    this.is_pull_request = context.payload.pull_request != null
    this.event_name = context.eventName

    this.version_type = ref.split('/')[1]
    this.version = path.basename(context.ref)

    const commit_message = (last_commit || {}).message || null
    if (
      commit_message != null &&
      commit_message.trim().length > 0 &&
      (LOAD_MESSAGE_ARGUMENTS_ON_EVENTS == null ||
        new Set(LOAD_MESSAGE_ARGUMENTS_ON_EVENTS).has(context.eventName))
    )
      this._parse_commit_message_args(commit_message)

    let cascade_version = ''
    this.versions = this.version
      .split(VERSION_MARKER_SPLIT_SYMBOL)
      .map((v) => {
        if (cascade_version.length == 0) cascade_version = v
        else cascade_version += VERSION_MARKER_SPLIT_SYMBOL + v
        return cascade_version
      })
      .join(' ')

    this.ref = ref
    this.commits = commits
    this.last_commit = last_commit
    this.commit_message = commit_message

    return this
  }

  _parse_commit_message_args(message = null) {
    let match_args_regex =
      this._match_args_regex instanceof RegExp
        ? this._match_args_regex
        : RegExp(this._match_args_regex, 'g')
    const words = (message || this.commit_message || '').match(
      /[^\s"'][^\s]+|["][^"]*["]|['][^']+[']/g
    )
    let arg_name = null
    for (let word of words) {
      word = word.trim()
      if (word.match(/["].*["]|['].*[']/) != null)
        word = word.slice(1, word.length - 1)
      let match = new RegExp(match_args_regex).exec(word)
      if (match != null) {
        if (arg_name != null) this[arg_name] = true
        arg_name =
          match.length < 2
            ? match[0]
            : match.slice(1).join(ARG_REGEX_GROUP_JOIN_SYMBOL)
        arg_name = arg_name.replace('[^w]', '_')
      } else {
        if (arg_name != null) this[arg_name] = word
        arg_name = null
      }
    }

    if (arg_name != null) this[arg_name] = true
  }
}

async function do_run_env_script(args) {
  if (process.env.RUN_SCRIPT == null) return
  eval(process.env.RUN_SCRIPT)
}

async function parse_args(context = null) {
  const args = await new CommitArgs().load_context(context || github.context)

  await do_run_env_script(args)
  if (process.env.RUN_SCRIPT_FILE != null) {
    let script_file = process.env.RUN_SCRIPT_FILE
    if (/^[.]|[^\/]/.test(script_file))
      script_file = `${process.env.GITHUB_WORKSPACE || ''}${script_file}`
    console.log('Running parsing script file @ ' + script_file)
    await require(script_file)(args)
  }

  let key = ''
  for (key of Object.keys(args)) {
    if (key.startsWith('_')) continue
    core.setOutput(key, args[key])
  }

  return args
}

module.exports = {
  parse_args,
  get_commits,
  CommitArgs,
}

if (require.main == module) {
  parse_args().catch((err) => {
    console.error(err)
    core.setFailed(error.commit_message)
    process.exit(1)
  })
}
