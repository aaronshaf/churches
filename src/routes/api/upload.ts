import { Hono } from 'hono';
import { createAuth } from '../../lib/auth';
import type { Bindings } from '../../types';
import { deleteImage, uploadImage } from '../../utils/r2-images';

const upload = new Hono<{ Bindings: Bindings }>();

upload.post('/image', async (c) => {
  try {
    // Check authentication
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'contributor')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('image') as File;
    const folder = formData.get('folder') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!folder || !['churches', 'counties', 'pages', 'site'].includes(folder)) {
      return c.json({ error: 'Invalid folder' }, 400);
    }

    const result = await uploadImage(file, folder as 'churches' | 'counties' | 'pages' | 'site', c.env);

    return c.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      500
    );
  }
});

upload.delete('/image', async (c) => {
  try {
    // Check authentication
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'contributor')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { path } = await c.req.json<{ path: string }>();

    if (!path) {
      return c.json({ error: 'Missing image path' }, 400);
    }

    await deleteImage(path, c.env);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

export default upload;
