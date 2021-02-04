const core = require('@actions/core')
const github = require('@actions/github')
const bent = require('bent')
const get_json_request = bent('GET', 'json')
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
 * @returns {Commit}
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
  const all_commits = await get_json_request(commits_url, null, {
    'User-Agent': 'parse-commit-args-action',
  })

  return all_commits.map((c) => c.commit)
}

const DEFAULT_ARG_MATCH_REGEX = /[-]{2}[a-zA-Z]\w+/g

class CommitArgsParse {
  constructor({ match_args_regex = DEFAULT_ARG_MATCH_REGEX } = {}) {
    this.is_release = false
    this.evnet_name = '[unknwon]'
    this.is_pull_request = false
    this.ref = '[unknwon]'
    /**
     * @type {[Commit]}
     */
    this.commits = {}
    /**
     * @type {Commit}
     */
    this.head_commit = {}
    this.message = ''
    this.match_args_regex = match_args_regex
  }

  /**
   * @param {GithubContext} context
   */
  async load_context(context) {
    context = context || github.context

    this.is_release = context.eventName == 'release'
    this.is_pull_request = context.head_ref != null

    this.evnet_name = context.eventName
    this.ref = context.ref
    this.commits = await get_commits(context)
    this.head_commit =
      this.commits.length == 0 ? null : this.commits.reverse()[0]

    this.message = (this.head_commit || {}).message || ''
    this.args = this._parse_commit_message_args(this.match_args_regex)

    return this
  }

  _parse_commit_message_args(match_args_regex = DEFAULT_ARG_MATCH_REGEXF) {
    match_args_regex =
      match_args_regex instanceof RegExp
        ? match_args_regex
        : RegExp(match_args_regex, 'g')
    const words = (this.message || '').split(' ')
    const args = {}
    let arg_name = null
    for (let word in words) {
      if (word.match(match_args_regex) != null) {
        if (arg_name != null) args[arg_name] = true
        arg_name = word
      } else {
        if (arg_name != null) args[arg_name] = word
        arg_name == null
      }
    }

    return args
  }
}

async function main() {
  console.log(JSON.stringify(github.context, null, 2))
  console.log('\n\n\n\n\n')
  const args = await new CommitArgsParse().load_context(github.context)
  console.log(JSON.stringify(args, null, 2))
}

module.exports = {
  main,
  get_commits,
  CommitArgsParse,
}

if (require.main == module) {
  main().catch((err) => {
    console.error(err)
    core.setFailed(error.message)
    process.exit(1)
  })
}
