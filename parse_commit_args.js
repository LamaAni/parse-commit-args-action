const core = require('@actions/core')
const github = require('@actions/github')
const request = require('http').request

class Output {
  constructor() {
    this.is_release = github.context.eventName == 'release'
    this.evnet_name = github.context.eventName
    this.is_pull_request = github.context.head_ref != null
  }
}

async function get_head_commit() {
  if (github.context.payload.head_commit != null)
    return github.context.payload.head_commit

  let commits_url = github.context.repository.commits_url

  const all_commits = JSON.parse(
    await new Promise((resolve, reject) => {
      request(commits_url, (rsp) => {
        try {
          let data = ''
          rsp.on('data', (chunk) => {
            data += chunk
          })
          rsp.on('end', () => {
            resolve(data)
          })
          rsp.on('error', (err) => {
            reject(err)
          })
        } catch (err) {
          reject(err)
        }
      })
    })
  )

  return all_commits[0].commit
}

async function main() {
  const ref = github.context.ref
  const head_commit = await get_head_commit()
  console.log(JSON.stringify(head_commit, null, 2))
  console.log('\n\n\n\n')
  console.log(JSON.stringify(github.context, null, 2))
}

main().catch((err) => {
  core.setFailed(error.message)
  process.exit(1)
})
