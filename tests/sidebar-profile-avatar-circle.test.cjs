const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Bottom-left sidebar avatar has fixed equal dimensions and does not grow with name", () => {
  const css = read("components/portal/portal-shell.module.css");
  const jsx = read("components/portal/portal-shell.tsx");
  const avatarStyle = css.match(/\.sideAvatar\s*\{([^}]*)\}/)?.[1] ?? "";
  const textStyle = css.match(/\.sideIdentityText\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(avatarStyle, /flex:\s*0 0 36px/);
  assert.match(avatarStyle, /width:\s*36px/);
  assert.match(avatarStyle, /height:\s*36px/);
  assert.match(avatarStyle, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(avatarStyle, /border-radius:\s*50%/);
  assert.match(textStyle, /flex:\s*1 1 auto/);
  assert.doesNotMatch(css, /\.sideIdentity\s*>\s*span\s*\{[^}]*flex:\s*1/);
  assert.match(jsx, /<ProfileAvatar[\s\S]*?size=\{36\}[\s\S]*?className=\{styles\.sideAvatar\}/);
  assert.match(jsx, /<span className=\{styles\.sideIdentityText\}>/);
});

test("Shared ProfileAvatar crops uploaded photos without distortion", () => {
  const component = read("components/profile-avatar.tsx");
  assert.match(component, /borderRadius:\s*"50%"/);
  assert.match(component, /objectFit:\s*"cover"/);
  assert.match(component, /flexShrink:\s*0/);
});
