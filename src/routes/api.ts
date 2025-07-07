import { eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { affiliations, churches, comments, counties } from '../db/schema';
import { requireAdminBetter } from '../middleware/better-auth';
import type { Bindings } from '../types';

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Search churches
apiRoutes.get('/churches/search', async (c) => {
  const db = createDbWithContext(c);
  const query = c.req.query('q') || '';
  const limit = Number(c.req.query('limit')) || 10;

  if (!query || query.length < 2) {
    return c.json({ churches: [] });
  }

  const searchResults = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      countyName: counties.name,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE`)
    .orderBy(
      sql`CASE 
        WHEN ${churches.name} LIKE ${query + '%'} COLLATE NOCASE THEN 1 
        WHEN ${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE THEN 2 
        ELSE 3 
      END`,
      churches.name
    )
    .limit(limit)
    .all();

  return c.json({ churches: searchResults });
});

// Get all churches
apiRoutes.get('/churches', async (c) => {
  const db = createDbWithContext(c);
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;

  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
    })
    .from(churches)
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({
    churches: allChurches,
    limit,
    offset,
  });
});

// Get single church
apiRoutes.get('/churches/:id', async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');

  const church = await db
    .select()
    .from(churches)
    .where(eq(churches.id, Number(id)))
    .get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  return c.json(church);
});

// Delete comment (admin only)
apiRoutes.post('/comments/:id/delete', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const commentId = Number(c.req.param('id'));

  try {
    // Check if comment exists
    const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    // Delete the comment
    await db.delete(comments).where(eq(comments.id, commentId)).run();

    // Redirect back to the referring page or admin dashboard
    const referer = c.req.header('referer');
    if (referer) {
      return c.redirect(referer);
    }
    return c.redirect('/admin');
  } catch (error) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

// Get all counties
apiRoutes.get('/counties', async (c) => {
  const db = createDbWithContext(c);

  const allCounties = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .orderBy(counties.name)
    .all();

  return c.json(allCounties);
});

// Get all networks/affiliations
apiRoutes.get('/networks', async (c) => {
  const db = createDbWithContext(c);

  const allNetworks = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(eq(affiliations.status, 'Listed'))
    .orderBy(affiliations.name)
    .all();

  return c.json(allNetworks);
});

// Validate address and get coordinates (admin/contributor only)
apiRoutes.post('/geocode', requireAdminBetter, async (c) => {
  try {
    const body = await c.req.json();
    const address = body.address?.trim();

    if (!address) {
      return c.json({ error: 'Address is required' }, 400);
    }

    const apiKey = c.env.GOOGLE_SSR_KEY;
    if (!apiKey) {
      return c.json({ error: 'Google server-side API key not configured. Please set GOOGLE_SSR_KEY environment variable.' }, 500);
    }

    // Step 1: Try to validate address using Address Validation API
    let validatedAddress = address;
    let addressQuality = 'unknown';
    let addressSuggestion = null;
    let validationError = null;

    try {
      const validationRequestBody = {
        address: {
          addressLines: [address],
          regionCode: 'US'
        },
        enableUspsCass: true
      };
      
      const validationResponse = await fetch(
        `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationRequestBody)
        }
      );
      
      if (validationResponse.ok) {
        const validationData = await validationResponse.json() as any;
        
        if (validationData.result?.address) {
          const result = validationData.result;
          
          // Extract address quality information
          if (result.verdict) {
            addressQuality = result.verdict.addressComplete ? 'complete' : 
                            result.verdict.hasReplacedComponents ? 'corrected' :
                            result.verdict.hasInferredComponents ? 'inferred' : 'incomplete';
          }

          // Get the formatted address from validation
          if (result.address.formattedAddress) {
            // Remove ", USA" from the end of the address
            validatedAddress = result.address.formattedAddress.replace(/, USA$/, '');
            
            // If address was significantly corrected, note it as a suggestion
            if (result.verdict?.hasReplacedComponents) {
              addressSuggestion = result.address.formattedAddress.replace(/, USA$/, '');
            }
          }
        }
      } else {
        const errorData = await validationResponse.json() as any;
        validationError = errorData.error?.message || 'Address Validation API error';
        
        // Check if it's a referrer restriction issue
        if (errorData.error?.details?.[0]?.reason === 'API_KEY_HTTP_REFERRER_BLOCKED') {
          validationError = 'API key referrer restriction - using geocoding only';
        }
        // Continue with geocoding using original address
      }
    } catch (error) {
      validationError = 'Address Validation API unavailable';
      // Continue with geocoding using original address
    }

    // Step 2: Geocode the validated address
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(validatedAddress)}&key=${apiKey}`
    );
    
    if (!geocodeResponse.ok) {
      return c.json({ error: 'Geocoding service unavailable' }, 503);
    }

    const geocodeData = await geocodeResponse.json() as any;

    if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
      const location = geocodeData.results[0].geometry.location;
      const geocodeFormatted = geocodeData.results[0].formatted_address.replace(/, USA$/, '');
      
      return c.json({
        latitude: location.lat,
        longitude: location.lng,
        original_address: address,
        validated_address: validatedAddress,
        formatted_address: geocodeFormatted,
        address_quality: addressQuality,
        address_suggestion: addressSuggestion,
        validation_error: validationError,
        // Include additional useful info
        location_type: geocodeData.results[0].geometry.location_type,
        place_id: geocodeData.results[0].place_id
      });
    }

    // Handle specific Google API error statuses
    let errorMessage = 'Address not found';
    switch (geocodeData.status) {
      case 'ZERO_RESULTS':
        errorMessage = 'No results found for this address';
        break;
      case 'OVER_QUERY_LIMIT':
        errorMessage = 'API quota exceeded. Please try again later.';
        break;
      case 'REQUEST_DENIED':
        // Check if it's a referer restriction issue
        if (geocodeData.error_message?.includes('referer restrictions')) {
          errorMessage = 'Google API key has referrer restrictions that prevent server-side usage. Please configure the API key to allow requests from any referer or create a separate server-side API key.';
        } else {
          errorMessage = 'Request denied. Check API configuration.';
        }
        break;
      case 'INVALID_REQUEST':
        errorMessage = 'Invalid request format';
        break;
    }

    return c.json({ error: errorMessage }, 400);
  } catch (error) {
    console.error('Address validation/geocoding error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
