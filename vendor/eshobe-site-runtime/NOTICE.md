# Vendored upstream runtime

Unmodified `src/` and `dist/` files from `hamidnoshady/eshobe-cms`,
`packages/site-runtime`, version 0.1.0, pinned to commit
`863f4f5d4485dfc847b4b1d013e644036580e591`.

Source: https://github.com/hamidnoshady/eshobe-cms/tree/863f4f5d4485dfc847b4b1d013e644036580e591/packages/site-runtime

The upstream package declares MIT (see LICENSE). It is a workspace package and
is not available in the public npm registry. Vendoring its published JavaScript
and types makes this theme installable without private registry credentials.
No money, date, digit or theme-token implementation has been forked.

Contract adapters outside this directory supply the documented route resolver
and receipt HMAC, which are not exported by this upstream runtime version.
To update, replace this directory with a newer upstream release, review its
license and contract, then run the integration tests. Do not edit dist by hand.
