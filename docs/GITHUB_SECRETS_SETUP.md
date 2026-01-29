# GitHub Secrets Configuration for Multi-Platform Builds

This guide explains how to configure the required GitHub secrets for building signed Android APKs in the CI/CD pipeline.

## Overview

The multi-platform build system requires GitHub secrets for signing Android release APKs. These secrets are used by the `.github/workflows/build-android.yml` workflow when building release versions (tagged with `v*`).

## Required Secrets

You need to configure the following secrets in your GitHub repository:

### 1. ANDROID_KEYSTORE_BASE64

**Purpose**: Base64-encoded Android keystore file used for signing release APKs.

**How to get the value**:
```bash
# The keystore file is already generated at the project root
base64 -i handsfree-pos-release.keystore | pbcopy
# OR save to file:
base64 -i handsfree-pos-release.keystore -o handsfree-pos-release.keystore.base64
```

The base64 file is already created at: `handsfree-pos-release.keystore.base64`

**To add to GitHub**:
1. Go to your repository on GitHub
2. Navigate to: Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `ANDROID_KEYSTORE_BASE64`
5. Value: Paste the entire base64-encoded string
6. Click "Add secret"

### 2. ANDROID_KEYSTORE_PASSWORD

**Purpose**: Password for the keystore file.

**Value**: `handsfree123`

**To add to GitHub**:
1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `ANDROID_KEYSTORE_PASSWORD`
4. Value: `handsfree123`
5. Click "Add secret"

### 3. ANDROID_KEY_ALIAS

**Purpose**: Alias of the key inside the keystore.

**Value**: `handsfree-pos`

**To add to GitHub**:
1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `ANDROID_KEY_ALIAS`
4. Value: `handsfree-pos`
5. Click "Add secret"

### 4. ANDROID_KEY_PASSWORD

**Purpose**: Password for the specific key (same as keystore password in this case).

**Value**: `handsfree123`

**To add to GitHub**:
1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `ANDROID_KEY_PASSWORD`
4. Value: `handsfree123`
5. Click "Add secret"

## Quick Setup Checklist

- [ ] Copy base64-encoded keystore from `handsfree-pos-release.keystore.base64`
- [ ] Add `ANDROID_KEYSTORE_BASE64` secret to GitHub
- [ ] Add `ANDROID_KEYSTORE_PASSWORD` = `handsfree123` to GitHub
- [ ] Add `ANDROID_KEY_ALIAS` = `handsfree-pos` to GitHub
- [ ] Add `ANDROID_KEY_PASSWORD` = `handsfree123` to GitHub
- [ ] Verify all 4 secrets are listed in repository settings
- [ ] Test by pushing a version tag (e.g., `v3.1.1`)

## Security Notes

1. **Never commit the keystore file to Git**: The keystore files are gitignored.
2. **Keep backup**: Store the keystore file securely offline. If lost, you cannot update existing app installations.
3. **Rotate if compromised**: If the keystore is exposed, generate a new one and update all secrets.
4. **Limited access**: Only repository admins can view/edit GitHub secrets.
5. **Workflow cleanup**: The workflow automatically deletes the keystore file after build completion.

## Keystore Details

For reference, the generated keystore has the following properties:

- **Algorithm**: RSA
- **Key Size**: 2048 bits
- **Validity**: 10,000 days (~27 years)
- **Alias**: handsfree-pos
- **Organization**: Stonepot Tech
- **Location**: Generated at project root (gitignored)

## Verifying Secrets

After adding all secrets, you can verify they're configured correctly:

1. Go to repository Settings → Secrets and variables → Actions
2. You should see 4 secrets listed:
   - ANDROID_KEYSTORE_BASE64
   - ANDROID_KEYSTORE_PASSWORD
   - ANDROID_KEY_ALIAS
   - ANDROID_KEY_PASSWORD
3. GitHub will show when each secret was last updated

## Testing the Build

To test the Android signed build:

1. Ensure all secrets are configured
2. Create and push a version tag:
   ```bash
   git tag v3.1.1
   git push origin v3.1.1
   ```
3. Monitor the GitHub Actions workflow: Actions → Build Android
4. Check for successful APK signing in the build logs
5. Download the APK artifact and verify signature:
   ```bash
   apksigner verify --verbose handsfree-pos-android-arm64.apk
   ```

## Troubleshooting

### Build fails with "Keystore file not found"
- Verify `ANDROID_KEYSTORE_BASE64` secret is set
- Check the base64 encoding is complete (no truncation)

### Build fails with "Incorrect keystore password"
- Verify `ANDROID_KEYSTORE_PASSWORD` matches the keystore (should be `handsfree123`)
- Check for extra spaces or characters in the secret value

### Build fails with "Key alias not found"
- Verify `ANDROID_KEY_ALIAS` is set to `handsfree-pos`
- Check the keystore was generated with the correct alias

### APK signature verification fails
- The APK may not have been signed (check if it was a release build with tag)
- Verify all 4 secrets are correctly configured
- Check workflow logs for signing errors

## Regenerating Keystore

If you need to generate a new keystore:

```bash
keytool -genkey -v \
  -keystore handsfree-pos-release-new.keystore \
  -alias handsfree-pos \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <new-password> \
  -keypass <new-password> \
  -dname "CN=HandsFree POS, OU=Development, O=Stonepot Tech, L=Unknown, ST=Unknown, C=IN"

# Encode to base64
base64 -i handsfree-pos-release-new.keystore -o handsfree-pos-release-new.keystore.base64
```

Then update all GitHub secrets with the new values.

## Additional Resources

- [Android App Signing Documentation](https://developer.android.com/studio/publish/app-signing)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Tauri Android Build Guide](https://tauri.app/v2/guides/building/android)
