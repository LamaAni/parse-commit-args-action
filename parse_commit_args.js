const core = require('@actions/core')
const github = require('@actions/github')
const bent = require('bent')
const get_json_request = bent('GET', 'json')
// const request = require('request')

class Output {
  constructor() {
    this.is_release = github.context.eventName == 'release'
    this.evnet_name = github.context.eventName
    this.is_pull_request = github.context.head_ref != null
  }
}

/**
 *  @typedef {import('@actions/github/lib/context').Context} GithubContext
 */

/**
 * @param {GithubContext} context
 */
async function get_head_commit(context = null) {
  context = context || github.context

  if (context.payload.head_commit != null) return context.payload.head_commit

  /** @type {string} */
  let commits_url =
    (context.payload.pull_request || {}).commits_url ||
    context.payload.repository.commits_url

  commits_url = commits_url.replace('{/sha}', `/${context.sha}`)

  const all_commits = await get_json_request(commits_url, null, {
    'User-Agent': 'parse-commit-args-action',
  })

  // const all_commits = await new Promise((resolve, reject) => {
  //   request(
  //     commits_url,
  //     {
  //       headers: {
  //         'User-Agent': 'parse-commit-args-action',
  //       },
  //     },
  //     (err, rsp, body) => {
  //       if (err != null) reject(err)
  //       else resolve(body)
  //     }
  //   )
  // })

  return all_commits[0].commit
}

async function main() {
  const ref = github.context.ref
  const head_commit = await get_head_commit()
  console.log(JSON.stringify(head_commit, null, 2))
  console.log('\n\n\n\n')
  console.log(JSON.stringify(github.context, null, 2))
}

module.exports = {
  main,
  get_head_commit,
  Output,
}

if (require.main == module) {
  main().catch((err) => {
    console.error(err)
    core.setFailed(error.message)
    process.exit(1)
  })
}
