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

  if (context.payload.release != null) return [] // no commits on release.
  if (context.payload.commits != null) return context.payload.commits

  /**
   * @type {[Object]}
   */
  let all_commits = []
  try {
    if (
      process.env.GITHUB_TOKEN != null &&
      context.payload.pull_request != null
    ) {
      console.log('Loading from pull request')
      const octokit = github.getOctokit(process.env.GITHUB_TOKEN)

      let page = 0
      while (true) {
        const page_commits = await octokit.pulls.listCommits({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          pull_number: context.payload.pull_request.number,
          per_page: 100,
          page: page,
        })
        page += 1
        if (page_commits.data.length == 0) break
        all_commits = all_commits.concat(page_commits.data)
      }
    } else {
      // getting the commit for the sha only.
      console.log('Loading from sha')
      const kit = github.getOctokit(process.env.GITHUB_TOKEN)

      all_commits = [
        await kit.git.getCommit({
          commit_sha: context.sha,
        }),
      ]
    }
  } catch (err) {
    err.message = 'Error retrieving commits. ' + (err.message || '')
    throw err
  }

  all_commits = Array.isArray(all_commits) ? all_commits : [all_commits]
  all_commits = all_commits.map((c) => c.commit)
  all_commits = all_commits.sort(
    (a, b) => Date.parse(b.author.date) - Date.parse(a.author.date)
  )
  return all_commits
}

const PRINT_GITHUB_CONTEXT = process.env.PRINT_GITHUB_CONTEXT == 'true'

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
    this.merged = false

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
    const ref = (context.ref || 'unknown/unknown/unknown').split('/')
    const commits = (await get_commits(context)).slice(0, 10)
    const last_commit = commits.length == 0 ? null : commits[0]

    const payload = context.payload || {}
    const repository = context.payload.repository || {}
    // setting basic flags
    this.ref = ref[2]
    this.ref_type = ref[1]
    this.ref_group = ref[0]
    this.is_release = context.eventName == 'release'
    this.is_prerelease = (context.payload.release || {}).prerelease == true
    this.is_pull_request = context.payload.pull_request != null
    this.event_name = context.eventName
    this.action = payload.action
    this.default_branch = repository.default_branch || 'master'

    this.user_name = context.payload.sender.login || context.payload.sender.name
    this.user_type = context.payload.sender.type

    // loading pull request parameters
    const pull_request = payload.pull_request || {}
    this.pull_request_merged = pull_request.merged == true
    this.pull_request_is_open = pull_request.state == 'open'
    this.pull_request_base_ref = (pull_request.base || {}).ref // merge to
    this.pull_request_head_ref = (pull_request.head || {}).ref // merge from
    this.pull_request_active =
      this.pull_request_is_open && !this.pull_request_merged
    this.pull_request_url = this.is_pull_request
      ? context.payload.pull_request.html_url
      : null

    // parsing args.
    this.version = this.is_pull_request ? this.pull_request_head_ref : this.ref
    this.version = this.version || 'unknown-version'
    this.version = this.version.replace(/[^\w.-]/, '-')

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
    if (words == null) return

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
        arg_name = arg_name.replace(/[^\w]/g, '_')
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
  context = context || github.context
  if (PRINT_GITHUB_CONTEXT) {
    console.log('-----------------------------------')
    console.log(JSON.stringify(context, null, 2))
    console.log('-----------------------------------')
  }
  let args = await new CommitArgs().load_context(context)

  await do_run_env_script(args)

  if (process.env.RUN_SCRIPT_FILE != null) {
    let script_file = process.env.RUN_SCRIPT_FILE
    if (/^[.]|[^\/]/.test(script_file))
      script_file = path.join(process.env.GITHUB_WORKSPACE || '', script_file)
    console.log('Running parsing script file @ ' + script_file)
    const rt_value = await require(script_file)(args)
    if (typeof rt_value == 'object' && rt_value != null) args = rt_value
  }

  let key = ''
  for (key of Object.keys(args)) {
    if (key.startsWith('_')) continue
    core.setOutput(key, args[key])
  }

  // set the json args output.
  core.setOutput('args_as_json', JSON.stringify(args))

  return args
}

module.exports = {
  parse_args,
  get_commits,
  CommitArgs,
}

if (require.main == module) {
  parse_args().catch((err) => {
    try {
      console.log('Context:')
      console.log(JSON.stringify(github.context))
      console.error(err || '[unknown error]')
      core.setFailed(error.commit_message || 'unknown commit message')
    } catch (err) {}
    console.error(err)
    console.error('error while printing')
    process.exit(1)
  })
}
