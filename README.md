## textlint-plugin-rustdoc

![NPM Version](https://img.shields.io/npm/v/%40mirror-kt%2Ftextlint-plugin-rustdoc)

[textlint](https://textlint.org) plugin to support [rustdoc](https://doc.rust-lang.org/rustdoc/what-is-rustdoc.html)
comments.

### Installation

```shell
# npm
npm add -D @mirror-kt/textlint-plugin-rustdoc

# yarn
yarn add -D @mirror-kt/textlint-plugin-rustdoc

# pnpm
pnpm add -D @mirror-kt/textlint-plugin-rustdoc
```

And write the following content in the textlint configuration file (e.x. `.textlintrc.json`).

```jsonc
{
  "plugins": {
    "@mirror-kt/textlint-plugin-rustdoc": true
  },
  "rules": {
    // your rules...
  }
}
```