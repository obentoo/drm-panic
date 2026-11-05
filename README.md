# bentoo kernel panic report

Web page behind the QR code that bentoo kernels draw on a kernel panic
(`CONFIG_DRM_PANIC_SCREEN_QR_CODE_URL="https://drm-panic.obentoo.org/#"`).
It decodes the kernel messages carried in the QR code and shows them, with
instructions to report the crash.

## Privacy

The kernel appends its data after `#`, in the URL *fragment*. Browsers never
send the fragment to the server, so the panic log is decoded on the reader's
device only and never reaches any server log. The page loads nothing from
other origins; `src/_headers` and the in-page CSP enforce that.

## Format

drm_panic compresses kmsg with zlib and encodes it as a numeric QR segment:

- `z` — Linux 6.14+, the FIDO2 encoding: every 7 bytes become 17 decimal
  digits, the last chunk uses `[0, 3, 5, 8, 10, 13, 15, 17]` digits.
- `zl` — Linux 6.10 to 6.13 legacy encoding.
- `a`, `v`, `d` — architecture, kernel version, distribution.

Example: `https://drm-panic.obentoo.org/#?a=x86_64&v=6.10.0&z=22850245147461960127479103797202645679929458617911856021402989363788`

## Layout

`src/` is the site root, served as static files:

| File | Role |
|---|---|
| `index.html` | page and reporting instructions |
| `panic_report.js` | decoder; inserts every URL value as text, never as HTML |
| `pako_inflate.min.js` | pako 2.1.0 `dist/pako_inflate.min.js`, byte-identical to the npm tarball (`sha512-w+eufiZ1…og2ug==`) |
| `style.css` | styles |
| `_headers` | response headers (CSP, no-referrer, nosniff) for Cloudflare Pages |

## Origin

Fork of [kdj0c/panic_report](https://github.com/kdj0c/panic_report), the
reference decoder named in the kernel's Kconfig help. Changes: bentoo
branding and reporting steps, strict mode, the short last chunk read with
`chunk.length` (upstream's `chunk.len` was undefined), UTF-8 decoding, errors
for damaged or truncated data, a copy button, and the security headers.

Licensed MIT, see `LICENSE`.
