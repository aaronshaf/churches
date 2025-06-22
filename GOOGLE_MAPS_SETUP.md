# Google Maps Setup

To enable the map functionality on `/map`, you need to:

1. Get a Google Maps API Key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "Maps JavaScript API"
   - Create credentials (API Key)
   - Restrict the key to your domain for security

2. Replace the placeholder in the code:
   - In `src/index.tsx`, find the line:
     ```
     src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap"
     ```
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key

3. For production:
   - Consider storing the API key as an environment variable
   - Add domain restrictions to the API key in Google Cloud Console
   - Set up billing (Google Maps has a free tier)

## Security Notes

- Never commit your API key to version control
- Use environment variables for production
- Restrict the key to specific domains/IPs
- Monitor usage in Google Cloud Console