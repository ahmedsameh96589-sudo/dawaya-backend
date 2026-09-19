// Escapes user input so it is matched literally inside a RegExp.
// Without this, a search like "(a+)+$" can hang the server (ReDoS) and
// characters such as "." or "*" silently change what matches.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = escapeRegex;
