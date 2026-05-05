# Cloudflare Images Upload Guide

## Overview
This guide explains how to upload the Khao Piyo logo assets to Cloudflare Images for optimal delivery and performance.

## Assets to Upload

1. **Circular Logo**: `assets/logos/khao-piyo-logo-final.png` (1348x1349px, 580KB)
2. **Text Image**: `assets/logos/khao-piyo-text-transparent.png` (1658x244px, 28KB)

## Method 1: Using the Upload Script (Recommended)

### Prerequisites
1. Create a Cloudflare API Token with **Images Write** permission:
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Select "Custom token"
   - Add permission: **Account** → **Cloudflare Images** → **Edit**
   - Click "Continue to summary" → "Create Token"
   - Copy the token (you'll only see it once!)

### Upload Images

```bash
# Set your API token
export CLOUDFLARE_API_TOKEN="your-token-here"

# Run the upload script
./upload-images-to-cloudflare.sh
```

The script will output the Image IDs and URLs for both assets.

## Method 2: Using Cloudflare Dashboard (Manual)

1. Go to: https://dash.cloudflare.com/0f3287b287060e3215662501ee96292e/images
2. Click "Upload Images"
3. Upload `khao-piyo-logo-final.png`
   - Set ID: `khao-piyo-logo`
   - Set Alt Text: `Khao Piyo Logo - Multi Cuisine Family Restaurant`
4. Upload `khao-piyo-text-transparent.png`
   - Set ID: `khao-piyo-text`
   - Set Alt Text: `Khao Piyo Restaurant Name`
5. Copy the image URLs from each uploaded image

## Method 3: Using cURL Directly

```bash
# Upload circular logo
curl -X POST "https://api.cloudflare.com/client/v4/accounts/0f3287b287060e3215662501ee96292e/images/v1" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -F "file=@assets/logos/khao-piyo-logo-final.png" \
  -F "id=khao-piyo-logo" \
  -F 'metadata={"alt":"Khao Piyo Logo - Multi Cuisine Family Restaurant"}'

# Upload text image
curl -X POST "https://api.cloudflare.com/client/v4/accounts/0f3287b287060e3215662501ee96292e/images/v1" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -F "file=@assets/logos/khao-piyo-text-transparent.png" \
  -F "id=khao-piyo-text" \
  -F 'metadata={"alt":"Khao Piyo Restaurant Name"}'
```

## Step 2: Update Theme Configuration

After uploading, you'll receive URLs like:
- Logo: `https://imagedelivery.net/<ACCOUNT_HASH>/khao-piyo-logo/public`
- Text: `https://imagedelivery.net/<ACCOUNT_HASH>/khao-piyo-text/public`

### Update `scripts/khaopiyo-theme-config.json`:

```json
{
  "branding": {
    "logo": {
      "url": "https://imagedelivery.net/<ACCOUNT_HASH>/khao-piyo-logo/public",
      "alt": "Khao Piyo - Multi Cuisine Family Restaurant & Bar",
      "width": 1348,
      "height": 1349
    },
    "nameImage": {
      "url": "https://imagedelivery.net/<ACCOUNT_HASH>/khao-piyo-text/public",
      "alt": "Khao Piyo",
      "width": 1658,
      "height": 244
    }
  }
}
```

## Cloudflare Images Benefits

✅ **Automatic optimization** - Images are automatically optimized for web delivery
✅ **CDN delivery** - Global CDN with automatic caching
✅ **Resize on-demand** - Add `/width=x,height=y` to URL for resizing
✅ **Format conversion** - Automatic WebP/AVIF serving to supported browsers
✅ **Fast** - Optimized for performance

## Image Variants (Optional Resizing)

You can request different sizes by appending parameters:

```
# Original size
https://imagedelivery.net/<HASH>/khao-piyo-logo/public

# Resize to 500px width
https://imagedelivery.net/<HASH>/khao-piyo-logo/w=500

# Resize to 500x500px
https://imagedelivery.net/<HASH>/khao-piyo-logo/w=500,h=500
```

## Next Steps

After uploading and updating the configuration:

1. Redeploy the theme-edge-worker:
   ```bash
   wrangler deploy
   ```

2. Test the theme API endpoint:
   ```bash
   curl https://theme-edge-worker.suyesh.workers.dev/api/grab-food/themes/khao-piyo-custom | jq
   ```

3. Verify the logo URLs are accessible in the response

## Troubleshooting

### Upload fails with authentication error
- Check your API token has **Images Write** permission
- Ensure you're using the correct account ID

### Images don't appear
- Verify the URLs are correct in the theme configuration
- Check Cloudflare Images dashboard to confirm uploads
- Clear browser cache and reload

### Need to update an image
- Upload a new version with the same ID to replace it
- Or upload with a different ID and update the configuration
