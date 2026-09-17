# PWA icons

The app manifest at `/manifest.webmanifest` uses the supplied square NegOSu PNGs in `public/images` (512×512 and 1024×1024). Root metadata advertises the manifest and an Apple touch icon. The existing favicon remains the browser tab icon; business-owned pages retain their own configured logo with a valid NegOSu fallback when no logo is configured.

The manifest opens `/dashboard` in standalone mode; unauthenticated users follow the existing login flow. Manifest/icon requests are public static assets and do not require session refresh. These assets are declared as ordinary icons, not maskable artwork, to avoid clipping the supplied edge-to-edge logo. The 2732px image is not declared as a device-specific splash screen.

This change configures install branding only. It does not add offline caching or a service worker. Existing installations may need removal and reinstallation to pick up cached icon changes.

Validation: manifest unit test checks PNG headers and actual dimensions; business-branding tests cover custom logos and fallback icons. Run `npm test` and `npm run check` before release. No schema or RLS changes.
