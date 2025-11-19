# ARTEMIS Auto-Update Setup Guide

## Overview

ARTEMIS v2 now has automatic update functionality using GitHub Releases. When you publish a new version, users will automatically be notified and can update with one click.

## How It Works

1. **Version Check**: App checks GitHub Releases every hour (and on startup)
2. **Download**: If newer version found, downloads in background
3. **Notify**: Shows dialog when update is ready
4. **Install**: User clicks "Restart Now" to install

## Publishing Updates

### 1. Bump Version

Edit `package.json`:

```json
{
  "version": "2.0.1" // Increment version number
}
```

### 2. Build Release

```bash
npm run build:electron
```

This creates installers in `dist-build/`:

- Windows: `ARTEMIS Setup 2.0.1.exe`
- macOS: `ARTEMIS-2.0.1.dmg` and `ARTEMIS-2.0.1-mac.zip`
- Linux: `ARTEMIS-2.0.1.AppImage`, `.deb`, `.rpm`

### 3. Create GitHub Release

**Option A: GitHub Web UI**

1. Go to https://github.com/LesTasker2023/ARTEMIS/releases
2. Click "Draft a new release"
3. Tag: `v2.0.1` (must match package.json version with 'v' prefix)
4. Title: `ARTEMIS v2.0.1`
5. Description: Release notes (what's new, bug fixes)
6. Upload files from `dist-build/`:
   - Windows: `*.exe` and `latest.yml`
   - macOS: `*.dmg`, `*.zip`, and `latest-mac.yml`
   - Linux: `*.AppImage`, `*.deb`, `*.rpm`, and `latest-linux.yml`
7. Click "Publish release"

**Option B: GitHub CLI**

```bash
# Install GitHub CLI if needed: https://cli.github.com/

# Create release and upload files
gh release create v2.0.1 \
  --title "ARTEMIS v2.0.1" \
  --notes "Release notes here" \
  dist-build/*.exe \
  dist-build/*.dmg \
  dist-build/*.zip \
  dist-build/*.AppImage \
  dist-build/*.yml
```

**IMPORTANT**: Always upload the `latest*.yml` files - these contain update metadata!

### 4. Users Auto-Update

- Next time users open ARTEMIS, it checks for updates
- Downloads v2.0.1 in background
- Shows "Update Ready" dialog
- Click "Restart Now" to install

## Version Numbering

Follow Semantic Versioning:

- **Major**: `3.0.0` - Breaking changes
- **Minor**: `2.1.0` - New features (backwards compatible)
- **Patch**: `2.0.1` - Bug fixes

Examples:

- `2.0.0-alpha.1` → First alpha release
- `2.0.0-beta.1` → First beta release
- `2.0.0` → Stable release
- `2.0.1` → Bug fix
- `2.1.0` → New feature
- `3.0.0` → Major rewrite

## Testing Updates

### Local Testing

1. Build current version: `npm run build:electron`
2. Install the built app
3. Bump version in package.json
4. Build new version
5. Create local GitHub release (draft)
6. Run installed app - should detect update

### Staged Rollout

For major releases, consider:

1. Release as `pre-release` on GitHub (checkbox)
2. Let beta testers install
3. Gather feedback
4. Convert to full release when stable

## Code Signing (Optional but Recommended)

**Why**: Without code signing, Windows/macOS show security warnings

**Windows**:

- Get code signing certificate (DigiCert, Sectigo, etc.)
- Cost: ~$200/year
- Set environment variables:
  ```bash
  CSC_LINK=path/to/certificate.pfx
  CSC_KEY_PASSWORD=your_password
  ```

**macOS**:

- Enroll in Apple Developer Program ($99/year)
- Get Developer ID certificate
- Set environment variables:
  ```bash
  CSC_LINK=path/to/certificate.p12
  CSC_KEY_PASSWORD=your_password
  APPLEID=your@apple.id
  APPLEIDPASS=app-specific-password
  ```

## Troubleshooting

### Update Not Detected

- Check GitHub release is published (not draft)
- Verify `latest.yml` files uploaded
- Check app version in package.json matches release tag
- Look for errors in Electron console (F12)

### Update Download Fails

- Ensure GitHub release assets are public
- Check internet connection
- Review error in logs

### Update Won't Install

- Close app completely before installing
- Check disk space
- Try manual download from GitHub

## Monitoring

View update logs in Electron DevTools console:

- 🔍 Checking for updates...
- 📦 Update available: 2.0.1
- ⬇️ Downloading update: 45%
- ✅ Update downloaded: 2.0.1

## Disabling Auto-Update (Dev Mode)

Auto-update is automatically disabled when running:

- `npm run dev`
- `npm run dev:electron`

Only active in production builds.

## Manual Update Check

Users can manually check via IPC:

```typescript
await window.electron.checkForUpdates();
```

Add a "Check for Updates" button in Settings if desired.

## Release Checklist

Before publishing:

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run tests: `npm test`
- [ ] Build: `npm run build:electron`
- [ ] Test built app locally
- [ ] Create GitHub release with tag `v{version}`
- [ ] Upload all installers + `latest*.yml` files
- [ ] Write release notes
- [ ] Publish release

## Resources

- [electron-updater docs](https://www.electron.build/auto-update)
- [electron-builder docs](https://www.electron.build/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)

---

**Next Steps**: When ready to publish v2.0.0, follow the "Publishing Updates" guide above!
