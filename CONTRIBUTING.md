## Branch flow

On the oval-node, we implemented the [GitLab Flow](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/) as default. 

TL;DR is: we have `development` branch as default, checkout to a new branch, do the code, create a PR to `development`, merge, and then create a new PR from development to `master`, not deleting the dev branch.

Some implications need to be clear here:

- Now you should consider branches as environments - PRs merged on different branches will trigger different deploys.

- `master` and `development` have the same code, but they **DO NOT** have the same commit hash git history: The event of merge creates a new commit, so when you merge to the future branch, `master` in this case, the PR **MERGE** will create a new commit **ONLY** on `master`. Take a look on this example repo we made to get this concept

- With that in mind, **NEVER EVER IN ANY CASE DO THE INVERSE** `master` to `development` . This will create a mess (fixable but please, don’t.)
master only accept PRs to avoid errors, so keep in mind to always open the PR to dev first, and then, open from dev to master.

The [main benefits](https://about.gitlab.com/blog/2020/03/05/what-is-gitlab-flow/) we are getting here is have a development environment very reliable, making sure prod only receives tested code, without the complexity of releases, tags and rebases. We just merge, and get it done.

## Branch flow steps

The commands to follow this pattern will be:

```
$ git checkout development

$ git pull

$ git checkout -b {your-new-branch}

```
**ALWAYS** make sure to checkout from a updated `development` branch.

After do your modifications, go thorugh the [github UI](https://github.com/UMAprotocol/oval-node/compare) to open a new PR from `{your-new-branch}` to `development`


![alt text](https://i.imgur.com/nOJHSl1.png)

Now to get the code to production, on the UI, create a new PR from `development` to `master`.

Remember: **NEVER** the oposite.

![alt text](https://i.imgur.com/BlNsMEW.png)

After merge `development`into `master`, `master` branch **ALWAYS** will be ahead of development, because of the merge commits, and should increase this number:

![alt text](https://i.imgur.com/TmubYOs.png)


Here is an example of how the branch flow should look like in the end of this process:

![alt text](https://i.imgur.com/vpBySTn.png)
