const core = require('@actions/core')
const github = require('@actions/github')

class Output {
  constructor() {
    this.is_release = github.context.eventName == 'release'
    this.evnet_name = github.context.eventName
    this.is_pull_request = github.context.head_ref != null
  }
}

try {
  // `who-to-greet` input defined in action metadata file
  const ref = github.context.ref
  console.log(github.context.payload.comment)
} catch (error) {
  core.setFailed(error.message)
}
