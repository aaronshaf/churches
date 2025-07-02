import type { FC } from 'hono/jsx';
import type { User } from '../types';

interface Comment {
  id: number;
  userId: string;
  content: string;
  isPublic: boolean;
  status: string;
  createdAt: Date;
  userName?: string;
}

interface ChurchCommentsProps {
  churchId: number;
  churchPath: string;
  comments: Comment[];
  user?: User | null;
}

export const ChurchComments: FC<ChurchCommentsProps> = ({ churchId, churchPath, comments, user }) => {
  // Filter comments based on user role and status
  const visibleComments = comments.filter((comment) => {
    // Always show approved public comments
    if (comment.status === 'approved' && comment.isPublic) {
      return true;
    }
    // Show user's own comments
    if (user && comment.userId === user.id) {
      return true;
    }
    // Admins can see all comments
    if (user?.role === 'admin') {
      return true;
    }
    return false;
  });

  return (
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Comments</h2>

      {/* Add comment form for authenticated users */}
      {user && (
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 class="font-semibold mb-2">Add a Comment</h3>
          <form method="POST" action={`/contributor/churches/${churchId}/comment`}>
            <input type="hidden" name="path" value={churchPath} />
            <textarea
              name="content"
              rows={3}
              required
              placeholder="Share your thoughts about this church..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 mb-2"
            ></textarea>
            <div class="flex items-center justify-between">
              <label class="flex items-center">
                <input type="checkbox" name="isPublic" value="true" class="mr-2" />
                <span class="text-sm text-gray-600">Make this comment public</span>
              </label>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                Post Comment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Display comments */}
      {visibleComments.length === 0 ? (
        <p class="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
      ) : (
        <div class="space-y-4">
          {visibleComments.map((comment) => (
            <div key={comment.id} class="bg-white rounded-lg border p-4">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <span class="font-semibold">{comment.userName || 'Anonymous'}</span>
                  {comment.userId === user?.id && <span class="ml-2 text-xs text-gray-500">(You)</span>}
                  <span class="ml-2 text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="flex items-center gap-2">
                  {!comment.isPublic && (
                    <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Private</span>
                  )}
                  {comment.status !== 'approved' && (
                    <span
                      class={`text-xs px-2 py-1 rounded ${
                        comment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {comment.status}
                    </span>
                  )}
                  {user?.role === 'admin' && (
                    <span class="text-xs text-gray-500">User: {comment.userId.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
              <p class="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {!user && (
        <div class="mt-4 text-center">
          <p class="text-sm text-gray-600 mb-2">Want to add a comment?</p>
          <a href="/login" class="text-blue-600 hover:underline">
            Sign in to contribute
          </a>
        </div>
      )}
    </div>
  );
};
