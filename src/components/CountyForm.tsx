import { FC } from 'hono/jsx';
import { formGroupClass, labelClass, inputClass, buttonClass, errorClass } from '../styles/forms';

type CountyFormProps = {
  action: string;
  county?: any;
  error?: string;
  isNew?: boolean;
};

export const CountyForm: FC<CountyFormProps> = ({ action, county, error, isNew = false }) => {
  return (
    <form method="POST" action={action}>
      <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 600;">
        {isNew ? 'Create New County' : 'Edit County'}
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
          value={county?.name || ''}
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="path" class={labelClass}>Path (URL slug)</label>
        <input
          type="text"
          id="path"
          name="path"
          class={inputClass}
          value={county?.path || ''}
          placeholder="e.g., salt-lake"
          pattern="[a-z0-9\-]+"
          title="Only lowercase letters, numbers, and hyphens allowed"
        />
      </div>
      
      <div class={formGroupClass}>
        <label for="description" class={labelClass}>Description</label>
        <textarea
          id="description"
          name="description"
          class={inputClass}
          rows="3"
        >{county?.description || ''}</textarea>
      </div>
      
      <div class={formGroupClass}>
        <label for="population" class={labelClass}>Population</label>
        <input
          type="number"
          id="population"
          name="population"
          class={inputClass}
          value={county?.population || ''}
          min="0"
        />
      </div>
      
      <div style="display: flex; gap: 1rem;">
        <button type="submit" class={buttonClass}>
          {isNew ? 'Create County' : 'Update County'}
        </button>
        <a href="/admin/counties" class={buttonClass} style="background-color: #6b7280; text-align: center; text-decoration: none;">
          Cancel
        </a>
      </div>
    </form>
  );
};