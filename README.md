# parse-commit-args-action

A github action that parses the github commit arguments and allows for use defined commit arguments, via the commit mesage, to be detected.

#### If you like it, star it, so other people would also use it.

# TL;DR

# Default output arguments

Name | Description | Overrideable
---|---|---
is_release | If true, this is a release event | true
is_pull_request | If true, this is a pull request | true
event_name | The name of the github event | true
version | The detected version (defaults to branch, head or tag). Will match the release name | true
 | |
versions | Array. Decomposition of the version using a split char (for use in docker releases). eg. fancy.0.1.12 -> \[fancy, fancy.0, fancy.0.1, fancy.0.1.12\] | false
ref | the github ref | false
last_commit | The last commit | false
commits | A collection of associated commits | false
commit_message | The last commit message | false


# Environment variables

Name | Description | Default value
---|---|---
LOAD_MESSAGE_ARGUMENTS_ON_EVENTS | Conrols which gihub events( release, push...) are allowed to load user commit message args. Otherwise these are ignored. null or empty means all, none never load args | ''
VERSION_MARKER_SPLIT_SYMBOL| A symbol to split the cascading versions | .
ARG_MATCH_REGEX | A regex pattern to detect an input argument word (eg. --my-arg). Will join all match groups to create the full argument. |  /[-]{2}([a-zA-Z0-9][\w-]+)/g
ARG_REGEX_GROUP_JOIN_SYMBOL | Join symbol for between match groups | _

# Licence

Copyright ©
`Zav Shotan` and other [contributors](../../graphs/contributors).
It is free software, released under the MIT licence, and may be redistributed under the terms specified in [LICENSE](LICENSE).
