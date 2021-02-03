const { get_head_commit } = require('./parse_commit_args')

async function main() {
  console.log(
    await get_head_commit(require('./.local/example_push_context.json'))
  )
  console.log(
    await get_head_commit(require('./.local/example_pr_context.json'))
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
