import type { FC } from 'hono/jsx';
import { getGravatarUrl } from '../utils/crypto';

type Comment = {
  id: number;
  content: string;
  type?: 'user' | 'system';
  metadata?: string;
  createdAt: Date;
  userName?: string;
  userEmail: string;
  userImage?: string;
  userId: string;
  isOwn: boolean;
};

type ChurchCommentsProps = {
  churchId: number;
  churchName: string;
  churchPath: string;
  comments: Comment[];
  user?: {
    id: string;
    name?: string;
    email: string;
    role: 'admin' | 'contributor' | 'user';
  };
};

export const ChurchComments: FC<ChurchCommentsProps> = ({ churchId, churchName, churchPath, comments, user }) => {
  // Only show comments section for logged-in users
  if (!user) {
    return null;
  }

  const canSeeAllComments = user && (user.role === 'admin' || user.role === 'contributor');
  const visibleComments = canSeeAllComments 
    ? comments 
    : comments.filter(comment => comment.isOwn);

  return (
    <div class="space-y-6" data-testid="church-comments">
      {/* Header */}
      <div class="flex items-center justify-between" data-testid="comments-header">
        <div>
          <h3 class="text-lg font-semibold text-gray-900" data-testid="comments-title">
            {canSeeAllComments ? 'Feedback' : 'My Notes'}
          </h3>
          <p class="text-sm text-gray-600 mt-0.5">
            {canSeeAllComments 
              ? 'Private comments from community members' 
              : 'Your personal notes about this church'
            }
          </p>
        </div>
        {visibleComments.length > 0 && (
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700" data-testid="comments-count">
            {visibleComments.length} {visibleComments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {/* Add Comment Form */}
      {user && (
        <div class="bg-white border border-gray-200 rounded-xl px-6 pt-6 pb-4 shadow-sm" data-testid="comment-form-container">
          <form method="POST" action={`/churches/${churchPath}/comments`} class="p-0 m-0" data-testid="comment-form">
            <div>
              <label for="comment-content" class="sr-only">
                Submit comment about {churchName}
              </label>
              <textarea
                id="comment-content"
                name="content"
                rows="4"
                required
                class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm placeholder-gray-400 resize-none px-4 py-3"
                placeholder={`Submit comment about ${churchName}`}
                data-testid="comment-textarea"
              ></textarea>
            </div>
            <div class="flex items-center justify-between mt-4">
              <div class="flex items-center space-x-1 text-xs text-gray-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Private comment - only visible to you and site editors</span>
              </div>
              <button
                type="submit"
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-lg transition-colors"
                data-testid="submit-comment-button"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Comment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comments List */}
      {visibleComments.length > 0 && (
        <div class="space-y-3" data-testid="comments-list">
          {visibleComments.map((comment, index) => (
            <div key={comment.id} class="group" data-testid={`comment-${index}`}>
              <div class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow" data-testid={`comment-container-${index}`}>
                <div class="flex items-start space-x-3">
                  {/* Avatar */}
                  <div class="flex-shrink-0">
                    {comment.userImage ? (
                      <img 
                        src={comment.userImage}
                        alt={comment.userName || comment.userEmail}
                        class="w-9 h-9 rounded-full object-cover border border-gray-200"
                        onerror={`this.src='${getGravatarUrl(comment.userEmail, 36)}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}`}
                      />
                    ) : (
                      <img 
                        src={getGravatarUrl(comment.userEmail, 36)}
                        alt={comment.userName || comment.userEmail}
                        class="w-9 h-9 rounded-full object-cover border border-gray-200"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                      />
                    )}
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hidden items-center justify-center" style="display: none;">
                      <span class="text-sm font-semibold text-white">
                        {comment.userName ? comment.userName.charAt(0).toUpperCase() : comment.userEmail.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center space-x-2">
                        <p class="text-sm font-medium text-gray-900" data-testid={`comment-author-${index}`}>
                          {comment.userName || comment.userEmail.split('@')[0]}
                        </p>
                        {comment.isOwn && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
                            You
                          </span>
                        )}
                        {comment.type === 'system' && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Change Log
                          </span>
                        )}
                        {canSeeAllComments && !comment.isOwn && comment.type !== 'system' && (
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Member
                          </span>
                        )}
                      </div>
                      <div class="flex items-center space-x-3">
                        <time class="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: new Date(comment.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </time>
                        {user.role === 'admin' && (
                          <div class="border-l border-gray-300 pl-3">
                            <form method="POST" action={`/churches/${churchPath}/comments/${comment.id}/delete`} class="inline">
                              <button
                                type="submit"
                                onclick="return confirm('Are you sure you want to delete this comment?')"
                                class="text-xs text-red-600 hover:text-red-800 focus:outline-none transition-colors font-medium"
                                title="Delete comment"
                                data-testid={`delete-comment-${index}`}
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                    <div class="prose prose-sm max-w-none">
                      {comment.type === 'system' ? (
                        <div class="text-gray-700 text-sm" data-testid={`comment-content-${index}`}>
                          <div dangerouslySetInnerHTML={{ 
                            __html: comment.content
                              .replace(/```yaml\n([\s\S]*?)```/g, '<pre class="bg-gray-50 p-3 rounded-lg overflow-x-auto mt-2 text-xs font-mono">$1</pre>')
                              .replace(/\n/g, '<br>')
                          }} />
                        </div>
                      ) : (
                        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap" data-testid={`comment-content-${index}`}>{comment.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};