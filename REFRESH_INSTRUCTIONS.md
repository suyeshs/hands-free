# Force Refresh the Tauri App

The Tauri app window is showing old code and needs to be refreshed.

## Steps to Refresh:

1. **Click on the Tauri app window** to make it active
2. **Press Cmd+R** to refresh the app
3. If that doesn't work, **press Cmd+Shift+R** for a hard refresh

## Alternative: Force Reset

If refreshing doesn't work, you can force a reset by:

1. Clicking the **red 🔄 button** in the bottom-right corner of the app
2. Confirming the reset
3. Going through the setup wizard again

The new version should show:
- An on-screen diagnostic log at the top (black box with green text)
- A "Provisioning restaurant..." spinner during setup completion
- Then a 16-digit activation code when done

## What's Changed

The new completion screen flow:
1. Saves settings to local SQLite
2. Calls the API to provision the restaurant on the cloud
3. Displays a 16-digit activation code
4. User clicks "Proceed to Activation"
5. App reloads showing the tenant activation page
6. Code is auto-filled
7. User clicks "Activate POS"
8. Redirects to the hub

If you're still seeing "YOU'RE ALL SET!" with no activation code, the app hasn't reloaded with the new code yet.
