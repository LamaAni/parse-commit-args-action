# parse-commit-args-action

Parses the last commit and parses user input arguments (eg. --my-arg [val]). Adds helpful default arguments for
release detection and docker. (versio, is_release, is_pull_request ...)

Allows for:
1. Overriding default args (see overrideable column). (i.e. override version, or is_release for example)
1. Select which events allow args reading.
1. Select argument format via regex. (e.g !!my-arg)

#### If you like it, star it, so other people would also use it.

# TL;DR

```yaml
name: 'Test action'
on:
  pull_request:
    branches:
      - 'master'
  release:
    branches:
      - 'master'
    types:
      - created
  push:
    branches:
      - master
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 'parse_commit_args'
        id: args
        uses: LamaAni/parse-commit-args-action@master

      - name: 'show args'
        run: echo "$THE_ARGS"
        env:
          THE_ARGS: '${{ toJSON(steps.args.outputs) }}'

      - name: 'run on release only'
        if: ${{steps.args.outputs.is_release=="true"}}
        run: echo "$THE_ARGS"
        env:
          THE_ARGS: '${{ toJSON(steps.args.outputs) }}'

      - name: 'run on use falg only'
        if: ${{steps.args.outputs.my_flag=="120"}}
        run: echo "$THE_ARGS"
        env:
          THE_ARGS: '${{ toJSON(steps.args.outputs) }}'

```

To activate the user flag,

```shell
git add . && git commit -m"Some commit text --my_flag 120" && git push
```

To override `is_release`,

```shell
git add . && git commit -m"Some commit text --my_flag 120 --is_release true" && git push
```

# Default output arguments

Name | Description | Overrideable
---|---|---
ref | The name of the branch or tag or the pull request number | true
ref_type | The reference type (tags, heads, ...) | true
ref_group | The reference group type (refs ..) | true
is_release | If true, this is a release event | true
is_pull_request | If true, this is a pull request | true
event_name | The name of the github event | true
action | The executing action type (opened, closed ...) | true
default_branch | The repo default branch (defaults to master) | true

pull_request_merged | If true, this action is a result of a merged pull request | true
pull_request_state | "closed" "open" | true
pull_request_base_ref | The base ref for the pull request (merge to) | true
pull_request_head_ref | The head ref for the pull request (merge from) | true
pull_request_merged | If true the pull request has been merged | true
pull_request_is_open | If true the pull request is now open | true
pull_request_active | If true the pull request is active (open and !merged) | true

version | The detected version (defaults to branch, head or tag). Will match the release name, or the pull request head name | true
 | |
versions | Spaced out value. Decomposition of the version using a split char (for use in docker releases). eg. fancy.0.1.12 -> fancy fancy.0, fancy.0.1 fancy.0.1.12 | false
ref | the github ref | false
last_commit | The last commit | false
commits | A collection of associated commits | false
commit_message | The last commit message | false


# Environment variables

Name | Description | Default value
---|---|---
LOAD_MESSAGE_ARGUMENTS_ON_EVENTS | Controls which github events( release, push...) are allowed to load user commit message args. Otherwise these are ignored. null or empty means all, none never load args | ''
VERSION_MARKER_SPLIT_SYMBOL| A symbol to split the cascading versions | .
ARG_MATCH_REGEX | A regex pattern to detect an input argument word (eg. --my-arg). Will join all match groups to create the full argument. |  /[-]{2}([a-zA-Z0-9][\w-]+)/g
ARG_REGEX_GROUP_JOIN_SYMBOL | Join symbol for between match groups | _
RUN_SCRIPT | A javascript script to run after the parameters have been evaluated. Run in method `async (args)=>{}` | empty
RUN_SCRIPT_FILE | A javascript file to run after the parameters have been evaluated. expects, `module.exports=async (args)=>{}` | empty

# Licence

Copyright ©
`Zav Shotan` and other [contributors](../../graphs/contributors).
It is free software, released under the MIT licence, and may be redistributed under the terms specified in [LICENSE](LICENSE).
