import { FC } from 'hono/jsx';
import { formGroupClass, labelClass, inputClass, buttonClass, errorClass } from '../styles/forms';

type AffiliationFormProps = {
  action: string;
  affiliation?: any;
  error?: string;
  isNew?: boolean;
};

export const AffiliationForm: FC<AffiliationFormProps> = ({ action, affiliation, error, isNew = false }) => {
  return (
    <form method="POST" action={action}>
      <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
        {isNew ? 'Create New Affiliation' : 'Edit Affiliation'}
      </h2>
      
      {error && (
        <p class={errorClass} style="margin-bottom: 1rem;">
          {error}
        </p>
      )}
      
      <div class={formGroupClass}>
        <label for="name" class={labelClass}>Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          class={inputClass}
          value={affiliation?.name || ''}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="website" class={labelClass}>Website</label>
        <input
          type="url"
          id="website"
          name="website"
          class={inputClass}
          value={affiliation?.website || ''}
          placeholder="https://example.com"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="publicNotes" class={labelClass}>Public Notes</label>
        <textarea
          id="publicNotes"
          name="publicNotes"
          class={inputClass}
          rows="4"
          placeholder="Notes visible to the public"
        >{affiliation?.publicNotes || ''}</textarea>
      </div>
      
      <div class={formGroupClass}>
        <label for="privateNotes" class={labelClass}>Private Notes</label>
        <textarea
          id="privateNotes"
          name="privateNotes"
          class={inputClass}
          rows="4"
          placeholder="Internal notes (not visible to public)"
        >{affiliation?.privateNotes || ''}</textarea>
      </div>
      
      <div style="display: flex; gap: 1rem;">
        <button type="submit" class={buttonClass}>
          {isNew ? 'Create Affiliation' : 'Update Affiliation'}
        </button>
        <a href="/admin/affiliations" class={buttonClass} style="background-color: #6b7280; text-align: center; text-decoration: none;">
          Cancel
        </a>
      </div>
    </form>
  );
};