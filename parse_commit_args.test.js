const { CommitArgsParse, parse_args } = require('./parse_commit_args')

async function test_context(context) {
  const args = await new CommitArgsParse().load_context(context)
  console.log(args)
}

async function main() {
  // console.log(await parse_args(require('./.local/example_release_context.json')))
  // await test_context(require('./.local/example_release_context.json'))
  await test_context(require('./.local/example_push_context.json'))
  // await test_context(require('./.local/example_pr_context.json'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
